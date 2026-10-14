/**
 * Đo chất lượng chatbot với model THẬT (Codex đăng nhập ChatGPT) trên DB dev — không chạy trong CI.
 *   npm run chatbot:eval                         # toàn bộ tests/chatbot-golden.vi.json
 *   npm run chatbot:eval -- --only=t01,b02       # chỉ vài case
 *   npm run chatbot:eval -- --user=member2@sofinhub.test
 * Mỗi case chạy trong hội thoại MỚI (không lẫn ngữ cảnh). Báo 2 con số chính: tỉ lệ trả lời đúng và tỉ lệ chuyển người sai,
 * ghi chi tiết ra data/chatbot-eval-<thời điểm>.json. Case chuyển người tạo ticket thật trong DB dev.
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
}

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const golden = JSON.parse(readFileSync(join(here, '../tests/chatbot-golden.vi.json'), 'utf8')) as { cases: Case[] };
const only = arg('only')?.split(',');
const cases = only ? golden.cases.filter((c) => only.includes(c.id)) : golden.cases;
const email = arg('user') ?? 'member1@sofinhub.test';
const norm = (s: string) => normalizeText(s).replace(/\s+/g, ' ');

try {
  await refreshChatbotSettings();
  if (!chatbotAvailable()) throw new Error('Chatbot đang tắt: chạy `npm run chatbot:codex-login` (hoặc bật lại ở Admin > Chatbot > Cài đặt).');
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`Không có user ${email} (chạy npm run db:seed)`);

  const results = [];
  for (const c of cases) {
    const conv = await conversationRepository.create(user.id);
    const started = Date.now();
    let reply = '';
    let got: string = 'error';
    try {
      const done = await chatbotService.sendMessage(user.id, conv.id, c.q, () => undefined);
      reply = done.message.content;
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
    for (const r of c.must_not_match ?? []) if (new RegExp(r, 'iu').test(reply)) problems.push(`khớp /${r}/`);
    const ok = problems.length === 0;
    results.push({ ...c, got, ok, problems, ms, reply });
    console.log(`${ok ? '✓' : '✗'} ${c.id.padEnd(4)} [${got}] ${(ms / 1000).toFixed(1)}s  ${c.q}${ok ? '' : `\n      -> ${problems.join('; ')}\n      bot: ${reply.replace(/\n/g, ' ').slice(0, 200)}`}`);
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
    avgSeconds: Math.round(results.reduce((a, r) => a + r.ms, 0) / Math.max(1, results.length) / 100) / 10,
  };
  console.log('\nTổng kết:', summary);
  const out = join(here, '../data', `chatbot-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ summary, results }, null, 2));
  console.log(`Chi tiết: ${out}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
