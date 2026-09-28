import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { listCoursesQuery } from './courses.schema.js';
import { courseService } from './courses.service.js';

export const coursesRouter = Router();

coursesRouter.get('/', async (req, res) => {
  const query = listCoursesQuery.parse(req.query);
  res.json(await courseService.list(query));
});

coursesRouter.get('/:id', optionalAuth, async (req, res) => {
  const id = req.params.id as string;
  const viewerEnrolled = req.userId ? await enrollmentService.isEnrolled(req.userId, id) : undefined;
  res.json({ data: await courseService.getDetailById(id, viewerEnrolled) });
});

coursesRouter.post('/:id/enroll', requireAuth, async (req, res) => {
  res.json({ data: await enrollmentService.toggle(req.userId!, req.params.id as string) });
});
