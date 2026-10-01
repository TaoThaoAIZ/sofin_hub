/**
 * Dòng Course thật cho mọi khóa trong courses.seed.ts. Thuần dữ liệu (không import Prisma client) để cả seed CLI
 * lẫn tests/helpers.ts (nạp dữ liệu nền cho schema test bằng createMany) dùng chung.
 */
import { usdToCents } from '../src/db/enums.js';
import { seedCommunities as courses, trendingRank } from '../src/modules/catalog/catalog.seed.js';

/** `ownerIds`: map slug -> userId của owner (tài khoản test); bỏ trống = cộng đồng seed chưa có chủ. */
export function courseSeedRows(ownerIds: Partial<Record<string, string>> = {}) {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    tag: c.tag,
    thumbnail: c.thumbnail,
    instructorName: c.instructor.name,
    instructorRole: c.instructor.role,
    lessons: c.lessons,
    durationMinutes: c.durationMinutes,
    // Số nền minh họa (vd 12.4K); thành viên thật được cộng thêm khi đọc (xem courses.repository.ts).
    students: c.students,
    rating: c.rating,
    ratingCount: c.ratingCount,
    priceCents: usdToCents(c.priceUsd),
    pricing: c.pricing,
    visibility: c.visibility,
    status: c.status,
    language: c.language,
    trendingRank: trendingRank.get(c.id) ?? null,
    ownerId: ownerIds[c.id] ?? null,
    createdAt: new Date(c.createdAt),
  }));
}
