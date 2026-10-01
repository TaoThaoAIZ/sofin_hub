import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { courseService } from '../courses/courses.service.js';
import { requireRole, requirePlatformAdmin, isPlatformAdmin } from '../permissions/policy.js';
import { auditService } from '../admin/admin-audit.service.js';
import { createReportBody, listReportsQuery, resolveReportBody } from './moderation.schema.js';
import { moderationService } from './moderation.service.js';

export const moderationRouter = Router();

moderationRouter.post('/posts/:id/report', requireAuth, async (req, res) => {
  const body = createReportBody.parse(req.body);
  res.status(201).json({ data: await moderationService.reportPost(req.userId!, req.params.id as string, body) });
});

moderationRouter.post('/comments/:id/report', requireAuth, async (req, res) => {
  const body = createReportBody.parse(req.body);
  res.status(201).json({ data: await moderationService.reportComment(req.userId!, req.params.id as string, body) });
});

moderationRouter.post('/courses/:id/members/:userId/report', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  const body = createReportBody.parse(req.body);
  res.status(201).json({ data: await moderationService.reportMember(req.userId!, courseId, req.params.userId as string, body) });
});

moderationRouter.get('/courses/:id/reports', requireAuth, async (req, res) => {
  const courseId = req.params.id as string;
  await courseService.getById(courseId);
  await requireRole(req.userId!, courseId, 'mod');
  res.json(await moderationService.listForCourse(courseId, listReportsQuery.parse(req.query)));
});

moderationRouter.get('/admin/reports', requireAuth, async (req, res) => {
  await requirePlatformAdmin(req.userId!);
  res.json(await moderationService.listAll(listReportsQuery.parse(req.query)));
});

moderationRouter.patch('/reports/:id', requireAuth, async (req, res) => {
  const report = await moderationService.getOrThrow(req.params.id as string);
  await requireRole(req.userId!, report.courseId, 'mod'); // mod+ của cộng đồng đó hoặc Platform Admin
  const body = resolveReportBody.parse(req.body);
  const data = await moderationService.resolve(report.id, req.userId!, body);
  // Chỉ Platform Admin mới vào nhật ký admin (mod cộng đồng xử lý báo cáo là việc của cộng đồng).
  if (await isPlatformAdmin(req.userId!)) {
    await auditService.record(req.userId!, {
      action: 'report.resolve', targetType: 'report', targetId: report.id, targetLabel: report.targetExcerpt?.slice(0, 120) ?? report.targetType,
      note: body.note, caseId: report.id, metadata: { decision: body.action },
    });
  }
  res.json({ data });
});
