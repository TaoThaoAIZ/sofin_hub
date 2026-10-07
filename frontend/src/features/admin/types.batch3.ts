/**
 * Kiểu dữ liệu Admin đợt 3 — theo hợp đồng backend/docs/api/admin-batch3.md.
 * Tiền = cent; thời điểm ISO UTC.
 */

import type { Tone } from './components/ui';
import { tl, type AuditItem } from './types';

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
  missingVariables?: string[];
  /** Tên trường BE mới: danh sách biến thiếu/để trống. */
  missing?: string[];
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
  new: { get label() { return tl('labels.ticketStatus.new'); }, tone: 'b' },
  open: { get label() { return tl('labels.ticketStatus.open'); }, tone: 'o' },
  awaiting_reply: { get label() { return tl('labels.ticketStatus.awaiting_reply'); }, tone: 'x' },
  resolved: { get label() { return tl('labels.ticketStatus.resolved'); }, tone: 'g' },
  closed: { get label() { return tl('labels.ticketStatus.closed'); }, tone: 'x' },
};

export const TICKET_PRIORITY: Record<TicketPriority, { label: string; tone: Tone }> = {
  low: { get label() { return tl('labels.ticketPriority.low'); }, tone: 'x' },
  medium: { get label() { return tl('labels.ticketPriority.medium'); }, tone: 'b' },
  high: { label: 'Cao', tone: 'o' },
  urgent: { get label() { return tl('labels.ticketPriority.urgent'); }, tone: 'r' },
};

export const TICKET_CATEGORY: Record<TicketCategory, { label: string; icon: string }> = {
  user: { get label() { return tl('labels.ticketCategory.user'); }, icon: 'person' },
  creator: { label: 'Creator', icon: 'storefront' },
  payment: { get label() { return tl('labels.ticketCategory.payment'); }, icon: 'credit_card' },
};

export const FLAG_STAGE: Record<FlagStage, { label: string; tone: Tone }> = {
  draft: { get label() { return tl('labels.flagStage.draft'); }, tone: 'x' },
  beta: { get label() { return tl('labels.flagStage.beta'); }, tone: 'o' },
  active: { get label() { return tl('labels.flagStage.active'); }, tone: 'g' },
};

export const TEMPLATE_STATUS: Record<EmailTemplateStatus, { label: string; tone: Tone }> = {
  active: { get label() { return tl('labels.templateStatus.active'); }, tone: 'g' },
  draft: { get label() { return tl('labels.templateStatus.draft'); }, tone: 'x' },
  disabled: { get label() { return tl('labels.templateStatus.disabled'); }, tone: 'r' },
};

/** Nhãn tiếng Việt cho khóa quyền (BE trả nhãn tiếng Anh theo mockup). */
export const PERMISSION_LABEL: Record<string, string> = {
  get 'dashboard.view'() { return tl('labels.permissionLabel.dashboard_view'); },
  get 'community.manage'() { return tl('labels.permissionLabel.community_manage'); },
  get 'report.resolve'() { return tl('labels.permissionLabel.report_resolve'); },
  get 'user.ban'() { return tl('labels.permissionLabel.user_ban'); },
  get 'payment.refund'() { return tl('labels.permissionLabel.payment_refund'); },
  get 'payout.approve'() { return tl('labels.permissionLabel.payout_approve'); },
  get 'system.flags'() { return tl('labels.permissionLabel.system_flags'); },
  get 'admin.manage'() { return tl('labels.permissionLabel.admin_manage'); },
  get 'users.view'() { return tl('labels.permissionLabel.users_view'); },
  get 'content.manage'() { return tl('labels.permissionLabel.content_manage'); },
  get 'payment.view'() { return tl('labels.permissionLabel.payment_view'); },
  get 'payment.manage'() { return tl('labels.permissionLabel.payment_manage'); },
  get 'analytics.view'() { return tl('labels.permissionLabel.analytics_view'); },
  get 'support.manage'() { return tl('labels.permissionLabel.support_manage'); },
  get 'audit.view'() { return tl('labels.permissionLabel.audit_view'); },
  get 'system.settings'() { return tl('labels.permissionLabel.system_settings'); },
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  get moderator() { return tl('labels.staffRoleLabel.moderator'); },
  get support() { return tl('labels.staffRoleLabel.support'); },
  get finance() { return tl('labels.staffRoleLabel.finance'); },
};

export const INTEGRATION_CATEGORY: Record<string, string> = {
  get payments() { return tl('labels.integrationCategory.payments'); },
  email: 'Email',
  get storage() { return tl('labels.integrationCategory.storage'); },
  get analytics() { return tl('labels.integrationCategory.analytics'); },
  video: 'Video',
  chat: 'Chat',
  cdn: 'CDN',
};

/** Nhãn "Phân khúc" / "Cơ cấu" theo khóa của BE (BE trả nhãn tiếng Anh). */
export const SEGMENT_LABEL: Record<string, string> = {
  get free_members() { return tl('labels.segmentLabel.free_members'); },
  get paid_members() { return tl('labels.segmentLabel.paid_members'); },
  creators: 'Creator',
  get staff() { return tl('labels.segmentLabel.staff'); },
};
export const MIX_LABEL: Record<string, string> = {
  get likes() { return tl('labels.mixLabel.likes'); },
  get comments() { return tl('labels.mixLabel.comments'); },
  get posts() { return tl('labels.mixLabel.posts'); },
  get lessons() { return tl('labels.mixLabel.lessons'); },
  get lesson_completions() { return tl('labels.mixLabel.lesson_completions'); },
  get completions() { return tl('labels.mixLabel.completions'); },
  get rsvps() { return tl('labels.mixLabel.rsvps'); },
  get events() { return tl('labels.mixLabel.events'); },
};
export const PLAN_LABEL: Record<string, string> = {
  get subscription() { return tl('labels.planLabel.subscription'); },
  get new_subscription() { return tl('labels.planLabel.new_subscription'); },
  get renewal() { return tl('labels.planLabel.renewal'); },
  get course() { return tl('labels.planLabel.course'); },
  get event() { return tl('labels.planLabel.event'); },
  get one_time() { return tl('labels.planLabel.one_time'); },
  get trial() { return tl('labels.planLabel.trial'); },
};
export const FUNNEL_LABEL: Record<string, string> = {
  get signup() { return tl('labels.funnelLabel.signup'); },
  get joined() { return tl('labels.funnelLabel.joined'); },
  get trial() { return tl('labels.funnelLabel.trial'); },
  get paid() { return tl('labels.funnelLabel.paid'); },
};

/* ---------------- Nhãn hành động nhật ký ---------------- */

const AUDIT_PREFIX: Record<string, string> = {
  get community() { return tl('labels.auditPrefix.community'); },
  get user() { return tl('labels.auditPrefix.user'); },
  get case() { return tl('labels.auditPrefix.case'); },
  get content() { return tl('labels.auditPrefix.content'); },
  get post() { return tl('labels.auditPrefix.post'); },
  get comment() { return tl('labels.auditPrefix.comment'); },
  get lesson() { return tl('labels.auditPrefix.lesson'); },
  get course() { return tl('labels.auditPrefix.course'); },
  get event() { return tl('labels.auditPrefix.event'); },
  media: 'media',
  get payment() { return tl('labels.auditPrefix.payment'); },
  get refund() { return tl('labels.auditPrefix.refund'); },
  get payout() { return tl('labels.auditPrefix.payout'); },
  get chargeback() { return tl('labels.auditPrefix.chargeback'); },
  get subscription() { return tl('labels.auditPrefix.subscription'); },
  get discovery() { return tl('labels.auditPrefix.discovery'); },
  get category() { return tl('labels.auditPrefix.category'); },
  ticket: 'ticket',
  support: 'ticket',
  get admin() { return tl('labels.auditPrefix.admin'); },
  get role() { return tl('labels.auditPrefix.role'); },
  get flag() { return tl('labels.auditPrefix.flag'); },
  get integration() { return tl('labels.auditPrefix.integration'); },
  get notification() { return tl('labels.auditPrefix.notification'); },
  get email_template() { return tl('labels.auditPrefix.email_template'); },
  get template() { return tl('labels.auditPrefix.template'); },
  get settings() { return tl('labels.auditPrefix.settings'); },
  get setting() { return tl('labels.auditPrefix.setting'); },
  get report() { return tl('labels.auditPrefix.report'); },
};
const AUDIT_VERB: Record<string, string> = {
  get create() { return tl('labels.auditVerb.create'); },
  get update() { return tl('labels.auditVerb.update'); },
  get edit() { return tl('labels.auditVerb.edit'); },
  get delete() { return tl('labels.auditVerb.delete'); },
  get remove() { return tl('labels.auditVerb.remove'); },
  get toggle() { return tl('labels.auditVerb.toggle'); },
  get connect() { return tl('labels.auditVerb.connect'); },
  get disconnect() { return tl('labels.auditVerb.disconnect'); },
  get test() { return tl('labels.auditVerb.test'); },
  get assign() { return tl('labels.auditVerb.assign'); },
  get reply() { return tl('labels.auditVerb.reply'); },
  get note() { return tl('labels.auditVerb.note'); },
  get resolve() { return tl('labels.auditVerb.resolve'); },
  get close() { return tl('labels.auditVerb.close'); },
  get reopen() { return tl('labels.auditVerb.reopen'); },
  get escalate() { return tl('labels.auditVerb.escalate'); },
  get suspend() { return tl('labels.auditVerb.suspend'); },
  get enable() { return tl('labels.auditVerb.enable'); },
  get reset() { return tl('labels.auditVerb.reset'); },
  get reset_2fa() { return tl('labels.auditVerb.reset_2fa'); },
  get broadcast() { return tl('labels.auditVerb.broadcast'); },
  get reorder() { return tl('labels.auditVerb.reorder'); },
  get move() { return tl('labels.auditVerb.move'); },
  get feature() { return tl('labels.auditVerb.feature'); },
  get unfeature() { return tl('labels.auditVerb.unfeature'); },
  get hide() { return tl('labels.auditVerb.hide'); },
  get restore() { return tl('labels.auditVerb.restore'); },
  get approve() { return tl('labels.auditVerb.approve'); },
  get reject() { return tl('labels.auditVerb.reject'); },
  get refund() { return tl('labels.auditVerb.refund'); },
  get retry() { return tl('labels.auditVerb.retry'); },
  get cancel() { return tl('labels.auditVerb.cancel'); },
  get grant() { return tl('labels.auditVerb.grant'); },
  get revoke() { return tl('labels.auditVerb.revoke'); },
  get status() { return tl('labels.auditVerb.status'); },
  get export() { return tl('labels.auditVerb.export'); },
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
