import { apiGet, apiPost } from '../../lib/api';
import type {
  Invoice,
  PageMeta,
  PaymentIntent,
  PaymentMethod,
  PaymentRecord,
  Payout,
  PayoutInput,
  RefundRequest,
  RevenueSummary,
  Subscription,
  SubscriptionStatus,
} from './types';

export const checkout = (courseId: string, method: PaymentMethod, token: string, idempotencyKey?: string) =>
  apiPost<{ data: PaymentIntent }>(
    `/communities/${courseId}/checkout`,
    { method },
    { token, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined },
  ).then((r) => r.data);

export const confirmPayment = (paymentIntentId: string, token: string) =>
  apiPost<{ data: PaymentIntent }>(`/payments/${paymentIntentId}/confirm`, undefined, { token }).then((r) => r.data);

export const fetchSubscription = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: SubscriptionStatus }>(`/communities/${courseId}/subscription`, undefined, signal, { token }).then((r) => r.data);

export const startTrial = (courseId: string) => apiPost<{ data: Subscription }>(`/communities/${courseId}/trial`).then((r) => r.data);

export const fetchMySubscriptions = (signal?: AbortSignal) =>
  apiGet<{ data: Subscription[] }>('/me/subscriptions', undefined, signal).then((r) => r.data);

export const cancelSubscription = (courseId: string, atPeriodEnd: boolean) =>
  apiPost<{ data: Subscription }>(`/communities/${courseId}/subscription/cancel`, { atPeriodEnd }).then((r) => r.data);

export const resumeSubscription = (courseId: string) =>
  apiPost<{ data: Subscription }>(`/communities/${courseId}/subscription/resume`).then((r) => r.data);

export const fetchMyPayments = (params: { page: number; limit: number }, signal?: AbortSignal) =>
  apiGet<{ data: PaymentRecord[]; meta: PageMeta }>('/me/payments', params, signal);

export const fetchInvoice = (paymentId: string) => apiGet<{ data: Invoice }>(`/payments/${paymentId}/invoice`).then((r) => r.data);

export const requestRefund = (paymentId: string, reason: string) =>
  apiPost<{ data: RefundRequest }>(`/payments/${paymentId}/refund-request`, { reason }).then((r) => r.data);

export const fetchRevenue = (courseId: string, params: { from?: string; to?: string }, signal?: AbortSignal) =>
  apiGet<{ data: RevenueSummary }>(`/communities/${courseId}/revenue`, params, signal).then((r) => r.data);

export const requestPayout = (courseId: string, body: PayoutInput) =>
  apiPost<{ data: Payout }>(`/communities/${courseId}/payouts`, body).then((r) => r.data);

export const fetchPayouts = (courseId: string, params: { page: number; limit: number }, signal?: AbortSignal) =>
  apiGet<{ data: Payout[]; meta: PageMeta }>(`/communities/${courseId}/payouts`, params, signal);
