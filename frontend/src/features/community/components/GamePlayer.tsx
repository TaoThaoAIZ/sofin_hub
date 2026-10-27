import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useGames, useSubmitGameResult } from '../queries';
import type { GameItem, GameResult } from '../types';
import { errText, ErrorNote } from './contentUi';
import { MatchBoard } from './games/MatchBoard';
import { MemoryBoard } from './games/MemoryBoard';
import { ScrambleBoard } from './games/ScrambleBoard';
import { SwipeBoard } from './games/SwipeBoard';
import { fmtTime, GAME_ICON, type BoardProps } from './games/shared';

const BOARDS: Record<GameItem['kind'], (p: BoardProps) => React.JSX.Element> = { memory: MemoryBoard, match: MatchBoard, swipe: SwipeBoard, scramble: ScrambleBoard };

// Nền kem chỉ dùng ở giao diện sáng; tối thì nền phẳng (ảnh kem làm chữ trắng không đọc được).
/** Thắng xong cho người chơi nhìn lại ván vừa chơi chừng này (ms) rồi mới hiện bảng điểm và thưởng. */
const REVEAL_MS = 3500;

const frameCls = "relative flex flex-col items-center gap-4 overflow-hidden rounded-[20px] bg-[url('/images/lesson/complete-bg.png')] bg-cover bg-center px-5 pt-6 pb-8 shadow-[1px_6px_15px_rgba(121,81,54,0.08)] dark:bg-[#171b1f] dark:bg-none";
const primaryBtn = 'inline-flex h-12 min-w-[170px] cursor-pointer items-center justify-center gap-2 rounded-[15px] border border-[#ff6717] bg-[#ff6717] px-5 text-[15px] font-bold text-white shadow-[0_4px_10px_rgba(229,120,41,0.15)]';
const ghostBtn = 'inline-flex h-12 min-w-[170px] cursor-pointer items-center justify-center gap-2 rounded-[15px] border border-[#eee1d9] bg-white px-5 text-[15px] font-bold text-[#1e1c1a] dark:bg-white dark:text-[#1e1c1a]';

/**
 * Các trò chơi cuối bài (một bài có thể có nhiều): một trò chơi thì vào chơi luôn, nhiều thì chọn trước.
 * Chơi xong gửi số lượt + thời gian lên server, server tính số sao và cộng điểm (một lần mỗi trò chơi).
 */
export function GamePlayer({ communityId, lessonId, onContinue }: { communityId: string; lessonId: string; onContinue: () => void }) {
  const { t } = useTranslation('course');
  const gamesQ = useGames(communityId, lessonId);
  const [pickedId, setPickedId] = useState<string | null>(null);
  // Chơi lại = dựng ván mới (key đổi => bàn chơi mount lại, xáo bài và đặt lại mọi trạng thái).
  const [round, setRound] = useState(0);
  const games = gamesQ.data?.games;

  if (gamesQ.isPending) return <p className="py-10 text-center text-stone-400">{t('game.loading')}</p>;
  if (gamesQ.isError) return <ErrorNote message={errText(gamesQ.error)} />;
  if (!games || games.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
        <p className="m-0 text-sm text-stone-600">{t('game.none')}</p>
        <button type="button" onClick={onContinue} className="h-11 cursor-pointer rounded-[15px] border border-[#ff6717] bg-[#ff6717] px-6 text-[15px] font-bold text-white">
          {t('game.continue')}
        </button>
      </div>
    );
  }

  const current = games.length === 1 ? games[0] : games.find((g) => g.id === pickedId);
  if (current) {
    return <GameRun key={`${current.id}:${round}`} communityId={communityId} lessonId={lessonId} game={current} onReplay={() => setRound((r) => r + 1)} onBack={games.length > 1 ? () => setPickedId(null) : undefined} onContinue={onContinue} />;
  }

  return (
    <section aria-label={t('game.pickTitle')} className={frameCls}>
      <div className="text-center">
        <h2 className="m-0 flex items-center justify-center gap-2 text-[clamp(20px,3.4vw,28px)] font-extrabold text-black dark:text-white">
          <MaterialIcon name="sports_esports" size={28} filled color="#ff570a" /> {t('game.pickTitle')}
        </h2>
        <p className="mx-0 mt-1 mb-0 text-[14px] text-[#626262] dark:text-[#bababa]">{t('game.pickHint', { n: games[0]!.pointsPerStar })}</p>
      </div>
      <ul className="m-0 grid w-full max-w-[640px] list-none grid-cols-2 gap-3 p-0 max-sm:grid-cols-1">
        {games.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => setPickedId(g.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#eee1d9] bg-white/90 p-4 text-left shadow-[1px_6px_20px_rgba(121,81,54,0.08)] hover:border-[#ff6717] dark:bg-[#26211d]/90">
              <span className="grid size-12 flex-none place-items-center rounded-xl bg-[#fff3eb] dark:bg-[#3a2616]">
                <MaterialIcon name={GAME_ICON[g.kind]} size={26} filled color="#ff570a" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold">{t(`game.kinds.${g.kind}.name`)}</span>
                <span className="block text-[12.5px] text-stone-500">{t('game.pairCount', { n: g.pairs.length })}</span>
              </span>
              <Stars count={g.best?.stars ?? 0} size={18} label={g.best ? t('game.starsAria', { n: g.best.stars }) : t('game.notPlayed')} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onContinue} className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-semibold text-stone-500 underline hover:text-brand">
        {t('game.skip')}
      </button>
    </section>
  );
}

function Stars({ count, size, label }: { count: number; size: number; label: string }) {
  return (
    <span aria-label={label} className="flex flex-none gap-0.5">
      {[1, 2, 3].map((n) => (
        <MaterialIcon key={n} name="star" size={size} filled color={n <= count ? '#f59e0b' : '#d6d3d1'} />
      ))}
    </span>
  );
}

function GameRun({ communityId, lessonId, game, onReplay, onBack, onContinue }: { communityId: string; lessonId: string; game: GameItem; onReplay: () => void; onBack?: (() => void) | undefined; onContinue: () => void }) {
  const { t } = useTranslation('course');
  const submit = useSubmitGameResult(communityId, lessonId);
  const [result, setResult] = useState<GameResult | null>(null);
  const [stats, setStats] = useState<{ moves: number; seconds: number } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const Board = BOARDS[game.kind];
  const { mutate } = submit;

  useEffect(() => {
    if (!stats) return;
    const id = setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => clearTimeout(id);
  }, [stats]);

  const finish = useCallback<BoardProps['onFinish']>(
    (r) => {
      setStats(r);
      mutate({ gameId: game.id, ...r }, { onSuccess: setResult });
    },
    [mutate, game.id],
  );

  const title = t(`game.kinds.${game.kind}.title`);
  return (
    <section aria-label={title} className={frameCls}>
      <div className="text-center">
        <h2 className="m-0 flex items-center justify-center gap-2 text-[clamp(20px,3.4vw,28px)] font-extrabold text-black dark:text-white">
          <MaterialIcon name={GAME_ICON[game.kind]} size={28} filled color="#ff570a" /> {title}
        </h2>
        <p className="mx-0 mt-1 mb-0 text-[14px] text-[#626262] dark:text-[#bababa]">{t(`game.kinds.${game.kind}.hint`, { n: game.pointsPerStar })}</p>
      </div>

      {result && stats && revealed ? (
        <div role="status" aria-live="polite" className="flex w-full max-w-[460px] flex-col items-center gap-3 rounded-2xl bg-white/90 p-6 text-center shadow-[1px_6px_30px_2px_rgba(121,81,54,0.08)] dark:bg-[#26211d]/90">
          <Stars count={result.stars} size={44} label={t('game.starsAria', { n: result.stars })} />
          <div className="text-[22px] font-extrabold">{t(`game.rating.${result.stars}`)}</div>
          <div className="text-[14px] text-stone-600">{t('game.stats', { moves: stats.moves, time: fmtTime(stats.seconds) })}</div>
          <div className={`rounded-full px-4 py-1.5 text-[13.5px] font-bold ${result.points > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-[#d0d3d6]'}`}>
            {result.points > 0 ? t('game.pointsEarned', { n: result.points }) : result.firstPlay ? t('game.pointsNeedComplete') : t('game.pointsOnce')}
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onReplay} className={ghostBtn}>
              <MaterialIcon name="replay" size={20} /> {t('game.replay')}
            </button>
            {onBack && (
              <button type="button" onClick={onBack} className={ghostBtn}>
                <MaterialIcon name="sports_esports" size={20} /> {t('game.another')}
              </button>
            )}
            <button type="button" onClick={onContinue} className={primaryBtn}>
              {t('game.continue')} <MaterialIcon name="arrow_forward" size={20} color="#fff" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <Board pairs={game.pairs} onFinish={finish} />
          {stats && !submit.isError && (
            <div role="status" aria-live="polite" className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-5 py-2 text-[14px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <MaterialIcon name="check_circle" size={20} filled color="currentColor" /> {t('game.finished')}
            </div>
          )}
          {submit.isError && <ErrorNote message={errText(submit.error)} />}
          <div className={`flex gap-4 ${stats && !submit.isError ? 'hidden' : ''}`}>
            {onBack && (
              <button type="button" onClick={onBack} className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-semibold text-stone-500 underline hover:text-brand">
                {t('game.back')}
              </button>
            )}
            <button type="button" onClick={onContinue} className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-semibold text-stone-500 underline hover:text-brand">
              {t('game.skip')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
