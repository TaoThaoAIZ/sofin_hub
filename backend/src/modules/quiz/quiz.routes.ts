import { Router, type Request } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { attemptBody, putQuizBody, quizService } from './quiz.service.js';

/** Trắc nghiệm theo bài học. `/communities/:id/...` ≡ `/courses/:id/...` (communityAlias). */
export const quizRouter = Router();

const communityOf = (req: Request) => req.params.id as string;
const lessonOf = (req: Request) => req.params.lessonId as string;

quizRouter.get('/courses/:id/lessons/:lessonId/quiz', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await quizService.get(communityId, lessonOf(req), req.userId!) });
});

quizRouter.post('/courses/:id/lessons/:lessonId/quiz/attempt', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await quizService.attempt(communityId, lessonOf(req), req.userId!, attemptBody.parse(req.body)) });
});

quizRouter.put('/courses/:id/lessons/:lessonId/quiz', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await catalogService.requireLockState(communityId);
  await requireRole(req.userId!, communityId, 'mod');
  res.json({ data: await quizService.put(communityId, lessonOf(req), putQuizBody.parse(req.body)) });
});
