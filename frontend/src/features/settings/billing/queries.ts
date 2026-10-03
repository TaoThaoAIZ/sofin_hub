import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import * as api from './api';
import type { PaymentMethodInput } from '../../../lib/card';

export const billingKeys = {
  cards: ['payments', 'cards'] as const,
  summary: ['payments', 'billing-summary'] as const,
  allPayments: ['payments', 'my-payments', 'all'] as const,
};

export const useCards = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: billingKeys.cards, queryFn: ({ signal }) => api.fetchCards(signal), enabled: status === 'authenticated' });
};

export const useBillingSummary = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: billingKeys.summary, queryFn: ({ signal }) => api.fetchBillingSummary(signal), enabled: status === 'authenticated' });
};

/** Toàn bộ giao dịch (mọi trang) — chỉ nạp khi cần (CSV / hộp thoại gói). */
export const useAllPayments = (enabled: boolean) => {
  const { status } = useAuth();
  return useQuery({ queryKey: billingKeys.allPayments, queryFn: api.fetchAllPayments, enabled: enabled && status === 'authenticated' });
};

/** Mọi thay đổi thẻ ảnh hưởng cả thẻ, gói (thẻ gắn gói) và khối "lần trừ tiếp theo". */
const useRefreshBilling = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['payments'] });
};

export const useAddCard = () => {
  const refresh = useRefreshBilling();
  return useMutation({ mutationFn: (input: PaymentMethodInput) => api.addCard(input), onSuccess: refresh });
};
export const useReplaceCard = () => {
  const refresh = useRefreshBilling();
  return useMutation({ mutationFn: (v: { id: string; input: PaymentMethodInput }) => api.replaceCard(v.id, v.input), onSuccess: refresh });
};
export const useSetDefaultCard = () => {
  const refresh = useRefreshBilling();
  return useMutation({ mutationFn: (id: string) => api.setDefaultCard(id), onSuccess: refresh });
};
export const useDeleteCard = () => {
  const refresh = useRefreshBilling();
  return useMutation({ mutationFn: (id: string) => api.deleteCard(id), onSuccess: refresh });
};
