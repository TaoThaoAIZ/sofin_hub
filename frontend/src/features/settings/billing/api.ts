import { apiGet } from '../../../lib/api';
import { fetchMyPayments } from '../../payments/api';
import type { PaymentRecord } from '../../payments/types';

export interface BillingSummary {
  currency: 'VND';
  next: { amountCents: number; date: string; communityId: string; communityTitle: string; trialing: boolean } | null;
  monthlyTotalCents: number;
  activeCount: number;
}

export const fetchBillingSummary = (signal?: AbortSignal) => apiGet<{ data: BillingSummary }>('/me/billing-summary', undefined, signal).then((r) => r.data);

/** Gom toàn bộ lịch sử thanh toán (tối đa 20 trang x 100) cho "Tải CSV" và tìm giao dịch để hoàn tiền. */
export async function fetchAllPayments(): Promise<PaymentRecord[]> {
  const out: PaymentRecord[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await fetchMyPayments({ page, limit: 100 });
    out.push(...r.data);
    if (page >= r.meta.totalPages) break;
  }
  return out;
}
