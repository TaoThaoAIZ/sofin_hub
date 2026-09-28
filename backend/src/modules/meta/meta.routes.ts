import { Router } from 'express';
import { inMemoryCourseRepository } from '../courses/courses.repository.js';
import { categories, platformStats } from '../courses/courses.seed.js';

export const metaRouter = Router();

metaRouter.get('/categories', async (_req, res) => {
  const counts = await inMemoryCourseRepository.countByCategory();
  res.json({ data: categories.map((c) => ({ ...c, courseCount: counts[c.id] ?? 0 })) });
});

metaRouter.get('/stats', (_req, res) => {
  res.json({ data: platformStats });
});
