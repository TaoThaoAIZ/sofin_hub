import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';
import type { PayoutStatus, RefundStatus } from '../payments/types';

/**
 * Cách xác định Platform Admin ở FE: AuthUser không có cờ, nên gọi thử một endpoint admin nhẹ
 * (GET /admin/refunds?limit=1). 200 = admin; 403 = không phải admin (mọi lỗi khác coi như không phải, không hiện menu).
 * Quyền thật vẫn do BE quyết định — đây chỉ là gợi ý UI.
 */
export const useIsPlatformAdmin = () => {
  const { status, user } = useAuth();
  const q = useQuery({
    queryKey: ['admin', 'is-admin', user?.id],
    queryFn: async ({ signal }) => {
      try {
        await api.fetchAdminRefunds({ page: 1, limit: 1 }, signal);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) return false;
        throw e;
      }
    },
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 10 * 60_000,
  });
  return { isAdmin: q.data === true, isLoading: q.isPending && status === 'authenticated' };
};

export const useAdminRefunds = (status: RefundStatus | undefined, page: number) =>
  useQuery({
    queryKey: ['admin', 'refunds', status, page],
    queryFn: ({ signal }) => api.fetchAdminRefunds({ status, page, limit: 10 }, signal),
    retry: false,
  });

export const useResolveRefund = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'reject'; note?: string }) => api.resolveRefund(v.id, v.action, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'refunds'] }),
  });
};

export const useAdminPayouts = (status: PayoutStatus | undefined, page: number) =>
  useQuery({
    queryKey: ['admin', 'payouts', status, page],
    queryFn: ({ signal }) => api.fetchAdminPayouts({ status, page, limit: 10 }, signal),
    retry: false,
  });

export const useResolvePayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'mark_paid' | 'reject'; note?: string }) => api.resolvePayout(v.id, v.action, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'payouts'] }),
  });
};

export const useLockCommunity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { courseId: string; lock: boolean; reason?: string }) => (v.lock ? api.lockCommunity(v.courseId, v.reason ?? '') : api.unlockCommunity(v.courseId)),
    onSuccess: () => qc.invalidateQueries(),
  });
};
