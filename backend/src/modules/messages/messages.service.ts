import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { fileUserRepository } from '../auth/auth.repository.js';
import { userBriefView } from '../auth/user-view.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { uploadService } from '../uploads/uploads.service.js';
import { prismaMessageRepository, type MessageRepository } from './messages.repository.js';
import { streamHub } from './messages.stream.js';
import { RECALLED_TEXT, type Attachment, type Conversation, type MessageRecord, type MessageView } from './messages.types.js';

/** Giới hạn tốc độ gửi tin. Mặc định tắt khi NODE_ENV=test; test có thể gán `.max` để kiểm thử. */
export const messageRateLimit = {
  max: env.NODE_ENV === 'test' ? 0 : env.MESSAGE_RATE_LIMIT_PER_MIN,
  windowMs: 60_000,
};
const sentAt = new Map<string, number[]>();

/**
 * Tối đa 1 thông báo / cuộc trò chuyện / người nhận trong khoảng này. Throttle giữ trong BỘ NHỚ tiến trình (đơn giản nhất):
 * mất khi restart / lệch giữa các instance thì tệ nhất là người nhận có thêm 1 thông báo; không ảnh hưởng dữ liệu.
 * (Hạn chế: rate limit gửi tin `sentAt` cũng ở bộ nhớ — nhiều instance cần Redis.)
 */
export const NOTIFY_THROTTLE_MS = 5 * 60_000;
const lastNotified = new Map<string, number>();

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
    const set = new Set(ma.map((m) => m.courseId));
    return mb.some((m) => set.has(m.courseId));
  }

  function checkRate(userId: string) {
    if (messageRateLimit.max <= 0) return;
    const now = Date.now();
    const recent = (sentAt.get(userId) ?? []).filter((t) => now - t < messageRateLimit.windowMs);
    if (recent.length >= messageRateLimit.max) throw HttpError.tooMany('Bạn gửi tin nhắn quá nhanh, vui lòng thử lại sau');
    recent.push(now);
    sentAt.set(userId, recent);
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

    async listConversations(userId: string) {
      return Promise.all((await repo.listConversations(userId)).map((c) => conversationView(c, userId)));
    },

    async listMessages(userId: string, conversationId: string, before: string | undefined, limit: number) {
      const c = await requireParticipant(userId, conversationId);
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
      const c = await requireParticipant(userId, conversationId);
      const otherId = otherOf(c, userId);
      await assertNotBlocked(userId, otherId);
      // Lưu văn bản thuần: từ chối thẻ HTML thay vì lọc âm thầm (FE vẫn phải escape khi hiển thị).
      if (HTML_TAG.test(content)) throw HttpError.badRequest('Tin nhắn không được chứa mã HTML');
      checkRate(userId);
      const files = await resolveAttachments(userId, attachments);
      const msg = await repo.addMessage(c, userId, content, files);
      const view = toView(msg);

      streamHub.push(userId, 'message', view); // đồng bộ các tab khác của người gửi
      if (streamHub.push(otherId, 'message', view) === 0) await this.notifyOffline(c, userId, otherId, content);
      return view;
    },

    /** Gộp thông báo: tối đa 1 / cuộc trò chuyện / 5 phút cho người không online. */
    async notifyOffline(c: Conversation, senderId: string, recipientId: string, content: string) {
      const k = `${c.id}:${recipientId}`;
      const now = Date.now();
      if (now - (lastNotified.get(k) ?? 0) < NOTIFY_THROTTLE_MS) return;
      for (const [key, t] of lastNotified) if (now - t >= NOTIFY_THROTTLE_MS) lastNotified.delete(key); // không phình bộ nhớ
      lastNotified.set(k, now);
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
      return { unreadCount: 0 };
    },

    async deleteMessage(userId: string, messageId: string) {
      const m = await repo.getMessage(messageId);
      const c = m ? await repo.getConversation(m.conversationId) : undefined;
      if (!m || !c || !c.userIds.includes(userId)) throw HttpError.notFound('Không tìm thấy tin nhắn');
      if (m.senderId !== userId) throw HttpError.forbidden('Chỉ người gửi mới được thu hồi tin nhắn');
      await repo.softDelete(m.id);
      const view = toView((await repo.getMessage(m.id)) ?? { ...m, deletedAt: new Date().toISOString(), content: '', attachments: [] });
      for (const u of c.userIds) streamHub.push(u, 'message_deleted', view);
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
