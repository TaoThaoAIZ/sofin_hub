import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  ClassroomLesson as DbLesson,
  ClassroomModule as DbModule,
  Certificate as DbCertificate,
} from '../../generated/prisma/client.js';
import { toCourseRecord } from './learning-courses.repository.js';
import type {
  Certificate,
  LearningCourseRecord,
  ClassroomLesson,
  ClassroomModule,
  ClassroomSettings,
  CoursePublishStatus,
  LessonAttachment,
  ModuleAccessMode,
} from './classroom.types.js';

/**
 * Nội dung Lớp học (khóa học → module → bài học), tiến độ, cài đặt, chứng nhận — Postgres qua Prisma.
 * Nội dung minh họa được SEED (prisma/seed/classroom.ts), runtime không còn sinh lười.
 * Mọi thao tác đổi thứ tự/thêm/xóa chạy trong transaction, khóa dòng cha (khóa học / module) để `index` không bị trùng khi đồng thời.
 * Thứ tự + khóa tuần tự của module là theo TỪNG khóa học (learningCourseId); cộng đồng (communityId) chỉ dùng để kiểm quyền sở hữu.
 */
export type ModuleInput = {
  title: string;
  description: string;
  thumbnail?: string;
  requiredLevel?: number;
  accessMode?: ModuleAccessMode;
  priceCents?: number;
  sequential?: boolean;
  publishStatus?: CoursePublishStatus;
};
export type ModulePatch = Partial<{
  title: string;
  description: string;
  thumbnail: string | null;
  requiredLevel: number | null;
  accessMode: ModuleAccessMode;
  priceCents: number | null;
  sequential: boolean;
  publishStatus: CoursePublishStatus;
}>;
export type LessonInput = Pick<ClassroomLesson, 'title' | 'type' | 'durationMin' | 'body' | 'attachments'> &
  Partial<Pick<ClassroomLesson, 'videoUrl' | 'embedUrl' | 'isPreview'>>;
export type LessonPatch = Partial<
  Pick<ClassroomLesson, 'title' | 'type' | 'durationMin' | 'body' | 'attachments' | 'isPreview'> & {
    videoUrl: string | null;
    embedUrl: string | null;
  }
>;

export interface ClassroomRepository {
  /** Module HIỂN THỊ của 1 khóa học theo `index`, kèm `lessonIds` theo thứ tự (1 truy vấn, không N+1). `includeUnpublished` (mod+): thêm module nháp/lưu trữ (vẫn ẩn module bị gỡ). */
  getModules(learningCourseId: string, includeUnpublished?: boolean): Promise<ClassroomModule[]>;
  /** 1 module hiển thị (published, chưa gỡ; `includeUnpublished` bỏ điều kiện published) của cộng đồng, kèm lessonIds. */
  findModule(communityId: string, moduleId: string, includeUnpublished?: boolean): Promise<(ClassroomModule & { course: LearningCourseRecord }) | undefined>;
  getLessons(moduleId: string): Promise<ClassroomLesson[]>;
  /** 1 bài (hiển thị được: không ẩn/gỡ, module đã xuất bản) bằng 1 truy vấn; có `communityId` thì bài phải thuộc cộng đồng đó. Kèm khóa học chứa bài. */
  findLesson(lessonId: string, communityId?: string, includeUnpublished?: boolean): Promise<(ClassroomLesson & { learningCourseId: string; course: LearningCourseRecord }) | undefined>;
  /** Tên + module của 1 bài (không nạp thân bài) — dùng cho "bài kế tiếp" ở trang tiến độ. */
  findLessonBrief(lessonId: string): Promise<{ id: string; title: string; moduleId: string } | undefined>;
  /** Tiến độ nhiều cộng đồng cùng lúc cho 1 user: communityId → { tổng bài hiển thị, số bài đã hoàn thành } (1 truy vấn; cộng dồn các khóa đã xuất bản). */
  progressByCommunity(userId: string, communityIds: string[]): Promise<Map<string, { total: number; done: number }>>;

  /** Tập module (trong `moduleIds`) mà user đã được cấp quyền mở. */
  accessModuleIds(userId: string, moduleIds: string[]): Promise<Set<string>>;
  listAccessUserIds(moduleId: string): Promise<string[]>;
  /** Thay bộ cấp quyền: xóa người không còn trong `userIds`, thêm người mới (source 'selected'; dòng đã có giữ nguyên source). */
  replaceAccess(moduleId: string, userIds: string[]): Promise<void>;
  /** Trong `userIds`, những ai đang là thành viên (đã ghi danh) của cộng đồng. */
  enrolledAmong(communityId: string, userIds: string[]): Promise<string[]>;
  /** Mọi thành viên đã ghi danh của cộng đồng. */
  enrolledUserIds(communityId: string): Promise<string[]>;

  createModule(communityId: string, learningCourseId: string, input: ModuleInput): Promise<ClassroomModule>;
  updateModule(communityId: string, moduleId: string, patch: ModulePatch): Promise<ClassroomModule | undefined>;
  /** Xóa module cùng bài học và tiến độ liên quan (cascade), đánh lại index trong khóa. */
  deleteModule(communityId: string, moduleId: string): Promise<boolean>;
  /** `ids` đã được service kiểm tra là hoán vị đủ của danh sách hiện có trong khóa. */
  reorderModules(learningCourseId: string, ids: string[]): Promise<void>;
  createLesson(communityId: string, moduleId: string, input: LessonInput): Promise<ClassroomLesson | undefined>;
  updateLesson(lessonId: string, patch: LessonPatch): Promise<ClassroomLesson | undefined>;
  deleteLesson(lessonId: string): Promise<boolean>;
  reorderLessons(moduleId: string, ids: string[]): Promise<void>;

  /**
   * Đảo trạng thái hoàn thành một cách nguyên tử; `firstTime` = dòng LessonProgress vừa được TẠO (lần đầu user hoàn thành bài này)
   * — chỉ một lời gọi đồng thời duy nhất nhận firstTime=true nên điểm không bị cộng đôi.
   */
  toggleCompleted(userId: string, lessonId: string): Promise<{ completed: boolean; firstTime: boolean }>;
  /** lessonId → thời điểm hoàn thành (ISO) của các bài đang được đánh dấu xong trong khóa học (1 truy vấn). */
  completedAtMap(userId: string, learningCourseId: string): Promise<Map<string, string>>;

  /** Cài đặt MẶC ĐỊNH của cộng đồng (khóa học có thể ghi đè certificatesEnabled). */
  getSettings(communityId: string): Promise<ClassroomSettings>;
  setSettings(communityId: string, patch: Partial<ClassroomSettings>): Promise<ClassroomSettings>;

  findCertificate(userId: string, learningCourseId: string): Promise<Certificate | undefined>;
  findCertificateByCode(code: string): Promise<Certificate | undefined>;
  /** Lưu chứng nhận; nếu (user,khóa học) đã có (cấp đồng thời) trả về bản đã có với created=false. */
  saveCertificate(cert: Certificate): Promise<{ cert: Certificate; created: boolean }>;
}

const toLesson = (l: DbLesson): ClassroomLesson => ({
  id: l.id,
  moduleId: l.moduleId,
  communityId: l.communityId,
  courseId: l.communityId,
  index: l.index,
  title: l.title,
  type: l.type,
  durationMin: l.durationMin,
  body: l.body,
  ...(l.videoUrl ? { videoUrl: l.videoUrl } : {}),
  ...(l.embedUrl ? { embedUrl: l.embedUrl } : {}),
  attachments: (l.attachments as unknown as LessonAttachment[] | null) ?? [],
  isPreview: l.isPreview,
});

type LessonRef = { id: string; isPreview: boolean };

const toModule = (m: DbModule, lessons: LessonRef[]): ClassroomModule => ({
  id: m.id,
  communityId: m.communityId,
  courseId: m.communityId,
  learningCourseId: m.learningCourseId,
  index: m.index,
  title: m.title,
  description: m.description,
  ...(m.thumbnail ? { thumbnail: m.thumbnail } : {}),
  ...(m.requiredLevel && m.accessMode === 'level' ? { requiredLevel: m.requiredLevel } : {}),
  accessMode: m.accessMode,
  ...(m.accessMode === 'paid' && m.priceCents ? { priceCents: m.priceCents } : {}),
  sequential: m.sequential,
  publishStatus: m.publishStatus,
  lessonIds: lessons.map((l) => l.id),
  previewIds: lessons.filter((l) => l.isPreview).map((l) => l.id),
});

const toCert = (c: DbCertificate): Certificate => ({
  code: c.code,
  userId: c.userId,
  communityId: c.communityId,
  courseId: c.communityId,
  learningCourseId: c.learningCourseId,
  holderName: c.holderName,
  courseTitle: c.courseTitle,
  completedAt: c.completedAt.toISOString(),
  issuedAt: c.issuedAt.toISOString(),
});

type Tx = Prisma.TransactionClient;

/** Dòng JOIN của findLesson (cột khóa học có tiền tố c_). */
interface RawLessonRow {
  id: string; moduleId: string; communityId: string; index: number; title: string; type: ClassroomLesson['type']; durationMin: number; body: string;
  videoUrl: string | null; embedUrl: string | null; attachments: unknown; isPreview: boolean; learningCourseId: string;
  c_id: string; c_communityId: string; c_title: string; c_description: string; c_thumbnailUrl: string | null; c_position: number;
  c_publishStatus: LearningCourseRecord['publishStatus']; c_certificatesEnabled: boolean | null; c_removedAt: Date | null; c_createdAt: Date; c_updatedAt: Date;
}

/** Đánh lại index 1..n theo thứ tự hiện có trong khóa (một câu lệnh). */
const reindexModules = (tx: Tx, learningCourseId: string) => tx.$executeRaw`
  UPDATE "ClassroomModule" m SET "index" = r.rn
  FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "index", "createdAt", "id")::int AS rn
        FROM "ClassroomModule" WHERE "learningCourseId" = ${learningCourseId}) r
  WHERE m."id" = r."id" AND m."index" <> r.rn`;

const reindexLessons = (tx: Tx, moduleId: string) => tx.$executeRaw`
  UPDATE "ClassroomLesson" l SET "index" = r.rn
  FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "index", "createdAt", "id")::int AS rn
        FROM "ClassroomLesson" WHERE "moduleId" = ${moduleId}) r
  WHERE l."id" = r."id" AND l."index" <> r.rn`;

/** Khóa dòng KHÓA HỌC cha (thứ tự module là theo từng khóa). */
const lockLearningCourse = (tx: Tx, learningCourseId: string) =>
  tx.$queryRaw`SELECT "id" FROM "LearningCourse" WHERE "id" = ${learningCourseId} FOR UPDATE`;
const lockModule = (tx: Tx, moduleId: string) => tx.$queryRaw`SELECT "id" FROM "ClassroomModule" WHERE "id" = ${moduleId} FOR UPDATE`;

/** Gán index = vị trí trong `ids` (ids đã là hoán vị đủ). */
async function applyOrder(tx: Tx, table: 'ClassroomModule' | 'ClassroomLesson', ids: string[]) {
  if (ids.length === 0) return;
  await tx.$executeRawUnsafe(
    `UPDATE "${table}" t SET "index" = v.pos FROM (SELECT * FROM UNNEST($1::text[]) WITH ORDINALITY AS u(id, pos)) v WHERE t."id" = v.id`,
    ids,
  );
}

const MODULE_VISIBLE = { publishStatus: 'published', removedAt: null } as const;
const MODULE_VISIBLE_STAFF = { removedAt: null } as const;
const LESSON_VISIBLE = { hidden: false, removedAt: null } as const;
const LESSON_REFS = { where: LESSON_VISIBLE, select: { id: true as const, isPreview: true as const }, orderBy: [{ index: 'asc' as const }, { createdAt: 'asc' as const }] };

export const classroomRepository: ClassroomRepository = {
  async getModules(learningCourseId, includeUnpublished = false) {
    const rows = await prisma.classroomModule.findMany({
      // Admin đợt 2: module nháp/lưu trữ/bị gỡ và bài học bị ẩn/gỡ không hiện với thành viên (mod+ vẫn thấy nháp/lưu trữ).
      where: { learningCourseId, ...(includeUnpublished ? MODULE_VISIBLE_STAFF : MODULE_VISIBLE) },
      orderBy: [{ index: 'asc' }, { createdAt: 'asc' }],
      include: { lessons: LESSON_REFS },
    });
    return rows.map((m) => toModule(m, m.lessons));
  },

  async findModule(communityId, moduleId, includeUnpublished = false) {
    const m = await prisma.classroomModule.findFirst({
      where: { id: moduleId, communityId, ...(includeUnpublished ? MODULE_VISIBLE_STAFF : MODULE_VISIBLE) },
      include: { course: true, lessons: LESSON_REFS },
    });
    return m ? { ...toModule(m, m.lessons), course: toCourseRecord(m.course) } : undefined;
  },

  async getLessons(moduleId) {
    const rows = await prisma.classroomLesson.findMany({ where: { moduleId, ...LESSON_VISIBLE }, orderBy: [{ index: 'asc' }, { createdAt: 'asc' }] });
    return rows.map(toLesson);
  },

  /** 1 truy vấn JOIN (bài + module + khóa học): điểm nóng "mở bài học" (xem tests/query-count.test.ts). */
  async findLesson(lessonId, communityId, includeUnpublished = false) {
    const rows = await prisma.$queryRaw<RawLessonRow[]>`
      SELECT l."id", l."moduleId", l."courseId" AS "communityId", l."index", l."title", l."type"::text AS "type", l."durationMin", l."body",
        l."videoUrl", l."embedUrl", l."attachments", l."isPreview", m."learningCourseId",
        c."id" AS "c_id", c."communityId" AS "c_communityId", c."title" AS "c_title", c."description" AS "c_description", c."thumbnailUrl" AS "c_thumbnailUrl",
        c."position" AS "c_position", c."publishStatus"::text AS "c_publishStatus", c."certificatesEnabled" AS "c_certificatesEnabled",
        c."removedAt" AS "c_removedAt", c."createdAt" AS "c_createdAt", c."updatedAt" AS "c_updatedAt"
      FROM "ClassroomLesson" l
      JOIN "ClassroomModule" m ON m."id" = l."moduleId" AND m."removedAt" IS NULL ${includeUnpublished ? Prisma.empty : Prisma.sql`AND m."publishStatus" = 'published'`}
      JOIN "LearningCourse" c ON c."id" = m."learningCourseId"
      WHERE l."id" = ${lessonId} AND NOT l."hidden" AND l."removedAt" IS NULL
        ${communityId ? Prisma.sql`AND l."courseId" = ${communityId}` : Prisma.empty}
      LIMIT 1`;
    const r = rows[0];
    if (!r) return undefined;
    return {
      id: r.id,
      moduleId: r.moduleId,
      communityId: r.communityId,
      courseId: r.communityId,
      index: r.index,
      title: r.title,
      type: r.type,
      durationMin: r.durationMin,
      body: r.body,
      ...(r.videoUrl ? { videoUrl: r.videoUrl } : {}),
      ...(r.embedUrl ? { embedUrl: r.embedUrl } : {}),
      attachments: (r.attachments as LessonAttachment[] | null) ?? [],
      isPreview: r.isPreview,
      learningCourseId: r.learningCourseId,
      course: {
        id: r.c_id,
        communityId: r.c_communityId,
        title: r.c_title,
        description: r.c_description,
        thumbnailUrl: r.c_thumbnailUrl,
        position: r.c_position,
        publishStatus: r.c_publishStatus,
        certificatesEnabled: r.c_certificatesEnabled,
        removedAt: r.c_removedAt ? r.c_removedAt.toISOString() : null,
        createdAt: r.c_createdAt.toISOString(),
        updatedAt: r.c_updatedAt.toISOString(),
      },
    };
  },

  async findLessonBrief(lessonId) {
    return (await prisma.classroomLesson.findUnique({ where: { id: lessonId }, select: { id: true, title: true, moduleId: true } })) ?? undefined;
  },

  async progressByCommunity(userId, communityIds) {
    if (communityIds.length === 0) return new Map();
    const rows = await prisma.$queryRaw<{ communityId: string; total: number; done: number }[]>`
      SELECT c."id" AS "communityId",
        (SELECT COUNT(*)::int FROM "ClassroomLesson" l JOIN "ClassroomModule" m ON m."id" = l."moduleId"
          JOIN "LearningCourse" lc ON lc."id" = m."learningCourseId" AND lc."publishStatus" = 'published' AND lc."removedAt" IS NULL
          WHERE l."courseId" = c."id" AND NOT l."hidden" AND l."removedAt" IS NULL AND m."publishStatus" = 'published' AND m."removedAt" IS NULL) AS "total",
        (SELECT COUNT(*)::int FROM "LessonProgress" p JOIN "ClassroomLesson" l ON l."id" = p."lessonId"
          JOIN "ClassroomModule" m ON m."id" = l."moduleId"
          WHERE p."userId" = ${userId} AND p."completedAt" IS NOT NULL AND l."courseId" = c."id"
            AND NOT l."hidden" AND l."removedAt" IS NULL AND m."publishStatus" = 'published' AND m."removedAt" IS NULL) AS "done"
      FROM unnest(${communityIds}::text[]) AS c("id")`;
    return new Map(rows.map((r) => [r.communityId, { total: r.total, done: r.done }]));
  },

  async accessModuleIds(userId, moduleIds) {
    if (moduleIds.length === 0) return new Set();
    const rows = await prisma.moduleAccess.findMany({ where: { userId, moduleId: { in: moduleIds } }, select: { moduleId: true } });
    return new Set(rows.map((r) => r.moduleId));
  },

  async listAccessUserIds(moduleId) {
    const rows = await prisma.moduleAccess.findMany({ where: { moduleId }, orderBy: { createdAt: 'asc' }, select: { userId: true } });
    return rows.map((r) => r.userId);
  },

  async replaceAccess(moduleId, userIds) {
    await prisma.$transaction([
      prisma.moduleAccess.deleteMany({ where: { moduleId, userId: { notIn: userIds } } }),
      prisma.moduleAccess.createMany({ data: userIds.map((userId) => ({ moduleId, userId, source: 'selected' as const })), skipDuplicates: true }),
    ]);
  },

  async enrolledAmong(communityId, userIds) {
    if (userIds.length === 0) return [];
    const rows = await prisma.enrollment.findMany({ where: { communityId, userId: { in: userIds } }, select: { userId: true } });
    return rows.map((r) => r.userId);
  },

  async enrolledUserIds(communityId) {
    const rows = await prisma.enrollment.findMany({ where: { communityId }, select: { userId: true } });
    return rows.map((r) => r.userId);
  },

  async createModule(communityId, learningCourseId, input) {
    return prisma.$transaction(async (tx) => {
      await lockLearningCourse(tx, learningCourseId);
      const last = await tx.classroomModule.aggregate({ where: { learningCourseId }, _max: { index: true } });
      const row = await tx.classroomModule.create({
        data: {
          communityId,
          learningCourseId,
          index: (last._max.index ?? 0) + 1,
          title: input.title,
          description: input.description,
          thumbnail: input.thumbnail ?? null,
          requiredLevel: input.requiredLevel ?? null,
          ...(input.accessMode ? { accessMode: input.accessMode } : {}),
          priceCents: input.priceCents ?? null,
          ...(input.sequential !== undefined ? { sequential: input.sequential } : {}),
          ...(input.publishStatus ? { publishStatus: input.publishStatus } : {}),
        },
      });
      return toModule(row, []);
    });
  },

  async updateModule(communityId, moduleId, patch) {
    const found = await prisma.classroomModule.findFirst({ where: { id: moduleId, communityId }, select: { id: true } });
    if (!found) return undefined;
    const row = await prisma.classroomModule.update({
      where: { id: moduleId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.thumbnail !== undefined ? { thumbnail: patch.thumbnail } : {}),
        ...(patch.requiredLevel !== undefined ? { requiredLevel: patch.requiredLevel } : {}),
        ...(patch.accessMode !== undefined ? { accessMode: patch.accessMode } : {}),
        ...(patch.priceCents !== undefined ? { priceCents: patch.priceCents } : {}),
        ...(patch.sequential !== undefined ? { sequential: patch.sequential } : {}),
        ...(patch.publishStatus !== undefined ? { publishStatus: patch.publishStatus } : {}),
      },
      include: { lessons: { select: { id: true, isPreview: true }, orderBy: { index: 'asc' } } },
    });
    return toModule(row, row.lessons);
  },

  async deleteModule(communityId, moduleId) {
    return prisma.$transaction(async (tx) => {
      const mod = await tx.classroomModule.findFirst({ where: { id: moduleId, communityId }, select: { learningCourseId: true } });
      if (!mod) return false;
      await lockLearningCourse(tx, mod.learningCourseId);
      const { count } = await tx.classroomModule.deleteMany({ where: { id: moduleId, communityId } }); // cascade bài học + tiến độ
      if (count === 0) return false;
      await reindexModules(tx, mod.learningCourseId);
      return true;
    });
  },

  async reorderModules(learningCourseId, ids) {
    await prisma.$transaction(async (tx) => {
      await lockLearningCourse(tx, learningCourseId);
      await applyOrder(tx, 'ClassroomModule', ids);
    });
  },

  async createLesson(communityId, moduleId, input) {
    return prisma.$transaction(async (tx) => {
      const mod = await tx.classroomModule.findFirst({ where: { id: moduleId, communityId }, select: { id: true } });
      if (!mod) return undefined;
      await lockModule(tx, moduleId);
      const last = await tx.classroomLesson.aggregate({ where: { moduleId }, _max: { index: true } });
      const row = await tx.classroomLesson.create({
        data: {
          moduleId,
          communityId,
          index: (last._max.index ?? 0) + 1,
          title: input.title,
          type: input.type,
          durationMin: input.durationMin,
          body: input.body,
          videoUrl: input.videoUrl ?? null,
          embedUrl: input.embedUrl ?? null,
          attachments: input.attachments as unknown as Prisma.InputJsonValue,
          ...(input.isPreview !== undefined ? { isPreview: input.isPreview } : {}),
        },
      });
      return toLesson(row);
    });
  },

  async updateLesson(lessonId, patch) {
    const { videoUrl, embedUrl, attachments, ...rest } = patch;
    const data: Prisma.ClassroomLessonUpdateInput = { ...rest };
    if (attachments !== undefined) data.attachments = attachments as unknown as Prisma.InputJsonValue;
    if (videoUrl === null) {
      data.videoUrl = null;
      data.embedUrl = null;
    } else if (videoUrl !== undefined) {
      data.videoUrl = videoUrl;
      data.embedUrl = embedUrl ?? null; // đổi sang video tải lên thì bỏ embed cũ
    }
    try {
      return toLesson(await prisma.classroomLesson.update({ where: { id: lessonId }, data }));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return undefined;
      throw e;
    }
  },

  async deleteLesson(lessonId) {
    return prisma.$transaction(async (tx) => {
      const lesson = await tx.classroomLesson.findUnique({ where: { id: lessonId }, select: { moduleId: true } });
      if (!lesson) return false;
      await lockModule(tx, lesson.moduleId);
      const { count } = await tx.classroomLesson.deleteMany({ where: { id: lessonId } }); // cascade tiến độ
      if (count === 0) return false;
      await reindexLessons(tx, lesson.moduleId);
      return true;
    });
  },

  async reorderLessons(moduleId, ids) {
    await prisma.$transaction(async (tx) => {
      await lockModule(tx, moduleId);
      await applyOrder(tx, 'ClassroomLesson', ids);
    });
  },

  async toggleCompleted(userId, lessonId) {
    // Bước 1: chèn nếu chưa từng hoàn thành — chỉ một tiến trình thắng ON CONFLICT nên firstTime là duy nhất.
    const inserted = await prisma.$executeRaw`
      INSERT INTO "LessonProgress" ("userId", "lessonId", "completedAt", "firstCompletedAt")
      VALUES (${userId}, ${lessonId}, now(), now())
      ON CONFLICT ("userId", "lessonId") DO NOTHING`;
    if (inserted === 1) return { completed: true, firstTime: true };
    // Bước 2: đã có dòng -> đảo completedAt (câu lệnh đơn, khóa dòng nên các lần đảo đồng thời tuần tự hóa).
    const rows = await prisma.$queryRaw<{ done: boolean }[]>`
      UPDATE "LessonProgress"
      SET "completedAt" = CASE WHEN "completedAt" IS NULL THEN now() ELSE NULL END
      WHERE "userId" = ${userId} AND "lessonId" = ${lessonId}
      RETURNING ("completedAt" IS NOT NULL) AS done`;
    return { completed: rows[0]?.done ?? false, firstTime: false };
  },

  async completedAtMap(userId, learningCourseId) {
    const rows = await prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lesson: { module: { learningCourseId } } },
      select: { lessonId: true, completedAt: true },
    });
    return new Map(rows.map((r) => [r.lessonId, r.completedAt!.toISOString()]));
  },

  async getSettings(communityId) {
    const row = await prisma.classroomSettings.findUnique({ where: { communityId } });
    return { certificatesEnabled: row?.certificatesEnabled ?? false };
  },

  async setSettings(communityId, patch) {
    const row = await prisma.classroomSettings.upsert({
      where: { communityId },
      create: { communityId, ...patch },
      update: patch,
    });
    return { certificatesEnabled: row.certificatesEnabled };
  },

  async findCertificate(userId, learningCourseId) {
    const row = await prisma.certificate.findUnique({ where: { userId_learningCourseId: { userId, learningCourseId } } });
    return row ? toCert(row) : undefined;
  },

  async findCertificateByCode(code) {
    const row = await prisma.certificate.findUnique({ where: { code } });
    return row ? toCert(row) : undefined;
  },

  async saveCertificate(cert) {
    // ON CONFLICT DO NOTHING: cấp đồng thời không ném lỗi; chỉ lời gọi thắng mới có created=true.
    const inserted = await prisma.certificate.createMany({
      data: [
        {
          code: cert.code,
          userId: cert.userId,
          communityId: cert.communityId,
          learningCourseId: cert.learningCourseId,
          holderName: cert.holderName,
          courseTitle: cert.courseTitle,
          completedAt: new Date(cert.completedAt),
          issuedAt: new Date(cert.issuedAt),
        },
      ],
      skipDuplicates: true,
    });
    const row = await prisma.certificate.findUniqueOrThrow({
      where: { userId_learningCourseId: { userId: cert.userId, learningCourseId: cert.learningCourseId } },
    });
    return { cert: toCert(row), created: inserted.count === 1 };
  },
};
