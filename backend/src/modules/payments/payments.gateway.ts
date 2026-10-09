import { randomUUID } from 'node:crypto';

/**
 * Cổng thanh toán = NGÂN HÀNG (VietQR + SePay). Tiền VÀO không đi qua interface này: SePay đẩy webhook / cron quét về
 * (xem payments.bank.ts) rồi gọi chính `settle()` của service. Interface chỉ còn phần tiền RA — hoàn tiền.
 *
 * Chuyển khoản không có API hoàn tiền: `refund` GHI NHẬN khoản phải hoàn (đã khóa idempotency theo `idempotencyKey`) và trả
 * mã `manual:<key>`; admin chuyển khoản trả khách NGOÀI hệ thống (giống payout cho owner). Hệ thống đã thu hồi quyền truy cập.
 */
export interface RefundResult {
  ok: boolean;
  refundId: string;
  failureReason?: string;
}

export interface PaymentGateway {
  /**
   * Ghi nhận hoàn tiền. `idempotencyKey` (= id RefundRequest) BẮT BUỘC: gọi lại cùng key (retry sau timeout, job đối soát) phải trả đúng
   * khoản cũ, không ghi thêm — nên service được phép gọi lại an toàn.
   */
  refund(chargeId: string, amountCents: number, idempotencyKey: string): Promise<RefundResult>;
}

export class BankTransferGateway implements PaymentGateway {
  private readonly refunded = new Map<string, number>();
  private readonly refundsByKey = new Map<string, RefundResult>();
  private failing = false;

  /** Test/dev: ép bước ghi nhận hoàn tiền thất bại (mô phỏng lỗi hệ thống). */
  failRefunds(fail = true) {
    this.failing = fail;
  }

  async refund(chargeId: string, amountCents: number, idempotencyKey: string): Promise<RefundResult> {
    if (amountCents <= 0) return { ok: false, refundId: '', failureReason: 'invalid_amount' };
    if (this.failing) return { ok: false, refundId: '', failureReason: 'gateway_error' };
    const prior = idempotencyKey ? this.refundsByKey.get(idempotencyKey) : undefined;
    if (prior) return prior;
    this.refunded.set(chargeId, (this.refunded.get(chargeId) ?? 0) + amountCents);
    const result: RefundResult = { ok: true, refundId: `manual:${idempotencyKey || randomUUID()}` };
    if (idempotencyKey) this.refundsByKey.set(idempotencyKey, result);
    return result;
  }

  /** Test/dev: tổng đã ghi nhận hoàn cho 1 giao dịch (sau khi dedupe theo idempotency key). */
  refundedTotal(chargeId: string): number {
    return this.refunded.get(chargeId) ?? 0;
  }
}

export const bankGateway = new BankTransferGateway();
export const paymentGateway: PaymentGateway = bankGateway;
