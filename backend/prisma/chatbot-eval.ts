/**
 * Đo chất lượng chatbot với model THẬT (Codex đăng nhập ChatGPT) trên DB dev — không chạy trong CI.
 *   npm run chatbot:eval                         # toàn bộ tests/chatbot-golden.vi.json
 *   npm run chatbot:eval -- --only=t01,b02       # chỉ vài case
 *   npm run chatbot:eval -- --user=member2@sofinhub.test
 *   npm run chatbot:eval -- --file=tests/chatbot-zalo.vi.json [--topic=gia,loi]   # bộ câu hỏi thật từ Zalo
 * Mỗi case chạy trong hội thoại MỚI (không lẫn ngữ cảnh). Báo 2 con số chính: tỉ lệ trả lời đúng và tỉ lệ chuyển người sai,
 * ghi chi tiết ra data/chatbot-eval-<thời điểm>.json + .md. Case chuyển người tạo ticket thật trong DB dev.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';
import { chatbotAvailable, refreshChatbotSettings } from '../src/modules/chatbot/chatbot.config.js';
import { conversationRepository } from '../src/modules/chatbot/chatbot.conversations.js';
import { chatbotService } from '../src/modules/chatbot/chatbot.service.js';
import { normalizeText } from '../src/modules/search/search.text.js';

type Outcome = 'answer' | 'escalate' | 'refuse' | 'any';
interface Case {
  id: string;
  q: string;
  outcome: Outcome;
  must_contain?: string[];
  must_not_contain?: string[];
  must_not_match?: string[];
  /** Nhóm chủ đề (bộ Zalo) — để thống kê theo nhóm và lọc bằng --topic. */
  topic?: string;
  /** Tin khách gửi TRƯỚC `q` trong cùng hội thoại (vd bấm gợi ý sau khi bot hỏi lại). */
  history?: string[];
  /** Kỳ vọng bot hỏi lại kèm gợi ý trả lời nhanh — chỉ thống kê, không tính trượt. */
  ask_back?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = arg('file') ?? 'tests/chatbot-golden.vi.json';
const golden = JSON.parse(readFileSync(join(here, '..', file), 'utf8')) as { cases: Case[]; patterns?: Record<string, string> };
// "$PRICE" trong must_not_match = regex dùng chung khai báo ở `patterns` của file.
const pattern = (r: string) => (r.startsWith('$') ? (golden.patterns?.[r.slice(1)] ?? r) : r);
const only = arg('only')?.split(',');
const topics = arg('topic')?.split(',');
const cases = golden.cases.filter((c) => (!only || only.includes(c.id)) && (!topics || topics.includes(c.topic ?? '')));
const email = arg('user') ?? 'member1@sofinhub.test';
const norm = (s: string) => normalizeText(s).replace(/\s+/g, ' ');
const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ');

try {
  await refreshChatbotSettings();
  if (!chatbotAvailable()) throw new Error('Chatbot đang tắt: chạy `npm run chatbot:codex-login` (hoặc bật lại ở Admin > Chatbot > Cài đặt).');
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`Không có user ${email} (chạy npm run db:seed)`);

  const results: (Case & { got: string; ok: boolean; problems: string[]; ms: number; reply: string; suggestions: string[] })[] = [];
  for (const c of cases) {
    const conv = await conversationRepository.create(user.id);
    const started = Date.now();
    let reply = '';
    let got: string = 'error';
    let suggestions: string[] = [];
    try {
      for (const h of c.history ?? []) await chatbotService.sendMessage(user.id, conv.id, h, () => undefined);
      const done = await chatbotService.sendMessage(user.id, conv.id, c.q, () => undefined);
      reply = done.message.content;
      suggestions = done.suggestions;
      got = { qa_direct: 'answer', agent: 'answer', handoff: 'escalate', refusal: 'refuse', error: 'error' }[done.message.answerSource ?? 'error'] ?? 'error';
    } catch (e) {
      reply = e instanceof Error ? e.message : String(e);
    }
    const ms = Date.now() - started;
    const text = norm(reply);
    const problems: string[] = [];
    if (got === 'error') problems.push('lỗi khi trả lời');
    else if (c.outcome !== 'any' && got !== c.outcome) problems.push(`kết quả ${got}, mong đợi ${c.outcome}`);
    else if (c.outcome === 'any' && got === 'refuse') problems.push('bị từ chối nhầm');
    for (const m of c.must_contain ?? []) if (!m.split('|').some((alt) => text.includes(norm(alt)))) problems.push(`thiếu "${m}"`);
    for (const m of c.must_not_contain ?? []) if (text.includes(norm(m))) problems.push(`có "${m}"`);
    for (const r of c.must_not_match ?? []) if (new RegExp(pattern(r), 'iu').test(reply)) problems.push(`khớp /${r}/`);
    const ok = problems.length === 0;
    results.push({ ...c, got, ok, problems, ms, reply, suggestions });
    const sugg = suggestions.length ? `  [gợi ý: ${suggestions.join(' | ')}]` : '';
    const detail = ok ? '' : `\n      -> ${problems.join('; ')}\n      bot: ${reply.replace(/\n/g, ' ').slice(0, 200)}`;
    console.log(`${ok ? '✓' : '✗'} ${c.id.padEnd(4)} [${got}] ${(ms / 1000).toFixed(1)}s  ${c.q}${sugg}${detail}`);
  }

  const shouldAnswer = results.filter((r) => r.outcome === 'answer');
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    correctAnswers: pct(shouldAnswer.filter((r) => r.ok).length, shouldAnswer.length),
    falseHandoffs: pct(shouldAnswer.filter((r) => r.got === 'escalate').length, shouldAnswer.length),
    escalateRecall: pct(results.filter((r) => r.outcome === 'escalate' && r.got === 'escalate').length, results.filter((r) => r.outcome === 'escalate').length),
    refuseRecall: pct(results.filter((r) => r.outcome === 'refuse' && r.got === 'refuse').length, results.filter((r) => r.outcome === 'refuse').length),
    askBack: pct(results.filter((r) => r.ask_back && r.suggestions.length).length, results.filter((r) => r.ask_back).length),
    avgSeconds: Math.round(results.reduce((a, r) => a + r.ms, 0) / Math.max(1, results.length) / 100) / 10,
  };
  const byTopic = [...new Set(results.map((r) => r.topic ?? '-'))].map((topic) => {
    const rs = results.filter((r) => (r.topic ?? '-') === topic);
    return { topic, passed: rs.filter((r) => r.ok).length, total: rs.length };
  });
  console.log('\nTổng kết:', summary);
  if (byTopic.length > 1) console.table(byTopic);

  const out = join(here, '../data', `chatbot-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ file, summary, byTopic, results }, null, 2));
  // Báo cáo đọc nhanh (data/ không commit: có nội dung trả lời của bot).
  const md = [
    `# Chatbot eval — ${file} — ${new Date().toLocaleString('vi-VN')}`,
    '',
    `Đạt **${summary.passed}/${summary.total}** · trả lời đúng ${summary.correctAnswers} · chuyển người sai ${summary.falseHandoffs} · chuyển người đúng ${summary.escalateRecall} · từ chối đúng ${summary.refuseRecall} · hỏi lại kèm gợi ý ${summary.askBack} · trung bình ${summary.avgSeconds}s`,
    '',
    '| Nhóm | Đạt |',
    '|---|---|',
    ...byTopic.map((t) => `| ${t.topic} | ${t.passed}/${t.total} |`),
    '',
    '| ID | Nhóm | Câu hỏi | Mong đợi | Kết quả | Đạt | Vấn đề | Bot trả lời | Gợi ý |',
    '|---|---|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.topic ?? ''} | ${cell([...(r.history ?? []), r.q].join(' → '))} | ${r.outcome} | ${r.got} | ${r.ok ? '✓' : '✗'} | ${cell(r.problems.join('; '))} | ${cell(r.reply.slice(0, 300))} | ${cell(r.suggestions.join(', '))} |`,
    ),
  ].join('\n');
  writeFileSync(out.replace(/\.json$/, '.md'), md);
  console.log(`Chi tiết: ${out} (+ .md)`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
