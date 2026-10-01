import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { reviewsService } from '../communities/reviews.service.js';
import { getRole } from '../permissions/policy.js';
import { z } from 'zod';
import { FEATURE_SECTIONS, listFeaturedCourses } from '../discovery/featured.js';
import { listCommunitiesQuery } from './catalog.schema.js';

const featuredQuery = z.object({
  section: z.enum(FEATURE_SECTIONS).default('featured'),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
import { catalogService } from './catalog.service.js';

export const catalogRouter = Router();

catalogRouter.get('/', async (req, res) => {
  const query = listCommunitiesQuery.parse(req.query);
  res.json(await catalogService.list(query));
});

// Phải đứng TRƯỚC '/:id'. Mục ghim ở Discovery (Admin đợt 2): `?section=featured|trending|editors_picks|new_noteworthy`.
catalogRouter.get('/featured', async (req, res) => {
  const { section, limit } = featuredQuery.parse(req.query);
  res.json({ data: await listFeaturedCourses(section, limit) });
});

catalogRouter.get('/:id', optionalAuth, async (req, res) => {
  const id = req.params.id as string;
  const viewerEnrolled = req.userId ? await enrollmentService.isEnrolled(req.userId, id) : undefined;
  const detail = await catalogService.getDetailById(id, viewerEnrolled, await reviewsService.forDetail(id));
  const viewerRole = req.userId ? await getRole(req.userId, id) : null;
  res.json({ data: { ...detail, viewerRole } });
});

catalogRouter.post('/:id/enroll', requireAuth, async (req, res) => {
  res.json({ data: await enrollmentService.toggle(req.userId!, req.params.id as string) });
});
