import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { notify } from '../notifications/notifications.service.js';
import { paymentsService } from '../payments/payments.service.js';
import { auditService } from './admin-audit.service.js';
import { caseInclude, toCaseViews } from './admin-cases.view.js';
import { durationFields, shortNoteField, enumList, iso, likeEscape, noteField, pageMeta, pageQuery, reasonField, resolveUntil, type PageQuery } from './admin.common.js';

const STATUSES = ['pending_review', 'changes_requested', 'rejected', 'active', 'suspended', 'deleted'] as const;
type CommunityStatus = (typeof STATUSES)[number];
const RETENTION_DAYS = 30;
const DAY = 86_400_000;

/* -------------------------------------------------------------------------------- schemas */
export const listCommunitiesQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  category: z.string().max(40).optional(),
  pricing: z.enum(['free', 'paid', 'trial']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  sort: z.enum(['newest', 'oldest', 'members', 'mrr', 'name']).default('newest'),
});
export type ListCommunitiesQuery = z.infer<typeof listCommunitiesQuery>;
export const trashQuery = pageQuery.extend({ q: z.string().trim().max(100).optional() });
export const membersQuery = pageQuery.extend({ q: z.string().trim().max(100).optional(), role: z.enum(['member', 'mod', 'admin', 'owner']).optional() });
export const approveBody = z.object({ note: shortNoteField });
export const requestChangesBody = z.object({ note: z.string().trim().min(1, 'Vui lòng ghi rõ cần chỉnh sửa gì').max(2000) });
export const rejectBody = z.object({ reason: reasonField, note: noteField });
export const suspendCommunityBody = z.object({ reason: reasonField, ...durationFields, note: noteField });
export const restoreBody = z.object({ note: noteField });
export const deleteCommunityBody = z.object({ reason: reasonField, note: noteField });

/* -------------------------------------------------------------------------------- list rows */
interface CommunityRow {
  id: string;
  title: string;
  description: string;
  category: string;
  pricing: 'free' | 'paid' | 'trial';
  priceCents: number;
  visibility: 'public' | 'private';
  discoveryStatus: 'listed' | 'hidden' | 'unlisted';
  language: string;
  lessons: number;
  thumbnail: string;
  createdAt: Date;
  deletedAt: Date | null;
  status: CommunityStatus;
  statusReason: string | null;
  statusNote: string | null;
  statusUntil: Date | null;
  ownerId: string | null;
  ownerFirst: string | null;
  ownerLast: string | null;
  ownerEmail: string | null;
  members: number;
  mrr: number;
}

/** Trạng thái hiển thị: xóa mềm > khóa kiểu cũ (locked) coi như suspended > moderationStatus. */
const STATUS_EXPR = Prisma.sql`(CASE WHEN c."deletedAt" IS NOT NULL THEN 'deleted' WHEN c."moderationStatus" = 'active' AND c."locked" THEN 'suspended' ELSE c."moderationStatus"::text END)`;

const SELECT = Prisma.sql`
  SELECT c."id", c."title", c."description", c."category", c."pricing", c."priceCents", c."visibility", c."discoveryStatus", c."language", c."lessons", c."thumbnail",
    c."createdAt", c."deletedAt", ${STATUS_EXPR} AS "status",
    (CASE WHEN c."deletedAt" IS NOT NULL THEN c."deleteReason" ELSE COALESCE(c."moderationReason", c."lockReason") END) AS "statusReason",
    c."moderationNote" AS "statusNote", c."moderationUntil" AS "statusUntil",
    c."ownerId", o."firstName" AS "ownerFirst", o."lastName" AS "ownerLast", o."email" AS "ownerEmail",
    (SELECT COUNT(*) FROM "Enrollment" e WHERE e."courseId" = c."id"
       AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId"))::int AS "members",
    (SELECT COALESCE(SUM(s."priceCents"), 0) FROM "Subscription" s WHERE s."courseId" = c."id" AND s."status" = 'active')::int AS "mrr"
  FROM "Course" c
  LEFT JOIN "User" o ON o."id" = c."ownerId"`;

function discovery(r: Pick<CommunityRow, 'status' | 'visibility' | 'discoveryStatus'>): 'listed' | 'hidden' | 'unlisted' {
  if (r.status !== 'active') return 'unlisted';
  return r.visibility === 'public' ? r.discoveryStatus : 'hidden'; // Admin đợt 2: discoveryStatus do admin đặt
}

const owner = (r: CommunityRow) =>
  r.ownerId ? { id: r.ownerId, name: `${r.ownerFirst ?? ''} ${r.ownerLast ?? ''}`.trim(), email: r.ownerEmail } : null;

const toItem = (r: CommunityRow) => ({
  id: r.id,
  name: r.title,
  slug: r.id,
  category: r.category,
  pricing: r.pricing,
  priceUsd: r.priceCents / 100,
  visibility: r.visibility,
  status: r.status,
  statusReason: r.statusReason,
  statusNote: r.statusNote,
  statusUntil: iso(r.statusUntil),
  owner: owner(r),
  members: r.members,
  mrrCents: r.mrr,
  discovery: discovery(r),
  thumbnail: r.thumbnail,
  createdAt: r.createdAt.toISOString(),
  deletedAt: iso(r.deletedAt),
});
export type AdminCommunityItem = ReturnType<typeof toItem>;

async function getRow(id: string): Promise<CommunityRow> {
  const rows = await prisma.$queryRaw<CommunityRow[]>(Prisma.sql`${SELECT} WHERE c."id" = ${id}`);
  if (!rows[0]) throw HttpError.notFound('Không tìm thấy cộng đồng');
  return rows[0];
}

const hoursSince = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 3_600_000));
const personName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

/* -------------------------------------------------------------------------------- transitions */
type Patch = Prisma.CommunityUpdateManyMutationInput;

/** Chuyển trạng thái nguyên tử: chỉ ghi khi hàng còn ở trạng thái xuất phát (tránh 2 admin xử lý song song). */
async function transition(id: string, where: Prisma.CommunityWhereInput, data: Patch, conflictMsg: string): Promise<void> {
  const r = await prisma.community.updateMany({ where: { id, deletedAt: null, ...where }, data });
  if (r.count > 0) return;
  const exists = await prisma.community.findUnique({ where: { id }, select: { deletedAt: true } });
  if (!exists) throw HttpError.notFound('Không tìm thấy cộng đồng');
  throw HttpError.conflict(exists.deletedAt ? 'Cộng đồng đã bị xóa — hãy khôi phục trước' : conflictMsg);
}

async function notifyOwner(id: string, title: string, body: string) {
  const c = await prisma.community.findUnique({ where: { id }, select: { ownerId: true } });
  if (c?.ownerId) notify({ userId: c.ownerId, type: 'system', title, body, communityId: id });
}

async function finish(actorId: string, id: string, action: string, from: string, extra: { reason?: string | null; note?: string | null; metadata?: Record<string, unknown> }) {
  const row = await getRow(id);
  await auditService.record(actorId, {
    action,
    targetType: 'community',
    targetId: id,
    targetLabel: row.title,
    reason: extra.reason,
    note: extra.note,
    metadata: { from, to: row.status, ...extra.metadata },
  });
  return toItem(row);
}

/** Trạng thái kiểm duyệt hiện tại (trước khi chuyển) để ghi audit `{ from, to }`. */
const statusBefore = async (id: string): Promise<string> => (await prisma.community.findUnique({ where: { id }, select: { moderationStatus: true } }))?.moderationStatus ?? 'unknown';

const stamp = (actorId: string, extra: Patch = {}): Patch => ({ moderatedById: actorId, moderationUpdatedAt: new Date(), ...extra });

export const adminCommunitiesService = {
  async summary() {
    const [rows, paid] = await Promise.all([
      prisma.$queryRaw<{ s: string; n: number }[]>(Prisma.sql`SELECT ${STATUS_EXPR} AS s, COUNT(*)::int AS n FROM "Course" c WHERE c."moderationStatus"::text <> 'draft' GROUP BY 1`),
      prisma.community.count({ where: { deletedAt: null, pricing: { not: 'free' }, moderationStatus: { not: 'draft' } } }),
    ]);
    const by = (s: CommunityStatus) => rows.find((r) => r.s === s)?.n ?? 0;
    return {
      total: rows.filter((r) => r.s !== 'deleted').reduce((a, r) => a + r.n, 0),
      active: by('active'),
      pendingReview: by('pending_review'),
      changesRequested: by('changes_requested'),
      rejected: by('rejected'),
      paid,
      suspended: by('suspended'),
      deleted: by('deleted'),
    };
  },

  async list(q: ListCommunitiesQuery) {
    const statuses = enumList(q.status, STATUSES, 'status');
    const conds: Prisma.Sql[] = [Prisma.sql`c."moderationStatus"::text <> 'draft'`]; // nháp wizard chưa ra mắt: admin không thấy
    conds.push(statuses.length ? Prisma.sql`${STATUS_EXPR} = ANY(${statuses})` : Prisma.sql`${STATUS_EXPR} <> 'deleted'`);
    if (q.category) conds.push(Prisma.sql`c."category"::text = ${q.category}`);
    if (q.pricing) conds.push(Prisma.sql`c."pricing"::text = ${q.pricing}`);
    if (q.visibility) conds.push(Prisma.sql`c."visibility"::text = ${q.visibility}`);
    if (q.q) {
      const like = `%${likeEscape(q.q)}%`;
      conds.push(Prisma.sql`(c."title" ILIKE ${like} OR c."id" ILIKE ${like} OR (o."firstName" || ' ' || o."lastName") ILIKE ${like} OR o."email" ILIKE ${like})`);
    }
    const where = Prisma.join(conds, ' AND ');
    const order: Record<ListCommunitiesQuery['sort'], Prisma.Sql> = {
      newest: Prisma.sql`c."createdAt" DESC, c."id"`,
      oldest: Prisma.sql`c."createdAt" ASC, c."id"`,
      members: Prisma.sql`"members" DESC, c."createdAt" DESC`,
      mrr: Prisma.sql`"mrr" DESC, c."createdAt" DESC`,
      name: Prisma.sql`LOWER(c."title") ASC, c."id"`,
    };
    const [rows, count] = await Promise.all([
      prisma.$queryRaw<CommunityRow[]>(Prisma.sql`${SELECT} WHERE ${where} ORDER BY ${order[q.sort]} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`),
      prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS n FROM "Course" c LEFT JOIN "User" o ON o."id" = c."ownerId" WHERE ${where}`),
    ]);
    return { data: rows.map(toItem), meta: pageMeta(q.page, q.limit, count[0]?.n ?? 0) };
  },

  async reviewQueue(q: PageQuery) {
    const where = Prisma.sql`c."deletedAt" IS NULL AND c."moderationStatus" IN ('pending_review', 'changes_requested')`;
    const [rows, count] = await Promise.all([
      prisma.$queryRaw<CommunityRow[]>(Prisma.sql`${SELECT} WHERE ${where} ORDER BY c."createdAt" ASC, c."id" LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`),
      prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS n FROM "Course" c WHERE ${where}`),
    ]);
    const data = await Promise.all(
      rows.map(async (r) => {
        const ownerUser = r.ownerId ? await prisma.user.findUnique({ where: { id: r.ownerId }, select: { createdAt: true } }) : null;
        const [ownerCommunities, violations] = r.ownerId
          ? await Promise.all([
              prisma.community.count({ where: { ownerId: r.ownerId, deletedAt: null } }),
              prisma.report.count({
                where: { targetUserId: r.ownerId, status: 'resolved', NOT: { action: { in: ['none', 'dismiss'] } }, resolvedAt: { gte: new Date(Date.now() - 90 * DAY) } },
              }),
            ])
          : [0, 0];
        return {
          ...toItem(r),
          description: r.description,
          submittedAt: r.createdAt.toISOString(),
          waitingHours: hoursSince(r.createdAt),
          signals: {
            ownerAccountAgeDays: ownerUser ? Math.floor((Date.now() - ownerUser.createdAt.getTime()) / DAY) : null,
            ownerCommunities,
            ownerViolations90d: violations,
            hasThumbnail: r.thumbnail.length > 0,
            descriptionLength: r.description.length,
          },
        };
      }),
    );
    return { data, meta: pageMeta(q.page, q.limit, count[0]?.n ?? 0) };
  },

  async trash(q: z.infer<typeof trashQuery>) {
    const where: Prisma.CommunityWhereInput = {
      deletedAt: { not: null },
      ...(q.q ? { OR: [{ title: { contains: likeEscape(q.q), mode: 'insensitive' } }, { id: { contains: likeEscape(q.q), mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.community.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.community.count({ where }),
    ]);
    const deleters = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.deletedById).filter((x): x is string => !!x) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const dmap = new Map(deleters.map((u) => [u.id, u]));
    return {
      data: rows.map((r) => {
        const purgeAt = new Date(r.deletedAt!.getTime() + RETENTION_DAYS * DAY);
        const by = r.deletedById ? dmap.get(r.deletedById) : undefined;
        return {
          id: r.id,
          name: r.title,
          owner: r.owner ? { id: r.owner.id, name: personName(r.owner) } : null,
          category: r.category,
          deletedAt: r.deletedAt!.toISOString(),
          deletedBy: by ? { id: by.id, name: personName(by) } : null,
          deletedByOwner: !r.deletedById || r.deletedById === r.ownerId,
          reason: r.deleteReason,
          purgeAt: purgeAt.toISOString(),
          daysLeft: Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / DAY)),
        };
      }),
      meta: pageMeta(q.page, q.limit, total),
    };
  },

  async detail(id: string) {
    const row = await getRow(id);
    const community = await prisma.community.findUniqueOrThrow({ where: { id }, select: { deleteReason: true, deletedById: true, deletedAt: true } });
    const since30 = new Date(Date.now() - 30 * DAY);
    const notBanned = { NOT: { user: { bansReceived: { some: { communityId: id } } } } };
    const paid = ['succeeded', 'refunded'] as ('succeeded' | 'refunded')[];
    const [ownerUser, ownedCount, active30, new30, banned, posts, comments, hiddenPosts, events, subs, rev, reports30, openReports, recent, history, deleter] = await Promise.all([
      row.ownerId ? prisma.user.findUnique({ where: { id: row.ownerId } }) : null,
      row.ownerId ? prisma.community.count({ where: { ownerId: row.ownerId, deletedAt: null } }) : 0,
      prisma.enrollment.count({ where: { communityId: id, lastActiveAt: { gte: since30 }, ...notBanned } }),
      prisma.enrollment.count({ where: { communityId: id, enrolledAt: { gte: since30 }, ...notBanned } }),
      prisma.communityBan.count({ where: { communityId: id } }),
      prisma.post.count({ where: { communityId: id } }),
      prisma.postComment.count({ where: { post: { communityId: id } } }),
      prisma.post.count({ where: { communityId: id, hidden: true } }),
      prisma.communityEvent.count({ where: { communityId: id } }),
      prisma.subscription.count({ where: { communityId: id, status: 'active' } }),
      prisma.payment.aggregate({ where: { communityId: id, status: { in: paid } }, _sum: { amountCents: true, refundedCents: true } }),
      prisma.report.count({ where: { communityId: id, createdAt: { gte: since30 } } }),
      prisma.report.count({ where: { communityId: id, status: { in: ['open', 'under_review'] } } }),
      prisma.report.findMany({ where: { communityId: id }, orderBy: { createdAt: 'desc' }, take: 5, include: caseInclude }),
      auditService.forTarget('community', id, 10),
      community.deletedById ? prisma.user.findUnique({ where: { id: community.deletedById }, select: { id: true, firstName: true, lastName: true } }) : null,
    ]);
    return {
      ...toItem(row),
      description: row.description,
      language: row.language,
      lessons: row.lessons,
      deleteReason: community.deleteReason,
      deletedBy: deleter ? { id: deleter.id, name: personName(deleter) } : null,
      purgeAt: community.deletedAt ? new Date(community.deletedAt.getTime() + RETENTION_DAYS * DAY).toISOString() : null,
      owner: ownerUser
        ? {
            id: ownerUser.id,
            name: personName(ownerUser),
            email: ownerUser.email,
            status: ownerUser.status,
            accountAgeDays: Math.floor((Date.now() - ownerUser.createdAt.getTime()) / DAY),
            communitiesOwned: ownedCount,
          }
        : null,
      stats: {
        members: row.members,
        activeMembers30d: active30,
        newMembers30d: new30,
        bannedMembers: banned,
        posts,
        comments,
        hiddenPosts,
        events,
        mrrCents: row.mrr,
        totalRevenueCents: (rev._sum.amountCents ?? 0) - (rev._sum.refundedCents ?? 0),
        refundsCents: rev._sum.refundedCents ?? 0,
        activeSubscriptions: subs,
        reports30d: reports30,
        openReports,
      },
      recentReports: await toCaseViews(recent),
      history,
    };
  },

  async members(id: string, q: z.infer<typeof membersQuery>) {
    await getRow(id);
    const where: Prisma.EnrollmentWhereInput = {
      communityId: id,
      ...(q.role ? { role: q.role } : {}),
      ...(q.q
        ? { user: { OR: [{ firstName: { contains: likeEscape(q.q), mode: 'insensitive' } }, { lastName: { contains: likeEscape(q.q), mode: 'insensitive' } }, { email: { contains: likeEscape(q.q), mode: 'insensitive' } }] } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        orderBy: [{ role: 'desc' }, { enrolledAt: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } } },
      }),
      prisma.enrollment.count({ where }),
    ]);
    const ids = rows.map((r) => r.userId);
    const [postCounts, bans] = await Promise.all([
      prisma.post.groupBy({ by: ['authorId'], where: { communityId: id, authorId: { in: ids } }, _count: { _all: true } }),
      prisma.communityBan.findMany({ where: { communityId: id, userId: { in: ids } }, select: { userId: true } }),
    ]);
    const pc = new Map(postCounts.map((p) => [p.authorId, p._count._all]));
    const banned = new Set(bans.map((b) => b.userId));
    return {
      data: rows.map((e) => ({
        userId: e.userId,
        name: personName(e.user),
        email: e.user.email,
        role: e.role,
        joinedAt: e.enrolledAt.toISOString(),
        lastActiveAt: e.lastActiveAt.toISOString(),
        posts: pc.get(e.userId) ?? 0,
        userStatus: e.user.status,
        banned: banned.has(e.userId),
      })),
      meta: pageMeta(q.page, q.limit, total),
    };
  },

  async reports(id: string, q: PageQuery) {
    await getRow(id);
    const [rows, total] = await Promise.all([
      prisma.report.findMany({ where: { communityId: id }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: caseInclude }),
      prisma.report.count({ where: { communityId: id } }),
    ]);
    return { data: await toCaseViews(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  /* ---- hành động ---- */
  async approve(actorId: string, id: string, body: z.infer<typeof approveBody>) {
    const from = await statusBefore(id);
    await transition(id, { moderationStatus: { in: ['pending_review', 'changes_requested'] } }, stamp(actorId, { moderationStatus: 'active', moderationReason: null, moderationNote: body.note ?? null }), 'Chỉ duyệt được cộng đồng đang chờ duyệt');
    await notifyOwner(id, 'Cộng đồng đã được duyệt', 'Cộng đồng của bạn đã được duyệt và hiển thị công khai.');
    return finish(actorId, id, 'community.approve', from, { note: body.note });
  },

  async requestChanges(actorId: string, id: string, body: z.infer<typeof requestChangesBody>) {
    const from = await statusBefore(id);
    await transition(id, { moderationStatus: 'pending_review' }, stamp(actorId, { moderationStatus: 'changes_requested', moderationNote: body.note }), 'Chỉ yêu cầu chỉnh sửa với cộng đồng đang chờ duyệt');
    await notifyOwner(id, 'Cộng đồng cần chỉnh sửa', `Vui lòng chỉnh sửa trước khi được duyệt: ${body.note}`);
    return finish(actorId, id, 'community.request_changes', from, { note: body.note });
  },

  async reject(actorId: string, id: string, body: z.infer<typeof rejectBody>) {
    const from = await statusBefore(id);
    await transition(id, { moderationStatus: { in: ['pending_review', 'changes_requested'] } }, stamp(actorId, { moderationStatus: 'rejected', moderationReason: body.reason, moderationNote: body.note ?? null }), 'Chỉ từ chối được cộng đồng đang chờ duyệt');
    await notifyOwner(id, 'Cộng đồng bị từ chối', `Cộng đồng của bạn không được duyệt. Lý do: ${body.reason}`);
    return finish(actorId, id, 'community.reject', from, { reason: body.reason, note: body.note });
  },

  async suspend(actorId: string, id: string, body: z.infer<typeof suspendCommunityBody>) {
    const from = await statusBefore(id);
    const until = resolveUntil(body);
    // Dùng lại cờ locked sẵn có để chặn truy cập/ẩn danh sách công khai.
    await transition(
      id,
      { moderationStatus: 'active', locked: false },
      stamp(actorId, { moderationStatus: 'suspended', moderationReason: body.reason, moderationNote: body.note ?? null, moderationUntil: until, locked: true, lockReason: body.reason }),
      'Chỉ đình chỉ được cộng đồng đang hoạt động',
    );
    // Đình chỉ: dừng gia hạn mọi gói (hủy cuối kỳ) — không trừ tiền cộng đồng đang bị đình chỉ.
    await paymentsService.endAllForCommunity(id, 'cancel_at_period_end', 'Cộng đồng đang bị đình chỉ nên gói thành viên của bạn sẽ không được gia hạn.');
    await notifyOwner(id, 'Cộng đồng bị đình chỉ', `Cộng đồng của bạn bị đình chỉ. Lý do: ${body.reason}`);
    return finish(actorId, id, 'community.suspend', from, { reason: body.reason, note: body.note, metadata: { until: iso(until) } });
  },

  async restore(actorId: string, id: string, body: z.infer<typeof restoreBody>) {
    const from = await statusBefore(id);
    await transition(
      id,
      { OR: [{ moderationStatus: 'suspended' }, { moderationStatus: 'active', locked: true }] },
      stamp(actorId, { moderationStatus: 'active', moderationReason: null, moderationNote: body.note ?? null, moderationUntil: null, locked: false, lockReason: null }),
      'Chỉ khôi phục được cộng đồng đang bị đình chỉ',
    );
    await notifyOwner(id, 'Cộng đồng đã hoạt động trở lại', 'Cộng đồng của bạn đã được khôi phục.');
    return finish(actorId, id, 'community.restore', from, { note: body.note });
  },

  async remove(actorId: string, id: string, body: z.infer<typeof deleteCommunityBody>) {
    const from = await statusBefore(id);
    const cur = await prisma.community.findUnique({ where: { id }, select: { moderationStatus: true, deletedAt: true, title: true } });
    if (!cur) throw HttpError.notFound('Không tìm thấy cộng đồng');
    if (cur.deletedAt) throw HttpError.conflict('Cộng đồng đã bị xóa');
    await transition(
      id,
      { moderationStatus: cur.moderationStatus },
      stamp(actorId, { moderationStatus: 'deleted', preDeleteStatus: cur.moderationStatus, deletedAt: new Date(), deletedById: actorId, deleteReason: body.reason, moderationNote: body.note ?? null }),
      'Trạng thái cộng đồng vừa thay đổi, hãy thử lại',
    );
    // Xóa: kết thúc mọi gói ngay (không trừ tiền cộng đồng đã xóa), có thông báo cho từng thành viên trả phí.
    await paymentsService.endAllForCommunity(id, 'end_now', `Cộng đồng "${cur.title}" đã bị xóa nên gói thành viên của bạn đã được hủy và sẽ không bị tính phí thêm.`);
    await notifyOwner(id, 'Cộng đồng đã bị xóa', `Cộng đồng "${cur.title}" đã bị xóa. Lý do: ${body.reason}. Dữ liệu được giữ ${RETENTION_DAYS} ngày.`);
    return finish(actorId, id, 'community.delete', from, { reason: body.reason, note: body.note });
  },

  async undelete(actorId: string, id: string, body: z.infer<typeof restoreBody>) {
    const from = await statusBefore(id);
    const cur = await prisma.community.findUnique({ where: { id }, select: { moderationStatus: true, preDeleteStatus: true, deletedAt: true } });
    if (!cur) throw HttpError.notFound('Không tìm thấy cộng đồng');
    if (!cur.deletedAt) throw HttpError.conflict('Cộng đồng chưa bị xóa');
    if (Date.now() - cur.deletedAt.getTime() > RETENTION_DAYS * DAY) {
      throw HttpError.coded(409, 'RETENTION_EXPIRED', `Đã quá ${RETENTION_DAYS} ngày lưu giữ, không thể khôi phục`);
    }
    const prev = cur.preDeleteStatus ?? cur.moderationStatus;
    const back: CommunityStatus = prev === 'deleted' || prev === 'draft' ? 'active' : prev;
    const r = await prisma.community.updateMany({
      where: { id, deletedAt: { not: null } },
      data: stamp(actorId, { deletedAt: null, deletedById: null, deleteReason: null, preDeleteStatus: null, moderationStatus: back, moderationNote: body.note ?? null }),
    });
    if (r.count === 0) throw HttpError.conflict('Cộng đồng chưa bị xóa');
    await notifyOwner(id, 'Cộng đồng đã được khôi phục', 'Cộng đồng của bạn đã được khôi phục sau khi xóa.');
    return finish(actorId, id, 'community.undelete', from, { note: body.note });
  },
};

/** Cho communities.service (khóa/mở khóa kiểu cũ): mở khóa thì đồng bộ luôn moderationStatus suspended -> active. */
export async function clearModerationSuspension(communityId: string): Promise<void> {
  await prisma.community.updateMany({
    where: { id: communityId, moderationStatus: 'suspended' },
    data: { moderationStatus: 'active', moderationReason: null, moderationUntil: null },
  });
}
