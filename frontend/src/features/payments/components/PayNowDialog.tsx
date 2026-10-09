import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { usePaymentStatus } from '../queries';
import { BankTransferPanel } from './BankTransferPanel';

/** "Thanh toán ngay" cho khoản chờ (gia hạn / thanh toán đầu): mở lại phiên chuyển khoản của payment đó (GET /payments/:id → QR). */
export function PayNowDialog({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { t } = useTranslation('payments');
  const q = usePaymentStatus(paymentId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-stone-900/45 p-3 backdrop-blur-[2px] sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('bank.payNowTitle')} className="m-auto w-full max-w-[560px]" onClick={(e) => e.stopPropagation()}>
        <div className="relative rounded-[28px] bg-white px-6 pt-6 pb-6 shadow-2xl">
          <button type="button" aria-label={t('join.close')} onClick={onClose} className="absolute top-4 right-4 grid size-9 place-items-center rounded-full border border-[rgba(120,60,20,.1)] bg-white shadow-sm">
            <MaterialIcon name="close" size={20} />
          </button>
          <h2 className="m-0 mb-4 pr-10 text-xl font-extrabold tracking-[-0.3px]">{t('bank.payNowTitle')}</h2>
          {q.isPending && <p className="py-10 text-center text-stone-500">{t('join.quoteLoading')}</p>}
          {q.isError && !q.data && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {q.error instanceof Error ? q.error.message : t('bank.loadError')}
            </p>
          )}
          {q.data && <BankTransferPanel payment={q.data} onDone={onClose} />}
        </div>
      </div>
    </div>
  );
}
