import { Prisma } from '../../generated/prisma/client.js';
import type { Conversation as ConversationRow, Message as MessageRow } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { DELETED_USER_NAME } from '../auth/user-view.js';
import type { Attachment, Conversation, MessageRecord } from './messages.types.js';

/**
 * Hội thoại 1-1 trên Postgres (Conversation cặp userAId < userBId theo CHECK, Message.seq autoincrement toàn cục, UserBlock).
 * Số chưa đọc = truy vấn đếm theo readSeqA/B; phân trang cursor theo seq.
 */
export interface MessageRepository {
  findConversation(a: string, b: string): Promise<Conversation | undefined>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(a: string, b: string): Promise<Conversation>;
  listConversations(userId: string): Promise<Conversation[]>;
  /**
   * Danh sách hội thoại + người kia + tin cuối + số chưa đọc + trạng thái chặn trong MỘT truy vấn (không N+1), phân trang keyset
   * theo (lastMessageAt, createdAt, id) giảm dần. Trả tối đa `limit` dòng và cờ còn trang sau.
   */
  listConversationSummaries(userId: string, opts: { limit: number; cursor?: ConversationCursor }): Promise<{ items: ConversationSummary[]; hasMore: boolean }>;
  addMessage(conv: Conversation, senderId: string, content: string, attachments: Attachment[]): Promise<MessageRecord>;
  getMessage(id: string): Promise<MessageRecord | undefined>;
  /** Trả tối đa `limit` tin MỚI NHẤT có seq < beforeSeq, theo thứ tự cũ → mới; kèm cờ còn tin cũ hơn. */
  page(conversationId: string, beforeSeq: number | undefined, limit: number, minSeq?: number): Promise<{ items: MessageRecord[]; hasMore: boolean }>;
  lastMessage(conversationId: string, minSeq?: number): Promise<MessageRecord | undefined>;
  /** Ẩn toàn bộ tin hiện có của cuộc trò chuyện với RIÊNG `userId` (đặt mốc đã xóa + đã đọc). */
  clearForUser(conv: Conversation, userId: string): Promise<void>;
  unreadCount(conv: Conversation, userId: string): Promise<number>;
  /** Tổng chưa đọc của user trên mọi cuộc trò chuyện (1 truy vấn). */
  unreadTotal(userId: string): Promise<number>;
  markRead(conv: Conversation, userId: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  block(blockerId: string, targetId: string): Promise<void>;
  unblock(blockerId: string, targetId: string): Promise<void>;
  listBlocks(blockerId: string): Promise<{ userId: string; blockedAt: string }[]>;
  isBlocked(blockerId: string, targetId: string): Promise<boolean>;
}

export interface ConversationCursor {
  lastMessageAt: string;
  createdAt: string;
  id: string;
}
export interface ConversationSummary {
  conversation: Conversation;
  other: { id: string; name: string };
  lastMessage: MessageRecord | null;
  unreadCount: number;
  blockedByMe: boolean;
  cursor: ConversationCursor;
}

const toConversation = (c: ConversationRow): Conversation => ({
  id: c.id,
  userIds: [c.userAId, c.userBId],
  createdAt: c.createdAt.toISOString(),
  lastMessageAt: c.lastMessageAt.toISOString(),
  readSeq: { [c.userAId]: c.readSeqA, [c.userBId]: c.readSeqB },
  clearedSeq: { [c.userAId]: c.clearedSeqA, [c.userBId]: c.clearedSeqB },
});

const toMessage = (m: MessageRow): MessageRecord => ({
  id: m.id,
  seq: m.seq,
  conversationId: m.conversationId,
  senderId: m.senderId,
  content: m.content,
  attachments: (m.attachments ?? []) as unknown as Attachment[],
  createdAt: m.createdAt.toISOString(),
  deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
});

interface SummaryRow {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: Date;
  lastMessageAt: Date;
  readSeqA: number;
  readSeqB: number;
  clearedSeqA: number;
  clearedSeqB: number;
  otherId: string | null;
  firstName: string | null;
  lastName: string | null;
  otherDeletedAt: Date | null;
  lmId: string | null;
  lmSeq: number | null;
  lmSenderId: string | null;
  lmContent: string | null;
  lmAttachments: unknown;
  lmCreatedAt: Date | null;
  lmDeletedAt: Date | null;
  unread: number;
  blocked: boolean;
}

/**
 * Sắp cặp theo đúng so sánh của Postgres (CHECK "userAId" < "userBId" dùng collation của DB, có thể khác `Array.sort` của JS).
 */
async function orderPair(a: string, b: string): Promise<[string, string]> {
  const rows = await prisma.$queryRaw<{ lt: boolean }[]>`SELECT (${a}::text < ${b}::text) AS lt`;
  return rows[0]!.lt ? [a, b] : [b, a];
}

export const prismaMessageRepository: MessageRepository = {
  async findConversation(a, b) {
    const [userAId, userBId] = await orderPair(a, b);
    const c = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
    return c ? toConversation(c) : undefined;
  },

  async getConversation(id) {
    const c = await prisma.conversation.findUnique({ where: { id } });
    return c ? toConversation(c) : undefined;
  },

  async createConversation(a, b) {
    const [userAId, userBId] = await orderPair(a, b);
    try {
      return toConversation(await prisma.conversation.create({ data: { userAId, userBId } }));
    } catch (e) {
      // Hai yêu cầu mở cùng lúc: dòng thứ hai vi phạm unique => dùng dòng đã có.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const c = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
        if (c) return toConversation(c);
      }
      throw e;
    }
  },

  async listConversations(userId) {
    const rows = await prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toConversation);
  },

  async listConversationSummaries(userId, { limit, cursor }) {
    const after = cursor
      ? Prisma.sql`AND (c."lastMessageAt", c."createdAt", c."id") < (${cursor.lastMessageAt}::timestamp, ${cursor.createdAt}::timestamp, ${cursor.id}::text)`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<SummaryRow[]>`
      SELECT c."id", c."userAId", c."userBId", c."createdAt", c."lastMessageAt", c."readSeqA", c."readSeqB", c."clearedSeqA", c."clearedSeqB",
             o."id" AS "otherId", o."firstName", o."lastName", o."deletedAt" AS "otherDeletedAt",
             lm."id" AS "lmId", lm."seq" AS "lmSeq", lm."senderId" AS "lmSenderId", lm."content" AS "lmContent",
             lm."attachments" AS "lmAttachments", lm."createdAt" AS "lmCreatedAt", lm."deletedAt" AS "lmDeletedAt",
             (SELECT COUNT(*)::int FROM "Message" m
               WHERE m."conversationId" = c."id" AND m."senderId" <> ${userId} AND m."deletedAt" IS NULL
                 AND m."seq" > CASE WHEN c."userAId" = ${userId} THEN c."readSeqA" ELSE c."readSeqB" END) AS "unread",
             EXISTS (SELECT 1 FROM "UserBlock" b WHERE b."blockerId" = ${userId} AND b."targetId" = o."id") AS "blocked"
      FROM "Conversation" c
      LEFT JOIN "User" o ON o."id" = CASE WHEN c."userAId" = ${userId} THEN c."userBId" ELSE c."userAId" END
      LEFT JOIN LATERAL (SELECT * FROM "Message" m WHERE m."conversationId" = c."id"
                         AND m."seq" > CASE WHEN c."userAId" = ${userId} THEN c."clearedSeqA" ELSE c."clearedSeqB" END
                         ORDER BY m."seq" DESC LIMIT 1) lm ON true
      WHERE (c."userAId" = ${userId} OR c."userBId" = ${userId}) ${after}
        AND (lm."id" IS NOT NULL OR CASE WHEN c."userAId" = ${userId} THEN c."clearedSeqA" ELSE c."clearedSeqB" END = 0)
      ORDER BY c."lastMessageAt" DESC, c."createdAt" DESC, c."id" DESC
      LIMIT ${limit + 1}`;
    const items = rows.slice(0, limit).map((r): ConversationSummary => ({
      conversation: toConversation({ id: r.id, userAId: r.userAId, userBId: r.userBId, createdAt: r.createdAt, lastMessageAt: r.lastMessageAt, readSeqA: r.readSeqA, readSeqB: r.readSeqB, clearedSeqA: r.clearedSeqA, clearedSeqB: r.clearedSeqB }),
      other: { id: r.otherId ?? (r.userAId === userId ? r.userBId : r.userAId), name: r.otherId && !r.otherDeletedAt ? `${r.firstName} ${r.lastName}` : DELETED_USER_NAME },
      lastMessage: r.lmId
        ? {
            id: r.lmId,
            seq: r.lmSeq!,
            conversationId: r.id,
            senderId: r.lmSenderId!,
            content: r.lmContent!,
            attachments: (r.lmAttachments ?? []) as unknown as Attachment[],
            createdAt: r.lmCreatedAt!.toISOString(),
            deletedAt: r.lmDeletedAt ? r.lmDeletedAt.toISOString() : null,
          }
        : null,
      unreadCount: r.unread,
      blockedByMe: r.blocked,
      cursor: { lastMessageAt: r.lastMessageAt.toISOString(), createdAt: r.createdAt.toISOString(), id: r.id },
    }));
    return { items, hasMore: rows.length > limit };
  },

  async addMessage(conv, senderId, content, attachments) {
    const isA = conv.userIds[0] === senderId;
    return prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: { conversationId: conv.id, senderId, content, attachments: attachments as unknown as Prisma.InputJsonValue },
      });
      // GREATEST: hai tin gửi song song không được kéo readSeq của người gửi lùi lại.
      if (isA) {
        await tx.$executeRaw`UPDATE "Conversation" SET "lastMessageAt" = ${m.createdAt}, "readSeqA" = GREATEST("readSeqA", ${m.seq}) WHERE id = ${conv.id}`;
      } else {
        await tx.$executeRaw`UPDATE "Conversation" SET "lastMessageAt" = ${m.createdAt}, "readSeqB" = GREATEST("readSeqB", ${m.seq}) WHERE id = ${conv.id}`;
      }
      return toMessage(m);
    });
  },

  async getMessage(id) {
    const m = await prisma.message.findUnique({ where: { id } });
    return m ? toMessage(m) : undefined;
  },

  async page(conversationId, beforeSeq, limit, minSeq = 0) {
    const rows = await prisma.message.findMany({
      where: { conversationId, seq: { gt: minSeq, ...(beforeSeq !== undefined ? { lt: beforeSeq } : {}) } },
      orderBy: { seq: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    return { items: rows.slice(0, limit).reverse().map(toMessage), hasMore };
  },

  async lastMessage(conversationId, minSeq = 0) {
    const m = await prisma.message.findFirst({ where: { conversationId, seq: { gt: minSeq } }, orderBy: { seq: 'desc' } });
    return m ? toMessage(m) : undefined;
  },

  unreadCount: (conv, userId) =>
    prisma.message.count({
      where: { conversationId: conv.id, senderId: { not: userId }, seq: { gt: conv.readSeq[userId] ?? 0 }, deletedAt: null },
    }),

  async unreadTotal(userId) {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(m.id)::int AS n
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE (c."userAId" = ${userId} OR c."userBId" = ${userId})
        AND m."senderId" <> ${userId}
        AND m."deletedAt" IS NULL
        AND m.seq > CASE WHEN c."userAId" = ${userId} THEN c."readSeqA" ELSE c."readSeqB" END`;
    return rows[0]?.n ?? 0;
  },

  async markRead(conv, userId) {
    if (conv.userIds[0] === userId) {
      await prisma.$executeRaw`UPDATE "Conversation" SET "readSeqA" = GREATEST("readSeqA", COALESCE((SELECT MAX(seq) FROM "Message" WHERE "conversationId" = ${conv.id}), 0)) WHERE id = ${conv.id}`;
    } else {
      await prisma.$executeRaw`UPDATE "Conversation" SET "readSeqB" = GREATEST("readSeqB", COALESCE((SELECT MAX(seq) FROM "Message" WHERE "conversationId" = ${conv.id}), 0)) WHERE id = ${conv.id}`;
    }
  },

  async clearForUser(conv, userId) {
    const isA = conv.userIds[0] === userId;
    const col = isA ? Prisma.raw('"clearedSeqA"') : Prisma.raw('"clearedSeqB"');
    const read = isA ? Prisma.raw('"readSeqA"') : Prisma.raw('"readSeqB"');
    await prisma.$executeRaw`UPDATE "Conversation" SET ${col} = COALESCE((SELECT MAX(seq) FROM "Message" WHERE "conversationId" = ${conv.id}), 0), ${read} = GREATEST(${read}, COALESCE((SELECT MAX(seq) FROM "Message" WHERE "conversationId" = ${conv.id}), 0)) WHERE id = ${conv.id}`;
  },

  async softDelete(id) {
    await prisma.message.updateMany({ where: { id }, data: { deletedAt: new Date(), content: '', attachments: [] } });
  },

  async block(blockerId, targetId) {
    await prisma.userBlock.createMany({ data: [{ blockerId, targetId }], skipDuplicates: true });
  },

  async unblock(blockerId, targetId) {
    await prisma.userBlock.deleteMany({ where: { blockerId, targetId } });
  },

  async listBlocks(blockerId) {
    const rows = await prisma.userBlock.findMany({ where: { blockerId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({ userId: r.targetId, blockedAt: r.createdAt.toISOString() }));
  },

  async isBlocked(blockerId, targetId) {
    return !!(await prisma.userBlock.findUnique({ where: { blockerId_targetId: { blockerId, targetId } } }));
  },
};
