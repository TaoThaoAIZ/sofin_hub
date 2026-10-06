import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { SectionTitle } from '../components/ui/SectionTitle';

const CATEGORIES = [
  { key: 'account', count: 5 },
  { key: 'community', count: 5 },
  { key: 'billing', count: 4 },
  { key: 'support', count: 2 },
] as const;

const COMPONENTS = {
  privacy: <Link to="/privacy" className="font-semibold underline" />,
  terms: <Link to="/terms" className="font-semibold underline" />,
  mail: <a href="mailto:support@sofinhub.com" className="font-semibold underline" />,
};

export function FaqPage() {
  const { t } = useTranslation('legal');
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-[860px] px-4 pt-10 pb-16 md:px-10">
        <div className="text-center">
          <h1 className="m-0 text-[clamp(28px,3.4vw,44px)] font-extrabold tracking-[-1px]">{t('faq.title')}</h1>
          <p className="mt-3 text-base text-stone-600 text-pretty">
            <Trans ns="legal" i18nKey="faq.subtitle" components={COMPONENTS} />
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-8">
          {CATEGORIES.map((cat) => (
            <section key={cat.key} className="flex flex-col gap-3">
              <SectionTitle size="sm">{t(`faq.${cat.key}.title`)}</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: cat.count }, (_, j) => (
                  <FaqRow key={j} q={t(`faq.${cat.key}.q${j}`)} a={t(`faq.${cat.key}.a${j}`)} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="glass mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-6 text-center sm:text-left">
          <div>
            <div className="text-base font-bold">{t('faq.stillQuestion')}</div>
            <div className="mt-1 text-sm text-stone-600">{t('faq.teamReady')}</div>
          </div>
          <Link
            to="/contact"
            className="bg-brand-gradient shadow-brand flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            {t('faq.contactSupport')}
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-stone-500">
          <Trans ns="legal" i18nKey="faq.seeMore" components={COMPONENTS} />
        </p>
      </div>

      <Footer />
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-[16px] px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 border-0 bg-transparent p-0 text-left"
      >
        <span className="text-[15px] font-bold">{q}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-none text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="mt-2.5 text-sm leading-[1.6] text-stone-600 text-pretty">{a}</div>}
    </div>
  );
}
