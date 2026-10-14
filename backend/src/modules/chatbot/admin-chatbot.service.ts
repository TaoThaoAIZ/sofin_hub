import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { ChatbotQA } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { auditService } from '../admin/admin-audit.service.js';
import { codexLoggedIn, llmHealth } from './chatbot.llm.js';
import { chatbotAvailable, chatbotSettings, patchChatbotSettingsBody, refreshChatbotSettings, writeChatbotSettings } from './chatbot.config.js';
import { conversationRepository } from './chatbot.conversations.js';
import { chatbotRepository } from './chatbot.repository.js';

/** Quản trị chatbot (Admin > Hỗ trợ > Chatbot, quyền support.manage). Mọi thao tác ghi đều có audit. */

const QA_STATUSES = ['active', 'candidate', 'rejected', 'archived', 'stale'] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
const variants = z.array(z.string().trim().min(1).max(500)).max(30);
const tags = z.array(z.string().trim().min(1).max(40)).max(10);

export const qaQuery = z.object({
  status: z.enum(QA_STATUSES).optional(),
  source: z.enum(['admin', 'learned', 'import']).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const createQaBody = z.object({
  question: text(1000),
  answer: text(4000),
  variants: variants.default([]),
  tags: tags.default([]),
  status: z.enum(['active', 'candidate']).default('active'),
});
export const patchQaBody = z
  .object({ question: text(1000), answer: text(4000), variants, tags, status: z.enum(['active', 'archived', 'candidate']) })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const approveQaBody = z.object({ question: text(1000), answer: text(4000), variants }).partial();
export const conversationsQuery = z.object({
  status: z.enum(['open', 'handed_off', 'closed']).optional(),
  feedback: z.enum(['negative']).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const createDocBody = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang'),
  title: text(200).optional(),
  contentMd: text(100_000),
});
export const patchDocBody = z
  .object({ title: text(200), contentMd: text(100_000), status: z.enum(['active', 'archived']) })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export { patchChatbotSettingsBody };

const pageMeta = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

const qaView = (q: ChatbotQA) => ({
  id: q.id,
  question: q.question,
  variants: q.variants,
  answer: q.answer,
  tags: q.tags,
  status: q.status,
  source: q.source,
  confidence: q.confidence,
  hitCount: q.hitCount,
  lastHitAt: iso(q.lastHitAt),
  sourceConversationId: q.sourceConversationId,
  documentId: q.documentId,
  reviewedAt: iso(q.reviewedAt),
  createdAt: q.createdAt.toISOString(),
  updatedAt: q.updatedAt.toISOString(),
});

async function qaOrThrow(id: string) {
  const q = await chatbotRepository.getQa(id);
  if (!q) throw HttpError.notFound('Không tìm thấy câu hỏi mẫu');
  return q;
}

const label = (s: string) => (s.length > 80 ? `${s.slice(0, 79)}…` : s);

/** Câu mẫu nền "cần điền" (chatbot.baseline.ts) có chỗ trống `[CẦN ADMIN ĐIỀN…]`: không cho bật khi chưa điền. */
export const ANSWER_PLACEHOLDER = '[CẦN ADMIN ĐIỀN';
function assertAnswerFilled(answer: string) {
  if (answer.includes(ANSWER_PLACEHOLDER)) throw HttpError.badRequest('Câu trả lời còn phần [CẦN ADMIN ĐIỀN…] — điền nội dung trước khi bật');
}

export const adminChatbotService = {
  async summary() {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [byStatus, conversations7d, handedOff7d, negative7d, docs] = await Promise.all([
      chatbotRepository.countQaByStatus(),
      prisma.chatbotConversation.count({ where: { createdAt: { gte: since } } }),
      prisma.chatbotConversation.count({ where: { createdAt: { gte: since }, status: 'handed_off' } }),
      prisma.chatbotMessage.count({ where: { createdAt: { gte: since }, feedback: -1 } }),
      prisma.chatbotDocument.count({ where: { status: 'active' } }),
    ]);
    const qa = Object.fromEntries(QA_STATUSES.map((s) => [s, byStatus.find((r) => r.status === s)?._count._all ?? 0]));
    return {
      available: chatbotAvailable(),
      enabled: chatbotSettings().enabled,
      codexLoggedIn: codexLoggedIn(),
      fakeModel: env.CHATBOT_FAKE_MODEL,
      llm: llmHealth(),
      qa,
      documents: docs,
      last7Days: { conversations: conversations7d, handedOff: handedOff7d, negativeFeedback: negative7d },
    };
  },

  // ---------------------------------------------------------------- Q&A
  async listQa(f: z.infer<typeof qaQuery>) {
    const { rows, total } = await chatbotRepository.listQa({ ...f, skip: (f.page - 1) * f.limit, take: f.limit });
    return { data: rows.map(qaView), meta: pageMeta(f.page, f.limit, total) };
  },

  async getQa(id: string) {
    return qaView(await qaOrThrow(id));
  },

  async createQa(actorId: string, b: z.infer<typeof createQaBody>) {
    if (b.status === 'active') assertAnswerFilled(b.answer);
    const q = await chatbotRepository.createQa({ ...b, source: 'admin', createdById: actorId, reviewedById: actorId, reviewedAt: new Date() });
    await auditService.record(actorId, { action: 'chatbot.qa.create', targetType: 'chatbot_qa', targetId: q.id, targetLabel: label(q.question) });
    return qaView(q);
  },

  async updateQa(actorId: string, id: string, b: z.infer<typeof patchQaBody>) {
    const cur = await qaOrThrow(id);
    if ((b.status ?? cur.status) === 'active') assertAnswerFilled(b.answer ?? cur.answer);
    const q = await chatbotRepository.updateQa(id, { ...b, ...(b.status === 'active' ? { reviewedById: actorId, reviewedAt: new Date() } : {}) });
    await auditService.record(actorId, { action: 'chatbot.qa.update', targetType: 'chatbot_qa', targetId: id, targetLabel: label(q.question), metadata: { fields: Object.keys(b) } });
    return qaView(q);
  },

  /** Duyệt (có thể sửa trước) một Q&A chờ duyệt / stale => active. */
  async approveQa(actorId: string, id: string, b: z.infer<typeof approveQaBody>) {
    const cur = await qaOrThrow(id);
    if (cur.status === 'active') throw HttpError.conflict('Câu hỏi mẫu đã được bật');
    assertAnswerFilled(b.answer ?? cur.answer);
    const q = await chatbotRepository.updateQa(id, { ...b, status: 'active', reviewedById: actorId, reviewedAt: new Date() });
    await auditService.record(actorId, { action: 'chatbot.qa.approve', targetType: 'chatbot_qa', targetId: id, targetLabel: label(q.question), metadata: { from: cur.status, edited: Object.keys(b) } });
    return qaView(q);
  },

  async rejectQa(actorId: string, id: string) {
    const cur = await qaOrThrow(id);
    if (cur.status === 'rejected') throw HttpError.conflict('Câu hỏi mẫu đã bị từ chối');
    const q = await chatbotRepository.updateQa(id, { status: 'rejected', reviewedById: actorId, reviewedAt: new Date() });
    await auditService.record(actorId, { action: 'chatbot.qa.reject', targetType: 'chatbot_qa', targetId: id, targetLabel: label(q.question), metadata: { from: cur.status } });
    return qaView(q);
  },

  // ---------------------------------------------------------------- tài liệu
  async listDocuments() {
    return (await chatbotRepository.listDocuments()).map((d) => ({ id: d.id, slug: d.slug, title: d.title, status: d.status, chunks: d._count.chunks, updatedAt: d.updatedAt.toISOString() }));
  },

  async getDocument(id: string) {
    const d = await chatbotRepository.getDocument(id);
    if (!d) throw HttpError.notFound('Không tìm thấy tài liệu');
    return { id: d.id, slug: d.slug, title: d.title, status: d.status, contentMd: d.contentMd, updatedAt: d.updatedAt.toISOString(), chunks: d.chunks };
  },

  async createDocument(actorId: string, b: z.infer<typeof createDocBody>) {
    if (await prisma.chatbotDocument.findUnique({ where: { slug: b.slug } })) throw HttpError.conflict('Slug đã tồn tại');
    const r = await chatbotRepository.upsertDocument({ ...b, updatedById: actorId });
    await auditService.record(actorId, { action: 'chatbot.doc.create', targetType: 'chatbot_document', targetId: r.document.id, targetLabel: r.document.title });
    return this.getDocument(r.document.id);
  },

  async updateDocument(actorId: string, id: string, b: z.infer<typeof patchDocBody>) {
    const d = await chatbotRepository.getDocument(id);
    if (!d) throw HttpError.notFound('Không tìm thấy tài liệu');
    let staleQa = 0;
    if (b.title !== undefined || b.contentMd !== undefined) {
      const r = await chatbotRepository.upsertDocument({ slug: d.slug, title: b.title ?? d.title, contentMd: b.contentMd ?? d.contentMd, updatedById: actorId });
      staleQa = r.staleQa;
    }
    if (b.status) await chatbotRepository.setDocumentStatus(id, b.status);
    await auditService.record(actorId, { action: 'chatbot.doc.update', targetType: 'chatbot_document', targetId: id, targetLabel: b.title ?? d.title, metadata: { fields: Object.keys(b), staleQa } });
    return { ...(await this.getDocument(id)), staleQa };
  },

  // ---------------------------------------------------------------- hội thoại
  async listConversations(f: z.infer<typeof conversationsQuery>) {
    const { rows, total } = await conversationRepository.list({ ...f, skip: (f.page - 1) * f.limit, take: f.limit });
    return {
      data: rows.map((c) => ({
        id: c.id,
        user: { id: c.user.id, name: `${c.user.firstName} ${c.user.lastName}`.trim(), email: c.user.email },
        status: c.status,
        ticketCode: c.ticketCode,
        firstMessage: c.messages[0]?.content ?? null,
        messageCount: c._count.messages,
        negativeCount: c.negativeCount,
        learnedAt: iso(c.learnedAt),
        lastMessageAt: c.lastMessageAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
      meta: pageMeta(f.page, f.limit, total),
    };
  },

  async getConversation(id: string) {
    const c = await conversationRepository.detail(id);
    if (!c) throw HttpError.notFound('Không tìm thấy hội thoại');
    return {
      id: c.id,
      user: { id: c.user.id, name: `${c.user.firstName} ${c.user.lastName}`.trim(), email: c.user.email },
      status: c.status,
      ticketId: c.ticketId,
      ticketCode: c.ticketCode,
      tokensIn: c.tokensIn,
      tokensOut: c.tokensOut,
      learnedAt: iso(c.learnedAt),
      createdAt: c.createdAt.toISOString(),
      messages: c.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        answerSource: m.answerSource,
        matchedQaId: m.matchedQaId,
        toolCalls: m.toolCalls,
        feedback: m.feedback,
        redacted: m.redacted,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  },

  // ---------------------------------------------------------------- cài đặt
  async getSettings() {
    return { settings: await refreshChatbotSettings(), codexLoggedIn: codexLoggedIn(), fakeModel: env.CHATBOT_FAKE_MODEL };
  },

  async updateSettings(actorId: string, b: z.infer<typeof patchChatbotSettingsBody>) {
    const settings = await writeChatbotSettings(b, actorId);
    await auditService.record(actorId, { action: 'chatbot.settings.update', targetType: 'settings', targetId: 'chatbot.settings', targetLabel: 'Chatbot settings', metadata: { fields: Object.keys(b) } });
    return { settings, codexLoggedIn: codexLoggedIn(), fakeModel: env.CHATBOT_FAKE_MODEL };
  },
};
