/**
 * Kiểu dữ liệu Admin đợt 3 — theo hợp đồng backend/docs/api/admin-batch3.md.
 * Tiền = cent; thời điểm ISO UTC.
 */

import type { Tone } from './components/ui';
import type { AuditItem } from './types';

/* ---------------- Quyền ---------------- */

export type PermissionKey = string;

export interface AdminRoleRef {
  key: string;
  name: string;
}

/* ---------------- Analytics ---------------- */

export interface AKpi {
  value: number;
  previous: number;
  changePct: number | null;
}

export interface AnalyticsBase {
  range: number;
  from: string;
  to: string;
}

export interface Share {
  key?: string;
  label: string;
  count: number;
  pct: number;
}

export interface AnalyticsUsers extends AnalyticsBase {
  kpis: { totalUsers: AKpi; dau: AKpi; wau: AKpi; mau: AKpi; newUsers: AKpi };
  series: { date: string; newUsers: number; activeUsers: number }[];
  segments: Share[];
  geography: Share[];
}

export interface AnalyticsCommunities extends AnalyticsBase {
  kpis: { total: AKpi; created: AKpi; paid: AKpi; avgMembers: AKpi; suspended: AKpi };
  series: { date: string; created: number; active: number; paidCreated: number }[];
  byCategory: Share[];
  top: { id: string; name: string; category: string; members: number; newMembers: number; growthPct: number | null; mrrCents: number }[];
}

export interface AnalyticsEngagement extends AnalyticsBase {
  kpis: { posts: AKpi; comments: AKpi; likes: AKpi; lessonCompletions: AKpi; eventParticipation: AKpi; courseCompletionPct: AKpi };
  series: { date: string; posts: number; comments: number; likes: number; completions: number; rsvps: number }[];
  mix: Share[];
}

export interface AnalyticsRetention extends AnalyticsBase {
  kpis: { day7: AKpi; day30: AKpi; churn: AKpi; renewalRate: AKpi };
  cohorts: { cohort: string; label: string; users: number; weeks: { w1: number | null; w2: number | null; w4: number | null; w8: number | null; w12: number | null } }[];
  returning: { date: string; returning: number; newActive: number }[];
}

export interface AnalyticsRevenue extends AnalyticsBase {
  kpis: { mrrCents: AKpi; grossCents: AKpi; platformFeesCents: AKpi; arpuCents: AKpi; refundsCents: AKpi };
  series: { date: string; grossCents: number; refundsCents: number; netCents: number }[];
  byCommunity: { id: string; name: string; grossCents: number; pct: number }[];
  byPlan: { key: string; label: string; grossCents: number; pct: number }[];
}

export interface AnalyticsConversion extends AnalyticsBase {
  kpis: { signupToJoinPct: AKpi; signupToPaidPct: AKpi; trialToPaidPct: AKpi; revenuePerSignupCents: AKpi };
  funnel: { key: string; label: string; count: number; pctOfFirst: number }[];
  series: { date: string; signups: number; trialsStarted: number; paidConversions: number }[];
}

/* ---------------- Support ---------------- */

export type TicketStatus = 'new' | 'open' | 'awaiting_reply' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'user' | 'creator' | 'payment';

export interface Ticket {
  id: string;
  code: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requester: { id: string | null; name: string; email: string; avatarUrl: string | null };
  assignee: { id: string; name: string } | null;
  escalated: boolean;
  source: string;
  messageCount: number;
  lastMessagePreview: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  kind: 'customer' | 'staff' | 'internal_note' | 'system';
  author: { id: string | null; name: string };
  body: string;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  history: AuditItem[];
  related: { userId: string | null };
}

export interface SupportSummary {
  open: number;
  newToday: number;
  avgFirstResponseMin: number | null;
  resolved7d: number;
  unassigned: number;
  escalated: number;
  byCategory: Record<TicketCategory, number>;
  avgFirstResponseMinChangePct?: number | null;
  resolved7dChangePct?: number | null;
}

export interface SupportAssignee {
  id: string;
  name: string;
  email: string;
  role?: string;
}

/* ---------------- System ---------------- */

export interface AdminAccount {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: AdminRoleRef;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  status: 'active' | 'suspended';
  source: 'env' | 'staff';
  locked: boolean;
  createdAt: string;
}

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export interface RoleDef {
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  locked: boolean;
  memberCount: number;
  permissions: string[];
}

export interface RolesData {
  permissions: PermissionDef[];
  roles: RoleDef[];
}

export type FlagStage = 'draft' | 'beta' | 'active';

export interface FeatureFlag {
  key: string;
  name: string;
  description: string | null;
  stage: FlagStage;
  enabled: boolean;
  rolloutPercent: number;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}

export interface Integration {
  key: string;
  name: string;
  initials: string;
  color: string;
  description: string;
  category: string;
  connected: boolean;
  config: Record<string, unknown> | null;
  secretMask: string | null;
  connectedAt: string | null;
  updatedAt: string;
}

export interface NotificationSettings {
  moderation: { criticalReports: boolean; pendingCommunities: boolean; aiFlagged: boolean };
  payments: { newChargeback: boolean; failedPayout: boolean; refundOver500: boolean };
  reports: { weeklySummary: boolean; monthlyBoardReport: boolean; sendTo: string };
}

export type BroadcastAudience = { type: 'all' } | { type: 'creators' } | { type: 'paid_members' } | { type: 'community'; courseId: string } | { type: 'users'; userIds: string[] };

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  link: string | null;
  audience: BroadcastAudience;
  recipientCount: number;
  emailCount: number;
  sentBy: { id: string; name: string };
  createdAt: string;
}

export type EmailTemplateStatus = 'active' | 'draft' | 'disabled';

export interface EmailTemplate {
  key: string;
  name: string;
  description: string | null;
  status: EmailTemplateStatus;
  isSystem: boolean;
  variables: string[];
  languages: string[];
  subject: Record<string, string>;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}

export interface EmailTemplateDetail extends EmailTemplate {
  body: Record<string, string>;
}

export interface TemplatePreview {
  subject: string;
  text: string;
  html: string;
  missingVariables: string[];
}

export interface PlatformSettings {
  platform: { name: string; supportEmail: string; defaultLanguage: 'en' | 'vi'; timezone: string };
  payments: {
    commissionPct: number;
    gatewayFeePct: number;
    gatewayFeeFixedCents: number;
    refundWindowDays: number;
    payoutMinUsd: number;
    trialDays: number;
    subscriptionPeriodDays: number;
    currency: 'USD' | 'VND' | 'EUR';
    autoPayouts: boolean;
  };
  security: { require2fa: boolean; sessionTimeoutMin: number; maintenanceMode: boolean };
  overrides: Record<string, { default: unknown; overridden: boolean }>;
  updatedAt: string | null;
}

export interface AuditFilters {
  actors: { id: string; name: string }[];
  actions: string[];
  targetTypes: string[];
}

/* ---------------- Nhãn tiếng Việt ---------------- */

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  new: { label: 'Mới', tone: 'b' },
  open: { label: 'Đang mở', tone: 'o' },
  awaiting_reply: { label: 'Chờ phản hồi', tone: 'x' },
  resolved: { label: 'Đã xử lý', tone: 'g' },
  closed: { label: 'Đã đóng', tone: 'x' },
};

export const TICKET_PRIORITY: Record<TicketPriority, { label: string; tone: Tone }> = {
  low: { label: 'Thấp', tone: 'x' },
  medium: { label: 'Trung bình', tone: 'b' },
  high: { label: 'Cao', tone: 'o' },
  urgent: { label: 'Khẩn cấp', tone: 'r' },
};

export const TICKET_CATEGORY: Record<TicketCategory, { label: string; icon: string }> = {
  user: { label: 'Người dùng', icon: 'person' },
  creator: { label: 'Creator', icon: 'storefront' },
  payment: { label: 'Thanh toán', icon: 'credit_card' },
};

export const FLAG_STAGE: Record<FlagStage, { label: string; tone: Tone }> = {
  draft: { label: 'Bản nháp', tone: 'x' },
  beta: { label: 'Thử nghiệm', tone: 'o' },
  active: { label: 'Đang chạy', tone: 'g' },
};

export const TEMPLATE_STATUS: Record<EmailTemplateStatus, { label: string; tone: Tone }> = {
  active: { label: 'Đang dùng', tone: 'g' },
  draft: { label: 'Bản nháp', tone: 'x' },
  disabled: { label: 'Đã tắt', tone: 'r' },
};

/** Nhãn tiếng Việt cho khóa quyền (BE trả nhãn tiếng Anh theo mockup). */
export const PERMISSION_LABEL: Record<string, string> = {
  'dashboard.view': 'Xem bảng điều khiển',
  'community.manage': 'Quản lý cộng đồng',
  'report.resolve': 'Xử lý báo cáo',
  'user.ban': 'Cấm người dùng',
  'payment.refund': 'Hoàn tiền',
  'payout.approve': 'Duyệt chi trả',
  'system.flags': 'Sửa tính năng thử nghiệm',
  'admin.manage': 'Quản lý quản trị viên',
  'users.view': 'Xem người dùng',
  'content.manage': 'Quản lý nội dung',
  'payment.view': 'Xem thanh toán',
  'payment.manage': 'Quản lý thanh toán',
  'analytics.view': 'Xem phân tích',
  'support.manage': 'Xử lý ticket hỗ trợ',
  'audit.view': 'Xem nhật ký hoạt động',
  'system.settings': 'Cài đặt hệ thống',
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  moderator: 'Kiểm duyệt viên',
  support: 'Hỗ trợ',
  finance: 'Tài chính',
};

export const INTEGRATION_CATEGORY: Record<string, string> = {
  payments: 'Thanh toán',
  email: 'Email',
  storage: 'Lưu trữ',
  analytics: 'Phân tích',
  video: 'Video',
  chat: 'Chat',
  cdn: 'CDN',
};

/** Nhãn "Phân khúc" / "Cơ cấu" theo khóa của BE (BE trả nhãn tiếng Anh). */
export const SEGMENT_LABEL: Record<string, string> = {
  free_members: 'Thành viên miễn phí',
  paid_members: 'Thành viên trả phí',
  creators: 'Creator',
  staff: 'Quản trị & kiểm duyệt',
};
export const MIX_LABEL: Record<string, string> = {
  likes: 'Lượt thích',
  comments: 'Bình luận',
  posts: 'Bài viết',
  lessons: 'Hoàn thành bài học',
  lesson_completions: 'Hoàn thành bài học',
  completions: 'Hoàn thành bài học',
  rsvps: 'Tham gia sự kiện',
  events: 'Tham gia sự kiện',
};
export const PLAN_LABEL: Record<string, string> = {
  subscription: 'Gói đăng ký',
  new_subscription: 'Đăng ký mới',
  renewal: 'Gia hạn',
  course: 'Khóa học',
  event: 'Sự kiện',
  one_time: 'Thanh toán một lần',
  trial: 'Dùng thử',
};
export const FUNNEL_LABEL: Record<string, string> = {
  signup: 'Tạo tài khoản',
  joined: 'Tham gia cộng đồng',
  trial: 'Bắt đầu dùng thử',
  paid: 'Trở thành trả phí',
};

/* ---------------- Nhãn hành động nhật ký ---------------- */

const AUDIT_PREFIX: Record<string, string> = {
  community: 'cộng đồng',
  user: 'người dùng',
  case: 'vụ việc',
  content: 'nội dung',
  post: 'bài viết',
  comment: 'bình luận',
  lesson: 'bài học',
  course: 'khóa học',
  event: 'sự kiện',
  media: 'media',
  payment: 'thanh toán',
  refund: 'hoàn tiền',
  payout: 'chi trả',
  chargeback: 'tranh chấp',
  subscription: 'gói đăng ký',
  discovery: 'khám phá',
  category: 'danh mục',
  ticket: 'ticket',
  support: 'ticket',
  admin: 'quản trị viên',
  role: 'vai trò',
  flag: 'tính năng thử nghiệm',
  integration: 'tích hợp',
  notification: 'thông báo',
  email_template: 'mẫu email',
  template: 'mẫu email',
  settings: 'cài đặt chung',
  setting: 'cài đặt chung',
  report: 'báo cáo',
};
const AUDIT_VERB: Record<string, string> = {
  create: 'Tạo',
  update: 'Cập nhật',
  edit: 'Sửa',
  delete: 'Xóa',
  remove: 'Gỡ',
  toggle: 'Bật/tắt',
  connect: 'Kết nối',
  disconnect: 'Ngắt kết nối',
  test: 'Kiểm tra',
  assign: 'Giao',
  reply: 'Trả lời',
  note: 'Ghi chú',
  resolve: 'Xử lý',
  close: 'Đóng',
  reopen: 'Mở lại',
  escalate: 'Chuyển cấp',
  suspend: 'Tạm ngưng',
  enable: 'Kích hoạt',
  reset: 'Khôi phục mặc định',
  reset_2fa: 'Đặt lại 2FA',
  broadcast: 'Gửi thông báo',
  reorder: 'Sắp xếp lại',
  move: 'Di chuyển',
  feature: 'Đưa lên nổi bật',
  unfeature: 'Gỡ khỏi nổi bật',
  hide: 'Ẩn',
  restore: 'Khôi phục',
  approve: 'Duyệt',
  reject: 'Từ chối',
  refund: 'Hoàn tiền',
  retry: 'Thử lại',
  cancel: 'Hủy',
  grant: 'Cấp quyền',
  revoke: 'Thu hồi quyền',
  status: 'Đổi trạng thái',
  export: 'Xuất dữ liệu',
};

/** Nhãn tiếng Việt của mã hành động nhật ký ("ticket.reply" -> "Trả lời ticket"); mã lạ giữ nguyên. */
export function auditLabel(code: string, exact: Record<string, string>): string {
  if (exact[code]) return exact[code]!;
  const [prefix, ...rest] = code.split('.');
  const verb = rest.join('.');
  const v = AUDIT_VERB[verb] ?? AUDIT_VERB[verb.split('_')[0] ?? ''];
  const p = AUDIT_PREFIX[prefix ?? ''];
  return v && p ? `${v} ${p}` : code;
}
