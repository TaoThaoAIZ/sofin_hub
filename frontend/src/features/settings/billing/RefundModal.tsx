import { useState } from 'react';
import { ApiError } from '../../../lib/api';
import { formatCents } from '../../../lib/datetime';
import { useRequestRefund } from '../../payments/queries';
import type { PaymentRecord, RefundStatus } from '../../payments/types';
import { ModalActions, ModalError, SettingsModal } from './Modal';

/** Yêu cầu hoàn tiền cho 1 giao dịch (POST /payments/:id/refund-request). Trong cửa sổ hoàn tiền BE tự duyệt, ngoài cửa sổ chờ admin. */
export function RefundModal({ payment, onClose }: { payment: PaymentRecord; onClose: () => void }) {
  const refund = useRequestRefund();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefundStatus | null>(null);
  const tooShort = reason.trim().length < 3;
  const amount = formatCents(payment.amountCents ?? Math.round(payment.amountUsd * 100));

  const submit = () => {
    setError(null);
    refund.mutate(
      { paymentId: payment.id, reason: reason.trim() },
      {
        onSuccess: (r) => setResult(r.status),
        onError: (e) => setError(e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại'),
      },
    );
  };

  if (result) {
    return (
      <SettingsModal title="Yêu cầu hoàn tiền" onClose={onClose}>
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${result === 'approved' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'}`}>
          {result === 'approved'
            ? 'Yêu cầu đã được duyệt tự động (trong thời hạn hoàn tiền). Khoản tiền sẽ được hoàn lại.'
            : 'Yêu cầu đã được gửi và đang chờ quản trị viên nền tảng duyệt.'}
        </div>
        <ModalActions cancelLabel="Đóng" okLabel="Xong" onCancel={onClose} onOk={onClose} />
      </SettingsModal>
    );
  }
  return (
    <SettingsModal
      title="Yêu cầu hoàn tiền"
      body={`Giao dịch ${payment.invoiceNumber ?? payment.id} · ${amount}. Trong 7 ngày đầu kể từ lần thanh toán đầu của gói, yêu cầu được duyệt tự động; sau đó cần quản trị viên duyệt.`}
      onClose={onClose}
      busy={refund.isPending}
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={500}
        aria-label="Lý do hoàn tiền"
        placeholder="Lý do hoàn tiền…"
        className="w-full resize-none rounded-xl border-[1.5px] border-[#e7e0da] px-3.5 py-2.5 text-sm outline-0 focus:border-[#fdba74]"
      />
      {error && <ModalError>{error}</ModalError>}
      <ModalActions okLabel="Gửi yêu cầu" onCancel={onClose} onOk={submit} pending={refund.isPending} disabled={tooShort} />
    </SettingsModal>
  );
}
