import type { Tone } from './components/ui';

/** Kiểu dữ liệu theo hợp đồng backend/docs/api/admin.md (đợt 1). */

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export type UserStatus = 'active' | 'restricted' | 'suspended' | 'banned';
export type CommunityStatus = 'pending_review' | 'changes_requested' | 'rejected' | 'active' | 'suspended' | 'deleted';
export type CaseStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type CaseRisk = 'low' | 'medium' | 'high' | 'critical';
export type CaseReason = 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other' | 'hate_speech' | 'scam' | 'copyright' | 'nsfw';
export type DurationKey = '24h' | '7d' | '30d' | 'indefinite';
export type RestrictionKey = 'post' | 'comment' | 'dm' | 'create_community' | 'purchase';

export interface AdminMe {
  id: string;
  name: string;
  email: string;
  role: 'platform_admin';
  /** Vai trò nhân viên (đợt 3). BE cũ không trả -> coi như Super Admin. */
  adminRole?: { key: string; name: string };
  /** Danh sách khóa quyền; thiếu = đủ quyền (tương thích BE cũ). */
  permissions?: string[];
  source?: 'env' | 'staff';
}

export interface NameRef {
  id: string;
  name: string;
}

/* ---------------- Dashboard ---------------- */

export interface KpiValue {
  value: number | null;
  deltaPct?: number | null;
  critical?: number;
}

export interface DashboardData {
  range: number;
  kpis: {
    totalUsers: KpiValue;
    activeUsers: KpiValue;
    communities: KpiValue;
    mrrCents: KpiValue;
    pendingReports: KpiValue;
    pendingReviewCommunities: KpiValue;
    openSupportTickets: KpiValue;
  };
  series: {
    userGrowth: { date: string; newUsers: number; activeUsers: number }[];
    communityGrowth: { date: string; created: number; active: number; paid: number; suspended: number }[];
    revenue: { date: string; mrrCents: number; revenueCents: number; refundsCents: number }[];
    engagement: { date: string; posts: number; comments: number; lessonsCompleted: number; eventRsvps: number }[];
  };
  needsAttention: {
    pendingReviewCommunities: { count: number; oldestWaitingHours: number | null };
    openReports: { count: number; critical: number };
    suspiciousUsers: { count: number };
    pendingPayouts: { count: number; amountCents: number };
    pendingRefunds: { count: number; amountCents: number };
  };
  recentActivity: { type: string; icon: string; actor: NameRef | null; text: string; target: string | null; createdAt: string }[];
}

/* ---------------- Communities ---------------- */

export interface AdminCommunity {
  id: string;
  name: string;
  slug: string;
  category: string;
  pricing: 'free' | 'paid' | 'trial';
  priceUsd: number;
  visibility: 'public' | 'private';
  status: CommunityStatus;
  statusReason: string | null;
  statusNote: string | null;
  statusUntil: string | null;
  owner: { id: string; name: string; email: string };
  members: number;
  mrrCents: number;
  discovery: 'listed' | 'hidden' | 'unlisted';
  thumbnail: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface CommunitySummary {
  total: number;
  active: number;
  pendingReview: number;
  changesRequested: number;
  rejected: number;
  paid: number;
  suspended: number;
  deleted: number;
}

export interface ReviewQueueItem extends AdminCommunity {
  description: string;
  submittedAt: string;
  waitingHours: number;
  signals: { ownerAccountAgeDays: number; ownerCommunities: number; ownerViolations90d: number; hasThumbnail: boolean; descriptionLength: number };
}

export interface TrashItem {
  id: string;
  name: string;
  owner: NameRef;
  category: string;
  deletedAt: string;
  deletedBy: NameRef | null;
  deletedByOwner: boolean;
  reason: string | null;
  purgeAt: string;
  daysLeft: number;
}

export interface AuditItem {
  id: string;
  actor: { id: string; name: string; email?: string | null; role?: { key: string; name: string } | null } | null;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  reason: string | null;
  note: string | null;
  evidence: string | null;
  caseId: string | null;
  metadata: Record<string, unknown> | null;
  /** Địa chỉ IP thực hiện (đợt 3). */
  ip?: string | null;
  createdAt: string;
}

export interface CommunityDetail extends AdminCommunity {
  description: string;
  language: string;
  lessons: number;
  deleteReason: string | null;
  deletedBy: NameRef | null;
  purgeAt: string | null;
  owner: { id: string; name: string; email: string; status: UserStatus; accountAgeDays: number; communitiesOwned: number };
  stats: {
    members: number;
    activeMembers30d: number;
    newMembers30d: number;
    bannedMembers: number;
    posts: number;
    comments: number;
    hiddenPosts: number;
    events: number;
    mrrCents: number;
    totalRevenueCents: number;
    refundsCents: number;
    activeSubscriptions: number;
    reports30d: number;
    openReports: number;
  };
  recentReports: AdminCase[];
  history: AuditItem[];
}

export interface CommunityMember {
  userId: string;
  name: string;
  email: string;
  role: 'member' | 'mod' | 'admin' | 'owner';
  joinedAt: string;
  lastActiveAt: string | null;
  posts: number;
  userStatus: UserStatus;
  banned: boolean;
}

/* ---------------- Users ---------------- */

export interface AdminUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  statusReason: string | null;
  statusUntil: string | null;
  restrictions: RestrictionKey[];
  statusChangedAt: string | null;
  statusChangedBy: NameRef | null;
  role: 'creator' | 'member';
  communities: number;
  plan: 'free' | 'paid';
  revenueCents: number;
  reports: number;
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface UserSummary {
  total: number;
  active: number;
  new30d: number;
  paid: number;
  restricted: number;
  suspended: number;
  banned: number;
}

export interface ActivityItem {
  type: string;
  icon: string;
  title: string;
  detail: string | null;
  createdAt: string;
}

export interface UserDetail extends AdminUser {
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  isPlatformAdmin: boolean;
  stats: {
    communities: number;
    owned: number;
    posts: number;
    comments: number;
    purchases: number;
    lifetimeSpendCents: number;
    activeSubscriptions: number;
    refundsCents: number;
    reportsReceived: number;
    confirmedViolations: number;
    warnings: number;
    suspensions: number;
  };
  recentActivity: ActivityItem[];
  security: {
    emailVerified: boolean;
    activeSessions: { id: string; device: string; ip: string | null; createdAt: string; lastUsedAt: string | null }[];
  };
}

export interface UserCommunity {
  id: string;
  name: string;
  role: string;
  membership: 'free' | 'paid';
  priceUsd: number;
  joinedAt: string;
  lastActiveAt: string | null;
  status: CommunityStatus | string;
}

export interface UserPurchase {
  id: string;
  invoiceNumber: string | null;
  courseId: string;
  courseName: string;
  amountCents: number;
  refundedCents: number;
  status: string;
  method: string;
  createdAt: string;
}

/* ---------------- Moderation ---------------- */

export interface AdminCase {
  id: string;
  caseCode: string;
  targetType: 'post' | 'comment' | 'member';
  content: { type: string; id: string; title: string; community: NameRef | null };
  reportedUser: NameRef | null;
  reporter: NameRef | null;
  reason: CaseReason;
  detail: string | null;
  reportCount: number;
  risk: CaseRisk;
  assignee: NameRef | null;
  status: CaseStatus;
  action: string | null;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ModerationSummary {
  open: number;
  critical: number;
  underReview: number;
  resolvedToday: number;
  warnings: number;
  removedContent: number;
  suspendedUsers: number;
}

export interface CaseDetail extends AdminCase {
  reportedContent: {
    type: string;
    id: string;
    excerpt: string;
    exists: boolean;
    body: string | null;
    author: string | null;
    createdAt: string | null;
    likes: number | null;
    comments: number | null;
    hidden: boolean | null;
    imageUrl: string | null;
    parentPost: { id: string; excerpt: string } | null;
    thread: { author: string; text: string; reported?: boolean }[];
  };
  reporterInfo: { id: string; name: string; email: string };
  reportedUserInfo: { id: string; name: string; email: string; status: UserStatus; accountAgeDays: number; previousReports: number; warnings: number; suspensions: number; communities: number } | null;
  relatedReports: { id: string; reporter: NameRef; reason: CaseReason; detail: string | null; createdAt: string }[];
  similarCases: AdminCase[];
  history: { id: string; type: string; actor: NameRef | null; note: string | null; createdAt: string; meta: Record<string, unknown> | null }[];
}

export interface DecisionItem {
  id: string;
  case: { id: string; caseCode: string } | null;
  target: { type: string; id: string; name: string };
  decision: string;
  admin: NameRef;
  reason: string | null;
  evidence: string | null;
  createdAt: string;
}

export type DecisionType = 'warning' | 'removal' | 'restriction' | 'suspension' | 'ban';

/* ---------------- Nhãn + tone hiển thị ---------------- */

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const USER_STATUS: Record<UserStatus, StatusMeta> = {
  active: { label: 'Hoạt động', tone: 'g' },
  restricted: { label: 'Bị hạn chế', tone: 'o' },
  suspended: { label: 'Tạm ngưng', tone: 'r' },
  banned: { label: 'Bị cấm', tone: 'r' },
};

export const COMMUNITY_STATUS: Record<CommunityStatus, StatusMeta> = {
  pending_review: { label: 'Chờ duyệt', tone: 'o' },
  changes_requested: { label: 'Đã yêu cầu chỉnh sửa', tone: 'o' },
  rejected: { label: 'Đã từ chối', tone: 'r' },
  active: { label: 'Hoạt động', tone: 'g' },
  suspended: { label: 'Tạm ngưng', tone: 'r' },
  deleted: { label: 'Đã xóa', tone: 'x' },
};

export const CASE_STATUS: Record<CaseStatus, StatusMeta> = {
  open: { label: 'Mở', tone: 'o' },
  under_review: { label: 'Đang xem xét', tone: 'o' },
  resolved: { label: 'Đã xử lý', tone: 'g' },
  dismissed: { label: 'Bỏ qua', tone: 'x' },
};

export const CASE_RISK: Record<CaseRisk, StatusMeta> = {
  low: { label: 'Thấp', tone: 'x' },
  medium: { label: 'Trung bình', tone: 'o' },
  high: { label: 'Cao', tone: 'r' },
  critical: { label: 'Nghiêm trọng', tone: 'r' },
};

export const DISCOVERY: Record<AdminCommunity['discovery'], StatusMeta> = {
  listed: { label: 'Đang hiển thị', tone: 'g' },
  hidden: { label: 'Đã ẩn', tone: 'x' },
  unlisted: { label: 'Gỡ khỏi khám phá', tone: 'r' },
};

export const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Quấy rối',
  inappropriate: 'Nội dung không phù hợp',
  misinformation: 'Thông tin sai lệch',
  other: 'Khác',
  hate_speech: 'Ngôn từ thù ghét',
  scam: 'Lừa đảo',
  copyright: 'Bản quyền',
  nsfw: 'Nội dung nhạy cảm',
};

export const TARGET_LABEL: Record<AdminCase['targetType'], string> = { post: 'Bài viết', comment: 'Bình luận', member: 'Thành viên' };
export const ROLE_LABEL: Record<string, string> = { owner: 'Chủ sở hữu', admin: 'Quản trị viên', mod: 'Kiểm duyệt viên', member: 'Thành viên', creator: 'Creator' };
export const PRICING_LABEL: Record<string, string> = { free: 'Miễn phí', paid: 'Trả phí', trial: 'Dùng thử' };
export const RESTRICTION_LABEL: Record<RestrictionKey, string> = {
  post: 'Không được đăng bài',
  comment: 'Không được bình luận',
  dm: 'Không được nhắn tin',
  create_community: 'Không được tạo cộng đồng',
  purchase: 'Không được mua',
};
export const DURATION_LABEL: Record<DurationKey, string> = { '24h': '24 giờ', '7d': '7 ngày', '30d': '30 ngày', indefinite: 'Vô thời hạn' };
export const PURCHASE_STATUS: Record<string, StatusMeta> = {
  succeeded: { label: 'Thành công', tone: 'g' },
  pending: { label: 'Đang chờ', tone: 'o' },
  failed: { label: 'Thất bại', tone: 'r' },
  refunded: { label: 'Đã hoàn tiền', tone: 'x' },
};

/** Nhãn hành động trong nhật ký / lịch sử vụ việc. */
export const AUDIT_ACTION: Record<string, string> = {
  'community.approve': 'Duyệt cộng đồng',
  'community.request_changes': 'Yêu cầu chỉnh sửa cộng đồng',
  'community.reject': 'Từ chối cộng đồng',
  'community.suspend': 'Tạm ngưng cộng đồng',
  'community.restore': 'Khôi phục cộng đồng sau tạm ngưng',
  'community.delete': 'Xóa cộng đồng',
  'community.undelete': 'Khôi phục cộng đồng đã xóa',
  'community.lock': 'Khóa cộng đồng',
  'community.unlock': 'Mở khóa cộng đồng',
  'user.restrict': 'Hạn chế người dùng',
  'user.suspend': 'Tạm ngưng người dùng',
  'user.ban': 'Cấm người dùng',
  'user.reinstate': 'Khôi phục người dùng',
  'user.warn': 'Cảnh cáo người dùng',
  'user.revoke_session': 'Thu hồi phiên đăng nhập',
  'case.assign': 'Nhận xử lý vụ việc',
  'case.warn': 'Cảnh cáo (vụ việc)',
  'case.remove_content': 'Gỡ nội dung (vụ việc)',
  'case.restrict_user': 'Hạn chế người dùng (vụ việc)',
  'case.suspend_user': 'Tạm ngưng người dùng (vụ việc)',
  'case.ban_user': 'Cấm người dùng (vụ việc)',
  'case.dismiss': 'Bỏ qua vụ việc',
  'case.escalate': 'Nâng mức rủi ro vụ việc',
  'case.resolve': 'Đóng vụ việc',
  'payment.refund_resolve': 'Xử lý hoàn tiền',
  'payment.payout_resolve': 'Xử lý chi trả',
  'report.resolve': 'Xử lý báo cáo',
};

export const DECISION_LABEL: Record<string, string> = {
  warning: 'Cảnh cáo',
  removal: 'Đã gỡ nội dung',
  restriction: 'Hạn chế',
  suspension: 'Tạm ngưng',
  ban: 'Cấm',
};

/** Nhãn hành động của lịch sử vụ việc (history.type) — khóa lạ giữ nguyên. */
export const CASE_EVENT_LABEL: Record<string, string> = {
  assign: 'đã nhận xử lý vụ việc',
  warn: 'đã cảnh cáo người dùng',
  remove_content: 'đã gỡ nội dung',
  restrict_user: 'đã hạn chế người dùng',
  suspend_user: 'đã tạm ngưng người dùng',
  ban_user: 'đã cấm người dùng',
  dismiss: 'đã đóng vụ việc (không vi phạm)',
  escalate: 'đã nâng mức rủi ro',
  resolve: 'đã đóng vụ việc',
  created: 'đã tạo vụ việc',
};
