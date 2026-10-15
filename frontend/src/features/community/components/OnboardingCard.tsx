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
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="relative size-[116px] flex-none">
      <svg viewBox="0 0 116 116" className="size-full -rotate-90" aria-hidden>
        <circle cx="58" cy="58" r={r} fill="#fff" stroke="rgba(120,60,20,.1)" strokeWidth="11" />
        <circle cx="58" cy="58" r={r} fill="none" stroke="#f26a1b" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset]" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[28px] font-extrabold tracking-tight">
        {done}/{total}
      </div>
    </div>
  );
}

/** Minh họa tên lửa: dùng ảnh /images/community-onboarding-rocket.webp nếu có, không thì vẽ SVG đơn giản. */
function RocketArt() {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return <img src="/images/community-onboarding-rocket.webp" alt="" onError={() => setBroken(true)} className="pointer-events-none absolute right-2 bottom-0 h-[170px] w-auto max-[900px]:hidden" />;
  }
  return (
    <svg viewBox="0 0 160 170" aria-hidden className="pointer-events-none absolute right-4 bottom-2 h-[150px] w-auto max-[900px]:hidden">
      <ellipse cx="82" cy="150" rx="62" ry="16" fill="#fff" opacity=".85" />
      <ellipse cx="50" cy="146" rx="34" ry="14" fill="#fff" opacity=".9" />
      <g transform="rotate(30 80 80)">
        <path d="M80 12c22 18 30 44 26 78H54c-4-34 4-60 26-78z" fill="#fff" stroke="#fdba74" strokeWidth="2" />
        <circle cx="80" cy="56" r="11" fill="#f26a1b" />
        <circle cx="80" cy="56" r="5" fill="#fff" />
        <path d="M54 76L36 100l22-6zM106 76l18 24-22-6z" fill="#f26a1b" />
        <path d="M68 92h24l-12 28z" fill="#fdba74" />
      </g>
      <path d="M118 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f26a1b" />
    </svg>
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
    <section aria-label={t('onboarding.title')} className="relative overflow-hidden rounded-[24px] border border-brand/15 bg-gradient-to-br from-[#fff6ef] to-[#ffe6d4] p-6">
      <img src="/images/community-welcome-art.webp" alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-60" />
      <div className="relative z-10">
        <h2 className="m-0 text-[24px] font-extrabold tracking-tight">{t('onboarding.title')}</h2>
        <p className="mt-1 mb-4 text-[14px] text-stone-600">{t('onboarding.sub', { count: left })}</p>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Ring done={data.done} total={data.total} />
            <span className="text-[12.5px] text-stone-500">{t('onboarding.completed')}</span>
          </div>
          <ul className="m-0 flex min-w-[260px] max-w-[460px] flex-1 list-none flex-col gap-2.5 p-0 pr-[170px] max-[900px]:pr-0">
            {data.steps.map((s) => (
              <li key={s.key} className="flex items-center gap-3 rounded-2xl bg-white/90 px-3.5 py-2.5 shadow-[0_6px_18px_rgba(120,60,20,.08)]">
                <span aria-hidden className={`grid size-6 flex-none place-items-center rounded-full ${s.done ? 'bg-brand' : 'border-[1.5px] border-stone-300 bg-white'}`}>
                  {s.done && <MaterialIcon name="check" size={16} color="#fff" weight={700} />}
                </span>
                <span className="sr-only">{s.done ? t('onboarding.done') : t('onboarding.todo')}</span>
                <span className="min-w-0 flex-1 text-[14px] leading-snug font-medium">{t(`onboarding.steps.${STEP_LABEL[s.key]}.title`)}</span>
                <button
                  type="button"
                  onClick={() => act(s.key)}
                  className={`h-9 flex-none rounded-xl px-4 text-[13.5px] font-bold ${s.done ? 'bg-stone-200 text-stone-700 hover:bg-stone-300' : 'border-[1.5px] border-brand bg-white text-brand hover:bg-brand-soft'}`}
                >
                  {t(`onboarding.steps.${STEP_LABEL[s.key]}.${s.done ? 'again' : 'cta'}`)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <RocketArt />

      {videoOpen && (
        <div role="dialog" aria-modal="true" aria-label={t('onboarding.steps.video.title')} className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => setVideoOpen(false)}>
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
