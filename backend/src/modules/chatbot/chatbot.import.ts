import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../db/prisma.js';
import { looksLikeBankAccount, redactPii } from './chatbot.pii.js';
import { chatbotRepository } from './chatbot.repository.js';

/** Thư mục tài liệu tri thức đi kèm repo (đã làm sạch: không số tài khoản, không dữ liệu khách). */
export const BUNDLED_KB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../prisma/chatbot-kb');

const slugOf = (file: string) =>
  basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Nạp mọi file `.md` trong thư mục thành ChatbotDocument (slug = tên file). Idempotent theo contentHash.
 * `onlyMissing`: chỉ tạo slug chưa có (dữ liệu nền lúc khởi động — không ghi đè tài liệu admin đã sửa/lưu trữ).
 */
export async function importKnowledgeDir(dir: string, updatedById: string | null = null, opts: { onlyMissing?: boolean } = {}) {
  const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.md')).sort();
  const results: { slug: string; result: 'created' | 'updated' | 'unchanged' | 'kept'; chunks: number; staleQa: number }[] = [];
  for (const f of files) {
    if (opts.onlyMissing && (await prisma.chatbotDocument.findUnique({ where: { slug: slugOf(f) }, select: { id: true } }))) {
      results.push({ slug: slugOf(f), result: 'kept', chunks: 0, staleQa: 0 });
      continue;
    }
    const contentMd = await readFile(join(dir, f), 'utf8');
    const r = await chatbotRepository.upsertDocument({ slug: slugOf(f), contentMd, updatedById });
    results.push({ slug: r.document.slug, result: r.result, chunks: r.chunks, staleQa: r.staleQa });
  }
  return results;
}

export interface CandidateItem {
  topic: string;
  count: number;
  question: string;
  answer: string;
}

/**
 * Đọc file phân tích `candidates_*.md` (crawl_zalo/output/analysis). Mỗi mục: `- Nx, newest — **[date] Q** (Tên khách): <câu hỏi>`
 * rồi dòng `**[date] A**: <câu trả lời>`. Tên khách (trong ngoặc) bị bỏ, không bao giờ lưu.
 */
export function parseCandidates(md: string): CandidateItem[] {
  const items: CandidateItem[] = [];
  let topic = '';
  let cur: { count: number; q: string[]; a: string[]; mode: 'q' | 'a' } | null = null;
  const push = () => {
    if (cur) items.push({ topic, count: cur.count, question: cur.q.join('\n').trim(), answer: cur.a.join('\n').trim() });
    cur = null;
  };
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const h = /^##\s+(.+?)(?:\s+—.*)?$/.exec(raw);
    if (h) {
      push();
      topic = h[1]!.trim();
      continue;
    }
    const item = /^-\s+(\d+)x,.*?\*\*\[[^\]]*\]\s*Q\*\*\s*(?:\([^)]*\))?:?\s*(.*)$/.exec(raw);
    if (item) {
      push();
      cur = { count: Number(item[1]), q: item[2] ? [item[2]] : [], a: [], mode: 'q' };
      continue;
    }
    if (!cur) continue;
    const ans = /^\s*\*\*\[[^\]]*\]\s*A\*\*:?\s*(.*)$/.exec(raw);
    if (ans) {
      cur.mode = 'a';
      if (ans[1]) cur.a.push(ans[1]);
      continue;
    }
    // Dòng tiếp nối thuộc phần (hỏi/đáp) đang đọc.
    (cur.mode === 'q' ? cur.q : cur.a).push(raw.trim());
  }
  push();
  return items;
}

const MAX_LEN = 1000;
const clip = (s: string) => (s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s);

/** Dòng chỉ là chào/xác nhận ("ok bạn", "dạ vâng ạ", "alo"…) — bỏ khỏi đầu câu hỏi/câu trả lời. */
const FILLER_WORDS = new Set(
  'ok oke okee okay ok. dạ da vâng vang ừ uh alo hi hello chào cảm ơn thanks ui ạ à ah bạn b a anh chị c em e bác huynh tào nha nhé ơi'.split(' '),
);
const isFillerLine = (line: string) => line.toLowerCase().split(/[^\p{L}\p{N}]+/u).every((w) => !w || FILLER_WORDS.has(w));
/** Chú thích của file phân tích ("… plus 4873 other distinct phrasing(s)…") — không phải nội dung chat. */
const ANALYSIS_NOTE = /…?\s*plus \d+ other distinct phrasing.*$/imu;
/** Câu trả lời chỉ đòi thêm thông tin / hẹn kiểm tra — không dùng lại được cho khách khác. */
const NOT_AN_ANSWER = /(?:check|kiểm tra|đợi|chờ|chụp|gửi (?:lại|ảnh|hình|mail)|để (?:bên )?(?:e|em|mình|tào)\s)/iu;
/** Tên tài khoản nội bộ ("gửi ultra") — câu trả lời chỉ dùng được trong đúng cuộc chat đó. */
const INTERNAL = /u[l]?tra|stt\s*\d|khách bị gì/iu;
/** Giọng chat cá nhân không hợp với bot (xưng "huynh", viết tắt, đẩy khách sang bên khác). */
const CHATTY = /(?<![\p{L}])(?:huynh|xl|ko nt|sr|ui)(?![\p{L}])|lấy bên khác|bên nào cũng lỗi/iu;
/** Hứa thời gian cụ thể (không kiểm chứng được). */
const TIME_PROMISE = /(?<![\p{L}])(?:sáng mai|ngày mai|tối nay|chiều nay|trong ngày|mai sẽ)(?![\p{L}])/iu;
/** Câu trả lời hỏi ngược lại khách — chưa phải câu trả lời. */
const COUNTER_QUESTION = /\?|(?<![\p{L}])(?:gì ạ|hay sao|đúng (?:ko|không)|phải (?:ko|không))(?![\p{L}])|(?<![\p{L}])à\s*$/imu;
/** Câu hỏi thật thường có dấu hỏi hoặc từ để hỏi. */
const QUESTION_CUE = /\?|(?<![\p{L}])(?:sao|không|ko|k|chưa|nào|gì|bao nhiêu|bao giờ|khi nào|thế nào|như nào|ở đâu|được không|đc không|nhỉ|hả|có .+ không)(?![\p{L}])/iu;
/** Câu trả lời có con số giá (bot không được tự báo giá). */
const PRICE = /\d[\d.,]*\s*(?:k(?![\p{L}])|đ|đồng|vnđ|vnd|\$|usd|tr(?![\p{L}])|triệu|nghìn|ngàn)|gói\s*\d/iu;
/** Không phải câu hỏi của khách (prompt kịch bản dán vào, log kỹ thuật dài). */
const PASTED_PROMPT = /LOCKED SLOT|engine=|@<|duration=\d/u;

const cleanLines = (s: string) => {
  const lines = s
    .replace(ANALYSIS_NOTE, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  while (lines.length > 1 && isFillerLine(lines[0]!)) lines.shift();
  return lines.join('\n').trim();
};
const wordCount = (s: string) => s.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/**
 * Lọc nhóm câu hỏi đáng đưa cho admin duyệt (2026-10-14: bản đầu nhập cả câu chào, câu trả lời "đợi xí", prompt dán vào, giá trôi nổi).
 * Trả lý do bị loại (script in thống kê) hoặc null nếu giữ.
 */
export function candidateRejectReason(i: { question: string; answer: string }): string | null {
  if (!i.question || !i.answer) return 'thiếu hỏi/đáp';
  if (PASTED_PROMPT.test(i.question) || i.question.length > 400) return 'không phải câu hỏi';
  if (isFillerLine(i.question) || wordCount(i.question) < 3) return 'câu hỏi quá ngắn';
  if (!QUESTION_CUE.test(i.question)) return 'không phải câu hỏi';
  if (wordCount(i.answer) < 6) return 'câu trả lời quá ngắn';
  if (looksLikeBankAccount(i.answer) || /chuy[eể]n kho[aả]n|\bstk\b/iu.test(i.answer)) return 'nhắc chuyển khoản/STK';
  if (PRICE.test(i.answer)) return 'có con số giá';
  if (INTERNAL.test(i.answer) || (NOT_AN_ANSWER.test(i.answer) && wordCount(i.answer) < 15)) return 'chỉ hẹn kiểm tra/đòi thêm thông tin';
  if (COUNTER_QUESTION.test(i.answer)) return 'hỏi ngược lại khách';
  if (TIME_PROMISE.test(i.answer)) return 'hứa thời gian';
  if (CHATTY.test(i.answer)) return 'văn nói cá nhân';
  return null;
}

/**
 * Nhập các nhóm câu hỏi lặp lại >= minCount lần thành Q&A `candidate` (source=import) chờ admin duyệt — KHÔNG BAO GIỜ tự bật.
 * Bỏ câu chào/xác nhận ở đầu, loại mục không đáng duyệt (`candidateRejectReason`); che SĐT/email/dãy số dài.
 * Idempotent: id = hash(câu hỏi) + createMany(skipDuplicates).
 */
export async function importCandidates(markdowns: string[], minCount = 5, opts: { dryRun?: boolean } = {}) {
  const rejected: Record<string, number> = {};
  const rows = markdowns
    .flatMap(parseCandidates)
    .filter((i) => i.count >= minCount)
    .map((i) => ({ ...i, question: cleanLines(i.question), answer: cleanLines(i.answer) }))
    .filter((i) => {
      const reason = candidateRejectReason(i);
      if (reason) rejected[reason] = (rejected[reason] ?? 0) + 1;
      return !reason;
    })
    .map((i) => {
      const question = clip(redactPii(i.question).text);
      return {
        id: `import-zalo-${createHash('sha1').update(question).digest('hex').slice(0, 20)}`,
        question,
        answer: clip(redactPii(i.answer).text),
        tags: ['zalo', i.topic].filter(Boolean),
        status: 'candidate' as const,
        source: 'import' as const,
      };
    });
  if (opts.dryRun) return { eligible: rows.length, inserted: 0, rejected, rows };
  const { count } = await prisma.chatbotQA.createMany({ data: rows, skipDuplicates: true });
  return { eligible: rows.length, inserted: count, rejected, rows };
}
