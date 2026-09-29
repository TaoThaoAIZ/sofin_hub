import { randomBytes } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { courseService } from '../courses/courses.service.js';
import { notify } from '../notifications/notifications.service.js';
import { atLeast, getRole } from '../permissions/policy.js';
import { levelFor } from '../points/points.levels.js';
import { pointsService } from '../points/points.service.js';
import { toEmbedUrl } from './classroom.schema.js';
import { classroomRepository, type ClassroomRepository, type LessonPatch, type ModulePatch } from './classroom.repository.js';
import type {
  Certificate,
  CertificateView,
  ClassroomLesson,
  ClassroomLessonDetail,
  ClassroomLessonView,
  ClassroomModule,
  ClassroomModuleView,
  ClassroomProgress,
  ClassroomSettings,
  LessonAttachment,
  LessonType,
  PublicCertificateView,
} from './classroom.types.js';

interface ModuleState {
  view: ClassroomModuleView;
  module: ClassroomModule;
}

const moduleLocked = (msg = 'Module này đang bị khóa. Hãy hoàn thành module trước đó hoặc đạt đủ cấp độ yêu cầu') =>
  new HttpError(403, 'MODULE_LOCKED', msg);

export function createClassroomService(repo: ClassroomRepository = classroomRepository) {
  const lessonView = (l: ClassroomLesson, doneIds: Set<string>): ClassroomLessonView => {
    const { moduleId: _moduleId, courseId: _courseId, ...rest } = l;
    return { ...rest, completed: doneIds.has(l.id) };
  };

  /** Trạng thái các module của 1 user; khóa luôn tính ở server (tuần tự theo thứ tự + theo cấp độ). Mod+ không bị khóa. */
  async function state(courseId: string, userId: string) {
    const course = await courseService.getById(courseId);
    void course;
    const [modules, doneAt] = await Promise.all([repo.getModules(courseId), repo.completedAtMap(userId, courseId)]);
    const doneIds = new Set(doneAt.keys());
    const staff = atLeast(await getRole(userId, courseId), 'mod');
    const needsLevel = modules.some((m) => m.requiredLevel);
    const level = needsLevel ? levelFor(await pointsService.totalFor(courseId, userId, 'all')).level : 1;

    let prevFullyDone = true;
    const states: ModuleState[] = [];
    for (const m of modules) {
      const completedCount = m.lessonIds.filter((id) => doneIds.has(id)).length;
      const pct = m.lessonIds.length ? Math.round((completedCount / m.lessonIds.length) * 100) : 0;
      const orderLocked = !prevFullyDone;
      const levelLocked = !!m.requiredLevel && level < m.requiredLevel;
      const locked = !staff && (orderLocked || levelLocked);
      states.push({
        module: m,
        view: {
          id: m.id,
          index: m.index,
          title: m.title,
          description: m.description,
          lessonsCount: m.lessonIds.length,
          completedCount,
          pct,
          locked,
          ...(m.thumbnail ? { thumbnail: m.thumbnail } : {}),
          ...(m.requiredLevel ? { requiredLevel: m.requiredLevel } : {}),
          lockReason: !locked ? null : orderLocked ? 'previous_module' : 'level',
        },
      });
      prevFullyDone = completedCount === m.lessonIds.length;
    }
    return { modules, states, doneIds, doneAt, staff };
  }

  async function requireModule(courseId: string, moduleId: string) {
    await courseService.getById(courseId);
    const mod = (await repo.getModules(courseId)).find((m) => m.id === moduleId);
    if (!mod) throw HttpError.notFound('Không tìm thấy module');
    return mod;
  }

  async function requireLesson(courseId: string, lessonId: string) {
    await courseService.getById(courseId);
    const lesson = await repo.findLesson(lessonId);
    if (!lesson || lesson.courseId !== courseId) throw HttpError.notFound('Không tìm thấy bài học');
    return lesson;
  }

  /** `ids` phải là hoán vị đầy đủ của danh sách hiện có (không thiếu, không trùng, không lạ). */
  function assertPermutation(ids: string[], current: string[]) {
    if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
      throw HttpError.badRequest('Danh sách sắp xếp phải gồm đủ và đúng các mục hiện có, không trùng lặp');
    }
  }

  function videoFields(videoUrl: string | undefined) {
    if (!videoUrl) return {};
    const embedUrl = toEmbedUrl(videoUrl);
    if (!embedUrl) throw HttpError.badRequest('Chỉ chấp nhận link video YouTube hoặc Vimeo hợp lệ');
    return { videoUrl: videoUrl.trim(), embedUrl };
  }

  /** Bài của khóa theo thứ tự module → bài (1 truy vấn, ghép trong bộ nhớ). */
  async function orderedLessons(courseId: string, modules: ClassroomModule[]) {
    const byId = new Map((await repo.getCourseLessons(courseId)).map((l) => [l.id, l]));
    const out: ClassroomLesson[] = [];
    for (const m of modules) for (const id of m.lessonIds) {
      const l = byId.get(id);
      if (l) out.push(l);
    }
    return out;
  }

  return {
    // ---- Đọc (giữ nguyên hình dạng response cũ, chỉ thêm trường) ----
    async listModules(courseId: string, userId: string): Promise<ClassroomModuleView[]> {
      return (await state(courseId, userId)).states.map((s) => s.view);
    },

    async listLessons(courseId: string, moduleId: string, userId: string): Promise<ClassroomLessonView[]> {
      const { states, doneIds } = await state(courseId, userId);
      const s = states.find((x) => x.module.id === moduleId);
      if (!s) throw HttpError.notFound('Không tìm thấy module');
      if (s.view.locked) throw moduleLocked();
      const lessons = await repo.getLessons(moduleId);
      return lessons.map((l) => lessonView(l, doneIds));
    },

    async getLesson(courseId: string, lessonId: string, userId: string): Promise<ClassroomLessonDetail> {
      const lesson = await requireLesson(courseId, lessonId);
      const { states, modules, doneIds } = await state(courseId, userId);
      const s = states.find((x) => x.module.id === lesson.moduleId);
      if (!s) throw HttpError.notFound('Không tìm thấy module');
      if (s.view.locked) throw moduleLocked();
      const flat = await orderedLessons(courseId, modules);
      const i = flat.findIndex((l) => l.id === lessonId);
      return {
        ...lessonView(lesson, doneIds),
        moduleId: s.module.id,
        moduleTitle: s.module.title,
        moduleIndex: s.module.index,
        prevLessonId: flat[i - 1]?.id ?? null,
        nextLessonId: flat[i + 1]?.id ?? null,
      };
    },

    async toggleLessonComplete(courseId: string, lessonId: string, userId: string) {
      const lesson = await requireLesson(courseId, lessonId);
      const { states } = await state(courseId, userId);
      // Không tin FE: bài thuộc module đang khóa thì không được đánh dấu.
      if (states.find((x) => x.module.id === lesson.moduleId)?.view.locked) throw moduleLocked();
      // firstTime chỉ true đúng một lần (dòng LessonProgress được tạo nguyên tử) => điểm không bị cộng đôi kể cả gọi song song.
      const { completed, firstTime } = await repo.toggleCompleted(userId, lessonId);
      if (completed && firstTime) await pointsService.award(userId, courseId, 'lesson_complete');
      return { completed };
    },

    async progress(courseId: string, userId: string): Promise<ClassroomProgress> {
      const { states, modules, doneIds, doneAt } = await state(courseId, userId);
      const flat = await orderedLessons(courseId, modules);
      const totalLessons = flat.length;
      const completedLessons = flat.filter((l) => doneIds.has(l.id)).length;
      const lastLessonId = [...doneAt.entries()].sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0] ?? null;
      const openModuleIds = new Set(states.filter((s) => !s.view.locked).map((s) => s.module.id));
      const next = flat.find((l) => !doneIds.has(l.id) && openModuleIds.has(l.moduleId));
      return {
        percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
        completedLessons,
        totalLessons,
        completedModules: states.filter((s) => s.view.lessonsCount > 0 && s.view.completedCount === s.view.lessonsCount).length,
        lastLessonId,
        nextLesson: next ? { id: next.id, title: next.title, moduleId: next.moduleId } : null,
      };
    },

    // ---- Quản lý nội dung (route đã requireRole mod+) ----
    async createModule(courseId: string, input: { title: string; description: string; thumbnail?: string | undefined; requiredLevel?: number | undefined }) {
      await requireModuleList(courseId);
      const { thumbnail, requiredLevel, ...base } = input;
      return repo.createModule(courseId, {
        ...base,
        ...(thumbnail ? { thumbnail } : {}),
        ...(requiredLevel ? { requiredLevel } : {}),
      });
    },

    async updateModule(courseId: string, moduleId: string, patch: ModulePatch) {
      await requireModule(courseId, moduleId);
      return (await repo.updateModule(courseId, moduleId, patch))!;
    },

    async deleteModule(courseId: string, moduleId: string) {
      await requireModule(courseId, moduleId);
      await repo.deleteModule(courseId, moduleId);
    },

    async reorderModules(courseId: string, ids: string[]) {
      const mods = await requireModuleList(courseId);
      assertPermutation(ids, mods.map((m) => m.id));
      await repo.reorderModules(courseId, ids);
    },

    async createLesson(
      courseId: string,
      moduleId: string,
      input: { title: string; type: LessonType; durationMin: number; body: string; videoUrl?: string | undefined; attachments?: LessonAttachment[] | undefined },
    ) {
      await requireModule(courseId, moduleId);
      const { videoUrl, attachments, ...base } = input;
      return (await repo.createLesson(courseId, moduleId, { ...base, attachments: attachments ?? [], ...videoFields(videoUrl) }))!;
    },

    async updateLesson(
      courseId: string,
      lessonId: string,
      input: Partial<{ title: string; type: LessonType; durationMin: number; body: string; videoUrl: string | null; attachments: LessonAttachment[] }>,
    ) {
      await requireLesson(courseId, lessonId);
      const { videoUrl, ...rest } = input;
      const patch: LessonPatch = { ...rest };
      if (videoUrl === null) patch.videoUrl = null;
      else if (videoUrl !== undefined) Object.assign(patch, videoFields(videoUrl));
      return (await repo.updateLesson(lessonId, patch))!;
    },

    async deleteLesson(courseId: string, lessonId: string) {
      await requireLesson(courseId, lessonId);
      await repo.deleteLesson(lessonId);
    },

    async reorderLessons(courseId: string, moduleId: string, ids: string[]) {
      const mod = await requireModule(courseId, moduleId);
      assertPermutation(ids, mod.lessonIds);
      await repo.reorderLessons(moduleId, ids);
    },

    // ---- Cài đặt & chứng nhận ----
    getSettings(courseId: string): Promise<ClassroomSettings> {
      return courseService.getById(courseId).then(() => repo.getSettings(courseId));
    },

    async updateSettings(courseId: string, patch: Partial<ClassroomSettings>) {
      await courseService.getById(courseId);
      return repo.setSettings(courseId, patch);
    },

    /** Cấp (lần đầu) hoặc trả lại chứng nhận đã cấp. Chỉ khi cộng đồng bật + user hoàn thành 100%. */
    async getCertificate(courseId: string, userId: string): Promise<CertificateView> {
      const course = await courseService.getById(courseId);
      if (!(await repo.getSettings(courseId)).certificatesEnabled) {
        throw HttpError.forbidden('Cộng đồng này chưa bật chứng nhận hoàn thành khóa học');
      }
      const { modules, doneIds, doneAt } = await state(courseId, userId);
      const flat = await orderedLessons(courseId, modules);
      if (flat.length === 0 || !flat.every((l) => doneIds.has(l.id))) {
        throw HttpError.forbidden('Bạn cần hoàn thành 100% bài học để nhận chứng nhận');
      }

      let cert = await repo.findCertificate(userId, courseId);
      if (!cert) {
        const completedAt = [...doneAt.values()].sort().at(-1) ?? new Date().toISOString();
        const draft: Certificate = {
          code: randomBytes(12).toString('base64url'), // 96 bit ngẫu nhiên: không đoán được
          userId,
          courseId,
          holderName: (await userBriefView(userId)).name,
          courseTitle: course.title,
          completedAt,
          issuedAt: new Date().toISOString(),
        };
        const saved = await repo.saveCertificate(draft); // unique (user,course): cấp đồng thời chỉ giữ 1 bản
        cert = saved.cert;
        if (saved.created) notify({
          userId,
          type: 'system',
          title: 'Bạn đã nhận được chứng nhận hoàn thành',
          body: `Chúc mừng! Bạn đã hoàn thành khóa "${course.title}" và được cấp chứng nhận.`,
          link: `/courses/${courseId}/community/lop-hoc`,
          courseId,
        });
      }
      const { code, holderName, courseTitle, completedAt, issuedAt } = cert;
      return { code, holderName, courseTitle, completedAt, issuedAt };
    },

    /** Xác minh công khai: chỉ lộ tên người nhận, tên khóa, ngày cấp. */
    async verifyCertificate(code: string): Promise<PublicCertificateView> {
      const cert = await repo.findCertificateByCode(code);
      if (!cert) throw HttpError.notFound('Không tìm thấy chứng nhận với mã này');
      return { valid: true, holderName: cert.holderName, courseTitle: cert.courseTitle, issuedAt: cert.issuedAt };
    },
  };

  async function requireModuleList(courseId: string) {
    await courseService.getById(courseId);
    return repo.getModules(courseId);
  }
}

export const classroomService = createClassroomService();
