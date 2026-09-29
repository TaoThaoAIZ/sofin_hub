import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api';
import { validateLoginPassword, validateNewPassword } from '../../auth/validation';
import { useChangePassword } from '../queries';
import { Alert, Field } from './Field';

export function PasswordForm() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = {
      current: validateLoginPassword(current) ?? undefined,
      next: validateNewPassword(next) ?? (next === current ? 'Mật khẩu mới phải khác mật khẩu hiện tại' : undefined),
      confirm: confirm !== next ? 'Mật khẩu nhập lại không khớp' : undefined,
    };
    setErrors(errs);
    setDone(false);
    setError(null);
    if (errs.current || errs.next || errs.confirm) return;
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không đổi được mật khẩu, vui lòng thử lại';
      // BE trả 400 khi sai mật khẩu hiện tại (mật khẩu mới đã được kiểm tra ở FE) → hiện tại ô mật khẩu hiện tại.
      if (err instanceof ApiError && err.status === 400) setErrors({ current: msg });
      else setError(msg);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[460px] flex-col gap-4">
      <Field label="Mật khẩu hiện tại" type="password" autoComplete="current-password" value={current} onChange={(v) => { setCurrent(v); setErrors((x) => ({ ...x, current: undefined })); }} error={errors.current} />
      <Field label="Mật khẩu mới" type="password" autoComplete="new-password" value={next} onChange={(v) => { setNext(v); setErrors((x) => ({ ...x, next: undefined })); }} error={errors.next} hint="Tối thiểu 8 ký tự, có chữ in hoa và ký tự đặc biệt." />
      <Field label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" value={confirm} onChange={(v) => { setConfirm(v); setErrors((x) => ({ ...x, confirm: undefined })); }} error={errors.confirm} />
      {error && <Alert kind="error">{error}</Alert>}
      {done && <Alert kind="success">Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.</Alert>}
      <Button type="submit" disabled={change.isPending} className="h-12 self-start rounded-2xl px-6 text-[15px] font-bold">
        {change.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}
      </Button>
    </form>
  );
}
