import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { formatCents } from '../../../lib/datetime';
import { useConfirmPayment, usePaymentStatus } from '../queries';
import type { PaymentIntent } from '../types';

/** QR VietQR tải từ img.vietqr.io: có khung chờ + báo lỗi/thử lại (extension chặn ảnh hoặc mạng lỗi thì khách vẫn chuyển khoản tay được). */
function QrImage({ url, alt, dim, retryLabel, failLabel }: { url: string; alt: string; dim: boolean; retryLabel: string; failLabel: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="relative grid size-[200px] place-items-center">
      {state !== 'error' && (
        <img
          key={attempt}
          src={attempt ? `${url}${url.includes('?') ? '&' : '?'}r=${attempt}` : url}
          alt={alt}
          width={200}
          height={200}
          referrerPolicy="no-referrer"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={`size-[200px] object-contain ${dim ? 'opacity-30' : ''} ${state === 'loading' ? 'invisible' : ''}`}
        />
      )}
      {state === 'loading' && <span className="absolute size-8 animate-spin rounded-full border-2 border-[#f0ebe6] border-t-brand" aria-hidden />}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-2 px-2 text-center text-[13px] text-stone-600">
          <p className="m-0">{failLabel}</p>
          <button type="button" className="font-bold text-brand underline" onClick={() => { setState('loading'); setAttempt((a) => a + 1); }}>
            {retryLabel}
          </button>
        </div>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Đếm ngược tới `iso` (giây còn lại, tối thiểu 0), cập nhật mỗi giây. */
function useCountdown(iso: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));
}

function CopyRow({ label, value, display, strong }: { label: string; value: string; display?: string; strong?: boolean }) {
  const { t } = useTranslation('payments');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* trình duyệt chặn clipboard: người dùng vẫn có thể bôi đen để sao chép */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f3eee9] py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-xs text-stone-500">{label}</div>
        <div className={`break-all select-all ${strong ? 'text-base font-extrabold text-brand' : 'text-[14.5px] font-semibold text-stone-900'}`}>{display ?? value}</div>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t('bank.copy', { label })}
        className="inline-flex h-8 flex-none items-center gap-1 rounded-lg border border-[#e7e0da] bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-[#faf7f4]"
      >
        <MaterialIcon name={copied ? 'check' : 'content_copy'} size={15} color={copied ? '#16a34a' : '#57534e'} />
        {copied ? t('bank.copied') : t('bank.copyBtn')}
      </button>
    </div>
  );
}

/**
 * Phiên chuyển khoản VietQR/SePay: mã QR + thông tin tài khoản (nút sao chép), đếm ngược tới `expiresAt`,
 * tự động poll trạng thái mỗi 4s. Quyền truy cập chỉ được cấp khi BE báo `succeeded` (tiền thật sự về tài khoản).
 */
export function BankTransferPanel({
  payment,
  onDone,
  onNewSession,
  successTitle,
  successBody,
  doneLabel,
  newSessionBusy,
}: {
  payment: PaymentIntent;
  /** Bấm nút ở màn thành công. */
  onDone: () => void;
  /** Tạo phiên chuyển khoản mới (khi hết hạn). Không truyền → ẩn nút. */
  onNewSession?: () => void;
  successTitle?: string;
  successBody?: string;
  doneLabel?: string;
  newSessionBusy?: boolean;
}) {
  const { t } = useTranslation('payments');
  const status = usePaymentStatus(payment.id, payment);
  const confirm = useConfirmPayment();
  const p = status.data ?? payment;
  const transfer = p.transfer ?? payment.transfer ?? null;
  const left = useCountdown(p.status === 'pending' ? (p.expiresAt ?? transfer?.expiresAt) : undefined);
  const [clicked, setClicked] = useState(false);

  if (p.status === 'succeeded') {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-green-50">
          <MaterialIcon name="check_circle" size={34} filled color="#16a34a" />
        </span>
        <div>
          <div className="text-lg font-extrabold">{successTitle ?? t('bank.successTitle')}</div>
          <p role="status" className="mt-1 mb-0 text-sm text-stone-600">{successBody ?? t('bank.successBody')}</p>
        </div>
        <Button onClick={onDone} className="h-[48px] w-full rounded-2xl text-base font-bold">{doneLabel ?? t('bank.successCta')}</Button>
      </div>
    );
  }

  if (p.status === 'failed' || p.status === 'refunded') {
    const expired = p.status === 'failed' && p.failureReason === 'expired';
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-amber-50">
          <MaterialIcon name={expired ? 'schedule' : 'error'} size={32} filled color="#d97706" />
        </span>
        <div>
          <div className="text-lg font-extrabold">{expired ? t('bank.expiredTitle') : p.status === 'refunded' ? t('bank.refundedTitle') : t('bank.failedTitle')}</div>
          <p role="alert" className="mt-1 mb-0 text-sm text-stone-600">{expired ? t('bank.expiredBody') : p.status === 'refunded' ? t('bank.refundedBody') : t('bank.failedBody')}</p>
        </div>
        {onNewSession && p.status === 'failed' && (
          <Button onClick={onNewSession} disabled={newSessionBusy} className="h-[48px] w-full rounded-2xl text-base font-bold">
            {newSessionBusy ? t('join.processing') : t('bank.newSession')}
          </Button>
        )}
      </div>
    );
  }

  if (!transfer) {
    // Đang pending nhưng chưa có thông tin chuyển khoản (đang tải lại).
    return <p className="py-8 text-center text-stone-500">{status.isError ? t('bank.loadError') : t('join.quoteLoading')}</p>;
  }

  const timeUp = left === 0;
  const mm = left === null ? '--' : pad(Math.floor(left / 60));
  const ss = left === null ? '--' : pad(left % 60);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-[17px] font-extrabold">{t('bank.title')}</h3>
        <span
          role="timer"
          aria-label={t('bank.countdownAria')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${timeUp ? 'bg-red-50 text-red-600' : left !== null && left <= 120 ? 'bg-amber-50 text-amber-700' : 'bg-[#fff1e6] text-brand'}`}
        >
          <MaterialIcon name="timer" size={16} />
          {mm}:{ss}
        </span>
      </div>
      <p className="mt-1 mb-0 text-[13px] text-stone-600">{t('bank.intro')}</p>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="flex-none rounded-2xl border border-[#ece5df] bg-white p-2">
          <QrImage url={transfer.qrUrl} alt={t('bank.qrAlt')} dim={timeUp} retryLabel={t('bank.qrRetry')} failLabel={t('bank.qrFail')} />
        </div>
        <div className="w-full min-w-0 flex-1 rounded-2xl border border-[#f0ebe6] px-3.5">
          <CopyRow label={t('bank.bank')} value={transfer.bankName} />
          <CopyRow label={t('bank.account')} value={transfer.bankAccount} />
          <CopyRow label={t('bank.accountName')} value={transfer.accountName} />
          <CopyRow label={t('bank.amount')} value={String(transfer.amount)} display={formatCents(transfer.amount)} strong />
          <CopyRow label={t('bank.content')} value={transfer.transferContent} strong />
        </div>
      </div>

      <p className="mt-3 mb-0 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-800">{t('bank.warn')}</p>

      {confirm.isError && (
        <p role="alert" className="mt-3 mb-0 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">
          {confirm.error instanceof Error && confirm.error.message ? confirm.error.message : t('bank.confirmError')}
        </p>
      )}

      <Button
        onClick={() => confirm.mutate(p.id, { onSuccess: () => setClicked(true) })}
        disabled={confirm.isPending || timeUp}
        className="mt-4 h-[52px] w-full gap-2.5 rounded-2xl text-base font-bold"
      >
        <MaterialIcon name="task_alt" size={20} filled color="#fff" />
        {confirm.isPending ? t('join.processing') : t('bank.iPaid')}
      </Button>
      <p role="status" className="mt-2.5 mb-0 flex items-center justify-center gap-1.5 text-center text-xs text-stone-500">
        <MaterialIcon name="sync" size={14} />
        {clicked ? t('bank.checking') : t('bank.autoNote')}
      </p>
    </div>
  );
}
