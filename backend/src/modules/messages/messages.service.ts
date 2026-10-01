import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { assertUserCan } from '../auth/user-status.js';
import { fileUserRepository } from '../auth/auth.repository.js';
import { userBriefView } from '../auth/user-view.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { uploadService } from '../uploads/uploads.service.js';
import { prismaMessageRepository, type ConversationCursor, type MessageRepository } from './messages.repository.js';
import { shared } from '../../infra/shared.js';
import { streamHub } from './messages.stream.js';
import { RECALLED_TEXT, type Attachment, type Conversation, type MessageRecord, type MessageView } from './messages.types.js';

/** Giới hạn tốc độ gửi tin. Mặc định tắt khi NODE_ENV=test; test có thể gán `.max` để kiểm thử. */
export const messageRateLimit = {
  max: env.NODE_ENV === 'test' ? 0 : env.MESSAGE_RATE_LIMIT_PER_MIN,
  windowMs: 60_000,
};

/**
 * Tối đa 1 thông báo / cuộc trò chuyện / người nhận trong khoảng này (gộp thông báo). Khóa throttle nằm ở state chia sẻ
 * (SET NX PX — atomic, đúng giữa các instance); khi người nhận ĐỌC cuộc trò chuyện thì khóa được xóa để tin kế tiếp báo lại.
 */
export const NOTIFY_THROTTLE_MS = 5 * 60_000;

/**
 * TÍN HIỆU "ĐANG XEM" (thay cho `push() === 0` cũ vốn sai với kết nối SSE xác sống): người nhận được coi là đang chủ động ở trong
 * cuộc trò chuyện chỉ khi CHÍNH HỌ vừa gọi API trên cuộc trò chuyện đó (mở/tải tin, đánh dấu đã đọc, gửi tin) trong khoảng này.
 * Đó là một ack phía client qua HTTP — kết nối xác sống không thể tạo ra. Mọi trường hợp còn lại: LUÔN lưu thông báo (có gộp theo
 * throttle trên) và SSE chỉ là kênh best-effort. Số tin chưa đọc (`unreadCount`) luôn ở DB nên không bao giờ mất.
 */
export const ACTIVE_VIEW_TTL_MS = 30_000;
const activeKey = (conversationId: string, userId: string) => `dm:active:${conversationId}:${userId}`;
const throttleKey = (conversationId: string, userId: string) => `dm:notified:${conversationId}:${userId}`;

const encodeCursor = (c: ConversationCursor) => Buffer.from(`${c.lastMessageAt}|${c.createdAt}|${c.id}`).toString('base64url');
function decodeCursor(raw: string): ConversationCursor {
  const [lastMessageAt, createdAt, id, ...rest] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  if (rest.length > 0 || !lastMessageAt || !createdAt || !id || !iso.test(lastMessageAt) || !iso.test(createdAt) || id.length > 100) {
    throw HttpError.badRequest('Mốc phân trang không hợp lệ');
  }
  return { lastMessageAt, createdAt, id };
}

const HTML_TAG = /<\/?[a-z!][^>]*>/i;

function toView(m: MessageRecord): MessageView {
  const deleted = !!m.deletedAt;
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: deleted ? RECALLED_TEXT : m.content,
    attachments: deleted ? [] : m.attachments,
    createdAt: m.createdAt,
    deleted,
  };
}

export function createMessageService(repo: MessageRepository = prismaMessageRepository) {
  const otherOf = (c: Conversation, userId: string) => c.userIds.find((u) => u !== userId)!;

  async function assertNotBlocked(a: string, b: string) {
    if ((await repo.isBlocked(a, b)) || (await repo.isBlocked(b, a))) {
      throw HttpError.forbidden('Bạn không thể nhắn tin cho người dùng này');
    }
  }

  /** 404 (không phải 403) cho người ngoài cuộc để không lộ sự tồn tại của cuộc trò chuyện. */
  async function requireParticipant(userId: string, conversationId: string): Promise<Conversation> {
    const c = await repo.getConversation(conversationId);
    if (!c || !c.userIds.includes(userId)) throw HttpError.notFound('Không tìm thấy cuộc trò chuyện');
    return c;
  }

  async function shareCommunity(a: string, b: string): Promise<boolean> {
    const [ma, mb] = await Promise.all([enrollmentService.listByUser(a), enrollmentService.listByUser(b)]);
    const set = new Set(ma.map((m) => m.communityId));
    return mb.some((m) => set.has(m.communityId));
  }

  async function checkRate(userId: string) {
    if (messageRateLimit.max <= 0) return;
    let ok = true;
    try {
      ok = (await shared().rateLimiter.hit(`dm:send:${userId}`, messageRateLimit.max, messageRateLimit.windowMs)).ok;
    } catch (e) {
      console.error('[messages] rate limiter lỗi, bỏ qua (fail-open):', e instanceof Error ? e.message : e);
    }
    if (!ok) throw HttpError.tooMany('Bạn gửi tin nhắn quá nhanh, vui lòng thử lại sau');
  }

  /** Ghi nhận user vừa chủ động tương tác với cuộc trò chuyện (best-effort: lỗi => coi như không "đang xem" => vẫn báo). */
  async function markActive(conversationId: string, userId: string) {
    try {
      await shared().kv.set(activeKey(conversationId, userId), '1', ACTIVE_VIEW_TTL_MS);
    } catch {
      /* best-effort */
    }
  }
  async function isActive(conversationId: string, userId: string): Promise<boolean> {
    try {
      return (await shared().kv.get(activeKey(conversationId, userId))) !== null;
    } catch {
      return false;
    }
  }

  async function resolveAttachments(userId: string, input: Attachment[]): Promise<Attachment[]> {
    const out: Attachment[] = [];
    for (const a of input) {
      const rec = await uploadService.getUploaded(a.url.slice('/api/files/'.length));
      // Chỉ được đính kèm file do chính mình đã upload; type/size lấy từ server, không tin client.
      if (!rec || rec.ownerId !== userId) throw HttpError.badRequest('Tệp đính kèm không hợp lệ hoặc không thuộc về bạn');
      out.push({ url: a.url, name: a.name, contentType: rec.contentType, size: rec.size });
    }
    return out;
  }

  async function conversationView(c: Conversation, userId: string) {
    const otherId = otherOf(c, userId);
    const [other, last, unreadCount, blockedByMe] = await Promise.all([
      userBriefView(otherId),
      repo.lastMessage(c.id),
      repo.unreadCount(c, userId),
      repo.isBlocked(userId, otherId),
    ]);
    return { id: c.id, other, lastMessage: last ? toView(last) : null, unreadCount, lastMessageAt: c.lastMessageAt, blockedByMe };
  }

  return {
    async openConversation(userId: string, targetId: string) {
      if (userId === targetId) throw HttpError.badRequest('Bạn không thể nhắn tin cho chính mình');
      {
        const target = await fileUserRepository.findById(targetId);
        if (!target || target.deletedAt) throw HttpError.notFound('Không tìm thấy người dùng'); // tài khoản đã xóa coi như không tồn tại
      }
      await assertNotBlocked(userId, targetId);
      let conv = await repo.findConversation(userId, targetId);
      const created = !conv;
      if (!conv) {
        if (!(await shareCommunity(userId, targetId))) {
          throw HttpError.forbidden('Chỉ nhắn tin được với thành viên chung cộng đồng với bạn');
        }
        conv = await repo.createConversation(userId, targetId);
      }
      return { created, data: await conversationView(conv, userId) };
    },

    /** Hội thoại mới hoạt động trước; phân trang keyset (`cursor` = `meta.nextCursor` của trang trước). Mọi dữ liệu lấy bằng 1 truy vấn. */
    async listConversations(userId: string, limit = 50, cursor?: string) {
      const { items, hasMore } = await repo.listConversationSummaries(userId, { limit, cursor: cursor ? decodeCursor(cursor) : undefined });
      return {
        data: items.map((s) => ({
          id: s.conversation.id,
          other: s.other,
          lastMessage: s.lastMessage ? toView(s.lastMessage) : null,
          unreadCount: s.unreadCount,
          lastMessageAt: s.conversation.lastMessageAt,
          blockedByMe: s.blockedByMe,
        })),
        meta: { hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1]!.cursor) : null },
      };
    },

    async listMessages(userId: string, conversationId: string, before: string | undefined, limit: number) {
      const c = await requireParticipant(userId, conversationId);
      await markActive(c.id, userId);
      let beforeSeq: number | undefined;
      if (before) {
        const m = await repo.getMessage(before);
        if (!m || m.conversationId !== c.id) throw HttpError.badRequest('Mốc phân trang không hợp lệ');
        beforeSeq = m.seq;
      }
      const { items, hasMore } = await repo.page(c.id, beforeSeq, limit);
      return { data: items.map(toView), meta: { hasMore, nextBefore: hasMore ? items[0]!.id : null } };
    },

    async send(userId: string, conversationId: string, content: string, attachments: Attachment[] = []) {
      await assertUserCan(userId, 'dm');
      const c = await requireParticipant(userId, conversationId);
      const otherId = otherOf(c, userId);
      await assertNotBlocked(userId, otherId);
      // Lưu văn bản thuần: từ chối thẻ HTML thay vì lọc âm thầm (FE vẫn phải escape khi hiển thị).
      if (HTML_TAG.test(content)) throw HttpError.badRequest('Tin nhắn không được chứa mã HTML');
      await checkRate(userId);
      const files = await resolveAttachments(userId, attachments);
      const msg = await repo.addMessage(c, userId, content, files);
      const view = toView(msg);

      // Người gửi vừa tương tác => đang xem; SSE (mọi instance) là best-effort, không quyết định việc có thông báo hay không.
      await markActive(c.id, userId);
      await Promise.all([streamHub.push(userId, 'message', view), streamHub.push(otherId, 'message', view)]);
      if (!(await isActive(c.id, otherId))) await this.notifyRecipient(c, userId, otherId, content);
      return view;
    },

    /** Gộp thông báo: tối đa 1 / cuộc trò chuyện / 5 phút cho người không chủ động xem cuộc trò chuyện (atomic SET NX). */
    async notifyRecipient(c: Conversation, senderId: string, recipientId: string, content: string) {
      let first = true;
      try {
        first = await shared().kv.setNx(throttleKey(c.id, recipientId), '1', NOTIFY_THROTTLE_MS);
      } catch {
        /* lỗi store: thà báo dư 1 thông báo còn hơn nuốt mất */
      }
      if (!first) return;
      const sender = await userBriefView(senderId);
      notify({
        userId: recipientId,
        type: 'message_received',
        title: `${sender.name} đã gửi tin nhắn cho bạn`,
        body: content.length > 80 ? `${content.slice(0, 77)}...` : content,
        link: `/messages/${c.id}`,
      });
    },

    async markRead(userId: string, conversationId: string) {
      const c = await requireParticipant(userId, conversationId);
      await repo.markRead(c, userId);
      await markActive(c.id, userId);
      await shared().kv.del(throttleKey(c.id, userId)).catch(() => undefined); // đã đọc => tin mới kế tiếp được báo lại ngay
      return { unreadCount: 0 };
    },

    async deleteMessage(userId: string, messageId: string) {
      const m = await repo.getMessage(messageId);
      const c = m ? await repo.getConversation(m.conversationId) : undefined;
      if (!m || !c || !c.userIds.includes(userId)) throw HttpError.notFound('Không tìm thấy tin nhắn');
      if (m.senderId !== userId) throw HttpError.forbidden('Chỉ người gửi mới được thu hồi tin nhắn');
      await repo.softDelete(m.id);
      // Thu hồi phải thu hồi cả file: không còn phục vụ (xóa nếu không tin nhắn sống nào khác dùng lại).
      await uploadService.discardMessageFiles(m.attachments.map((a) => a.url));
      const view = toView((await repo.getMessage(m.id)) ?? { ...m, deletedAt: new Date().toISOString(), content: '', attachments: [] });
      await Promise.all(c.userIds.map((u) => streamHub.push(u, 'message_deleted', view)));
      return view;
    },

    async unreadTotal(userId: string) {
      return { unreadCount: await repo.unreadTotal(userId) };
    },

    async block(userId: string, targetId: string) {
      if (userId === targetId) throw HttpError.badRequest('Bạn không thể chặn chính mình');
      {
        const target = await fileUserRepository.findById(targetId);
        if (!target || target.deletedAt) throw HttpError.notFound('Không tìm thấy người dùng'); // tài khoản đã xóa coi như không tồn tại
      }
      await repo.block(userId, targetId);
      return { blocked: true };
    },

    async unblock(userId: string, targetId: string) {
      await repo.unblock(userId, targetId);
      return { blocked: false };
    },

    async listBlocks(userId: string) {
      const list = await repo.listBlocks(userId);
      return Promise.all(list.map(async (b) => ({ ...(await userBriefView(b.userId)), blockedAt: b.blockedAt })));
    },
  };
}

export const messageService = createMessageService();
