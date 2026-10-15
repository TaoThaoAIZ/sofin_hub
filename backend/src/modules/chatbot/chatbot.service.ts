import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { shared } from '../../infra/shared.js';
import type { ChatbotMessage, Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { TOOLS } from '../tools/tools.catalog.js';
import { chatbotAvailable, chatbotSettings, type ChatbotSettings } from './chatbot.config.js';
import { conversationRepository } from './chatbot.conversations.js';
import { checkOutput, type OutputViolation } from './chatbot.guardrails.js';
import { moderate, moderationReply } from './chatbot.moderation.js';
import { containsPii } from './chatbot.pii.js';
import { chatbotRepository } from './chatbot.repository.js';
import { env } from '../../config/env.js';
import { gatherContext, handoffToZalo, sourcesOf, type ChatContext, type HandoffResult, type KnowledgeContext } from './chatbot.context.js';
import { LlmBusyError, LlmQuotaError } from './chatbot.llm.js';
import { chatLlm } from './chatbot.model.js';
import { answerSchema, buildAnswerPrompt } from './chatbot.prompt.js';

/**
 * Luồng 1 tin nhắn (chatbot.md mục 2):
 *  B1 lọc sơ bộ (độ dài, hạn mức ngày) → B2 khớp câu hỏi mẫu (>= directThreshold: trả nguyên câu admin, không gọi AI)
 *  → B3 gom ngữ cảnh (câu mẫu, tài liệu, tool, cộng đồng, thanh toán của chính khách, số liệu nền tảng) rồi gọi Codex 1 lượt trả JSON
 *  (reply + phân loại lạc đề/injection + có cần chuyển người) → kiểm tra đầu ra (regex) → B4 lưu.
 * Codex không stream được JSON có ích nên câu trả lời gửi 1 lần (delta) khi xong.
 * `emit` nhận sự kiện stream: delta (mẩu chữ), replace (thay toàn bộ chữ đã gửi), done (tin đã lưu).
 */
export type ChatEvent =
  | { event: 'delta'; data: { text: string } }
  | { event: 'replace'; data: { text: string } }
  /** Đang xếp hàng chờ lượt gọi AI (nhiều người hỏi cùng lúc): ahead = số lượt đứng trước. */
  | { event: 'queued'; data: { ahead: number } }
  | { event: 'done'; data: DoneData };

export interface DoneData {
  message: MessageView;
  conversation: { id: string; status: string; ticketCode: string | null };
  handoff: HandoffResult | null;
  tools: ToolCard[];
  /** Lựa chọn trả lời nhanh khi bot hỏi lại khách (widget hiện thành nút; bấm = gửi đúng chữ đó). */
  suggestions: string[];
}

export interface ToolCard {
  id: string;
  name: string;
  free: boolean;
  downloadUrl: string | null;
}

export const messageView = (m: ChatbotMessage) => ({
  id: m.id,
  role: m.role,
  content: m.content,
  answerSource: m.answerSource,
  feedback: m.feedback,
  createdAt: m.createdAt.toISOString(),
});
export type MessageView = ReturnType<typeof messageView>;

const SAFE_TEXT: Record<OutputViolation, string> = {
  bank_account: 'dạ thanh toán trên SofinHub chỉ qua mã VietQR ở trang thanh toán thôi ạ, bạn không chuyển theo số tài khoản nào khác nha',
  unsourced_amount: 'dạ phần giá này Tào chưa có thông tin chính xác ạ, bạn bấm "Mua ngay" ở trang /tools hoặc nhắn Zalo hỗ trợ để được báo giá nha',
};
const ERROR_TEXT = 'dạ Tào đang gặp trục trặc một chút, bạn thử lại sau ít phút hoặc nhắn Zalo hỗ trợ nha';
const BUSY_TEXT = 'dạ hiện nhiều bạn hỏi cùng lúc quá, bạn thử lại sau ít giây hoặc nhắn Zalo hỗ trợ nha';
const QUOTA_TEXT = 'dạ hiện Tào đang tạm quá tải, bạn thử lại sau ít phút hoặc bấm "Nhắn Zalo hỗ trợ" để gặp người hỗ trợ ngay nha';

/** Gợi ý trả lời nhanh từ model: gọn, không trùng, tối đa 4; bỏ mục vi phạm guardrail (số tài khoản, số tiền không nguồn...). */
export function cleanSuggestions(items: string[], sources: string[]): string[] {
  const out: string[] = [];
  for (const raw of items) {
    const v = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!v || checkOutput(v, sources) || out.some((o) => o.toLowerCase() === v.toLowerCase())) continue;
    out.push(v);
  }
  return out.slice(0, 4);
}

const toolCards = (ids: string[]): ToolCard[] =>
  [...new Set(ids)]
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is (typeof TOOLS)[number] => Boolean(t))
    .slice(0, 4)
    .map((t) => ({ id: t.id, name: t.name, free: t.free, downloadUrl: t.free ? (t.downloadUrl ?? null) : null }));

/**
 * Dấu vết ngữ cảnh lưu vào ChatbotMessage.toolCalls (admin xem, bộ regression kiểm tra): mỗi phần ngữ cảnh kèm ID nguồn
 * (câu mẫu, đoạn tài liệu + tài liệu) để chứng minh chỉ nguồn active được dùng. CHATBOT_TRACE_CONTEXT=1 (chỉ dev/test, production
 * bị chặn) lưu thêm nguyên văn prompt gửi model (`_trace`) để dò canary trong ngữ cảnh.
 */
function contextTrace(context: KnowledgeContext, toolIds: string[], prompt: string): Prisma.InputJsonValue {
  const out: Record<string, unknown>[] = [];
  if (context.sampleAnswers.length) out.push({ name: 'sample_answers', ids: context.sources.qaIds });
  if (context.documents.length) out.push({ name: 'documents', chunks: context.sources.chunks });
  if (toolIds.length) out.push({ name: 'tools', ids: toolIds });
  if (context.communities.length) out.push({ name: 'communities', links: context.communities.map((c) => c.link) });
  if (context.categories.length) out.push({ name: 'categories', names: context.categories.map((c) => c.name) });
  if (context.myPayments !== null) out.push({ name: 'my_payments', count: context.myPayments.length });
  out.push({ name: 'platform_facts' });
  if (env.CHATBOT_TRACE_CONTEXT) out.push({ name: '_trace', prompt });
  return out as Prisma.InputJsonValue;
}

function assertAvailable() {
  if (!chatbotAvailable()) throw new HttpError(503, 'CHATBOT_UNAVAILABLE', 'Trợ lý hỗ trợ đang tạm tắt, bạn vui lòng nhắn Zalo hoặc gửi biểu mẫu Liên hệ');
}

async function viewerOf(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
  if (!u) throw HttpError.unauthorized();
  return u;
}

async function ownedConversation(id: string, userId: string) {
  const c = await conversationRepository.findOwned(id, userId);
  if (!c) throw HttpError.notFound('Không tìm thấy hội thoại');
  return c;
}

const convView = (c: { id: string; status: string; ticketCode: string | null }) => ({ id: c.id, status: c.status, ticketCode: c.ticketCode });

/** Thời gian giữ khóa tối đa (phòng tiến trình chết giữa chừng): lâu hơn timeout gọi Codex. */
const LOCK_TTL_MS = env.CHATBOT_TIMEOUT_MS + 30_000;

/**
 * Khóa 1 lượt trả lời cho mỗi hội thoại (Redis khi có REDIS_URL => đúng cả khi chạy nhiều instance; không có thì trong bộ nhớ).
 * Đang có lượt khác => 409 CHATBOT_BUSY (widget không gửi song song — nó gộp tin nhắn liên tiếp vào 1 lượt; lỗi này chỉ gặp khi 2 tab/gọi API trực tiếp).
 */
export async function lockConversation(conversationId: string): Promise<() => Promise<void>> {
  const key = `chatbot:busy:${conversationId}`;
  const token = randomUUID();
  if (!(await shared().kv.setNx(key, token, LOCK_TTL_MS))) {
    throw new HttpError(409, 'CHATBOT_BUSY', 'Tào đang trả lời tin trước, bạn đợi chút rồi gửi tiếp nha');
  }
  return async () => {
    if ((await shared().kv.get(key)) === token) await shared().kv.del(key);
  };
}

type OwnedConversation = Awaited<ReturnType<typeof ownedConversation>>;

/** B2-B4 của một lượt (đã qua kiểm tra + đang giữ khóa hội thoại). */
async function answerTurn(userId: string, conv: OwnedConversation, text: string, s: ChatbotSettings, emit: (e: ChatEvent) => void, pageCommunityId?: string): Promise<DoneData> {
  const viewer = await viewerOf(userId);
  await conversationRepository.addMessage(conv.id, { role: 'user', content: text, redacted: containsPii(text) });

  const finish = async (
    content: string,
    answerSource: 'qa_direct' | 'agent' | 'refusal' | 'handoff' | 'error',
    extra: { matchedQaId?: string | null; toolCalls?: Prisma.InputJsonValue; usage?: { tokensIn: number; tokensOut: number }; handoff?: HandoffResult | null; tools?: ToolCard[]; suggestions?: string[] } = {},
  ): Promise<DoneData> => {
    const msg = await conversationRepository.addMessage(
      conv.id,
      { role: 'assistant', content, answerSource, matchedQaId: extra.matchedQaId ?? null, ...(extra.toolCalls !== undefined ? { toolCalls: extra.toolCalls } : {}) },
      extra.usage,
    );
    const fresh = (await conversationRepository.findById(conv.id)) ?? conv;
    const done: DoneData = { message: messageView(msg), conversation: convView(fresh), handoff: extra.handoff ?? null, tools: extra.tools ?? [], suggestions: extra.suggestions ?? [] };
    emit({ event: 'done', data: done });
    return done;
  };

  // Nội dung bị cấm (chính sách ChatGPT): từ chối tại chỗ, KHÔNG gửi sang ChatGPT (chatbot.moderation.ts).
  const mod = moderate(text);
  if (mod.blocked && mod.category) {
    // Jailbreak => câu từ chối chuẩn của bot (giống luật injection); loại khác => câu riêng (tự hại: hướng tới trợ giúp).
    const reply = mod.category === 'jailbreak' ? s.refusalText : moderationReply(mod.category, 'Tào', 'bạn');
    emit({ event: 'delta', data: { text: reply } });
    return finish(reply, 'refusal', { toolCalls: [{ name: 'moderation', category: mod.category }] });
  }

  // B2: khớp trực tiếp câu hỏi mẫu.
  const [top] = await chatbotRepository.matchQa(text, { limit: 1, order: 'similarity' });
  if (top && top.similarity >= s.directThreshold) {
    void chatbotRepository.recordHit(top.id);
    emit({ event: 'delta', data: { text: top.answer } });
    return finish(top.answer, 'qa_direct', { matchedQaId: top.id, toolCalls: [{ name: 'qa_direct', ids: [top.id] }] });
  }

  // B3: gom ngữ cảnh + gọi Codex (1 lượt, JSON).
  const history = (await conversationRepository.recentMessages(conv.id, s.maxHistory + 1)).slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  const ctx: ChatContext = { userId, conversationId: conv.id, viewer, ...(pageCommunityId ? { pageCommunityId } : {}) };
  try {
    const context = await gatherContext(ctx, text, history.filter((m) => m.role === 'user').map((m) => m.content));
    const prompt = buildAnswerPrompt(s, { firstName: viewer.firstName, history, message: text, context });
    const { output, usage } = await chatLlm().complete({ kind: 'answer', prompt, schema: answerSchema, hint: { message: text, context }, model: s.model || undefined, onQueued: (ahead) => emit({ event: 'queued', data: { ahead } }) });
    const toolCalls = contextTrace(context, output.toolIds, prompt);
    const matchedQaId = context.sampleAnswers.some((q) => q.id === output.usedSampleId) ? output.usedSampleId : null;

    if (!output.onTopic || output.injection) {
      emit({ event: 'delta', data: { text: s.refusalText } });
      return finish(s.refusalText, 'refusal', { usage, toolCalls });
    }
    let reply = output.reply.trim();
    const sources = sourcesOf(context, text);
    const violation = checkOutput(reply, sources);
    if (violation) reply = SAFE_TEXT[violation];
    let handoff: HandoffResult | null = null;
    if (output.handoff) {
      handoff = await handoffToZalo(ctx, { reason: output.handoffReason || text, category: output.handoffCategory });
      // Câu trả lời đã mời nhắn Zalo => không nối thêm (mã hỗ trợ hiện ở dải dưới khung chat); chưa có => nối câu hướng dẫn kèm mã.
      reply = !reply ? handoff.message : /zalo/i.test(reply) ? reply : `${reply}\n${handoff.message}`;
    }
    if (!reply) reply = 'dạ Tào chưa có thông tin chính xác ạ, bạn nhắn Zalo hỗ trợ để được giúp nha';
    emit({ event: 'delta', data: { text: reply } });
    // Gợi ý chỉ đi kèm câu hỏi lại bình thường: không kèm khi đã chuyển người hoặc câu trả lời bị guardrail thay.
    const suggestions = handoff || violation ? [] : cleanSuggestions(output.suggestions, sources);
    return finish(reply, handoff ? 'handoff' : 'agent', { matchedQaId, toolCalls, usage, handoff, tools: toolCards(output.toolIds), suggestions });
  } catch (e) {
    console.error('[chatbot] gọi Codex lỗi:', e instanceof Error ? e.message : e);
    const text2 = e instanceof LlmQuotaError ? QUOTA_TEXT : e instanceof LlmBusyError ? BUSY_TEXT : ERROR_TEXT;
    emit({ event: 'delta', data: { text: text2 } });
    return finish(text2, 'error');
  }
}

export const chatbotService = {
  /** Trạng thái widget: có bật không + link Zalo (để hiện nút ngay cả khi chưa chat). */
  status() {
    const s = chatbotSettings();
    return { available: chatbotAvailable(s), zaloSupportUrl: s.zaloSupportUrl || null, maxInputChars: s.maxInputChars };
  },

  async startConversation(userId: string) {
    assertAvailable();
    const c = await conversationRepository.create(userId);
    return { conversation: convView(c), messages: [] as MessageView[] };
  },

  /** Hội thoại đang dở (null nếu chưa có / đã quá 24h). */
  async current(userId: string) {
    const c = await conversationRepository.current(userId);
    if (!c) return null;
    const messages = await conversationRepository.recentMessages(c.id, 100);
    return { conversation: convView(c), messages: messages.map(messageView) };
  },

  async sendMessage(userId: string, conversationId: string, rawText: string, emit: (e: ChatEvent) => void, opts: { pageCommunityId?: string } = {}): Promise<DoneData> {
    assertAvailable();
    const s = chatbotSettings();
    const text = rawText.trim();
    if (!text) throw HttpError.badRequest('Vui lòng nhập nội dung');
    if (text.length > s.maxInputChars) throw HttpError.badRequest(`Tin nhắn tối đa ${s.maxInputChars} ký tự`);
    const conv = await ownedConversation(conversationId, userId);
    if (conv.status === 'closed') throw HttpError.conflict('Hội thoại đã đóng, vui lòng bắt đầu hội thoại mới');
    if (s.dailyMessagesPerUser > 0) {
      const since = new Date(Date.now() - 24 * 3600_000);
      if ((await conversationRepository.countUserMessagesSince(userId, since)) >= s.dailyMessagesPerUser) {
        throw HttpError.tooMany('Bạn đã hỏi rất nhiều hôm nay, vui lòng thử lại sau hoặc nhắn Zalo hỗ trợ');
      }
    }
    // Khóa theo hội thoại: khách bấm gửi liên tục / mở 2 tab => không gọi AI song song trên cùng hội thoại (lịch sử lẫn, trả lời lộn thứ tự).
    const release = await lockConversation(conv.id);
    try {
      return await answerTurn(userId, conv, text, s, emit, opts.pageCommunityId);
    } finally {
      await release();
    }
  },

  /** Khách tự bấm "Gặp người hỗ trợ": tạo mã + ghi tin của bot kèm hướng dẫn nhắn Zalo. */
  async handoff(userId: string, conversationId: string) {
    const conv = await ownedConversation(conversationId, userId);
    const viewer = await viewerOf(userId);
    const ctx: ChatContext = { userId, conversationId: conv.id, viewer };
    const already = Boolean(conv.ticketId);
    const r = await handoffToZalo(ctx, { reason: 'Khách bấm "Gặp người hỗ trợ" trong khung chat', category: 'user' });
    const msg = already ? null : await conversationRepository.addMessage(conv.id, { role: 'assistant', content: r.message, answerSource: 'handoff' });
    const fresh = (await conversationRepository.findById(conv.id)) ?? conv;
    return { handoff: r, conversation: convView(fresh), message: msg ? messageView(msg) : null };
  },

  async feedback(userId: string, messageId: string, value: -1 | 0 | 1) {
    const m = await conversationRepository.setFeedback(messageId, userId, value);
    if (!m) throw HttpError.notFound('Không tìm thấy tin nhắn');
    return messageView(m);
  },
};
