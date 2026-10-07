import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ApiError } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { clearReferralCode, readReferralCode } from '../features/referral/storage';
import { AuthShell } from '../features/account/components/AuthShell';
import { Alert } from '../features/account/components/Field';

const LENGTH = 6;
const DEFAULT_COOLDOWN = 60;
const DRAFT_KEY = 'sofinhub_register_draft';

interface LocationState {
  resendInSec?: number;
  emailSent?: boolean;
  from?: string;
}

/** Bước 2 của đăng ký: nhập mã OTP 6 số gửi về email (6 ô, dán nguyên mã, tự gửi khi đủ số, đếm ngược "Gửi lại"). */
export function VerifyOtpPage() {
  const { t } = useTranslation('auth');
  const { verifyRegistration, resendRegistrationOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = (params.get('email') ?? '').trim().toLowerCase();
  const state = (location.state as LocationState | null) ?? {};

  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(state.emailSent === false ? t('otp.sendFailed') : null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(state.resendInSec ?? DEFAULT_COOLDOWN);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const submittedCode = useRef<string | null>(null);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const submit = async (code: string) => {
    if (submitting || submittedCode.current === code) return;
    if (code.length !== LENGTH) {
      setError(t('otp.enter6'));
      return;
    }
    submittedCode.current = code;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      await verifyRegistration(email, code, readReferralCode());
      clearReferralCode();
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* bỏ qua */
      }
      navigate(state.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('otp.fail'));
      setDigits(Array(LENGTH).fill(''));
      submittedCode.current = null;
      inputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const setAt = (i: number, value: string) => {
    const next = [...digits];
    next[i] = value;
    setDigits(next);
    setError(null);
    if (value && i < LENGTH - 1) inputs.current[i + 1]?.focus();
    const code = next.join('');
    if (code.length === LENGTH && next.every(Boolean)) void submit(code);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? '');
    setDigits(next);
    setError(null);
    inputs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
    if (pasted.length === LENGTH) void submit(pasted);
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const r = await resendRegistrationOtp(email);
      setCooldown(r.resendInSec ?? DEFAULT_COOLDOWN);
      setDigits(Array(LENGTH).fill(''));
      submittedCode.current = null;
      if (r.emailSent) setInfo(t('otp.resent', { email }));
      else setError(t('otp.sendFailed'));
      inputs.current[0]?.focus();
    } catch (err) {
      const wait = err instanceof ApiError && err.code === 'OTP_RATE_LIMITED' ? Number(err.details?.retryAfterSec) : NaN;
      if (Number.isFinite(wait)) setCooldown(wait);
      setError(err instanceof ApiError ? err.message : t('otp.resendFail'));
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <AuthShell title={t('otp.title')}>
        <Alert kind="error">{t('otp.noEmail')}</Alert>
        <Link to="/register" className="text-center font-bold">
          {t('otp.changeEmail')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('otp.title')} subtitle={t('otp.subtitle', { email })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(digits.join(''));
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex justify-center gap-2 sm:gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setAt(i, e.target.value.replace(/\D/g, '').slice(-1))}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={onPaste}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              disabled={submitting}
              aria-label={t('otp.digit', { n: i + 1 })}
              className="size-12 rounded-xl border border-[rgba(120,60,20,.2)] bg-white/90 text-center text-2xl font-bold outline-none focus:border-brand sm:size-14"
            />
          ))}
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {info && <Alert kind="success">{info}</Alert>}

        <Button type="submit" disabled={submitting || digits.some((d) => !d)} className="h-[56px] rounded-2xl text-lg font-bold">
          {submitting ? t('otp.verifying') : t('otp.verify')}
        </Button>

        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className="border-0 bg-transparent text-[15px] font-semibold text-brand disabled:cursor-not-allowed disabled:text-stone-400"
        >
          {resending ? t('otp.resending') : cooldown > 0 ? t('otp.resendIn', { s: cooldown }) : t('otp.resend')}
        </button>
      </form>

      <p className="m-0 text-center text-sm text-stone-500">{t('otp.spamHint')}</p>
      {import.meta.env.DEV && <p className="m-0 text-center text-xs text-stone-400">{t('otp.devHint', { email })}</p>}
      <Link to="/register" className="text-center text-[15px] font-semibold text-stone-700 underline">
        {t('otp.changeEmail')}
      </Link>
    </AuthShell>
  );
}
