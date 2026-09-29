import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import {
  classroomSettingsSchema,
  createLessonSchema,
  createModuleSchema,
  reorderSchema,
  updateLessonSchema,
  updateModuleSchema,
} from './classroom.schema.js';
import { classroomService } from './classroom.service.js';

export const classroomRouter = Router();

/** Khóa học tồn tại (404) + user là thành viên (403). */
async function member(courseId: string, userId: string) {
  await courseService.getById(courseId);
  await enrollmentService.requireMembership(userId, courseId);
}

// ---- Đọc / học ----
classroomRouter.get('/courses/:id/modules', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await member(courseId, req.userId!);
  res.json({ data: await classroomService.listModules(courseId, req.userId!) });
});

classroomRouter.get('/courses/:id/modules/:moduleId/lessons', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await member(courseId, req.userId!);
  res.json({ data: await classroomService.listLessons(courseId, req.params.moduleId as string, req.userId!) });
});

classroomRouter.get('/courses/:id/progress', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await member(courseId, req.userId!);
  res.json({ data: await classroomService.progress(courseId, req.userId!) });
});

classroomRouter.get('/courses/:id/lessons/:lessonId', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await member(courseId, req.userId!);
  res.json({ data: await classroomService.getLesson(courseId, req.params.lessonId as string, req.userId!) });
});

classroomRouter.post('/courses/:id/lessons/:lessonId/complete', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await member(courseId, req.userId!);
  res.json({ data: await classroomService.toggleLessonComplete(courseId, req.params.lessonId as string, req.userId!) });
});

// ---- Quản lý nội dung (mod+) ----
classroomRouter.post('/courses/:id/modules', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  const body = createModuleSchema.parse(req.body);
  res.status(201).json({ data: await classroomService.createModule(courseId, body) });
});

// Phải khai báo trước `/modules/:moduleId/...` để "order" không bị hiểu là moduleId.
classroomRouter.put('/courses/:id/modules/order', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  await classroomService.reorderModules(courseId, reorderSchema.parse(req.body).ids);
  res.json({ data: await classroomService.listModules(courseId, req.userId!) });
});

classroomRouter.patch('/courses/:id/modules/:moduleId', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  const body = updateModuleSchema.parse(req.body);
  res.json({ data: await classroomService.updateModule(courseId, req.params.moduleId as string, body) });
});

classroomRouter.delete('/courses/:id/modules/:moduleId', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  await classroomService.deleteModule(courseId, req.params.moduleId as string);
  res.json({ data: { deleted: true } });
});

classroomRouter.post('/courses/:id/modules/:moduleId/lessons', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  const body = createLessonSchema.parse(req.body);
  res.status(201).json({ data: await classroomService.createLesson(courseId, req.params.moduleId as string, body) });
});

classroomRouter.put('/courses/:id/modules/:moduleId/lessons/order', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  const moduleId = req.params.moduleId as string;
  await classroomService.reorderLessons(courseId, moduleId, reorderSchema.parse(req.body).ids);
  res.json({ data: await classroomService.listLessons(courseId, moduleId, req.userId!) });
});

classroomRouter.patch('/courses/:id/lessons/:lessonId', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  const body = updateLessonSchema.parse(req.body);
  res.json({ data: await classroomService.updateLesson(courseId, req.params.lessonId as string, body) });
});

classroomRouter.delete('/courses/:id/lessons/:lessonId', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  await classroomService.deleteLesson(courseId, req.params.lessonId as string);
  res.json({ data: { deleted: true } });
});

// ---- Cài đặt & chứng nhận ----
classroomRouter.get('/courses/:id/classroom-settings', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await member(courseId, req.userId!);
  res.json({ data: await classroomService.getSettings(courseId) });
});

classroomRouter.patch('/courses/:id/classroom-settings', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'admin');
  res.json({ data: await classroomService.updateSettings(courseId, classroomSettingsSchema.parse(req.body)) });
});

classroomRouter.get('/courses/:id/certificate', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await member(courseId, req.userId!);
  res.json({ data: await classroomService.getCertificate(courseId, req.userId!) });
});

// CÔNG KHAI (không cần đăng nhập) — để bên thứ ba xác minh mã chứng nhận.
classroomRouter.get('/certificates/:code', async (req, res) => {
  res.json({ data: await classroomService.verifyCertificate(req.params.code as string) });
});
