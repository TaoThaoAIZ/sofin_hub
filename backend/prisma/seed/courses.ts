import type { prisma } from '../../src/db/prisma.js';

type Db = typeof prisma;

/** Id khóa học mặc định của seed cho 1 cộng đồng (xác định để seed idempotent + test/tài liệu tham chiếu). */
export const mainCourseId = (communityId: string) => `course-${communityId}-main`;

/**
 * Bảo đảm cộng đồng có ≥ 1 khóa học (entity Course / bảng LearningCourse). Trả về id khóa mặc định (published đầu tiên theo position).
 * Idempotent: cộng đồng đã có khóa (do migration backfill, service hoặc seed trước) thì không tạo thêm.
 */
export async function ensureDefaultCourse(db: Db, communityId: string, title?: string): Promise<string> {
  const existing = await db.course.findFirst({ where: { communityId, removedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  if (existing) return existing.id;
  const community = await db.community.findUniqueOrThrow({ where: { id: communityId }, select: { title: true, description: true, thumbnail: true, createdAt: true } });
  const id = mainCourseId(communityId);
  await db.course.upsert({
    where: { id },
    create: { id, communityId, title: title ?? community.title, description: community.description, thumbnailUrl: null, position: 1, publishStatus: 'published', createdAt: community.createdAt },
    update: {},
  });
  return id;
}

/** Khóa học mặc định cho MỌI cộng đồng chưa có khóa nào (gọi sau khi mọi seed tạo cộng đồng; an toàn chạy lại). */
export async function ensureAllDefaultCourses(db: Db): Promise<void> {
  const missing = await db.community.findMany({ where: { learningCourses: { none: {} }, moderationStatus: { not: 'draft' } }, select: { id: true } });
  for (const { id } of missing) await ensureDefaultCourse(db, id);
}
