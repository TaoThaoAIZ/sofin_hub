import type { ChatbotMessage } from '../../generated/prisma/client.js';
import { chatbotAvailable, chatbotSettings } from './chatbot.config.js';
import { conversationRepository } from './chatbot.conversations.js';
import { looksLikeBankAccount, redactPii } from './chatbot.pii.js';
import { LlmQuotaError } from './chatbot.llm.js';
import { chatLlm } from './chatbot.model.js';
import { buildLearnPrompt, learnSchema } from './chatbot.prompt.js';
import { chatbotRepository } from './chatbot.repository.js';

/**
 * Job `chatbot.learn` (chatbot.md mục 3.4): đọc các hội thoại đã im >= 30 phút, trích cặp hỏi–đáp dùng lại được, xóa thông tin cá nhân,
 * khử trùng với kho rồi:
 *  - MỌI cặp học được đều vào hàng chờ admin duyệt (candidate, source=learned) — kể cả khi khách 👍 (chủ dự án chốt 2026-10-14:
 *    bot không tự bật câu trả lời nào). Hội thoại có 👍 (không 👎) được gắn nhãn "khách 👍" để admin ưu tiên xem.
 * Ngoài ra câu khách hỏi mà bot trả bằng câu mẫu (qa_direct, không bị 👎) được thêm làm "cách hỏi khác" của câu mẫu đó.
 * Idempotent: đánh dấu learnedAt; nếu chết giữa chừng, lần sau khử trùng (>= 0.8) chặn tạo lại.
 */
export const LEARN_IDLE_MS = 30 * 60_000;
const DUPLICATE_SIMILARITY = 0.8;
const BATCH = 20;

/** Schema đầu ra của agent trích xuất (giữ tên cũ cho nơi khác import). */
export const learnedPairs = learnSchema;

export interface LearnStats {
  skipped?: 'unavailable';
  conversations: number;
  candidates: number;
  variants: number;
  duplicates: number;
  failed: number;
}

/** Đoạn chat dạng văn bản cho agent trích xuất: bỏ tin có PII và câu trả lời ngay sau nó, bỏ tin từ chối/lỗi/chuyển người. */
export function learnableTranscript(messages: ChatbotMessage[]): { text: string; agentAnswers: number } {
  const lines: string[] = [];
  let agentAnswers = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== 'user') continue;
    const reply = messages[i + 1];
    if (m.redacted || !reply || reply.role !== 'assistant') continue;
    if (reply.answerSource !== 'agent' && reply.answerSource !== 'qa_direct') continue;
    if (reply.answerSource === 'agent') agentAnswers++;
    const mark = reply.feedback === 1 ? ' [khách 👍]' : reply.feedback === -1 ? ' [khách 👎]' : '';
    lines.push(`Khách: ${m.content}`, `Bot: ${reply.content}${mark}`);
  }
  return { text: lines.join('\n'), agentAnswers };
}

export async function learnFromConversations(opts: { idleMs?: number; batch?: number } = {}): Promise<LearnStats> {
  const stats: LearnStats = { conversations: 0, candidates: 0, variants: 0, duplicates: 0, failed: 0 };
  const settings = chatbotSettings();
  if (!chatbotAvailable(settings)) return { ...stats, skipped: 'unavailable' };
  const pending = await conversationRepository.pendingLearning(opts.idleMs ?? LEARN_IDLE_MS, opts.batch ?? BATCH);
  if (!pending.length) return stats;

  const llm = chatLlm();

  for (const conv of pending) {
    try {
      const messages = await conversationRepository.allMessages(conv.id);
      // Cách hỏi khác cho câu mẫu đã trả trực tiếp (không bị chê).
      for (let i = 0; i + 1 < messages.length; i++) {
        const q = messages[i]!;
        const a = messages[i + 1]!;
        if (q.role === 'user' && !q.redacted && a.answerSource === 'qa_direct' && a.matchedQaId && a.feedback !== -1) {
          if (await chatbotRepository.addVariant(a.matchedQaId, q.content.slice(0, 500))) stats.variants++;
        }
      }
      const { text, agentAnswers } = learnableTranscript(messages);
      if (agentAnswers > 0) {
        const liked = messages.some((m) => m.feedback === 1) && !messages.some((m) => m.feedback === -1);
        const { output } = await llm.complete({ kind: 'learn', prompt: buildLearnPrompt(text), schema: learnSchema, hint: text, model: settings.model || undefined });
        for (const pair of output.pairs) {
          if (!pair.generalizable) continue;
          const question = redactPii(pair.question.trim()).text;
          const answer = redactPii(pair.answer.trim()).text;
          if (!question || !answer || looksLikeBankAccount(answer)) continue;
          const [dup] = await chatbotRepository.matchQa(question, { limit: 1, order: 'similarity', statuses: ['active', 'candidate', 'stale', 'rejected'], communityId: conv.communityId });
          if (dup && dup.similarity >= DUPLICATE_SIMILARITY) {
            stats.duplicates++;
            continue;
          }
          await chatbotRepository.createQa({
            question,
            answer,
            status: 'candidate',
            source: 'learned',
            confidence: pair.confidence,
            sourceConversationId: conv.id,
            // Hội thoại với bot cộng đồng => câu học được vào kho của cộng đồng đó, chờ chủ cộng đồng duyệt.
            communityId: conv.communityId,
            tags: liked ? ['học từ chat', 'khách 👍'] : ['học từ chat'],
          });
          stats.candidates++;
        }
      }
      await conversationRepository.markLearned(conv.id);
      stats.conversations++;
    } catch (e) {
      if (e instanceof LlmQuotaError) {
        console.error('[chatbot.learn] hết hạn mức ChatGPT — dừng lượt học, để lần sau');
        break;
      }
      stats.failed++;
      console.error(`[chatbot.learn] hội thoại ${conv.id} lỗi:`, e instanceof Error ? e.message : e);
    }
  }
  return stats;
}
