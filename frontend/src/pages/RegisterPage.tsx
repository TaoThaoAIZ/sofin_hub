import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FieldError, FieldHint } from '../components/ui/FieldMessage';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { hasReadPrivacy, hasReadTerms } from '../features/auth/legalConsent';
import { clearReferralCode, readReferralCode } from '../features/referral/storage';
import { validateEmail, validateNewPassword, validateRequired } from '../features/auth/validation';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  agree?: string;
}

// Giữ bản nháp form khi người dùng sang /terms, /privacy rồi quay lại (trang bị unmount nên state mất).
// Chỉ lưu trong sessionStorage (tự xóa khi đóng tab) và xóa ngay khi đăng ký thành công.
const DRAFT_KEY = 'sofinhub_register_draft';
interface Draft {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreed: boolean;
}
function loadDraft(): Partial<Draft> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft>;
  } catch {
    return {};
  }
}
function saveDraft(d: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* trình duyệt chặn storage: bỏ qua */
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* bỏ qua */
  }
}

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const { register } = useAuth();
  const navigate = useNavigate();

  const [draft] = useState(loadDraft);
  const [firstName, setFirstName] = useState(draft.firstName ?? '');
  const [lastName, setLastName] = useState(draft.lastName ?? '');
  const [email, setEmail] = useState(draft.email ?? '');
  const [password, setPassword] = useState(draft.password ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [agreed, setAgreed] = useState(draft.agreed ?? false);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const bothRead = termsRead && privacyRead;

  // Đọc lại trạng thái "đã đọc" mỗi khi quay về trang này (vd. sau khi xem xong /terms, /privacy).
  useEffect(() => {
    setTermsRead(hasReadTerms());
    setPrivacyRead(hasReadPrivacy());
  }, []);

  useEffect(() => {
    saveDraft({ firstName, lastName, email, password, agreed });
  }, [firstName, lastName, email, password, agreed]);

  const clearFieldError = (key: keyof FieldErrors) =>
    setFieldErrors((f) => (f[key] ? { ...f, [key]: undefined } : f));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {
      firstName: validateRequired(firstName, t('register.firstNameLabel')) ?? undefined,
      lastName: validateRequired(lastName, t('register.lastNameLabel')) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validateNewPassword(password) ?? undefined,
      agree: !bothRead
        ? t('register.readFirst')
        : !agreed
          ? t('register.mustAgree')
          : undefined,
    };
    setFieldErrors(errors);
    if (errors.firstName || errors.lastName || errors.email || errors.password || errors.agree) return;

    setSubmitting(true);
    setError(null);
    try {
      await register({ firstName, lastName, email, password, referralCode: readReferralCode() });
      clearReferralCode();
      clearDraft();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('register.fail'));
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
          <h2 className="m-0 text-[clamp(28px,2.6vw,38px)] font-bold tracking-[-.5px]">{t('register.title')}</h2>
          <p className="m-0 max-w-[380px] text-base leading-[1.6] text-stone-600 text-pretty">
            {t('register.intro')}
          </p>
        </div>

        <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <FormField
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(v) => {
                  setFirstName(v);
                  clearFieldError('firstName');
                }}
                placeholder={t('register.firstNamePh')}
                error={fieldErrors.firstName}
              />
            </div>
            <div className="flex-1">
              <FormField
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(v) => {
                  setLastName(v);
                  clearFieldError('lastName');
                }}
                placeholder={t('register.lastNamePh')}
                error={fieldErrors.lastName}
              />
            </div>
          </div>

          <FormField
            type="email"
            autoComplete="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              clearFieldError('email');
            }}
            placeholder={t('register.emailPh')}
            error={fieldErrors.email}
          />

          <FormField
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearFieldError('password');
            }}
            placeholder={t('register.passwordPh')}
            error={fieldErrors.password}
            hint={t('register.passwordHint')}
          />

          <div>
            <label className={`flex items-start gap-3 text-sm ${bothRead ? 'cursor-pointer text-stone-700' : 'cursor-not-allowed text-stone-400'}`}>
              <input
                type="checkbox"
                checked={agreed}
                disabled={!bothRead}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  clearFieldError('agree');
                }}
                className="mt-0.5 size-4 flex-none accent-brand disabled:opacity-50"
              />
              <span>
                {t('register.agreePrefix')}{' '}
                <Link to="/terms" className="font-semibold text-brand underline">
                  {t('register.terms')}
                </Link>{' '}
                {termsRead && '✓ '}
                {t('register.and')}{' '}
                <Link to="/privacy" className="font-semibold text-brand underline">
                  {t('register.privacy')}
                </Link>
                {privacyRead && ' ✓'}{t('register.agreeSuffix')}
              </span>
            </label>
            {!bothRead && <FieldHint indent>{t('register.readHint')}</FieldHint>}
            {fieldErrors.agree && <FieldError indent>{fieldErrors.agree}</FieldError>}
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || !agreed}
            className="h-[60px] gap-2.5 rounded-2xl text-lg font-bold"
          >
            {submitting ? t('register.creating') : t('register.submit')}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[15px] whitespace-nowrap text-stone-700">
          <span className="hidden h-px flex-1 bg-[rgba(120,60,20,.14)] sm:block" />
          {t('register.haveAccount')}{' '}
          <Link to="/login" className="font-bold underline">
            {t('register.signIn')}
          </Link>
          <span className="hidden h-px flex-1 bg-[rgba(120,60,20,.14)] sm:block" />
        </div>
      </div>
    </div>
  );
}
