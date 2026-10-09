import i18n from '../../../i18n';
import { formatDate } from '../../../lib/datetime';
import type { PaymentRecord } from '../../payments/types';

export const PAY_STATUS: Record<string, { text: string; color: string; dot: string }> = {
  succeeded: { get text() { return i18n.t('csv.statusPaid', { ns: 'settings' }); }, color: '#15803d', dot: '#16a34a' },
  pending: { get text() { return i18n.t('csv.statusPending', { ns: 'settings' }); }, color: '#b45309', dot: '#f59e0b' },
  failed: { get text() { return i18n.t('csv.statusFailed', { ns: 'settings' }); }, color: '#b91c1c', dot: '#dc2626' },
  refunded: { get text() { return i18n.t('csv.statusRefunded', { ns: 'settings' }); }, color: '#57534e', dot: '#a8a29e' },
};

export function paymentDescription(p: PaymentRecord): string {
  const kind = p.kind === 'renewal' ? i18n.t('csv.renewal', { ns: 'settings' }) : i18n.t('csv.firstPayment', { ns: 'settings' });
  return `${p.courseTitle ?? p.courseId} · ${kind}${p.interval === 'annual' ? i18n.t('csv.annualPlan', { ns: 'settings' }) : ''}`;
}

/** BOM UTF-8 để Excel mở đúng tiếng Việt. */
const BOM = String.fromCharCode(0xfeff);
const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;

/** CSV lịch sử thanh toán (BOM để Excel mở đúng tiếng Việt). Số tiền theo VND (đồng, số nguyên). */
export function buildPaymentsCsv(rows: PaymentRecord[]): string {
  const head = ['csv.colDate', 'csv.colDesc', 'csv.colAmount', 'csv.colRefunded', 'csv.colStatus', 'csv.colInvoice'].map((k) => i18n.t(k, { ns: 'settings' }));
  const lines = rows.map((p) => {
    const cents = p.amountCents ?? p.amountUsd;
    return [
      formatDate(p.confirmedAt ?? p.createdAt),
      paymentDescription(p),
      String(cents),
      String(p.refundedCents ?? 0),
      (PAY_STATUS[p.status] ?? { text: p.status }).text,
      p.invoiceNumber ?? '',
    ]
      .map(cell)
      .join(',');
  });
  return `${BOM}${head.map(cell).join(',')}\r\n${lines.join('\r\n')}`;
}

export function downloadTextFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
