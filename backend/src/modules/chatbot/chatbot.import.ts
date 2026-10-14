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

/** Nạp mọi file `.md` trong thư mục thành ChatbotDocument (slug = tên file). Idempotent theo contentHash. */
export async function importKnowledgeDir(dir: string, updatedById: string | null = null) {
  const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.md')).sort();
  const results: { slug: string; result: 'created' | 'updated' | 'unchanged'; chunks: number; staleQa: number }[] = [];
  for (const f of files) {
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

/**
 * Nhập các nhóm câu hỏi lặp lại >= minCount lần thành Q&A `candidate` (source=import) chờ admin duyệt — KHÔNG BAO GIỜ tự bật.
 * Bỏ mục không có câu trả lời và mục có câu trả lời nhắc số tài khoản / chuyển khoản tay; che SĐT/email/dãy số dài.
 * Idempotent: id = hash(câu hỏi) + createMany(skipDuplicates).
 */
export async function importCandidates(markdowns: string[], minCount = 5) {
  const rows = markdowns
    .flatMap(parseCandidates)
    .filter((i) => i.count >= minCount && i.question && i.answer)
    .filter((i) => !looksLikeBankAccount(i.answer) && !/chuy[eể]n kho[aả]n|\bstk\b/i.test(i.answer))
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
  const { count } = await prisma.chatbotQA.createMany({ data: rows, skipDuplicates: true });
  return { eligible: rows.length, inserted: count };
}
