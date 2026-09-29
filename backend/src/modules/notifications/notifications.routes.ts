import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { authenticateAccessToken } from '../auth/tokens.js';
import { listNotificationsQuery, streamQuery, updatePreferencesBody } from './notifications.schema.js';
import { notificationsService } from './notifications.service.js';

export const notificationsRouter = Router();

const HEARTBEAT_MS = 25_000;

/**
 * Xác thực riêng cho SSE: EventSource không đặt được header nên nhận ?ticket= (ưu tiên, dùng 1 lần)
 * hoặc ?access_token= (fallback, chỉ route này), và vẫn nhận Bearer header.
 */
const streamAuth: RequestHandler = async (req, _res, next) => {
  const q = streamQuery.parse(req.query);
  const header = req.headers.authorization;
  let userId: string | undefined;
  if (header?.startsWith('Bearer ')) userId = (await authenticateAccessToken(header.slice(7)))?.userId;
  else if (q.ticket) userId = notificationsService.consumeStreamTicket(q.ticket);
  else if (q.access_token) userId = (await authenticateAccessToken(q.access_token))?.userId;
  if (!userId) return next(HttpError.unauthorized());
  req.userId = userId;
  next();
};

notificationsRouter.get('/notifications/stream', streamAuth, (req, res) => {
  const userId = req.userId!;
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
  req.on('close', () => {
    clearInterval(heartbeat);
    off();
  });
});

notificationsRouter.post('/notifications/stream-ticket', requireAuth, async (req, res) => {
  res.status(201).json({ data: notificationsService.issueStreamTicket(req.userId!) });
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
