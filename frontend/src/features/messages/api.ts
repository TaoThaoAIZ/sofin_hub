import { apiDelete, apiGet, apiPost } from '../../lib/api';
import type { BlockedUser, ConversationView, MessageAttachment, MessagePage, MessageView } from './types';

export const openConversation = (userId: string) =>
  apiPost<{ data: ConversationView }>('/conversations', { userId }).then((r) => r.data);

export const fetchConversations = (signal?: AbortSignal) =>
  apiGet<{ data: ConversationView[] }>('/conversations', undefined, signal).then((r) => r.data);

export const fetchMessages = (conversationId: string, before?: string, signal?: AbortSignal) =>
  apiGet<MessagePage>(`/conversations/${conversationId}/messages`, { before, limit: 30 }, signal);

export const sendMessage = (conversationId: string, content: string, attachments: MessageAttachment[]) =>
  apiPost<{ data: MessageView }>(`/conversations/${conversationId}/messages`, {
    content,
    ...(attachments.length ? { attachments } : {}),
  }).then((r) => r.data);

export const markConversationRead = (conversationId: string) =>
  apiPost<{ data: { unreadCount: number } }>(`/conversations/${conversationId}/read`).then((r) => r.data);

export const recallMessage = (messageId: string) => apiDelete<{ data: MessageView }>(`/messages/${messageId}`).then((r) => r.data);

export const fetchUnreadMessages = (signal?: AbortSignal) =>
  apiGet<{ data: { unreadCount: number } }>('/messages/unread-count', undefined, signal).then((r) => r.data.unreadCount);

export const blockUser = (userId: string) => apiPost<{ data: { blocked: boolean } }>(`/users/${userId}/block`);
export const unblockUser = (userId: string) => apiDelete<{ data: { blocked: boolean } }>(`/users/${userId}/block`);

export const fetchBlocks = (signal?: AbortSignal) =>
  apiGet<{ data: BlockedUser[] }>('/me/blocks', undefined, signal).then((r) => r.data);
