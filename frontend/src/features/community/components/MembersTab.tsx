import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import i18n, { currentLocale } from '../../../i18n';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useClickOutside } from '../../../lib/useClickOutside';
import { useAuth } from '../../auth/AuthContext';
import { MemberActionsMenu } from '../../communities/components/MemberActionsMenu';
import { useCommunityDetail } from '../../courses/queries';
import { useStartConversation } from '../../messages/useStartConversation';
import { useMembers } from '../queries';
import type { MemberFilter } from '../types';
import { AVATAR_PALETTE, CommunityInfoCard, initials, PageBanner } from './shared';

const SORTS = [
  { key: 'active', labelKey: 'members.sortAsk' },
  { key: 'joined', labelKey: 'members.sortJoined' },
] as const;

const GRID = 'grid grid-cols-[minmax(200px,2.2fr)_1.2fr_1fr_1.2fr_92px] gap-3';

function formatJoined(iso: string) {
  const d = new Date(iso);
  return i18n.t('members.joinedFmt', {
    ns: 'community',
    day: String(d.getDate()).padStart(2, '0'),
    month: i18n.language === 'en' ? d.toLocaleString(currentLocale(), { month: 'short' }) : d.getMonth() + 1,
    year: d.getFullYear(),
  });
}

function formatAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return i18n.t('members.ago.minutes', { ns: 'community', count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return i18n.t('members.ago.hours', { ns: 'community', count: hours });
  return i18n.t('members.ago.days', { ns: 'community', count: Math.round(hours / 24) });
}

function pageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  if (page <= 3) [2, 3, 4, 5].forEach((n) => set.add(n));
  const nums = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1]! > 1) out.push('…');
    out.push(n);
  });
  return out;
}

export function MembersTab() {
  const { t } = useTranslation('community');
  const { id: courseId = '' } = useParams();
  const { data: course } = useCommunityDetail(courseId);
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [sort, setSort] = useState<'active' | 'joined'>('active');
  const [sortOpen, setSortOpen] = useState(false);
  const { user } = useAuth();
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const sortRef = useRef<HTMLDivElement>(null);
  useClickOutside(sortRef, () => setSortOpen(false));
  const members = useMembers(courseId, { q: q || undefined, page, filter, sort });
  const chat = useStartConversation();

  const counts = members.data?.counts;
  const tabs: { key: MemberFilter; label: string; count?: number; dot?: boolean }[] = [
    { key: 'all', label: t('members.filterAll'), count: counts?.all },
    { key: 'online', label: t('members.filterOnline'), count: counts?.online, dot: true },
    { key: 'admin', label: t('members.filterAdmin'), count: counts?.admins },
  ];
  const totalPages = members.data?.meta.totalPages ?? 1;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-6 max-[1280px]:grid-cols-1">
      <main className="flex min-w-0 flex-col gap-4">
        {chat.error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
            <span className="flex-1">{chat.error}</span>
            <button type="button" onClick={chat.clearError} aria-label={t('members.closeNotice')}>
              <MaterialIcon name="close" size={17} />
            </button>
          </div>
        )}
        <PageBanner image="mem-hero-bg.webp" icon="group" title={t('members.title')} subtitle={t('members.subtitle')} />

        <section className="glass rounded-3xl px-4 pt-3.5 pb-4">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            {tabs.map((tb) => {
              const on = filter === tb.key;
              return (
                <button
                  key={tb.key}
                  onClick={() => {
                    setFilter(tb.key);
                    setPage(1);
                  }}
                  className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-[13.5px] whitespace-nowrap ${
                    on
                      ? 'border-transparent bg-gradient-to-b from-[#ff8f45] to-brand font-bold text-white shadow-[0_8px_18px_-6px_rgba(242,106,27,.5)]'
                      : 'border-[rgba(120,60,20,.12)] bg-white font-medium text-stone-800'
                  }`}
                >
                  {tb.dot && <span className="size-2 rounded-full bg-green-500" />}
                  {tb.label}
                  {tb.count !== undefined && (
                    <span className={`rounded-full px-[7px] py-0.5 text-xs font-semibold ${on ? 'bg-white/20 text-white' : 'bg-stone-900/5 text-stone-600'}`}>
                      {tb.count.toLocaleString(currentLocale())}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="ml-auto flex min-w-0 flex-1 basis-[220px] items-center justify-end gap-2.5">
              <label className="flex h-10 min-w-0 max-w-[260px] flex-1 items-center gap-2 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3">
                <MaterialIcon name="search" size={19} color="#78716c" />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t('members.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-0"
                />
              </label>
              <div ref={sortRef} className="relative">
                <button
                  type="button"
                  aria-label={t('members.sortAria')}
                  onClick={() => setSortOpen((o) => !o)}
                  className="grid size-10 flex-none place-items-center rounded-[10px] border border-[rgba(120,60,20,.12)] bg-white hover:bg-[#fff7f0]"
                >
                  <MaterialIcon name="tune" size={20} color={sort !== 'active' ? '#f26a1b' : '#1c1917'} />
                </button>
                {sortOpen && (
                  <div className="glass absolute right-0 z-10 mt-2 w-52 rounded-xl bg-white p-1.5 shadow-lg [--glass-bg:#fff]">
                    <div className="px-2.5 py-1.5 text-[11.5px] font-semibold tracking-wide text-stone-500">{t('members.sortBy')}</div>
                    {SORTS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => {
                          setSort(s.key);
                          setPage(1);
                          setSortOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13.5px] hover:bg-stone-50 ${sort === s.key ? 'font-semibold text-brand' : ''}`}
                      >
                        {t(s.labelKey)}
                        {sort === s.key && <MaterialIcon name="check" size={17} color="#f26a1b" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className={`${GRID} border-b border-[rgba(120,60,20,.08)] px-3 pt-3.5 pb-2.5 text-[11.5px] font-semibold tracking-wide text-stone-500`}>
                <span>{t('members.colMember')}</span>
                <span>{t('members.colStatus')}</span>
                <span>{t('members.colJoined')}</span>
                <span>{t('members.colLastActive')}</span>
                <span />
              </div>
              {members.isPending && <p className="py-8 text-center text-stone-400">{t('members.loading')}</p>}
              {members.data?.data.map((m, i) => (
                <div key={m.id} className={`${GRID} items-center border-b border-[rgba(120,60,20,.06)] px-3 py-2.5 hover:bg-[#fff7f0]/80`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid size-10 flex-none place-items-center rounded-full text-[13px] font-bold text-stone-700"
                      style={{ background: AVATAR_PALETTE[i % AVATAR_PALETTE.length] }}
                    >
                      {initials(m.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <span className="truncate">{m.name}</span>
                        {m.roleDetail === 'owner' && <MaterialIcon name="crown" size={17} filled color="#f59e0b" />}
                        {(m.roleDetail === 'owner' || m.roleDetail === 'admin' || m.roleDetail === 'mod') && (
                          <span
                            className={`flex-none rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${
                              m.roleDetail === 'owner' ? 'bg-amber-100 text-amber-700' : m.roleDetail === 'admin' ? 'bg-brand/10 text-brand' : 'bg-blue-100 text-blue-700'
                            }`}
                            title={t(`roles.${m.roleDetail}`)}
                          >
                            {m.roleDetail === 'owner' ? 'Owner' : m.roleDetail === 'admin' ? 'Admin' : 'Mod'}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[12.5px] text-stone-500">@{m.handle}</div>
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex h-[26px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap ${
                        m.online ? 'bg-green-500/10 text-green-700' : 'bg-stone-900/5 text-stone-600'
                      }`}
                    >
                      <span className={`size-[7px] rounded-full ${m.online ? 'bg-green-500' : 'bg-stone-400'}`} />
                      {m.online ? t('members.filterOnline') : t('members.inactive')}
                    </span>
                  </div>
                  <span className="text-[13px] text-stone-700">{formatJoined(m.enrolledAt)}</span>
                  <span className="text-[13px] text-stone-700">{formatAgo(m.lastActiveAt)}</span>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={m.id === user?.id || m.id.startsWith('seed:') || chat.pendingUserId === m.id}
                      onClick={() => void chat.startConversation(m.id)}
                      title={m.id === user?.id ? t('members.isYou') : m.id.startsWith('seed:') ? t('members.demoMember') : t('members.message', { name: m.name })}
                      aria-label={t('members.message', { name: m.name })}
                      className="grid h-9 w-[38px] place-items-center rounded-[10px] border border-[rgba(120,60,20,.12)] bg-white hover:bg-[#fff7f0] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-white"
                    >
                      <MaterialIcon name="chat_bubble" size={18} color="#1c1917" />
                    </button>
                    <MemberActionsMenu
                      courseId={courseId}
                      member={m}
                      viewerRole={course?.viewerRole}
                      viewerId={user?.id}
                      onNotify={(message, kind = 'ok') => setToast({ message, kind })}
                    />
                  </div>
                </div>
              ))}
              {members.data?.data.length === 0 && <p className="py-8 text-center text-stone-500">{t('members.notFound')}</p>}
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label={t('members.prevPage')} className="grid size-[34px] place-items-center text-stone-600 disabled:opacity-40">
              <MaterialIcon name="chevron_left" size={20} />
            </button>
            {pageList(page, totalPages).map((n, i) =>
              n === '…' ? (
                <span key={`e${i}`} className="grid min-w-[34px] place-items-center text-stone-500">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`h-[34px] min-w-[34px] rounded-full px-1.5 text-[13.5px] font-semibold ${
                    n === page ? 'bg-gradient-to-b from-[#ff8f45] to-brand text-white shadow-[0_6px_14px_rgba(242,106,27,.35)]' : 'text-stone-800'
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label={t('members.nextPage')} className="grid size-[34px] place-items-center text-stone-600 disabled:opacity-40">
              <MaterialIcon name="chevron_right" size={20} />
            </button>
          </div>
        </section>
      </main>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[60] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.kind === 'error' ? 'bg-red-600' : 'bg-stone-900'
          }`}
        >
          {toast.message}
        </div>
      )}

      {course && <CommunityInfoCard course={course} />}
    </div>
  );
}
