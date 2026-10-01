import { Router, type RequestHandler, type Response } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { authenticateAccessToken } from '../auth/tokens.js';
import { listNotificationsQuery, streamQuery, updatePreferencesBody } from './notifications.schema.js';
import { notificationsService } from './notifications.service.js';

export const notificationsRouter = Router();

const HEARTBEAT_MS = 25_000;
/** Các luồng SSE thông báo đang mở trên instance này (để đóng khi shutdown). */
const openStreams = new Set<Response>();
export function closeNotificationStreams(): void {
  for (const res of [...openStreams]) res.end();
  openStreams.clear();
}

/**
 * Xác thực riêng cho SSE: EventSource không đặt được header nên nhận ?ticket= (dùng 1 lần, TTL 30s) hoặc Bearer header.
 * KHÔNG nhận access token trong query string (lọt vào log/Referer).
 */
const streamAuth: RequestHandler = async (req, _res, next) => {
  const q = streamQuery.parse(req.query);
  const header = req.headers.authorization;
  let userId: string | undefined;
  if (header?.startsWith('Bearer ')) userId = (await authenticateAccessToken(header.slice(7)))?.userId;
  else if (q.ticket) userId = await notificationsService.consumeStreamTicket(q.ticket);
  if (!userId) return next(HttpError.unauthorized());
  req.userId = userId;
  next();
};

notificationsRouter.get('/notifications/stream', streamAuth, async (req, res) => {
  const userId = req.userId!;
  await notificationsService.ready(); // đã subscribe pub/sub trước khi client thấy kết nối mở
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx không được gom đệm luồng
  });
  res.flushHeaders();
  res.write(`retry: 5000\n: connected\n\n`);

  const off = notificationsService.onNew((n) => {
    if (n.userId === userId) res.write(`event: notification\ndata: ${JSON.stringify(n)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(`: heartbeat\n\n`), HEARTBEAT_MS);
  heartbeat.unref();
  openStreams.add(res);
  req.on('close', () => {
    clearInterval(heartbeat);
    openStreams.delete(res);
    off();
  });
});

notificationsRouter.post('/notifications/stream-ticket', requireAuth, async (req, res) => {
  res.status(201).json({ data: await notificationsService.issueStreamTicket(req.userId!) });
});

notificationsRouter.get('/notifications/unread-count', requireAuth, async (req, res) => {
  res.json({ data: { count: await notificationsService.unreadCount(req.userId!) } });
});

notificationsRouter.get('/notifications/preferences', requireAuth, async (req, res) => {
  res.json({ data: await notificationsService.getPreferences(req.userId!) });
});

notificationsRouter.put('/notifications/preferences', requireAuth, async (req, res) => {
  res.json({ data: await notificationsService.updatePreferences(req.userId!, updatePreferencesBody.parse(req.body)) });
});

notificationsRouter.post('/notifications/read-all', requireAuth, async (req, res) => {
  res.json({ data: await notificationsService.markAllRead(req.userId!) });
});

notificationsRouter.get('/notifications', requireAuth, async (req, res) => {
  res.json(await notificationsService.list(req.userId!, listNotificationsQuery.parse(req.query)));
});

notificationsRouter.post('/notifications/:id/read', requireAuth, async (req, res) => {
  res.json({ data: await notificationsService.markRead(req.userId!, req.params.id as string) });
});

notificationsRouter.delete('/notifications/:id', requireAuth, async (req, res) => {
  await notificationsService.remove(req.userId!, req.params.id as string);
  res.json({ data: { deleted: true } });
});
