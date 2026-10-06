import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { formatCents, formatDateTime } from '../../../lib/datetime';
import { useInvoice } from '../queries';

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #invoice-print, #invoice-print * { visibility: visible !important; }
  #invoice-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
  .no-print { display: none !important; }
}`;

/** Hộp thoại hóa đơn (GET /payments/:id/invoice) — có nút In (window.print, chỉ in phần hóa đơn). */
export function InvoiceDialog({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { t } = useTranslation('payments');
  const invoice = useInvoice(paymentId);
  const inv = invoice.data;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t('invoice.aria')}>
      <style>{PRINT_CSS}</style>
      <div id="invoice-print" className="w-full max-w-[560px] rounded-3xl bg-white p-6 shadow-xl">
        <div className="no-print mb-2 flex justify-end gap-2">
          {inv && (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-[13px] font-medium hover:bg-[#fff7f0]"
            >
              <MaterialIcon name="print" size={17} /> {t('invoice.print')}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label={t('invoice.close')} className="grid size-9 place-items-center text-stone-500 hover:text-stone-900">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        {invoice.isPending && <p className="py-10 text-center text-stone-400">{t('invoice.loading')}</p>}
        {invoice.isError && (
          <p className="py-10 text-center text-red-600">
            {invoice.error instanceof ApiError ? (invoice.error.status === 409 ? t('invoice.noInvoice') : invoice.error.message) : t('invoice.loadError')}
          </p>
        )}
        {inv && (
          <div>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-extrabold text-brand">SofinHub</div>
                <div className="text-[12.5px] text-stone-500">{t('invoice.heading')}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold">{inv.invoiceNumber}</div>
                {inv.issuedAt && <div className="text-[12px] text-stone-500">{formatDateTime(inv.issuedAt)}</div>}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-stone-500">{t('invoice.buyer')}</dt>
                <dd className="font-semibold">{inv.buyer.name}</dd>
                {inv.buyer.email && <dd className="text-stone-500">{inv.buyer.email}</dd>}
              </div>
              <div>
                <dt className="text-stone-500">{t('invoice.community')}</dt>
                <dd className="font-semibold">{inv.community.title}</dd>
              </div>
            </dl>
            <table className="mt-4 w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[rgba(120,60,20,.12)] text-stone-500">
                  <th className="py-2 font-medium">{t('invoice.description')}</th>
                  <th className="py-2 text-right font-medium">{t('invoice.qty')}</th>
                  <th className="py-2 text-right font-medium">{t('invoice.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i} className="border-b border-[rgba(120,60,20,.06)]">
                    <td className="py-2 pr-2">{it.description}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right">{formatCents(it.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 text-right text-[13px]">
              <div>{t('invoice.subtotal', { amount: formatCents(inv.subtotalCents) })}</div>
              {inv.refundedCents > 0 && <div className="text-red-600">{t('invoice.refunded', { amount: formatCents(inv.refundedCents) })}</div>}
              <div className="text-[16px] font-extrabold">{t('invoice.total', { amount: formatCents(inv.totalCents) })}</div>
              <div className="text-[12px] text-stone-500">{t('invoice.status', { status: inv.status === 'refunded' ? t('invoice.statusRefunded') : inv.status === 'succeeded' ? t('invoice.statusSucceeded') : inv.status })}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
