/**
 * Đo tải chatbot: N người hỏi CÙNG LÚC (chatbot.md — 10-50 người). Chạy trong 1 tiến trình = đúng 1 máy chủ (hàng đợi giới hạn song
 * song là theo tiến trình). Tạo user tạm, gửi đồng loạt, in bảng kết quả, xóa user tạm. KHÔNG chạy trong CI.
 *   npm run chatbot:load -- --users=50                              # bot Tào
 *   npm run chatbot:load -- --users=25 --bot=paid-demo              # bot của cộng đồng (user tạm được thêm làm thành viên)
 *   npm run chatbot:load -- --users=50 --concurrency=6 --wait=60000 # thử cấu hình hàng đợi khác
 * Model: theo env — CHATBOT_FAKE_MODEL=1 CHATBOT_FAKE_DELAY_MS=9000 để MÔ PHỎNG độ trễ Codex (không tốn hạn mức); không đặt => Codex thật
 * (mỗi người 1 lượt gọi ChatGPT — 50 người = 50 lượt, có thể chạm hạn mức).
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';
import { chatbotService } from '../src/modules/chatbot/chatbot.service.js';
import { llmLimiter } from '../src/modules/chatbot/chatbot.model.js';
import { communityBotService } from '../src/modules/community-bot/community-bot.service.js';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const N = Number(arg('users') ?? 10);
const bot = arg('bot') ?? 'tao';
const concurrency = arg('concurrency') ? Number(arg('concurrency')) : undefined;
const wait = arg('wait') ? Number(arg('wait')) : undefined;
const question = arg('q') ?? (bot === 'tao' ? 'tool grok automation dùng để làm gì' : 'cộng đồng này có những bài học gì');
if (concurrency || wait) llmLimiter.configure({ ...(concurrency ? { max: concurrency } : {}), ...(wait ? { waitMs: wait } : {}) });

const stamp = Date.now().toString(36);
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))]! : 0);
const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const userIds: string[] = [];
try {
  for (let i = 0; i < N; i++) {
    const u = await prisma.user.create({ data: { email: `load-${stamp}-${i}@load.local`, firstName: 'Load', lastName: `#${i}`, passwordHash: randomUUID(), emailVerified: true } as never });
    userIds.push(u.id);
  }
  if (bot !== 'tao') await prisma.enrollment.createMany({ data: userIds.map((userId) => ({ userId, communityId: bot })) });

  const st0 = llmLimiter.stats();
  console.log(`\n${N} người hỏi cùng lúc · bot: ${bot} · model: ${env.CHATBOT_FAKE_MODEL ? `giả (trễ ${env.CHATBOT_FAKE_DELAY_MS}ms)` : 'Codex thật'} · song song tối đa ${st0.max} · chờ tối đa ${sec(st0.waitMs)}`);
  const t0 = Date.now();
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const started = Date.now();
      let maxAhead = -1;
      const emit = (e: { event: string; data: unknown }) => {
        if (e.event === 'queued') maxAhead = Math.max(maxAhead, (e.data as { ahead: number }).ahead);
      };
      try {
        const done =
          bot === 'tao'
            ? await chatbotService.sendMessage(userId, (await chatbotService.startConversation(userId)).conversation.id, question, emit as never)
            : await communityBotService.sendMessage(userId, bot, (await communityBotService.startConversation(userId, bot)).conversation.id, question, emit as never);
        return { source: done.message.answerSource ?? 'error', busy: /cùng lúc/.test(done.message.content), ms: Date.now() - started, maxAhead };
      } catch (e) {
        return { source: `lỗi ${e instanceof Error ? e.message.slice(0, 60) : e}`, busy: false, ms: Date.now() - started, maxAhead };
      }
    }),
  );
  const total = Date.now() - t0;
  const ok = results.filter((r) => r.source === 'agent' || r.source === 'qa_direct');
  const busy = results.filter((r) => r.source === 'error' && r.busy);
  const other = results.filter((r) => !ok.includes(r) && !busy.includes(r));
  const st = llmLimiter.stats();
  console.table({
    'được trả lời': ok.length,
    'báo "đang bận"': busy.length,
    'lỗi khác': other.length,
    'phải xếp hàng': results.filter((r) => r.maxAhead >= 0).length,
    'xếp hàng xa nhất (người phía trước)': Math.max(...results.map((r) => r.maxAhead)) + 1,
    'thời gian chờ p50 (người được trả lời)': sec(pct(ok.map((r) => r.ms), 50)),
    'thời gian chờ p95': sec(pct(ok.map((r) => r.ms), 95)),
    'lâu nhất': sec(Math.max(0, ...ok.map((r) => r.ms))),
    'tổng thời gian': sec(total),
    'song song cao nhất': st.maxActiveSeen,
  });
  if (other.length) console.log('Lỗi khác:', [...new Set(other.map((r) => r.source))]);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  // Xóa user tạm (cascade: hội thoại, tin nhắn, thành viên).
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
}
