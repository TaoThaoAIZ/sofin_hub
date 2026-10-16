import { BrandLogo } from '../../components/ui/BrandLogo';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';
import { ButtonLink } from '../ui/Button';
import { SectionTitle } from '../ui/SectionTitle';

/**
 * Trang pháp lý có 2 chế độ:
 *  - Mở từ form Đăng ký (`?from=register`): layout riêng, theo dõi cuộn tới cuối để đánh dấu "đã đọc" (checkbox đồng ý) + nút quay lại đăng ký.
 *  - Mở từ nơi khác (Footer, FAQ…): chỉ để đọc, dùng Header/Footer chung, không có nút đồng ý.
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
  const consentMode = useSearchParams()[0].get('from') === 'register';
  const [reachedBottom, setReachedBottom] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!consentMode || !el) return;
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
  }, [onRead, consentMode]);

  if (!consentMode) {
    return (
      <div className="page-warm-bg min-h-screen">
        <Header />
        <div className="mx-auto max-w-[760px] px-4 pt-10 pb-16 sm:px-6">
          <h1 className="m-0 text-[clamp(28px,3.4vw,44px)] font-extrabold tracking-[-1px]">{title}</h1>
          <p className="mt-2 text-sm text-stone-500">{t('legal.updatedAt', { date: updatedAt })}</p>
          <div className="mt-8 flex flex-col gap-8">{children}</div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
    >
      <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 md:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="block leading-none">
            <BrandLogo className="h-9" />
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
