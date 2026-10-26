import { Router, type Request } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { gameService, putGameBody, resultBody } from './game.service.js';

/** Trò chơi lật thẻ theo bài học. `/communities/:id/...` ≡ `/courses/:id/...` (communityAlias). */
export const gameRouter = Router();

const communityOf = (req: Request) => req.params.id as string;
const lessonOf = (req: Request) => req.params.lessonId as string;

gameRouter.get('/courses/:id/lessons/:lessonId/game', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await gameService.get(communityId, lessonOf(req), req.userId!) });
});

gameRouter.post('/courses/:id/lessons/:lessonId/game/result', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await gameService.submitResult(communityId, lessonOf(req), req.userId!, resultBody.parse(req.body)) });
});

gameRouter.put('/courses/:id/lessons/:lessonId/game', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await catalogService.requireLockState(communityId);
  await requireRole(req.userId!, communityId, 'mod');
  res.json({ data: await gameService.put(communityId, lessonOf(req), putGameBody.parse(req.body)) });
});
