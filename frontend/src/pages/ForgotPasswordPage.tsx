import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { forgotPassword } from '../features/auth/api';
import { validateEmail } from '../features/auth/validation';
import { AuthShell } from '../features/account/components/AuthShell';
import { Alert } from '../features/account/components/Field';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateEmail(email);
    setFieldError(invalid ?? undefined);
    if (invalid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await forgotPassword(email.trim());
      setSentMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Quên mật khẩu" subtitle="Nhập email tài khoản, chúng tôi sẽ gửi liên kết đặt lại mật khẩu (có hiệu lực 30 phút).">
      {sentMessage ? (
        <div className="flex flex-col gap-4">
          <Alert kind="success">{sentMessage}</Alert>
          <p className="m-0 text-center text-sm text-stone-600">Vui lòng kiểm tra hộp thư (kể cả mục thư rác) và bấm vào liên kết trong email.</p>
          <Link to="/login" className="text-center font-bold">
            Quay lại đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormField
            type="email"
            autoComplete="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              setFieldError(undefined);
            }}
            placeholder="Email của bạn"
            error={fieldError}
          />
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" disabled={submitting} className="h-[56px] rounded-2xl text-base font-bold">
            {submitting ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
          </Button>
          <Link to="/login" className="text-center text-[15px] font-medium">
            Quay lại đăng nhập
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
