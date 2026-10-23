import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const MASCOT_MASK = 'url(/images/lesson/quiz-loading-mascot.svg)';

/**
 * Màn chờ trước khi vào làm trắc nghiệm (Figma node 193:4854): video linh vật + "Đang tải bài trắc nghiệm…".
 * Video chạy hết thì gọi `onEnded` để chuyển sang làm trắc nghiệm.
 */
export function QuizLoadingScreen({ onEnded }: { onEnded: () => void }) {
  const { t } = useTranslation('course');
  const ref = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(onEnded);
  useEffect(() => {
    endedRef.current = onEnded;
  });

  // Trình duyệt chặn tự phát (hiếm vì video tắt tiếng): không để người học kẹt ở màn chờ, vào thẳng trắc nghiệm.
  useEffect(() => {
    ref.current?.play().catch((e: unknown) => {
      console.warn('[quiz-intro] không tự phát được video chờ, bỏ qua và vào làm trắc nghiệm', e);
      endedRef.current();
    });
  }, []);

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex min-h-[420px] w-full max-w-[1300px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-[#fefefe] px-6 pt-6 pb-16 text-center shadow-[1px_6px_30px_2px_rgba(121,81,54,0.08)] dark:bg-[#1f1b18]"
    >
      {/* Video linh vật nền trắng, vầng mờ ở mép (mask) để hòa vào thẻ. */}
      <video
        ref={ref}
        src="/images/lesson/quiz-loading-mascot.mp4"
        muted
        autoPlay
        playsInline
        preload="auto"
        aria-hidden="true"
        onEnded={() => endedRef.current()}
        onError={() => {
          console.error('[quiz-intro] không tải được video chờ /images/lesson/quiz-loading-mascot.mp4, vào làm trắc nghiệm luôn');
          endedRef.current();
        }}
        className="aspect-video w-[374px] max-w-full object-cover"
        style={{ WebkitMaskImage: MASCOT_MASK, maskImage: MASCOT_MASK, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}
      />
      <h2 className="m-0 text-[clamp(20px,3vw,28px)] leading-[1.5] font-bold text-black dark:text-white">{t('lesson.test.loadingTitle')}</h2>
      <p className="m-0 max-w-[520px] text-[clamp(14px,2vw,20px)] leading-normal font-medium text-[#626262] dark:text-stone-300">{t('lesson.test.loadingSub')}</p>
    </section>
  );
}
