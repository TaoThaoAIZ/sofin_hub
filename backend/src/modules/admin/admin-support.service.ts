import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { Prisma, SupportCategory, SupportPriority, SupportTicketStatus } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { userRepository } from '../auth/auth.repository.js';
import { userBriefView } from '../auth/user-view.js';
import { mailService } from '../mail/mail.service.js';
import { notify } from '../notifications/notifications.service.js';
import { addMessage, createTicket, findTicketOrThrow, listMessages, OPEN_STATUSES, TICKET_BASE, ticketCode, ticketViews } from '../support/tickets.core.js';
import { auditService, toAuditItem } from './admin-audit.service.js';
import { DAY, excerpt, startOfUtcDay } from './admin-b2.common.js';
import { enumList, noteField, pageMeta, pageQuery, reasonField } from './admin.common.js';
import { hasPermission, staffWithPermission } from './admin-staff.service.js';

const CATEGORIES = ['user', 'creator', 'payment'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const STATUSES = ['new', 'open', 'awaiting_reply', 'resolved', 'closed'] as const;

const bodyField = z.string().trim().min(1, 'Vui lòng nhập nội dung').max(5000, 'Nội dung tối đa 5000 ký tự');
export const ticketsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignee: z.string().max(100).optional(),
  escalated: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'oldest', 'updated', 'priority']).default('updated'),
});
export const createTicketBody = z.object({
  subject: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200),
  message: bodyField,
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES).default('medium'),
  requesterEmail: z.string().trim().toLowerCase().email('Email không hợp lệ').max(180),
  requesterName: z.string().trim().min(1).max(120).optional(),
});
export const patchTicketBody = z
  .object({ priority: z.enum(PRIORITIES).optional(), category: z.enum(CATEGORIES).optional(), subject: z.string().trim().min(1).max(200).optional() })
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const assignTicketBody = z.object({ assigneeId: z.union([z.string().min(1).max(100), z.null()]) });
export const replyBody = z.object({ body: bodyField, status: z.enum(['awaiting_reply', 'resolved', 'open']).optional() });
export const ticketNoteBody = z.object({ body: z.string().trim().min(1, 'Vui lòng nhập ghi chú').max(2000) });
export const escalateBody = z.object({ reason: reasonField, priority: z.enum(PRIORITIES).default('urgent') });
export const transitionBody = z.object({ note: noteField });

const label = (t: { number: number; subject: string }) => `${ticketCode(t.number)} · ${excerpt(t.subject, 80)}`;

export const adminSupportService = {
  async summary() {
    const today = startOfUtcDay();
    const now = new Date();
    const w1 = new Date(now.getTime() - 7 * DAY);
    const w2 = new Date(now.getTime() - 14 * DAY);
    const [open, newToday, unassigned, escalated, cats, resolved7, resolvedPrev] = await Promise.all([
      prisma.supportTicket.count({ where: { status: { in: OPEN_STATUSES } } }),
      prisma.supportTicket.count({ where: { createdAt: { gte: today } } }),
      prisma.supportTicket.count({ where: { status: { in: OPEN_STATUSES }, assigneeId: null } }),
      prisma.supportTicket.count({ where: { status: { in: OPEN_STATUSES }, escalated: true } }),
      prisma.supportTicket.groupBy({ by: ['category'], where: { status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
      prisma.supportTicket.count({ where: { resolvedAt: { gte: w1 } } }),
      prisma.supportTicket.count({ where: { resolvedAt: { gte: w2, lt: w1 } } }),
    ]);
    const frt = async (a: Date, b: Date) => {
      const r = await prisma.$queryRaw<Array<{ m: number | null }>>`
        SELECT avg(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 60)::float AS m FROM "SupportTicket" WHERE "firstResponseAt" >= ${a} AND "firstResponseAt" < ${b}`;
      return r[0]?.m == null ? null : Math.round(r[0].m);
    };
    const [f1, f0] = await Promise.all([frt(w1, new Date(now.getTime() + 1000)), frt(w2, w1)]);
    const pct = (v: number | null, p: number | null) => (v === null || !p ? null : Math.round(((v - p) / p) * 1000) / 10);
    const byCategory = { user: 0, creator: 0, payment: 0 };
    for (const c of cats) byCategory[c.category] = c._count._all;
    return {
      open,
      newToday,
      unassigned,
      escalated,
      avgFirstResponseMin: f1,
      avgFirstResponseMinChangePct: pct(f1, f0),
      resolved7d: resolved7,
      resolved7dChangePct: pct(resolved7, resolvedPrev),
      byCategory,
    };
  },

  assignees: () => staffWithPermission('support.manage'),

  async list(actorId: string, q: z.infer<typeof ticketsQuery>) {
    const categories = enumList(q.category, CATEGORIES, 'category') as SupportCategory[];
    const statuses = enumList(q.status, STATUSES, 'status') as SupportTicketStatus[];
    const priorities = enumList(q.priority, PRIORITIES, 'priority') as SupportPriority[];
    const and: Prisma.SupportTicketWhereInput[] = [];
    if (categories.length) and.push({ category: { in: categories } });
    if (statuses.length) and.push({ status: { in: statuses } });
    if (priorities.length) and.push({ priority: { in: priorities } });
    if (q.assignee === 'unassigned') and.push({ assigneeId: null });
    else if (q.assignee) and.push({ assigneeId: q.assignee === 'me' ? actorId : q.assignee });
    if (q.escalated) and.push({ escalated: q.escalated === 'true' });
    if (q.q) {
      const code = /^T-(\d{1,9})$/i.exec(q.q);
      and.push({
        OR: [
          { subject: { contains: q.q, mode: 'insensitive' } },
          { requesterName: { contains: q.q, mode: 'insensitive' } },
          { requesterEmail: { contains: q.q, mode: 'insensitive' } },
          ...(code ? [{ number: Number(code[1]) - TICKET_BASE }] : []),
        ],
      });
    }
    const where: Prisma.SupportTicketWhereInput = and.length ? { AND: and } : {};
    const orderBy: Prisma.SupportTicketOrderByWithRelationInput[] =
      q.sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : q.sort === 'oldest'
          ? [{ createdAt: 'asc' }]
          : q.sort === 'priority'
            ? [{ priority: 'desc' }, { lastActivityAt: 'desc' }]
            : [{ lastActivityAt: 'desc' }];
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({ where, orderBy: [...orderBy, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }),
      prisma.supportTicket.count({ where }),
    ]);
    return { data: await ticketViews(rows, { internal: true }), meta: pageMeta(q.page, q.limit, total) };
  },

  async view(ref: string) {
    const t = await findTicketOrThrow(ref);
    const [view] = await ticketViews([t], { internal: true });
    const [messages, history] = await Promise.all([
      listMessages(t.id, true),
      prisma.adminAuditLog.findMany({
        where: { targetType: 'ticket', targetId: t.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
    ]);
    return { ...view!, messages, history: history.map((h) => toAuditItem(h)), related: { userId: t.requesterId } };
  },

  async create(actorId: string, b: z.infer<typeof createTicketBody>) {
    const user = await userRepository.findByEmail(b.requesterEmail);
    const t = await createTicket({
      subject: b.subject,
      message: b.message,
      category: b.category,
      priority: b.priority,
      requesterId: user?.id ?? null,
      requesterName: b.requesterName ?? (user ? `${user.firstName} ${user.lastName}`.trim() : b.requesterEmail),
      requesterEmail: b.requesterEmail,
      source: 'admin',
    });
    await auditService.record(actorId, { action: 'support.ticket.create', targetType: 'ticket', targetId: t.id, targetLabel: label(t) });
    return this.view(t.id);
  },

  async update(actorId: string, ref: string, b: z.infer<typeof patchTicketBody>) {
    const t = await findTicketOrThrow(ref);
    await prisma.supportTicket.update({ where: { id: t.id }, data: { ...b, lastActivityAt: new Date() } });
    await auditService.record(actorId, { action: 'support.ticket.update', targetType: 'ticket', targetId: t.id, targetLabel: label(t), metadata: { changes: b } });
    return this.view(t.id);
  },

  async assign(actorId: string, ref: string, b: z.infer<typeof assignTicketBody>) {
    const t = await findTicketOrThrow(ref);
    if (t.status === 'closed') throw HttpError.conflict('Ticket đã đóng');
    const assigneeId = b.assigneeId === 'me' ? actorId : b.assigneeId;
    let assigneeName: string | null = null;
    if (assigneeId) {
      if (!(await hasPermission(assigneeId, 'support.manage'))) throw HttpError.badRequest('Người nhận phải là nhân viên có quyền xử lý hỗ trợ');
      assigneeName = (await userBriefView(assigneeId)).name;
    }
    await addMessage(
      t.id,
      { kind: 'system', authorId: actorId, authorName: (await userBriefView(actorId)).name, body: assigneeId ? `Đã giao cho ${assigneeName}` : 'Đã bỏ giao việc' },
      { assignee: assigneeId ? { connect: { id: assigneeId } } : { disconnect: true }, ...(t.status === 'new' && assigneeId ? { status: 'open' as const } : {}) },
    );
    await auditService.record(actorId, { action: 'support.ticket.assign', targetType: 'ticket', targetId: t.id, targetLabel: label(t), metadata: { assigneeId, assigneeName } });
    return this.view(t.id);
  },

  async reply(actorId: string, ref: string, b: z.infer<typeof replyBody>) {
    const t = await findTicketOrThrow(ref);
    if (t.status === 'closed') throw HttpError.conflict('Ticket đã đóng, hãy mở lại trước khi trả lời');
    const actor = await userBriefView(actorId);
    const status = b.status ?? 'awaiting_reply';
    const now = new Date();
    await addMessage(
      t.id,
      { kind: 'staff', authorId: actorId, authorName: actor.name, body: b.body },
      {
        status,
        ...(t.firstResponseAt ? {} : { firstResponseAt: now }),
        resolvedAt: status === 'resolved' ? now : null,
        ...(t.assigneeId ? {} : { assignee: { connect: { id: actorId } } }),
      },
    );
    const code = ticketCode(t.number);
    await mailService.send({
      to: t.requesterEmail,
      subject: `Re: [${code}] ${t.subject}`,
      text: `${b.body}\n\n— ${actor.name}, SofinHub Support\nMã ticket: ${code}`,
    });
    if (t.requesterId) {
      notify({ userId: t.requesterId, type: 'system', title: `Phản hồi cho yêu cầu ${code}`, body: excerpt(b.body, 140) });
    }
    await auditService.record(actorId, { action: 'support.ticket.reply', targetType: 'ticket', targetId: t.id, targetLabel: label(t), metadata: { status } });
    return this.view(t.id);
  },

  async note(actorId: string, ref: string, b: z.infer<typeof ticketNoteBody>) {
    const t = await findTicketOrThrow(ref);
    await addMessage(t.id, { kind: 'internal_note', authorId: actorId, authorName: (await userBriefView(actorId)).name, body: b.body });
    await auditService.record(actorId, { action: 'support.ticket.note', targetType: 'ticket', targetId: t.id, targetLabel: label(t) });
    return this.view(t.id);
  },

  async escalate(actorId: string, ref: string, b: z.infer<typeof escalateBody>) {
    const t = await findTicketOrThrow(ref);
    if (t.status === 'resolved' || t.status === 'closed') throw HttpError.conflict('Không thể escalate ticket đã giải quyết/đóng');
    if (t.escalated) throw HttpError.conflict('Ticket đã được escalate');
    await addMessage(
      t.id,
      { kind: 'system', authorId: actorId, authorName: (await userBriefView(actorId)).name, body: `Escalated (${b.priority}): ${b.reason}` },
      { escalated: true, escalatedAt: new Date(), priority: b.priority, ...(t.status === 'new' ? { status: 'open' as const } : {}) },
    );
    await auditService.record(actorId, { action: 'support.ticket.escalate', targetType: 'ticket', targetId: t.id, targetLabel: label(t), reason: b.reason, metadata: { priority: b.priority } });
    return this.view(t.id);
  },

  async transition(actorId: string, ref: string, to: 'resolved' | 'closed' | 'open', b: z.infer<typeof transitionBody>) {
    const t = await findTicketOrThrow(ref);
    const allowed: Record<typeof to, SupportTicketStatus[]> = {
      resolved: ['new', 'open', 'awaiting_reply'],
      closed: ['new', 'open', 'awaiting_reply', 'resolved'],
      open: ['resolved', 'closed'],
    };
    if (!allowed[to].includes(t.status)) {
      throw HttpError.conflict(to === 'open' ? 'Ticket đang mở' : t.status === 'closed' ? 'Ticket đã đóng' : 'Ticket đã được giải quyết');
    }
    const now = new Date();
    const verb = { resolved: 'giải quyết', closed: 'đóng', open: 'mở lại' }[to];
    await addMessage(
      t.id,
      { kind: 'system', authorId: actorId, authorName: (await userBriefView(actorId)).name, body: `Đã ${verb} ticket${b.note ? `: ${b.note}` : ''}` },
      to === 'resolved'
        ? { status: 'resolved', resolvedAt: now }
        : to === 'closed'
          ? { status: 'closed', closedAt: now, resolvedAt: t.resolvedAt ?? now }
          : { status: 'open', resolvedAt: null, closedAt: null },
    );
    await auditService.record(actorId, {
      action: `support.ticket.${to === 'open' ? 'reopen' : to === 'closed' ? 'close' : 'resolve'}`,
      targetType: 'ticket',
      targetId: t.id,
      targetLabel: label(t),
      note: b.note ?? null,
    });
    return this.view(t.id);
  },
};
