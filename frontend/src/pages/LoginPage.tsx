import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { SOCIAL_LOGIN_ENABLED, SocialButtons } from '../features/auth/SocialButtons';
import { validateEmail, validateLoginPassword } from '../features/auth/validation';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { t } = useTranslation('auth');
  const { login, completeTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Tài khoản bật 2FA: sau khi đúng mật khẩu, nhập mã 6 số của ứng dụng xác thực.
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const clearFieldError = (key: keyof FieldErrors) =>
    setFieldErrors((f) => (f[key] ? { ...f, [key]: undefined } : f));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {
      email: validateEmail(email) ?? undefined,
      password: validateLoginPassword(password) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await login({ email, password });
      if ('twoFactorRequired' in result) {
        setTicket(result.ticket);
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // Chưa xác thực email: server đã gửi lại OTP, đưa người dùng sang màn nhập mã.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        navigate(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`, { state: { from: redirectTo, resendInSec: 60 } });
        return;
      }
      setError(err instanceof ApiError ? err.message : t('login.fail'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    if (code.replace(/D/g, '').length !== 6) {
      setError(t('login.enter6'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeTwoFactor(ticket, code);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.verifyFail'));
      // Vé hết hạn: quay lại bước nhập mật khẩu.
      if (err instanceof ApiError && err.status === 401 && /hết hạn, vui lòng đăng nhập lại/.test(err.message)) setTicket(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-wrap items-center justify-between gap-10 overflow-hidden px-6 py-12 sm:px-10 md:px-[8vw] lg:py-[7vh]"
      style={{ background: "url('/images/background_login.png') center / cover no-repeat" }}
    >
      <div className="pointer-events-none relative z-10 flex min-w-0 max-w-[640px] flex-1 basis-[460px] flex-col gap-6 self-start">
        {/* <Link to="/" className="pointer-events-auto block self-start leading-none">
          <img src="/images/logo.png" alt="SofinHub" className="h-9 w-auto" />
        </Link>
        <div>
          <h1 className="m-0 text-[clamp(38px,5.2vw,86px)] leading-[1.08] font-extrabold tracking-[-2.5px] text-balance">
            Cộng đồng
            <br />
            <span className="text-brand">AI thực chiến</span>
          </h1>
          <p className="mt-4 max-w-[540px] text-[clamp(16px,1.5vw,24px)] leading-[1.45] text-stone-600 text-pretty">
            Học theo lộ trình, thực hành trên công việc thật và kết nối với những người cùng mục tiêu.
          </p>
        </div> */}
      </div>

      <div className="relative z-10 flex min-w-[min(100%,380px)] flex-1 basis-[630px] flex-col gap-[22px] rounded-[28px] border border-white/95 bg-white/70 p-6 shadow-[0_30px_70px_rgba(120,60,20,.12)] backdrop-blur-[26px] backdrop-saturate-[180%] sm:p-10 md:p-[clamp(28px,4vw,60px)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/images/logo.png" alt="SofinHub" className="mb-1 h-11 w-auto" />
          <h2 className="m-0 text-[clamp(26px,2.4vw,34px)] font-bold tracking-[-.5px]">{t('login.welcome')}</h2>
          <p className="m-0 max-w-[380px] text-base leading-[1.6] text-stone-600 text-pretty">
            {t('login.intro')}
          </p>
        </div>

        {ticket ? (
          <form onSubmit={submitCode} noValidate className="mt-2 flex flex-col gap-4">
            <p className="m-0 text-center text-[15px] text-stone-600">{t('login.codeHint')}</p>
            <FormField type="text" autoComplete="one-time-code" value={code} onChange={setCode} placeholder={t('login.codePlaceholder')} />
            {error && (
              <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                {error}
              </div>
            )}
            <Button type="submit" disabled={submitting} className="h-[60px] gap-2.5 rounded-2xl text-lg font-bold">
              {submitting ? t('login.verifying') : t('login.verify')}
            </Button>
            <button
              type="button"
              onClick={() => {
                setTicket(null);
                setCode('');
                setError(null);
              }}
              className="border-0 bg-transparent text-[15px] font-medium text-stone-600"
            >
              {t('login.back')}
            </button>
          </form>
        ) : (
        <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-4">
          <FormField
            type="email"
            autoComplete="email"
            maxLength={180}
            value={email}
            onChange={(v) => {
              setEmail(v);
              clearFieldError('email');
            }}
            placeholder={t('login.emailPlaceholder')}
            error={fieldErrors.email}
          />

          <FormField
            type="password"
            autoComplete="current-password"
            maxLength={200}
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearFieldError('password');
            }}
            placeholder={t('login.passwordPlaceholder')}
            error={fieldErrors.password}
          />

          <Link to="/forgot-password" className="self-end text-[15px] font-medium">
            {t('login.forgot')}
          </Link>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="h-[60px] gap-2.5 rounded-2xl text-lg font-bold">
            {submitting ? t('login.signingIn') : t('login.submit')}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Button>
        </form>
        )}

        {SOCIAL_LOGIN_ENABLED && (
          <>
            <div className="flex items-center gap-4 text-[15px] text-stone-500">
              <span className="h-px flex-1 bg-[rgba(120,60,20,.14)]" />
              {t('login.orWith')}
              <span className="h-px flex-1 bg-[rgba(120,60,20,.14)]" />
            </div>

            <SocialButtons />
          </>
        )}

        <div className="text-center text-[15px] text-stone-700">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="font-bold">
            {t('login.register')}
          </Link>
        </div>
      </div>
    </div>
  );
}
