import { prisma } from '../../db/prisma.js';
import type { Prisma, SupportCategory, SupportMessageKind, SupportPriority, SupportTicketStatus } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';

/** Lõi ticket hỗ trợ dùng chung cho cả form liên hệ, người dùng và admin. Không chứa phân quyền. */
export const TICKET_BASE = 2000;
export const ticketCode = (number: number) => `T-${TICKET_BASE + number}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `:id` nhận uuid hoặc mã `T-2048`. */
export function ticketWhere(ref: string): Prisma.SupportTicketWhereUniqueInput {
  if (UUID_RE.test(ref)) return { id: ref };
  const m = /^T-(\d{1,9})$/i.exec(ref.trim());
  if (m) return { number: Number(m[1]) - TICKET_BASE };
  throw HttpError.notFound('Không tìm thấy ticket');
}

export async function findTicketOrThrow(ref: string) {
  const t = await prisma.supportTicket.findUnique({ where: ticketWhere(ref) });
  if (!t) throw HttpError.notFound('Không tìm thấy ticket');
  return t;
}

export const OPEN_STATUSES: SupportTicketStatus[] = ['new', 'open', 'awaiting_reply'];

const brief = (u: { id: string; firstName: string; lastName: string; email?: string; avatarUrl: string | null }) => ({
  id: u.id,
  name: `${u.firstName} ${u.lastName}`.trim(),
  email: u.email ?? null,
  avatarUrl: u.avatarUrl,
});

type TicketRow = Prisma.SupportTicketGetPayload<object>;

/** Dựng view cho nhiều ticket cùng lúc (1 truy vấn người dùng + 1 truy vấn tin nhắn cuối). */
export async function ticketViews(rows: TicketRow[], opts: { internal: boolean }) {
  if (!rows.length) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.requesterId, r.assigneeId]).filter((x): x is string => !!x))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const kinds: SupportMessageKind[] = opts.internal ? ['customer', 'staff', 'internal_note', 'system'] : ['customer', 'staff'];
  const ticketIds = rows.map((r) => r.id);
  const [counts, lasts] = await Promise.all([
    prisma.supportTicketMessage.groupBy({ by: ['ticketId'], where: { ticketId: { in: ticketIds }, kind: { in: kinds } }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ ticketId: string; body: string }>>`
      SELECT DISTINCT ON ("ticketId") "ticketId", body FROM "SupportTicketMessage"
      WHERE "ticketId" = ANY(${ticketIds}::text[]) AND kind::text = ANY(${kinds}::text[]) ORDER BY "ticketId", "createdAt" DESC, id DESC`,
  ]);
  const cnt = new Map(counts.map((c) => [c.ticketId, c._count._all]));
  const last = new Map(lasts.map((l) => [l.ticketId, l.body]));
  return rows.map((t) => {
    const req = t.requesterId ? byId.get(t.requesterId) : undefined;
    const asg = t.assigneeId ? byId.get(t.assigneeId) : undefined;
    const preview = (last.get(t.id) ?? '').replace(/\s+/g, ' ').trim();
    const base = {
      id: t.id,
      code: ticketCode(t.number),
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      requester: req ? { ...brief(req), name: brief(req).name } : { id: null, name: t.requesterName, email: t.requesterEmail, avatarUrl: null },
      messageCount: cnt.get(t.id) ?? 0,
      lastMessagePreview: preview.length > 120 ? `${preview.slice(0, 119)}…` : preview,
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.lastActivityAt.toISOString(),
    };
    if (!opts.internal) return base;
    return {
      ...base,
      assignee: asg ? { id: asg.id, name: brief(asg).name } : null,
      escalated: t.escalated,
      source: t.source,
      firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    };
  });
}

export const messageView = (m: { id: string; kind: string; authorId: string | null; authorName: string; body: string; createdAt: Date }) => ({
  id: m.id,
  kind: m.kind,
  author: { id: m.authorId, name: m.authorName },
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

export async function listMessages(ticketId: string, internal: boolean) {
  const rows = await prisma.supportTicketMessage.findMany({
    where: { ticketId, ...(internal ? {} : { kind: { in: ['customer', 'staff'] } }) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(messageView);
}

export interface NewTicket {
  subject: string;
  message: string;
  category: SupportCategory;
  priority?: SupportPriority;
  requesterId?: string | null;
  requesterName: string;
  requesterEmail: string;
  source: 'contact_form' | 'user' | 'admin' | 'seed';
  /** Người viết tin đầu (mặc định là khách). */
  authorId?: string | null;
}

export async function createTicket(input: NewTicket) {
  return prisma.supportTicket.create({
    data: {
      subject: input.subject,
      category: input.category,
      priority: input.priority ?? 'medium',
      requesterId: input.requesterId ?? null,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail.toLowerCase(),
      source: input.source,
      messages: { create: { kind: 'customer', authorId: input.requesterId ?? null, authorName: input.requesterName, body: input.message } },
    },
  });
}

export async function addMessage(
  ticketId: string,
  m: { kind: SupportMessageKind; authorId: string | null; authorName: string; body: string },
  ticketPatch: Prisma.SupportTicketUpdateInput = {},
) {
  const [, t] = await prisma.$transaction([
    prisma.supportTicketMessage.create({ data: { ticketId, ...m } }),
    prisma.supportTicket.update({ where: { id: ticketId }, data: { lastActivityAt: new Date(), ...ticketPatch } }),
  ]);
  return t;
}
