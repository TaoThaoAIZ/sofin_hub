/**
 * Thanh toán & gói thành viên. Mọi số tiền lưu bằng SỐ NGUYÊN theo cent (`*Cents`) để tránh lỗi làm tròn;
 * `amountUsd` chỉ giữ để tương thích FE cũ. Cổng thanh toán thật chưa chốt (PLAN.md câu hỏi #2) nên đi qua
 * abstraction `PaymentGateway` (payments.gateway.ts).
 */
export const PAYMENT_METHODS = ['stripe', 'vnpay', 'momo'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// 'pending' | 'succeeded' là 2 giá trị cũ FE đang biết; thêm failed/refunded.
export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

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
  courseId: string;
  status: SubscriptionStatus;
  priceCents: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** Có giá trị nếu gói khởi tạo bằng dùng thử (dùng để chặn dùng thử lần 2). */
  trialEndsAt?: string;
  canceledAt?: string;
  createdAt: string;
}

export const REFUND_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface RefundRequest {
  id: string;
  paymentId: string;
  courseId: string;
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
}

export const PAYOUT_STATUSES = ['requested', 'approved', 'paid', 'rejected', 'failed', 'on_hold'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** Chỉ lưu 4 số cuối tài khoản — không giữ số tài khoản đầy đủ trong hệ thống. */
export interface Payout {
  id: string;
  courseId: string;
  ownerId: string;
  amountCents: number;
  method: { type: 'bank'; bankName: string; accountHolder: string; accountLast4: string };
  status: PayoutStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
