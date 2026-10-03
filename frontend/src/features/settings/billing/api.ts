import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../../lib/api';
import type { PaymentMethodInput } from '../../../lib/card';
import { fetchMyPayments } from '../../payments/api';
import type { PaymentRecord } from '../../payments/types';

/** Thẻ đã lưu: chỉ brand/last4/hạn. `isDefault` do server quyết định. */
export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface BillingSummary {
  currency: 'USD';
  next: { amountCents: number; date: string; communityId: string; communityTitle: string; trialing: boolean } | null;
  monthlyTotalCents: number;
  activeCount: number;
}

export const fetchCards = (signal?: AbortSignal) => apiGet<{ data: SavedCard[] }>('/me/payment-methods', undefined, signal).then((r) => r.data);
export const addCard = (input: PaymentMethodInput) => apiPost<{ data: SavedCard }>('/me/payment-methods', input).then((r) => r.data);
export const replaceCard = (id: string, input: PaymentMethodInput) => apiPut<{ data: SavedCard }>(`/me/payment-methods/${id}`, input).then((r) => r.data);
export const setDefaultCard = (id: string) => apiPatch<{ data: SavedCard[] }>(`/me/payment-methods/${id}/default`).then((r) => r.data);
export const deleteCard = (id: string) => apiDelete<{ data: SavedCard[] }>(`/me/payment-methods/${id}`).then((r) => r.data);
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
