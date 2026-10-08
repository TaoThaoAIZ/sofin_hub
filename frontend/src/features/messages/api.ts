import { apiDelete, apiGet, apiPost } from '../../lib/api';
import type { BlockedUser, ConversationView, MessageAttachment, MessagePage, MessageView } from './types';

export const openConversation = (userId: string) =>
  apiPost<{ data: ConversationView }>('/conversations', { userId }).then((r) => r.data);

/** Backend phân trang keyset (mặc định 50/lần): gom các trang liên tiếp (tối đa 10 trang) để UI vẫn thấy đủ danh sách. */
export async function fetchConversations(signal?: AbortSignal): Promise<ConversationView[]> {
  const out: ConversationView[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await apiGet<{ data: ConversationView[]; meta?: { nextCursor?: string | null } }>('/conversations', { limit: 100, cursor }, signal);
    out.push(...r.data);
    cursor = r.meta?.nextCursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}

export const fetchMessages = (conversationId: string, before?: string, signal?: AbortSignal) =>
  apiGet<MessagePage>(`/conversations/${conversationId}/messages`, { before, limit: 30 }, signal);

export const sendMessage = (conversationId: string, content: string, attachments: MessageAttachment[]) =>
  apiPost<{ data: MessageView }>(`/conversations/${conversationId}/messages`, {
    content,
    ...(attachments.length ? { attachments } : {}),
  }).then((r) => r.data);

export const markConversationRead = (conversationId: string) =>
  apiPost<{ data: { unreadCount: number } }>(`/conversations/${conversationId}/read`).then((r) => r.data);

export const deleteConversation = (conversationId: string) => apiDelete<{ data: { deleted: boolean } }>(`/conversations/${conversationId}`).then((r) => r.data);

export const recallMessage = (messageId: string) => apiDelete<{ data: MessageView }>(`/messages/${messageId}`).then((r) => r.data);

export const fetchUnreadMessages = (signal?: AbortSignal) =>
  apiGet<{ data: { unreadCount: number } }>('/messages/unread-count', undefined, signal).then((r) => r.data.unreadCount);

export const blockUser = (userId: string) => apiPost<{ data: { blocked: boolean } }>(`/users/${userId}/block`);
export const unblockUser = (userId: string) => apiDelete<{ data: { blocked: boolean } }>(`/users/${userId}/block`);

export const fetchBlocks = (signal?: AbortSignal) =>
  apiGet<{ data: BlockedUser[] }>('/me/blocks', undefined, signal).then((r) => r.data);
