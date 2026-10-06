import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../components/ui/Button';

export function NotFoundPage() {
  const { t } = useTranslation('misc');
  return (
    <main className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-extrabold text-brand">404</p>
        <p className="mt-3 text-stone-600">{t('notFound.message')}</p>
        <ButtonLink to="/" className="mt-6 h-10 rounded-[14px] px-[18px] text-sm font-semibold">
          {t('notFound.home')}
        </ButtonLink>
      </div>
    </main>
  );
}
