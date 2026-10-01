import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { inMemoryCourseRepository } from '../courses/courses.repository.js';
import { categories, platformStats } from '../courses/courses.seed.js';

export const metaRouter = Router();

metaRouter.get('/categories', async (_req, res) => {
  const counts = await inMemoryCourseRepository.countByCategory();
  // Danh mục do admin quản lý (Discovery > Categories): chỉ hiện mục `active`, theo thứ tự `position`. Bảng trống -> danh sách mặc định cũ.
  const rows = await prisma.discoveryCategory.findMany({ orderBy: [{ position: 'asc' }, { key: 'asc' }] });
  const list = rows.length ? rows.filter((r) => r.status === 'active').map((r) => ({ id: r.key, name: r.name })) : categories;
  res.json({ data: list.map((c) => ({ ...c, courseCount: counts[c.id] ?? 0 })) });
});

metaRouter.get('/stats', (_req, res) => {
  res.json({ data: platformStats });
});
