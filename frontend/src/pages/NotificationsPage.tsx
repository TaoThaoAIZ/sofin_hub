import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/layout/Header';
import { RequireLogin } from '../components/layout/RequireLogin';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Pager } from '../components/ui/Pager';
import { ApiError } from '../lib/api';
import { formatRelative } from '../lib/datetime';
import { useNotificationsContext } from '../features/notifications/NotificationsProvider';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useNotificationPreferences,
  useNotifications,
  useUpdatePreferences,
} from '../features/notifications/queries';
import {
  MANDATORY_TYPES,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_ICON,
  notificationTypeLabel,
  type EmailDigest,
  type NotificationType,
} from '../features/notifications/types';

const DIGESTS: EmailDigest[] = ['off', 'daily', 'weekly'];

function Preferences() {
  const { t: tr } = useTranslation('notifications');
  const prefs = useNotificationPreferences();
  const update = useUpdatePreferences();
  const [error, setError] = useState<string | null>(null);

  const run = (body: Parameters<typeof update.mutate>[0]) => {
    setError(null);
    update.mutate(body, { onError: (e) => setError(e instanceof ApiError ? e.message : tr('prefs.saveFailed')) });
  };

  return (
    <section className="glass mt-6 rounded-3xl p-5">
      <h2 className="text-lg font-extrabold">{tr('prefs.title')}</h2>
      <p className="mt-1 text-[13px] text-stone-500">{tr('prefs.desc')}</p>
      {prefs.isPending && <p className="py-6 text-center text-stone-400">{tr('prefs.loading')}</p>}
      {prefs.isError && <p className="py-6 text-center text-red-600">{tr('prefs.loadError')}</p>}
      {prefs.data && (
        <>
          <ul className="mt-3 divide-y divide-[rgba(120,60,20,.07)]">
            {NOTIFICATION_TYPES.map((t: NotificationType) => {
              const mandatory = MANDATORY_TYPES.includes(t);
              const on = mandatory || prefs.data.types[t] !== false;
              return (
                <li key={t} className="flex items-center gap-3 py-2.5">
                  <MaterialIcon name={NOTIFICATION_TYPE_ICON[t]} size={20} color="#78716c" />
                  <span className="min-w-0 flex-1 text-[14px]">
                    {notificationTypeLabel(t)}
                    {mandatory && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-stone-900/5 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                        <MaterialIcon name="lock" size={12} /> {tr('prefs.mandatory')}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={notificationTypeLabel(t)}
                    disabled={mandatory || update.isPending}
                    onClick={() => run({ types: { [t]: !on } })}
                    className={`relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-brand' : 'bg-stone-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[14px] font-semibold">{tr('prefs.emailDigest')}</span>
            <div className="flex gap-1.5">
              {DIGESTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={update.isPending}
                  onClick={() => run({ emailDigest: d })}
                  className={`h-9 rounded-xl border px-3.5 text-[13px] font-medium ${
                    prefs.data.emailDigest === d ? 'border-transparent bg-brand font-bold text-white' : 'border-[rgba(120,60,20,.12)] bg-white'
                  }`}
                >
                  {tr(`prefs.digest.${d}`)}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-stone-400">{tr('prefs.note')}</span>
          </div>
        </>
      )}
      {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}
    </section>
  );
}

function NotificationsInner() {
  const { t: tr } = useTranslation('notifications');
  const [page, setPage] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { open, unreadCount } = useNotificationsContext();
  const list = useNotifications({ page, limit: 20, unread: onlyUnread ? true : undefined });
  const markAll = useMarkAllNotificationsRead();
  const del = useDeleteNotification();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-[760px] px-4 py-8 md:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{tr('page.title')}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOnlyUnread((v) => !v);
                setPage(1);
              }}
              className={`h-9 rounded-xl border px-3.5 text-[13px] font-medium ${onlyUnread ? 'border-transparent bg-brand font-bold text-white' : 'border-[rgba(120,60,20,.12)] bg-white'}`}
            >
              {unreadCount > 0 ? tr('page.unreadCount', { count: unreadCount }) : tr('page.unread')}
            </button>
            <button
              type="button"
              disabled={unreadCount === 0 || markAll.isPending}
              onClick={() => markAll.mutate(undefined, { onError: (e) => setError(e instanceof ApiError ? e.message : tr('page.actionFailed')) })}
              className="h-9 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3.5 text-[13px] font-medium disabled:opacity-50"
            >
              {tr('page.markAll')}
            </button>
          </div>
        </div>

        {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}

        <div className="glass mt-4 overflow-hidden rounded-3xl">
          {list.isPending && <p className="py-12 text-center text-stone-400">{tr('page.loading')}</p>}
          {list.isError && <p className="py-12 text-center text-red-600">{list.error instanceof ApiError ? list.error.message : tr('page.loadError')}</p>}
          {list.data?.data.length === 0 && (
            <p className="py-12 text-center text-stone-500">{onlyUnread ? tr('page.noUnread') : tr('page.empty')}</p>
          )}
          {list.data?.data.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 border-b border-[rgba(120,60,20,.06)] px-4 py-3.5 ${n.readAt ? '' : 'bg-brand/5'}`}>
              <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className="grid size-10 flex-none place-items-center rounded-full bg-brand/10">
                  <MaterialIcon name={NOTIFICATION_TYPE_ICON[n.type] ?? 'notifications'} size={20} color="#f26a1b" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] ${n.readAt ? 'font-medium' : 'font-bold'}`}>{n.title}</span>
                  <span className="block text-[13px] text-stone-600">{n.body}</span>
                  <span className="mt-0.5 block text-[11.5px] text-stone-400">{formatRelative(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="mt-2 size-2 flex-none rounded-full bg-brand" aria-label={tr('page.unreadAria')} />}
              </button>
              <button
                type="button"
                aria-label={tr('page.deleteAria')}
                title={tr('page.deleteTitle')}
                disabled={del.isPending}
                onClick={() => del.mutate(n.id, { onError: (e) => setError(e instanceof ApiError ? e.message : tr('page.deleteFailed')) })}
                className="grid size-8 flex-none place-items-center rounded-lg text-stone-400 hover:bg-stone-900/5 hover:text-red-600"
              >
                <MaterialIcon name="delete" size={19} />
              </button>
            </div>
          ))}
        </div>
        <Pager page={page} totalPages={list.data?.meta.totalPages ?? 1} onChange={setPage} />

        <Preferences />
      </div>
    </div>
  );
}

export function NotificationsPage() {
  return (
    <RequireLogin>
      <NotificationsInner />
    </RequireLogin>
  );
}
