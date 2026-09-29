import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { leaderboardQuery, listMembersQuery } from './community.schema.js';
import { communityService } from './community.service.js';

export const communityRouter = Router();

communityRouter.get('/courses/:id/members', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await enrollmentService.requireMembership(req.userId!, courseId);
  const query = listMembersQuery.parse(req.query);
  res.json(await communityService.listMembers(courseId, query));
});

communityRouter.get('/courses/:id/levels', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await enrollmentService.requireMembership(req.userId!, courseId);
  res.json({ data: await communityService.levels(courseId, req.userId!) });
});

communityRouter.get('/courses/:id/leaderboard', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await enrollmentService.requireMembership(req.userId!, courseId);
  const query = leaderboardQuery.parse(req.query);
  res.json({ data: await communityService.leaderboard(courseId, query.window) });
});
