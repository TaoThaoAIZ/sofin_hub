import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { requireAuth } from '../../middlewares/auth.js';
import { userRepository } from '../auth/auth.repository.js';
import { myTicketBody, myTicketReplyBody } from './support.schema.js';
import { addMessage, createTicket, listMessages, ticketViews, ticketWhere } from './tickets.core.js';

/** Ticket của người dùng đang đăng nhập: tạo / xem / trả lời. Không lộ ghi chú nội bộ hay người được giao. */
export const ticketsRouter = Router();

const pageQ = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });

async function mine(userId: string, ref: string) {
  const t = await prisma.supportTicket.findUnique({ where: ticketWhere(ref) });
  if (!t || t.requesterId !== userId) throw HttpError.notFound('Không tìm thấy ticket');
  return t;
}

ticketsRouter.post('/support/tickets', requireAuth, async (req, res) => {
  const b = myTicketBody.parse(req.body);
  const u = await userRepository.findById(req.userId!);
  if (!u) throw HttpError.unauthorized();
  const t = await createTicket({
    subject: b.subject,
    message: b.message,
    category: b.category,
    requesterId: u.id,
    requesterName: `${u.firstName} ${u.lastName}`.trim(),
    requesterEmail: u.email,
    source: 'user',
  });
  const [v] = await ticketViews([t], { internal: false });
  res.status(201).json({ data: v });
});

ticketsRouter.get('/support/tickets', requireAuth, async (req, res) => {
  const { page, limit } = pageQ.parse(req.query);
  const where = { requesterId: req.userId! };
  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({ where, orderBy: [{ lastActivityAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.supportTicket.count({ where }),
  ]);
  res.json({ data: await ticketViews(rows, { internal: false }), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

ticketsRouter.get('/support/tickets/:id', requireAuth, async (req, res) => {
  const t = await mine(req.userId!, String(req.params.id));
  const [v] = await ticketViews([t], { internal: false });
  res.json({ data: { ...v!, messages: await listMessages(t.id, false) } });
});

ticketsRouter.post('/support/tickets/:id/reply', requireAuth, async (req, res) => {
  const t = await mine(req.userId!, String(req.params.id));
  if (t.status === 'closed') throw HttpError.conflict('Yêu cầu đã đóng');
  const { body } = myTicketReplyBody.parse(req.body);
  await addMessage(
    t.id,
    { kind: 'customer', authorId: t.requesterId, authorName: t.requesterName, body },
    t.status === 'awaiting_reply' || t.status === 'resolved' ? { status: 'open', resolvedAt: null } : {},
  );
  const fresh = await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
  const [v] = await ticketViews([fresh], { internal: false });
  res.json({ data: { ...v!, messages: await listMessages(t.id, false) } });
});
