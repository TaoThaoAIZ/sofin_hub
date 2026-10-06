import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../lib/api';
import { formatCents } from '../../../lib/datetime';
import { useRequestRefund } from '../../payments/queries';
import type { PaymentRecord, RefundStatus } from '../../payments/types';
import { ModalActions, ModalError, SettingsModal } from './Modal';

/** Yêu cầu hoàn tiền cho 1 giao dịch (POST /payments/:id/refund-request). Trong cửa sổ hoàn tiền BE tự duyệt, ngoài cửa sổ chờ admin. */
export function RefundModal({ payment, onClose }: { payment: PaymentRecord; onClose: () => void }) {
  const { t } = useTranslation('settings');
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
        onError: (e) => setError(e instanceof ApiError ? e.message : t('common.genericError')),
      },
    );
  };

  if (result) {
    return (
      <SettingsModal title={t('refund.title')} onClose={onClose}>
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${result === 'approved' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'}`}>
          {result === 'approved'
            ? t('refund.approved')
            : t('refund.submitted')}
        </div>
        <ModalActions cancelLabel={t('common.close')} okLabel={t('common.done')} onCancel={onClose} onOk={onClose} />
      </SettingsModal>
    );
  }
  return (
    <SettingsModal
      title={t('refund.title')}
      body={t('refund.body', { id: payment.invoiceNumber ?? payment.id, amount })}
      onClose={onClose}
      busy={refund.isPending}
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={500}
        aria-label={t('refund.reasonLabel')}
        placeholder={t('refund.reasonPlaceholder')}
        className="w-full resize-none rounded-xl border-[1.5px] border-[#e7e0da] px-3.5 py-2.5 text-sm outline-0 focus:border-[#fdba74]"
      />
      {error && <ModalError>{error}</ModalError>}
      <ModalActions okLabel={t('refund.send')} onCancel={onClose} onOk={submit} pending={refund.isPending} disabled={tooShort} />
    </SettingsModal>
  );
}
