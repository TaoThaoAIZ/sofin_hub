import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import * as api from './api';
import type { ReferralKind } from './types';

export const referralKeys = {
  overview: (kind: ReferralKind, communityId?: string) => ['referral', 'overview', kind, communityId ?? null] as const,
  users: (kind: ReferralKind, all: boolean, communityId?: string) => ['referral', 'users', kind, all, communityId ?? null] as const,
  commissions: (userId: string, kind: ReferralKind, communityId?: string) => ['referral', 'commissions', userId, kind, communityId ?? null] as const,
};

export const useReferral = (kind: ReferralKind, communityId?: string) => {
  const { status } = useAuth();
  return useQuery({ queryKey: referralKeys.overview(kind, communityId), queryFn: ({ signal }) => api.fetchReferral(kind, communityId, signal), enabled: status === 'authenticated', placeholderData: keepPreviousData });
};

export const useReferralUsers = (kind: ReferralKind, all: boolean, communityId?: string) => {
  const { status } = useAuth();
  return useQuery({ queryKey: referralKeys.users(kind, all, communityId), queryFn: ({ signal }) => api.fetchReferralUsers(kind, all, communityId, signal), enabled: status === 'authenticated', placeholderData: keepPreviousData });
};

export const useCommissions = (userId: string | null, kind: ReferralKind, communityId?: string) =>
  useQuery({ queryKey: referralKeys.commissions(userId ?? '', kind, communityId), queryFn: ({ signal }) => api.fetchCommissions(userId!, kind, communityId, signal), enabled: !!userId, retry: false });

export const useRemind = () => useMutation({ mutationFn: (v: { userId: string; kind: ReferralKind }) => api.remindUser(v.userId, v.kind) });

// ---- Rút hoa hồng
export const withdrawKeys = { overview: ['referral', 'withdraw'] as const, banks: ['referral', 'banks'] as const };

export const useWithdraw = (communityId?: string) => {
  const { status } = useAuth();
  return useQuery({ queryKey: communityId ? [...withdrawKeys.overview, communityId] : withdrawKeys.overview, queryFn: ({ signal }) => api.fetchWithdraw(signal, communityId), enabled: status === 'authenticated' });
};
export const useBanks = () => useQuery({ queryKey: withdrawKeys.banks, queryFn: ({ signal }) => api.fetchBanks(signal), staleTime: Infinity });
export const useSaveAccount = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.saveAccount, onSuccess: () => qc.invalidateQueries({ queryKey: withdrawKeys.overview }) });
};
export const useRequestWithdraw = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.requestWithdraw, onSuccess: () => qc.invalidateQueries({ queryKey: withdrawKeys.overview }) });
};
/** Theo dõi 1 yêu cầu rút: hỏi lại mỗi 5 giây cho tới khi hết `requested` (giống màn chờ thanh toán chuyển khoản). */
export const useWithdrawalStatus = (id: string | null) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['referral', 'withdrawal', id],
    queryFn: async ({ signal }) => {
      const w = await api.fetchWithdrawal(id!, signal);
      if (w.status !== 'requested') void qc.invalidateQueries({ queryKey: withdrawKeys.overview });
      return w;
    },
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'requested' ? false : 5000),
  });
};
