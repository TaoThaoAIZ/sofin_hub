import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Prisma, type ReportAction, type ReportStatus } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { notify } from '../notifications/notifications.service.js';
import { env } from '../../config/env.js';
import { isStaff } from '../permissions/policy.js';
import { postsService } from '../posts/posts.service.js';
import { auditService } from './admin-audit.service.js';
import { caseCode, caseInclude, nextRisk, toCaseViews } from './admin-cases.view.js';
import { adminUsersService, banBody, restrictBody, suspendBody, warnBody, type ActionCtx } from './admin-users.service.js';
import { likeEscape, enumList, iso, shortNoteField, pageMeta, pageQuery, reasonField } from './admin.common.js';

const CASE_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
const RISKS = ['low', 'medium', 'high', 'critical'] as const;
const REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other', 'hate_speech', 'scam', 'copyright', 'nsfw'] as const;
const TARGET_TYPES = ['post', 'comment', 'member'] as const;
const DAY = 86_400_000;
const personName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

/* -------------------------------------------------------------------------------- schemas */
export const listCasesQuery = pageQuery.extend({
  status: z.string().optional(),
  risk: z.string().optional(),
  reason: z.string().optional(),
  assignee: z.string().optional(),
  targetType: z.enum(TARGET_TYPES).optional(),
  communityId: z.string().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'risk']).default('newest'),
  /** Mặc định ẩn các báo cáo đang mở trùng đối tượng với báo cáo cũ hơn (chỉ hiện báo cáo đầu tiên, `reportCount` cho biết số báo cáo). */
  includeDuplicates: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});
export type ListCasesQuery = z.infer<typeof listCasesQuery>;

const closeCase = { closeCase: z.boolean().default(true) };
export const assignBody = z.object({ adminId: z.string().uuid().nullable().optional() });
export const caseWarnBody = z.object({ message: warnBody.shape.message, reason: reasonField.optional(), ...closeCase });
export const removeContentBody = z.object({ reason: reasonField, notifyAuthor: z.boolean().default(true), allowAppeal: z.boolean().optional(), ...closeCase });
export const caseRestrictBody = restrictBody.extend(closeCase);
export const caseSuspendBody = suspendBody.extend(closeCase);
export const caseBanBody = banBody.extend(closeCase);
export const noteBody = z.object({ note: shortNoteField });
export const decisionsQuery = pageQuery.extend({
  type: z.enum(['warning', 'removal', 'restriction', 'suspension', 'ban']).optional(),
  q: z.string().trim().max(100).optional(),
});

const DECISION_ACTIONS: Record<string, string[]> = {
  warning: ['user.warn', 'case.warn'],
  removal: ['case.remove_content', 'content.remove'],
  restriction: ['user.restrict', 'case.restrict_user'],
  suspension: ['user.suspend', 'case.suspend_user'],
  ban: ['user.ban', 'case.ban_user'],
};

/* -------------------------------------------------------------------------------- helpers */
type CaseWithRels = Prisma.ReportGetPayload<{ include: typeof caseInclude }>;

async function loadCase(id: string): Promise<CaseWithRels> {
  const r = await prisma.report.findUnique({ where: { id }, include: caseInclude });
  if (!r) throw HttpError.notFound('Không tìm thấy báo cáo');
  return r;
}

function assertActive(r: { status: ReportStatus }) {
  if (r.status !== 'open' && r.status !== 'under_review') throw HttpError.conflict('Báo cáo này đã được xử lý');
}

async function addEvent(reportId: string, actorId: string, type: string, note?: string | null, meta?: Record<string, unknown>) {
  await prisma.reportEvent.create({ data: { reportId, actorId, type, note: note ?? null, meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined } });
}

async function viewOf(id: string) {
  return (await toCaseViews([await loadCase(id)]))[0]!;
}

/**
 * Chốt kết quả của 1 hành động trên case (atomic: chỉ khi còn open/under_review).
 * closeCase=true -> resolved/dismissed; false -> under_review để admin làm tiếp hành động khác.
 */
async function settle(
  actorId: string,
  c: CaseWithRels,
  o: { type: string; action: ReportAction; status: 'resolved' | 'dismissed'; closeCase: boolean; note?: string | null; meta?: Record<string, unknown> },
) {
  const now = new Date();
  const data: Prisma.ReportUpdateManyMutationInput = o.closeCase
    ? { status: o.status, action: o.action, note: o.note ?? c.note, resolvedAt: now }
    : { status: 'under_review', action: o.action, note: o.note ?? c.note };
  const r = await prisma.report.updateMany({ where: { id: c.id, status: { in: ['open', 'under_review'] } }, data });
  if (r.count === 0) throw HttpError.conflict('Báo cáo này đã được xử lý');
  await prisma.report.update({
    where: { id: c.id },
    data: { ...(o.closeCase ? { resolvedBy: { connect: { id: actorId } } } : {}), ...(c.assignedToId ? {} : { assignedTo: { connect: { id: actorId } } }) },
  });
  await addEvent(c.id, actorId, o.type, o.note, o.meta);
  if (o.closeCase) {
    // Báo cáo trùng cùng đối tượng đóng cùng kết quả (không bắt admin xử lý lại từng cái) và người báo cáo đều được báo tin.
    const dups = await prisma.report.findMany({
      where: { id: { not: c.id }, targetType: c.targetType, targetId: c.targetId, status: { in: ['open', 'under_review'] } },
      select: { id: true, reporterId: true },
    });
    if (dups.length) {
      await prisma.report.updateMany({
        where: { id: { in: dups.map((d) => d.id) } },
        data: { status: o.status, action: o.action, note: `Đóng cùng ${caseCode(c.caseNo)}`, resolvedAt: now },
      });
      for (const d of dups) notify({ userId: d.reporterId, type: 'report_resolved', title: 'Báo cáo của bạn đã được xử lý', body: 'Nội dung bạn báo cáo đã được xem xét.', communityId: c.communityId });
    }
    const outcome = o.status === 'dismissed' ? 'không vi phạm và đã được bỏ qua' : 'đã được xem xét và xử lý';
    notify({ userId: c.reporterId, type: 'report_resolved', title: 'Báo cáo của bạn đã được xử lý', body: `Báo cáo của bạn ${outcome}.`, communityId: c.communityId });
  }
}

const ctxOf = (c: CaseWithRels, type: string): ActionCtx => ({ auditAction: `case.${type}`, caseId: c.id });

/* -------------------------------------------------------------------------------- service */
export const adminModerationService = {
  async summary() {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [open, critical, underReview, resolvedToday, warnings, removed, suspended] = await Promise.all([
      prisma.report.count({ where: { status: 'open' } }),
      prisma.report.count({ where: { risk: 'critical', status: { in: ['open', 'under_review'] } } }),
      prisma.report.count({ where: { status: 'under_review' } }),
      prisma.report.count({ where: { status: { in: ['resolved', 'dismissed'] }, resolvedAt: { gte: startOfDay } } }),
      prisma.adminAuditLog.count({ where: { action: { in: DECISION_ACTIONS.warning! } } }),
      prisma.adminAuditLog.count({ where: { action: { in: DECISION_ACTIONS.removal! } } }),
      prisma.user.count({ where: { status: 'suspended', isDemo: false } }),
    ]);
    return { open, critical, underReview, resolvedToday, warnings, removedContent: removed, suspendedUsers: suspended };
  },

  /** Danh sách để chọn người xử lý: Platform Admin (env) + người đang được giao case. */
  async assignees() {
    const assigned = await prisma.report.findMany({ where: { assignedToId: { not: null } }, distinct: ['assignedToId'], select: { assignedToId: true } });
    const staffRows = await prisma.adminAccount.findMany({ where: { status: 'active', role: { permissions: { has: 'report.resolve' } } }, select: { userId: true } });
    const staffIds = new Set(staffRows.map((r) => r.userId));
    const users = await prisma.user.findMany({
      where: { OR: [{ email: { in: env.PLATFORM_ADMIN_EMAILS } }, { id: { in: [...assigned.map((a) => a.assignedToId!), ...staffIds] } }] },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    });
    return users.map((u) => ({ id: u.id, name: personName(u), email: u.email, canBeAssigned: env.PLATFORM_ADMIN_EMAILS.includes(u.email.toLowerCase()) || staffIds.has(u.id) }));
  },

  async list(actorId: string, q: ListCasesQuery) {
    const statuses = q.status === 'all' ? [] : enumList(q.status, CASE_STATUSES, 'status');
    const risks = enumList(q.risk, RISKS, 'risk');
    const reasons = enumList(q.reason, REASONS, 'reason');
    const and: Prisma.ReportWhereInput[] = [];
    if (statuses.length) and.push({ status: { in: statuses } });
    if (risks.length) and.push({ risk: { in: risks } });
    if (reasons.length) and.push({ reason: { in: reasons } });
    if (q.assignee === 'unassigned') and.push({ assignedToId: null });
    else if (q.assignee) and.push({ assignedToId: q.assignee === 'me' ? actorId : q.assignee });
    if (!q.includeDuplicates) {
      const dups = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT r."id" FROM "Report" r
        WHERE r."status" IN ('open', 'under_review') AND EXISTS (
          SELECT 1 FROM "Report" r2
          WHERE r2."targetType" = r."targetType" AND r2."targetId" = r."targetId" AND r2."status" IN ('open', 'under_review')
            AND (r2."createdAt" < r."createdAt" OR (r2."createdAt" = r."createdAt" AND r2."id" < r."id")))`);
      if (dups.length) and.push({ id: { notIn: dups.map((d) => d.id) } });
    }
    if (q.targetType) and.push({ targetType: q.targetType });
    if (q.communityId) and.push({ communityId: q.communityId });
    if (q.q) {
      const m = /^case-?0*(\d+)$/i.exec(q.q);
      const nameLike = (rel: 'targetUser' | 'reporter'): Prisma.ReportWhereInput => ({
        [rel]: { OR: [{ firstName: { contains: likeEscape(q.q!), mode: 'insensitive' } }, { lastName: { contains: likeEscape(q.q!), mode: 'insensitive' } }] },
      });
      and.push({
        OR: [
          ...(m ? [{ caseNo: Number(m[1]) }] : []),
          { targetExcerpt: { contains: likeEscape(q.q), mode: 'insensitive' as const } },
          { detail: { contains: likeEscape(q.q), mode: 'insensitive' as const } },
          nameLike('targetUser'),
          nameLike('reporter'),
        ],
      });
    }
    const where: Prisma.ReportWhereInput = and.length ? { AND: and } : {};
    const orderBy: Prisma.ReportOrderByWithRelationInput[] = q.sort === 'risk' ? [{ risk: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.report.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: caseInclude }),
      prisma.report.count({ where }),
    ]);
    return { data: await toCaseViews(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  async detail(id: string) {
    const c = await loadCase(id);
    const base = (await toCaseViews([c]))[0]!;

    // --- nội dung bị báo cáo: bản hiện tại (nếu còn) + ảnh chụp lúc báo cáo
    let reportedContent: Record<string, unknown> = { type: c.targetType, id: c.targetId, excerpt: c.targetExcerpt, exists: false, body: c.targetExcerpt ?? '', author: personName(c.targetUser) };
    if (c.targetType === 'post') {
      const p = await prisma.post.findUnique({
        where: { id: c.targetId },
        include: { author: { select: { firstName: true, lastName: true } }, comments: { orderBy: { createdAt: 'desc' }, take: 3, include: { author: { select: { firstName: true, lastName: true } } } } },
      });
      if (p) {
        reportedContent = {
          type: 'post', id: p.id, excerpt: c.targetExcerpt, exists: true, body: p.content, author: personName(p.author), createdAt: p.createdAt.toISOString(),
          likes: p.likesCount, comments: p.commentsCount, hidden: p.hidden, imageUrl: p.imageUrl, parentPost: null,
          thread: p.comments.reverse().map((x) => ({ author: personName(x.author), text: x.content.slice(0, 200) })),
        };
      }
    } else if (c.targetType === 'comment') {
      const m = await prisma.postComment.findUnique({
        where: { id: c.targetId },
        include: { author: { select: { firstName: true, lastName: true } }, post: { select: { id: true, content: true, likesCount: true } } },
      });
      if (m) {
        const siblings = await prisma.postComment.findMany({ where: { postId: m.postId }, orderBy: { createdAt: 'asc' }, take: 50, include: { author: { select: { firstName: true, lastName: true } } } });
        const i = siblings.findIndex((x) => x.id === m.id);
        reportedContent = {
          type: 'comment', id: m.id, excerpt: c.targetExcerpt, exists: true, body: m.content, author: personName(m.author), createdAt: m.createdAt.toISOString(),
          likes: 0, comments: 0, hidden: m.hidden, imageUrl: null, parentPost: { id: m.post.id, excerpt: m.post.content.slice(0, 160) },
          thread: siblings.slice(Math.max(0, i - 1), i + 2).map((x) => ({ author: personName(x.author), text: x.content.slice(0, 200), reported: x.id === m.id })),
        };
      }
    } else {
      const u = await prisma.user.findUnique({ where: { id: c.targetId } });
      if (u) reportedContent = { type: 'member', id: u.id, excerpt: c.targetExcerpt, exists: true, body: u.bio ?? '', author: personName(u), createdAt: u.createdAt.toISOString(), hidden: false, imageUrl: u.avatarUrl, thread: [] };
    }

    const uid = c.targetUserId;
    const [reporter, tu, previous, warnings, suspensions, communities, related, similar, history] = await Promise.all([
      prisma.user.findUnique({ where: { id: c.reporterId }, select: { id: true, firstName: true, lastName: true, email: true } }),
      prisma.user.findUniqueOrThrow({ where: { id: uid } }),
      prisma.report.count({ where: { targetUserId: uid, id: { not: c.id } } }),
      prisma.adminAuditLog.count({ where: { targetType: 'user', targetId: uid, action: { in: DECISION_ACTIONS.warning! } } }),
      prisma.adminAuditLog.count({ where: { targetType: 'user', targetId: uid, action: { in: DECISION_ACTIONS.suspension! } } }),
      prisma.enrollment.count({ where: { userId: uid } }),
      prisma.report.findMany({ where: { targetType: c.targetType, targetId: c.targetId, id: { not: c.id } }, orderBy: { createdAt: 'desc' }, take: 20, include: { reporter: { select: { id: true, firstName: true, lastName: true } } } }),
      prisma.report.findMany({ where: { targetUserId: uid, id: { not: c.id } }, orderBy: { createdAt: 'desc' }, take: 5, include: caseInclude }),
      prisma.reportEvent.findMany({ where: { reportId: id }, orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, firstName: true, lastName: true } } } }),
    ]);
    return {
      ...base,
      reportedContent,
      reporterInfo: reporter ? { id: reporter.id, name: personName(reporter), email: reporter.email } : null,
      reportedUserInfo: {
        id: tu.id, name: personName(tu), email: tu.email, status: tu.status,
        accountAgeDays: Math.floor((Date.now() - tu.createdAt.getTime()) / DAY),
        previousReports: previous, warnings, suspensions, communities,
      },
      relatedReports: related.map((r) => ({ id: r.id, reporter: { id: r.reporter.id, name: personName(r.reporter) }, reason: r.reason, detail: r.detail, createdAt: r.createdAt.toISOString() })),
      similarCases: await toCaseViews(similar),
      history: history.map((h) => ({
        id: h.id, type: h.type, actor: h.actor ? { id: h.actor.id, name: personName(h.actor) } : null, note: h.note, createdAt: h.createdAt.toISOString(), meta: h.meta,
      })),
    };
  },

  async assign(actorId: string, id: string, body: z.infer<typeof assignBody>) {
    const c = await loadCase(id);
    assertActive(c);
    const target = body.adminId === undefined ? actorId : body.adminId;
    if (target && !(await isStaff(target))) throw HttpError.badRequest('Chỉ giao được cho thành viên đội admin');
    const targetUser = target ? await prisma.user.findUnique({ where: { id: target }, select: { firstName: true, lastName: true } }) : null;
    await prisma.report.update({ where: { id }, data: { assignedToId: target, ...(c.status === 'open' && target ? { status: 'under_review' } : {}) } });
    await addEvent(id, actorId, 'assign', null, { assigneeId: target });
    await auditService.record(actorId, {
      action: 'case.assign', targetType: 'case', targetId: id, targetLabel: caseCode(c.caseNo), caseId: id,
      metadata: { assigneeId: target, assigneeName: targetUser ? personName(targetUser) : null },
    });
    return viewOf(id);
  },

  async warn(actorId: string, id: string, body: z.infer<typeof caseWarnBody>) {
    const c = await loadCase(id);
    assertActive(c);
    await adminUsersService.warn(actorId, c.targetUserId, { reason: body.reason ?? c.reason, message: body.message }, ctxOf(c, 'warn'));
    await settle(actorId, c, { type: 'warn', action: 'warn_user', status: 'resolved', closeCase: body.closeCase, note: body.message });
    return viewOf(id);
  },

  async removeContent(actorId: string, id: string, body: z.infer<typeof removeContentBody>) {
    const c = await loadCase(id);
    assertActive(c);
    if (c.targetType === 'member') throw HttpError.badRequest('Chỉ gỡ được bài viết hoặc bình luận');
    if (c.targetType === 'post') await postsService.setHidden(c.targetId, true);
    else await postsService.setCommentHidden(c.targetId, true);
    if (body.notifyAuthor) {
      notify({
        userId: c.targetUserId, type: 'system', title: 'Nội dung của bạn đã bị gỡ', communityId: c.communityId,
        body: `Nội dung của bạn đã bị gỡ vì vi phạm quy định. Lý do: ${body.reason}${body.allowAppeal ? '. Bạn có thể gửi khiếu nại tới đội hỗ trợ.' : ''}`,
      });
    }
    await auditService.record(actorId, {
      action: 'case.remove_content', targetType: 'content', targetId: c.targetId, targetLabel: (c.targetExcerpt ?? c.targetType).slice(0, 120),
      reason: body.reason, caseId: id, metadata: { contentType: c.targetType, authorId: c.targetUserId },
    });
    await settle(actorId, c, { type: 'remove_content', action: 'remove_content', status: 'resolved', closeCase: body.closeCase, note: body.reason });
    return viewOf(id);
  },

  async restrictUser(actorId: string, id: string, body: z.infer<typeof caseRestrictBody>) {
    const c = await loadCase(id);
    assertActive(c);
    const { closeCase: close, ...rest } = body;
    await adminUsersService.restrict(actorId, c.targetUserId, rest, ctxOf(c, 'restrict_user'));
    await settle(actorId, c, { type: 'restrict_user', action: 'restrict_user', status: 'resolved', closeCase: close, note: body.reason });
    return viewOf(id);
  },

  async suspendUser(actorId: string, id: string, body: z.infer<typeof caseSuspendBody>) {
    const c = await loadCase(id);
    assertActive(c);
    const { closeCase: close, ...rest } = body;
    await adminUsersService.suspend(actorId, c.targetUserId, rest, ctxOf(c, 'suspend_user'));
    await settle(actorId, c, { type: 'suspend_user', action: 'suspend_user', status: 'resolved', closeCase: close, note: body.reason });
    return viewOf(id);
  },

  async banUser(actorId: string, id: string, body: z.infer<typeof caseBanBody>) {
    const c = await loadCase(id);
    assertActive(c);
    const { closeCase: close, ...rest } = body;
    await adminUsersService.ban(actorId, c.targetUserId, rest, ctxOf(c, 'ban_user'));
    await settle(actorId, c, { type: 'ban_user', action: 'ban_user', status: 'resolved', closeCase: close, note: body.reason });
    return viewOf(id);
  },

  async dismiss(actorId: string, id: string, body: z.infer<typeof noteBody>) {
    const c = await loadCase(id);
    assertActive(c);
    await settle(actorId, c, { type: 'dismiss', action: 'dismiss', status: 'dismissed', closeCase: true, note: body.note });
    await auditService.record(actorId, { action: 'case.dismiss', targetType: 'case', targetId: id, targetLabel: caseCode(c.caseNo), note: body.note, caseId: id });
    return viewOf(id);
  },

  async escalate(actorId: string, id: string, body: z.infer<typeof noteBody>) {
    const c = await loadCase(id);
    assertActive(c);
    const risk = nextRisk(c.risk);
    await prisma.report.update({ where: { id }, data: { risk, escalatedAt: new Date(), status: 'under_review' } });
    await addEvent(id, actorId, 'escalate', body.note, { from: c.risk, to: risk });
    await auditService.record(actorId, { action: 'case.escalate', targetType: 'case', targetId: id, targetLabel: caseCode(c.caseNo), note: body.note, caseId: id, metadata: { from: c.risk, to: risk } });
    return viewOf(id);
  },

  async resolve(actorId: string, id: string, body: z.infer<typeof noteBody>) {
    const c = await loadCase(id);
    assertActive(c);
    await settle(actorId, c, { type: 'resolve', action: 'none', status: 'resolved', closeCase: true, note: body.note });
    await auditService.record(actorId, { action: 'case.resolve', targetType: 'case', targetId: id, targetLabel: caseCode(c.caseNo), note: body.note, caseId: id });
    return viewOf(id);
  },

  /** Các trang Warnings / Removed / Suspensions / Bans: nhìn nhật ký audit theo nhóm quyết định. */
  async decisions(q: z.infer<typeof decisionsQuery>) {
    const actions = q.type ? DECISION_ACTIONS[q.type]! : Object.values(DECISION_ACTIONS).flat();
    const where: Prisma.AdminAuditLogWhereInput = {
      action: { in: actions },
      ...(q.q ? { OR: [{ targetLabel: { contains: likeEscape(q.q), mode: 'insensitive' } }, { reason: { contains: likeEscape(q.q), mode: 'insensitive' } }, { actorName: { contains: likeEscape(q.q), mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      prisma.adminAuditLog.count({ where }),
    ]);
    const caseIds = rows.map((r) => r.caseId).filter((x): x is string => !!x);
    const cases = await prisma.report.findMany({ where: { id: { in: caseIds } }, select: { id: true, caseNo: true } });
    const cmap = new Map(cases.map((c) => [c.id, c.caseNo]));
    return {
      data: rows.map((r) => ({
        id: r.id,
        case: r.caseId && cmap.has(r.caseId) ? { id: r.caseId, caseCode: caseCode(cmap.get(r.caseId)!) } : null,
        target: { type: r.targetType, id: r.targetId, name: r.targetLabel },
        decision: r.action,
        admin: { id: r.actorId, name: r.actorName },
        reason: r.reason,
        evidence: r.evidence,
        createdAt: iso(r.createdAt),
      })),
      meta: pageMeta(q.page, q.limit, total),
    };
  },
};

