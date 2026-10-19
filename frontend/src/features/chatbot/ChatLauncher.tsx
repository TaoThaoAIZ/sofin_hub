import { useEffect, useRef, useState } from 'react';

const HINT_FIRST_MS = 10_000;
const HINT_SHOW_MS = 30_000;

/**
 * Nút mở chatbot nổi góc phải: linh vật bồng bềnh phát sáng + bong bóng nhắc (hiện sau 10s, tự ẩn sau 30s rồi lặp lại).
 * Dùng chung cho trợ lý hỗ trợ (Tào) và trợ lý của cộng đồng.
 */
export function ChatLauncher({ onOpen, label, hint }: { onOpen: () => void; label: string; hint: string }) {
  const [showHint, setShowHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const schedule = (ms: number, show: boolean) => {
      timer.current = setTimeout(() => {
        if (!alive) return;
        setShowHint(show);
        schedule(show ? HINT_SHOW_MS : HINT_FIRST_MS, !show);
      }, ms);
    };
    schedule(HINT_FIRST_MS, true);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      {showHint && (
        <div className="mascot-hint pointer-events-none fixed right-4 bottom-[212px] z-[60] md:right-6 md:bottom-[136px]" role="status">
          <div className="relative max-w-[220px] overflow-hidden rounded-[20px] rounded-br-[6px] border border-brand/40 bg-white/95 px-5 py-3.5 text-right shadow-[0_12px_40px_rgba(255,87,10,.25)] backdrop-blur dark:bg-[#161616]/95">
            <span className="mascot-hint-shimmer pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,87,10,.18)_50%,transparent_65%)]" />
            <p className="relative m-0 text-[15.5px] leading-snug font-semibold text-brand">
              {hint.split(' ').map((w, i) => (
                <span key={i} className="mascot-hint-word" style={{ animationDelay: `${0.1 + i * 0.07}s, ${i * 0.1}s` }}>
                  {w}
                </span>
              ))}
            </p>
            <span className="absolute -bottom-[7px] right-5 size-[13px] rotate-45 border-r border-b border-brand/40 bg-white dark:bg-[#161616]" />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="fixed right-2 bottom-[96px] z-[60] size-[100px] cursor-pointer border-0 bg-transparent p-0 transition-transform active:scale-90 md:right-4 md:bottom-4"
      >
        <img src="/images/chatbot/mascot.png" alt="" width={100} height={100} className="mascot-float size-full object-contain" draggable={false} />
      </button>
    </>
  );
}
