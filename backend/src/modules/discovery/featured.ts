import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Course } from '../courses/course.types.js';
import { courseRepository } from '../courses/courses.repository.js';

export const FEATURE_SECTIONS = ['featured', 'trending', 'editors_picks', 'new_noteworthy'] as const;
export type FeatureSection = (typeof FEATURE_SECTIONS)[number];
export const SECTION_LABELS: Record<FeatureSection, string> = {
  featured: 'Featured Communities',
  trending: 'Trending',
  editors_picks: "Editor's Picks",
  new_noteworthy: 'New & Noteworthy',
};

/** Mục ghim đang có hiệu lực: trong khoảng startsAt..endsAt (null = mở). */
export const activeWindow = (now = new Date()): Prisma.DiscoveryFeatureWhereInput => ({
  AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
});

/** Cộng đồng đủ điều kiện hiện ở Discovery công khai. */
export const publiclyListable: Prisma.CourseWhereInput = {
  deletedAt: null, locked: false, moderationStatus: 'active', visibility: 'public', discoveryStatus: 'listed',
};

/** `GET /courses/featured`: theo thứ tự `position`; bỏ mục hết hạn hoặc cộng đồng không còn đủ điều kiện hiển thị. */
export async function listFeaturedCourses(section: FeatureSection, limit: number): Promise<Course[]> {
  const entries = await prisma.discoveryFeature.findMany({
    where: { section, ...activeWindow(), course: publiclyListable },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    select: { courseId: true },
  });
  const out: Course[] = [];
  for (const e of entries) {
    const c = await courseRepository.findById(e.courseId);
    if (c) out.push(c);
  }
  return out;
}
