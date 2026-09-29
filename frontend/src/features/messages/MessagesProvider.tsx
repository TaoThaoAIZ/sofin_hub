import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { openSseStream } from '../../lib/sse';
import { useAuth } from '../auth/AuthContext';
import { messageKeys, useUnreadMessageCount } from './queries';
import type { MessageView } from './types';

interface MessagesContextValue {
  unreadCount: number;
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

/** Giữ số tin chưa đọc + luồng SSE tin nhắn realtime (events: ready / message / message_deleted). Chỉ chạy khi đã đăng nhập. */
export function MessagesProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const qc = useQueryClient();
  const unread = useUnreadMessageCount();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const refresh = (conversationId?: string) => {
      void qc.invalidateQueries({ queryKey: messageKeys.conversations });
      void qc.invalidateQueries({ queryKey: messageKeys.unread });
      if (conversationId) void qc.invalidateQueries({ queryKey: messageKeys.thread(conversationId) });
    };
    return openSseStream({
      ticketPath: '/messages/stream-ticket',
      streamPath: '/messages/stream',
      handlers: {
        message: (d) => refresh((d as MessageView | null)?.conversationId),
        message_deleted: (d) => refresh((d as MessageView | null)?.conversationId),
      },
      onOpen: (reconnected) => {
        if (reconnected) void qc.invalidateQueries({ queryKey: messageKeys.all });
      },
    });
  }, [status, qc]);

  return <MessagesContext.Provider value={{ unreadCount: status === 'authenticated' ? (unread.data ?? 0) : 0 }}>{children}</MessagesContext.Provider>;
}

export function useMessagesContext(): MessagesContextValue {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessagesContext phải nằm trong MessagesProvider');
  return ctx;
}
