import { Router, type Request } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { HttpError } from '../../utils/http-error.js';
import {
  classroomSettingsSchema,
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  listCoursesQuery,
  reorderSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateModuleSchema,
} from './classroom.schema.js';
import type { CoursePublishStatus } from './classroom.types.js';
import { classroomService } from './classroom.service.js';

export const classroomRouter = Router();

/**
 * Hai họ đường dẫn cùng một handler:
 *  - LEGACY  `/courses/:id/...`            (và `/communities/:id/...` — app.ts viết lại tiền tố) → thao tác trên KHÓA MẶC ĐỊNH của cộng đồng;
 *  - COURSE  `/communities/:id/courses/:courseId/...` → thao tác trên đúng khóa học `:courseId`.
 * `:id` = id cộng đồng (slug); `:courseId` (nếu có) = id khóa học (entity mới).
 */
const legacy = (sub: string) => `/courses/:id${sub}`;
const scoped = (sub: string) => `/communities/:id/courses/:courseId${sub}`;
const both = (sub: string) => [legacy(sub), scoped(sub)];

const communityOf = (req: Request) => req.params.id as string;
/** `:courseId` của route mới; route cũ → undefined (khóa mặc định). */
const courseOf = (req: Request) => req.params.courseId as string | undefined;

/** Cộng đồng tồn tại (404) + user là thành viên (403) — requireMembership đã tự kiểm tra tồn tại, không nạp lại cộng đồng. */
async function member(communityId: string, userId: string) {
  await enrollmentService.requireMembership(userId, communityId);
}

/** Quản lý nội dung: cộng đồng tồn tại + chưa bị khóa + user ≥ role. */
async function manage(req: Request, min: 'mod' | 'admin' = 'mod') {
  const communityId = communityOf(req);
  await catalogService.requireLockState(communityId); // 404 nếu không có (nhẹ hơn getById: không đếm thành viên)
  await requireRole(req.userId!, communityId, min);
  return communityId;
}

// =============================================================================================================================
// KHÓA HỌC (entity mới) — /communities/:id/courses
// =============================================================================================================================
const parseStatuses = (raw?: string): CoursePublishStatus[] | undefined => {
  if (!raw) return undefined;
  const allowed: CoursePublishStatus[] = ['published', 'draft', 'archived'];
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean) as CoursePublishStatus[];
  if (list.some((s) => !allowed.includes(s))) throw HttpError.badRequest('status chỉ nhận published, draft, archived (phân tách bằng dấu phẩy)');
  return list;
};

classroomRouter.get('/communities/:id/courses', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  const { status } = listCoursesQuery.parse(req.query);
  res.json({ data: await classroomService.listCourses(communityId, req.userId!, parseStatuses(status)) });
});

classroomRouter.post('/communities/:id/courses', requireAuth, async (req, res) => {
  const communityId = await manage(req);
  const body = createCourseSchema.parse(req.body);
  res.status(201).json({ data: await classroomService.createCourse(communityId, req.userId!, body) });
});

// Phải khai báo trước `/communities/:id/courses/:courseId` để "order" không bị hiểu là courseId.
classroomRouter.put('/communities/:id/courses/order', requireAuth, async (req, res) => {
  const communityId = await manage(req);
  res.json({ data: await classroomService.reorderCourses(communityId, req.userId!, reorderSchema.parse(req.body).ids) });
});

classroomRouter.get(scoped(''), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.getCourse(communityId, courseOf(req)!, req.userId!) });
});

classroomRouter.patch(scoped(''), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  const body = updateCourseSchema.parse(req.body);
  // Ghi đè cờ chứng nhận cùng cấp quyền với `classroom-settings` (admin+); các trường khác mod+.
  if (body.certificatesEnabled !== undefined) await requireRole(req.userId!, communityId, 'admin');
  const { thumbnailUrl, ...rest } = body;
  res.json({
    data: await classroomService.updateCourse(communityId, courseOf(req)!, req.userId!, { ...rest, ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}) }),
  });
});

classroomRouter.post(scoped('/archive'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  res.json({ data: await classroomService.updateCourse(communityId, courseOf(req)!, req.userId!, { publishStatus: 'archived' }) });
});

classroomRouter.delete(scoped(''), requireAuth, async (req, res) => {
  const communityId = await manage(req, 'admin');
  await classroomService.deleteCourse(communityId, courseOf(req)!);
  res.json({ data: { deleted: true } });
});

// =============================================================================================================================
// Đọc / học
// =============================================================================================================================
classroomRouter.get(both('/modules'), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.listModules(communityId, courseOf(req), req.userId!) });
});

classroomRouter.get(both('/modules/:moduleId/lessons'), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.listLessons(communityId, req.params.moduleId as string, req.userId!, courseOf(req)) });
});

classroomRouter.get(both('/progress'), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.progress(communityId, courseOf(req), req.userId!) });
});

classroomRouter.get(legacy('/lessons/:lessonId'), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.getLesson(communityId, req.params.lessonId as string, req.userId!) });
});

classroomRouter.post(legacy('/lessons/:lessonId/complete'), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.toggleLessonComplete(communityId, req.params.lessonId as string, req.userId!) });
});

// =============================================================================================================================
// Quản lý nội dung (mod+)
// =============================================================================================================================
classroomRouter.post(both('/modules'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  const { learningCourseId, ...body } = createModuleSchema.parse(req.body);
  res.status(201).json({ data: await classroomService.createModule(communityId, courseOf(req) ?? learningCourseId, req.userId!, body) });
});

// Phải khai báo trước `/modules/:moduleId/...` để "order" không bị hiểu là moduleId.
classroomRouter.put(both('/modules/order'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  await classroomService.reorderModules(communityId, courseOf(req), req.userId!, reorderSchema.parse(req.body).ids);
  res.json({ data: await classroomService.listModules(communityId, courseOf(req), req.userId!) });
});

classroomRouter.patch(both('/modules/:moduleId'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  const body = updateModuleSchema.parse(req.body);
  res.json({ data: await classroomService.updateModule(communityId, req.params.moduleId as string, body, courseOf(req)) });
});

classroomRouter.delete(both('/modules/:moduleId'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  await classroomService.deleteModule(communityId, req.params.moduleId as string, courseOf(req));
  res.json({ data: { deleted: true } });
});

classroomRouter.post(both('/modules/:moduleId/lessons'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  const body = createLessonSchema.parse(req.body);
  res.status(201).json({ data: await classroomService.createLesson(communityId, req.params.moduleId as string, body, courseOf(req)) });
});

classroomRouter.put(both('/modules/:moduleId/lessons/order'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  const moduleId = req.params.moduleId as string;
  await classroomService.reorderLessons(communityId, moduleId, reorderSchema.parse(req.body).ids, courseOf(req));
  res.json({ data: await classroomService.listLessons(communityId, moduleId, req.userId!, courseOf(req)) });
});

classroomRouter.patch(legacy('/lessons/:lessonId'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  const body = updateLessonSchema.parse(req.body);
  res.json({ data: await classroomService.updateLesson(communityId, req.params.lessonId as string, body) });
});

classroomRouter.delete(legacy('/lessons/:lessonId'), requireAuth, async (req, res) => {
  const communityId = await manage(req);
  await classroomService.deleteLesson(communityId, req.params.lessonId as string);
  res.json({ data: { deleted: true } });
});

// =============================================================================================================================
// Cài đặt (mặc định cộng đồng) & chứng nhận (theo khóa học)
// =============================================================================================================================
classroomRouter.get(legacy('/classroom-settings'), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.getSettings(communityId) });
});

classroomRouter.patch(legacy('/classroom-settings'), requireAuth, async (req, res) => {
  const communityId = await manage(req, 'admin');
  res.json({ data: await classroomService.updateSettings(communityId, classroomSettingsSchema.parse(req.body)) });
});

classroomRouter.get(both('/certificate'), requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await member(communityId, req.userId!);
  res.json({ data: await classroomService.getCertificate(communityId, courseOf(req), req.userId!) });
});

// CÔNG KHAI (không cần đăng nhập) — để bên thứ ba xác minh mã chứng nhận.
classroomRouter.get('/certificates/:code', async (req, res) => {
  res.json({ data: await classroomService.verifyCertificate(req.params.code as string) });
});
