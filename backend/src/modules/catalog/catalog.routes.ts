import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { reviewsService } from '../communities/reviews.service.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { getRole, isStaff } from '../permissions/policy.js';
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
  // Cộng đồng chưa được duyệt (chờ duyệt / cần chỉnh sửa / bị từ chối) chỉ owner, thành viên và nhân viên admin xem được; người khác 404.
  const pre = await prisma.community.findFirst({ where: { id, deletedAt: null }, select: { ownerId: true, moderationStatus: true } });
  if (pre && ['pending_review', 'changes_requested', 'rejected'].includes(pre.moderationStatus)) {
    const mine = !!req.userId && (pre.ownerId === req.userId || (await enrollmentService.isEnrolled(req.userId, id)) || (await isStaff(req.userId)));
    if (!mine) throw HttpError.notFound('Không tìm thấy khóa học');
  }
  const viewerEnrolled = req.userId ? await enrollmentService.isEnrolled(req.userId, id) : undefined;
  const detail = await catalogService.getDetailById(id, viewerEnrolled, await reviewsService.forDetail(id));
  const viewerRole = req.userId ? await getRole(req.userId, id) : null;
  // Cộng đồng riêng tư có phí: yêu cầu đã được duyệt nhưng chưa thanh toán → FE hiện "Thanh toán để tham gia" thay vì "Gửi yêu cầu".
  const viewerApproved = req.userId && !viewerEnrolled ? (await prisma.joinRequest.count({ where: { userId: req.userId, communityId: id, status: 'approved' } })) > 0 : false;
  res.json({ data: { ...detail, viewerRole, viewerApproved } });
});

catalogRouter.post('/:id/enroll', requireAuth, async (req, res) => {
  res.json({ data: await enrollmentService.toggle(req.userId!, req.params.id as string) });
});
