import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { referralCommissionsQuery, referralKindQuery, referralOverviewQuery, referralUsersQuery } from './referrals.schema.js';
import { referralsService } from './referrals.service.js';

export const referralsRouter = Router();
const id = (v: unknown) => v as string;

// Tổng quan chương trình giới thiệu (mã/link, tỉ lệ, 4 KPI) theo loại creator | member.
referralsRouter.get('/me/referral', requireAuth, async (req, res) => {
  const q = referralOverviewQuery.parse(req.query);
  res.json({ data: await referralsService.overview(req.userId!, q.kind, new Date(), q.communityId) });
});

referralsRouter.get('/me/referral/users', requireAuth, async (req, res) => {
  const q = referralUsersQuery.parse(req.query);
  res.json(await referralsService.users(req.userId!, q.kind, q.all, q.communityId));
});

referralsRouter.get('/me/referral/users/:userId/commissions', requireAuth, async (req, res) => {
  const q = referralCommissionsQuery.parse(req.query);
  res.json({ data: await referralsService.commissionsOf(req.userId!, id(req.params.userId), q.kind, q.communityId) });
});

referralsRouter.post('/me/referral/users/:userId/remind', requireAuth, async (req, res) => {
  const q = referralKindQuery.parse(req.query);
  res.json({ data: await referralsService.remind(req.userId!, id(req.params.userId), q.kind) });
});
