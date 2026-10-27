import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GamePair } from '../../types';
import { shuffle, StatsBar, boardBtn, useFinishOnce, useStopwatch, useTimeouts, type BoardProps } from './shared';

const OK_MS = 700;
const BAD_MS = 800;

interface Tile {
  id: number;
  text: string;
}

const squash = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');

/** Nhiều từ => xáo các từ; một từ => xáo các chữ cái. */
function splitTerm(term: string): { tiles: string[]; joiner: string } {
  const words = squash(term).split(' ');
  return words.length > 1 ? { tiles: words, joiner: ' ' } : { tiles: Array.from(words[0]!), joiner: '' };
}

/** Xáo các mảnh sao cho khác thứ tự gốc (thử vài lần; từ không xáo khác được thì chịu). */
function scramble(term: string): { tiles: Tile[]; joiner: string } {
  const { tiles, joiner } = splitTerm(term);
  const original = tiles.join(joiner);
  const base = tiles.map((text, id) => ({ id, text }));
  let out = shuffle(base);
  for (let i = 0; i < 20 && out.map((x) => x.text).join(joiner) === original; i++) out = shuffle(base);
  return { tiles: out, joiner };
}

/** Xếp từ: đọc gợi ý, bấm các mảnh theo đúng thứ tự để ghép lại thuật ngữ. Mỗi lần xếp xong ô là một lượt. */
export function ScrambleBoard({ pairs, onFinish }: BoardProps) {
  const [order] = useState(() => shuffle(pairs));
  const [idx, setIdx] = useState(0);
  const [solved, setSolved] = useState(0);
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const total = pairs.length;
  const done = solved === total;
  const seconds = useStopwatch(started && !done);
  useFinishOnce(done, moves, seconds, onFinish);
  const pair = order[idx];

  return (
    <>
      <StatsBar seconds={seconds} moves={moves} matched={solved} total={total} />
      {pair && !done && (
        <Round
          key={pair.id}
          pair={pair}
          onStart={() => setStarted(true)}
          onAttempt={() => setMoves((m) => m + 1)}
          onSolved={() => {
            setSolved((s) => s + 1);
            setIdx((i) => i + 1);
          }}
        />
      )}
    </>
  );
}

function Round({ pair, onStart, onAttempt, onSolved }: { pair: GamePair; onStart: () => void; onAttempt: () => void; onSolved: () => void }) {
  const { t } = useTranslation('course');
  const { tiles, joiner } = useMemo(() => scramble(pair.term), [pair.term]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'ok' | 'bad'>('idle');
  const later = useTimeouts();
  const text = (id: number) => tiles.find((x) => x.id === id)!.text;
  const target = squash(pair.term).toLowerCase();

  const place = (id: number) => {
    if (status !== 'idle' || placed.includes(id)) return;
    onStart();
    const next = [...placed, id];
    setPlaced(next);
    if (next.length < tiles.length) return;
    const ok = next.map(text).join(joiner).toLowerCase() === target;
    onAttempt();
    setStatus(ok ? 'ok' : 'bad');
    later(
      () => {
        if (ok) return onSolved();
        setStatus('idle');
        setPlaced([]);
      },
      ok ? OK_MS : BAD_MS,
    );
  };

  const slot = status === 'ok' ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100' : status === 'bad' ? 'animate-pulse border-red-400 bg-red-50 text-red-900 dark:bg-red-500/20 dark:text-red-100' : 'border-[#ffb782] bg-white text-[#c2410c] dark:bg-[#2a2018] dark:text-[#ffb782]';

  return (
    <div className="flex w-full max-w-[640px] flex-col items-center gap-5 rounded-3xl bg-white/80 p-5 dark:bg-white/5">
      <div className="text-center">
        <div className="text-[12px] font-bold tracking-wide text-stone-500 uppercase">{t('game.scramble.hintLabel')}</div>
        <p className="m-0 mt-1 text-[16px] leading-snug font-medium wrap-break-word text-stone-800 dark:text-white">{pair.definition}</p>
      </div>

      <div className="flex min-h-[56px] flex-wrap justify-center gap-2" aria-label={t('game.scramble.answer')} role="group">
        {tiles.map((_, i) => {
          const id = placed[i];
          return id === undefined ? (
            <span key={i} className="grid h-12 min-w-12 place-items-center rounded-xl border-2 border-dashed border-stone-300 dark:border-white/20" />
          ) : (
            <button key={i} type="button" disabled={status !== 'idle'} onClick={() => setPlaced((p) => p.filter((x) => x !== id))} className={`${boardBtn} h-12 min-w-12 px-3 py-0 text-[18px] font-extrabold ${slot}`}>
              {text(id)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2" aria-label={t('game.scramble.pool')} role="group">
        {tiles.map((tile) => {
          const used = placed.includes(tile.id);
          return (
            <button key={tile.id} type="button" disabled={used || status !== 'idle'} onClick={() => place(tile.id)} className={`${boardBtn} h-12 min-w-12 border-[#d8e4f5] dark:border-white/15 bg-white px-3 py-0 text-[18px] font-extrabold text-stone-800 hover:bg-[#f3f7fd] disabled:opacity-30 dark:bg-[#1f2630] dark:text-white`}>
              {tile.text}
            </button>
          );
        })}
      </div>

      <button type="button" disabled={placed.length === 0 || status !== 'idle'} onClick={() => setPlaced([])} className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-semibold text-stone-500 underline hover:text-brand disabled:cursor-default disabled:no-underline disabled:opacity-40">
        {t('game.scramble.clear')}
      </button>
    </div>
  );
}
