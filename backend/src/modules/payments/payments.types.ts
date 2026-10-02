/**
 * Thanh toán & gói thành viên. Mọi số tiền lưu bằng SỐ NGUYÊN theo cent (`*Cents`) để tránh lỗi làm tròn;
 * `amountUsd` chỉ giữ để tương thích FE cũ. Cổng thanh toán thật chưa chốt (PLAN.md câu hỏi #2) nên đi qua
 * abstraction `PaymentGateway` (payments.gateway.ts).
 */
/** Chu kỳ thanh toán gói thành viên. `periodDays` lấy từ Global Settings (monthly = subscriptionPeriodDays, annual = annualPeriodDays). */
export const BILLING_INTERVALS = ['monthly', 'annual'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Thẻ đã tokenize: CHỈ brand/last4/hạn dùng (+ id nội bộ). Không bao giờ có số thẻ đầy đủ/CVC/token cổng ở view. */
export interface PaymentCardView {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  createdAt?: string;
}

export const PAYMENT_METHODS = ['stripe', 'vnpay', 'momo'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// 'pending' | 'succeeded' là 2 giá trị cũ FE đang biết; thêm failed/refunded.
export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface PaymentIntent {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  userId: string;
  method: PaymentMethod;
  amountUsd: number;
  trialDays: number;
  /** Chu kỳ của gói mà giao dịch này mua (amountCents = giá của chu kỳ đó). */
  interval: BillingInterval;
  paymentCardId?: string;
  status: PaymentStatus;
  createdAt: string;
  confirmedAt?: string;
  // --- mới (chỉ thêm) ---
  amountCents: number;
  currency: 'usd';
  /** initial = lần thanh toán đầu của 1 gói; renewal = gia hạn kỳ tiếp theo. */
  kind: 'initial' | 'renewal';
  subscriptionId?: string;
  invoiceNumber?: string;
  gatewayChargeId?: string;
  refundedCents: number;
  /** Lý do thất bại (nếu status=failed). */
  failureReason?: string;
  periodStart?: string;
  periodEnd?: string;
}

export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'canceled', 'expired', 'past_due', 'paused'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** active + cancelAtPeriodEnd=true nghĩa là "đã hủy, còn truy cập tới hết kỳ". */
export interface Subscription {
  id: string;
  userId: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  status: SubscriptionStatus;
  /** Số tiền MỖI KỲ (annual = giá cả năm). */
  priceCents: number;
  interval: BillingInterval;
  /** Thẻ lưu để gia hạn / trừ tiền cuối dùng thử (không có = dùng thử không thẻ). */
  paymentCardId?: string;
  trialReminderSentAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** Có giá trị nếu gói khởi tạo bằng dùng thử (dùng để chặn dùng thử lần 2). */
  trialEndsAt?: string;
  canceledAt?: string;
  createdAt: string;
}

/** refunding = đã khóa yêu cầu + đang/đã gọi cổng, chờ chốt (kẹt quá lâu => reconcileStuckRefunds). */
export const REFUND_STATUSES = ['pending', 'refunding', 'approved', 'rejected'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface RefundRequest {
  id: string;
  paymentId: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  userId: string;
  amountCents: number;
  reason: string;
  status: RefundStatus;
  /** true nếu hệ thống tự duyệt vì nằm trong cửa sổ hoàn tiền. */
  auto: boolean;
  note?: string;
  resolvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
  /** Mã khoản hoàn của cổng (khóa idempotency gửi cổng chính là `id` của yêu cầu này). */
  gatewayRefundId?: string;
  refundingAt?: string;
}

export const PAYOUT_STATUSES = ['requested', 'approved', 'paid', 'rejected', 'failed', 'on_hold'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** Chỉ lưu 4 số cuối tài khoản — không giữ số tài khoản đầy đủ trong hệ thống. */
export interface Payout {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  ownerId: string;
  amountCents: number;
  method: { type: 'bank'; bankName: string; accountHolder: string; accountLast4: string };
  status: PayoutStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
