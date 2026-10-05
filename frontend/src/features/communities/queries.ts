import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { courseKeys } from '../courses/queries';
import * as api from './api';
import type { AssignableRole, JoinRequestStatus, ReportReason, UpdateCommunityInput } from './types';

const keys = {
  joinRequests: (courseId: string, status?: JoinRequestStatus) => ['communities', courseId, 'join-requests', status ?? 'all'] as const,
  invites: (courseId: string) => ['communities', courseId, 'invites'] as const,
  bans: (courseId: string) => ['communities', courseId, 'bans'] as const,
  invitePreview: (code: string) => ['communities', 'invite', code] as const,
  reviews: (courseId: string, page: number) => ['communities', courseId, 'reviews', page] as const,
};

/** Sau khi vai trò/thành viên thay đổi: làm mới danh sách thành viên + chi tiết cộng đồng (số liệu, viewerRole). */
function useRefreshCommunity(courseId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['community', courseId, 'members'] });
    void qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
  };
}

// ---- Tạo & quản trị cộng đồng ----
export const useCreateCommunity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCommunity,
    onSuccess: (course) => {
      qc.setQueryData(courseKeys.detail(course.id), course);
      void qc.invalidateQueries({ queryKey: [...courseKeys.all, 'list'] });
      void qc.invalidateQueries({ queryKey: courseKeys.categories });
    },
  });
};

export const useUpdateCommunity = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCommunityInput) => api.updateCommunity(courseId, input),
    onSuccess: (course) => {
      qc.setQueryData(courseKeys.detail(courseId), course);
      void qc.invalidateQueries({ queryKey: [...courseKeys.all, 'list'] });
    },
  });
};

export const useDeleteCommunity = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteCommunity(courseId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: courseKeys.detail(courseId) });
      void qc.invalidateQueries({ queryKey: [...courseKeys.all, 'list'] });
    },
  });
};

export const useLockCommunity = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lock: true; reason: string } | { lock: false }) =>
      vars.lock ? api.lockCommunity(courseId, vars.reason) : api.unlockCommunity(courseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
      void qc.invalidateQueries({ queryKey: [...courseKeys.all, 'list'] });
    },
  });
};

export const useTransferOwnership = (courseId: string) => {
  const refresh = useRefreshCommunity(courseId);
  return useMutation({ mutationFn: (userId: string) => api.transferOwnership(courseId, userId), onSuccess: refresh });
};

// ---- Yêu cầu tham gia ----
export const useCreateJoinRequest = (courseId: string) =>
  useMutation({ mutationFn: (input: api.JoinRequestInput) => api.createJoinRequest(courseId, input) });

export const useCancelJoinRequest = () => useMutation({ mutationFn: (requestId: string) => api.cancelJoinRequest(requestId) });

export const useJoinRequests = (courseId: string, status: JoinRequestStatus | undefined, enabled: boolean) => {
  const { status: authStatus } = useAuth();
  return useQuery({
    queryKey: keys.joinRequests(courseId, status),
    queryFn: ({ signal }) => api.fetchJoinRequests(courseId, status, signal),
    enabled: enabled && authStatus === 'authenticated',
  });
};

export const useDecideJoinRequest = (courseId: string) => {
  const qc = useQueryClient();
  const refresh = useRefreshCommunity(courseId);
  return useMutation({
    mutationFn: (vars: { requestId: string; action: 'approve' | 'reject' }) => api.decideJoinRequest(vars.requestId, vars.action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['communities', courseId, 'join-requests'] });
      refresh();
    },
    // 409 (đã xử lý) vẫn cần làm mới danh sách để hiện trạng thái thật
    onError: () => void qc.invalidateQueries({ queryKey: ['communities', courseId, 'join-requests'] }),
  });
};

// ---- Lời mời ----
export const useInvites = (courseId: string, enabled: boolean) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.invites(courseId),
    queryFn: ({ signal }) => api.fetchInvites(courseId, signal),
    enabled: enabled && status === 'authenticated',
  });
};

export const useCreateInvite = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { maxUses?: number; expiresAt?: string }) => api.createInvite(courseId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites(courseId) }),
  });
};

export const useRevokeInvite = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.revokeInvite(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites(courseId) }),
  });
};

export const useInvitePreview = (code: string) =>
  useQuery({
    queryKey: keys.invitePreview(code),
    queryFn: ({ signal }) => api.fetchInvitePreview(code, signal),
    retry: false,
  });

export const useAcceptInvite = (code: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.acceptInvite(code),
    onSuccess: ({ courseId }) => {
      void qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
      void qc.invalidateQueries({ queryKey: keys.invitePreview(code) });
    },
  });
};

// ---- Thành viên ----
export const useChangeMemberRole = (courseId: string) => {
  const refresh = useRefreshCommunity(courseId);
  return useMutation({
    mutationFn: (vars: { userId: string; role: AssignableRole }) => api.changeMemberRole(courseId, vars.userId, vars.role),
    onSuccess: refresh,
  });
};

export const useKickMember = (courseId: string) => {
  const refresh = useRefreshCommunity(courseId);
  return useMutation({ mutationFn: (userId: string) => api.kickMember(courseId, userId), onSuccess: refresh });
};

export const useBanMember = (courseId: string) => {
  const qc = useQueryClient();
  const refresh = useRefreshCommunity(courseId);
  return useMutation({
    mutationFn: (vars: { userId: string; reason: string }) => api.banMember(courseId, vars.userId, vars.reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.bans(courseId) });
      refresh();
    },
  });
};

export const useBans = (courseId: string, enabled: boolean) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.bans(courseId),
    queryFn: ({ signal }) => api.fetchBans(courseId, signal),
    enabled: enabled && status === 'authenticated',
  });
};

export const useUnbanMember = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.unbanMember(courseId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bans(courseId) }),
  });
};

export const useReportMember = (courseId: string) =>
  useMutation({
    mutationFn: (vars: { userId: string; reason: ReportReason; detail?: string }) =>
      api.reportMember(courseId, vars.userId, { reason: vars.reason, detail: vars.detail }),
  });

// ---- Đánh giá ----
export const REVIEWS_PAGE_SIZE = 5;

export const useReviews = (courseId: string, page: number) =>
  useQuery({
    queryKey: keys.reviews(courseId, page),
    queryFn: ({ signal }) => api.fetchReviews(courseId, page, REVIEWS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

/** Lưu/xóa đánh giá đổi cả điểm trung bình trong chi tiết cộng đồng → làm mới cả hai. */
function useRefreshReviews(courseId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['communities', courseId, 'reviews'] });
    void qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
  };
}

export const useSaveReview = (courseId: string) => {
  const refresh = useRefreshReviews(courseId);
  return useMutation({ mutationFn: (body: { rating: number; text: string }) => api.saveReview(courseId, body), onSuccess: refresh });
};

export const useDeleteMyReview = (courseId: string) => {
  const refresh = useRefreshReviews(courseId);
  return useMutation({ mutationFn: () => api.deleteMyReview(courseId), onSuccess: refresh });
};

export const useDeleteReview = (courseId: string) => {
  const refresh = useRefreshReviews(courseId);
  return useMutation({ mutationFn: (reviewId: string) => api.deleteReview(reviewId), onSuccess: refresh });
};
