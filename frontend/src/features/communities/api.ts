import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import type { CourseDetail } from '../courses/types';
import type {
  AssignableRole,
  BanRow,
  CreateCommunityInput,
  Invite,
  InvitePreview,
  JoinRequest,
  JoinRequestStatus,
  JoinRequestWithUser,
  ReportReason,
  ReviewList,
  Review,
  UpdateCommunityInput,
} from './types';

// Access token do lib/api.ts tự gắn (AuthContext đồng bộ), nên các hàm dưới không cần truyền token.

// ---- Tạo & quản trị cộng đồng ----
export const createCommunity = (input: CreateCommunityInput) =>
  apiPost<{ data: CourseDetail }>('/communities', input).then((r) => r.data);

export const updateCommunity = (courseId: string, input: UpdateCommunityInput) =>
  apiPatch<{ data: CourseDetail }>(`/courses/${courseId}`, input).then((r) => r.data);

export const deleteCommunity = (courseId: string) => apiDelete<{ data: { deleted: boolean } }>(`/courses/${courseId}`);

export const lockCommunity = (courseId: string, reason: string) =>
  apiPost<{ data: { id: string; locked: boolean; reason: string } }>(`/admin/courses/${courseId}/lock`, { reason });

export const unlockCommunity = (courseId: string) =>
  apiPost<{ data: { id: string; locked: boolean } }>(`/admin/courses/${courseId}/unlock`);

export const transferOwnership = (courseId: string, userId: string) =>
  apiPost<{ data: { ownerId: string } }>(`/courses/${courseId}/transfer-ownership`, { userId });

// ---- Yêu cầu tham gia ----
export const createJoinRequest = (courseId: string, message: string) =>
  apiPost<{ data: JoinRequest }>(`/courses/${courseId}/join-requests`, { message }).then((r) => r.data);

export const cancelJoinRequest = (requestId: string) => apiDelete<{ data: { cancelled: boolean } }>(`/join-requests/${requestId}`);

export const fetchJoinRequests = (courseId: string, status?: JoinRequestStatus, signal?: AbortSignal) =>
  apiGet<{ data: JoinRequestWithUser[] }>(`/courses/${courseId}/join-requests`, { status }, signal).then((r) => r.data);

export const decideJoinRequest = (requestId: string, action: 'approve' | 'reject') =>
  apiPost<{ data: JoinRequest }>(`/join-requests/${requestId}/${action}`).then((r) => r.data);

// ---- Lời mời ----
export const fetchInvites = (courseId: string, signal?: AbortSignal) =>
  apiGet<{ data: Invite[] }>(`/courses/${courseId}/invites`, undefined, signal).then((r) => r.data);

export const createInvite = (courseId: string, input: { maxUses?: number; expiresAt?: string }) =>
  apiPost<{ data: Invite }>(`/courses/${courseId}/invites`, input).then((r) => r.data);

export const revokeInvite = (code: string) => apiDelete<{ data: { revoked: boolean } }>(`/invites/${code}`);

export const fetchInvitePreview = (code: string, signal?: AbortSignal) =>
  apiGet<{ data: InvitePreview }>(`/invites/${code}`, undefined, signal).then((r) => r.data);

export const acceptInvite = (code: string) =>
  apiPost<{ data: { courseId: string; joined: boolean } }>(`/invites/${code}/accept`).then((r) => r.data);

// ---- Thành viên ----
export const changeMemberRole = (courseId: string, userId: string, role: AssignableRole) =>
  apiPatch<{ data: { userId: string; role: AssignableRole } }>(`/courses/${courseId}/members/${userId}/role`, { role });

export const kickMember = (courseId: string, userId: string) =>
  apiDelete<{ data: { removed: boolean } }>(`/courses/${courseId}/members/${userId}`);

export const banMember = (courseId: string, userId: string, reason: string) =>
  apiPost<{ data: { banned: boolean } }>(`/courses/${courseId}/members/${userId}/ban`, { reason });

export const unbanMember = (courseId: string, userId: string) =>
  apiDelete<{ data: { banned: boolean } }>(`/courses/${courseId}/members/${userId}/ban`);

export const fetchBans = (courseId: string, signal?: AbortSignal) =>
  apiGet<{ data: BanRow[] }>(`/courses/${courseId}/bans`, undefined, signal).then((r) => r.data);

export const reportMember = (courseId: string, userId: string, body: { reason: ReportReason; detail?: string }) =>
  apiPost<unknown>(`/courses/${courseId}/members/${userId}/report`, body);

// ---- Đánh giá ----
export const fetchReviews = (courseId: string, page: number, limit: number, signal?: AbortSignal) =>
  apiGet<ReviewList>(`/courses/${courseId}/reviews`, { page, limit }, signal);

export const saveReview = (courseId: string, body: { rating: number; text: string }) =>
  apiPost<{ data: Review }>(`/courses/${courseId}/reviews`, body).then((r) => r.data);

export const deleteMyReview = (courseId: string) => apiDelete<{ data: { deleted: boolean } }>(`/courses/${courseId}/reviews/mine`);

export const deleteReview = (reviewId: string) => apiDelete<{ data: { deleted: boolean } }>(`/reviews/${reviewId}`);
