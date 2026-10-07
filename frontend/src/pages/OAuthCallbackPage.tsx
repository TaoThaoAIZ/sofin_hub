import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { clearReferralCode } from '../features/referral/storage';
import { AuthShell } from '../features/account/components/AuthShell';
import { Alert } from '../features/account/components/Field';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'twoFactor'; ticket: string };

/**
 * Điểm đến sau khi đăng nhập Google/Facebook. Backend chuyển về đây kèm:
 *  - không có hash: phiên đã được đặt qua cookie refresh => lấy access token;
 *  - #error=<mã>: thất bại/hủy;
 *  - #ticket=<vé>: tài khoản bật 2FA => nhập mã 6 số.
 */
export function OAuthCallbackPage() {
  const { t } = useTranslation('auth');
  const { completeSocialLogin, completeTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const started = useRef(false);

  // Refresh token xoay vòng, dùng 1 lần: chỉ chạy đúng 1 lần dù StrictMode gọi effect hai lần.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Xóa hash (có thể chứa vé 2FA) khỏi thanh địa chỉ / lịch sử ngay.
    window.history.replaceState(null, '', window.location.pathname);
    const error = hash.get('error');
    const ticket = hash.get('ticket');
    if (error) {
      setState({ kind: 'error', message: t(`oauth.errors.${error}`, { defaultValue: t('oauth.errors.failed') }) });
    } else if (ticket) {
      setState({ kind: 'twoFactor', ticket });
    } else {
      completeSocialLogin()
        .then(() => {
          clearReferralCode();
          navigate('/', { replace: true });
        })
        .catch(() => setState({ kind: 'error', message: t('login.socialFail') }));
    }
  }, [completeSocialLogin, navigate, t]);

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (state.kind !== 'twoFactor') return;
    if (code.replace(/\D/g, '').length !== 6) {
      setCodeError(t('login.enter6'));
      return;
    }
    setSubmitting(true);
    setCodeError(null);
    try {
      await completeTwoFactor(state.ticket, code);
      clearReferralCode();
      navigate('/', { replace: true });
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : t('login.verifyFail'));
      if (err instanceof ApiError && err.status === 401 && /hết hạn, vui lòng đăng nhập lại/.test(err.message)) {
        setState({ kind: 'error', message: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title={t('oauth.title')}>
      {state.kind === 'loading' && <p className="m-0 text-center text-stone-500">{t('oauth.loading')}</p>}
      {state.kind === 'error' && (
        <>
          <Alert kind="error">{state.message}</Alert>
          <Link to="/login" className="text-center font-bold">
            {t('oauth.back')}
          </Link>
        </>
      )}
      {state.kind === 'twoFactor' && (
        <form onSubmit={submitCode} noValidate className="flex flex-col gap-4">
          <p className="m-0 text-center text-[15px] text-stone-600">{t('login.codeHint')}</p>
          <FormField type="text" autoComplete="one-time-code" value={code} onChange={setCode} placeholder={t('login.codePlaceholder')} />
          {codeError && <Alert kind="error">{codeError}</Alert>}
          <Button type="submit" disabled={submitting} className="h-[56px] rounded-2xl text-lg font-bold">
            {submitting ? t('login.verifying') : t('login.verify')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
