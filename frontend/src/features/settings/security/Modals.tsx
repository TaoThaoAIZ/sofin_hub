import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('settings');
  const toast = useToast();
  const change = useChangeEmail();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const invalid = validateEmail(email);
    if (invalid) return setError(invalid === t('validation.emailRequired', { ns: 'auth' }) ? t('modals.invalidEmail') : invalid);
    if (!pw) return setError(t('modals.enterCurrentPw'));
    try {
      const r = await change.mutateAsync({ newEmail: email.trim(), password: pw });
      toast.success(t('modals.emailSentToast', { email: r.pendingEmail }));
      onClose();
    } catch (e) {
      setError(errMsg(e, t('modals.emailSendFail')));
    }
  };

  return (
    <ModalShell icon="mail" title={t('modals.emailTitle')} body={t('modals.emailBody')} cta={t('modals.emailCta')} pending={change.isPending} error={error} onConfirm={submit} onClose={onClose}>
      <ModalField label={t('modals.newEmail')} type="email" value={email} onChange={(v) => { setEmail(v); setError(null); }} placeholder={t('modals.emailPlaceholder')} autoComplete="email" />
      <ModalField label={t('modals.currentPw')} type="password" value={pw} onChange={(v) => { setPw(v); setError(null); }} placeholder="••••••••" autoComplete="current-password" />
    </ModalShell>
  );
}

/** "Đổi mật khẩu": 3 ô; quy tắc mật khẩu khớp BE (≥8 ký tự, 1 chữ in hoa, 1 ký tự đặc biệt). */
export function PasswordModal({ onChanged, onClose }: { onChanged: () => void; onClose: () => void }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const change = useChangePassword();
  const [old, setOld] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!old) return setError(t('modals.enterCurrentPw'));
    const weak = validateNewPassword(n1);
    if (weak) return setError(weak);
    if (n1 !== n2) return setError(t('modals.pwMismatch'));
    try {
      await change.mutateAsync({ currentPassword: old, newPassword: n1 });
      onChanged();
      toast.success(t('modals.pwChangedToast'));
      onClose();
    } catch (e) {
      setError(errMsg(e, t('modals.pwChangeFail')));
    }
  };
  const clear = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  return (
    <ModalShell
      icon="lock"
      title={t('modals.pwTitle')}
      body={t('modals.pwBody')}
      cta={t('modals.pwCta')}
      pending={change.isPending}
      error={error}
      onConfirm={submit}
      onClose={onClose}
    >
      <ModalField label={t('modals.currentPw')} type="password" value={old} onChange={clear(setOld)} placeholder="••••••••" autoComplete="current-password" />
      <ModalField label={t('modals.newPw')} type="password" value={n1} onChange={clear(setN1)} placeholder="••••••••" autoComplete="new-password" />
      <ModalField label={t('modals.repeatPw')} type="password" value={n2} onChange={clear(setN2)} placeholder="••••••••" autoComplete="new-password" />
    </ModalShell>
  );
}

/** Mã QR otpauth:// (thư viện nạp khi cần để không phình bundle trang). */
function QrImage({ text }: { text: string }) {
  const { t } = useTranslation('settings');
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import('qrcode').then(({ default: QR }) => QR.toDataURL(text, { margin: 1, width: 176 })).then((url) => alive && setSrc(url)).catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [text]);
  return src ? <img src={src} alt={t('modals.qrAlt')} width={176} height={176} className="rounded-xl border border-[#f0ebe6]" /> : <div className="size-44 animate-pulse rounded-xl bg-[#f5f2ef]" />;
}

/** Bật (đang tắt) hoặc tắt (đang bật) xác minh 2 bước. Bật: tạo bí mật ở BE → quét QR/nhập khóa → nhập mã 6 số. */
export function TwoFactorModal({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const { t } = useTranslation('settings');
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
    runSetup(undefined, { onError: (e) => setError(errMsg(e, t('modals.tfSetupFail'))) });
  }, [enabled, runSetup]);

  const submit = async () => {
    if (code.length !== 6) return setError(t('modals.tfEnter6'));
    try {
      if (enabled) {
        await disable.mutateAsync(code);
        toast.success(t('modals.tfDisabledToast'));
      } else {
        await enable.mutateAsync(code);
        toast.success(t('modals.tfEnabledToast'));
      }
      onClose();
    } catch (e) {
      setError(errMsg(e, t('modals.tfBadCode')));
    }
  };

  const secret = setup.data;
  return (
    <ModalShell
      icon="shield"
      danger={enabled}
      title={enabled ? t('modals.tfTitleOff') : t('modals.tfTitleOn')}
      body={enabled ? t('modals.tfBodyOff') : t('modals.tfBodyOn')}
      cta={enabled ? t('modals.tfCtaOff') : t('modals.tfCtaOn')}
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
                {t('modals.tfCantScan')}
                <div className="mt-1 font-mono text-[14px] font-bold tracking-[.08em] break-all text-stone-800 select-all">{groupKey(secret.secret)}</div>
              </div>
            </>
          ) : (
            !error && <div className="size-44 animate-pulse rounded-xl bg-[#f5f2ef]" />
          )}
        </div>
      )}
      <ModalField
        label={enabled ? t('modals.tfCodeAuth') : t('modals.tfCode')}
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
  const { t } = useTranslation('settings');
  const confirmWord = t('modals.deleteWord');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [word, setWord] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const blocked = blockersSentence(blockers);

  const submit = async () => {
    if (word !== confirmWord) return setError(t('modals.deleteWordMismatch', { word: confirmWord }));
    if (!pw) return setError(t('modals.deleteEnterPw'));
    setPending(true);
    try {
      await deleteAccount(pw);
      await logout();
      navigate('/', { replace: true });
    } catch (e) {
      setError(errMsg(e, t('modals.deleteFail')));
      setPending(false);
    }
  };

  const body: ReactNode = (
    <>
      {t('modals.deleteBody')}
      {blocked && <span className="mt-2 block font-semibold text-[#b91c1c]">{blocked}</span>}
    </>
  );

  return (
    <ModalShell icon="delete" danger title={t('modals.deleteTitle')} body={body} cta={t('modals.deleteCta')} pending={pending} disabled={!!blocked} error={error} onConfirm={submit} onClose={onClose}>
      <ModalField label={t('modals.deleteTypeLabel', { word: confirmWord })} value={word} onChange={(v) => { setWord(v); setError(null); }} placeholder={confirmWord} />
      <ModalField label={t('modals.currentPw')} type="password" value={pw} onChange={(v) => { setPw(v); setError(null); }} placeholder="••••••••" autoComplete="current-password" />
    </ModalShell>
  );
}
