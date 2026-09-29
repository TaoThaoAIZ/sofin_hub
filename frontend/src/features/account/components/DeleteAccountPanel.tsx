import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useDeleteAccount } from '../queries';
import { Alert, Field } from './Field';

export function DeleteAccountPanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const del = useDeleteAccount();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [ownerConflict, setOwnerConflict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOwnerConflict(null);
    if (!password) {
      setFieldError('Vui lòng nhập mật khẩu để xác nhận');
      return;
    }
    if (!window.confirm('Xóa vĩnh viễn tài khoản? Hành động này không thể hoàn tác.')) return;
    try {
      await del.mutateAsync(password);
      await logout(); // xóa phiên FE (BE đã thu hồi; logout bỏ qua lỗi 401)
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setOwnerConflict(err.message);
      else if (err instanceof ApiError && err.status === 400) setFieldError(err.message);
      else setError(err instanceof ApiError ? err.message : 'Không xóa được tài khoản, vui lòng thử lại');
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[460px] flex-col gap-4">
      <p className="m-0 text-[15px] leading-[1.6] text-stone-600">
        Xóa tài khoản sẽ đăng xuất mọi thiết bị và rút bạn khỏi tất cả cộng đồng. Bài viết cũ vẫn được giữ lại dưới tên “Thành viên đã xóa”. Hành động này không thể hoàn tác.
      </p>
      <Field
        label="Nhập mật khẩu để xác nhận"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(v) => { setPassword(v); setFieldError(undefined); }}
        error={fieldError}
      />
      {ownerConflict && (
        <Alert kind="error">
          {ownerConflict} Bạn cần chuyển quyền chủ sở hữu (owner) của cộng đồng đó cho thành viên khác trước khi xóa tài khoản. Xem các cộng đồng của bạn tại{' '}
          <Link to="/me/communities" className="font-bold underline">
            Cộng đồng của tôi
          </Link>
          .
        </Alert>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      <button
        type="submit"
        disabled={del.isPending}
        className="h-12 self-start rounded-2xl bg-red-600 px-6 text-[15px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {del.isPending ? 'Đang xóa…' : 'Xóa tài khoản vĩnh viễn'}
      </button>
    </form>
  );
}
