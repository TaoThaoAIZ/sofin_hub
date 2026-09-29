import { apiGet, apiPatch, apiPost } from '../../lib/api';
import type { PageMeta, Payout, PayoutStatus, RefundRequest, RefundStatus } from '../payments/types';

export const fetchAdminRefunds = (params: { status?: RefundStatus; page: number; limit: number }, signal?: AbortSignal) =>
  apiGet<{ data: RefundRequest[]; meta: PageMeta }>('/admin/refunds', params, signal);

export const resolveRefund = (id: string, action: 'approve' | 'reject', note?: string) =>
  apiPatch<{ data: RefundRequest }>(`/admin/refunds/${id}`, { action, ...(note ? { note } : {}) }).then((r) => r.data);

export const fetchAdminPayouts = (params: { status?: PayoutStatus; page: number; limit: number }, signal?: AbortSignal) =>
  apiGet<{ data: Payout[]; meta: PageMeta }>('/admin/payouts', params, signal);

export const resolvePayout = (id: string, action: 'approve' | 'mark_paid' | 'reject', note?: string) =>
  apiPatch<{ data: Payout }>(`/admin/payouts/${id}`, { action, ...(note ? { note } : {}) }).then((r) => r.data);

export const lockCommunity = (courseId: string, reason: string) =>
  apiPost<{ data: { id: string; locked: boolean; reason?: string } }>(`/admin/courses/${encodeURIComponent(courseId)}/lock`, { reason }).then((r) => r.data);

export const unlockCommunity = (courseId: string) =>
  apiPost<{ data: { id: string; locked: boolean } }>(`/admin/courses/${encodeURIComponent(courseId)}/unlock`).then((r) => r.data);
