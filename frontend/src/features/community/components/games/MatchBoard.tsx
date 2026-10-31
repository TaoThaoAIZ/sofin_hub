import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shuffle, StatsBar, boardBtn, useFinishOnce, useStopwatch, useTimeouts, type BoardProps } from './shared';

/** Thời gian cặp nối sai còn tô đỏ trước khi bỏ chọn (ms). */
const WRONG_MS = 700;

type Side = 'l' | 'r';
interface Pick {
  side: Side;
  id: string;
}

/** Nối cặp: chọn một thuật ngữ (cột trái) rồi một định nghĩa (cột phải), mỗi lần nối là một lượt. */
export function MatchBoard({ pairs, onFinish }: BoardProps) {
  const { t } = useTranslation('course');
  const [left] = useState(() => shuffle(pairs));
  const [right] = useState(() => shuffle(pairs));
  const [picked, setPicked] = useState<Pick | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ l: string; r: string } | null>(null);
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const later = useTimeouts();
  const total = pairs.length;
  const done = matched.size === total;
  const seconds = useStopwatch(started && !done);
  useFinishOnce(done, moves, seconds, onFinish);

  const pick = (side: Side, id: string) => {
    if (wrong || matched.has(id) || done) return;
    setStarted(true);
    if (!picked || picked.side === side) {
      setPicked(picked?.side === side && picked.id === id ? null : { side, id });
      return;
    }
    const l = side === 'l' ? id : picked.id;
    const r = side === 'r' ? id : picked.id;
    setMoves((m) => m + 1);
    if (l === r) {
      setMatched((m) => new Set(m).add(l));
      setPicked(null);
    } else {
      setWrong({ l, r });
      later(() => {
        setWrong(null);
        setPicked(null);
      }, WRONG_MS);
    }
  };

  const cls = (side: Side, id: string) => {
    if (matched.has(id)) return 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100';
    if (wrong && (side === 'l' ? wrong.l : wrong.r) === id) return 'animate-pulse border-red-400 bg-red-50 text-red-900 dark:bg-red-500/20 dark:text-red-100';
    if (picked?.side === side && picked.id === id) return 'border-[#ff570a] bg-[#fff3eb] ring-2 ring-[#ff570a]/30 dark:bg-[#3a2616]';
    return side === 'l' ? 'border-[#ffb782] bg-white font-extrabold text-[#c2410c] hover:bg-[#fff3eb] dark:bg-[#2a2018] dark:text-[#ffb782]' : 'border-[#d8e4f5] dark:border-white/15 bg-white font-medium text-stone-800 hover:bg-[#f3f7fd] dark:bg-[#1f2630] dark:text-white';
  };

  return (
    <>
      <StatsBar seconds={seconds} moves={moves} matched={matched.size} total={total} />
      <div className="grid w-full max-w-[640px] grid-cols-2 gap-x-4 gap-y-3">
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-3" role="group" aria-label={t(col === 0 ? 'game.match.terms' : 'game.match.defs')}>
            {(col === 0 ? left : right).map((p) => {
              const side: Side = col === 0 ? 'l' : 'r';
              const text = col === 0 ? p.term : p.definition;
              return (
                <button key={p.id} type="button" onClick={() => pick(side, p.id)} disabled={matched.has(p.id)} aria-pressed={picked?.side === side && picked.id === p.id} className={`${boardBtn} min-h-[64px] ${cls(side, p.id)}`}>
                  <span className="line-clamp-4 wrap-break-word">{text}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
