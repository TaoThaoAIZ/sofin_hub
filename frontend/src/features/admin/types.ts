import type { Tone } from './components/ui';
import i18n from '../../i18n';

/** Dịch lazy (gọi lúc render) — nhãn dùng getter nên đổi ngôn ngữ vẫn cập nhật. */
export const tl = (key: string): string => i18n.t(key, { ns: 'admin' });

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
  active: { get label() { return tl('labels.userStatus.active'); }, tone: 'g' },
  restricted: { get label() { return tl('labels.userStatus.restricted'); }, tone: 'o' },
  suspended: { get label() { return tl('labels.userStatus.suspended'); }, tone: 'r' },
  banned: { get label() { return tl('labels.userStatus.banned'); }, tone: 'r' },
};

export const COMMUNITY_STATUS: Record<CommunityStatus, StatusMeta> = {
  pending_review: { get label() { return tl('labels.communityStatus.pending_review'); }, tone: 'o' },
  changes_requested: { get label() { return tl('labels.communityStatus.changes_requested'); }, tone: 'o' },
  rejected: { get label() { return tl('labels.communityStatus.rejected'); }, tone: 'r' },
  active: { get label() { return tl('labels.communityStatus.active'); }, tone: 'g' },
  suspended: { get label() { return tl('labels.communityStatus.suspended'); }, tone: 'r' },
  deleted: { get label() { return tl('labels.communityStatus.deleted'); }, tone: 'x' },
};

export const CASE_STATUS: Record<CaseStatus, StatusMeta> = {
  open: { get label() { return tl('labels.caseStatus.open'); }, tone: 'o' },
  under_review: { get label() { return tl('labels.caseStatus.under_review'); }, tone: 'o' },
  resolved: { get label() { return tl('labels.caseStatus.resolved'); }, tone: 'g' },
  dismissed: { get label() { return tl('labels.caseStatus.dismissed'); }, tone: 'x' },
};

export const CASE_RISK: Record<CaseRisk, StatusMeta> = {
  low: { get label() { return tl('labels.caseRisk.low'); }, tone: 'x' },
  medium: { get label() { return tl('labels.caseRisk.medium'); }, tone: 'o' },
  high: { label: 'Cao', tone: 'r' },
  critical: { get label() { return tl('labels.caseRisk.critical'); }, tone: 'r' },
};

export const DISCOVERY: Record<AdminCommunity['discovery'], StatusMeta> = {
  listed: { get label() { return tl('labels.discovery.listed'); }, tone: 'g' },
  hidden: { get label() { return tl('labels.discovery.hidden'); }, tone: 'x' },
  unlisted: { get label() { return tl('labels.discovery.unlisted'); }, tone: 'r' },
};

export const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  get harassment() { return tl('labels.reasonLabel.harassment'); },
  get inappropriate() { return tl('labels.reasonLabel.inappropriate'); },
  get misinformation() { return tl('labels.reasonLabel.misinformation'); },
  get other() { return tl('labels.reasonLabel.other'); },
  get hate_speech() { return tl('labels.reasonLabel.hate_speech'); },
  get scam() { return tl('labels.reasonLabel.scam'); },
  get copyright() { return tl('labels.reasonLabel.copyright'); },
  get nsfw() { return tl('labels.reasonLabel.nsfw'); },
};

export const TARGET_LABEL: Record<AdminCase['targetType'], string> = { get post() { return tl('labels.targetLabel.post'); }, get comment() { return tl('labels.targetLabel.comment'); }, get member() { return tl('labels.targetLabel.member'); } };
export const ROLE_LABEL: Record<string, string> = { get owner() { return tl('labels.roleLabel.owner'); }, get admin() { return tl('labels.roleLabel.admin'); }, get mod() { return tl('labels.roleLabel.mod'); }, get member() { return tl('labels.roleLabel.member'); }, creator: 'Creator' };
export const PRICING_LABEL: Record<string, string> = { get free() { return tl('labels.pricingLabel.free'); }, get paid() { return tl('labels.pricingLabel.paid'); }, get trial() { return tl('labels.pricingLabel.trial'); } };
export const RESTRICTION_LABEL: Record<RestrictionKey, string> = {
  get post() { return tl('labels.restrictionLabel.post'); },
  get comment() { return tl('labels.restrictionLabel.comment'); },
  get dm() { return tl('labels.restrictionLabel.dm'); },
  get create_community() { return tl('labels.restrictionLabel.create_community'); },
  get purchase() { return tl('labels.restrictionLabel.purchase'); },
};
export const DURATION_LABEL: Record<DurationKey, string> = { get '24h'() { return tl('labels.durationLabel.24h'); }, get '7d'() { return tl('labels.durationLabel.7d'); }, get '30d'() { return tl('labels.durationLabel.30d'); }, get indefinite() { return tl('labels.durationLabel.indefinite'); } };
export const PURCHASE_STATUS: Record<string, StatusMeta> = {
  succeeded: { get label() { return tl('labels.purchaseStatus.succeeded'); }, tone: 'g' },
  pending: { get label() { return tl('labels.purchaseStatus.pending'); }, tone: 'o' },
  failed: { get label() { return tl('labels.purchaseStatus.failed'); }, tone: 'r' },
  refunded: { get label() { return tl('labels.purchaseStatus.refunded'); }, tone: 'x' },
};

/** Nhãn hành động trong nhật ký / lịch sử vụ việc. */
export const AUDIT_ACTION: Record<string, string> = {
  get 'community.approve'() { return tl('labels.auditAction.community_approve'); },
  get 'community.request_changes'() { return tl('labels.auditAction.community_request_changes'); },
  get 'community.reject'() { return tl('labels.auditAction.community_reject'); },
  get 'community.suspend'() { return tl('labels.auditAction.community_suspend'); },
  get 'community.restore'() { return tl('labels.auditAction.community_restore'); },
  get 'community.delete'() { return tl('labels.auditAction.community_delete'); },
  get 'community.undelete'() { return tl('labels.auditAction.community_undelete'); },
  get 'community.lock'() { return tl('labels.auditAction.community_lock'); },
  get 'community.unlock'() { return tl('labels.auditAction.community_unlock'); },
  get 'user.restrict'() { return tl('labels.auditAction.user_restrict'); },
  get 'user.suspend'() { return tl('labels.auditAction.user_suspend'); },
  get 'user.ban'() { return tl('labels.auditAction.user_ban'); },
  get 'user.reinstate'() { return tl('labels.auditAction.user_reinstate'); },
  get 'user.warn'() { return tl('labels.auditAction.user_warn'); },
  get 'user.revoke_session'() { return tl('labels.auditAction.user_revoke_session'); },
  get 'case.assign'() { return tl('labels.auditAction.case_assign'); },
  get 'case.warn'() { return tl('labels.auditAction.case_warn'); },
  get 'case.remove_content'() { return tl('labels.auditAction.case_remove_content'); },
  get 'case.restrict_user'() { return tl('labels.auditAction.case_restrict_user'); },
  get 'case.suspend_user'() { return tl('labels.auditAction.case_suspend_user'); },
  get 'case.ban_user'() { return tl('labels.auditAction.case_ban_user'); },
  get 'case.dismiss'() { return tl('labels.auditAction.case_dismiss'); },
  get 'case.escalate'() { return tl('labels.auditAction.case_escalate'); },
  get 'case.resolve'() { return tl('labels.auditAction.case_resolve'); },
  get 'payment.refund_resolve'() { return tl('labels.auditAction.payment_refund_resolve'); },
  get 'payment.payout_resolve'() { return tl('labels.auditAction.payment_payout_resolve'); },
  get 'report.resolve'() { return tl('labels.auditAction.report_resolve'); },
};

export const DECISION_LABEL: Record<string, string> = {
  get warning() { return tl('labels.decisionLabel.warning'); },
  get removal() { return tl('labels.decisionLabel.removal'); },
  get restriction() { return tl('labels.decisionLabel.restriction'); },
  get suspension() { return tl('labels.decisionLabel.suspension'); },
  get ban() { return tl('labels.decisionLabel.ban'); },
};

/** Nhãn hành động của lịch sử vụ việc (history.type) — khóa lạ giữ nguyên. */
export const CASE_EVENT_LABEL: Record<string, string> = {
  get assign() { return tl('labels.caseEventLabel.assign'); },
  get warn() { return tl('labels.caseEventLabel.warn'); },
  get remove_content() { return tl('labels.caseEventLabel.remove_content'); },
  get restrict_user() { return tl('labels.caseEventLabel.restrict_user'); },
  get suspend_user() { return tl('labels.caseEventLabel.suspend_user'); },
  get ban_user() { return tl('labels.caseEventLabel.ban_user'); },
  get dismiss() { return tl('labels.caseEventLabel.dismiss'); },
  get escalate() { return tl('labels.caseEventLabel.escalate'); },
  get resolve() { return tl('labels.caseEventLabel.resolve'); },
  get created() { return tl('labels.caseEventLabel.created'); },
};
