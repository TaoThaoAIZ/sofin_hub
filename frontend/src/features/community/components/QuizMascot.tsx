import { useEffect, useState } from 'react';

/** Tốc độ chữ chạy ra (ms mỗi ký tự). */
const TYPE_MS = 32;

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Chữ hiện dần từng ký tự (như bong bóng thoại của Duolingo); người tắt hiệu ứng chuyển động thì hiện đủ ngay. Dựng lại bằng `key` khi đổi câu. */
function TypedText({ text }: { text: string }) {
  const [n, setN] = useState(() => (prefersReducedMotion() ? text.length : 0));
  useEffect(() => {
    if (n >= text.length) return;
    const id = setTimeout(() => setN((c) => c + 1), TYPE_MS);
    return () => clearTimeout(id);
  }, [n, text]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span aria-hidden="true" className="quiz-caret" />}
    </>
  );
}

/**
 * Linh vật + bong bóng thoại ở đầu bài trắc nghiệm: vào là linh vật nhún nhảy xuất hiện, bong bóng bật ra và chữ chạy từng ký tự.
 * `mood` đổi (đúng/sai/câu mới) thì linh vật nhảy một nhịp và câu thoại mới chạy lại.
 */
export function QuizMascot({ message, mood }: { message: string; mood: string }) {
  return (
    <div className="flex items-end gap-3">
      <div className="quiz-mascot-in flex-none">
        <img key={mood} src="/images/lesson/quiz-mascot.png" alt="" width={171} height={114} className="quiz-mascot-bob h-[76px] w-auto select-none max-sm:h-[60px]" draggable={false} />
      </div>
      <div className="quiz-bubble-pop relative mb-2 min-w-0 flex-1 rounded-2xl border-2 border-[#ffd9bd] bg-white px-4 py-3 text-[15px] leading-snug font-bold text-[#3b2a1f] dark:border-[#4a4f55] dark:bg-[#2b2f33] dark:text-white">
        <span aria-hidden="true" className="absolute bottom-3 -left-[9px] size-4 rotate-45 border-b-2 border-l-2 border-[#ffd9bd] bg-white dark:border-[#4a4f55] dark:bg-[#2b2f33]" />
        {/* Chữ đầy đủ (ẩn, giữ chỗ để bong bóng không nhảy chiều cao) + chữ đang chạy; đọc màn hình đọc câu đủ. */}
        <span className="invisible block" aria-hidden="true">{message}</span>
        <span className="absolute inset-0 px-4 py-3" aria-hidden="true">
          <TypedText key={message} text={message} />
        </span>
        <span role="status" className="sr-only">{message}</span>
      </div>
    </div>
  );
}
