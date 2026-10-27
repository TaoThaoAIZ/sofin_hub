import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../../components/ui/MaterialIcon';
import type { GamePair } from '../../types';
import { shuffle, StatsBar, useFinishOnce, useStopwatch, type BoardProps } from './shared';

interface Card {
  key: string;
  pairId: string;
  text: string;
  kind: 'term' | 'def';
}

/** Thời gian thẻ sai còn lật ngửa trước khi úp lại (ms). */
const MISMATCH_MS = 900;

const buildCards = (pairs: GamePair[]): Card[] =>
  shuffle(pairs.flatMap((p) => [{ key: `${p.id}:t`, pairId: p.id, text: p.term, kind: 'term' as const }, { key: `${p.id}:d`, pairId: p.id, text: p.definition, kind: 'def' as const }]));

/** Lật thẻ ghi nhớ: lật hai thẻ một lượt, ghép thuật ngữ với định nghĩa đúng. */
export function MemoryBoard({ pairs, onFinish }: BoardProps) {
  const { t } = useTranslation('course');
  const [cards] = useState(() => buildCards(pairs));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = pairs.length;
  const done = total > 0 && matched.size === total;
  const seconds = useStopwatch(started && !done);
  useFinishOnce(done, moves, seconds, onFinish);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
    <>
      <StatsBar seconds={seconds} moves={moves} matched={matched.size} total={total} />
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
                    ok ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100' : c.kind === 'term' ? 'border-[#ffb782] bg-[#fff3eb] font-extrabold text-[#c2410c] dark:bg-[#3a2616] dark:text-[#ffb782]' : 'border-[#d8e4f5] dark:border-white/15 bg-white font-medium text-stone-800 dark:bg-[#1f2630] dark:text-white'
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
    </>
  );
}
