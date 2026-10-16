import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { markStepParam, onboardingService } from './onboarding.service.js';

/** "Bắt đầu hành trình của bạn" ở bảng tin cộng đồng. `/communities/:id/...` ≡ `/courses/:id/...` (communityAlias). */
export const onboardingRouter = Router();
const id = (v: unknown) => v as string;

onboardingRouter.get('/courses/:id/onboarding', requireAuth, async (req, res) => {
  const communityId = id(req.params.id);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await onboardingService.get(communityId, req.userId!) });
});

onboardingRouter.post('/courses/:id/onboarding/:step', requireAuth, async (req, res) => {
  const communityId = id(req.params.id);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await onboardingService.mark(communityId, req.userId!, markStepParam.parse(req.params.step)) });
});
