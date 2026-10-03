import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { auditService } from '../admin/admin-audit.service.js';
import { adminOnly } from '../admin/admin.common.js';
import { WEBHOOK_SIGNATURE_HEADER } from './payments.gateway.js';
import {
  cancelSubscriptionBody,
  createCheckoutBody,
  quoteQuery,
  startTrialBody,
  createPayoutBody,
  listPayoutsQuery,
  listRefundsQuery,
  paginationQuery,
  paymentMethodInput,
  refundRequestBody,
  resolvePayoutBody,
  resolveRefundBody,
  revenueQuery,
} from './payments.schema.js';
import { paymentsService } from './payments.service.js';
import { billingSummary, cardsService } from './payments.cards.js';

export const paymentsRouter = Router();
const id = (v: unknown) => v as string;

// ---- checkout / xác nhận (giữ nguyên hình dạng response cũ)
paymentsRouter.post('/courses/:id/checkout', requireAuth, async (req, res) => {
  const body = createCheckoutBody.parse(req.body);
  const key = req.header('idempotency-key')?.trim().slice(0, 200) || undefined;
  res.status(201).json({ data: await paymentsService.checkout(id(req.params.id), req.userId!, body.method, key, { interval: body.interval, paymentMethod: body.paymentMethod }) });
});

paymentsRouter.get('/courses/:id/subscription', requireAuth, async (req, res) => {
  res.json({ data: await paymentsService.statusFor(id(req.params.id), req.userId!) });
});

// Báo giá cho hộp thoại tham gia (đăng nhập tùy chọn: có thì tính đúng quyền dùng thử).
paymentsRouter.get('/courses/:id/checkout-quote', optionalAuth, async (req, res) => {
  const q = quoteQuery.parse(req.query);
  res.json({ data: await paymentsService.quote(id(req.params.id), req.userId, q.interval) });
});

paymentsRouter.get('/me/payment-methods', requireAuth, async (req, res) => {
  res.json({ data: await cardsService.list(req.userId!) });
});

// Quản lý thẻ ở Cài đặt > Thanh toán (chỉ token + brand/last4/hạn; xem payments.cards.ts).
paymentsRouter.post('/me/payment-methods', requireAuth, async (req, res) => {
  res.status(201).json({ data: await cardsService.add(req.userId!, paymentMethodInput.parse(req.body)) });
});

paymentsRouter.put('/me/payment-methods/:cardId', requireAuth, async (req, res) => {
  res.json({ data: await cardsService.replace(req.userId!, id(req.params.cardId), paymentMethodInput.parse(req.body)) });
});

paymentsRouter.patch('/me/payment-methods/:cardId/default', requireAuth, async (req, res) => {
  res.json({ data: await cardsService.setDefault(req.userId!, id(req.params.cardId)) });
});

paymentsRouter.delete('/me/payment-methods/:cardId', requireAuth, async (req, res) => {
  res.json({ data: await cardsService.remove(req.userId!, id(req.params.cardId)) });
});

paymentsRouter.get('/me/billing-summary', requireAuth, async (req, res) => {
  res.json({ data: await billingSummary(req.userId!) });
});

paymentsRouter.post('/payments/:paymentIntentId/confirm', requireAuth, async (req, res) => {
  res.json({ data: await paymentsService.confirm(id(req.params.paymentIntentId), req.userId!) });
});

// ---- gói thành viên
paymentsRouter.post('/courses/:id/subscription/cancel', requireAuth, async (req, res) => {
  const body = cancelSubscriptionBody.parse(req.body ?? {});
  res.json({ data: await paymentsService.cancelSubscription(id(req.params.id), req.userId!, body.atPeriodEnd) });
});

paymentsRouter.post('/courses/:id/subscription/resume', requireAuth, async (req, res) => {
  res.json({ data: await paymentsService.resumeSubscription(id(req.params.id), req.userId!) });
});

paymentsRouter.get('/me/subscriptions', requireAuth, async (req, res) => {
  res.json({ data: await paymentsService.mySubscriptions(req.userId!) });
});

paymentsRouter.post('/courses/:id/trial', requireAuth, async (req, res) => {
  const body = startTrialBody.parse(req.body ?? {});
  res.status(201).json({ data: await paymentsService.startTrial(id(req.params.id), req.userId!, new Date(), body) });
});

// ---- lịch sử & hóa đơn
paymentsRouter.get('/me/payments', requireAuth, async (req, res) => {
  const q = paginationQuery.parse(req.query);
  res.json(await paymentsService.myPayments(req.userId!, q.page, q.limit));
});

paymentsRouter.get('/payments/:paymentId/invoice', requireAuth, async (req, res) => {
  res.json({ data: await paymentsService.invoice(id(req.params.paymentId), req.userId!) });
});

// ---- hoàn tiền
paymentsRouter.post('/payments/:paymentId/refund-request', requireAuth, async (req, res) => {
  const body = refundRequestBody.parse(req.body);
  const refund = await paymentsService.requestRefund(id(req.params.paymentId), req.userId!, body.reason);
  res.status(201).json({ data: refund });
});

paymentsRouter.get('/admin/refunds', ...adminOnly, async (req, res) => {
  const q = listRefundsQuery.parse(req.query);
  res.json(await paymentsService.listRefunds(req.userId!, q.status, q.page, q.limit));
});

paymentsRouter.patch('/admin/refunds/:refundId', ...adminOnly, async (req, res) => {
  const body = resolveRefundBody.parse(req.body);
  const data = await paymentsService.resolveRefund(req.userId!, id(req.params.refundId), body.action, body.note);
  await auditService.record(req.userId!, {
    action: 'payment.refund_resolve', targetType: 'refund', targetId: id(req.params.refundId), targetLabel: `Refund ${id(req.params.refundId).slice(0, 8)}`,
    note: body.note, metadata: { decision: body.action },
  });
  res.json({ data });
});

// ---- webhook: không đăng nhập, xác thực bằng chữ ký HMAC trên raw body (app.ts giữ rawBody cho đúng path này)
paymentsRouter.post('/payments/webhook', async (req, res) => {
  const raw = (req as typeof req & { rawBody?: Buffer }).rawBody;
  if (!raw) throw HttpError.badRequest('Yêu cầu không hợp lệ');
  res.json(await paymentsService.handleWebhook(raw, req.header(WEBHOOK_SIGNATURE_HEADER)));
});

// ---- doanh thu & payout
paymentsRouter.get('/courses/:id/revenue', requireAuth, async (req, res) => {
  const q = revenueQuery.parse(req.query);
  res.json({ data: await paymentsService.revenue(id(req.params.id), req.userId!, q) });
});

paymentsRouter.post('/courses/:id/payouts', requireAuth, async (req, res) => {
  const body = createPayoutBody.parse(req.body);
  res.status(201).json({ data: await paymentsService.requestPayout(id(req.params.id), req.userId!, body) });
});

paymentsRouter.get('/courses/:id/payouts', requireAuth, async (req, res) => {
  const q = paginationQuery.parse(req.query);
  res.json(await paymentsService.listPayouts(id(req.params.id), req.userId!, q.page, q.limit));
});

paymentsRouter.get('/admin/payouts', ...adminOnly, async (req, res) => {
  const q = listPayoutsQuery.parse(req.query);
  res.json(await paymentsService.adminListPayouts(req.userId!, q.status, q.page, q.limit));
});

paymentsRouter.patch('/admin/payouts/:payoutId', ...adminOnly, async (req, res) => {
  const body = resolvePayoutBody.parse(req.body);
  const data = await paymentsService.resolvePayout(req.userId!, id(req.params.payoutId), body.action, body.note);
  await auditService.record(req.userId!, {
    action: 'payment.payout_resolve', targetType: 'payout', targetId: id(req.params.payoutId), targetLabel: `Payout ${id(req.params.payoutId).slice(0, 8)}`,
    note: body.note, metadata: { decision: body.action },
  });
  res.json({ data });
});
