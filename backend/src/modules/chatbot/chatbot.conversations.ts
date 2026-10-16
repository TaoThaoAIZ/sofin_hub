import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ChatbotAnswerSource, ChatbotConversationStatus } from '../../generated/prisma/client.js';

/**
 * Hội thoại & tin nhắn chatbot (Prisma). Mọi hàm nhận userId đều lọc theo chủ hội thoại — không đọc chéo người dùng.
 * `communityId`: null = hội thoại với bot "Tào"; có giá trị = với bot của cộng đồng đó (2 loại không bao giờ lẫn nhau).
 */

/** Hội thoại đang mở quá lâu không nhắn thì coi là phiên mới (widget mở lại sẽ bắt đầu hội thoại mới). */
export const CONVERSATION_IDLE_MS = 24 * 3600_000;

export const conversationRepository = {
  create: (userId: string, communityId: string | null = null) => prisma.chatbotConversation.create({ data: { userId, communityId } }),

  /** Hội thoại gần nhất của user còn "sống" (open/handed_off, nhắn trong 24h). */
  current: (userId: string, communityId: string | null = null) =>
    prisma.chatbotConversation.findFirst({
      where: { userId, communityId, status: { in: ['open', 'handed_off'] }, lastMessageAt: { gt: new Date(Date.now() - CONVERSATION_IDLE_MS) } },
      orderBy: { lastMessageAt: 'desc' },
    }),

  findOwned: (id: string, userId: string, communityId: string | null = null) => prisma.chatbotConversation.findFirst({ where: { id, userId, communityId } }),

  findById: (id: string) => prisma.chatbotConversation.findUnique({ where: { id } }),

  /** `limit` tin gần nhất, theo thứ tự thời gian tăng dần. */
  async recentMessages(conversationId: string, limit: number) {
    const rows = await prisma.chatbotMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit });
    return rows.reverse();
  },

  allMessages: (conversationId: string) => prisma.chatbotMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),

  async addMessage(
    conversationId: string,
    m: { role: 'user' | 'assistant'; content: string; answerSource?: ChatbotAnswerSource; matchedQaId?: string | null; toolCalls?: Prisma.InputJsonValue; redacted?: boolean },
    usage?: { tokensIn: number; tokensOut: number },
  ) {
    const [msg] = await prisma.$transaction([
      prisma.chatbotMessage.create({
        data: {
          conversationId,
          role: m.role,
          content: m.content,
          answerSource: m.answerSource ?? null,
          matchedQaId: m.matchedQaId ?? null,
          ...(m.toolCalls !== undefined ? { toolCalls: m.toolCalls } : {}),
          redacted: m.redacted ?? false,
        },
      }),
      prisma.chatbotConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          ...(usage ? { tokensIn: { increment: usage.tokensIn }, tokensOut: { increment: usage.tokensOut } } : {}),
        },
      }),
    ]);
    return msg;
  },

  setStatus: (id: string, data: { status: ChatbotConversationStatus; ticketId?: string; ticketCode?: string }) =>
    prisma.chatbotConversation.update({ where: { id }, data }),

  /** Số tin user đã gửi từ `since` (giới hạn mỗi ngày). */
  countUserMessagesSince: (userId: string, since: Date, communityId: string | null = null) =>
    prisma.chatbotMessage.count({ where: { role: 'user', createdAt: { gte: since }, conversation: { userId, communityId } } }),

  /** Đặt 👍/👎 cho tin của bot — chỉ khi tin thuộc hội thoại của chính user. Trả về null nếu không tìm thấy. */
  async setFeedback(messageId: string, userId: string, value: -1 | 0 | 1) {
    const msg = await prisma.chatbotMessage.findFirst({ where: { id: messageId, role: 'assistant', conversation: { userId } }, select: { id: true } });
    if (!msg) return null;
    return prisma.chatbotMessage.update({ where: { id: msg.id }, data: { feedback: value } });
  },

  /** Hội thoại đã im >= idleMs và chưa học (job chatbot.learn). */
  pendingLearning: (idleMs: number, take: number) =>
    prisma.chatbotConversation.findMany({
      where: { learnedAt: null, lastMessageAt: { lt: new Date(Date.now() - idleMs) } },
      orderBy: { lastMessageAt: 'asc' },
      take,
      select: { id: true, status: true, communityId: true },
    }),

  markLearned: (id: string) => prisma.chatbotConversation.update({ where: { id }, data: { learnedAt: new Date() } }),

  // ------------------------------------------------------------------ admin
  async list(f: { status?: ChatbotConversationStatus; feedback?: 'negative'; q?: string; skip: number; take: number; communityId?: string | null }) {
    const where: Prisma.ChatbotConversationWhereInput = {
      communityId: f.communityId ?? null,
      ...(f.status ? { status: f.status } : {}),
      ...(f.feedback === 'negative' ? { messages: { some: { feedback: -1 } } } : {}),
      ...(f.q
        ? {
            OR: [
              { messages: { some: { content: { contains: f.q, mode: 'insensitive' } } } },
              { user: { email: { contains: f.q.toLowerCase() } } },
              { ticketCode: f.q.toUpperCase() },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.chatbotConversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'asc' }],
        skip: f.skip,
        take: f.take,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { messages: true } },
          messages: { where: { role: 'user' }, orderBy: { createdAt: 'asc' }, take: 1, select: { content: true } },
        },
      }),
      prisma.chatbotConversation.count({ where }),
    ]);
    const negatives = rows.length
      ? await prisma.chatbotMessage.groupBy({ by: ['conversationId'], where: { conversationId: { in: rows.map((r) => r.id) }, feedback: -1 }, _count: { _all: true } })
      : [];
    const neg = new Map(negatives.map((n) => [n.conversationId, n._count._all]));
    return { rows: rows.map((r) => ({ ...r, negativeCount: neg.get(r.id) ?? 0 })), total };
  },

  detail: (id: string, communityId: string | null = null) =>
    prisma.chatbotConversation.findFirst({
      where: { id, communityId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    }),
};
