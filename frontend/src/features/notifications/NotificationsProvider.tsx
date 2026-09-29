import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { safeInternalPath } from '../../lib/datetime';
import { openSseStream } from '../../lib/sse';
import { useAuth } from '../auth/AuthContext';
import { notificationKeys, useMarkNotificationRead, useUnreadNotificationCount } from './queries';
import { NOTIFICATION_TYPE_ICON, type AppNotification } from './types';

interface NotificationsContextValue {
  unreadCount: number;
  /** Đánh dấu đã đọc (nếu chưa) rồi mở `link` của thông báo; link lạ/không hợp lệ thì bỏ qua êm. */
  open: (n: AppNotification) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

interface Toast {
  key: number;
  n: AppNotification;
}

/**
 * Giữ số chưa đọc + luồng SSE thông báo realtime cho toàn app. Chỉ chạy khi đã đăng nhập, tự dọn khi logout.
 * Gắn trong App (bên trong AuthProvider và Router).
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (status !== 'authenticated') return;
    return openSseStream({
      ticketPath: '/notifications/stream-ticket',
      streamPath: '/notifications/stream',
      handlers: {
        notification: (data) => {
          const n = data as AppNotification;
          if (!n || typeof n !== 'object' || !n.id) return;
          void qc.invalidateQueries({ queryKey: notificationKeys.all });
          const key = ++seq.current;
          setToasts((t) => [...t.slice(-2), { key, n }]);
          setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 6000);
        },
      },
      // Không có replay: sau khi nối lại phải tải lại để bù thông báo bị lỡ.
      onOpen: (reconnected) => {
        if (reconnected) void qc.invalidateQueries({ queryKey: notificationKeys.all });
      },
    });
  }, [status, qc]);

  useEffect(() => {
    if (status === 'guest') setToasts([]);
  }, [status]);

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.readAt) markRead.mutate(n.id);
      const path = safeInternalPath(n.link);
      if (path) navigate(path);
    },
    [markRead, navigate],
  );

  return (
    <NotificationsContext.Provider value={{ unreadCount: status === 'authenticated' ? (unread.data ?? 0) : 0, open }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
        {toasts.map(({ key, n }) => (
          <div
            key={key}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white p-3 shadow-lg"
          >
            <button type="button" onClick={() => { open(n); setToasts((t) => t.filter((x) => x.key !== key)); }} className="flex min-w-0 flex-1 items-start gap-3 text-left">
              <span className="grid size-9 flex-none place-items-center rounded-full bg-brand/10">
                <MaterialIcon name={NOTIFICATION_TYPE_ICON[n.type] ?? 'notifications'} size={19} color="#f26a1b" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold">{n.title}</span>
                <span className="line-clamp-2 text-[12.5px] text-stone-600">{n.body}</span>
              </span>
            </button>
            <button type="button" aria-label="Đóng" onClick={() => setToasts((t) => t.filter((x) => x.key !== key))} className="text-stone-400 hover:text-stone-700">
              <MaterialIcon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext phải nằm trong NotificationsProvider');
  return ctx;
}
