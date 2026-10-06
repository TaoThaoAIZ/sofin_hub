import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const LEGAL = [
  { key: 'terms', to: '/terms' },
  { key: 'privacy', to: '/privacy' },
  { key: 'cookie', to: '/privacy' },
] as const;

export function Footer() {
  const { t } = useTranslation('layout');
  return (
    <footer>
      <div className="rounded-t-[32px] border border-b-0 border-white/90 bg-white/55 px-4 py-6 shadow-[0_-10px_40px_rgba(120,60,20,.08)] backdrop-blur-[24px] backdrop-saturate-[180%] md:px-[max(40px,calc((100%-1320px)/2))]">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-stone-500">
          <span>{t('footer.copyright')}</span>
          <div className="flex flex-wrap gap-6">
            {LEGAL.map((l) => (
              <Link key={l.key} to={l.to} className="text-stone-500 hover:text-brand">
                {t(`footer.${l.key}`)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
