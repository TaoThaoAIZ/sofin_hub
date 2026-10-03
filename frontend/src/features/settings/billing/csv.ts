import { formatDate } from '../../../lib/datetime';
import type { PaymentRecord } from '../../payments/types';

export const PAY_STATUS: Record<string, { text: string; color: string; dot: string }> = {
  succeeded: { text: 'Đã thanh toán', color: '#15803d', dot: '#16a34a' },
  pending: { text: 'Đang chờ', color: '#b45309', dot: '#f59e0b' },
  failed: { text: 'Thất bại', color: '#b91c1c', dot: '#dc2626' },
  refunded: { text: 'Đã hoàn tiền', color: '#57534e', dot: '#a8a29e' },
};

export function paymentDescription(p: PaymentRecord): string {
  const kind = p.kind === 'renewal' ? 'Gia hạn' : 'Thanh toán đầu';
  return `${p.courseTitle ?? p.courseId} · ${kind}${p.interval === 'annual' ? ' · gói năm' : ''}`;
}

/** BOM UTF-8 để Excel mở đúng tiếng Việt. */
const BOM = String.fromCharCode(0xfeff);
const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;

/** CSV lịch sử thanh toán (BOM để Excel mở đúng tiếng Việt). Số tiền theo USD, 2 chữ số thập phân. */
export function buildPaymentsCsv(rows: PaymentRecord[]): string {
  const head = ['Ngày', 'Mô tả', 'Số tiền (USD)', 'Đã hoàn (USD)', 'Trạng thái', 'Số hóa đơn'];
  const lines = rows.map((p) => {
    const cents = p.amountCents ?? Math.round(p.amountUsd * 100);
    return [
      formatDate(p.confirmedAt ?? p.createdAt),
      paymentDescription(p),
      (cents / 100).toFixed(2),
      ((p.refundedCents ?? 0) / 100).toFixed(2),
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
