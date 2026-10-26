import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useGame, useSubmitGameResult } from '../queries';
import type { GamePair, GameResult } from '../types';
import { errText, ErrorNote } from './contentUi';

interface Card {
  key: string;
  pairId: string;
  text: string;
  kind: 'term' | 'def';
}

/** Thời gian thẻ sai còn lật ngửa trước khi úp lại (ms). */
const MISMATCH_MS = 900;

const shuffle = <T,>(list: T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

const buildCards = (pairs: GamePair[]): Card[] =>
  shuffle(pairs.flatMap((p) => [{ key: `${p.id}:t`, pairId: p.id, text: p.term, kind: 'term' as const }, { key: `${p.id}:d`, pairId: p.id, text: p.definition, kind: 'def' as const }]));

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Trò chơi lật thẻ ghi nhớ cuối bài: ghép thuật ngữ với định nghĩa. Xong thì gửi số lượt + thời gian lên server,
 * server tính số sao và cộng điểm (một lần mỗi bài).
 */
export function MemoryGame({ communityId, lessonId, onContinue }: { communityId: string; lessonId: string; onContinue: () => void }) {
  const { t } = useTranslation('course');
  const gameQ = useGame(communityId, lessonId);
  // Chơi lại = dựng ván mới (key đổi => bàn chơi mount lại, xáo bài và đặt lại mọi trạng thái).
  const [round, setRound] = useState(0);
  const pairs = gameQ.data?.game?.pairs;

  if (gameQ.isPending) return <p className="py-10 text-center text-stone-400">{t('game.loading')}</p>;
  if (gameQ.isError) return <ErrorNote message={errText(gameQ.error)} />;
  if (!pairs) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
        <p className="m-0 text-sm text-stone-600">{t('game.none')}</p>
        <button type="button" onClick={onContinue} className="h-11 cursor-pointer rounded-[15px] border border-[#ff6717] bg-[#ff6717] px-6 text-[15px] font-bold text-white">
          {t('game.continue')}
        </button>
      </div>
    );
  }

  return <MemoryBoard key={round} communityId={communityId} lessonId={lessonId} pairs={pairs} pointsPerStar={gameQ.data?.game?.pointsPerStar ?? 2} onReplay={() => setRound((r) => r + 1)} onContinue={onContinue} />;
}

function MemoryBoard({ communityId, lessonId, pairs, pointsPerStar, onReplay, onContinue }: { communityId: string; lessonId: string; pairs: GamePair[]; pointsPerStar: number; onReplay: () => void; onContinue: () => void }) {
  const { t } = useTranslation('course');
  const submit = useSubmitGameResult(communityId, lessonId);
  const [cards] = useState(() => buildCards(pairs));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = pairs.length;
  const done = total > 0 && matched.size === total;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!started || done) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, done]);

  // Ghép xong hết: nộp kết quả đúng một lần cho mỗi ván.
  const sent = useRef(false);
  useEffect(() => {
    if (!done || sent.current) return;
    sent.current = true;
    submit.mutate({ moves, seconds }, { onSuccess: setResult });
  }, [done, moves, seconds, submit]);

  const flip = (c: Card) => {
    if (locked.current || done || matched.has(c.pairId) || flipped.includes(c.key)) return;
    setStarted(true);
    const next = [...flipped, c.key];
    setFlipped(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next.map((k) => cards.find((x) => x.key === k)!);
    if (a!.pairId === b!.pairId) {
      setMatched((m) => new Set(m).add(a!.pairId));
      setFlipped([]);
    } else {
      locked.current = true;
      timer.current = setTimeout(() => {
        setFlipped([]);
        locked.current = false;
      }, MISMATCH_MS);
    }
  };

  const cols = cards.length <= 4 ? 'grid-cols-2' : cards.length <= 6 ? 'grid-cols-3 max-sm:grid-cols-2' : 'grid-cols-4 max-sm:grid-cols-2';

  return (
    <section aria-label={t('game.title')} className="relative flex flex-col items-center gap-4 overflow-hidden rounded-[20px] bg-cover bg-center px-5 pt-6 pb-8 shadow-[1px_6px_15px_rgba(121,81,54,0.08)]" style={{ backgroundImage: 'url(/images/lesson/complete-bg.png)' }}>
      <div className="text-center">
        <h2 className="m-0 flex items-center justify-center gap-2 text-[clamp(20px,3.4vw,28px)] font-extrabold text-black">
          <MaterialIcon name="style" size={28} filled color="#ff570a" /> {t('game.title')}
        </h2>
        <p className="mx-0 mt-1 mb-0 text-[14px] text-[#626262]">{t('game.hint', { n: pointsPerStar })}</p>
      </div>

      {result ? (
        <div role="status" aria-live="polite" className="flex w-full max-w-[460px] flex-col items-center gap-3 rounded-2xl bg-white/90 p-6 text-center shadow-[1px_6px_30px_2px_rgba(121,81,54,0.08)] dark:bg-[#26211d]/90">
          <div aria-label={t('game.starsAria', { n: result.stars })} className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <MaterialIcon key={n} name="star" size={44} filled color={n <= result.stars ? '#f59e0b' : '#d6d3d1'} />
            ))}
          </div>
          <div className="text-[22px] font-extrabold">{t(`game.rating.${result.stars}`)}</div>
          <div className="text-[14px] text-stone-600">{t('game.stats', { moves, time: fmtTime(seconds) })}</div>
          <div className={`rounded-full px-4 py-1.5 text-[13.5px] font-bold ${result.points > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300'}`}>
            {result.points > 0 ? t('game.pointsEarned', { n: result.points }) : result.firstPlay ? t('game.pointsNeedComplete') : t('game.pointsOnce')}
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onReplay} className="inline-flex h-12 min-w-[170px] cursor-pointer items-center justify-center gap-2 rounded-[15px] border border-[#eee1d9] bg-white px-5 text-[15px] font-bold text-[#1e1c1a]">
              <MaterialIcon name="replay" size={20} /> {t('game.replay')}
            </button>
            <button type="button" onClick={onContinue} className="inline-flex h-12 min-w-[170px] cursor-pointer items-center justify-center gap-2 rounded-[15px] border border-[#ff6717] bg-[#ff6717] px-5 text-[15px] font-bold text-white shadow-[0_4px_10px_rgba(229,120,41,0.15)]">
              {t('game.continue')} <MaterialIcon name="arrow_forward" size={20} color="#fff" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex w-full max-w-[640px] items-center justify-between gap-3 text-[13.5px] font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 dark:bg-white/10">
              <MaterialIcon name="timer" size={17} color="#ff570a" /> {fmtTime(seconds)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 dark:bg-white/10">
              <MaterialIcon name="touch_app" size={17} color="#ff570a" /> {t('game.moves', { n: moves })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 dark:bg-white/10">
              <MaterialIcon name="task_alt" size={17} color="#059669" /> {matched.size}/{total}
            </span>
          </div>

          <div className={`grid w-full max-w-[640px] gap-3 ${cols}`}>
            {cards.map((c) => {
              const open = flipped.includes(c.key) || matched.has(c.pairId);
              const ok = matched.has(c.pairId);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => flip(c)}
                  aria-label={open ? c.text : t('game.cardBack')}
                  aria-pressed={open}
                  disabled={ok}
                  className="h-[120px] w-full cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default max-sm:h-[104px]"
                  style={{ perspective: 900 }}
                >
                  <span className="relative block size-full transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: open ? 'rotateY(180deg)' : 'none' }}>
                    <span
                      className="absolute inset-0 grid place-items-center rounded-2xl border-2 border-[#ffd2b3] bg-gradient-to-br from-[#ff8a3d] to-[#ff570a] shadow-[0_4px_10px_rgba(229,120,41,0.2)]"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <MaterialIcon name="help" size={34} color="#fff" />
                    </span>
                    <span
                      className={`absolute inset-0 grid place-items-center overflow-hidden rounded-2xl border-2 p-2.5 text-center text-[13.5px] leading-snug ${
                        ok ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100' : c.kind === 'term' ? 'border-[#ffb782] bg-[#fff3eb] font-extrabold text-[#c2410c] dark:bg-[#3a2616] dark:text-[#ffb782]' : 'border-[#d8e4f5] bg-white font-medium text-stone-800 dark:bg-[#1f2630] dark:text-stone-100'
                      }`}
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <span className="line-clamp-4 wrap-break-word">{c.text}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {submit.isError && <ErrorNote message={errText(submit.error)} />}
          <button type="button" onClick={onContinue} className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-semibold text-stone-500 underline hover:text-brand">
            {t('game.skip')}
          </button>
        </>
      )}
    </section>
  );
}
