import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { handleAvailableQuery } from '../auth/auth.schema.js';
import { usersService } from './users.service.js';

export const usersRouter = Router();

// Phải đứng TRƯỚC /users/:id. Ô "Đường dẫn hồ sơ" gọi để báo trống/đã có người dùng (bỏ qua handle của chính mình).
usersRouter.get('/users/handle-available', requireAuth, async (req, res) => {
  const { handle } = handleAvailableQuery.parse(req.query);
  res.json({ data: await usersService.handleAvailability(req.userId!, handle) });
});

usersRouter.get('/users/:id', requireAuth, async (req, res) => {
  res.json({ data: await usersService.publicProfile(String(req.params.id), req.userId) });
});

usersRouter.get('/me/enrollments', requireAuth, async (req, res) => {
  res.json({ data: await usersService.myEnrollments(req.userId!) });
});

usersRouter.get('/me/points', requireAuth, async (req, res) => {
  res.json({ data: await usersService.myPoints(req.userId!) });
});
