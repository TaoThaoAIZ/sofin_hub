import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { PAYMENT_METHODS, PAYOUT_STATUSES, REFUND_STATUSES } from './payments.types.js';

export const createCheckoutBody = z.object({
  method: z.enum(PAYMENT_METHODS),
});
export type CreateCheckoutBody = z.infer<typeof createCheckoutBody>;

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
  method: z.object({
    type: z.literal('bank'),
    bankName: z.string().trim().min(1).max(100),
    accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Số tài khoản phải gồm 6–20 chữ số'),
    accountHolder: z.string().trim().min(1).max(100),
  }),
});

export const listPayoutsQuery = paginationQuery.extend({ status: z.enum(PAYOUT_STATUSES).optional() });

export const resolvePayoutBody = z.object({
  action: z.enum(['approve', 'mark_paid', 'reject']),
  note: z.string().trim().max(500).optional(),
});

/** Sự kiện webhook chung; `data` được kiểm tra chi tiết theo từng loại trong service. */
export const webhookEventBody = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type WebhookEventBody = z.infer<typeof webhookEventBody>;
