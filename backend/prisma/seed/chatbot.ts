import { BUNDLED_KB_DIR, importKnowledgeDir } from '../../src/modules/chatbot/chatbot.import.js';
import { seedBaselineQa } from '../../src/modules/chatbot/chatbot.baseline.js';
import type { SeedContext } from './context.js';

/**
 * Chatbot (dev/test): câu mẫu nền (src/modules/chatbot/chatbot.baseline.ts — FAQ công khai + chủ đề Zalo viết lại) + tài liệu tri thức
 * đi kèm repo (prisma/chatbot-kb). Production không chạy seed: backend tự nạp qua `ensureChatbotBaseline` khi khởi động.
 */
export { CHATBOT_FAQ } from '../../src/modules/chatbot/chatbot.baseline.js';

export async function seedChatbot({ db }: SeedContext): Promise<void> {
  await seedBaselineQa(db);
  await importKnowledgeDir(BUNDLED_KB_DIR);
}
