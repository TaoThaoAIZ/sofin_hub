import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import type { PayoutStatus, RefundStatus } from '../payments/types';
import * as api from './api';
import type { CaseQuery } from './api';
import type { DecisionType } from './types';

/**
 * Cách xác định Platform Admin ở FE: gọi GET /admin/me. 200 = admin; 403 = không phải admin.
 * Quyền thật vẫn do BE quyết định — đây chỉ để bảo vệ route/hiện menu.
 */
export const useAdminMe = () => {
  const { status, user } = useAuth();
  return useQuery({
    queryKey: ['admin-session', user?.id],
    queryFn: async ({ signal }) => {
      try {
        return await api.fetchAdminMe(signal);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 401)) return null;
        throw e;
      }
    },
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 10 * 60_000,
  });
};

export const useIsPlatformAdmin = () => {
  const { status } = useAuth();
  const q = useAdminMe();
  return { isAdmin: !!q.data, isLoading: q.isPending && status === 'authenticated', me: q.data ?? null };
};

/** Kiểm tra quyền của nhân viên hiện tại (khóa quyền ở GET /admin/me). BE chưa trả `permissions` = đủ quyền. */
export const useCan = () => {
  const { me } = useIsPlatformAdmin();
  return (perm?: string) => !perm || !me?.permissions || me.permissions.includes(perm);
};

/* ---------------- Hoàn tiền / rút tiền / khóa (có sẵn) ---------------- */

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
};

export const useLockCommunity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { courseId: string; lock: boolean; reason?: string }) => (v.lock ? api.lockCommunity(v.courseId, v.reason ?? '') : api.unlockCommunity(v.courseId)),
    onSuccess: () => qc.invalidateQueries(),
  });
};

/* ---------------- Đọc dữ liệu ---------------- */

export const useDashboard = (range: number) =>
  useQuery({ queryKey: ['admin', 'dashboard', range], queryFn: ({ signal }) => api.fetchDashboard(range, signal), placeholderData: keepPreviousData });

export const useCommunitySummary = () => useQuery({ queryKey: ['admin', 'communities', 'summary'], queryFn: ({ signal }) => api.fetchCommunitySummary(signal) });

export type ListQuery = Record<string, string | number | undefined>;

export const useAdminCommunities = (q: ListQuery, enabled = true) =>
  useQuery({ queryKey: ['admin', 'communities', 'list', q], queryFn: ({ signal }) => api.fetchCommunities(q, signal), placeholderData: keepPreviousData, enabled });

export const useReviewQueue = (q: ListQuery) =>
  useQuery({ queryKey: ['admin', 'communities', 'review', q], queryFn: ({ signal }) => api.fetchReviewQueue(q, signal), placeholderData: keepPreviousData });

export const useTrash = (q: ListQuery) =>
  useQuery({ queryKey: ['admin', 'communities', 'trash', q], queryFn: ({ signal }) => api.fetchTrash(q, signal), placeholderData: keepPreviousData });

export const useCommunityDetail = (id: string) =>
  useQuery({ queryKey: ['admin', 'communities', 'detail', id], queryFn: ({ signal }) => api.fetchCommunityDetail(id, signal), enabled: !!id });

export const useCommunityMembers = (id: string, q: ListQuery) =>
  useQuery({ queryKey: ['admin', 'communities', 'members', id, q], queryFn: ({ signal }) => api.fetchCommunityMembers(id, q, signal), placeholderData: keepPreviousData, enabled: !!id });

export const useCommunityReports = (id: string, q: ListQuery, enabled = true) =>
  useQuery({ queryKey: ['admin', 'communities', 'reports', id, q], queryFn: ({ signal }) => api.fetchCommunityReports(id, q, signal), placeholderData: keepPreviousData, enabled: enabled && !!id });

export const useUserSummary = () => useQuery({ queryKey: ['admin', 'users', 'summary'], queryFn: ({ signal }) => api.fetchUserSummary(signal) });

export const useAdminUsers = (q: ListQuery, enabled = true) =>
  useQuery({ queryKey: ['admin', 'users', 'list', q], queryFn: ({ signal }) => api.fetchUsers(q, signal), placeholderData: keepPreviousData, enabled });

export const useUserDetail = (id: string) => useQuery({ queryKey: ['admin', 'users', 'detail', id], queryFn: ({ signal }) => api.fetchUserDetail(id, signal), enabled: !!id });

export const useUserCommunities = (id: string, q: ListQuery, enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'users', 'communities', id, q], queryFn: ({ signal }) => api.fetchUserCommunities(id, q, signal), enabled: enabled && !!id, placeholderData: keepPreviousData });

export const useUserActivity = (id: string, q: ListQuery, enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'users', 'activity', id, q], queryFn: ({ signal }) => api.fetchUserActivity(id, q, signal), enabled: enabled && !!id, placeholderData: keepPreviousData });

export const useUserPurchases = (id: string, q: ListQuery, enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'users', 'purchases', id, q], queryFn: ({ signal }) => api.fetchUserPurchases(id, q, signal), enabled: enabled && !!id, placeholderData: keepPreviousData });

export const useUserReports = (id: string, q: ListQuery, enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'users', 'reports', id, q], queryFn: ({ signal }) => api.fetchUserReports(id, q, signal), enabled: enabled && !!id, placeholderData: keepPreviousData });

export const useModerationSummary = (enabled = true) => useQuery({ queryKey: ['admin', 'moderation', 'summary'], queryFn: ({ signal }) => api.fetchModerationSummary(signal), enabled });

export const useAssignees = () => useQuery({ queryKey: ['admin', 'moderation', 'assignees'], queryFn: ({ signal }) => api.fetchAssignees(signal), staleTime: 5 * 60_000 });

export const useCases = (q: CaseQuery, enabled = true) =>
  useQuery({ queryKey: ['admin', 'moderation', 'cases', q], queryFn: ({ signal }) => api.fetchCases(q, signal), placeholderData: keepPreviousData, enabled });

export const useCaseDetail = (id: string) => useQuery({ queryKey: ['admin', 'moderation', 'case', id], queryFn: ({ signal }) => api.fetchCaseDetail(id, signal), enabled: !!id });

export const useDecisions = (q: { type?: DecisionType; q?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: ['admin', 'moderation', 'decisions', q], queryFn: ({ signal }) => api.fetchDecisions(q, signal), placeholderData: keepPreviousData });

export const useAuditLogs = (q: ListQuery) =>
  useQuery({ queryKey: ['admin', 'audit', q], queryFn: ({ signal }) => api.fetchAuditLogs(q, signal), placeholderData: keepPreviousData });

/* ---------------- Ghi dữ liệu: mọi thao tác xong đều làm mới toàn bộ cache ['admin'] ---------------- */

function useAdminMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }) });
}

export const useApproveCommunity = () => useAdminMutation((v: { id: string; note?: string }) => api.approveCommunity(v.id, v.note));
export const useRequestCommunityChanges = () => useAdminMutation((v: { id: string; note: string }) => api.requestCommunityChanges(v.id, v.note));
export const useRejectCommunity = () => useAdminMutation((v: { id: string; reason: string; note?: string }) => api.rejectCommunity(v.id, v.reason, v.note));
export const useSuspendCommunity = () => useAdminMutation((v: { id: string } & api.TimedBody) => api.suspendCommunity(v.id, { reason: v.reason, duration: v.duration, note: v.note }));
export const useRestoreCommunity = () => useAdminMutation((v: { id: string; note?: string }) => api.restoreCommunity(v.id, v.note));
export const useDeleteCommunity = () => useAdminMutation((v: { id: string; reason: string; note?: string }) => api.deleteCommunity(v.id, v.reason, v.note));
export const useUndeleteCommunity = () => useAdminMutation((v: { id: string; note?: string }) => api.undeleteCommunity(v.id, v.note));

export const useRestrictUser = () => useAdminMutation((v: { id: string } & api.RestrictBody) => api.restrictUser(v.id, { reason: v.reason, restrictions: v.restrictions, duration: v.duration, note: v.note }));
export const useSuspendUser = () => useAdminMutation((v: { id: string } & api.SuspendBody) => api.suspendUser(v.id, { reason: v.reason, duration: v.duration, note: v.note, notify: v.notify }));
export const useBanUser = () => useAdminMutation((v: { id: string } & api.BanBody) => api.banUser(v.id, { reason: v.reason, evidence: v.evidence, note: v.note }));
export const useReinstateUser = () => useAdminMutation((v: { id: string; note?: string }) => api.reinstateUser(v.id, v.note));
export const useWarnUser = () => useAdminMutation((v: { id: string; reason: string; message: string }) => api.warnUser(v.id, { reason: v.reason, message: v.message }));
export const useRevokeSession = () => useAdminMutation((v: { id: string; sid: string }) => api.revokeUserSession(v.id, v.sid));

export const useAssignCase = () => useAdminMutation((v: { id: string; adminId?: string | null }) => api.assignCase(v.id, v.adminId));
export const useWarnCase = () => useAdminMutation((v: { id: string; message: string; reason?: string; closeCase?: boolean }) => api.warnCase(v.id, { message: v.message, reason: v.reason, closeCase: v.closeCase }));
export const useRemoveCaseContent = () => useAdminMutation((v: { id: string; reason: string; notifyAuthor?: boolean; closeCase?: boolean }) => api.removeCaseContent(v.id, { reason: v.reason, notifyAuthor: v.notifyAuthor, closeCase: v.closeCase }));
export const useRestrictCaseUser = () => useAdminMutation((v: { id: string } & api.RestrictBody) => api.restrictCaseUser(v.id, { reason: v.reason, restrictions: v.restrictions, duration: v.duration, note: v.note }));
export const useSuspendCaseUser = () => useAdminMutation((v: { id: string } & api.SuspendBody) => api.suspendCaseUser(v.id, { reason: v.reason, duration: v.duration, note: v.note, notify: v.notify }));
export const useBanCaseUser = () => useAdminMutation((v: { id: string } & api.BanBody) => api.banCaseUser(v.id, { reason: v.reason, evidence: v.evidence, note: v.note }));
export const useDismissCase = () => useAdminMutation((v: { id: string; note?: string }) => api.dismissCase(v.id, v.note));
export const useEscalateCase = () => useAdminMutation((v: { id: string; note?: string }) => api.escalateCase(v.id, v.note));
export const useResolveCase = () => useAdminMutation((v: { id: string; note?: string }) => api.resolveCase(v.id, v.note));
