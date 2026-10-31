import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useMarkOnboarding } from '../queries';
import type { Onboarding, OnboardingStepKey } from '../types';

/** Chỉ nhúng iframe từ các host video đã biết (BE đã dựng lại embedUrl từ ID hợp lệ; FE kiểm tra thêm lần nữa). */
const EMBED_PREFIXES = ['https://www.youtube.com/embed/', 'https://www.youtube-nocookie.com/embed/', 'https://player.vimeo.com/video/'];
const isSafeEmbed = (u?: string | null) => !!u && EMBED_PREFIXES.some((p) => u.startsWith(p));

/** Nơi tải ứng dụng/công cụ SofinHub. Đặt VITE_APP_DOWNLOAD_URL khi build để trỏ tới link cửa hàng ứng dụng; mặc định là trang Tải Tool. */
const APP_URL = (import.meta.env.VITE_APP_DOWNLOAD_URL as string | undefined) || '/tools';

const STEP_LABEL: Record<OnboardingStepKey, string> = { video: 'video', comment: 'comment', app: 'app' };

function Ring({ done, total }: { done: number; total: number }) {
  // Theo thiết kế: vòng ~92px, nét dày 12, tâm trắng, rãnh be nhạt, cung cam đầu tròn chạy từ 12 giờ theo chiều kim đồng hồ.
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="relative size-[92px] flex-none">
      <svg viewBox="0 0 92 92" className="size-full -rotate-90" aria-hidden>
        <circle cx="46" cy="46" r={r} strokeWidth="12" className="fill-white stroke-[#f1e9e3] dark:fill-transparent dark:stroke-white/20" />
        {pct > 0 && <circle cx="46" cy="46" r={r} fill="none" stroke="#ff570a" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset]" />}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[24px] font-extrabold tracking-tight text-stone-900">
        {done}/{total}
      </div>
    </div>
  );
}

/**
 * "Bắt đầu hành trình của bạn": vòng tiến độ n/total + checklist (xem video giới thiệu · bình luận một bài · tải ứng dụng).
 * Bước bình luận tính từ bình luận thật ở server; video/app lưu khi người dùng bấm.
 */
export function OnboardingCard({ communityId, data, onExplore }: { communityId: string; data: Onboarding; onExplore: () => void }) {
  const { t } = useTranslation('community');
  const mark = useMarkOnboarding(communityId);
  const [videoOpen, setVideoOpen] = useState(false);
  const left = data.total - data.done;

  useEffect(() => {
    if (!videoOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setVideoOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoOpen]);

  const act = (key: OnboardingStepKey) => {
    if (key === 'video') {
      setVideoOpen(true);
      mark.mutate('video');
    } else if (key === 'comment') {
      onExplore();
    } else {
      window.open(APP_URL, '_blank', 'noopener,noreferrer');
      mark.mutate('app');
    }
  };

  return (
    <section data-tour="onboarding" aria-label={t('onboarding.title')} className="relative overflow-hidden rounded-[24px] border border-brand/15 bg-gradient-to-br from-[#fff6ef] to-[#ffe6d4] p-6 max-sm:p-4 dark:border-[rgba(255,220,197,.1)] dark:from-[rgba(63,63,63,.3)] dark:to-[rgba(74,29,0,.3)]">
      <img src="/images/community-welcome-art.webp" alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-60 max-sm:hidden dark:hidden" />
      {/* Mobile (Figma): nền là ảnh tên lửa ic_bg_comunity, nằm ở góc phải dưới, danh sách bước co lại để không đè lên tên lửa. */}
      <img src="/images/community/ic_bg_comunity.png" alt="" className="pointer-events-none absolute inset-0 size-full object-cover object-right-bottom sm:hidden dark:opacity-40" />
      <div className="relative z-10">
        <h2 className="m-0 text-[24px] font-extrabold tracking-tight max-sm:text-[22px]">{t('onboarding.title')}</h2>
        <p className="mt-1 mb-4 max-w-[80%] text-[14px] text-stone-600 sm:max-w-none">{t('onboarding.sub', { count: left })}</p>
        <div className="flex items-center gap-6 max-sm:flex-col max-sm:items-stretch">
          <div className="flex flex-col items-center gap-2 max-sm:hidden">
            <Ring done={data.done} total={data.total} />
            <span className="text-[12.5px] text-stone-500">{t('onboarding.completed')}</span>
          </div>
          <ul className="m-0 flex min-w-0 w-full flex-1 list-none flex-col gap-2.5 p-0 pr-[20px] max-[900px]:pr-0 max-sm:w-[82%]">
            {data.steps.map((s) => (
              <li key={s.key} onClick={() => act(s.key)} className="flex items-center gap-3 rounded-2xl bg-white/90 dark:bg-white/[.07] px-3.5 py-2.5 shadow-[0_2px_8px_rgba(120,60,20,.06)] max-sm:cursor-pointer ">
                <span aria-hidden className={`grid size-6 flex-none place-items-center rounded-full ${s.done ? 'bg-brand' : 'border-[1.5px] border-stone-300 bg-white dark:border-white/40 dark:bg-transparent'}`}>
                  {s.done && <MaterialIcon name="check" size={16} color="#fff" weight={700} />}
                </span>
                <span className="sr-only">{s.done ? t('onboarding.done') : t('onboarding.todo')}</span>
                <span className="min-w-0 flex-1 text-[14px] leading-snug font-medium">{t(`onboarding.steps.${STEP_LABEL[s.key]}.title`)}</span>
                <button
                  type="button"
                  onClick={() => act(s.key)}
                  className={`h-9 flex-none rounded-xl px-4 text-[13.5px] font-bold max-sm:hidden ${s.done ? 'bg-[#e8e2dd] text-stone-700 hover:bg-[#ddd5ce] dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15' : 'border-[1.5px] border-brand bg-white text-brand hover:bg-brand-soft dark:bg-transparent'}`}
                >
                  {t(`onboarding.steps.${STEP_LABEL[s.key]}.${s.done ? 'again' : 'cta'}`)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {videoOpen && (
        <div role="dialog" aria-modal="true" aria-label={t('onboarding.steps.video.title')} className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-[860px] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            {isSafeEmbed(data.videoUrl) ? (
              <div className="aspect-video w-full">
                <iframe
                  src={data.videoUrl!}
                  title={t('onboarding.steps.video.title')}
                  className="size-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="m-0 p-10 text-center text-sm text-white">{t('onboarding.noVideo')}</p>
            )}
            <button type="button" onClick={() => setVideoOpen(false)} className="w-full bg-white py-2.5 text-sm font-semibold hover:bg-stone-50">
              {t('feed.close')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
