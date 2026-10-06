import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

/** Bọc trang cần đăng nhập: chưa đăng nhập → /login (kèm state.from để quay lại sau khi đăng nhập). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth');
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <p className="py-24 text-center text-stone-500">{t('loading')}</p>;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
