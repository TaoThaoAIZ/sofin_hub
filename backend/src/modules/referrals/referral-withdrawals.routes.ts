import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middlewares/auth.js';
import { auditService } from '../admin/admin-audit.service.js';
import { adminOnly } from '../admin/admin.common.js';
import { BANKS } from './referral-banks.js';
import { accountBody, adminWithdrawalsQuery, noteBody, rejectBody, withdrawBody } from './referral-withdrawals.schema.js';
import { referralWithdrawalsService as svc } from './referral-withdrawals.service.js';

export const referralWithdrawalsRouter = Router();
const id = (v: unknown) => v as string;

// ---- Người dùng: rút hoa hồng giới thiệu
referralWithdrawalsRouter.get('/me/referral/withdraw/banks', requireAuth, (_req, res) => {
  res.json({ data: BANKS.map((b) => ({ bin: b.bin, short: b.short, name: b.name })) });
});
referralWithdrawalsRouter.get('/me/referral/withdraw', requireAuth, async (req, res) => {
  res.json({ data: await svc.overview(req.userId!, typeof req.query.communityId === 'string' && req.query.communityId ? req.query.communityId : undefined) });
});
referralWithdrawalsRouter.put('/me/referral/withdraw/account', requireAuth, requireVerifiedEmail, async (req, res) => {
  res.json({ data: await svc.saveAccount(req.userId!, accountBody.parse(req.body)) });
});
referralWithdrawalsRouter.post('/me/referral/withdrawals', requireAuth, requireVerifiedEmail, async (req, res) => {
  res.status(201).json({ data: await svc.request(req.userId!, withdrawBody.parse(req.body).amountCents) });
});
referralWithdrawalsRouter.get('/me/referral/withdrawals/:id', requireAuth, async (req, res) => {
  res.json({ data: await svc.get(req.userId!, id(req.params.id)) });
});

// ---- Admin: danh sách yêu cầu (kèm QR VietQR để chuyển) + duyệt tay
referralWithdrawalsRouter.get('/admin/payments/referral-withdrawals', ...adminOnly, async (req, res) => {
  const q = adminWithdrawalsQuery.parse(req.query);
  res.json(await svc.adminList(q.status, q.page, q.limit));
});
referralWithdrawalsRouter.post('/admin/payments/referral-withdrawals/:id/mark-paid', ...adminOnly, async (req, res) => {
  const b = noteBody.parse(req.body ?? {});
  const data = await svc.markPaid(req.userId!, id(req.params.id), b.note);
  await auditService.record(req.userId!, { action: 'payment.referral_withdrawal_paid', targetType: 'referral_withdrawal', targetId: data.id, targetLabel: data.refCode, note: b.note, metadata: { amountCents: data.amountCents } });
  res.json({ data });
});
referralWithdrawalsRouter.post('/admin/payments/referral-withdrawals/:id/reject', ...adminOnly, async (req, res) => {
  const b = rejectBody.parse(req.body);
  const data = await svc.reject(req.userId!, id(req.params.id), b.reason);
  await auditService.record(req.userId!, { action: 'payment.referral_withdrawal_reject', targetType: 'referral_withdrawal', targetId: data.id, targetLabel: data.refCode, note: b.reason, metadata: { amountCents: data.amountCents } });
  res.json({ data });
});
