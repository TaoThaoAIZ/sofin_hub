import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { chatbotSettings } from '../chatbot/chatbot.config.js';
import { conversationRepository } from '../chatbot/chatbot.conversations.js';
import { checkOutput, type OutputViolation } from '../chatbot/chatbot.guardrails.js';
import { codexLoggedIn, LlmBusyError, LlmQuotaError } from '../chatbot/chatbot.llm.js';
import { chatLlm } from '../chatbot/chatbot.model.js';
import { isPersonaKey, PERSONA_PRESETS, PRESET_KEYS, resolvePersona } from '../chatbot/chatbot.persona.js';
import { moderate, moderationReply } from '../chatbot/chatbot.moderation.js';
import { containsPii } from '../chatbot/chatbot.pii.js';
import { answerSchema } from '../chatbot/chatbot.prompt.js';
import { chatbotRepository } from '../chatbot/chatbot.repository.js';
import { cleanSuggestions, lockConversation, messageView, type MessageView } from '../chatbot/chatbot.service.js';
import { messageService } from '../messages/messages.service.js';
import { notify } from '../notifications/notifications.service.js';
import { communityBotAccess, type BotAccess, type BotTier } from './community-bot.access.js';
import { communitySourcesOf, gatherCommunityContext, type CommunityContext } from './community-bot.context.js';
import { buildCommunityPrompt } from './community-bot.prompt.js';

/**
 * Bot riêng của cộng đồng (chatbot.md). Cùng khuôn luồng với bot "Tào" (chatbot.service.ts): khóa theo hội thoại, khớp câu mẫu trước,
 * Codex 1 lượt trả JSON, guardrail đầu ra, gợi ý trả lời nhanh, xử lý hết hạn mức — khác ở: kho/hội thoại có communityId, ngữ cảnh
 * cộng đồng theo quyền người hỏi, persona theo mức thành viên, giới hạn tin/ngày theo mức, chuyển câu hỏi cho CHỦ cộng đồng qua Tin nhắn.
 */

export type CommunityChatEvent =
  | { event: 'delta'; data: { text: string } }
  | { event: 'replace'; data: { text: string } }
  | { event: 'queued'; data: { ahead: number } }
  | { event: 'done'; data: CommunityDoneData };

export interface QuotaView {
  tier: BotTier;
  limit: number;
  used: number;
  remaining: number;
}

export interface CommunityDoneData {
  message: MessageView;
  conversation: { id: string; status: string };
  /** Bot đề nghị gửi câu hỏi cho chủ cộng đồng — widget hiện nút; chỉ gửi khi thành viên bấm (POST .../handoff). */
  handoffOffer: { reason: string } | null;
  suggestions: string[];
  quota: QuotaView;
}

const DAY_MS = 24 * 3600_000;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const texts = (a: BotAccess, name: string) => {
  const me = cap(a.persona.selfPronoun);
  const you = a.persona.userPronoun;
  return {
    refusal: `${me} chỉ hỗ trợ các câu hỏi về cộng đồng "${name}" thôi, ${you} cần hỏi gì về bài học, sự kiện hay nội quy không?`,
    error: `${me} đang gặp trục trặc một chút, ${you} thử lại sau ít phút hoặc gửi câu hỏi cho chủ cộng đồng nhé.`,
    busy: `Hiện nhiều người hỏi cùng lúc quá, ${you} thử lại sau ít giây nhé.`,
    quota: `${me} đang tạm quá tải, ${you} thử lại sau ít phút hoặc gửi câu hỏi cho chủ cộng đồng nhé.`,
    noInfo: `${me} chưa có thông tin chính xác về việc này, ${you} gửi câu hỏi cho chủ cộng đồng nhé.`,
    safe: {
      bank_account: `Thanh toán trên SofinHub chỉ qua mã VietQR ở trang thanh toán thôi, ${you} không chuyển theo số tài khoản nào khác nhé.`,
      unsourced_amount: `Phần giá này ${a.persona.selfPronoun} chưa có thông tin chính xác, ${you} xem ở trang Giới thiệu / Lớp học của cộng đồng hoặc gửi câu hỏi cho chủ cộng đồng nhé.`,
    } satisfies Record<OutputViolation, string>,
  };
};

/** Codex của bot (dùng chung tài khoản ChatGPT với Tào) có dùng được không — tắt bot Tào ở admin KHÔNG tắt bot cộng đồng. */
function assertLlmAvailable() {
  if (!(env.CHATBOT_FAKE_MODEL || codexLoggedIn())) throw HttpError.coded(503, 'BOT_UNAVAILABLE', 'Trợ lý AI đang tạm ngưng, bạn thử lại sau nhé');
}

async function quotaOf(userId: string, communityId: string, a: BotAccess): Promise<QuotaView> {
  const used = await conversationRepository.countUserMessagesSince(userId, new Date(Date.now() - DAY_MS), communityId);
  return { tier: a.tier, limit: a.limits.dailyMessages, used, remaining: Math.max(0, a.limits.dailyMessages - used) };
}

async function ownedConversation(id: string, userId: string, communityId: string) {
  const c = await conversationRepository.findOwned(id, userId, communityId);
  if (!c) throw HttpError.notFound('Không tìm thấy hội thoại');
  return c;
}

const convView = (c: { id: string; status: string }) => ({ id: c.id, status: c.status });

/** Lưu vết nguồn đã đưa vào ngữ cảnh (kiểm tra rò rỉ bài khóa) + nhân cách/mức; prompt nguyên văn chỉ khi CHATBOT_TRACE_CONTEXT. */
function contextTrace(a: BotAccess, c: CommunityContext, prompt: string): Prisma.InputJsonValue {
  const out: Record<string, unknown>[] = [
    { name: 'persona', key: a.personaKey, tier: a.tier },
    { name: 'sources', ...c.sources },
  ];
  if (env.CHATBOT_TRACE_CONTEXT) out.push({ name: '_trace', prompt });
  return out as Prisma.InputJsonValue;
}

async function answerTurn(a: BotAccess, userId: string, conv: { id: string; status: string }, text: string, emit: (e: CommunityChatEvent) => void): Promise<CommunityDoneData> {
  const s = chatbotSettings();
  const communityId = a.bot.communityId;
  const viewer = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true } });
  const community = await prisma.community.findUniqueOrThrow({ where: { id: communityId }, select: { title: true } });
  const t = texts(a, community.title);
  await conversationRepository.addMessage(conv.id, { role: 'user', content: text, redacted: containsPii(text) });

  const finish = async (
    content: string,
    answerSource: 'qa_direct' | 'agent' | 'refusal' | 'handoff' | 'error',
    extra: { matchedQaId?: string | null; toolCalls?: Prisma.InputJsonValue; usage?: { tokensIn: number; tokensOut: number }; handoffOffer?: { reason: string } | null; suggestions?: string[] } = {},
  ): Promise<CommunityDoneData> => {
    const msg = await conversationRepository.addMessage(
      conv.id,
      { role: 'assistant', content, answerSource, matchedQaId: extra.matchedQaId ?? null, ...(extra.toolCalls !== undefined ? { toolCalls: extra.toolCalls } : {}) },
      extra.usage,
    );
    const fresh = (await conversationRepository.findById(conv.id)) ?? conv;
    const done: CommunityDoneData = {
      message: messageView(msg),
      conversation: convView(fresh),
      handoffOffer: extra.handoffOffer ?? null,
      suggestions: extra.suggestions ?? [],
      quota: await quotaOf(userId, communityId, a),
    };
    emit({ event: 'done', data: done });
    return done;
  };

  // Nội dung bị cấm (chính sách ChatGPT): từ chối tại chỗ, KHÔNG gửi sang ChatGPT (chatbot.moderation.ts).
  const mod = moderate(text);
  if (mod.blocked && mod.category) {
    const reply = mod.category === 'jailbreak' ? t.refusal : moderationReply(mod.category, a.persona.selfPronoun, a.persona.userPronoun);
    emit({ event: 'delta', data: { text: reply } });
    return finish(reply, 'refusal', { toolCalls: [{ name: 'moderation', category: mod.category }] });
  }

  // Khớp trực tiếp câu mẫu của CỘNG ĐỒNG NÀY (không gọi AI).
  const [top] = await chatbotRepository.matchQa(text, { limit: 1, order: 'similarity', communityId });
  if (top && top.similarity >= s.directThreshold) {
    void chatbotRepository.recordHit(top.id);
    emit({ event: 'delta', data: { text: top.answer } });
    return finish(top.answer, 'qa_direct', { matchedQaId: top.id, toolCalls: [{ name: 'qa_direct', ids: [top.id] }, { name: 'persona', key: a.personaKey, tier: a.tier }] });
  }

  const history = (await conversationRepository.recentMessages(conv.id, a.limits.historyTurns + 1)).slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  try {
    const context = await gatherCommunityContext(a, { userId, communityId, text, recentUserTexts: history.filter((m) => m.role === 'user').map((m) => m.content) });
    const prompt = buildCommunityPrompt(a, { firstName: viewer.firstName, history, message: text, context });
    const { output, usage } = await chatLlm().complete({ kind: 'answer', prompt, schema: answerSchema, hint: { message: text, community: context }, model: s.model || undefined, onQueued: (ahead) => emit({ event: 'queued', data: { ahead } }) });
    const toolCalls = contextTrace(a, context, prompt);
    const matchedQaId = context.sampleAnswers.some((q) => q.id === output.usedSampleId) ? output.usedSampleId : null;

    if (!output.onTopic || output.injection) {
      emit({ event: 'delta', data: { text: t.refusal } });
      return finish(t.refusal, 'refusal', { usage, toolCalls });
    }
    let reply = output.reply.trim() || t.noInfo;
    const sources = communitySourcesOf(context, text);
    const violation = checkOutput(reply, sources);
    if (violation) reply = t.safe[violation];
    const handoffOffer = output.handoff && !violation ? { reason: (output.handoffReason || text).slice(0, 300) } : null;
    const suggestions = handoffOffer || violation ? [] : cleanSuggestions(output.suggestions, sources);
    emit({ event: 'delta', data: { text: reply } });
    return finish(reply, 'agent', { matchedQaId, toolCalls, usage, handoffOffer, suggestions });
  } catch (e) {
    console.error('[community-bot] gọi Codex lỗi:', e instanceof Error ? e.message : e);
    const msg = e instanceof LlmQuotaError ? t.quota : e instanceof LlmBusyError ? t.busy : t.error;
    emit({ event: 'delta', data: { text: msg } });
    return finish(msg, 'error');
  }
}

/** Nhân cách mẫu + 'custom' (nếu chủ đã tạo) dạng hiển thị. */
function personaOptions(a: BotAccess | { bot: BotAccess['bot'] }, keys: string[]) {
  return keys
    .filter(isPersonaKey)
    .filter((k) => k !== 'custom' || a.bot.customPersona)
    .map((k) => ({ key: k, label: resolvePersona(k, a.bot.customPersona).label }));
}

export const communityBotService = {
  /** Trạng thái widget: có dùng được không (lý do nếu không), mức thành viên, nhân cách, số tin còn lại hôm nay. */
  async status(userId: string, communityId: string) {
    let a: BotAccess;
    try {
      a = await communityBotAccess(userId, communityId);
      assertLlmAvailable();
    } catch (e) {
      if (e instanceof HttpError && e.status !== 404) return { available: false as const, reason: e.code };
      throw e;
    }
    const community = await prisma.community.findUniqueOrThrow({ where: { id: communityId }, select: { pricing: true, priceCents: true } });
    return {
      available: true as const,
      botName: a.bot.botName,
      welcomeText: a.bot.welcomeText,
      tier: a.tier,
      persona: { key: a.personaKey, label: a.persona.label },
      defaultPersonaKey: a.bot.personaKey,
      /** Nhân cách VIP được chọn (thành viên thường vẫn thấy danh sách để biết sẽ mở khóa gì). */
      personas: personaOptions(a, [...new Set([a.bot.personaKey, ...a.bot.memberPersonaKeys])]),
      canChoosePersona: a.tier === 'vip' && a.bot.memberPersonaKeys.length > 0,
      /** Cộng đồng có gói trả phí => thành viên thường nâng cấp VIP được (widget hiện dải nâng cấp). */
      upgradeAvailable: a.tier === 'free' && community.pricing !== 'free' && community.priceCents > 0,
      quota: await quotaOf(userId, communityId, a),
      maxInputChars: chatbotSettings().maxInputChars,
    };
  },

  async startConversation(userId: string, communityId: string) {
    await communityBotAccess(userId, communityId);
    assertLlmAvailable();
    const c = await conversationRepository.create(userId, communityId);
    return { conversation: convView(c), messages: [] as MessageView[] };
  },

  async current(userId: string, communityId: string) {
    await communityBotAccess(userId, communityId);
    const c = await conversationRepository.current(userId, communityId);
    if (!c) return null;
    const messages = await conversationRepository.recentMessages(c.id, 100);
    return { conversation: convView(c), messages: messages.map(messageView) };
  },

  async sendMessage(userId: string, communityId: string, conversationId: string, rawText: string, emit: (e: CommunityChatEvent) => void): Promise<CommunityDoneData> {
    const a = await communityBotAccess(userId, communityId);
    assertLlmAvailable();
    const s = chatbotSettings();
    const text = rawText.trim();
    if (!text) throw HttpError.badRequest('Vui lòng nhập nội dung');
    if (text.length > s.maxInputChars) throw HttpError.badRequest(`Tin nhắn tối đa ${s.maxInputChars} ký tự`);
    const conv = await ownedConversation(conversationId, userId, communityId);
    if (conv.status === 'closed') throw HttpError.conflict('Hội thoại đã đóng, vui lòng bắt đầu hội thoại mới');
    const quota = await quotaOf(userId, communityId, a);
    if (quota.remaining <= 0) {
      throw HttpError.coded(
        429,
        'DAILY_LIMIT',
        // Giới hạn do CHỦ CỘNG ĐỒNG đặt (không phải ChatGPT hết hạn mức) — nói rõ số lượt + giờ mở lại.
        a.tier === 'free'
          ? `Bạn đã dùng hết ${quota.limit} lượt hỏi trợ lý hôm nay (giới hạn của cộng đồng cho thành viên thường). Lượt mới mở lúc 0:00, hoặc nâng cấp VIP để hỏi nhiều hơn nhé`
          : `Bạn đã dùng hết ${quota.limit} lượt hỏi trợ lý hôm nay (giới hạn của cộng đồng). Lượt mới mở lúc 0:00 nhé`,
        { tier: a.tier, limit: quota.limit },
      );
    }
    const release = await lockConversation(conv.id);
    try {
      return await answerTurn(a, userId, conv, text, emit);
    } finally {
      await release();
    }
  },

  async feedback(userId: string, communityId: string, messageId: string, value: -1 | 0 | 1) {
    const msg = await prisma.chatbotMessage.findFirst({ where: { id: messageId, role: 'assistant', conversation: { userId, communityId } }, select: { id: true } });
    if (!msg) throw HttpError.notFound('Không tìm thấy tin nhắn');
    const m = await conversationRepository.setFeedback(msg.id, userId, value);
    return messageView(m!);
  },

  /** Thành viên VIP chọn nhân cách riêng (trong danh sách chủ cho phép); personaKey = null/mặc định => về nhân cách mặc định. */
  async setMyPersona(userId: string, communityId: string, personaKey: string | null) {
    const a = await communityBotAccess(userId, communityId);
    if (a.tier !== 'vip') throw HttpError.coded(402, 'VIP_REQUIRED', 'Nâng cấp VIP (thành viên trả phí) để chọn nhân cách cho trợ lý');
    if (!personaKey || personaKey === a.bot.personaKey) {
      await prisma.communityBotMemberPref.deleteMany({ where: { communityId, userId } });
    } else {
      if (!a.bot.memberPersonaKeys.includes(personaKey) || !isPersonaKey(personaKey) || (personaKey === 'custom' && !a.bot.customPersona)) {
        throw HttpError.badRequest('Nhân cách này không có trong danh sách chủ cộng đồng cho phép');
      }
      await prisma.communityBotMemberPref.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, userId, personaKey },
        update: { personaKey },
      });
    }
    return this.status(userId, communityId);
  },

  /**
   * Thành viên bấm "Gửi câu hỏi cho chủ cộng đồng": mở Tin nhắn riêng với chủ và gửi tóm tắt (tên thành viên gửi — có sự đồng ý vì
   * chính họ bấm). Chủ tắt nhận tin riêng / chặn => gửi thông báo hệ thống cho chủ thay thế.
   */
  async handoff(userId: string, communityId: string, conversationId: string) {
    await communityBotAccess(userId, communityId);
    const conv = await ownedConversation(conversationId, userId, communityId);
    const community = await prisma.community.findUniqueOrThrow({ where: { id: communityId }, select: { title: true, ownerId: true } });
    if (!community.ownerId) throw HttpError.conflict('Cộng đồng chưa có chủ để nhận câu hỏi');
    if (community.ownerId === userId) throw HttpError.badRequest('Bạn là chủ cộng đồng này');
    const asks = (await conversationRepository.recentMessages(conv.id, 12)).filter((m) => m.role === 'user' && !m.redacted).slice(-3);
    if (!asks.length) throw HttpError.badRequest('Hãy hỏi trợ lý trước khi gửi câu hỏi cho chủ cộng đồng');
    const content = [`[Hỏi qua trợ lý AI của cộng đồng "${community.title}"]`, ...asks.map((m) => `- ${m.content.slice(0, 500)}`)].join('\n');
    let via: 'message' | 'notification' = 'message';
    let messageConversationId: string | null = null;
    try {
      const dm = await messageService.openConversation(userId, community.ownerId);
      await messageService.send(userId, dm.data.id, content);
      messageConversationId = dm.data.id;
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      via = 'notification';
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true } });
      notify({
        userId: community.ownerId,
        type: 'system',
        title: `${`${user.firstName} ${user.lastName}`.trim()} gửi câu hỏi qua trợ lý AI`,
        body: content.slice(0, 900),
        link: `/communities/${communityId}/community/cai-dat?tab=chatbot`,
        communityId,
      });
    }
    await conversationRepository.setStatus(conv.id, { status: 'handed_off' });
    return { via, messageConversationId };
  },

  /** Danh sách nhân cách mẫu (thẻ chọn ở trang cài đặt + xem trước câu ví dụ). */
  presets() {
    return PRESET_KEYS.map((key) => ({ key, ...PERSONA_PRESETS[key] }));
  },
};
