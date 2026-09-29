import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { resetPassword } from '../features/auth/api';
import { validateNewPassword } from '../features/auth/validation';
import { AuthShell } from '../features/account/components/AuthShell';
import { Alert } from '../features/account/components/Field';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      password: validateNewPassword(password) ?? undefined,
      confirm: confirm !== password ? 'Mật khẩu nhập lại không khớp' : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // BE dùng chung 400 cho token sai/hết hạn/đã dùng và mật khẩu yếu; mật khẩu đã được kiểm tra ở FE nên coi là lỗi token.
        setTokenInvalid(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Đặt lại mật khẩu thất bại, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || tokenInvalid) {
    return (
      <AuthShell title="Liên kết không hợp lệ" subtitle="Liên kết đặt lại mật khẩu đã hết hạn, đã được sử dụng hoặc không đúng.">
        {error && <Alert kind="error">{error}</Alert>}
        <ButtonLink to="/forgot-password" className="h-[52px] rounded-2xl text-base font-bold">
          Yêu cầu liên kết mới
        </ButtonLink>
        <Link to="/login" className="text-center text-[15px] font-medium">
          Quay lại đăng nhập
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Đã đặt lại mật khẩu" subtitle="Các phiên đăng nhập cũ đã bị đăng xuất. Hãy đăng nhập bằng mật khẩu mới.">
        <ButtonLink to="/login" className="h-[52px] rounded-2xl text-base font-bold">
          Đăng nhập
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Đặt lại mật khẩu" subtitle="Nhập mật khẩu mới: tối thiểu 8 ký tự, có chữ in hoa và ký tự đặc biệt.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormField
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErrors((x) => ({ ...x, password: undefined }));
          }}
          placeholder="Mật khẩu mới"
          error={errors.password}
        />
        <FormField
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setErrors((x) => ({ ...x, confirm: undefined }));
          }}
          placeholder="Nhập lại mật khẩu mới"
          error={errors.confirm}
        />
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" disabled={submitting} className="h-[56px] rounded-2xl text-base font-bold">
          {submitting ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
        </Button>
      </form>
    </AuthShell>
  );
}
