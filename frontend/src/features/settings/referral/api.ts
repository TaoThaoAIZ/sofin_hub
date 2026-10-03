import { apiGet, apiPost } from '../../../lib/api';
import type { CommissionDetail, ReferralKind, ReferralOverview, ReferralUsers } from './types';

export const fetchReferral = (kind: ReferralKind, signal?: AbortSignal) => apiGet<{ data: ReferralOverview }>('/me/referral', { kind }, signal).then((r) => r.data);
export const fetchReferralUsers = (kind: ReferralKind, all: boolean, signal?: AbortSignal) => apiGet<ReferralUsers>('/me/referral/users', { kind, all }, signal);
export const fetchCommissions = (userId: string, kind: ReferralKind, signal?: AbortSignal) =>
  apiGet<{ data: CommissionDetail }>(`/me/referral/users/${userId}/commissions`, { kind }, signal).then((r) => r.data);
export const remindUser = (userId: string, kind: ReferralKind) => apiPost<{ data: { sent: true } }>(`/me/referral/users/${userId}/remind?kind=${kind}`).then((r) => r.data);
