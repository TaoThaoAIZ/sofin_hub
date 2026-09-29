import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { formatRelative } from '../../../lib/datetime';
import { useClickOutside } from '../../../lib/useClickOutside';
import { useNotificationsContext } from '../NotificationsProvider';
import { useMarkAllNotificationsRead, useNotifications } from '../queries';
import { NOTIFICATION_TYPE_ICON } from '../types';

export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] leading-[18px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Chuông thông báo: badge chưa đọc + dropdown 10 thông báo gần nhất. `variant` chỉ đổi kiểu nút cho hợp Header/Topbar. */
export function NotificationBell({ variant = 'topbar' }: { variant?: 'topbar' | 'header' }) {
  const { unreadCount, open } = useNotificationsContext();
  const [isOpen, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const list = useNotifications({ page: 1, limit: 10 }, isOpen);
  const markAll = useMarkAllNotificationsRead();

  const btnClass = variant === 'header' ? 'glass grid size-10 place-items-center rounded-full' : 'grid place-items-center';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
        aria-expanded={isOpen}
        className={`relative ${btnClass}`}
      >
        <MaterialIcon name="notifications" size={variant === 'header' ? 22 : 24} />
        <CountBadge count={unreadCount} />
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+10px)] right-[-60px] z-50 flex max-h-[70vh] w-[min(380px,calc(100vw-24px))] flex-col rounded-2xl border border-[rgba(120,60,20,.12)] bg-white shadow-xl sm:right-0">
          <div className="flex items-center justify-between border-b border-[rgba(120,60,20,.08)] px-4 py-3">
            <span className="text-[15px] font-bold">Thông báo</span>
            <button
              type="button"
              disabled={unreadCount === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="text-[12.5px] font-semibold text-brand disabled:text-stone-400"
            >
              Đọc tất cả
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.isPending && <p className="py-8 text-center text-sm text-stone-400">Đang tải…</p>}
            {list.isError && <p className="py-8 text-center text-sm text-red-600">Không tải được thông báo.</p>}
            {list.data?.data.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Bạn chưa có thông báo nào.</p>}
            {list.data?.data.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  open(n);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-3 border-b border-[rgba(120,60,20,.05)] px-4 py-3 text-left hover:bg-[#fff7f0] ${n.readAt ? '' : 'bg-brand/5'}`}
              >
                <span className="grid size-9 flex-none place-items-center rounded-full bg-brand/10">
                  <MaterialIcon name={NOTIFICATION_TYPE_ICON[n.type] ?? 'notifications'} size={19} color="#f26a1b" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13.5px] ${n.readAt ? 'font-medium' : 'font-bold'}`}>{n.title}</span>
                  <span className="line-clamp-2 text-[12.5px] text-stone-600">{n.body}</span>
                  <span className="mt-0.5 block text-[11.5px] text-stone-400">{formatRelative(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="mt-2 size-2 flex-none rounded-full bg-brand" />}
              </button>
            ))}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-b-2xl border-t border-[rgba(120,60,20,.08)] px-4 py-2.5 text-center text-[13px] font-semibold text-brand hover:bg-brand/5"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
