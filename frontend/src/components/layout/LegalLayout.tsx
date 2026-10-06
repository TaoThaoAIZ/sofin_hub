import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../ui/Button';
import { SectionTitle } from '../ui/SectionTitle';

/**
 * Layout riêng cho trang pháp lý trong flow đăng ký (không dùng Header/Footer của trang chủ).
 * Theo dõi khi người dùng cuộn tới cuối nội dung để đánh dấu "đã đọc" (dùng cho checkbox đồng ý ở trang Đăng ký).
 */
export function LegalLayout({
  title,
  updatedAt,
  onRead,
  children,
}: {
  title: string;
  updatedAt: string;
  onRead: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('layout');
  const [reachedBottom, setReachedBottom] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReachedBottom(true);
          onRead();
        }
      },
      { threshold: 1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onRead]);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(800px 600px at 10% 80%, rgba(255,160,100,.35), transparent 70%), radial-gradient(700px 500px at 90% 10%, rgba(255,200,160,.3), transparent 70%), linear-gradient(135deg, #fff7f1 0%, #fff 50%, #fff4ec 100%)',
      }}
    >
      <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 md:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="block leading-none">
            <img src="/images/logo.png" alt="SofinHub" className="h-9 w-auto" />
          </Link>
          <Link
            to="/register"
            className="glass flex h-10 items-center gap-2 rounded-[14px] px-4 text-sm font-medium hover:brightness-[1.03]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            {t('legal.backToRegister')}
          </Link>
        </div>

        <h1 className="mt-8 text-[clamp(28px,3.4vw,44px)] font-extrabold tracking-[-1px]">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">{t('legal.updatedAt', { date: updatedAt })}</p>

        <div className="mt-8 flex flex-col gap-8 rounded-[26px] border border-white/95 bg-white/70 p-6 shadow-[0_20px_50px_rgba(120,60,20,.1)] backdrop-blur-[24px] sm:p-10">
          {children}
          <div ref={sentinelRef} aria-hidden="true" />
        </div>

        <div className="sticky bottom-4 mt-6 flex justify-center">
          {reachedBottom ? (
            <ButtonLink to="/register" className="h-12 gap-2 rounded-2xl px-6 text-[15px] font-bold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
              {t('legal.doneReading')}
            </ButtonLink>
          ) : (
            <div className="glass flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-medium text-stone-600">
              {t('legal.scrollToConfirm')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle size="sm">{title}</SectionTitle>
      <div className="flex flex-col gap-3 text-[15px] leading-[1.75] text-stone-600 text-pretty">{children}</div>
    </section>
  );
}
