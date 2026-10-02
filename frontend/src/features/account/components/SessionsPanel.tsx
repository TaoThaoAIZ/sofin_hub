import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useLogoutAll, useRevokeSession, useSessions } from '../queries';
import { Alert } from './Field';
import { usePopup } from '../../../components/ui/usePopup';

const fmt = (iso: string) => new Date(iso).toLocaleString('vi-VN');

function deviceLabel(ua: string | null) {
  if (!ua) return 'Thiết bị không xác định';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} trên ${os}` : browser;
}

export function SessionsPanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { confirm } = usePopup();
  const { data, isPending, error, refetch } = useSessions();
  const revoke = useRevokeSession();
  const logoutAll = useLogoutAll();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const doRevoke = async (id: string) => {
    setErr(null);
    setMsg(null);
    try {
      await revoke.mutateAsync(id);
      setMsg('Đã thu hồi phiên đăng nhập.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không thu hồi được phiên');
    }
  };

  const doLogoutAll = async () => {
    if (!(await confirm({ title: 'Đăng xuất khỏi tất cả thiết bị?', message: 'Kể cả thiết bị này.', confirmText: 'Đăng xuất tất cả' }))) return;
    setErr(null);
    try {
      await logoutAll.mutateAsync();
      await logout(); // dọn phiên phía FE (lệnh logout trên BE lặp lại vô hại)
      navigate('/login', { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không đăng xuất được, vui lòng thử lại');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert kind="success">{msg}</Alert>}
      {err && <Alert kind="error">{err}</Alert>}
      {isPending && <p className="m-0 text-stone-500">Đang tải danh sách phiên…</p>}
      {error && (
        <Alert kind="error">
          {error instanceof ApiError ? error.message : 'Không tải được phiên đăng nhập'}{' '}
          <button type="button" onClick={() => refetch()} className="font-bold underline">
            Thử lại
          </button>
        </Alert>
      )}
      {data && data.length === 0 && <p className="m-0 text-stone-500">Không có phiên nào.</p>}
      {data && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((s) => (
            <li key={s.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
              <MaterialIcon name={/Android|iPhone|iPad/.test(s.userAgent ?? '') ? 'smartphone' : 'computer'} size={28} className="text-stone-500" />
              <div className="min-w-0 flex-1 basis-[220px]">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {deviceLabel(s.userAgent)}
                  {s.current && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Phiên hiện tại</span>}
                </div>
                <div className="text-[13px] text-stone-500">
                  IP {s.ip ?? 'không rõ'} · Đăng nhập {fmt(s.createdAt)} · Hoạt động gần nhất {fmt(s.lastUsedAt)}
                </div>
              </div>
              {!s.current && (
                <button
                  type="button"
                  disabled={revoke.isPending}
                  onClick={() => doRevoke(s.id)}
                  className="rounded-xl border border-red-200 bg-white/80 px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Thu hồi
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={logoutAll.isPending}
        onClick={doLogoutAll}
        className="self-start rounded-2xl border border-red-200 bg-white/80 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {logoutAll.isPending ? 'Đang đăng xuất…' : 'Đăng xuất mọi thiết bị'}
      </button>
    </div>
  );
}
