import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../../components/ui/MaterialIcon';
import type { GamePair } from '../../types';
import { shuffle, StatsBar, useFinishOnce, useStopwatch, useTimeouts, type BoardProps } from './shared';

interface Statement {
  pairId: string;
  term: string;
  shown: string;
  truth: boolean;
  /** Định nghĩa đúng của thuật ngữ (hiện khi trả lời sai). */
  answer: string;
}

const OK_MS = 450;
const BAD_MS = 1500;
/** Kéo thẻ quá ngưỡng này (px) thì tính là trả lời. */
const SWIPE_PX = 90;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Một mệnh đề: khoảng nửa số lần ghép đúng định nghĩa, còn lại ghép với định nghĩa của cặp khác. */
function makeStatement(pair: GamePair, pairs: GamePair[]): Statement {
  const others = pairs.filter((p) => p.id !== pair.id && !same(p.definition, pair.definition));
  const truth = others.length === 0 || Math.random() < 0.5;
  const shown = truth ? pair.definition : others[Math.floor(Math.random() * others.length)]!.definition;
  return { pairId: pair.id, term: pair.term, shown, truth, answer: pair.definition };
}

/** Đúng / Sai: thuật ngữ đi kèm một định nghĩa, chọn Đúng hay Sai (bấm nút, phím mũi tên hoặc vuốt thẻ). Trả lời sai thì thẻ quay lại cuối hàng. */
export function SwipeBoard({ pairs, onFinish }: BoardProps) {
  const { t } = useTranslation('course');
  const [queue, setQueue] = useState<Statement[]>(() => shuffle(pairs).map((p) => makeStatement(p, pairs)));
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragX = useRef(0);
  const later = useTimeouts();
  const total = pairs.length;
  const done = queue.length === 0;
  const matched = total - new Set(queue.map((s) => s.pairId)).size;
  const seconds = useStopwatch(started && !done);
  useFinishOnce(done, moves, seconds, onFinish);
  const current = queue[0];

  const answer = (sayTrue: boolean) => {
    if (!current || feedback) return;
    setStarted(true);
    setMoves((m) => m + 1);
    const ok = sayTrue === current.truth;
    setFeedback({ ok, text: ok ? t('game.swipe.right') : current.truth ? t('game.swipe.wasTrue') : t('game.swipe.wasFalse', { answer: current.answer }) });
    later(() => {
      setFeedback(null);
      setDx(0);
      setQueue((q) => {
        const [head, ...rest] = q;
        if (ok || !head) return rest;
        const pair = pairs.find((p) => p.id === head.pairId)!;
        return [...rest, makeStatement(pair, pairs)];
      });
    }, ok ? OK_MS : BAD_MS);
  };

  // Phím mũi tên phải = Đúng, trái = Sai.
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowRight') answerRef.current(true);
      else if (e.key === 'ArrowLeft') answerRef.current(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const border = feedback ? (feedback.ok ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/20' : 'border-red-400 bg-red-50 dark:bg-red-500/20') : 'border-[#ffd2b3] bg-white dark:bg-[#26211d]';
  const lean = dx > 30 ? 'right' : dx < -30 ? 'left' : null;
  const btn = 'inline-flex h-14 min-w-[140px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-5 text-[16px] font-extrabold disabled:cursor-default disabled:opacity-60';

  return (
    <>
      <StatsBar seconds={seconds} moves={moves} matched={matched} total={total} />
      {current && (
        <div className="flex w-full max-w-[460px] flex-col items-center gap-4">
          <div
            role="group"
            aria-live="polite"
            className={`relative w-full touch-pan-y select-none rounded-3xl border-2 p-6 text-center shadow-[0_8px_24px_rgba(121,81,54,0.12)] transition-colors ${border} ${dragging ? '' : 'transition-transform'}`}
            style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, cursor: feedback ? 'default' : 'grab' }}
            onPointerDown={(e) => {
              if (feedback) return;
              dragX.current = e.clientX;
              setDragging(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (dragging) setDx(e.clientX - dragX.current);
            }}
            onPointerUp={() => {
              if (!dragging) return;
              const moved = dx;
              setDragging(false);
              if (Math.abs(moved) >= SWIPE_PX) answer(moved > 0);
              else setDx(0);
            }}
            onPointerCancel={() => {
              setDragging(false);
              setDx(0);
            }}
          >
            <span className={`absolute top-3 left-4 rounded-full border-2 border-red-400 px-3 py-0.5 text-[13px] font-extrabold text-red-500 transition-opacity ${lean === 'left' ? 'opacity-100' : 'opacity-0'}`}>{t('game.swipe.false')}</span>
            <span className={`absolute top-3 right-4 rounded-full border-2 border-emerald-500 px-3 py-0.5 text-[13px] font-extrabold text-emerald-600 transition-opacity ${lean === 'right' ? 'opacity-100' : 'opacity-0'}`}>{t('game.swipe.true')}</span>
            <div className="mt-4 text-[12px] font-bold tracking-wide text-[#c2410c] uppercase">{t('game.swipe.term')}</div>
            <div className="mt-1 text-[clamp(20px,3.2vw,26px)] font-extrabold text-[#c2410c] wrap-break-word dark:text-[#ffb782]">{current.term}</div>
            <div className="my-3 text-[18px] font-bold text-stone-400">=</div>
            <div className="text-[12px] font-bold tracking-wide text-stone-500 uppercase">{t('game.swipe.def')}</div>
            <div className="mt-1 min-h-[52px] text-[16px] leading-snug font-medium wrap-break-word text-stone-800 dark:text-white">{current.shown}</div>
            <div role="status" className={`mt-3 min-h-[22px] text-[13.5px] font-bold ${feedback?.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
              {feedback?.text}
            </div>
          </div>
          <div className="flex w-full justify-center gap-4">
            <button type="button" disabled={!!feedback} onClick={() => answer(false)} className={`${btn} border-red-300 bg-white text-red-600 hover:bg-red-50 dark:bg-transparent`}>
              <MaterialIcon name="close" size={22} color="currentColor" /> {t('game.swipe.false')}
            </button>
            <button type="button" disabled={!!feedback} onClick={() => answer(true)} className={`${btn} border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-600`}>
              <MaterialIcon name="check" size={22} color="#fff" /> {t('game.swipe.true')}
            </button>
          </div>
          <p className="m-0 text-[12px] text-stone-500 max-sm:hidden">{t('game.swipe.keys')}</p>
        </div>
      )}
    </>
  );
}
