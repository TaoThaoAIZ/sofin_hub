import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { revokeSession } from '../auth/tokens.js';
import { RESTRICTIONS } from '../auth/user-status.js';
import { notify } from '../notifications/notifications.service.js';
import { isPlatformAdmin, isStaff } from '../permissions/policy.js';
import { auditService } from './admin-audit.service.js';
import { caseInclude, toCaseViews } from './admin-cases.view.js';
import { bumpTokenVersionAndRevoke } from './admin-sessions.js';
import {
  durationFields,
  enumList,
  iso,
  likeEscape,
  noteField,
  pageMeta,
  pageQuery,
  reasonField,
  resolveUntil,
  type PageQuery,
} from './admin.common.js';

const USER_STATUSES = ['active', 'restricted', 'suspended', 'banned'] as const;
type UserStatus = (typeof USER_STATUSES)[number];

/* -------------------------------------------------------------------------------- schemas */
export const listUsersQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  role: z.enum(['member', 'creator']).optional(),
  plan: z.enum(['free', 'paid']).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'revenue', 'reports']).default('newest'),
});
export type ListUsersQuery = z.infer<typeof listUsersQuery>;

export const restrictBody = z.object({
  reason: reasonField,
  restrictions: z.array(z.enum(RESTRICTIONS)).min(1).optional(),
  ...durationFields,
  note: noteField,
});
export const suspendBody = z.object({ reason: reasonField, ...durationFields, note: noteField, notify: z.boolean().optional() });
export const banBody = z.object({ reason: reasonField, evidence: z.string().trim().max(2000).optional(), note: noteField });
export const reinstateBody = z.object({ note: noteField });
export const warnBody = z.object({ reason: reasonField, message: z.string().trim().min(1, 'Vui lòng nhập nội dung cảnh cáo').max(2000) });
export const activityQuery = pageQuery.extend({ type: z.enum(['login', 'community', 'content', 'payment', 'moderation']).optional() });

/* -------------------------------------------------------------------------------- list rows */
interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  statusReason: string | null;
  statusUntil: Date | null;
  statusRestrictions: string[];
  statusChangedAt: Date | null;
  changedById: string | null;
  changedByName: string | null;
  createdAt: Date;
  communities: number;
  creator: boolean;
  paid: boolean;
  revenue: number;
  reports: number;
  lastActiveAt: Date | null;
}

const SELECT = Prisma.sql`
  SELECT u."id", u."firstName", u."lastName", u."email", u."avatarUrl", u."status", u."statusReason", u."statusUntil",
    u."statusRestrictions", u."statusChangedAt", u."createdAt",
    cb."id" AS "changedById", NULLIF(TRIM(cb."firstName" || ' ' || cb."lastName"), '') AS "changedByName",
    (SELECT COUNT(*) FROM "Enrollment" e WHERE e."userId" = u."id")::int AS "communities",
    EXISTS (SELECT 1 FROM "Course" c WHERE c."ownerId" = u."id" AND c."deletedAt" IS NULL) AS "creator",
    EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = u."id" AND s."status" = 'active') AS "paid",
    (SELECT COALESCE(SUM(p."amountCents" - p."refundedCents"), 0) FROM "Payment" p WHERE p."userId" = u."id" AND p."status" IN ('succeeded', 'refunded'))::int AS "revenue",
    (SELECT COUNT(*) FROM "Report" r WHERE r."targetUserId" = u."id")::int AS "reports",
    (SELECT MAX(se."lastUsedAt") FROM "Session" se WHERE se."userId" = u."id") AS "lastActiveAt"
  FROM "User" u
  LEFT JOIN "User" cb ON cb."id" = u."statusChangedById"`;

const toUserItem = (r: UserRow) => ({
  id: r.id,
  name: `${r.firstName} ${r.lastName}`.trim(),
  firstName: r.firstName,
  lastName: r.lastName,
  email: r.email,
  avatarUrl: r.avatarUrl,
  status: r.status,
  statusReason: r.statusReason,
  statusUntil: iso(r.statusUntil),
  restrictions: r.status === 'restricted' ? r.statusRestrictions : [],
  statusChangedAt: iso(r.statusChangedAt),
  statusChangedBy: r.changedById ? { id: r.changedById, name: r.changedByName ?? '' } : null,
  role: r.creator ? ('creator' as const) : ('member' as const),
  communities: r.communities,
  plan: r.paid ? ('paid' as const) : ('free' as const),
  revenueCents: r.revenue,
  reports: r.reports,
  joinedAt: r.createdAt.toISOString(),
  lastActiveAt: iso(r.lastActiveAt),
});
export type AdminUserItem = ReturnType<typeof toUserItem>;

const REAL = Prisma.sql`u."isDemo" = false AND u."deletedAt" IS NULL`;
const CREATOR = Prisma.sql`EXISTS (SELECT 1 FROM "Course" c WHERE c."ownerId" = u."id" AND c."deletedAt" IS NULL)`;
const PAID = Prisma.sql`EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = u."id" AND s."status" = 'active')`;
const ORDER: Record<ListUsersQuery['sort'], Prisma.Sql> = {
  newest: Prisma.sql`u."createdAt" DESC, u."id"`,
  oldest: Prisma.sql`u."createdAt" ASC, u."id"`,
  name: Prisma.sql`LOWER(u."firstName" || ' ' || u."lastName") ASC, u."id"`,
  revenue: Prisma.sql`"revenue" DESC, u."createdAt" DESC`,
  reports: Prisma.sql`"reports" DESC, u."createdAt" DESC`,
};

async function getItem(id: string): Promise<AdminUserItem> {
  const rows = await prisma.$queryRaw<UserRow[]>(Prisma.sql`${SELECT} WHERE u."id" = ${id} AND u."deletedAt" IS NULL`);
  if (!rows[0]) throw HttpError.notFound('Không tìm thấy người dùng');
  return toUserItem(rows[0]);
}

const personName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

/* -------------------------------------------------------------------------------- actions */
export interface ActionCtx {
  /** Ghi đè tên action audit (vd. `case.suspend_user`) + gắn case. */
  auditAction?: string;
  caseId?: string;
}

async function loadTarget(actorId: string, userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.deletedAt) throw HttpError.notFound('Không tìm thấy người dùng');
  if (u.id === actorId) throw HttpError.forbidden('Bạn không thể tự áp dụng hình phạt lên chính mình');
  if (u.isDemo) throw HttpError.badRequest('Không thể tác động lên thành viên minh họa');
  if (await isStaff(u.id)) throw HttpError.forbidden('Không thể tác động lên tài khoản admin (quản lý ở System > Admin Accounts)');
  return u;
}

interface StatusChange {
  to: UserStatus;
  reason: string | null;
  until: Date | null;
  restrictions: string[];
}

async function applyStatus(
  actorId: string,
  user: { id: string; status: UserStatus; firstName: string; lastName: string },
  change: StatusChange,
  audit: { action: string; note?: string | null; evidence?: string | null; ctx?: ActionCtx },
) {
  const from = user.status;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: change.to,
      statusReason: change.reason,
      statusUntil: change.until,
      statusRestrictions: change.restrictions,
      statusChangedAt: new Date(),
      statusChangedById: actorId,
    },
  });
  // Đình chỉ/cấm: mọi access + refresh token đang có chết ngay (cơ chế sid/tv sẵn có).
  if (change.to === 'suspended' || change.to === 'banned') await bumpTokenVersionAndRevoke(user.id);
  await auditService.record(actorId, {
    action: audit.ctx?.auditAction ?? audit.action,
    targetType: 'user',
    targetId: user.id,
    targetLabel: personName(user),
    reason: change.reason,
    note: audit.note,
    evidence: audit.evidence,
    caseId: audit.ctx?.caseId,
    metadata: { from, to: change.to, until: iso(change.until), restrictions: change.restrictions },
  });
}

const untilText = (d: Date | null) => (d ? ` đến ${d.toISOString().slice(0, 10)}` : ' vô thời hạn');

export const adminUsersService = {
  getItem,

  async summary() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const real = { isDemo: false, deletedAt: null };
    const [total, groups, new30d, paid] = await Promise.all([
      prisma.user.count({ where: real }),
      prisma.user.groupBy({ by: ['status'], where: real, _count: { _all: true } }),
      prisma.user.count({ where: { ...real, createdAt: { gte: since } } }),
      prisma.subscription.findMany({ where: { status: 'active', user: real }, distinct: ['userId'], select: { userId: true } }),
    ]);
    const by = (s: UserStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
    return { total, active: by('active'), new30d, paid: paid.length, restricted: by('restricted'), suspended: by('suspended'), banned: by('banned') };
  },

  async list(q: ListUsersQuery) {
    const statuses = enumList(q.status, USER_STATUSES, 'status');
    const conds: Prisma.Sql[] = [REAL];
    if (statuses.length) conds.push(Prisma.sql`u."status"::text = ANY(${statuses})`);
    if (q.role === 'creator') conds.push(CREATOR);
    if (q.role === 'member') conds.push(Prisma.sql`NOT ${CREATOR}`);
    if (q.plan === 'paid') conds.push(PAID);
    if (q.plan === 'free') conds.push(Prisma.sql`NOT ${PAID}`);
    if (q.q) {
      const like = `%${likeEscape(q.q)}%`;
      conds.push(Prisma.sql`((u."firstName" || ' ' || u."lastName") ILIKE ${like} OR u."email" ILIKE ${like} OR u."id" = ${q.q})`);
    }
    const where = Prisma.join(conds, ' AND ');
    const [rows, count] = await Promise.all([
      prisma.$queryRaw<UserRow[]>(Prisma.sql`${SELECT} WHERE ${where} ORDER BY ${ORDER[q.sort]} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`),
      prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS n FROM "User" u WHERE ${where}`),
    ]);
    return { data: rows.map(toUserItem), meta: pageMeta(q.page, q.limit, count[0]?.n ?? 0) };
  },

  async detail(id: string) {
    const item = await getItem(id);
    const u = await prisma.user.findUniqueOrThrow({ where: { id } });
    const now = new Date();
    const paidStatuses = ['succeeded', 'refunded'] as ('succeeded' | 'refunded')[];
    const [owned, posts, comments, purchases, spend, activeSubs, received, confirmed, warnings, suspensions, sessions, recent] = await Promise.all([
      prisma.community.count({ where: { ownerId: id, deletedAt: null } }),
      prisma.post.count({ where: { authorId: id } }),
      prisma.postComment.count({ where: { authorId: id } }),
      prisma.payment.count({ where: { userId: id, status: { in: paidStatuses } } }),
      prisma.payment.aggregate({ where: { userId: id, status: { in: paidStatuses } }, _sum: { amountCents: true, refundedCents: true } }),
      prisma.subscription.count({ where: { userId: id, status: 'active' } }),
      prisma.report.count({ where: { targetUserId: id } }),
      prisma.report.count({ where: { targetUserId: id, status: 'resolved', NOT: { action: { in: ['none', 'dismiss'] } } } }),
      prisma.adminAuditLog.count({ where: { targetType: 'user', targetId: id, action: { in: ['user.warn', 'case.warn'] } } }),
      prisma.adminAuditLog.count({ where: { targetType: 'user', targetId: id, action: { in: ['user.suspend', 'case.suspend_user'] } } }),
      prisma.session.findMany({ where: { userId: id, revokedAt: null, expiresAt: { gt: now } }, orderBy: { lastUsedAt: 'desc' }, take: 20 }),
      this.activity(id, { page: 1, limit: 5 }),
    ]);
    return {
      ...item,
      bio: u.bio,
      location: u.location,
      website: u.website,
      emailVerified: u.emailVerified,
      lastLoginAt: iso(u.lastLoginAt),
      isPlatformAdmin: await isPlatformAdmin(id),
      stats: {
        communities: item.communities,
        owned,
        posts,
        comments,
        purchases,
        lifetimeSpendCents: (spend._sum.amountCents ?? 0) - (spend._sum.refundedCents ?? 0),
        activeSubscriptions: activeSubs,
        refundsCents: spend._sum.refundedCents ?? 0,
        reportsReceived: received,
        confirmedViolations: confirmed,
        warnings,
        suspensions,
      },
      recentActivity: recent.data,
      security: {
        emailVerified: u.emailVerified,
        activeSessions: sessions.map((s) => ({
          id: s.id,
          device: s.userAgent ?? 'Thiết bị không xác định',
          ip: s.ip,
          createdAt: s.createdAt.toISOString(),
          lastUsedAt: s.lastUsedAt.toISOString(),
        })),
      },
    };
  },

  async communities(id: string, q: PageQuery) {
    await getItem(id);
    const where = { userId: id };
    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        orderBy: { enrolledAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { community: { select: { id: true, title: true, priceCents: true, pricing: true, moderationStatus: true, locked: true, deletedAt: true } } },
      }),
      prisma.enrollment.count({ where }),
    ]);
    return {
      data: rows.map((e) => ({
        id: e.community.id,
        name: e.community.title,
        role: e.role,
        membership: e.community.pricing === 'free' ? ('free' as const) : ('paid' as const),
        priceUsd: e.community.priceCents / 100,
        joinedAt: e.enrolledAt.toISOString(),
        lastActiveAt: e.lastActiveAt.toISOString(),
        status: e.community.deletedAt ? 'deleted' : e.community.moderationStatus === 'active' && e.community.locked ? 'suspended' : e.community.moderationStatus,
      })),
      meta: pageMeta(q.page, q.limit, total),
    };
  },

  async activity(id: string, q: PageQuery & { type?: string }) {
    const take = 60;
    const want = (t: string) => !q.type || q.type === t;
    interface Item {
      type: string;
      icon: string;
      title: string;
      detail: string;
      createdAt: Date;
    }
    const items: Item[] = [];
    await Promise.all([
      want('login') &&
        prisma.session.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take }).then((rows) =>
          rows.forEach((s) => items.push({ type: 'login', icon: 'login', title: 'Đăng nhập', detail: [s.userAgent, s.ip].filter(Boolean).join(' · '), createdAt: s.createdAt })),
        ),
      want('content') &&
        prisma.post.findMany({ where: { authorId: id }, orderBy: { createdAt: 'desc' }, take, include: { community: { select: { title: true } } } }).then((rows) =>
          rows.forEach((p) => items.push({ type: 'content', icon: 'article', title: `Đăng bài trong ${p.community.title}`, detail: p.content.slice(0, 120), createdAt: p.createdAt })),
        ),
      want('content') &&
        prisma.postComment.findMany({ where: { authorId: id }, orderBy: { createdAt: 'desc' }, take }).then((rows) =>
          rows.forEach((c) => items.push({ type: 'content', icon: 'chat', title: 'Bình luận', detail: c.content.slice(0, 120), createdAt: c.createdAt })),
        ),
      want('community') &&
        prisma.enrollment.findMany({ where: { userId: id }, orderBy: { enrolledAt: 'desc' }, take, include: { community: { select: { title: true } } } }).then((rows) =>
          rows.forEach((e) => items.push({ type: 'community', icon: 'group_add', title: `Tham gia ${e.community.title}`, detail: `Vai trò: ${e.role}`, createdAt: e.enrolledAt })),
        ),
      want('payment') &&
        prisma.payment
          .findMany({ where: { userId: id, status: { in: ['succeeded', 'refunded'] } }, orderBy: { createdAt: 'desc' }, take, include: { community: { select: { title: true } } } })
          .then((rows) =>
            rows.forEach((p) =>
              items.push({
                type: 'payment',
                icon: 'workspace_premium',
                title: `${p.status === 'refunded' ? 'Đã hoàn tiền' : 'Thanh toán'} ${p.community.title}`,
                detail: `$${(p.amountCents / 100).toFixed(2)}`,
                createdAt: p.confirmedAt ?? p.createdAt,
              }),
            ),
          ),
      want('moderation') &&
        prisma.report.findMany({ where: { OR: [{ reporterId: id }, { targetUserId: id }] }, orderBy: { createdAt: 'desc' }, take }).then((rows) =>
          rows.forEach((r) =>
            items.push({
              type: 'moderation',
              icon: 'flag',
              title: r.reporterId === id ? 'Đã báo cáo một nội dung' : 'Bị báo cáo',
              detail: `${r.reason}${r.action ? ` · ${r.action}` : ''}`,
              createdAt: r.createdAt,
            }),
          ),
        ),
      want('moderation') &&
        prisma.adminAuditLog.findMany({ where: { targetType: 'user', targetId: id }, orderBy: { createdAt: 'desc' }, take }).then((rows) =>
          rows.forEach((a) => items.push({ type: 'moderation', icon: 'gavel', title: a.action, detail: a.reason ?? '', createdAt: a.createdAt })),
        ),
    ]);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const page = items.slice((q.page - 1) * q.limit, q.page * q.limit);
    return { data: page.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })), meta: pageMeta(q.page, q.limit, items.length) };
  },

  async purchases(id: string, q: PageQuery) {
    await getItem(id);
    const where = { userId: id };
    const [rows, total, spend, subs] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { community: { select: { id: true, title: true } } } }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({ where: { userId: id, status: { in: ['succeeded', 'refunded'] } }, _sum: { amountCents: true, refundedCents: true } }),
      prisma.subscription.count({ where: { userId: id, status: 'active' } }),
    ]);
    return {
      data: rows.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        communityId: p.community.id,
        courseName: p.community.title,
        amountCents: p.amountCents,
        refundedCents: p.refundedCents,
        status: p.status,
        method: p.method,
        createdAt: p.createdAt.toISOString(),
      })),
      meta: pageMeta(q.page, q.limit, total),
      summary: {
        lifetimeSpendCents: (spend._sum.amountCents ?? 0) - (spend._sum.refundedCents ?? 0),
        activeSubscriptions: subs,
        refundsCents: spend._sum.refundedCents ?? 0,
      },
    };
  },

  async reports(id: string, q: PageQuery) {
    await getItem(id);
    const where = { targetUserId: id };
    const [rows, total, confirmed, warnings, suspensions] = await Promise.all([
      prisma.report.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: caseInclude }),
      prisma.report.count({ where }),
      prisma.report.count({ where: { ...where, status: 'resolved', NOT: { action: { in: ['none', 'dismiss'] } } } }),
      prisma.adminAuditLog.count({ where: { targetType: 'user', targetId: id, action: { in: ['user.warn', 'case.warn'] } } }),
      prisma.adminAuditLog.count({ where: { targetType: 'user', targetId: id, action: { in: ['user.suspend', 'case.suspend_user'] } } }),
    ]);
    return { data: await toCaseViews(rows), meta: { ...pageMeta(q.page, q.limit, total), summary: { received: total, confirmed, warnings, suspensions } } };
  },

  async revokeSession(actorId: string, id: string, sid: string) {
    const u = await getItem(id);
    if (!(await revokeSession(id, sid))) throw HttpError.notFound('Không tìm thấy phiên đăng nhập');
    await auditService.record(actorId, { action: 'user.revoke_session', targetType: 'user', targetId: id, targetLabel: u.name, metadata: { sid } });
    return { revoked: true };
  },

  /* ---- hành động ---- */
  async restrict(actorId: string, id: string, body: z.infer<typeof restrictBody>, ctx?: ActionCtx) {
    const user = await loadTarget(actorId, id);
    if (user.status !== 'active' && user.status !== 'restricted') throw HttpError.conflict('Hãy gỡ trạng thái hiện tại của tài khoản trước khi hạn chế');
    const until = resolveUntil(body);
    const restrictions = body.restrictions ?? ['post', 'comment', 'create_community'];
    await applyStatus(actorId, user, { to: 'restricted', reason: body.reason, until, restrictions }, { action: 'user.restrict', note: body.note, ctx });
    notify({
      userId: id,
      type: 'system',
      title: 'Tài khoản của bạn bị hạn chế',
      body: `Tài khoản bị hạn chế${untilText(until)}. Lý do: ${body.reason}`,
    });
    return getItem(id);
  },

  async suspend(actorId: string, id: string, body: z.infer<typeof suspendBody>, ctx?: ActionCtx) {
    const user = await loadTarget(actorId, id);
    if (user.status !== 'active' && user.status !== 'restricted') throw HttpError.conflict('Hãy gỡ trạng thái hiện tại của tài khoản trước khi đình chỉ');
    const until = resolveUntil(body);
    await applyStatus(actorId, user, { to: 'suspended', reason: body.reason, until, restrictions: [] }, { action: 'user.suspend', note: body.note, ctx });
    if (body.notify !== false) {
      notify({ userId: id, type: 'system', title: 'Tài khoản của bạn bị đình chỉ', body: `Tài khoản bị đình chỉ${untilText(until)}. Lý do: ${body.reason}` });
    }
    return getItem(id);
  },

  async ban(actorId: string, id: string, body: z.infer<typeof banBody>, ctx?: ActionCtx) {
    const user = await loadTarget(actorId, id);
    if (user.status === 'banned') throw HttpError.conflict('Tài khoản đã bị cấm');
    await applyStatus(actorId, user, { to: 'banned', reason: body.reason, until: null, restrictions: [] }, { action: 'user.ban', note: body.note, evidence: body.evidence, ctx });
    return getItem(id);
  },

  async reinstate(actorId: string, id: string, body: z.infer<typeof reinstateBody>) {
    const user = await loadTarget(actorId, id);
    if (user.status === 'active') throw HttpError.conflict('Tài khoản đang hoạt động bình thường');
    await applyStatus(actorId, user, { to: 'active', reason: null, until: null, restrictions: [] }, { action: 'user.reinstate', note: body.note });
    notify({ userId: id, type: 'system', title: 'Tài khoản đã được khôi phục', body: 'Tài khoản của bạn đã hoạt động trở lại bình thường.' });
    return getItem(id);
  },

  async warn(actorId: string, id: string, body: z.infer<typeof warnBody>, ctx?: ActionCtx) {
    const user = await loadTarget(actorId, id);
    notify({ userId: id, type: 'system', title: 'Cảnh cáo từ SofinHub', body: `${body.message} (Lý do: ${body.reason})` });
    await auditService.record(actorId, {
      action: ctx?.auditAction ?? 'user.warn',
      targetType: 'user',
      targetId: id,
      targetLabel: personName(user),
      reason: body.reason,
      evidence: body.message,
      caseId: ctx?.caseId,
    });
    return getItem(id);
  },
};
