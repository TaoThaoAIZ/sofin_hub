import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../../components/ui/MaterialIcon';
import type { GameKind, GamePair } from '../../types';

/** Mỗi bàn chơi nhận các cặp và báo lại kết quả khi xong; GamePlayer lo nộp lên server và hiện kết quả. */
export interface BoardProps {
  pairs: GamePair[];
  onFinish: (r: { moves: number; seconds: number }) => void;
}

export const GAME_ICON: Record<GameKind, string> = { memory: 'style', match: 'compare_arrows', swipe: 'swipe', scramble: 'spellcheck' };

export const shuffle = <T,>(list: T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Đồng hồ đếm giây, chỉ chạy khi `running`. */
export function useStopwatch(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return seconds;
}

/** Xong ván thì báo kết quả đúng một lần. */
export function useFinishOnce(done: boolean, moves: number, seconds: number, onFinish: BoardProps['onFinish']) {
  const sent = useRef(false);
  useEffect(() => {
    if (!done || sent.current) return;
    sent.current = true;
    onFinish({ moves, seconds });
  }, [done, moves, seconds, onFinish]);
}

/** Hẹn giờ có dọn khi bàn chơi bị gỡ (tránh setState sau khi rời trang). */
export function useTimeouts() {
  const ids = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => ids.current.forEach(clearTimeout), []);
  return (fn: () => void, ms: number) => {
    ids.current.push(setTimeout(fn, ms));
  };
}

export function StatsBar({ seconds, moves, matched, total }: { seconds: number; moves: number; matched: number; total: number }) {
  const { t } = useTranslation('course');
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 dark:bg-white/10';
  return (
    <div className="flex w-full max-w-[640px] items-center justify-between gap-3 text-[13.5px] font-semibold">
      <span className={chip}>
        <MaterialIcon name="timer" size={17} color="#ff570a" /> {fmtTime(seconds)}
      </span>
      <span className={chip}>
        <MaterialIcon name="touch_app" size={17} color="#ff570a" /> {t('game.moves', { n: moves })}
      </span>
      <span className={chip}>
        <MaterialIcon name="task_alt" size={17} color="#059669" /> {matched}/{total}
      </span>
    </div>
  );
}

export const boardBtn = 'cursor-pointer rounded-2xl border-2 px-3 py-3 text-center text-[13.5px] leading-snug transition-colors disabled:cursor-default';

/** Xếp từ cần ít nhất 2 mảnh khác nhau để xáo trộn được (khớp scrambleable ở backend game.service). */
export function scrambleable(term: string): boolean {
  const words = term.trim().split(/\s+/);
  const tiles = words.length > 1 ? words : Array.from(words[0] ?? '');
  return new Set(tiles.map((x) => x.toLowerCase())).size >= 2;
}
