import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { communityReferralService, setRateBody } from './community-referral.service.js';

/** Chương trình giới thiệu theo cộng đồng. `/communities/:id/...` ≡ `/courses/:id/...` (communityAlias). */
export const communityReferralRouter = Router();
const id = (v: unknown) => v as string;

// Tổng quan cho người xem (thành viên: link riêng + KPI + danh sách người đã mời; chủ cộng đồng: thêm số liệu toàn cộng đồng).
communityReferralRouter.get('/courses/:id/referral-program', requireAuth, async (req, res) => {
  const communityId = id(req.params.id);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await communityReferralService.program(communityId, req.userId!) });
});

// Chủ cộng đồng xem TẤT CẢ người giới thiệu của cộng đồng (chủ là người trả % hoa hồng): từng người + người họ đã mời + hoa hồng.
communityReferralRouter.get('/courses/:id/referral-program/referrers', requireAuth, async (req, res) => {
  const communityId = id(req.params.id);
  await requireRole(req.userId!, communityId, 'owner');
  res.json({ data: await communityReferralService.referrers(communityId) });
});

// Chủ cộng đồng đặt % hoa hồng (0 = tắt).
communityReferralRouter.put('/courses/:id/referral-program', requireAuth, async (req, res) => {
  const communityId = id(req.params.id);
  await catalogService.requireLockState(communityId);
  await requireRole(req.userId!, communityId, 'owner');
  res.json({ data: await communityReferralService.setRate(communityId, setRateBody.parse(req.body).rateBps) });
});
