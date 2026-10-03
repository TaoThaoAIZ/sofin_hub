import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import * as api from './api';
import type { ReferralKind } from './types';

export const referralKeys = {
  overview: (kind: ReferralKind) => ['referral', 'overview', kind] as const,
  users: (kind: ReferralKind, all: boolean) => ['referral', 'users', kind, all] as const,
  commissions: (userId: string, kind: ReferralKind) => ['referral', 'commissions', userId, kind] as const,
};

export const useReferral = (kind: ReferralKind) => {
  const { status } = useAuth();
  return useQuery({ queryKey: referralKeys.overview(kind), queryFn: ({ signal }) => api.fetchReferral(kind, signal), enabled: status === 'authenticated', placeholderData: keepPreviousData });
};

export const useReferralUsers = (kind: ReferralKind, all: boolean) => {
  const { status } = useAuth();
  return useQuery({ queryKey: referralKeys.users(kind, all), queryFn: ({ signal }) => api.fetchReferralUsers(kind, all, signal), enabled: status === 'authenticated', placeholderData: keepPreviousData });
};

export const useCommissions = (userId: string | null, kind: ReferralKind) =>
  useQuery({ queryKey: referralKeys.commissions(userId ?? '', kind), queryFn: ({ signal }) => api.fetchCommissions(userId!, kind, signal), enabled: !!userId, retry: false });

export const useRemind = () => useMutation({ mutationFn: (v: { userId: string; kind: ReferralKind }) => api.remindUser(v.userId, v.kind) });
