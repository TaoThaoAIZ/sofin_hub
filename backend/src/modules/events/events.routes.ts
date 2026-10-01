import { Router, type Response } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { writeRateLimit } from '../../middlewares/rate-limit.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { createEventBody, updateEventBody } from './events.schema.js';
import { eventsService } from './events.service.js';

export const eventsRouter = Router();

function sendIcs(res: Response, filename: string, body: string) {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

eventsRouter.get('/courses/:id/events', requireAuth, async (req, res) => {
  const communityId = req.params.id as string;
  await catalogService.getById(communityId);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await eventsService.list(communityId, req.userId!) });
});

// Đặt trước các route có tham số để '.ics' không bị nuốt.
eventsRouter.get('/courses/:id/events.ics', requireAuth, async (req, res) => {
  const communityId = req.params.id as string;
  await catalogService.getById(communityId);
  await enrollmentService.requireMembership(req.userId!, communityId);
  sendIcs(res, `${communityId}-events.ics`, await eventsService.icsForCourse(communityId));
});

eventsRouter.post('/courses/:id/events', requireAuth, async (req, res) => {
  const communityId = req.params.id as string;
  await catalogService.getById(communityId);
  await enrollmentService.requireMembership(req.userId!, communityId);
  await requireRole(req.userId!, communityId, 'mod'); // chỉ mod/admin/owner (hoặc Platform Admin) được tạo sự kiện
  const body = createEventBody.parse(req.body);
  res.status(201).json({ data: await eventsService.create(communityId, req.userId!, body) });
});

eventsRouter.get('/events/:eventId', requireAuth, async (req, res) => {
  const event = await eventsService.getOrThrow(req.params.eventId as string);
  await enrollmentService.requireMembership(req.userId!, event.communityId);
  res.json({ data: await eventsService.getView(event.id, req.userId!) });
});

eventsRouter.get('/events/:eventId/ics', requireAuth, async (req, res) => {
  const event = await eventsService.getOrThrow(req.params.eventId as string);
  await enrollmentService.requireMembership(req.userId!, event.communityId);
  sendIcs(res, `event-${event.id}.ics`, await eventsService.icsForEvent(event.id));
});

eventsRouter.patch('/events/:eventId', requireAuth, async (req, res) => {
  const event = await eventsService.getOrThrow(req.params.eventId as string);
  await enrollmentService.requireMembership(req.userId!, event.communityId);
  await requireRole(req.userId!, event.communityId, 'mod');
  const body = updateEventBody.parse(req.body);
  res.json({ data: await eventsService.update(event.id, body, req.userId!) });
});

eventsRouter.delete('/events/:eventId', requireAuth, async (req, res) => {
  const event = await eventsService.getOrThrow(req.params.eventId as string);
  await enrollmentService.requireMembership(req.userId!, event.communityId);
  await requireRole(req.userId!, event.communityId, 'mod');
  await eventsService.remove(event.id);
  res.json({ data: { deleted: true } });
});

eventsRouter.post('/events/:eventId/rsvp', requireAuth, writeRateLimit('rsvp'), async (req, res) => {
  const event = await eventsService.getOrThrow(req.params.eventId as string);
  await enrollmentService.requireMembership(req.userId!, event.communityId);
  res.json({ data: await eventsService.toggleRsvp(event.id, req.userId!) });
});

eventsRouter.delete('/events/:eventId/rsvp', requireAuth, async (req, res) => {
  const event = await eventsService.getOrThrow(req.params.eventId as string);
  await enrollmentService.requireMembership(req.userId!, event.communityId);
  res.json({ data: await eventsService.cancelRsvp(event.id, req.userId!) });
});
