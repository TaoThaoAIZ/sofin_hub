import { apiGet, apiPost } from '../../lib/api';
import type {
  CheckoutQuote,
  Invoice,
  PageMeta,
  PaymentIntent,
  PaymentRecord,
  Payout,
  PayoutInput,
  RefundRequest,
  RevenueSummary,
  Subscription,
  SubscriptionStatus,
} from './types';

export type BillingInterval = 'monthly' | 'annual';

export interface CheckoutInput {
  interval?: BillingInterval;
}

export const checkout = (courseId: string, input: CheckoutInput, token: string, idempotencyKey?: string) =>
  apiPost<{ data: PaymentIntent }>(
    `/communities/${courseId}/checkout`,
    { interval: input.interval },
    { token, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined },
  ).then((r) => r.data);

export interface ModulePurchaseQuote {
  communityId: string;
  moduleId: string;
  title: string;
  currency: string;
  priceCents: number;
  priceUsd: number;
  oneTime: boolean;
  provider: string;
  canPurchase: boolean;
  /** Mã lý do không mua được (JOIN_REQUIRED | ALREADY_OWNED | STAFF_EXEMPT | FORBIDDEN...) hoặc null. */
  blocked: string | null;
  owned: boolean;
}

export const fetchModuleQuote = (communityId: string, moduleId: string, signal?: AbortSignal) =>
  apiGet<{ data: ModulePurchaseQuote }>(`/communities/${communityId}/modules/${moduleId}/purchase-quote`, undefined, signal).then((r) => r.data);

export const purchaseModule = (communityId: string, moduleId: string, input: { idempotencyKey: string }) =>
  apiPost<{ data: PaymentIntent }>(`/communities/${communityId}/modules/${moduleId}/purchase`, input).then((r) => r.data);

export const fetchPayment = (paymentId: string, signal?: AbortSignal) =>
  apiGet<{ data: PaymentIntent }>(`/payments/${paymentId}`, undefined, signal).then((r) => r.data);

export const confirmPayment = (paymentIntentId: string, token: string) =>
  apiPost<{ data: PaymentIntent }>(`/payments/${paymentIntentId}/confirm`, undefined, { token }).then((r) => r.data);

export const fetchSubscription = (courseId: string, token: string, signal?: AbortSignal) =>
  apiGet<{ data: SubscriptionStatus }>(`/communities/${courseId}/subscription`, undefined, signal, { token }).then((r) => r.data);

export const fetchCheckoutQuote = (courseId: string, interval: BillingInterval, signal?: AbortSignal) =>
  apiGet<{ data: CheckoutQuote }>(`/communities/${courseId}/checkout-quote`, { interval }, signal).then((r) => r.data);

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
