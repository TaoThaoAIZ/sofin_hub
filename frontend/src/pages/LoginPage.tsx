import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { validateEmail, validateLoginPassword } from '../features/auth/validation';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
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
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    if (code.replace(/D/g, '').length !== 6) {
      setError('Nhập đủ mã 6 số');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeTwoFactor(ticket, code);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xác minh thất bại, vui lòng thử lại');
      // Vé hết hạn: quay lại bước nhập mật khẩu.
      if (err instanceof ApiError && err.status === 401 && /hết hạn, vui lòng đăng nhập lại/.test(err.message)) setTicket(null);
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
          <h2 className="m-0 text-[clamp(26px,2.4vw,34px)] font-bold tracking-[-.5px]">Chào mừng quay trở lại</h2>
          <p className="m-0 max-w-[380px] text-base leading-[1.6] text-stone-600 text-pretty">
            Đăng nhập để tiếp tục hành trình học tập và kết nối tại SofinHub.
          </p>
        </div>

        {ticket ? (
          <form onSubmit={submitCode} noValidate className="mt-2 flex flex-col gap-4">
            <p className="m-0 text-center text-[15px] text-stone-600">Nhập mã 6 số từ ứng dụng xác thực (Google Authenticator, Authy...) để hoàn tất đăng nhập.</p>
            <FormField type="text" autoComplete="one-time-code" value={code} onChange={setCode} placeholder="Mã 6 số" />
            {error && (
              <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                {error}
              </div>
            )}
            <Button type="submit" disabled={submitting} className="h-[60px] gap-2.5 rounded-2xl text-lg font-bold">
              {submitting ? 'Đang xác minh…' : 'Xác minh'}
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
              Quay lại
            </button>
          </form>
        ) : (
        <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-4">
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
            autoComplete="current-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearFieldError('password');
            }}
            placeholder="Mật khẩu"
            error={fieldErrors.password}
          />

          <Link to="/forgot-password" className="self-end text-[15px] font-medium">
            Quên mật khẩu?
          </Link>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="h-[60px] gap-2.5 rounded-2xl text-lg font-bold">
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Button>
        </form>
        )}

        <div className="flex items-center gap-4 text-[15px] text-stone-500">
          <span className="h-px flex-1 bg-[rgba(120,60,20,.14)]" />
          hoặc đăng nhập với
          <span className="h-px flex-1 bg-[rgba(120,60,20,.14)]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SocialButton label="Google" />
          <SocialButton label="Facebook" />
        </div>

        <div className="text-center text-[15px] text-stone-700">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-bold">
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}

function SocialButton({ label }: { label: string }) {
  const [note, setNote] = useState(false);
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => setNote(true)}
        className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white/85 text-[15px] font-semibold hover:bg-white"
      >
        {label === 'Google' ? <GoogleMark /> : <FacebookMark />}
        {label}
      </button>
      {note && <span className="text-center text-xs text-stone-500">Tính năng sắp ra mắt</span>}
    </div>
  );
}

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
    />
  </svg>
);

const FacebookMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#1877F2" />
    <path fill="#fff" d="M13.2 21.9v-7h2.3l.4-2.8h-2.7v-1.8c0-.8.3-1.4 1.4-1.4H16V6.4c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.2H8v2.8h2.4v7z" />
  </svg>
);
