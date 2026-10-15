import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { writeRateLimit } from '../../middlewares/rate-limit.js';
import { announcementBody, greetingsService as svc, patchAnnouncementBody, welcomeBody } from './greetings.service.js';

/**
 * Lời chào thành viên mới + thông báo popup (/courses/:id/greetings/*, alias /communities/:id/greetings/*).
 * Contract: backend/docs/api/community-greetings.md.
 */
export const greetingsRouter = Router();
const p = (v: string | string[] | undefined) => String(v);
const G = '/courses/:id/greetings';

// ------------------------------------------------------------------ thành viên
greetingsRouter.get(`${G}/pending`, requireAuth, async (req, res) => {
  res.json({ data: await svc.pending(req.userId!, p(req.params.id)) });
});

greetingsRouter.post(`${G}/welcome/seen`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await svc.markWelcomeSeen(req.userId!, p(req.params.id)) });
});

greetingsRouter.post(`${G}/announcements/:aid/seen`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await svc.markAnnouncementSeen(req.userId!, p(req.params.id), p(req.params.aid)) });
});

// ------------------------------------------------------------------ admin cộng đồng trở lên
greetingsRouter.get(`${G}/settings`, requireAuth, async (req, res) => {
  res.json({ data: await svc.settings(req.userId!, p(req.params.id)) });
});

greetingsRouter.put(`${G}/welcome`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await svc.saveWelcome(req.userId!, p(req.params.id), welcomeBody.parse(req.body ?? {})) });
});

greetingsRouter.post(`${G}/announcements`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.status(201).json({ data: await svc.publishAnnouncement(req.userId!, p(req.params.id), announcementBody.parse(req.body ?? {})) });
});

greetingsRouter.patch(`${G}/announcements/:aid`, requireAuth, writeRateLimit('general'), async (req, res) => {
  const { active } = patchAnnouncementBody.parse(req.body ?? {});
  res.json({ data: await svc.setAnnouncementActive(req.userId!, p(req.params.id), p(req.params.aid), active) });
});
