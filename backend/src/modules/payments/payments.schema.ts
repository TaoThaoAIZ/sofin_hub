import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { BILLING_INTERVALS, PAYMENT_METHODS, PAYOUT_STATUSES, REFUND_STATUSES } from './payments.types.js';

export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'discover', 'jcb', 'unionpay', 'diners', 'unknown'] as const;

/**
 * Thẻ đã tokenize PHÍA CLIENT. Object STRICT: mọi trường lạ (số thẻ `number`, `cvc`, `pan`...) bị từ chối ⇒ không có đường nào để PAN/CVC lọt vào server.
 * Hiện token là MOCK (`tok_mock_*`, FE tự tạo sau khi Luhn + kiểm hạn); khi tích hợp Stripe Elements thì token là PaymentMethod id (`pm_...`).
 */
export const paymentMethodInput = z
  .strictObject({
    type: z.literal('card', { error: 'Chỉ hỗ trợ thanh toán bằng thẻ' }),
    token: z.string().regex(/^(tok|pm)_[A-Za-z0-9_]{4,100}$/, 'Mã thẻ (token) không hợp lệ'),
    brand: z.enum(CARD_BRANDS, { error: 'Loại thẻ không hợp lệ' }),
    last4: z.string().regex(/^\d{4}$/, '4 số cuối thẻ không hợp lệ'),
    expMonth: z.number({ error: 'Tháng hết hạn không hợp lệ' }).int().min(1, 'Tháng hết hạn không hợp lệ').max(12, 'Tháng hết hạn không hợp lệ'),
    expYear: z.number({ error: 'Năm hết hạn không hợp lệ' }).int().min(2000, 'Năm hết hạn không hợp lệ').max(2200, 'Năm hết hạn không hợp lệ'),
  })
  .refine((c) => c.expYear > new Date().getUTCFullYear() || (c.expYear === new Date().getUTCFullYear() && c.expMonth >= new Date().getUTCMonth() + 1), {
    message: 'Thẻ đã hết hạn',
    path: ['expMonth'],
  });
export type PaymentMethodInput = z.infer<typeof paymentMethodInput>;

export const intervalField = z.enum(BILLING_INTERVALS, { error: 'Chu kỳ thanh toán không hợp lệ (monthly | annual)' });

export const createCheckoutBody = z.object({
  /** Luôn là chuyển khoản; giữ field để tương thích client cũ (giá trị khác bị bỏ qua). */
  method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  interval: intervalField.default('monthly'),
  paymentMethod: paymentMethodInput.optional(),
});
export type CreateCheckoutBody = z.infer<typeof createCheckoutBody>;

/** Mua lẻ module: giá luôn do server quyết định (không nhận số tiền). Idempotency-Key ở body hoặc header (body ưu tiên). */
export const purchaseModuleBody = z.object({
  paymentMethod: paymentMethodInput.optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const quoteQuery = z.object({ interval: intervalField.default('monthly') });

export const cancelSubscriptionBody = z.object({
  atPeriodEnd: z.boolean().default(true),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const refundRequestBody = z.object({
  reason: z.string().trim().min(3, 'Vui lòng nhập lý do (tối thiểu 3 ký tự)').max(500),
});

export const listRefundsQuery = paginationQuery.extend({ status: z.enum(REFUND_STATUSES).optional() });

export const resolveRefundBody = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
});

export const revenueQuery = z.object({
  from: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  to: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
});

export const createPayoutBody = z.object({
  amountCents: z.number().int('Số tiền phải là số nguyên (cent)').positive('Số tiền phải lớn hơn 0'),
  /** Tùy chọn khi cộng đồng đã kết nối tài khoản nhận tiền (dùng tài khoản đó). */
  method: z
    .object({
      type: z.literal('bank'),
      bankName: z.string().trim().min(1).max(100),
      accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Số tài khoản phải gồm 6–20 chữ số'),
      accountHolder: z.string().trim().min(1).max(100),
    })
    .optional(),
});

export const listPayoutsQuery = paginationQuery.extend({ status: z.enum(PAYOUT_STATUSES).optional() });

export const resolvePayoutBody = z.object({
  action: z.enum(['approve', 'mark_paid', 'reject']),
  note: z.string().trim().max(500).optional(),
});

export const listBankTransactionsQuery = paginationQuery.extend({
  credited: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const approveBankPaymentBody = z.object({
  bankTransactionId: z.string().min(1).max(100).optional(),
  note: z.string().trim().max(500).optional(),
});
