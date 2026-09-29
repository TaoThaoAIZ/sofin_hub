import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  ClassroomLesson as DbLesson,
  ClassroomModule as DbModule,
  Certificate as DbCertificate,
} from '../../generated/prisma/client.js';
import type {
  Certificate,
  ClassroomLesson,
  ClassroomModule,
  ClassroomSettings,
  LessonAttachment,
} from './classroom.types.js';

/**
 * Nội dung Lớp học (module → bài học), tiến độ, cài đặt, chứng nhận — Postgres qua Prisma.
 * Nội dung minh họa được SEED (prisma/seed/classroom.ts), runtime không còn sinh lười.
 * Mọi thao tác đổi thứ tự/thêm/xóa chạy trong transaction, khóa dòng cha (Course/Module) để `index` không bị trùng khi đồng thời.
 */
export type ModuleInput = { title: string; description: string; thumbnail?: string; requiredLevel?: number };
export type ModulePatch = Partial<{ title: string; description: string; thumbnail: string | null; requiredLevel: number | null }>;
export type LessonInput = Pick<ClassroomLesson, 'title' | 'type' | 'durationMin' | 'body' | 'attachments'> &
  Partial<Pick<ClassroomLesson, 'videoUrl' | 'embedUrl'>>;
export type LessonPatch = Partial<
  Pick<ClassroomLesson, 'title' | 'type' | 'durationMin' | 'body' | 'attachments'> & {
    videoUrl: string | null;
    embedUrl: string | null;
  }
>;

export interface ClassroomRepository {
  /** Module của khóa theo `index`, kèm `lessonIds` theo thứ tự (2 truy vấn, không N+1). */
  getModules(courseId: string): Promise<ClassroomModule[]>;
  getLessons(moduleId: string): Promise<ClassroomLesson[]>;
  /** Mọi bài của khóa (không theo thứ tự đảm bảo) để service ghép theo module. */
  getCourseLessons(courseId: string): Promise<ClassroomLesson[]>;
  findLesson(lessonId: string): Promise<ClassroomLesson | undefined>;

  createModule(courseId: string, input: ModuleInput): Promise<ClassroomModule>;
  updateModule(courseId: string, moduleId: string, patch: ModulePatch): Promise<ClassroomModule | undefined>;
  /** Xóa module cùng bài học và tiến độ liên quan (cascade), đánh lại index. */
  deleteModule(courseId: string, moduleId: string): Promise<boolean>;
  /** `ids` đã được service kiểm tra là hoán vị đủ của danh sách hiện có. */
  reorderModules(courseId: string, ids: string[]): Promise<void>;
  createLesson(courseId: string, moduleId: string, input: LessonInput): Promise<ClassroomLesson | undefined>;
  updateLesson(lessonId: string, patch: LessonPatch): Promise<ClassroomLesson | undefined>;
  deleteLesson(lessonId: string): Promise<boolean>;
  reorderLessons(moduleId: string, ids: string[]): Promise<void>;

  /**
   * Đảo trạng thái hoàn thành một cách nguyên tử; `firstTime` = dòng LessonProgress vừa được TẠO (lần đầu user hoàn thành bài này)
   * — chỉ một lời gọi đồng thời duy nhất nhận firstTime=true nên điểm không bị cộng đôi.
   */
  toggleCompleted(userId: string, lessonId: string): Promise<{ completed: boolean; firstTime: boolean }>;
  /** lessonId → thời điểm hoàn thành (ISO) của các bài đang được đánh dấu xong trong khóa (1 truy vấn). */
  completedAtMap(userId: string, courseId: string): Promise<Map<string, string>>;

  getSettings(courseId: string): Promise<ClassroomSettings>;
  setSettings(courseId: string, patch: Partial<ClassroomSettings>): Promise<ClassroomSettings>;

  findCertificate(userId: string, courseId: string): Promise<Certificate | undefined>;
  findCertificateByCode(code: string): Promise<Certificate | undefined>;
  /** Lưu chứng nhận; nếu (user,course) đã có (cấp đồng thời) trả về bản đã có với created=false. */
  saveCertificate(cert: Certificate): Promise<{ cert: Certificate; created: boolean }>;
}

const toLesson = (l: DbLesson): ClassroomLesson => ({
  id: l.id,
  moduleId: l.moduleId,
  courseId: l.courseId,
  index: l.index,
  title: l.title,
  type: l.type,
  durationMin: l.durationMin,
  body: l.body,
  ...(l.videoUrl ? { videoUrl: l.videoUrl } : {}),
  ...(l.embedUrl ? { embedUrl: l.embedUrl } : {}),
  attachments: (l.attachments as unknown as LessonAttachment[] | null) ?? [],
});

const toModule = (m: DbModule, lessonIds: string[]): ClassroomModule => ({
  id: m.id,
  courseId: m.courseId,
  index: m.index,
  title: m.title,
  description: m.description,
  ...(m.thumbnail ? { thumbnail: m.thumbnail } : {}),
  ...(m.requiredLevel ? { requiredLevel: m.requiredLevel } : {}),
  lessonIds,
});

const toCert = (c: DbCertificate): Certificate => ({
  code: c.code,
  userId: c.userId,
  courseId: c.courseId,
  holderName: c.holderName,
  courseTitle: c.courseTitle,
  completedAt: c.completedAt.toISOString(),
  issuedAt: c.issuedAt.toISOString(),
});

type Tx = Prisma.TransactionClient;

/** Đánh lại index 1..n theo thứ tự hiện có (một câu lệnh). */
const reindexModules = (tx: Tx, courseId: string) => tx.$executeRaw`
  UPDATE "ClassroomModule" m SET "index" = r.rn
  FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "index", "createdAt", "id")::int AS rn
        FROM "ClassroomModule" WHERE "courseId" = ${courseId}) r
  WHERE m."id" = r."id" AND m."index" <> r.rn`;

const reindexLessons = (tx: Tx, moduleId: string) => tx.$executeRaw`
  UPDATE "ClassroomLesson" l SET "index" = r.rn
  FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "index", "createdAt", "id")::int AS rn
        FROM "ClassroomLesson" WHERE "moduleId" = ${moduleId}) r
  WHERE l."id" = r."id" AND l."index" <> r.rn`;

const lockCourse = (tx: Tx, courseId: string) => tx.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${courseId} FOR UPDATE`;
const lockModule = (tx: Tx, moduleId: string) => tx.$queryRaw`SELECT "id" FROM "ClassroomModule" WHERE "id" = ${moduleId} FOR UPDATE`;

/** Gán index = vị trí trong `ids` (ids đã là hoán vị đủ). */
async function applyOrder(tx: Tx, table: 'ClassroomModule' | 'ClassroomLesson', ids: string[]) {
  if (ids.length === 0) return;
  await tx.$executeRawUnsafe(
    `UPDATE "${table}" t SET "index" = v.pos FROM (SELECT * FROM UNNEST($1::text[]) WITH ORDINALITY AS u(id, pos)) v WHERE t."id" = v.id`,
    ids,
  );
}

export const classroomRepository: ClassroomRepository = {
  async getModules(courseId) {
    const rows = await prisma.classroomModule.findMany({
      where: { courseId },
      orderBy: [{ index: 'asc' }, { createdAt: 'asc' }],
      include: { lessons: { select: { id: true }, orderBy: [{ index: 'asc' }, { createdAt: 'asc' }] } },
    });
    return rows.map((m) => toModule(m, m.lessons.map((l) => l.id)));
  },

  async getLessons(moduleId) {
    const rows = await prisma.classroomLesson.findMany({ where: { moduleId }, orderBy: [{ index: 'asc' }, { createdAt: 'asc' }] });
    return rows.map(toLesson);
  },

  async getCourseLessons(courseId) {
    return (await prisma.classroomLesson.findMany({ where: { courseId } })).map(toLesson);
  },

  async findLesson(lessonId) {
    const row = await prisma.classroomLesson.findUnique({ where: { id: lessonId } });
    return row ? toLesson(row) : undefined;
  },

  async createModule(courseId, input) {
    return prisma.$transaction(async (tx) => {
      await lockCourse(tx, courseId);
      const last = await tx.classroomModule.aggregate({ where: { courseId }, _max: { index: true } });
      const row = await tx.classroomModule.create({
        data: {
          courseId,
          index: (last._max.index ?? 0) + 1,
          title: input.title,
          description: input.description,
          thumbnail: input.thumbnail ?? null,
          requiredLevel: input.requiredLevel ?? null,
        },
      });
      return toModule(row, []);
    });
  },

  async updateModule(courseId, moduleId, patch) {
    const found = await prisma.classroomModule.findFirst({ where: { id: moduleId, courseId }, select: { id: true } });
    if (!found) return undefined;
    const row = await prisma.classroomModule.update({
      where: { id: moduleId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.thumbnail !== undefined ? { thumbnail: patch.thumbnail } : {}),
        ...(patch.requiredLevel !== undefined ? { requiredLevel: patch.requiredLevel } : {}),
      },
      include: { lessons: { select: { id: true }, orderBy: { index: 'asc' } } },
    });
    return toModule(row, row.lessons.map((l) => l.id));
  },

  async deleteModule(courseId, moduleId) {
    return prisma.$transaction(async (tx) => {
      await lockCourse(tx, courseId);
      const { count } = await tx.classroomModule.deleteMany({ where: { id: moduleId, courseId } }); // cascade bài học + tiến độ
      if (count === 0) return false;
      await reindexModules(tx, courseId);
      return true;
    });
  },

  async reorderModules(courseId, ids) {
    await prisma.$transaction(async (tx) => {
      await lockCourse(tx, courseId);
      await applyOrder(tx, 'ClassroomModule', ids);
    });
  },

  async createLesson(courseId, moduleId, input) {
    return prisma.$transaction(async (tx) => {
      const mod = await tx.classroomModule.findFirst({ where: { id: moduleId, courseId }, select: { id: true } });
      if (!mod) return undefined;
      await lockModule(tx, moduleId);
      const last = await tx.classroomLesson.aggregate({ where: { moduleId }, _max: { index: true } });
      const row = await tx.classroomLesson.create({
        data: {
          moduleId,
          courseId,
          index: (last._max.index ?? 0) + 1,
          title: input.title,
          type: input.type,
          durationMin: input.durationMin,
          body: input.body,
          videoUrl: input.videoUrl ?? null,
          embedUrl: input.embedUrl ?? null,
          attachments: input.attachments as unknown as Prisma.InputJsonValue,
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
      if (embedUrl) data.embedUrl = embedUrl;
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

  async completedAtMap(userId, courseId) {
    const rows = await prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lesson: { courseId } },
      select: { lessonId: true, completedAt: true },
    });
    return new Map(rows.map((r) => [r.lessonId, r.completedAt!.toISOString()]));
  },

  async getSettings(courseId) {
    const row = await prisma.classroomSettings.findUnique({ where: { courseId } });
    return { certificatesEnabled: row?.certificatesEnabled ?? false };
  },

  async setSettings(courseId, patch) {
    const row = await prisma.classroomSettings.upsert({
      where: { courseId },
      create: { courseId, ...patch },
      update: patch,
    });
    return { certificatesEnabled: row.certificatesEnabled };
  },

  async findCertificate(userId, courseId) {
    const row = await prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
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
          courseId: cert.courseId,
          holderName: cert.holderName,
          courseTitle: cert.courseTitle,
          completedAt: new Date(cert.completedAt),
          issuedAt: new Date(cert.issuedAt),
        },
      ],
      skipDuplicates: true,
    });
    const row = await prisma.certificate.findUniqueOrThrow({
      where: { userId_courseId: { userId: cert.userId, courseId: cert.courseId } },
    });
    return { cert: toCert(row), created: inserted.count === 1 };
  },
};
