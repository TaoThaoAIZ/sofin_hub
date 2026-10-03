import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../lib/api';
import { deleteAccount } from '../../account/api';
import { useChangePassword } from '../../account/queries';
import { useAuth } from '../../auth/AuthContext';
import { validateEmail, validateNewPassword } from '../../auth/validation';
import { ModalShell, useToast } from '../../admin/components/overlay';
import { blockersSentence, groupKey } from './format';
import type { DeleteBlockers } from './api';
import { useChangeEmail, useDisableTwoFactor, useEnableTwoFactor, useSetupTwoFactor } from './queries';

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Ô nhập trong modal (thiết kế: nhãn 13.5px đậm, cao 46px, bo 12px). */
function ModalField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password' | 'email';
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'numeric';
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13.5px] font-bold">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className="h-[46px] rounded-xl border-[1.5px] border-[#e7e0da] px-3.5 text-[14.5px] font-medium outline-0 placeholder:text-stone-400 focus:border-[#fdba74]"
      />
    </label>
  );
}

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/** "Đổi email": gửi link xác minh tới email MỚI; email chỉ đổi sau khi bấm link. */
export function EmailModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const change = useChangeEmail();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const invalid = validateEmail(email);
    if (invalid) return setError(invalid === 'Vui lòng nhập email' ? 'Email chưa hợp lệ' : invalid);
    if (!pw) return setError('Nhập mật khẩu hiện tại');
    try {
      const r = await change.mutateAsync({ newEmail: email.trim(), password: pw });
      toast.success(`Đã gửi link xác minh tới ${r.pendingEmail} · kiểm tra hộp thư`);
      onClose();
    } catch (e) {
      setError(errMsg(e, 'Không gửi được email xác minh'));
    }
  };

  return (
    <ModalShell icon="mail" title="Đổi email" body="Chúng tôi sẽ gửi link xác minh tới email mới." cta="Gửi xác minh" pending={change.isPending} error={error} onConfirm={submit} onClose={onClose}>
      <ModalField label="Email mới" type="email" value={email} onChange={(v) => { setEmail(v); setError(null); }} placeholder="ten@email.com" autoComplete="email" />
      <ModalField label="Mật khẩu hiện tại" type="password" value={pw} onChange={(v) => { setPw(v); setError(null); }} placeholder="••••••••" autoComplete="current-password" />
    </ModalShell>
  );
}

/** "Đổi mật khẩu": 3 ô; quy tắc mật khẩu khớp BE (≥8 ký tự, 1 chữ in hoa, 1 ký tự đặc biệt). */
export function PasswordModal({ onChanged, onClose }: { onChanged: () => void; onClose: () => void }) {
  const toast = useToast();
  const change = useChangePassword();
  const [old, setOld] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!old) return setError('Nhập mật khẩu hiện tại');
    const weak = validateNewPassword(n1);
    if (weak) return setError(weak);
    if (n1 !== n2) return setError('Mật khẩu nhập lại không khớp');
    try {
      await change.mutateAsync({ currentPassword: old, newPassword: n1 });
      onChanged();
      toast.success('Đã đổi mật khẩu');
      onClose();
    } catch (e) {
      setError(errMsg(e, 'Không đổi được mật khẩu'));
    }
  };
  const clear = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  return (
    <ModalShell
      icon="lock"
      title="Đổi mật khẩu"
      body="Tối thiểu 8 ký tự, gồm ít nhất 1 chữ in hoa và 1 ký tự đặc biệt."
      cta="Cập nhật"
      pending={change.isPending}
      error={error}
      onConfirm={submit}
      onClose={onClose}
    >
      <ModalField label="Mật khẩu hiện tại" type="password" value={old} onChange={clear(setOld)} placeholder="••••••••" autoComplete="current-password" />
      <ModalField label="Mật khẩu mới" type="password" value={n1} onChange={clear(setN1)} placeholder="••••••••" autoComplete="new-password" />
      <ModalField label="Nhập lại mật khẩu mới" type="password" value={n2} onChange={clear(setN2)} placeholder="••••••••" autoComplete="new-password" />
    </ModalShell>
  );
}

/** Mã QR otpauth:// (thư viện nạp khi cần để không phình bundle trang). */
function QrImage({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import('qrcode').then(({ default: QR }) => QR.toDataURL(text, { margin: 1, width: 176 })).then((url) => alive && setSrc(url)).catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [text]);
  return src ? <img src={src} alt="Mã QR xác minh 2 bước" width={176} height={176} className="rounded-xl border border-[#f0ebe6]" /> : <div className="size-44 animate-pulse rounded-xl bg-[#f5f2ef]" />;
}

/** Bật (đang tắt) hoặc tắt (đang bật) xác minh 2 bước. Bật: tạo bí mật ở BE → quét QR/nhập khóa → nhập mã 6 số. */
export function TwoFactorModal({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const toast = useToast();
  const setup = useSetupTwoFactor();
  const enable = useEnableTwoFactor();
  const disable = useDisableTwoFactor();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Bí mật chỉ được tạo ở BE khi mở modal bật (StrictMode chạy effect 2 lần nên chặn bằng ref).
  const { mutate: runSetup } = setup;
  useEffect(() => {
    if (enabled || started.current) return;
    started.current = true;
    runSetup(undefined, { onError: (e) => setError(errMsg(e, 'Không bắt đầu được thiết lập xác minh 2 bước')) });
  }, [enabled, runSetup]);

  const submit = async () => {
    if (code.length !== 6) return setError('Nhập đủ 6 số');
    try {
      if (enabled) {
        await disable.mutateAsync(code);
        toast.success('Đã tắt xác minh 2 bước');
      } else {
        await enable.mutateAsync(code);
        toast.success('Đã bật xác minh 2 bước');
      }
      onClose();
    } catch (e) {
      setError(errMsg(e, 'Mã xác minh không đúng'));
    }
  };

  const secret = setup.data;
  return (
    <ModalShell
      icon="shield"
      danger={enabled}
      title={enabled ? 'Tắt xác minh 2 bước?' : 'Bật xác minh 2 bước'}
      body={enabled ? 'Tài khoản sẽ chỉ được bảo vệ bằng mật khẩu.' : 'Quét mã QR bằng Google Authenticator rồi nhập mã 6 số.'}
      cta={enabled ? 'Tắt xác minh' : 'Bật xác minh'}
      pending={enable.isPending || disable.isPending}
      disabled={!enabled && !secret}
      error={error}
      onConfirm={submit}
      onClose={onClose}
    >
      {!enabled && (
        <div className="flex flex-col items-center gap-2.5">
          {secret ? (
            <>
              <QrImage text={secret.otpauthUrl} />
              <div className="text-center text-[12.5px] text-stone-500">
                Không quét được? Nhập khóa này vào ứng dụng:
                <div className="mt-1 font-mono text-[14px] font-bold tracking-[.08em] break-all text-stone-800 select-all">{groupKey(secret.secret)}</div>
              </div>
            </>
          ) : (
            !error && <div className="size-44 animate-pulse rounded-xl bg-[#f5f2ef]" />
          )}
        </div>
      )}
      <ModalField
        label={enabled ? 'Mã 6 số từ ứng dụng xác thực' : 'Mã 6 số'}
        value={code}
        onChange={(v) => {
          setCode(digits(v));
          setError(null);
        }}
        placeholder="123456"
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
      />
    </ModalShell>
  );
}

/** "Xóa tài khoản vĩnh viễn?": gõ XÓA + mật khẩu. Đang bị chặn (chủ cộng đồng / còn gói) thì không cho xác nhận. */
export function DeleteModal({ blockers, onClose }: { blockers: DeleteBlockers | undefined; onClose: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [word, setWord] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const blocked = blockersSentence(blockers);

  const submit = async () => {
    if (word !== 'XÓA') return setError('Gõ đúng chữ XÓA để xác nhận');
    if (!pw) return setError('Nhập mật khẩu để xác nhận');
    setPending(true);
    try {
      await deleteAccount(pw);
      await logout();
      navigate('/', { replace: true });
    } catch (e) {
      setError(errMsg(e, 'Không xóa được tài khoản, vui lòng thử lại'));
      setPending(false);
    }
  };

  const body: ReactNode = (
    <>
      Hồ sơ của bạn sẽ bị xóa và không thể khôi phục. Bài viết và bình luận cũ vẫn được giữ lại dưới tên “Thành viên đã xóa”.
      {blocked && <span className="mt-2 block font-semibold text-[#b91c1c]">{blocked}</span>}
    </>
  );

  return (
    <ModalShell icon="delete" danger title="Xóa tài khoản vĩnh viễn?" body={body} cta="Xóa tài khoản" pending={pending} disabled={!!blocked} error={error} onConfirm={submit} onClose={onClose}>
      <ModalField label="Gõ XÓA để xác nhận" value={word} onChange={(v) => { setWord(v); setError(null); }} placeholder="XÓA" />
      <ModalField label="Mật khẩu hiện tại" type="password" value={pw} onChange={(v) => { setPw(v); setError(null); }} placeholder="••••••••" autoComplete="current-password" />
    </ModalShell>
  );
}
