import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '../../i18n';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';
import type { MessageAttachment } from './types';

export const messageKeys = {
  all: ['messages'] as const,
  conversations: ['messages', 'conversations'] as const,
  thread: (id: string) => ['messages', 'thread', id] as const,
  unread: ['messages', 'unread-count'] as const,
  blocks: ['messages', 'blocks'] as const,
};

export const useUnreadMessageCount = () => {
  const { status } = useAuth();
  return useQuery({
    queryKey: messageKeys.unread,
    queryFn: ({ signal }) => api.fetchUnreadMessages(signal),
    enabled: status === 'authenticated',
  });
};

export const useConversations = () => {
  const { status } = useAuth();
  return useQuery({
    queryKey: messageKeys.conversations,
    queryFn: ({ signal }) => api.fetchConversations(signal),
    enabled: status === 'authenticated',
  });
};

export const useThread = (conversationId: string | undefined) =>
  useInfiniteQuery({
    queryKey: messageKeys.thread(conversationId ?? ''),
    queryFn: ({ pageParam, signal }) => api.fetchMessages(conversationId!, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextBefore ?? undefined) : undefined),
    enabled: !!conversationId,
  });

export const useSendMessage = (conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { content: string; attachments: MessageAttachment[] }) => api.sendMessage(conversationId, v.content, v.attachments),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messageKeys.thread(conversationId) });
      void qc.invalidateQueries({ queryKey: messageKeys.conversations });
    },
  });
};

export const useMarkConversationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markConversationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messageKeys.conversations });
      void qc.invalidateQueries({ queryKey: messageKeys.unread });
    },
  });
};

export const useDeleteConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.deleteConversation(conversationId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messageKeys.conversations });
      void qc.invalidateQueries({ queryKey: messageKeys.unread });
    },
  });
};

export const useRecallMessage = (conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.recallMessage(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messageKeys.thread(conversationId) });
      void qc.invalidateQueries({ queryKey: messageKeys.conversations });
    },
  });
};

export const useBlocks = (enabled = true) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: messageKeys.blocks,
    queryFn: ({ signal }) => api.fetchBlocks(signal),
    enabled: enabled && status === 'authenticated',
  });
};

export const useBlockToggle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; block: boolean }) => (v.block ? api.blockUser(v.userId) : api.unblockUser(v.userId)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messageKeys.blocks });
      void qc.invalidateQueries({ queryKey: messageKeys.conversations });
    },
  });
};

/** Thông báo lỗi dễ hiểu cho các lỗi thường gặp của module tin nhắn. */
export function messageErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return err.message || i18n.t('errors.forbidden', { ns: 'messages' });
    if (err.status === 429) return i18n.t('errors.rateLimit', { ns: 'messages' });
    return err.message;
  }
  return err instanceof Error ? err.message : i18n.t('errors.generic', { ns: 'messages' });
}
