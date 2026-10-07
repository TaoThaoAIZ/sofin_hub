import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import type { PageMeta, Payout, PayoutStatus, RefundRequest, RefundStatus } from '../payments/types';
import type {
  ActivityItem,
  AdminCase,
  AdminCommunity,
  AdminMe,
  AdminUser,
  AuditItem,
  CaseDetail,
  CaseReason,
  CaseRisk,
  CommunityDetail,
  CommunityMember,
  CommunitySummary,
  DashboardData,
  DecisionItem,
  DecisionType,
  DurationKey,
  ModerationSummary,
  Paged,
  RestrictionKey,
  ReviewQueueItem,
  TrashItem,
  UserCommunity,
  UserDetail,
  UserPurchase,
  UserSummary,
} from './types';

/* ===================== Hoàn tiền / rút tiền / khóa cộng đồng (có sẵn) ===================== */

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

/* ======================= Admin đợt 1 (backend/docs/api/admin.md) ======================= */

type Query = Record<string, string | number | undefined>;
type Signal = AbortSignal | undefined;
const unwrap = <T>(r: { data: T }) => r.data;

export const fetchAdminMe = (signal?: Signal) => apiGet<{ data: AdminMe }>('/admin/me', undefined, signal).then(unwrap);

export const fetchDashboard = (range: number, signal?: Signal) => apiGet<{ data: DashboardData }>('/admin/dashboard', { range }, signal).then(unwrap);

/* ---- Communities ---- */
export const fetchCommunitySummary = (signal?: Signal) => apiGet<{ data: CommunitySummary }>('/admin/communities/summary', undefined, signal).then(unwrap);
export const fetchCommunities = (q: Query, signal?: Signal) => apiGet<Paged<AdminCommunity>>('/admin/communities', q, signal);
export const fetchReviewQueue = (q: Query, signal?: Signal) => apiGet<Paged<ReviewQueueItem>>('/admin/communities/review-queue', q, signal);
export const fetchTrash = (q: Query, signal?: Signal) => apiGet<Paged<TrashItem>>('/admin/communities/trash', q, signal);
export const fetchCommunityDetail = (id: string, signal?: Signal) =>
  apiGet<{ data: CommunityDetail }>(`/admin/communities/${encodeURIComponent(id)}`, undefined, signal).then(unwrap);
export const fetchCommunityMembers = (id: string, q: Query, signal?: Signal) =>
  apiGet<Paged<CommunityMember>>(`/admin/communities/${encodeURIComponent(id)}/members`, q, signal);
export const fetchCommunityReports = (id: string, q: Query, signal?: Signal) =>
  apiGet<Paged<AdminCase>>(`/admin/communities/${encodeURIComponent(id)}/reports`, q, signal);

export interface TimedBody {
  reason: string;
  duration?: DurationKey;
  note?: string;
}

const communityPost = (id: string, action: string, body?: object) =>
  apiPost<{ data: AdminCommunity }>(`/admin/communities/${encodeURIComponent(id)}/${action}`, body ?? {}).then(unwrap);

export const approveCommunity = (id: string, note?: string) => communityPost(id, 'approve', { note });
export const requestCommunityChanges = (id: string, note: string) => communityPost(id, 'request-changes', { note });
export const rejectCommunity = (id: string, reason: string, note?: string) => communityPost(id, 'reject', { reason, note });
export const suspendCommunity = (id: string, body: TimedBody) => communityPost(id, 'suspend', body);
export const restoreCommunity = (id: string, note?: string) => communityPost(id, 'restore', { note });
export const deleteCommunity = (id: string, reason: string, note?: string) => communityPost(id, 'delete', { reason, note });
export const undeleteCommunity = (id: string, note?: string) => communityPost(id, 'undelete', { note });

/* ---- Users ---- */
export const fetchUserSummary = (signal?: Signal) => apiGet<{ data: UserSummary }>('/admin/users/summary', undefined, signal).then(unwrap);
export const fetchUsers = (q: Query, signal?: Signal) => apiGet<Paged<AdminUser>>('/admin/users', q, signal);
export const fetchUserDetail = (id: string, signal?: Signal) => apiGet<{ data: UserDetail }>(`/admin/users/${id}`, undefined, signal).then(unwrap);
export const fetchUserCommunities = (id: string, q: Query, signal?: Signal) => apiGet<Paged<UserCommunity>>(`/admin/users/${id}/communities`, q, signal);
export const fetchUserActivity = (id: string, q: Query, signal?: Signal) => apiGet<Paged<ActivityItem>>(`/admin/users/${id}/activity`, q, signal);
export const fetchUserPurchases = (id: string, q: Query, signal?: Signal) =>
  apiGet<Paged<UserPurchase> & { summary: { lifetimeSpendCents: number; activeSubscriptions: number; refundsCents: number } }>(`/admin/users/${id}/purchases`, q, signal);
export const fetchUserReports = (id: string, q: Query, signal?: Signal) =>
  apiGet<{ data: AdminCase[]; meta: PageMeta & { summary?: { received: number; confirmed: number; warnings: number; suspensions: number } } }>(`/admin/users/${id}/reports`, q, signal);
export const revokeUserSession = (id: string, sid: string) => apiDelete<{ data: { revoked: boolean } }>(`/admin/users/${id}/sessions/${sid}`).then(unwrap);

const userPost = (id: string, action: string, body?: object) => apiPost<{ data: AdminUser }>(`/admin/users/${id}/${action}`, body ?? {}).then(unwrap);

export interface RestrictBody extends TimedBody {
  restrictions?: RestrictionKey[];
}
export interface SuspendBody extends TimedBody {
  notify?: boolean;
}
export interface BanBody {
  reason: string;
  evidence?: string;
  note?: string;
}

export const restrictUser = (id: string, body: RestrictBody) => userPost(id, 'restrict', body);
export const suspendUser = (id: string, body: SuspendBody) => userPost(id, 'suspend', body);
export const banUser = (id: string, body: BanBody) => userPost(id, 'ban', body);
export const reinstateUser = (id: string, note?: string) => userPost(id, 'reinstate', { note });
export const warnUser = (id: string, body: { reason: string; message: string }) => apiPost<{ data: unknown }>(`/admin/users/${id}/warn`, body).then(unwrap);

/* ---- Moderation ---- */
export interface CaseQuery {
  /** 'true' = hiện cả báo cáo đang mở trùng đối tượng (mặc định server gộp, chỉ hiện báo cáo đầu tiên). */
  includeDuplicates?: 'true';
  status?: string;
  risk?: CaseRisk | '';
  reason?: CaseReason | '';
  assignee?: string;
  targetType?: string;
  courseId?: string;
  q?: string;
  sort?: 'newest' | 'risk';
  page?: number;
  limit?: number;
}

export const fetchModerationSummary = (signal?: Signal) => apiGet<{ data: ModerationSummary }>('/admin/moderation/summary', undefined, signal).then(unwrap);
export const fetchAssignees = (signal?: Signal) => apiGet<{ data: { id: string; name: string; email: string; canBeAssigned: boolean }[] }>('/admin/moderation/assignees', undefined, signal).then(unwrap);
export const fetchCases = (q: CaseQuery, signal?: Signal) => apiGet<Paged<AdminCase>>('/admin/moderation/cases', q, signal);
export const fetchCaseDetail = (id: string, signal?: Signal) => apiGet<{ data: CaseDetail }>(`/admin/moderation/cases/${id}`, undefined, signal).then(unwrap);
export const fetchDecisions = (q: { type?: DecisionType; q?: string; page?: number; limit?: number }, signal?: Signal) =>
  apiGet<Paged<DecisionItem>>('/admin/moderation/decisions', q, signal);

const casePost = (id: string, action: string, body?: object) => apiPost<{ data: AdminCase }>(`/admin/moderation/cases/${id}/${action}`, body ?? {}).then(unwrap);

/** `adminId` bỏ trống = gán cho tôi; `null` = bỏ gán. */
export const assignCase = (id: string, adminId?: string | null) => casePost(id, 'assign', adminId === undefined ? {} : { adminId });
export const warnCase = (id: string, body: { message: string; reason?: string; closeCase?: boolean }) => casePost(id, 'warn', body);
export const removeCaseContent = (id: string, body: { reason: string; notifyAuthor?: boolean; closeCase?: boolean }) => casePost(id, 'remove-content', body);
export const restrictCaseUser = (id: string, body: RestrictBody) => casePost(id, 'restrict-user', body);
export const suspendCaseUser = (id: string, body: SuspendBody) => casePost(id, 'suspend-user', body);
export const banCaseUser = (id: string, body: BanBody) => casePost(id, 'ban-user', body);
export const dismissCase = (id: string, note?: string) => casePost(id, 'dismiss', { note });
export const escalateCase = (id: string, note?: string) => casePost(id, 'escalate', { note });
export const resolveCase = (id: string, note?: string) => casePost(id, 'resolve', { note });

/* ---- Audit ---- */
export const fetchAuditLogs = (q: Query, signal?: Signal) => apiGet<Paged<AuditItem>>('/admin/audit-logs', q, signal);
