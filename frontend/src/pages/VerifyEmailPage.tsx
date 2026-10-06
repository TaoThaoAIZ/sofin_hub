import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../components/ui/Button';
import { ApiError } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { verifyEmail } from '../features/auth/api';
import { AuthShell } from '../features/account/components/AuthShell';
import { Alert } from '../features/account/components/Field';

type State = { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string };

export function VerifyEmailPage() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { status, user, updateUser } = useAuth();
  const [state, setState] = useState<State>(token ? { kind: 'loading' } : { kind: 'error', message: t('verify.missingToken') });
  const started = useRef(false);

  // Token dùng 1 lần: chỉ gọi đúng 1 lần dù StrictMode chạy effect hai lần.
  useEffect(() => {
    if (!token || status === 'loading' || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then((verified) => {
        // Nếu đang đăng nhập đúng tài khoản này thì cập nhật cờ emailVerified
        if (user && user.id === verified.id) updateUser(verified);
        setState({ kind: 'ok' });
      })
      .catch((err) => {
        setState({ kind: 'error', message: err instanceof ApiError ? err.message : t('verify.fail') });
      });
  }, [token, status, user, updateUser, t]);

  return (
    <AuthShell title={t('verify.title')}>
      {state.kind === 'loading' && <p className="m-0 text-center text-stone-500">{t('verify.loading')}</p>}
      {state.kind === 'ok' && (
        <>
          <Alert kind="success">{t('verify.success')}</Alert>
          <ButtonLink to={status === 'authenticated' ? '/' : '/login'} className="h-[52px] rounded-2xl text-base font-bold">
            {status === 'authenticated' ? t('verify.home') : t('verify.signIn')}
          </ButtonLink>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <Alert kind="error">{state.message}</Alert>
          <p className="m-0 text-center text-sm text-stone-600">
            {t('verify.expiredHint')}
          </p>
          <ButtonLink to="/settings" className="h-[52px] rounded-2xl text-base font-bold">
            {t('verify.openSettings')}
          </ButtonLink>
        </>
      )}
    </AuthShell>
  );
}
