import { useEffect, useState, type FormEvent } from 'react';
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

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [agreed, setAgreed] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const bothRead = termsRead && privacyRead;

  // Đọc lại trạng thái "đã đọc" mỗi khi quay về trang này (vd. sau khi xem xong /terms, /privacy).
  useEffect(() => {
    setTermsRead(hasReadTerms());
    setPrivacyRead(hasReadPrivacy());
  }, []);

  const clearFieldError = (key: keyof FieldErrors) =>
    setFieldErrors((f) => (f[key] ? { ...f, [key]: undefined } : f));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {
      firstName: validateRequired(firstName, 'tên') ?? undefined,
      lastName: validateRequired(lastName, 'họ') ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validateNewPassword(password) ?? undefined,
      agree: !bothRead
        ? 'Vui lòng đọc hết Điều khoản sử dụng và Chính sách bảo mật trước'
        : !agreed
          ? 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật để đăng ký'
          : undefined,
    };
    setFieldErrors(errors);
    if (errors.firstName || errors.lastName || errors.email || errors.password || errors.agree) return;

    setSubmitting(true);
    setError(null);
    try {
      await register({ firstName, lastName, email, password, referralCode: readReferralCode() });
      clearReferralCode();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng ký thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-wrap items-center justify-between gap-10 overflow-hidden px-6 py-12 sm:px-10 md:px-[8vw] lg:py-[7vh]"
      style={{
        background:
          'radial-gradient(800px 600px at 10% 80%, rgba(255,160,100,.35), transparent 70%), radial-gradient(700px 500px at 90% 10%, rgba(255,200,160,.3), transparent 70%), linear-gradient(135deg, #fff7f1 0%, #fff 50%, #fff4ec 100%)',
      }}
    >
      <div className="pointer-events-none relative z-10 flex min-w-0 max-w-[640px] flex-1 basis-[460px] flex-col gap-6 self-start">
        <Link to="/" className="pointer-events-auto block self-start leading-none">
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
        </div>
      </div>

      <div className="relative z-10 flex min-w-[min(100%,380px)] flex-1 basis-[630px] flex-col gap-[22px] rounded-[28px] border border-white/95 bg-white/70 p-6 shadow-[0_30px_70px_rgba(120,60,20,.12)] backdrop-blur-[26px] backdrop-saturate-[180%] sm:p-10 md:p-[clamp(28px,4vw,60px)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/images/logo.png" alt="SofinHub" className="mb-1 h-11 w-auto" />
          <h2 className="m-0 text-[clamp(28px,2.6vw,38px)] font-bold tracking-[-.5px]">Tạo tài khoản</h2>
          <p className="m-0 max-w-[380px] text-base leading-[1.6] text-stone-600 text-pretty">
            Tham gia cộng đồng để bắt đầu hành trình học tập và kết nối tại SofinHub.
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
                placeholder="Tên của bạn"
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
                placeholder="Họ của bạn"
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
            placeholder="Email của bạn"
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
            placeholder="Mật khẩu"
            error={fieldErrors.password}
            hint="Ít nhất 8 ký tự, có chữ in hoa và ký tự đặc biệt"
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
                Tôi đã đọc và đồng ý với{' '}
                <Link to="/terms" className="font-semibold text-brand underline">
                  Điều khoản sử dụng
                </Link>{' '}
                {termsRead && '✓ '}
                và{' '}
                <Link to="/privacy" className="font-semibold text-brand underline">
                  Chính sách bảo mật
                </Link>
                {privacyRead && ' ✓'} của chúng tôi.
              </span>
            </label>
            {!bothRead && <FieldHint indent>Mở và đọc hết hai trang trên (cuộn tới cuối) để bật ô đồng ý.</FieldHint>}
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
            {submitting ? 'Đang tạo tài khoản…' : 'Đăng ký ngay'}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[15px] whitespace-nowrap text-stone-700">
          <span className="hidden h-px flex-1 bg-[rgba(120,60,20,.14)] sm:block" />
          Bạn đã có tài khoản?{' '}
          <Link to="/login" className="font-bold underline">
            Đăng nhập
          </Link>
          <span className="hidden h-px flex-1 bg-[rgba(120,60,20,.14)] sm:block" />
        </div>
      </div>
    </div>
  );
}
