import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { inMemoryCatalogRepository } from '../catalog/catalog.repository.js';
import { categories } from '../catalog/catalog.seed.js';

export const metaRouter = Router();

const LISTED = { deletedAt: null, locked: false, moderationStatus: 'active', discoveryStatus: 'listed' } as const;

metaRouter.get('/categories', async (_req, res) => {
  const counts = await inMemoryCatalogRepository.countByCategory();
  // Danh mục do admin quản lý (Discovery > Categories): chỉ hiện mục `active`, theo thứ tự `position`. Bảng trống -> danh sách mặc định cũ.
  const rows = await prisma.discoveryCategory.findMany({ orderBy: [{ position: 'asc' }, { key: 'asc' }] });
  const list = rows.length ? rows.filter((r) => r.status === 'active').map((r) => ({ id: r.key, name: r.name })) : categories;
  res.json({ data: list.map((c) => ({ ...c, courseCount: counts[c.id] ?? 0 })) });
});

/**
 * Số liệu trang chủ, tính từ DB (không còn hằng số):
 * - learners: số người dùng THẬT (không demo, chưa xóa) có ít nhất 1 ghi danh;
 * - courses: số cộng đồng đang được liệt kê công khai (cùng điều kiện danh sách /courses);
 * - instructors: số chủ sở hữu thật (distinct ownerId) của các cộng đồng đó;
 * - rating: trung bình đánh giá thật (bảng Review, bỏ review của user demo); null nếu chưa có đánh giá nào.
 */
metaRouter.get('/stats', async (_req, res) => {
  const [learners, courses, instructors, agg] = await Promise.all([
    prisma.user.count({ where: { isDemo: false, deletedAt: null, enrollments: { some: {} } } }),
    prisma.community.count({ where: LISTED }),
    prisma.community.findMany({ where: { ...LISTED, ownerId: { not: null } }, distinct: ['ownerId'], select: { ownerId: true } }).then((r) => r.length),
    prisma.review.aggregate({ where: { user: { isDemo: false } }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const rating = agg._count._all > 0 && agg._avg.rating !== null ? Math.round(agg._avg.rating * 10) / 10 : null;
  res.json({ data: { learners, courses, instructors, rating } });
});
