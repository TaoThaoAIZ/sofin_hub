import { apiGet, apiPost, apiPut } from '../../../lib/api';
import type { Bank, CommissionDetail, PayoutAccount, ReferralKind, ReferralOverview, ReferralUsers, WithdrawOverview, Withdrawal } from './types';

export const fetchReferral = (kind: ReferralKind, communityId?: string, signal?: AbortSignal) =>
  apiGet<{ data: ReferralOverview }>('/me/referral', { kind, ...(communityId ? { communityId } : {}) }, signal).then((r) => r.data);
export const fetchReferralUsers = (kind: ReferralKind, all: boolean, communityId?: string, signal?: AbortSignal) =>
  apiGet<ReferralUsers>('/me/referral/users', { kind, all, ...(communityId ? { communityId } : {}) }, signal);
export const fetchCommissions = (userId: string, kind: ReferralKind, communityId?: string, signal?: AbortSignal) =>
  apiGet<{ data: CommissionDetail }>(`/me/referral/users/${userId}/commissions`, { kind, ...(communityId ? { communityId } : {}) }, signal).then((r) => r.data);
export const remindUser = (userId: string, kind: ReferralKind) => apiPost<{ data: { sent: true } }>(`/me/referral/users/${userId}/remind?kind=${kind}`).then((r) => r.data);

// ---- Rút hoa hồng
export const fetchWithdraw = (signal?: AbortSignal, communityId?: string) => apiGet<{ data: WithdrawOverview }>('/me/referral/withdraw', communityId ? { communityId } : undefined, signal).then((r) => r.data);
export const fetchBanks = (signal?: AbortSignal) => apiGet<{ data: Bank[] }>('/me/referral/withdraw/banks', undefined, signal).then((r) => r.data);
export const saveAccount = (body: { bankBin: string; accountNumber: string; accountHolder: string }) =>
  apiPut<{ data: PayoutAccount }>('/me/referral/withdraw/account', body).then((r) => r.data);
export const requestWithdraw = (amountCents: number) => apiPost<{ data: Withdrawal }>('/me/referral/withdrawals', { amountCents }).then((r) => r.data);
export const fetchWithdrawal = (id: string, signal?: AbortSignal) => apiGet<{ data: Withdrawal }>(`/me/referral/withdrawals/${id}`, undefined, signal).then((r) => r.data);
