/**
 * Nạp tài liệu tri thức chatbot (file .md, mỗi mục `##` là 1 đoạn) vào ChatbotDocument. Chạy lại an toàn (bỏ qua file không đổi).
 *   npm run chatbot:import-kb                 # thư mục mặc định prisma/chatbot-kb
 *   npm run chatbot:import-kb -- <thư mục>
 */
import { prisma } from '../src/db/prisma.js';
import { BUNDLED_KB_DIR, importKnowledgeDir } from '../src/modules/chatbot/chatbot.import.js';

const dir = process.argv[2] ?? BUNDLED_KB_DIR;
try {
  const results = await importKnowledgeDir(dir);
  for (const r of results) console.log(`${r.result.padEnd(9)} ${r.slug} (${r.chunks} đoạn${r.staleQa ? `, ${r.staleQa} Q&A chuyển sang stale` : ''})`);
  console.log(`Xong: ${results.length} tài liệu từ ${dir}`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
