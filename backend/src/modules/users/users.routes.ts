import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { usersService } from './users.service.js';

export const usersRouter = Router();

usersRouter.get('/users/:id', requireAuth, async (req, res) => {
  res.json({ data: await usersService.publicProfile(String(req.params.id)) });
});

usersRouter.get('/me/enrollments', requireAuth, async (req, res) => {
  res.json({ data: await usersService.myEnrollments(req.userId!) });
});

usersRouter.get('/me/points', requireAuth, async (req, res) => {
  res.json({ data: await usersService.myPoints(req.userId!) });
});
