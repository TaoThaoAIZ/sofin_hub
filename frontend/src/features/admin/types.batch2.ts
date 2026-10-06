import { tl, type AuditItem, type StatusMeta } from './types';

/** Kiểu dữ liệu theo hợp đồng backend/docs/api/admin-batch2.md (Nội dung · Thanh toán · Khám phá). */

export interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}
export interface Ref {
  id: string;
  name: string;
}

export type AuditLogItem = AuditItem;

/* ================================ A. Nội dung ================================ */

export type ContentStatus = 'published' | 'hidden' | 'removed';

export interface PostSummary {
  total: number;
  today: number;
  reported: number;
  removed: number;
  hidden: number;
}

export interface AdminPost {
  id: string;
  code: string;
  title: string;
  excerpt: string;
  category: string;
  author: Person;
  community: Ref;
  likes: number;
  comments: number;
  engagement: number;
  reports: number;
  underReview: boolean;
  status: ContentStatus;
  pinned: boolean;
  imageUrl: string | null;
  hasPoll: boolean;
  moderationReason: string | null;
  moderatedAt: string | null;
  moderatedBy: Person | null;
  createdAt: string;
}

export interface ReportRef {
  id: string;
  caseCode: string;
  reason: string;
  status: string;
  reporter: Person;
  createdAt: string;
}

export interface AdminPostDetail extends AdminPost {
  content: string;
  tags: string[];
  thread: { id: string; author: Person; text: string; status: string; createdAt: string }[];
  reportList: ReportRef[];
  history: AuditLogItem[];
}

export interface AdminComment {
  id: string;
  code: string;
  title: string;
  excerpt: string;
  author: Person;
  post: { id: string; title: string };
  community: Ref;
  reports: number;
  underReview: boolean;
  status: ContentStatus;
  moderationReason: string | null;
  moderatedAt: string | null;
  moderatedBy: Person | null;
  createdAt: string;
}
export interface AdminCommentDetail extends AdminComment {
  content: string;
  reportList: ReportRef[];
  history: AuditLogItem[];
}

export interface ContentSummary {
  total: number;
  [k: string]: number;
}

export type CourseStatus = 'published' | 'draft' | 'archived' | 'removed';
export interface AdminCourse {
  id: string;
  title: string;
  thumbnail: string | null;
  community: Ref;
  creator: Person | null;
  students: number;
  lessons: number;
  /** Số module của khóa học (contract communities-courses §5). */
  modules?: number;
  completionPct: number;
  reports: number;
  status: CourseStatus;
  moderationReason: string | null;
  moderatedAt: string | null;
  createdAt: string;
}
export interface AdminCourseDetail extends AdminCourse {
  description: string | null;
  lessonList: { id: string; title: string; type: string; durationMin: number | null; status: string }[];
  moduleList?: { id: string; title: string; lessons: number }[];
  history: AuditLogItem[];
}

export interface AdminLesson {
  id: string;
  code: string;
  title: string;
  type: 'video' | 'text' | 'file' | string;
  durationMin: number | null;
  module: Ref & { title?: string };
  community: Ref;
  views: number;
  reports: number;
  status: ContentStatus;
  moderationReason: string | null;
  moderatedAt: string | null;
  createdAt: string;
}
export interface AdminLessonDetail extends AdminLesson {
  body: string | null;
  videoUrl: string | null;
  embedUrl: string | null;
  attachments: unknown[];
  history: AuditLogItem[];
}

export type EventStatus = 'upcoming' | 'live' | 'completed' | 'cancelled' | 'removed';
export interface AdminEvent {
  id: string;
  title: string;
  community: Ref;
  host: Person;
  attendees: number;
  capacity: number | null;
  startAt: string;
  timezone: string;
  meetingLink: string | null;
  location: string | null;
  status: EventStatus;
  cancelReason: string | null;
  reports: number;
  createdAt: string;
}
export interface AdminEventDetail extends AdminEvent {
  description: string | null;
  rsvps: Person[];
  history: AuditLogItem[];
}

export type MediaKind = 'image' | 'video' | 'document' | 'audio';
export type MediaStatus = 'active' | 'flagged' | 'removed';
export interface MediaSummary {
  total: number;
  totalSizeBytes: number;
  flagged: number;
  removed: number;
  byKind: Record<MediaKind, number>;
}
export interface AdminMedia {
  key: string;
  filename: string;
  kind: MediaKind;
  contentType: string;
  size: number;
  purpose: string;
  owner: Person;
  community: Ref | null;
  url: string | null;
  status: MediaStatus;
  flagged: boolean;
  flagReason: string | null;
  reports: number;
  moderatedAt: string | null;
  uploadedAt: string;
}

/* ================================ B. Thanh toán ================================ */

export type TxStatus = 'succeeded' | 'failed' | 'pending' | 'refunded';

export interface TxSummary {
  grossVolumeCents: number;
  netRevenueCents: number;
  transactions: number;
  failed: number;
  failedRatePct: number;
  refundsCents: number;
}

export interface AdminTransaction {
  id: string;
  code: string;
  invoiceNumber: string | null;
  customer: Person;
  community: { id: string; name: string; ownerName: string };
  product: { type: string; label: string };
  kind: 'initial' | 'renewal';
  method: string;
  paymentMethodLabel: string;
  currency: string;
  amountCents: number;
  refundedCents: number;
  platformFeeCents: number;
  gatewayFeeCents: number;
  creatorEarningsCents: number;
  status: TxStatus;
  failureReason: string | null;
  subscriptionId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface TxTimelineItem {
  type: 'payment_captured' | 'payment_failed' | 'refunded' | 'chargeback' | 'checkout' | string;
  title: string;
  detail: string | null;
  at: string;
}

export interface AdminTransactionDetail extends AdminTransaction {
  gatewayChargeId: string | null;
  gateway: string;
  customerInfo: Person & { joinedAt: string; status: string };
  creator: Person | null;
  subscription: { id: string; status: string; currentPeriodEnd: string | null } | null;
  refunds: AdminRefund[];
  chargebacks: AdminChargeback[];
  timeline: TxTimelineItem[];
  history: AuditLogItem[];
}

export type SubStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';
export interface SubSummary {
  active: number;
  new30d: number;
  mrrCents: number;
  churnPct: number;
  pastDue: number;
  paused: number;
}
export interface AdminSubscription {
  id: string;
  code: string;
  user: Person;
  community: Ref;
  plan: 'paid' | 'trial' | string;
  amountCents: number;
  billingCycle: string;
  status: SubStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingAt: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  createdAt: string;
}

export type RefundStatus = 'pending' | 'refunding' | 'approved' | 'rejected';
export interface RefundSummary {
  pending: number;
  refunding?: number;
  approved: number;
  rejected: number;
  pendingAmountCents: number;
  refundedAmountCents: number;
}
export interface AdminRefund {
  id: string;
  code: string;
  paymentId: string;
  transactionCode: string;
  customer: Person;
  creator: Person | null;
  community: Ref;
  amountCents: number;
  paymentAmountCents: number;
  reason: string;
  status: RefundStatus;
  auto: boolean;
  note: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: Person | null;
}
export interface AdminRefundDetail extends AdminRefund {
  payment: AdminTransaction;
  paymentHistory: { id: string; code: string; amountCents: number; status: string; createdAt: string }[];
  customerHistory: {
    memberSince: string | null;
    previousRefunds: { id: string; amountCents: number; status: string; requestedAt: string }[];
    reportsReceived: number;
  };
  creatorResponse: { text: string; at: string; author?: Person } | null;
  history: AuditLogItem[];
}

export type ChargebackStatus = 'open' | 'under_review' | 'won' | 'lost';
export interface ChargebackSummary {
  open: number;
  underReview: number;
  won: number;
  lost: number;
  disputedAmountCents: number;
}
export interface AdminChargeback {
  id: string;
  code: string;
  paymentId: string;
  transactionCode: string;
  customer: Person;
  creator: Person | null;
  community: Ref;
  amountCents: number;
  reason: string;
  status: ChargebackStatus;
  deadlineAt: string;
  daysLeft: number | null;
  evidence: 'missing' | 'submitted';
  evidenceNote: string | null;
  evidenceUrls: string[];
  gatewayDisputeId: string | null;
  openedAt: string;
  resolvedAt: string | null;
}
export interface AdminChargebackDetail extends AdminChargeback {
  payment: AdminTransaction;
  history: AuditLogItem[];
}

export interface CreatorSummary {
  creators: number;
  grossCents: number;
  refundsCents: number;
  platformFeeCents: number;
  gatewayFeeCents: number;
  netCents: number;
  pendingBalanceCents: number;
  withdrawableCents?: number;
  heldCents?: number;
  reserveCents?: number;
  debtCents?: number;
}
export interface AdminCreatorRevenue {
  creator: Person;
  communities: number;
  grossCents: number;
  refundsCents: number;
  platformFeeCents: number;
  gatewayFeeCents: number;
  netCents: number;
  pendingBalanceCents: number;
  paidOutCents: number;
  withdrawableCents?: number;
  heldCents?: number;
  reserveCents?: number;
  debtCents?: number;
}
export interface CreatorDetail {
  creator: Person;
  kpis: Omit<CreatorSummary, 'creators'> & { paidOutCents: number };
  series: { date: string; grossCents: number; netCents: number; refundsCents: number }[];
  communities: { id: string; name: string; grossCents: number; netCents: number; pendingBalanceCents: number; withdrawableCents?: number; heldCents?: number; reserveCents?: number; debtCents?: number }[];
  transactions: AdminTransaction[];
  payouts: AdminPayout[];
}

export type PayoutStatus = 'requested' | 'approved' | 'paid' | 'failed' | 'on_hold' | 'rejected';
export interface PayoutSummary {
  pendingCents: number;
  processingCents: number;
  paidCents: number;
  failedCents: number;
  onHoldCents: number;
  counts: Record<PayoutStatus, number>;
}
export interface AdminPayout {
  id: string;
  code: string;
  creator: Person;
  community: Ref;
  amountCents: number;
  method: { type: string; bankName?: string; accountMasked?: string; label: string };
  status: PayoutStatus;
  scheduledFor: string;
  paidAt: string | null;
  failureReason: string | null;
  heldFromStatus: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AdminPayoutDetail extends AdminPayout {
  creatorBalance: { netCents: number; requestedCents: number; availableCents: number; withdrawableCents?: number; heldCents?: number; reserveCents?: number; debtCents?: number; holdDays?: number };
  history: AuditLogItem[];
}

/* ================================ C. Khám phá ================================ */

export type DiscoveryStatus = 'listed' | 'featured' | 'hidden' | 'unlisted';
export type SearchVis = 'searchable' | 'reduced' | 'hidden';

export interface ListedSummary {
  total: number;
  listed: number;
  featured: number;
  hidden: number;
  unlisted: number;
}
export interface AdminListedCommunity {
  id: string;
  name: string;
  slug: string;
  thumbnail: string | null;
  category: string;
  categoryLabel: string;
  owner: Person | null;
  members: number;
  growthPct: number;
  engagementPct: number;
  rating: number;
  ratingCount: number;
  discoveryStatus: DiscoveryStatus;
  listedStatus: 'listed' | 'hidden' | 'unlisted';
  searchVisibility: SearchVis;
  featuredSections: string[];
  visibility: string;
  moderationStatus: string;
  discoveryReason: string | null;
  createdAt: string;
}

export interface AdminCategory {
  key: string;
  slug: string;
  name: string;
  description: string | null;
  status: 'active' | 'disabled';
  position: number;
  communities: number;
  createdAt: string;
}

export type FeaturedSectionKey = 'featured' | 'trending' | 'editors_picks' | 'new_noteworthy';
export interface FeaturedEntry {
  id: string;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  community: { id: string; name: string; thumbnail: string | null; category: string; categoryLabel: string; members: number };
}
export interface FeaturedSection {
  key: FeaturedSectionKey;
  label: string;
  items: FeaturedEntry[];
}

export type RankingWeights = Record<'memberGrowth' | 'engagement' | 'retention' | 'rating' | 'revenue' | 'reportPenalty', number>;
export interface RankingRow {
  rank: number;
  id: string;
  name: string;
  thumbnail: string | null;
  category: string;
  categoryLabel: string;
  score: number;
  signals: RankingWeights;
}
export interface RankingsData {
  weights: RankingWeights;
  defaults: RankingWeights;
  updatedAt: string | null;
  updatedBy: Person | null;
  preview: RankingRow[];
}

export interface SearchVisSummary {
  total: number;
  searchable: number;
  reduced: number;
  hidden: number;
}
export interface AdminSearchVisibility {
  id: string;
  name: string;
  thumbnail: string | null;
  category: string;
  searchVisibility: SearchVis;
  discoveryStatus: string;
  qualityScore: number;
  violations: number;
  members: number;
}

/* ================================ Nhãn hiển thị ================================ */

export const CONTENT_STATUS: Record<string, StatusMeta> = {
  published: { get label() { return tl('labels.contentStatus.published'); }, tone: 'g' },
  under_review: { get label() { return tl('labels.contentStatus.under_review'); }, tone: 'o' },
  hidden: { get label() { return tl('labels.contentStatus.hidden'); }, tone: 'o' },
  removed: { get label() { return tl('labels.contentStatus.removed'); }, tone: 'r' },
  draft: { get label() { return tl('labels.contentStatus.draft'); }, tone: 'x' },
  archived: { get label() { return tl('labels.contentStatus.archived'); }, tone: 'x' },
  upcoming: { get label() { return tl('labels.contentStatus.upcoming'); }, tone: 'b' },
  live: { get label() { return tl('labels.contentStatus.live'); }, tone: 'g' },
  completed: { get label() { return tl('labels.contentStatus.completed'); }, tone: 'x' },
  cancelled: { get label() { return tl('labels.contentStatus.cancelled'); }, tone: 'r' },
  active: { get label() { return tl('labels.contentStatus.active'); }, tone: 'g' },
  flagged: { get label() { return tl('labels.contentStatus.flagged'); }, tone: 'o' },
  disabled: { get label() { return tl('labels.contentStatus.disabled'); }, tone: 'x' },
};

export const TX_STATUS: Record<string, StatusMeta> = {
  succeeded: { get label() { return tl('labels.txStatus.succeeded'); }, tone: 'g' },
  failed: { get label() { return tl('labels.txStatus.failed'); }, tone: 'r' },
  pending: { get label() { return tl('labels.txStatus.pending'); }, tone: 'o' },
  refunded: { get label() { return tl('labels.txStatus.refunded'); }, tone: 'x' },
};

export const SUB_STATUS: Record<string, StatusMeta> = {
  trialing: { get label() { return tl('labels.subStatus.trialing'); }, tone: 'b' },
  active: { get label() { return tl('labels.subStatus.active'); }, tone: 'g' },
  past_due: { get label() { return tl('labels.subStatus.past_due'); }, tone: 'o' },
  paused: { get label() { return tl('labels.subStatus.paused'); }, tone: 'x' },
  canceled: { get label() { return tl('labels.subStatus.canceled'); }, tone: 'r' },
  expired: { get label() { return tl('labels.subStatus.expired'); }, tone: 'x' },
};

export const REFUND_STATUS: Record<RefundStatus, StatusMeta> = {
  pending: { get label() { return tl('labels.refundStatus.pending'); }, tone: 'o' },
  refunding: { get label() { return tl('labels.refundStatus.refunding'); }, tone: 'b' },
  approved: { get label() { return tl('labels.refundStatus.approved'); }, tone: 'g' },
  rejected: { get label() { return tl('labels.refundStatus.rejected'); }, tone: 'r' },
};

export const CHARGEBACK_STATUS: Record<ChargebackStatus, StatusMeta> = {
  open: { get label() { return tl('labels.chargebackStatus.open'); }, tone: 'o' },
  under_review: { get label() { return tl('labels.chargebackStatus.under_review'); }, tone: 'b' },
  won: { get label() { return tl('labels.chargebackStatus.won'); }, tone: 'g' },
  lost: { label: 'Thua', tone: 'r' },
};

export const CHARGEBACK_REASON: Record<string, string> = {
  get fraudulent() { return tl('labels.chargebackReason.fraudulent'); },
  get product_not_received() { return tl('labels.chargebackReason.product_not_received'); },
  get duplicate() { return tl('labels.chargebackReason.duplicate'); },
  get subscription_cancelled() { return tl('labels.chargebackReason.subscription_cancelled'); },
  get unrecognized() { return tl('labels.chargebackReason.unrecognized'); },
  get product_not_as_described() { return tl('labels.chargebackReason.product_not_as_described'); },
};

export const PAYOUT_STATUS: Record<PayoutStatus, StatusMeta> = {
  requested: { get label() { return tl('labels.payoutStatus.requested'); }, tone: 'o' },
  approved: { get label() { return tl('labels.payoutStatus.approved'); }, tone: 'b' },
  paid: { get label() { return tl('labels.payoutStatus.paid'); }, tone: 'g' },
  failed: { get label() { return tl('labels.payoutStatus.failed'); }, tone: 'r' },
  on_hold: { get label() { return tl('labels.payoutStatus.on_hold'); }, tone: 'x' },
  rejected: { get label() { return tl('labels.payoutStatus.rejected'); }, tone: 'r' },
};

export const LISTED_STATUS: Record<string, StatusMeta> = {
  listed: { get label() { return tl('labels.listedStatus.listed'); }, tone: 'g' },
  featured: { get label() { return tl('labels.listedStatus.featured'); }, tone: 'o' },
  hidden: { get label() { return tl('labels.listedStatus.hidden'); }, tone: 'x' },
  unlisted: { get label() { return tl('labels.listedStatus.unlisted'); }, tone: 'r' },
};

export const SEARCH_VIS: Record<SearchVis, StatusMeta> = {
  searchable: { get label() { return tl('labels.searchVis.searchable'); }, tone: 'g' },
  reduced: { get label() { return tl('labels.searchVis.reduced'); }, tone: 'o' },
  hidden: { get label() { return tl('labels.searchVis.hidden'); }, tone: 'x' },
};

export const FEATURED_LABEL: Record<FeaturedSectionKey, string> = {
  get featured() { return tl('labels.featuredLabel.featured'); },
  get trending() { return tl('labels.featuredLabel.trending'); },
  get editors_picks() { return tl('labels.featuredLabel.editors_picks'); },
  get new_noteworthy() { return tl('labels.featuredLabel.new_noteworthy'); },
};

export const FACTOR_LABEL: Record<keyof RankingWeights, string> = {
  get memberGrowth() { return tl('labels.factorLabel.memberGrowth'); },
  get engagement() { return tl('labels.factorLabel.engagement'); },
  get retention() { return tl('labels.factorLabel.retention'); },
  get rating() { return tl('labels.factorLabel.rating'); },
  revenue: 'Doanh thu',
  get reportPenalty() { return tl('labels.factorLabel.reportPenalty'); },
};

export const LESSON_ICON: Record<string, string> = { video: 'play_circle', text: 'description', file: 'attach_file', link: 'link' };
export const LESSON_TYPE: Record<string, string> = { video: 'Video', get text() { return tl('labels.lessonType.text'); }, get file() { return tl('labels.lessonType.file'); }, get link() { return tl('labels.lessonType.link'); } };
export const MEDIA_KIND_LABEL: Record<string, string> = { get image() { return tl('labels.mediaKindLabel.image'); }, video: 'Video', get document() { return tl('labels.mediaKindLabel.document'); }, get audio() { return tl('labels.mediaKindLabel.audio'); } };
export const REFUND_REASONS = ['Bị trừ tiền 2 lần', 'Không sử dụng sản phẩm', 'Nội dung không như mô tả', 'Mua nhầm', 'Đã hủy nhưng vẫn bị trừ tiền', 'Lỗi kỹ thuật', 'Đổi ý', 'Trùng tài khoản'] as const;

/** Tên danh mục mặc định (Tiếng Việt) khi admin thêm danh mục theo key. */
export const CATEGORY_DEFAULT_NAME: Record<string, string> = {
  business: 'Kinh doanh',
  get content() { return tl('labels.categoryDefaultName.content'); },
  get tech() { return tl('labels.categoryDefaultName.tech'); },
  get finance() { return tl('labels.categoryDefaultName.finance'); },
  get health() { return tl('labels.categoryDefaultName.health'); },
  get self() { return tl('labels.categoryDefaultName.self'); },
  get hobby() { return tl('labels.categoryDefaultName.hobby'); },
  get relationships() { return tl('labels.categoryDefaultName.relationships'); },
  marketing: 'Marketing',
  get design() { return tl('labels.categoryDefaultName.design'); },
};

export const methodLabel = (m: string) => ({ stripe: 'Stripe', vnpay: 'VNPay', momo: 'MoMo' })[m] ?? m;
export const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);
