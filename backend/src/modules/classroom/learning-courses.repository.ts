import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Course as DbCourse } from '../../generated/prisma/client.js';
import type { CoursePublishStatus, LearningCourseRecord } from './classroom.types.js';

/**
 * Khóa học (Prisma `Course`, bảng "LearningCourse") — thuộc 1 cộng đồng, chứa module/bài.
 * Mọi thay đổi thứ tự/thêm/xóa chạy trong transaction khóa dòng cộng đồng (FOR UPDATE) để `position` không trùng khi đồng thời.
 */
export type CourseInput = {
  title: string;
  description: string;
  thumbnailUrl?: string | null | undefined;
  publishStatus?: 'published' | 'draft' | undefined;
};
export type CoursePatch = Partial<{
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishStatus: CoursePublishStatus;
  certificatesEnabled: boolean | null;
}>;

export interface CourseCounts {
  modules: number;
  lessons: number;
  done: number;
}

export const toCourseRecord = (c: DbCourse): LearningCourseRecord => ({
  id: c.id,
  communityId: c.communityId,
  title: c.title,
  description: c.description,
  thumbnailUrl: c.thumbnailUrl,
  position: c.position,
  publishStatus: c.publishStatus,
  certificatesEnabled: c.certificatesEnabled,
  removedAt: c.removedAt ? c.removedAt.toISOString() : null,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

type Tx = Prisma.TransactionClient;
const lockCommunity = (tx: Tx, communityId: string) => tx.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${communityId} FOR UPDATE`;

/** Đánh lại position 1..n theo thứ tự hiện có (một câu lệnh). */
const reindex = (tx: Tx, communityId: string) => tx.$executeRaw`
  UPDATE "LearningCourse" t SET "position" = r.rn
  FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "position", "createdAt", "id")::int AS rn
        FROM "LearningCourse" WHERE "communityId" = ${communityId} AND "removedAt" IS NULL) r
  WHERE t."id" = r."id" AND t."position" <> r.rn`;

/** Khóa mặc định: published đầu tiên theo (position, createdAt); không có thì khóa chưa gỡ đầu tiên. */
export function pickDefault<T extends { id: string; publishStatus: string }>(rows: T[]): T | undefined {
  return rows.find((r) => r.publishStatus === 'published') ?? rows[0];
}

export const learningCourseRepository = {
  /** Mọi khóa chưa bị Platform Admin gỡ, theo (position, createdAt). Lọc trạng thái do service quyết định. */
  async list(communityId: string): Promise<LearningCourseRecord[]> {
    const rows = await prisma.course.findMany({ where: { communityId, removedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(toCourseRecord);
  },

  async findById(communityId: string, id: string): Promise<LearningCourseRecord | undefined> {
    const row = await prisma.course.findFirst({ where: { id, communityId, removedAt: null } });
    return row ? toCourseRecord(row) : undefined;
  },

  /** Khóa theo id (bất kể cộng đồng/trạng thái) — dùng cho module → khóa. */
  async findAny(id: string): Promise<LearningCourseRecord | undefined> {
    const row = await prisma.course.findUnique({ where: { id } });
    return row ? toCourseRecord(row) : undefined;
  },

  async create(communityId: string, input: CourseInput): Promise<LearningCourseRecord> {
    return prisma.$transaction(async (tx) => {
      await lockCommunity(tx, communityId);
      const last = await tx.course.aggregate({ where: { communityId, removedAt: null }, _max: { position: true } });
      const row = await tx.course.create({
        data: {
          id: randomUUID(),
          communityId,
          title: input.title,
          description: input.description,
          thumbnailUrl: input.thumbnailUrl ?? null,
          position: (last._max.position ?? 0) + 1,
          publishStatus: input.publishStatus ?? 'published',
        },
      });
      return toCourseRecord(row);
    });
  },

  /**
   * Bảo đảm cộng đồng có ≥ 1 khóa (cộng đồng tạo trực tiếp bằng DB/seed cũ). Trả về khóa mặc định hiện có hoặc khóa vừa tạo.
   * `tx` có thể truyền vào khi gọi trong transaction tạo cộng đồng.
   */
  async ensureDefault(communityId: string, title: string, tx?: Tx): Promise<LearningCourseRecord> {
    const run = async (db: Tx) => {
      await lockCommunity(db, communityId);
      const rows = await db.course.findMany({ where: { communityId, removedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
      const found = pickDefault(rows);
      if (found) return toCourseRecord(found);
      const row = await db.course.create({ data: { id: randomUUID(), communityId, title, position: 1, publishStatus: 'published' } });
      return toCourseRecord(row);
    };
    return tx ? run(tx) : prisma.$transaction(run);
  },

  async update(communityId: string, id: string, patch: CoursePatch): Promise<LearningCourseRecord | undefined> {
    const found = await prisma.course.findFirst({ where: { id, communityId, removedAt: null }, select: { id: true } });
    if (!found) return undefined;
    const row = await prisma.course.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.thumbnailUrl !== undefined ? { thumbnailUrl: patch.thumbnailUrl } : {}),
        ...(patch.publishStatus !== undefined ? { publishStatus: patch.publishStatus } : {}),
        ...(patch.certificatesEnabled !== undefined ? { certificatesEnabled: patch.certificatesEnabled } : {}),
      },
    });
    return toCourseRecord(row);
  },

  /** `ids` đã được service kiểm tra là hoán vị đủ các khóa chưa gỡ. */
  async reorder(communityId: string, ids: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockCommunity(tx, communityId);
      if (ids.length === 0) return;
      await tx.$executeRawUnsafe(
        `UPDATE "LearningCourse" t SET "position" = v.pos FROM (SELECT * FROM UNNEST($1::text[]) WITH ORDINALITY AS u(id, pos)) v WHERE t."id" = v.id AND t."communityId" = $2`,
        ids,
        communityId,
      );
    });
  },

  /** Xóa khóa + module/bài/tiến độ/chứng nhận (cascade). false nếu không có; 'last' nếu là khóa cuối cùng. */
  async remove(communityId: string, id: string): Promise<boolean | 'last'> {
    return prisma.$transaction(async (tx) => {
      await lockCommunity(tx, communityId);
      const total = await tx.course.count({ where: { communityId, removedAt: null } });
      const exists = await tx.course.findFirst({ where: { id, communityId, removedAt: null }, select: { id: true } });
      if (!exists) return false;
      if (total <= 1) return 'last' as const;
      await tx.course.delete({ where: { id } });
      await reindex(tx, communityId);
      return true;
    });
  },

  /** Số module/bài hiển thị + số bài user đã hoàn thành cho nhiều khóa (1 truy vấn). */
  async counts(userId: string | undefined, courseIds: string[]): Promise<Map<string, CourseCounts>> {
    if (courseIds.length === 0) return new Map();
    const rows = await prisma.$queryRaw<{ id: string; modules: number; lessons: number; done: number }[]>`
      SELECT c."id",
        (SELECT COUNT(*)::int FROM "ClassroomModule" m
          WHERE m."learningCourseId" = c."id" AND m."publishStatus" = 'published' AND m."removedAt" IS NULL) AS "modules",
        (SELECT COUNT(*)::int FROM "ClassroomLesson" l JOIN "ClassroomModule" m ON m."id" = l."moduleId"
          WHERE m."learningCourseId" = c."id" AND NOT l."hidden" AND l."removedAt" IS NULL AND m."publishStatus" = 'published' AND m."removedAt" IS NULL) AS "lessons",
        (SELECT COUNT(*)::int FROM "LessonProgress" p JOIN "ClassroomLesson" l ON l."id" = p."lessonId" JOIN "ClassroomModule" m ON m."id" = l."moduleId"
          WHERE p."userId" = ${userId ?? ''} AND p."completedAt" IS NOT NULL AND m."learningCourseId" = c."id"
            AND NOT l."hidden" AND l."removedAt" IS NULL AND m."publishStatus" = 'published' AND m."removedAt" IS NULL) AS "done"
      FROM unnest(${courseIds}::text[]) AS c("id")`;
    return new Map(rows.map((r) => [r.id, { modules: r.modules, lessons: r.lessons, done: r.done }]));
  },
};

export type LearningCourseRepository = typeof learningCourseRepository;
