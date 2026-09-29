import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Abstraction cổng thanh toán. Service chỉ nói chuyện qua interface này nên đổi Stripe/PayOS/VNPay không đụng nghiệp vụ.
 * Xem docs/api/payments.md ("Viết StripeGateway / PayOSGateway") để biết cách hiện thực.
 */
export interface ChargeRequest {
  amountCents: number;
  currency: 'usd';
  description: string;
  /** userId phía SofinHub (cổng thật sẽ map sang customer id). */
  customerId: string;
  /** Khóa idempotency gửi cổng để không trừ tiền 2 lần khi retry. */
  idempotencyKey: string;
}
export interface ChargeResult {
  ok: boolean;
  chargeId: string;
  failureReason?: string;
}
export interface RefundResult {
  ok: boolean;
  refundId: string;
  failureReason?: string;
}

export interface PaymentGateway {
  createCharge(req: ChargeRequest): Promise<ChargeResult>;
  refund(chargeId: string, amountCents: number): Promise<RefundResult>;
  /**
   * Xác thực chữ ký webhook trên RAW body (không phải JSON đã parse). Phải so sánh timing-safe và chặn replay
   * bằng timestamp trong chữ ký (dung sai ±WEBHOOK_TOLERANCE_SEC).
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean;
}

export const WEBHOOK_TOLERANCE_SEC = 300;
export const WEBHOOK_SIGNATURE_HEADER = 'x-sofin-signature';

/** Tạo header chữ ký dạng `t=<unix giây>,v1=<hex HMAC-SHA256 của "t.rawBody">` (cùng cách Stripe ký). */
export function signWebhookPayload(rawBody: Buffer | string, secret: string, timestampSec = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac('sha256', secret).update(`${timestampSec}.`).update(rawBody).digest('hex');
  return `t=${timestampSec},v1=${mac}`;
}

/** Cổng giả lập cho dev/test: luôn thành công trừ user nằm trong `failFor`. */
export class MockGateway implements PaymentGateway {
  private readonly failing = new Set<string>();
  private readonly refunded = new Map<string, number>();
  /** Như cổng thật: cùng idempotencyKey ⇒ trả lại đúng kết quả cũ, không trừ tiền lần nữa (chỉ nhớ lần thành công). */
  private readonly charges = new Map<string, ChargeResult>();

  /** Test/dev: bắt các lần trừ tiền của user này thất bại (vd. thẻ hết hạn khi gia hạn). */
  failFor(userId: string, fail = true) {
    if (fail) this.failing.add(userId);
    else this.failing.delete(userId);
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    const prior = this.charges.get(req.idempotencyKey);
    if (prior) return prior;
    if (this.failing.has(req.customerId)) return { ok: false, chargeId: `mock_ch_${randomUUID()}`, failureReason: 'card_declined' };
    const result: ChargeResult = { ok: true, chargeId: `mock_ch_${randomUUID()}` };
    this.charges.set(req.idempotencyKey, result);
    return result;
  }

  async refund(chargeId: string, amountCents: number): Promise<RefundResult> {
    if (amountCents <= 0) return { ok: false, refundId: '', failureReason: 'invalid_amount' };
    this.refunded.set(chargeId, (this.refunded.get(chargeId) ?? 0) + amountCents);
    return { ok: true, refundId: `mock_re_${randomUUID()}` };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    if (!signature) return false;
    const parts = Object.fromEntries(signature.split(',').map((p) => p.trim().split('=') as [string, string]));
    const t = Number(parts.t);
    const v1 = parts.v1;
    if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
    if (Math.abs(Date.now() / 1000 - t) > WEBHOOK_TOLERANCE_SEC) return false;
    const expected = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(`${t}.`).update(rawBody).digest();
    const given = Buffer.from(v1, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}

export const mockGateway = new MockGateway();
/** Gateway đang dùng. Khi chốt cổng thật: đổi dòng này (hoặc chọn theo env). */
export const paymentGateway: PaymentGateway = mockGateway;
