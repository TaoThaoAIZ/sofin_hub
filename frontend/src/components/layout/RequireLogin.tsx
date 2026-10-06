import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { ButtonLink } from '../ui/Button';
import { Header } from './Header';

/** Bọc các trang cần đăng nhập: hiện Header + thông báo (thay vì chuyển hướng cứng) khi chưa đăng nhập. */
export function RequireLogin({ children, active = 'discover' }: { children: ReactNode; active?: string }) {
  const { t } = useTranslation('layout');
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'authenticated') return <>{children}</>;
  return (
    <div className="min-h-screen bg-white">
      <Header active={active} />
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        {status === 'loading' ? (
          <p className="text-stone-500">{t('requireLogin.loading')}</p>
        ) : (
          <>
            <p className="text-stone-600">{t('requireLogin.message')}</p>
            <ButtonLink to="/login" state={{ from: location.pathname + location.search }} className="mt-5 h-10 rounded-[14px] px-[18px] text-sm font-semibold">
              {t('requireLogin.login')}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
