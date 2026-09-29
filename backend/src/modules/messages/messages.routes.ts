import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { authenticateAccessToken } from '../auth/tokens.js';
import { messagesQuerySchema, openConversationSchema, sendMessageSchema } from './messages.schema.js';
import { messageService } from './messages.service.js';
import { consumeStreamTicket, issueStreamTicket, streamHub } from './messages.stream.js';

export const messagesRouter = Router();

messagesRouter.post('/conversations', requireAuth, async (req, res) => {
  const { userId } = openConversationSchema.parse(req.body);
  const { created, data } = await messageService.openConversation(req.userId!, userId);
  res.status(created ? 201 : 200).json({ data });
});

messagesRouter.get('/conversations', requireAuth, async (req, res) => {
  res.json({ data: await messageService.listConversations(req.userId!) });
});

messagesRouter.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const q = messagesQuerySchema.parse(req.query);
  res.json(await messageService.listMessages(req.userId!, req.params.id as string, q.before, q.limit));
});

messagesRouter.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  const body = sendMessageSchema.parse(req.body);
  res.status(201).json({ data: await messageService.send(req.userId!, req.params.id as string, body.content, body.attachments) });
});

messagesRouter.post('/conversations/:id/read', requireAuth, async (req, res) => {
  res.json({ data: await messageService.markRead(req.userId!, req.params.id as string) });
});

messagesRouter.delete('/messages/:id', requireAuth, async (req, res) => {
  res.json({ data: await messageService.deleteMessage(req.userId!, req.params.id as string) });
});

messagesRouter.get('/messages/unread-count', requireAuth, async (req, res) => {
  res.json({ data: await messageService.unreadTotal(req.userId!) });
});

messagesRouter.post('/messages/stream-ticket', requireAuth, (req, res) => {
  res.json({ data: issueStreamTicket(req.userId!) });
});

// Nhận Bearer hoặc ?ticket= (EventSource không đặt được header).
messagesRouter.get('/messages/stream', async (req, res) => {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? (await authenticateAccessToken(header.slice(7)))?.userId : undefined;
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : undefined;
  const userId = bearer ?? (ticket ? consumeStreamTicket(ticket) : null);
  if (!userId) throw HttpError.unauthorized();
  streamHub.attach(userId, res);
});

messagesRouter.post('/users/:id/block', requireAuth, async (req, res) => {
  res.json({ data: await messageService.block(req.userId!, req.params.id as string) });
});

messagesRouter.delete('/users/:id/block', requireAuth, async (req, res) => {
  res.json({ data: await messageService.unblock(req.userId!, req.params.id as string) });
});

messagesRouter.get('/me/blocks', requireAuth, async (req, res) => {
  res.json({ data: await messageService.listBlocks(req.userId!) });
});
