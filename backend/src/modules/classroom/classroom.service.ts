import { randomBytes } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { catalogService } from '../catalog/catalog.service.js';
import { notify } from '../notifications/notifications.service.js';
import { atLeast, getRole } from '../permissions/policy.js';
import { levelFor } from '../points/points.levels.js';
import { pointsService } from '../points/points.service.js';
import { toEmbedUrl } from './classroom.schema.js';
import { classroomRepository, type ClassroomRepository, type LessonPatch, type ModulePatch } from './classroom.repository.js';
import {
  learningCourseRepository,
  pickDefault,
  type CourseInput,
  type CoursePatch,
  type LearningCourseRepository,
} from './learning-courses.repository.js';
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
  CoursePublishStatus,
  LearningCourseRecord,
  LearningCourseView,
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

const courseNotFound = () => HttpError.notFound('Không tìm thấy khóa học');

/** Khóa học đã chọn + người xem có quyền quản lý nội dung (mod+) hay không. */
export interface ResolvedCourse {
  course: LearningCourseRecord;
  staff: boolean;
}

export function createClassroomService(repo: ClassroomRepository = classroomRepository, courses: LearningCourseRepository = learningCourseRepository) {
  const lessonView = (l: ClassroomLesson, doneIds: Set<string>): ClassroomLessonView => {
    const { moduleId: _moduleId, courseId: _courseId, communityId: _communityId, ...rest } = l;
    return { ...rest, completed: doneIds.has(l.id) };
  };

  const isStaff = async (communityId: string, userId: string) => atLeast(await getRole(userId, communityId), 'mod');

  /**
   * Chọn khóa học để thao tác. `courseId` có → phải thuộc cộng đồng (404 nếu không; khóa nháp/lưu trữ chỉ mod+ thấy).
   * Không có → KHÓA MẶC ĐỊNH (published đầu tiên; mod+ nếu không có khóa published thì khóa đầu tiên); không có khóa nào → undefined.
   */
  async function resolveCourse(communityId: string, courseId: string | undefined, userId: string): Promise<ResolvedCourse | undefined> {
    const staff = await isStaff(communityId, userId);
    if (courseId) {
      const course = await courses.findById(communityId, courseId);
      if (!course || (course.publishStatus !== 'published' && !staff)) throw courseNotFound();
      return { course, staff };
    }
    const all = await courses.list(communityId);
    const course = pickDefault(staff ? all : all.filter((c) => c.publishStatus === 'published'));
    return course ? { course, staff } : undefined;
  }

  async function requireCourse(communityId: string, courseId: string | undefined, userId: string): Promise<ResolvedCourse> {
    const r = await resolveCourse(communityId, courseId, userId);
    if (!r) throw courseNotFound();
    return r;
  }

  /** Khóa chứa module (module phải hiển thị + thuộc cộng đồng; `courseId` nếu truyền phải khớp). */
  async function moduleContext(communityId: string, moduleId: string, courseId: string | undefined, userId: string) {
    const mod = await repo.findModule(communityId, moduleId);
    if (!mod || (courseId && mod.learningCourseId !== courseId)) throw HttpError.notFound('Không tìm thấy module');
    const staff = await isStaff(communityId, userId);
    const course = mod.course;
    if (course.removedAt || (course.publishStatus !== 'published' && !staff)) throw HttpError.notFound('Không tìm thấy module');
    return { mod, course, staff } as const;
  }

  /** Trạng thái các module của 1 user TRONG MỘT KHÓA HỌC; khóa luôn tính ở server (tuần tự theo thứ tự + theo cấp độ). Mod+ không bị khóa. */
  async function state(communityId: string, course: LearningCourseRecord, userId: string, staff: boolean) {
    // Route đã kiểm tra cộng đồng tồn tại + thành viên; không nạp lại ở đây.
    const [modules, doneAt] = await Promise.all([repo.getModules(course.id), repo.completedAtMap(userId, course.id)]);
    const doneIds = new Set(doneAt.keys());
    const needsLevel = modules.some((m) => m.requiredLevel);
    const level = needsLevel ? levelFor(await pointsService.totalFor(communityId, userId, 'all')).level : 1;

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
          learningCourseId: course.id,
          communityId,
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

  async function requireLesson(communityId: string, lessonId: string) {
    const lesson = await repo.findLesson(lessonId, communityId);
    if (!lesson) throw HttpError.notFound('Không tìm thấy bài học');
    return lesson;
  }

  /** Khóa chứa bài học (nhìn thấy được với người xem). */
  async function lessonContext(communityId: string, lessonId: string, userId: string) {
    const lesson = await requireLesson(communityId, lessonId);
    const staff = await isStaff(communityId, userId);
    const course = lesson.course;
    if (course.removedAt || (course.publishStatus !== 'published' && !staff)) throw HttpError.notFound('Không tìm thấy bài học');
    return { lesson, course, staff } as const;
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

  /** Id bài của khóa theo thứ tự module → bài: suy ra từ `modules[].lessonIds` đã có (không nạp thân bài cả khóa). */
  const flatLessonIds = (modules: ClassroomModule[]) => modules.flatMap((m) => m.lessonIds);

  /** Chứng nhận bật? Khóa học ghi đè (true/false) > cài đặt cộng đồng. */
  async function certificatesEffective(communityId: string, course: LearningCourseRecord): Promise<boolean> {
    return course.certificatesEnabled ?? (await repo.getSettings(communityId)).certificatesEnabled;
  }

  async function toView(
    communityId: string,
    userId: string,
    rows: LearningCourseRecord[],
    all: LearningCourseRecord[],
    settingsEnabled: boolean,
  ): Promise<LearningCourseView[]> {
    const counts = await courses.counts(userId, rows.map((r) => r.id));
    const defaultId = pickDefault(all.filter((c) => c.publishStatus === 'published'))?.id ?? pickDefault(all)?.id;
    return rows.map((c) => {
      const n = counts.get(c.id) ?? { modules: 0, lessons: 0, done: 0 };
      return {
        id: c.id,
        communityId,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        position: c.position,
        publishStatus: c.publishStatus,
        certificatesEnabled: c.certificatesEnabled,
        certificatesEffective: c.certificatesEnabled ?? settingsEnabled,
        isDefault: c.id === defaultId,
        modulesCount: n.modules,
        lessonsCount: n.lessons,
        progress: {
          percent: n.lessons ? Math.min(100, Math.round((n.done / n.lessons) * 100)) : 0,
          completedLessons: n.done,
          totalLessons: n.lessons,
        },
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });
  }

  return {
    // ================================================================ Khóa học (entity mới) ================================================================
    async listCourses(communityId: string, userId: string, statuses?: CoursePublishStatus[]): Promise<LearningCourseView[]> {
      const staff = await isStaff(communityId, userId);
      const all = await courses.list(communityId);
      // Thành viên thường chỉ thấy published; mod+ thấy mọi trạng thái (lọc `status` chỉ áp cho mod+).
      const visible = staff ? all.filter((c) => !statuses || statuses.includes(c.publishStatus)) : all.filter((c) => c.publishStatus === 'published');
      return toView(communityId, userId, visible, all, (await repo.getSettings(communityId)).certificatesEnabled);
    },

    async getCourse(communityId: string, courseId: string, userId: string): Promise<LearningCourseView> {
      const { course } = await requireCourse(communityId, courseId, userId);
      const all = await courses.list(communityId);
      return (await toView(communityId, userId, [course], all, (await repo.getSettings(communityId)).certificatesEnabled))[0]!;
    },

    async createCourse(communityId: string, userId: string, input: CourseInput): Promise<LearningCourseView> {
      const created = await courses.create(communityId, input);
      return this.getCourse(communityId, created.id, userId);
    },

    async updateCourse(communityId: string, courseId: string, userId: string, patch: CoursePatch): Promise<LearningCourseView> {
      await requireCourse(communityId, courseId, userId);
      await courses.update(communityId, courseId, patch);
      return this.getCourse(communityId, courseId, userId);
    },

    async reorderCourses(communityId: string, userId: string, ids: string[]): Promise<LearningCourseView[]> {
      const all = await courses.list(communityId);
      assertPermutation(ids, all.map((c) => c.id));
      await courses.reorder(communityId, ids);
      return this.listCourses(communityId, userId);
    },

    async deleteCourse(communityId: string, courseId: string): Promise<void> {
      const r = await courses.remove(communityId, courseId);
      if (r === false) throw courseNotFound();
      if (r === 'last') throw HttpError.badRequest('Không thể xóa khóa học cuối cùng của cộng đồng');
    },

    /** Khóa học mặc định (tạo nếu cộng đồng chưa có khóa nào) — dùng khi thêm module qua route cũ. */
    async ensureDefaultCourse(communityId: string): Promise<LearningCourseRecord> {
      const community = await catalogService.getById(communityId);
      return courses.ensureDefault(communityId, community.title);
    },

    // ================================================================ Đọc / học ================================================================
    async listModules(communityId: string, courseId: string | undefined, userId: string): Promise<ClassroomModuleView[]> {
      const r = await resolveCourse(communityId, courseId, userId);
      if (!r) return [];
      return (await state(communityId, r.course, userId, r.staff)).states.map((s) => s.view);
    },

    async listLessons(communityId: string, moduleId: string, userId: string, courseId?: string): Promise<ClassroomLessonView[]> {
      const { mod, course, staff } = await moduleContext(communityId, moduleId, courseId, userId);
      const { states, doneIds } = await state(communityId, course, userId, staff);
      const s = states.find((x) => x.module.id === mod.id);
      if (!s) throw HttpError.notFound('Không tìm thấy module');
      if (s.view.locked) throw moduleLocked();
      const lessons = await repo.getLessons(moduleId);
      return lessons.map((l) => lessonView(l, doneIds));
    },

    async getLesson(communityId: string, lessonId: string, userId: string): Promise<ClassroomLessonDetail> {
      const { lesson, course, staff } = await lessonContext(communityId, lessonId, userId);
      const { states, modules, doneIds } = await state(communityId, course, userId, staff);
      const s = states.find((x) => x.module.id === lesson.moduleId);
      if (!s) throw HttpError.notFound('Không tìm thấy module');
      if (s.view.locked) throw moduleLocked();
      const flat = flatLessonIds(modules);
      const i = flat.indexOf(lessonId);
      return {
        ...lessonView(lesson, doneIds),
        learningCourseId: course.id,
        communityId,
        moduleId: s.module.id,
        moduleTitle: s.module.title,
        moduleIndex: s.module.index,
        prevLessonId: flat[i - 1] ?? null,
        nextLessonId: flat[i + 1] ?? null,
      };
    },

    async toggleLessonComplete(communityId: string, lessonId: string, userId: string) {
      const { lesson, course, staff } = await lessonContext(communityId, lessonId, userId);
      const { states } = await state(communityId, course, userId, staff);
      // Không tin FE: bài thuộc module đang khóa thì không được đánh dấu.
      if (states.find((x) => x.module.id === lesson.moduleId)?.view.locked) throw moduleLocked();
      // firstTime chỉ true đúng một lần (dòng LessonProgress được tạo nguyên tử) => điểm không bị cộng đôi kể cả gọi song song.
      const { completed, firstTime } = await repo.toggleCompleted(userId, lessonId);
      if (completed && firstTime) await pointsService.award(userId, communityId, 'lesson_complete', { type: 'lesson', id: lessonId });
      return { completed };
    },

    async progress(communityId: string, courseId: string | undefined, userId: string): Promise<ClassroomProgress> {
      const r = await resolveCourse(communityId, courseId, userId);
      if (!r) return { learningCourseId: null, percent: 0, completedLessons: 0, totalLessons: 0, completedModules: 0, lastLessonId: null, nextLesson: null };
      const { states, modules, doneIds, doneAt } = await state(communityId, r.course, userId, r.staff);
      const totalLessons = flatLessonIds(modules).length;
      const completedLessons = modules.reduce((n, m) => n + m.lessonIds.filter((id) => doneIds.has(id)).length, 0);
      const lastLessonId = [...doneAt.entries()].sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0] ?? null;
      const open = states.filter((s) => !s.view.locked);
      const nextId = open.flatMap((s) => s.module.lessonIds).find((id) => !doneIds.has(id));
      // Chỉ cần tên + module của đúng 1 bài kế tiếp (không nạp thân bài của cả khóa).
      const next = nextId ? await repo.findLessonBrief(nextId) : undefined;
      return {
        learningCourseId: r.course.id,
        percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
        completedLessons,
        totalLessons,
        completedModules: states.filter((s) => s.view.lessonsCount > 0 && s.view.completedCount === s.view.lessonsCount).length,
        lastLessonId,
        nextLesson: next ? { id: next.id, title: next.title, moduleId: next.moduleId } : null,
      };
    },

    // ================================================================ Quản lý nội dung (route đã requireRole mod+) ================================================================
    /** `courseId` bỏ trống = khóa mặc định (tạo nếu cộng đồng chưa có khóa nào). */
    async createModule(
      communityId: string,
      courseId: string | undefined,
      userId: string,
      input: { title: string; description: string; thumbnail?: string | undefined; requiredLevel?: number | undefined },
    ) {
      const resolved = await resolveCourse(communityId, courseId, userId);
      const courseRecord = resolved?.course ?? (await this.ensureDefaultCourse(communityId));
      const { thumbnail, requiredLevel, ...base } = input;
      return repo.createModule(communityId, courseRecord.id, {
        ...base,
        ...(thumbnail ? { thumbnail } : {}),
        ...(requiredLevel ? { requiredLevel } : {}),
      });
    },

    async updateModule(communityId: string, moduleId: string, patch: ModulePatch, courseId?: string) {
      const mod = await repo.findModule(communityId, moduleId);
      if (!mod || (courseId && mod.learningCourseId !== courseId)) throw HttpError.notFound('Không tìm thấy module');
      return (await repo.updateModule(communityId, moduleId, patch))!;
    },

    async deleteModule(communityId: string, moduleId: string, courseId?: string) {
      const mod = await repo.findModule(communityId, moduleId);
      if (!mod || (courseId && mod.learningCourseId !== courseId)) throw HttpError.notFound('Không tìm thấy module');
      await repo.deleteModule(communityId, moduleId);
    },

    async reorderModules(communityId: string, courseId: string | undefined, userId: string, ids: string[]) {
      const { course } = await requireCourse(communityId, courseId, userId);
      const mods = await repo.getModules(course.id);
      assertPermutation(ids, mods.map((m) => m.id));
      await repo.reorderModules(course.id, ids);
    },

    async createLesson(
      communityId: string,
      moduleId: string,
      input: { title: string; type: LessonType; durationMin: number; body: string; videoUrl?: string | undefined; attachments?: LessonAttachment[] | undefined },
      courseId?: string,
    ) {
      const mod = await repo.findModule(communityId, moduleId);
      if (!mod || (courseId && mod.learningCourseId !== courseId)) throw HttpError.notFound('Không tìm thấy module');
      const { videoUrl, attachments, ...base } = input;
      return (await repo.createLesson(communityId, moduleId, { ...base, attachments: attachments ?? [], ...videoFields(videoUrl) }))!;
    },

    async updateLesson(
      communityId: string,
      lessonId: string,
      input: Partial<{ title: string; type: LessonType; durationMin: number; body: string; videoUrl: string | null; attachments: LessonAttachment[] }>,
    ) {
      await requireLesson(communityId, lessonId);
      const { videoUrl, ...rest } = input;
      const patch: LessonPatch = { ...rest };
      if (videoUrl === null) patch.videoUrl = null;
      else if (videoUrl !== undefined) Object.assign(patch, videoFields(videoUrl));
      return (await repo.updateLesson(lessonId, patch))!;
    },

    async deleteLesson(communityId: string, lessonId: string) {
      await requireLesson(communityId, lessonId);
      await repo.deleteLesson(lessonId);
    },

    async reorderLessons(communityId: string, moduleId: string, ids: string[], courseId?: string) {
      const mod = await repo.findModule(communityId, moduleId);
      if (!mod || (courseId && mod.learningCourseId !== courseId)) throw HttpError.notFound('Không tìm thấy module');
      assertPermutation(ids, mod.lessonIds);
      await repo.reorderLessons(moduleId, ids);
    },

    // ================================================================ Cài đặt & chứng nhận ================================================================
    getSettings(communityId: string): Promise<ClassroomSettings> {
      return repo.getSettings(communityId); // route đã kiểm tra cộng đồng tồn tại
    },

    async updateSettings(communityId: string, patch: Partial<ClassroomSettings>) {
      return repo.setSettings(communityId, patch);
    },

    /**
     * Cấp (lần đầu) hoặc trả lại chứng nhận đã cấp CỦA MỘT KHÓA HỌC (mặc định: khóa mặc định). Chỉ khi chứng nhận bật
     * (khóa học ghi đè > cài đặt cộng đồng) + user hoàn thành 100% bài của khóa đó.
     */
    async getCertificate(communityId: string, courseId: string | undefined, userId: string): Promise<CertificateView> {
      const { course, staff } = await requireCourse(communityId, courseId, userId);
      if (!(await certificatesEffective(communityId, course))) {
        throw HttpError.forbidden('Cộng đồng này chưa bật chứng nhận hoàn thành khóa học');
      }
      const { modules, doneIds, doneAt } = await state(communityId, course, userId, staff);
      const flat = flatLessonIds(modules);
      if (flat.length === 0 || !flat.every((id) => doneIds.has(id))) {
        throw HttpError.forbidden('Bạn cần hoàn thành 100% bài học để nhận chứng nhận');
      }

      let cert = await repo.findCertificate(userId, course.id);
      if (!cert) {
        const completedAt = [...doneAt.values()].sort().at(-1) ?? new Date().toISOString();
        const draft: Certificate = {
          code: randomBytes(12).toString('base64url'), // 96 bit ngẫu nhiên: không đoán được
          userId,
          communityId,
          learningCourseId: course.id,
          holderName: (await userBriefView(userId)).name,
          courseTitle: course.title,
          completedAt,
          issuedAt: new Date().toISOString(),
        };
        const saved = await repo.saveCertificate(draft); // unique (user, khóa học): cấp đồng thời chỉ giữ 1 bản
        cert = saved.cert;
        if (saved.created) notify({
          userId,
          type: 'system',
          title: 'Bạn đã nhận được chứng nhận hoàn thành',
          body: `Chúc mừng! Bạn đã hoàn thành khóa "${course.title}" và được cấp chứng nhận.`,
          link: `/courses/${communityId}/community/lop-hoc`,
          communityId,
        });
      }
      const { code, holderName, courseTitle, completedAt, issuedAt } = cert;
      return { code, holderName, courseTitle, completedAt, issuedAt, learningCourseId: cert.learningCourseId, communityId };
    },

    /** Xác minh công khai: chỉ lộ tên người nhận, tên khóa, ngày cấp. */
    async verifyCertificate(code: string): Promise<PublicCertificateView> {
      const cert = await repo.findCertificateByCode(code);
      if (!cert) throw HttpError.notFound('Không tìm thấy chứng nhận với mã này');
      return { valid: true, holderName: cert.holderName, courseTitle: cert.courseTitle, issuedAt: cert.issuedAt };
    },
  };
}

export const classroomService = createClassroomService();
