import { useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { sendVerification } from '../../auth/api';
import { Alert } from './Field';

const COOLDOWN = 60; // BE giới hạn 1 lần/60 giây/user

export function VerifyBanner() {
  const { user, updateUser } = useAuth();
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!user || user.emailVerified) return null;

  const send = async () => {
    setSending(true);
    setMsg(null);
    setError(null);
    try {
      const res = await sendVerification();
      setMsg(res.message);
      setCooldown(COOLDOWN);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setCooldown(COOLDOWN);
        setError('Bạn vừa yêu cầu gửi email, vui lòng đợi rồi thử lại.');
      } else if (err instanceof ApiError && err.status === 409) {
        // Đã xác thực ở nơi khác → đồng bộ cờ
        updateUser({ ...user, emailVerified: true });
      } else {
        setError(err instanceof ApiError ? err.message : 'Không gửi được email xác thực');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl border border-amber-200 p-4">
      <div>
        <div className="font-bold text-amber-800">Email chưa xác thực</div>
        <div className="text-sm text-stone-600">
          Chúng tôi sẽ gửi liên kết xác thực tới <b>{user.email}</b>. Liên kết có hiệu lực 24 giờ.
        </div>
      </div>
      {msg && <Alert kind="success">{msg}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <button
        type="button"
        onClick={send}
        disabled={sending || cooldown > 0}
        className="bg-brand-gradient self-start rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? 'Đang gửi…' : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi email xác thực'}
      </button>
    </div>
  );
}
