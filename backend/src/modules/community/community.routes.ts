import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { leaderboardQuery, listMembersQuery } from './community.schema.js';
import { communityService } from './community.service.js';

export const communityRouter = Router();

communityRouter.get('/courses/:id/members', requireAuth, async (req, res) => {
  const communityId = req.params.id as string;
  await catalogService.getById(communityId);
  await enrollmentService.requireMembership(req.userId!, communityId);
  const query = listMembersQuery.parse(req.query);
  res.json(await communityService.listMembers(communityId, query));
});

communityRouter.get('/courses/:id/levels', requireAuth, async (req, res) => {
  const communityId = req.params.id as string;
  await catalogService.getById(communityId);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await communityService.levels(communityId, req.userId!) });
});

communityRouter.get('/courses/:id/leaderboard', requireAuth, async (req, res) => {
  const communityId = req.params.id as string;
  await catalogService.getById(communityId);
  await enrollmentService.requireMembership(req.userId!, communityId);
  const query = leaderboardQuery.parse(req.query);
  res.json({ data: await communityService.leaderboard(communityId, query.window) });
});
