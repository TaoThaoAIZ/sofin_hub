/**
 * Nhập câu hỏi thật từ dữ liệu Zalo đã phân tích (crawl_zalo/output/analysis/candidates_*.md) thành Q&A CHỜ DUYỆT.
 * Không đọc hội thoại thô; tên khách bị bỏ, SĐT/email/dãy số dài bị che; mục nhắc số tài khoản/chuyển khoản tay bị loại.
 *   npm run chatbot:import-candidates -- <file.md> [<file.md>...] [--min=5]
 */
import { readFile } from 'node:fs/promises';
import { prisma } from '../src/db/prisma.js';
import { importCandidates } from '../src/modules/chatbot/chatbot.import.js';

const args = process.argv.slice(2);
const min = Number(args.find((a) => a.startsWith('--min='))?.slice(6) ?? 5);
const files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('Thiếu file: npm run chatbot:import-candidates -- <candidates_pricing.md> <candidates_bugs.md>');
  process.exit(1);
}
try {
  const r = await importCandidates(await Promise.all(files.map((f) => readFile(f, 'utf8'))), min);
  console.log(`Xong: ${r.eligible} nhóm câu hỏi đủ điều kiện (lặp >= ${min} lần), thêm mới ${r.inserted} Q&A chờ duyệt.`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
