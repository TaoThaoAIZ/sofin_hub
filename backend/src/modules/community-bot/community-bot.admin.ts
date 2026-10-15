import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { ChatbotQA, Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { conversationRepository } from '../chatbot/chatbot.conversations.js';
import { isPersonaKey, PERSONA_KEYS, PERSONA_PRESETS, PRESET_KEYS, personaSchema } from '../chatbot/chatbot.persona.js';
import { chatbotRepository } from '../chatbot/chatbot.repository.js';
import { messageView } from '../chatbot/chatbot.service.js';
import { isCommunityOwner, requireRole } from '../permissions/policy.js';
import { communityIsPro } from './community-bot.access.js';

/**
 * Quản lý bot của cộng đồng (tab "Trợ lý AI" trong Cài đặt cộng đồng — chatbot.md mục 4.8). Admin trở lên xem/sửa nội dung;
 * BẬT bot chỉ chủ cộng đồng (hoặc Platform Admin) và chỉ khi cộng đồng ở gói Pro. Mọi truy vấn khóa theo communityId.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const QA_STATUSES = ['active', 'candidate', 'rejected', 'archived', 'stale'] as const;

export const patchSettingsBody = z
  .object({
    enabled: z.boolean(),
    botName: text(40),
    welcomeText: z.string().trim().max(300),
    personaKey: z.enum(PERSONA_KEYS),
    customPersona: personaSchema.nullable(),
    memberPersonaKeys: z.array(z.enum(PERSONA_KEYS)).max(PERSONA_KEYS.length),
    extraInstructions: z.string().trim().max(2000),
    freeDailyMessages: z.number().int().min(0).max(1000),
    vipDailyMessages: z.number().int().min(1).max(5000),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });

export const qaQuery = z.object({
  status: z.enum(QA_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const qaBody = z.object({
  question: text(1000),
  answer: text(4000),
  variants: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
});
export const patchQaBody = z
  .object({ question: text(1000), answer: text(4000), variants: z.array(z.string().trim().min(1).max(500)).max(30), status: z.enum(['active', 'archived', 'rejected']) })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const documentBody = z.object({ title: text(200), contentMd: text(50_000) });
export const patchDocumentBody = z
  .object({ title: text(200), contentMd: text(50_000), status: z.enum(['active', 'archived']) })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const conversationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const pageMeta = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const qaView = (q: ChatbotQA) => ({
  id: q.id,
  question: q.question,
  variants: q.variants,
  answer: q.answer,
  status: q.status,
  source: q.source,
  confidence: q.confidence,
  hitCount: q.hitCount,
  sourceConversationId: q.sourceConversationId,
  createdAt: q.createdAt.toISOString(),
  updatedAt: q.updatedAt.toISOString(),
});

const DEFAULTS = {
  enabled: false,
  botName: 'Trợ lý',
  welcomeText: '',
  personaKey: 'mentor',
  customPersona: null,
  memberPersonaKeys: [] as string[],
  extraInstructions: '',
  freeDailyMessages: 10,
  vipDailyMessages: 100,
};

async function qaOrThrow(communityId: string, id: string) {
  const q = await chatbotRepository.getQa(id, communityId);
  if (!q) throw HttpError.notFound('Không tìm thấy câu hỏi mẫu');
  return q;
}

export const communityBotAdminService = {
  async getSettings(userId: string, communityId: string) {
    const role = await requireRole(userId, communityId, 'admin');
    const since = new Date(Date.now() - 7 * 24 * 3600_000);
    const [bot, isPro, qa, documents, conversations7d, handoffs7d] = await Promise.all([
      prisma.communityBot.findUnique({ where: { communityId } }),
      communityIsPro(communityId),
      chatbotRepository.countQaByStatus(communityId),
      prisma.chatbotDocument.count({ where: { communityId, status: 'active' } }),
      prisma.chatbotConversation.count({ where: { communityId, createdAt: { gte: since } } }),
      prisma.chatbotConversation.count({ where: { communityId, createdAt: { gte: since }, status: 'handed_off' } }),
    ]);
    const settings = bot
      ? {
          enabled: bot.enabled,
          botName: bot.botName,
          welcomeText: bot.welcomeText,
          personaKey: bot.personaKey,
          customPersona: bot.customPersona,
          memberPersonaKeys: bot.memberPersonaKeys,
          extraInstructions: bot.extraInstructions,
          freeDailyMessages: bot.freeDailyMessages,
          vipDailyMessages: bot.vipDailyMessages,
        }
      : DEFAULTS;
    return {
      settings,
      isPro,
      /** Bật/tắt bot: chỉ chủ cộng đồng (hoặc Platform Admin). */
      canToggle: role === 'platform_admin' || role === 'owner',
      presets: PRESET_KEYS.map((key) => ({ key, ...PERSONA_PRESETS[key] })),
      stats: { qa: Object.fromEntries(qa.map((r) => [r.status, r._count._all])), documents, conversations7d, handoffs7d },
    };
  },

  async updateSettings(userId: string, communityId: string, b: z.infer<typeof patchSettingsBody>) {
    const role = await requireRole(userId, communityId, 'admin');
    if (b.enabled !== undefined) {
      if (role !== 'platform_admin' && !(await isCommunityOwner(userId, communityId))) throw HttpError.forbidden('Chỉ chủ cộng đồng bật/tắt được trợ lý AI');
      if (b.enabled && !(await communityIsPro(communityId))) throw HttpError.coded(403, 'COMMUNITY_NOT_PRO', 'Trợ lý AI chỉ bật được khi cộng đồng ở gói Chuyên nghiệp');
    }
    const cur = await prisma.communityBot.findUnique({ where: { communityId } });
    const custom = b.customPersona !== undefined ? b.customPersona : (cur?.customPersona ?? null);
    const personaKey = b.personaKey ?? cur?.personaKey ?? DEFAULTS.personaKey;
    const memberKeys = b.memberPersonaKeys ?? cur?.memberPersonaKeys ?? [];
    if ((personaKey === 'custom' || memberKeys.includes('custom')) && !custom) throw HttpError.badRequest('Chưa có nhân cách tự tạo — điền form nhân cách trước khi chọn "Tự tạo"');
    if (!isPersonaKey(personaKey)) throw HttpError.badRequest('Nhân cách không hợp lệ');
    const data = {
      ...b,
      ...(b.customPersona !== undefined ? { customPersona: (b.customPersona ?? undefined) as Prisma.InputJsonValue | undefined } : {}),
      ...(b.memberPersonaKeys ? { memberPersonaKeys: [...new Set(b.memberPersonaKeys)] } : {}),
      updatedById: userId,
    };
    if (b.customPersona === null) Object.assign(data, { customPersona: null });
    await prisma.communityBot.upsert({
      where: { communityId },
      create: { ...(data as Omit<Prisma.CommunityBotUncheckedCreateInput, 'communityId'>), communityId },
      update: data as Prisma.CommunityBotUncheckedUpdateInput,
    });
    return this.getSettings(userId, communityId);
  },

  // ---------------------------------------------------------------- Q&A riêng của cộng đồng
  async listQa(userId: string, communityId: string, f: z.infer<typeof qaQuery>) {
    await requireRole(userId, communityId, 'admin');
    const { rows, total } = await chatbotRepository.listQa({ ...f, communityId, skip: (f.page - 1) * f.limit, take: f.limit });
    return { data: rows.map(qaView), meta: pageMeta(f.page, f.limit, total) };
  },

  async createQa(userId: string, communityId: string, b: z.infer<typeof qaBody>) {
    await requireRole(userId, communityId, 'admin');
    const q = await chatbotRepository.createQa({ ...b, communityId, status: 'active', source: 'admin', createdById: userId, reviewedById: userId, reviewedAt: new Date() });
    return qaView(q);
  },

  /** Sửa / duyệt (status=active) / từ chối câu mẫu — kể cả câu bot học được (candidate) đang chờ chủ cộng đồng duyệt. */
  async updateQa(userId: string, communityId: string, id: string, b: z.infer<typeof patchQaBody>) {
    await requireRole(userId, communityId, 'admin');
    await qaOrThrow(communityId, id);
    const reviewed = b.status === 'active' || b.status === 'rejected' ? { reviewedById: userId, reviewedAt: new Date() } : {};
    return qaView(await chatbotRepository.updateQa(id, { ...b, ...reviewed }));
  },

  async deleteQa(userId: string, communityId: string, id: string) {
    await requireRole(userId, communityId, 'admin');
    await qaOrThrow(communityId, id);
    await prisma.chatbotQA.delete({ where: { id } });
  },

  // ---------------------------------------------------------------- tài liệu (markdown, cắt theo mục ##)
  async listDocuments(userId: string, communityId: string) {
    await requireRole(userId, communityId, 'admin');
    return (await chatbotRepository.listDocuments(communityId)).map((d) => ({ id: d.id, title: d.title, status: d.status, chunks: d._count.chunks, updatedAt: d.updatedAt.toISOString() }));
  },

  async getDocument(userId: string, communityId: string, id: string) {
    await requireRole(userId, communityId, 'admin');
    const d = await chatbotRepository.getDocument(id, communityId);
    if (!d) throw HttpError.notFound('Không tìm thấy tài liệu');
    return { id: d.id, title: d.title, status: d.status, contentMd: d.contentMd, updatedAt: d.updatedAt.toISOString(), chunks: d.chunks };
  },

  async createDocument(userId: string, communityId: string, b: z.infer<typeof documentBody>) {
    await requireRole(userId, communityId, 'admin');
    if ((await prisma.chatbotDocument.count({ where: { communityId } })) >= 50) throw HttpError.badRequest('Mỗi cộng đồng tối đa 50 tài liệu');
    // slug duy nhất toàn bảng: tiền tố cộng đồng + ngẫu nhiên (không lộ/đụng slug tài liệu của bot Tào).
    const r = await chatbotRepository.upsertDocument({ slug: `c-${communityId}-${randomUUID().slice(0, 8)}`, title: b.title, contentMd: b.contentMd, updatedById: userId, communityId });
    return { id: r.document.id, title: r.document.title, status: r.document.status, chunks: r.chunks };
  },

  async updateDocument(userId: string, communityId: string, id: string, b: z.infer<typeof patchDocumentBody>) {
    await requireRole(userId, communityId, 'admin');
    const d = await chatbotRepository.getDocument(id, communityId);
    if (!d) throw HttpError.notFound('Không tìm thấy tài liệu');
    if (b.title !== undefined || b.contentMd !== undefined) {
      await chatbotRepository.upsertDocument({ slug: d.slug, title: b.title ?? d.title, contentMd: b.contentMd ?? d.contentMd, updatedById: userId, communityId });
    }
    if (b.status) await chatbotRepository.setDocumentStatus(id, b.status);
    return this.getDocument(userId, communityId, id);
  },

  // ---------------------------------------------------------------- hội thoại thành viên (chủ/admin xem — widget có ghi chú)
  async listConversations(userId: string, communityId: string, f: z.infer<typeof conversationsQuery>) {
    await requireRole(userId, communityId, 'admin');
    const { rows, total } = await conversationRepository.list({ communityId, skip: (f.page - 1) * f.limit, take: f.limit });
    return {
      data: rows.map((c) => ({
        id: c.id,
        user: { id: c.user.id, name: `${c.user.firstName} ${c.user.lastName}`.trim() },
        status: c.status,
        messages: c._count.messages,
        negative: c.negativeCount,
        firstQuestion: c.messages[0]?.content.slice(0, 200) ?? '',
        lastMessageAt: iso(c.lastMessageAt),
      })),
      meta: pageMeta(f.page, f.limit, total),
    };
  },

  async conversationDetail(userId: string, communityId: string, id: string) {
    await requireRole(userId, communityId, 'admin');
    const c = await conversationRepository.detail(id, communityId);
    if (!c) throw HttpError.notFound('Không tìm thấy hội thoại');
    return {
      id: c.id,
      status: c.status,
      user: { id: c.user.id, name: `${c.user.firstName} ${c.user.lastName}`.trim() },
      messages: c.messages.map((m) => ({ ...messageView(m), redacted: m.redacted })),
    };
  },
};
