import { useTranslation } from 'react-i18next';
import { Avatar } from '../../account/components/Avatar';
import { useParams } from 'react-router-dom';
import i18n from '../../../i18n';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAuth } from '../../auth/AuthContext';
import { useLeaderboard, useLevels } from '../queries';
import type { LeaderboardWindow, LevelInfo } from '../types';
import { AVATAR_PALETTE, initials } from './shared';

const BOARDS: { window: LeaderboardWindow; icon: string; color: string; titleKey: string; prefix: string }[] = [
  { window: '7d', icon: 'local_fire_department', color: '#ef4444', titleKey: 'leaderboard.top7', prefix: '+' },
  { window: '30d', icon: 'bar_chart', color: '#f26a1b', titleKey: 'leaderboard.top30', prefix: '+' },
  { window: 'all', icon: 'emoji_events', color: '#f59e0b', titleKey: 'leaderboard.topAll', prefix: '' },
];

// Màu huy hiệu hạng 1-3 lấy từ medal[] trong file thiết kế gốc.
const MEDAL = [
  ['#ffe08a', '#f5b10b'],
  ['#e2e8f0', '#94a3b8'],
  ['#f5b27a', '#c2551b'],
];
const HEX = 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)';

const levelLabel = (l: LevelInfo) =>
  l.name
    ? i18n.t('leaderboard.levelNamed', { ns: 'community', level: l.level, name: l.name })
    : i18n.t('leaderboard.level', { ns: 'community', level: l.level });

function LevelRow({ l, current }: { l: LevelInfo; current: number }) {
  const { t } = useTranslation('community');
  const state = l.level === current ? 'cur' : l.level < current ? 'done' : 'locked';
  return (
    <div className="flex items-start gap-3.5 py-2">
      <span
        className={`grid size-[38px] flex-none place-items-center rounded-full ${
          state === 'cur'
            ? 'bg-gradient-to-b from-[#ffe7a8] to-[#fbbf24] text-[15px] font-extrabold text-[#78350f] shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_4px_10px_rgba(245,158,11,.3)]'
            : 'bg-stone-900/5 text-stone-700'
        }`}
      >
        {state === 'cur' ? l.level : <MaterialIcon name={state === 'done' ? 'check' : 'lock'} size={18} />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{levelLabel(l)}</div>
        <div className="mt-0.5 text-xs leading-snug text-stone-500">
          {l.minPoints > 0 ? t('leaderboard.fromPoints', { points: l.minPoints }) : ''}
          {t('leaderboard.memberPct', { pct: l.memberPct })}
        </div>
      </div>
    </div>
  );
}

function Board({ cfg, courseId, meId }: { cfg: (typeof BOARDS)[number]; courseId: string; meId?: string }) {
  const { t } = useTranslation('community');
  const rows = useLeaderboard(courseId, cfg.window);
  return (
    <section className="glass min-w-0 rounded-[22px] px-3 pt-3.5 pb-2.5">
      <div className="mb-1.5 flex items-center gap-2.5 border-b border-[rgba(120,60,20,.08)] px-1 pb-3">
        <MaterialIcon name={cfg.icon} size={24} filled color={cfg.color} />
        <span className="flex-1 text-base font-bold">{t(cfg.titleKey)}</span>
        <MaterialIcon name="chevron_right" size={20} color="#57534e" />
      </div>
      {rows.isPending && <p className="py-6 text-center text-sm text-stone-400">{t('common.loading')}</p>}
      {rows.data?.length === 0 && <p className="py-6 text-center text-sm text-stone-500">{t('leaderboard.noActivity')}</p>}
      {rows.data?.map((r, i) => (
        <div
          key={r.userId}
          className={`flex items-center gap-3 rounded-xl px-2.5 py-1.5 ${i === 0 ? 'bg-gradient-to-r from-[#ffe4cc]/80 to-[#fff1e6]/50' : i < 9 ? 'border-b border-[rgba(120,60,20,.05)]' : ''} ${r.userId === meId ? 'ring-1 ring-brand/40' : ''}`}
        >
          {i < 3 ? (
            <span
              className="grid h-7 w-[26px] flex-none place-items-center text-xs font-extrabold text-white"
              style={{ clipPath: HEX, background: `linear-gradient(180deg,${MEDAL[i]![0]},${MEDAL[i]![1]})` }}
            >
              {r.rank}
            </span>
          ) : (
            <span className="w-[26px] flex-none text-center text-[13px] text-stone-600">{r.rank}</span>
          )}
          <Avatar url={r.avatarUrl} name={r.name} size={34} text={initials(r.name)} className="text-stone-700" style={{ background: AVATAR_PALETTE[(i + BOARDS.indexOf(cfg) * 3) % AVATAR_PALETTE.length] }} />
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{r.name}</span>
            {r.userId === meId && <span className="text-xs text-brand">{t('leaderboard.you')}</span>}
            {i === 0 && <MaterialIcon name="crown" size={17} filled color="#f59e0b" />}
          </span>
          <span className="text-[13.5px] font-medium whitespace-nowrap text-brand">
            {cfg.prefix}
            {t('leaderboard.points', { points: r.points })}
          </span>
        </div>
      ))}
    </section>
  );
}

export function LeaderboardTab() {
  const { t } = useTranslation('community');
  const { id: courseId = '' } = useParams();
  const { user } = useAuth();
  const levels = useLevels(courseId);
  const me = levels.data?.me;
  const list = levels.data?.levels ?? [];
  const half = Math.ceil(list.length / 2);
  const myName = me?.name ?? [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <main className="flex min-w-0 flex-col gap-4">
      <section className="relative flex flex-wrap items-stretch gap-[18px] overflow-hidden rounded-[28px] border border-brand/15 bg-gradient-to-r from-[#fff7f0] via-[#ffe9d9] to-[#ffdcc4] p-[18px]">
        <img src="/images/community/lb-hero-bg.webp" alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />

        <div className="relative z-10 flex flex-[1_1_300px] flex-col items-center justify-center gap-2 py-2.5">
          <div className="relative size-[200px]">
            <div className="size-full rounded-full bg-gradient-to-b from-[#ffd29e] to-brand p-1.5 shadow-[0_14px_34px_rgba(242,106,27,.3)]">
              <Avatar url={user?.avatarUrl} name={myName || '?'} size={188} text={initials(myName || '?')} className="border-4 border-white bg-[#f3ddd0] text-brand" style={{ fontSize: 64, fontWeight: 800 }} />
            </div>
            {me?.rank === 1 && (
              <MaterialIcon name="crown" size={44} filled color="#f59e0b" className="pointer-events-none absolute -top-[30px] left-1/2 -translate-x-1/2" />
            )}
            <div className="pointer-events-none absolute right-0 bottom-3.5 grid size-[50px] place-items-center rounded-[14px] border-[3px] border-white bg-gradient-to-b from-[#ff8f45] to-brand text-[22px] font-extrabold text-white shadow-[0_8px_18px_rgba(242,106,27,.4)]">
              {me?.rank ?? '–'}
            </div>
          </div>
          <div className="mt-1 text-[26px] font-extrabold tracking-tight">{myName}</div>
          <div className="flex h-[34px] items-center gap-2 rounded-full bg-white/85 pr-3.5 pl-2 text-[14.5px] font-bold text-brand shadow-[0_4px_14px_rgba(242,106,27,.14)]">
            <span className="grid size-6 place-items-center rounded-full bg-gradient-to-b from-[#ff8f45] to-brand">
              <MaterialIcon name="crown" size={15} filled color="#fff" />
            </span>
            {me ? levelLabel({ level: me.level, name: me.levelName, minPoints: 0, memberPct: 0 }) : i18n.t('leaderboard.level', { ns: 'community', level: 1 })}
          </div>
          <div className="flex items-center gap-1.5 text-[13.5px] text-stone-800">
            {me && me.pointsToNext > 0 ? t('leaderboard.toNext', { points: me.pointsToNext }) : t('leaderboard.maxLevel')}
            <MaterialIcon name="info" size={17} />
          </div>
        </div>

        <div className="relative z-10 min-w-0 flex-[2_1_520px] rounded-[20px] border border-white/85 bg-white/70 px-5 py-[18px] shadow-[inset_0_1px_0_#fff,0_10px_30px_rgba(120,60,20,.08)] backdrop-blur-lg">
          <div className="flex flex-wrap items-center gap-3 border-b border-[rgba(120,60,20,.08)] pb-3">
            <MaterialIcon name="bar_chart" size={24} filled color="#f26a1b" />
            <span className="text-lg font-extrabold">{t('leaderboard.journey')}</span>
            <div className="ml-auto flex h-[34px] min-w-[200px] flex-[0_1_330px] items-center gap-2.5 rounded-full bg-white px-3.5 shadow-[0_2px_10px_rgba(120,60,20,.08)]">
              <MaterialIcon name="emoji_events" size={18} filled color="#f59e0b" />
              <span className="text-[12.5px] font-semibold whitespace-nowrap">{t('leaderboard.journeyDone', { pct: me?.journeyPct ?? 0 })}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(120,60,20,.08)]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#ff8f45] to-brand" style={{ width: `${me?.journeyPct ?? 0}%` }} />
              </div>
            </div>
          </div>
          {levels.isPending && <p className="py-6 text-center text-sm text-stone-400">{t('leaderboard.loadingLevels')}</p>}
          <div className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-7">
            <div className="flex flex-col">
              {list.slice(0, half).map((l) => (
                <LevelRow key={l.level} l={l} current={me?.level ?? 1} />
              ))}
            </div>
            <div className="flex flex-col">
              {list.slice(half).map((l) => (
                <LevelRow key={l.level} l={l} current={me?.level ?? 1} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-1 flex flex-wrap items-center gap-4">
        <MaterialIcon name="bar_chart" size={38} filled color="#f26a1b" />
        <div className="min-w-0 flex-[1_1_300px]">
          <div className="text-[22px] font-extrabold tracking-tight">{t('leaderboard.title')}</div>
          <div className="mt-0.5 text-sm text-stone-600">{t('leaderboard.subtitle')}</div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-4">
        {BOARDS.map((b) => (
          <Board key={b.window} cfg={b} courseId={courseId} meId={user?.id} />
        ))}
      </div>
    </main>
  );
}
