import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';
import type { PaymentMethodInput } from '../../lib/card';
import type { PayoutInput } from './types';

export const paymentKeys = {
  subscriptions: ['payments', 'my-subscriptions'] as const,
  payments: (page: number) => ['payments', 'my-payments', page] as const,
  paymentsAll: ['payments', 'my-payments'] as const,
  invoice: (id: string) => ['payments', 'invoice', id] as const,
  revenue: (courseId: string, params: object) => ['payments', courseId, 'revenue', params] as const,
  payouts: (courseId: string, page: number) => ['payments', courseId, 'payouts', page] as const,
};

// Idempotency-Key cho checkout: 1 uuid mỗi lần mở trang thanh toán của một khóa; bỏ đi khi thanh toán lỗi/xong
// để lần bấm lại tạo giao dịch mới thay vì nhận lại giao dịch cũ đã thất bại.
const checkoutKeys = new Map<string, string>();
const keyFor = (courseId: string, interval: string) => {
  // Khác kỳ hạn = giao dịch khác → khóa idempotency riêng theo (cộng đồng, kỳ hạn).
  const id = `${courseId}:${interval}`;
  let k = checkoutKeys.get(id);
  if (!k) {
    k = crypto.randomUUID();
    checkoutKeys.set(id, k);
  }
  return k;
};
const dropKeys = (courseId: string) => {
  for (const id of [...checkoutKeys.keys()]) if (id.startsWith(`${courseId}:`)) checkoutKeys.delete(id);
};

export const useCheckoutQuote = (courseId: string, interval: api.BillingInterval, enabled = true) =>
  useQuery({
    queryKey: ['payments', courseId, 'checkout-quote', interval],
    queryFn: ({ signal }) => api.fetchCheckoutQuote(courseId, interval, signal),
    enabled: enabled && !!courseId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });

export const useSubscription = (courseId: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: ['payments', courseId, 'subscription'],
    queryFn: ({ signal }) => api.fetchSubscription(courseId, accessToken!, signal),
    enabled: status === 'authenticated',
  });
};

export const useCheckout = (courseId: string) => {
  const { accessToken } = useAuth();
  useEffect(() => {
    dropKeys(courseId);
  }, [courseId]);
  return useMutation({
    mutationFn: (input: api.CheckoutInput) => {
      if (!accessToken) throw new Error('Bạn cần đăng nhập để thanh toán');
      return api.checkout(courseId, input, accessToken, keyFor(courseId, input.interval ?? 'monthly'));
    },
    onError: () => dropKeys(courseId),
  });
};

export const useConfirmPayment = () => {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentIntentId: string) => {
      if (!accessToken) throw new Error('Bạn cần đăng nhập để thanh toán');
      return api.confirmPayment(paymentIntentId, accessToken);
    },
    onSuccess: (p) => {
      dropKeys(p.courseId);
      void qc.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: () => checkoutKeys.clear(),
  });
};

export const useStartTrial = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input?: { interval?: api.BillingInterval; paymentMethod?: PaymentMethodInput }) => api.startTrial(courseId, input),
    // Dùng thử cấp quyền vào cộng đồng ngay -> làm mới mọi cache phụ thuộc quyền truy cập.
    onSuccess: () => qc.invalidateQueries(),
  });
};

export const useMySubscriptions = () => {
  const { status } = useAuth();
  return useQuery({
    queryKey: paymentKeys.subscriptions,
    queryFn: ({ signal }) => api.fetchMySubscriptions(signal),
    enabled: status === 'authenticated',
  });
};

export const useCancelSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { courseId: string; atPeriodEnd: boolean }) => api.cancelSubscription(v.courseId, v.atPeriodEnd),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
};

export const useResumeSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => api.resumeSubscription(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
};

export const useMyPayments = (page: number) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: paymentKeys.payments(page),
    queryFn: ({ signal }) => api.fetchMyPayments({ page, limit: 10 }, signal),
    enabled: status === 'authenticated',
  });
};

export const useInvoice = (paymentId: string | null) =>
  useQuery({
    queryKey: paymentKeys.invoice(paymentId ?? ''),
    queryFn: () => api.fetchInvoice(paymentId!),
    enabled: !!paymentId,
    retry: false,
  });

export const useRequestRefund = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { paymentId: string; reason: string }) => api.requestRefund(v.paymentId, v.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
};

export const useRevenue = (courseId: string, params: { from?: string; to?: string }) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: paymentKeys.revenue(courseId, params),
    queryFn: ({ signal }) => api.fetchRevenue(courseId, params, signal),
    enabled: status === 'authenticated' && !!courseId,
    retry: false,
  });
};

export const usePayouts = (courseId: string, page: number) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: paymentKeys.payouts(courseId, page),
    queryFn: ({ signal }) => api.fetchPayouts(courseId, { page, limit: 10 }, signal),
    enabled: status === 'authenticated' && !!courseId,
    retry: false,
  });
};

export const useRequestPayout = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PayoutInput) => api.requestPayout(courseId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments', courseId] }),
  });
};
