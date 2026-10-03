export type PaymentMethod = 'stripe' | 'vnpay' | 'momo';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface PaymentIntent {
  id: string;
  courseId: string;
  userId: string;
  method: PaymentMethod;
  amountUsd: number;
  trialDays: number;
  status: PaymentStatus;
  createdAt: string;
  confirmedAt?: string;
  amountCents?: number;
  kind?: 'initial' | 'renewal';
  subscriptionId?: string;
  invoiceNumber?: string;
  refundedCents?: number;
  periodStart?: string;
  periodEnd?: string;
  interval?: 'monthly' | 'annual';
}

export interface SubscriptionStatus {
  enrolled: boolean;
  latestPayment?: PaymentIntent;
  subscription?: Subscription | null;
}

export type SubscriptionState = 'trialing' | 'active' | 'canceled' | 'expired';

export interface Subscription {
  id: string;
  userId: string;
  courseId: string;
  status: SubscriptionState;
  priceCents: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
  canceledAt?: string;
  createdAt: string;
  courseTitle?: string;
  accessUntil?: string | null;
  interval?: 'monthly' | 'annual';
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaymentRecord extends PaymentIntent {
  courseTitle?: string;
  /** Trạng thái yêu cầu hoàn tiền mới nhất của giao dịch (null = chưa yêu cầu). */
  refundStatus?: RefundStatus | 'refunding' | null;
}

export interface Invoice {
  invoiceNumber: string;
  issuedAt?: string;
  status: PaymentStatus;
  currency: string;
  buyer: { id: string; name: string; email?: string };
  community: { id: string; title: string };
  items: { description: string; quantity: number; unitCents: number; amountCents: number }[];
  subtotalCents: number;
  refundedCents: number;
  totalCents: number;
  paymentId: string;
}

export type RefundStatus = 'pending' | 'approved' | 'rejected';

export interface RefundRequest {
  id: string;
  paymentId: string;
  courseId: string;
  userId: string;
  amountCents: number;
  reason: string;
  status: RefundStatus;
  auto: boolean;
  note?: string;
  resolvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}

export type PayoutStatus = 'requested' | 'approved' | 'paid' | 'rejected' | 'failed' | 'on_hold';

export interface Payout {
  id: string;
  courseId: string;
  ownerId: string;
  amountCents: number;
  method: { type: 'bank'; bankName: string; accountHolder: string; accountLast4?: string; accountMasked?: string };
  status: PayoutStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueSummary {
  currency: string;
  range: { from: string | null; to: string | null };
  grossCents: number;
  refundsCents: number;
  platformCommissionCents: number;
  gatewayFeeCents: number;
  netCents: number;
  /** Số tiền có thể rút NGAY (sau holding + reserve + payout đang chờ; 0 nếu còn nợ). */
  availableBalanceCents: number;
  /** net − payout đã yêu cầu (có thể âm). */
  totalBalanceCents?: number;
  /** Còn trong cửa sổ hoàn tiền/tranh chấp. */
  heldCents?: number;
  reserveCents?: number;
  debtCents?: number;
  payoutPolicy?: { holdDays: number; refundWindowDays: number; disputeWindowDays: number; reservePct: number; note?: string };
  payoutRequestedCents: number;
  activePaidMembers: number;
  trialingMembers: number;
  mrrCents: number;
  assumptions: { platformCommissionPct: number; gatewayFeePct: number; gatewayFeeFixedCents: number; note: string };
  recentTransactions: {
    id: string;
    userId: string;
    kind: 'initial' | 'renewal';
    status: PaymentStatus;
    amountCents: number;
    refundedCents: number;
    invoiceNumber?: string;
    confirmedAt?: string;
  }[];
}

export interface PayoutInput {
  amountCents: number;
  method: { type: 'bank'; bankName: string; accountNumber: string; accountHolder: string };
}

export interface QuotePlan {
  interval: 'monthly' | 'annual';
  label: string;
  priceUsd: number;
  billedUsd: number;
  perMonthUsd: number;
  savingsPct: number;
  popular: boolean;
  periodDays: number;
}

/** Báo giá từ GET /communities/:id/checkout-quote — mọi con số/ngày trong hộp thoại thanh toán đều lấy từ đây. */
export interface CheckoutQuote {
  communityId: string;
  currency: string;
  paid: boolean;
  plans: QuotePlan[];
  selected: 'monthly' | 'annual';
  trialDays: number;
  trialEligible: boolean;
  startsAt: string;
  firstChargeDate: string;
  firstChargeAmountUsd: number;
  firstChargeAmountCents: number;
  dueTodayUsd: number;
  remindDaysBefore: number;
  remindAt: string | null;
  cancelAnytime: boolean;
  provider: string;
}
