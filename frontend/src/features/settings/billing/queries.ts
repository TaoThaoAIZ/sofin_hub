import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import * as api from './api';

export const billingKeys = {
  summary: ['payments', 'billing-summary'] as const,
  allPayments: ['payments', 'my-payments', 'all'] as const,
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
