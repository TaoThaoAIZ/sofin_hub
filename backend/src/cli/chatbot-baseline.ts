/**
 * Nạp dữ liệu nền chatbot (câu mẫu FAQ + chủ đề Zalo viết lại + câu chờ điền + tài liệu prisma/chatbot-kb) — CHẠY TAY,
 * backend không tự nạp. Nằm trong src/ để build ra dist/ => chạy được trong image production (không có tsx).
 *   dev:   npm run chatbot:baseline:dev [-- --status | --force]
 *   prod:  npm run chatbot:baseline [-- --status | --force]          (sau `npm run build`)
 *   AWS:   docker compose exec backend node dist/cli/chatbot-baseline.js [--status | --force]
 * Mặc định: nạp nếu DB chưa có bản hiện tại (CHATBOT_BASELINE_VERSION). --force: nạp lại dù đã nạp (vẫn không ghi đè câu mẫu /
 * tài liệu admin đã sửa — chỉ thêm cái còn thiếu). --status: chỉ xem, không ghi.
 */
import { disconnectPrisma, prisma } from '../db/prisma.js';
import { CHATBOT_BASELINE_VERSION, chatbotBaselineVersion, ensureChatbotBaseline } from '../modules/chatbot/chatbot.baseline.js';

const args = process.argv.slice(2);

async function status() {
  const [version, qa, docs] = await Promise.all([
    chatbotBaselineVersion(),
    prisma.chatbotQA.groupBy({ by: ['status'], where: { id: { startsWith: 'seed-chatbot-qa-' } }, _count: true }),
    prisma.chatbotDocument.count({ where: { status: 'active' } }),
  ]);
  const byStatus = Object.fromEntries(qa.map((r) => [r.status, r._count]));
  console.log(`Dữ liệu nền: DB ${version === null ? 'chưa nạp' : `v${version}`} / bản trong code v${CHATBOT_BASELINE_VERSION}`);
  console.log(`  câu mẫu nền theo trạng thái: ${JSON.stringify(byStatus)} · tài liệu đang bật: ${docs}`);
  if (version === null || version < CHATBOT_BASELINE_VERSION) console.log('  => chưa nạp bản hiện tại, chạy lại lệnh này không kèm --status để nạp.');
}

try {
  if (args.includes('--status')) {
    await status();
  } else {
    const r = await ensureChatbotBaseline({ force: args.includes('--force') });
    console.log('skipped' in r ? `Đã nạp v${CHATBOT_BASELINE_VERSION} từ trước — không làm gì (dùng --force để nạp lại phần còn thiếu).` : `Xong: +${r.qa} câu mẫu mới, ${r.revised} câu nền được cập nhật, +${r.documents} tài liệu.`);
    await status();
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
