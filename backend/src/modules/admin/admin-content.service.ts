import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { notify } from '../notifications/notifications.service.js';
import { auditService } from './admin-audit.service.js';
import { caseCode } from './admin-cases.view.js';
import {
  DAY, HOUR, bulkBody, code, codePrefix, excerpt, nameMap, person, personSelect, ref, startOfUtcDay,
} from './admin-b2.common.js';
import { likeEscape, enumList, iso, noteField, pageMeta, pageQuery, reasonField } from './admin.common.js';

/** Admin đợt 2 — Content: posts, comments, courses (ClassroomModule), lessons, events, media. Contract: docs/api/admin-batch2.md. */

const OPEN_REPORT = ['open', 'under_review'] as const;
const LIVE_WINDOW_MS = 2 * HOUR;

/* -------------------------------------------------------------------------------- dùng chung */
type ModStatus = 'published' | 'hidden' | 'removed';
const modStatus = (r: { hidden: boolean; removedAt: Date | null }): ModStatus => (r.removedAt ? 'removed' : r.hidden ? 'hidden' : 'published');
const MOD_STATUSES = ['published', 'hidden', 'removed'] as const;

/** Số báo cáo đang mở theo đối tượng (post|comment). */
async function reportCounts(type: 'post' | 'comment', ids?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.report.groupBy({
    by: ['targetId'],
    where: { targetType: type, status: { in: [...OPEN_REPORT] }, ...(ids ? { targetId: { in: ids } } : {}) },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.targetId, r._count._all]));
}

/** where theo trạng thái cho model có `hidden` + `removedAt` (Post, PostComment, ClassroomLesson). */
function modStatusWhere(statuses: string[], reportedIds: () => Promise<string[]>): Promise<Record<string, unknown>> | Record<string, unknown> {
  if (!statuses.length) return {};
  const ors: Record<string, unknown>[] = [];
  if (statuses.includes('published')) ors.push({ hidden: false, removedAt: null });
  if (statuses.includes('hidden')) ors.push({ hidden: true, removedAt: null });
  if (statuses.includes('removed')) ors.push({ removedAt: { not: null } });
  if (statuses.includes('under_review')) {
    return reportedIds().then((ids) => ({ OR: [...ors, { hidden: false, removedAt: null, id: { in: ids } }] }));
  }
  return { OR: ors };
}

interface ModDelegate {
  updateMany(args: unknown): Promise<{ count: number }>;
  findUnique(args: unknown): Promise<{ id: string; removedAt: Date | null } | null>;
}
type ModAction = 'hide' | 'remove' | 'restore';

/** Chuyển trạng thái nguyên tử (updateMany có điều kiện): sai trạng thái -> 409, không có -> 404. Trả hàng TRƯỚC khi đổi. */
async function modTransition(del: ModDelegate, id: string, action: ModAction, adminId: string, reason: string | null, noun: string) {
  const prev = await del.findUnique({ where: { id } });
  if (!prev) throw HttpError.notFound(`Không tìm thấy ${noun}`);
  const now = new Date();
  const spec = {
    hide: { where: { hidden: false, removedAt: null }, data: { hidden: true, modReason: reason } },
    remove: { where: { removedAt: null }, data: { hidden: true, removedAt: now, modReason: reason } },
    restore: { where: { OR: [{ hidden: true }, { removedAt: { not: null } }] }, data: { hidden: false, removedAt: null, modReason: null } },
  }[action];
  const r = await del.updateMany({ where: { id, ...spec.where }, data: { ...spec.data, modAt: now, modById: adminId } });
  if (r.count === 0) {
    throw HttpError.conflict(
      action === 'hide' ? `${noun} đang bị ẩn hoặc đã bị gỡ` : action === 'remove' ? `${noun} đã bị gỡ` : `${noun} đang hiển thị bình thường`,
    );
  }
  return prev;
}

const tell = (userId: string | null | undefined, title: string, body: string, communityId?: string) => {
  if (userId) notify({ userId, type: 'system', title, body, ...(communityId ? { communityId } : {}) });
};

/* -------------------------------------------------------------------------------- schemas */
const statusCsv = z.string().optional();
export const postsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: statusCsv,
  communityId: z.string().max(100).optional(),
  authorId: z.string().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'engagement', 'reports']).default('newest'),
});
export const commentsQuery = postsQuery.extend({ postId: z.string().max(100).optional() });
export const coursesQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: statusCsv,
  communityId: z.string().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'students', 'lessons', 'title']).default('newest'),
});
export const lessonsQuery = pageQuery.extend({
  learningCourseId: z.string().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  status: statusCsv,
  type: z.enum(['video', 'text', 'file']).optional(),
  communityId: z.string().max(100).optional(),
  moduleId: z.string().max(100).optional(),
  sort: z.enum(['newest', 'views', 'title']).default('newest'),
});
export const eventsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: statusCsv,
  communityId: z.string().max(100).optional(),
  sort: z.enum(['startAt', 'newest']).default('startAt'),
});
export const mediaQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(['image', 'video', 'document', 'audio']).optional(),
  status: statusCsv,
  purpose: z.string().max(40).optional(),
  communityId: z.string().max(100).optional(),
  ownerId: z.string().max(100).optional(),
  sort: z.enum(['newest', 'size', 'name']).default('newest'),
});
export { bulkBody };
export const unpublishBody = z.object({ reason: reasonField, note: noteField, notifyAuthor: z.boolean().default(true) });
export const archiveBody = z.object({ reason: z.string().trim().max(500).optional(), note: noteField });
export const eventPatchBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    startAt: z.string().datetime({ offset: true }).optional(),
    meetingLink: z.string().trim().url().max(500).nullable().optional(),
    capacity: z.number().int().min(1).max(100000).nullable().optional(),
    note: noteField,
  })
  .refine((b) => Object.keys(b).some((k) => k !== 'note'), { message: 'Không có gì để cập nhật' });
export const cancelEventBody = z.object({ reason: reasonField, notifyAttendees: z.boolean().default(true) });
export const flagBody = z.object({ reason: reasonField });
export const removeMediaBody = z.object({ reason: reasonField, notifyOwner: z.boolean().default(true) });

/* ================================================================================ POSTS */
const postInclude = { author: { select: personSelect }, community: { select: { id: true, title: true } } } satisfies Prisma.PostInclude;
type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;

async function toPostItems(rows: PostRow[]) {
  const [counts, mods] = await Promise.all([reportCounts('post', rows.map((r) => r.id)), nameMap(rows.map((r) => r.modById))]);
  return rows.map((p) => {
    const reports = counts.get(p.id) ?? 0;
    const status = modStatus(p);
    return {
      id: p.id,
      code: code('POST', p.id),
      title: excerpt(p.content, 80),
      excerpt: excerpt(p.content, 200),
      category: p.category,
      author: person(p.author),
      community: ref(p.community),
      likes: p.likesCount,
      comments: p.commentsCount,
      engagement: p.likesCount + p.commentsCount,
      reports,
      underReview: status === 'published' && reports > 0,
      status,
      pinned: p.pinned,
      imageUrl: p.imageUrl,
      hasPoll: p.poll !== null,
      moderationReason: p.modReason,
      moderatedAt: iso(p.modAt),
      moderatedBy: p.modById ? mods.get(p.modById) ?? null : null,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

/* ================================================================================ COMMENTS */
const commentInclude = {
  author: { select: personSelect },
  post: { select: { id: true, content: true, communityId: true, community: { select: { id: true, title: true } } } },
} satisfies Prisma.PostCommentInclude;
type CommentRow = Prisma.PostCommentGetPayload<{ include: typeof commentInclude }>;

async function toCommentItems(rows: CommentRow[]) {
  const [counts, mods] = await Promise.all([reportCounts('comment', rows.map((r) => r.id)), nameMap(rows.map((r) => r.modById))]);
  return rows.map((c) => {
    const reports = counts.get(c.id) ?? 0;
    const status = modStatus(c);
    return {
      id: c.id,
      code: code('CMT', c.id),
      title: excerpt(c.content, 80),
      excerpt: excerpt(c.content, 200),
      author: person(c.author),
      post: { id: c.post.id, title: excerpt(c.post.content, 60) },
      community: ref(c.post.community),
      reports,
      underReview: status === 'published' && reports > 0,
      status,
      moderationReason: c.modReason,
      moderatedAt: iso(c.modAt),
      moderatedBy: c.modById ? mods.get(c.modById) ?? null : null,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

async function reportList(type: 'post' | 'comment', id: string) {
  const rows = await prisma.report.findMany({
    where: { targetType: type, targetId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { reporter: { select: personSelect } },
  });
  return rows.map((r) => ({ id: r.id, caseCode: caseCode(r.caseNo), reason: r.reason, status: r.status, reporter: person(r.reporter), createdAt: r.createdAt.toISOString() }));
}

/* ================================================================================ COURSES (entity Course = Khóa học; bảng LearningCourse) */
const courseInclude = {
  community: { select: { id: true, title: true, owner: { select: personSelect } } },
  _count: { select: { modules: true } },
} satisfies Prisma.CourseInclude;
type CourseRow = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;
const COURSE_STATUSES = ['published', 'draft', 'archived', 'removed'] as const;
const courseStatus = (m: { publishStatus: string; removedAt: Date | null }) => (m.removedAt ? 'removed' : m.publishStatus);

async function toCourseItems(rows: CourseRow[]) {
  if (!rows.length) return [];
  const communityIds = [...new Set(rows.map((r) => r.communityId))];
  const courseIds = rows.map((r) => r.id);
  const [members, lessonCounts, done, mods] = await Promise.all([
    prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT e."courseId" AS id, COUNT(*)::int AS n FROM "Enrollment" e
      WHERE e."courseId" = ANY(${communityIds}::text[]) AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      GROUP BY e."courseId"`),
    prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT m."learningCourseId" AS id, COUNT(*)::int AS n FROM "ClassroomLesson" l
      JOIN "ClassroomModule" m ON m."id" = l."moduleId"
      WHERE m."learningCourseId" = ANY(${courseIds}::text[]) GROUP BY m."learningCourseId"`),
    prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT m."learningCourseId" AS id, COUNT(*)::int AS n FROM "ClassroomLesson" l
      JOIN "ClassroomModule" m ON m."id" = l."moduleId"
      JOIN "LessonProgress" lp ON lp."lessonId" = l."id" AND lp."completedAt" IS NOT NULL
      WHERE m."learningCourseId" = ANY(${courseIds}::text[]) GROUP BY m."learningCourseId"`),
    nameMap(rows.map((r) => r.modById)),
  ]);
  const mem = new Map(members.map((m) => [m.id, m.n]));
  const ln = new Map(lessonCounts.map((m) => [m.id, m.n]));
  const dn = new Map(done.map((m) => [m.id, m.n]));
  return rows.map((m) => {
    const students = mem.get(m.communityId) ?? 0;
    const lessons = ln.get(m.id) ?? 0;
    return {
      id: m.id,
      title: m.title,
      thumbnail: m.thumbnailUrl,
      community: ref(m.community),
      creator: person(m.community.owner),
      students,
      lessons,
      modules: m._count.modules,
      completionPct: lessons && students ? Math.min(100, Math.round(((dn.get(m.id) ?? 0) / (lessons * students)) * 100)) : 0,
      reports: 0,
      status: courseStatus(m),
      moderationReason: m.modReason,
      moderatedAt: iso(m.modAt),
      moderatedBy: m.modById ? mods.get(m.modById) ?? null : null,
      createdAt: m.createdAt.toISOString(),
    };
  });
}

/* ================================================================================ LESSONS */
const lessonInclude = {
  module: { select: { id: true, title: true } },
  community: { select: { id: true, title: true } },
  _count: { select: { progress: true } },
} satisfies Prisma.ClassroomLessonInclude;
type LessonRow = Prisma.ClassroomLessonGetPayload<{ include: typeof lessonInclude }>;

async function toLessonItems(rows: LessonRow[]) {
  const mods = await nameMap(rows.map((r) => r.modById));
  return rows.map((l) => ({
    id: l.id,
    code: code('LSN', l.id),
    title: l.title,
    type: l.type,
    durationMin: l.durationMin,
    module: l.module,
    community: ref(l.community),
    views: l._count.progress,
    reports: 0,
    status: modStatus(l),
    moderationReason: l.modReason,
    moderatedAt: iso(l.modAt),
    moderatedBy: l.modById ? mods.get(l.modById) ?? null : null,
    createdAt: l.createdAt.toISOString(),
  }));
}

/* ================================================================================ EVENTS */
const eventInclude = {
  community: { select: { id: true, title: true } },
  host: { select: personSelect },
  _count: { select: { rsvps: true } },
} satisfies Prisma.CommunityEventInclude;
type EventRow = Prisma.CommunityEventGetPayload<{ include: typeof eventInclude }>;
const EVENT_STATUSES = ['upcoming', 'live', 'completed', 'cancelled', 'removed'] as const;

function eventStatus(e: { startAt: Date; cancelledAt: Date | null; removedAt: Date | null }, now = Date.now()) {
  if (e.removedAt) return 'removed';
  if (e.cancelledAt) return 'cancelled';
  const t = e.startAt.getTime();
  return t > now ? 'upcoming' : t > now - LIVE_WINDOW_MS ? 'live' : 'completed';
}

function eventStatusWhere(statuses: string[]): Prisma.CommunityEventWhereInput {
  const now = Date.now();
  const liveFrom = new Date(now - LIVE_WINDOW_MS);
  const ors: Prisma.CommunityEventWhereInput[] = [];
  const alive = { cancelledAt: null, removedAt: null };
  if (statuses.includes('upcoming')) ors.push({ ...alive, startAt: { gt: new Date(now) } });
  if (statuses.includes('live')) ors.push({ ...alive, startAt: { lte: new Date(now), gt: liveFrom } });
  if (statuses.includes('completed')) ors.push({ ...alive, startAt: { lte: liveFrom } });
  if (statuses.includes('cancelled')) ors.push({ cancelledAt: { not: null }, removedAt: null });
  if (statuses.includes('removed')) ors.push({ removedAt: { not: null } });
  return ors.length ? { OR: ors } : {};
}

async function toEventItems(rows: EventRow[]) {
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    community: ref(e.community),
    host: person(e.host),
    attendees: e._count.rsvps,
    capacity: e.capacity,
    startAt: e.startAt.toISOString(),
    timezone: e.timezone,
    meetingLink: e.meetingLink,
    location: e.meetingLink ? 'Online' : null,
    status: eventStatus(e),
    cancelReason: e.cancelReason,
    reports: 0,
    createdAt: e.createdAt.toISOString(),
  }));
}

/* ================================================================================ MEDIA */
const mediaInclude = { owner: { select: personSelect }, community: { select: { id: true, title: true } } } satisfies Prisma.UploadInclude;
type MediaRow = Prisma.UploadGetPayload<{ include: typeof mediaInclude }>;
type Kind = 'image' | 'video' | 'document' | 'audio';
export const mediaKind = (contentType: string): Kind =>
  contentType.startsWith('image/') ? 'image' : contentType.startsWith('video/') ? 'video' : contentType.startsWith('audio/') ? 'audio' : 'document';
const mediaStatus = (u: { flagged: boolean; removedAt: Date | null }) => (u.removedAt ? 'removed' : u.flagged ? 'flagged' : 'active');

async function toMediaItems(rows: MediaRow[]) {
  const mods = await nameMap(rows.map((r) => r.modById));
  return rows.map((u) => ({
    key: u.key,
    filename: u.filename,
    kind: mediaKind(u.contentType),
    contentType: u.contentType,
    size: u.size,
    purpose: u.purpose,
    owner: person(u.owner),
    community: u.community ? ref(u.community) : null,
    url: u.removedAt ? null : `/api/files/${u.key}`,
    status: mediaStatus(u),
    flagged: u.flagged,
    flagReason: u.flagReason,
    reports: u.flagged ? 1 : 0,
    moderationReason: u.modReason,
    moderatedAt: iso(u.modAt),
    moderatedBy: u.modById ? mods.get(u.modById) ?? null : null,
    uploadedAt: u.createdAt.toISOString(),
  }));
}

const likeAny = (q: string): Prisma.StringFilter => ({ contains: likeEscape(q), mode: 'insensitive' });
const authorMatch = (q: string): Prisma.UserWhereInput => ({
  OR: [{ firstName: likeAny(q) }, { lastName: likeAny(q) }, { email: likeAny(q) }],
});

/* ================================================================================ service */
export const adminContentService = {
  /* ---------------------------------------------------------------- posts */
  async postsSummary() {
    const [total, today, removed, hidden, reported] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { createdAt: { gte: startOfUtcDay() } } }),
      prisma.post.count({ where: { removedAt: { not: null } } }),
      prisma.post.count({ where: { hidden: true, removedAt: null } }),
      reportCounts('post').then((m) => m.size),
    ]);
    return { total, today, reported, removed, hidden };
  },

  async listPosts(q: z.infer<typeof postsQuery>) {
    const statuses = enumList(q.status, [...MOD_STATUSES, 'under_review'] as const, 'status');
    const where: Prisma.PostWhereInput = {
      ...(await modStatusWhere(statuses, async () => [...(await reportCounts('post')).keys()])),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.authorId ? { authorId: q.authorId } : {}),
    };
    if (q.q) {
      const prefix = codePrefix(q.q, 'POST');
      where.AND = [{ OR: [{ content: likeAny(q.q) }, { author: authorMatch(q.q) }, ...(prefix ? [{ id: { startsWith: prefix } }] : [])] }];
    }
    const skip = (q.page - 1) * q.limit;
    if (q.sort === 'reports') {
      const [ids, counts] = await Promise.all([prisma.post.findMany({ where, select: { id: true, createdAt: true } }), reportCounts('post')]);
      ids.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || b.createdAt.getTime() - a.createdAt.getTime());
      const pageIds = ids.slice(skip, skip + q.limit).map((r) => r.id);
      const rows = await prisma.post.findMany({ where: { id: { in: pageIds } }, include: postInclude });
      const by = new Map(rows.map((r) => [r.id, r]));
      return { data: await toPostItems(pageIds.map((id) => by.get(id)!).filter(Boolean)), meta: pageMeta(q.page, q.limit, ids.length) };
    }
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      q.sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : q.sort === 'engagement' ? [{ likesCount: 'desc' }, { commentsCount: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.post.findMany({ where, orderBy, skip, take: q.limit, include: postInclude }),
      prisma.post.count({ where }),
    ]);
    return { data: await toPostItems(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  async postDetail(id: string) {
    const p = await prisma.post.findUnique({ where: { id }, include: postInclude });
    if (!p) throw HttpError.notFound('Không tìm thấy bài viết');
    const [[item], comments, reports, history] = await Promise.all([
      toPostItems([p]),
      prisma.postComment.findMany({ where: { postId: id }, orderBy: { createdAt: 'asc' }, take: 20, include: { author: { select: personSelect } } }),
      reportList('post', id),
      auditService.forTarget('post', id),
    ]);
    return {
      ...item!,
      content: p.content,
      tags: p.tags,
      thread: comments.map((c) => ({ id: c.id, author: person(c.author), text: c.content, status: modStatus(c), createdAt: c.createdAt.toISOString() })),
      reportList: reports,
      history,
    };
  },

  async postAction(adminId: string, id: string, action: ModAction, body: { reason?: string | null; note?: string; notifyAuthor?: boolean }) {
    const prev = await modTransition(prisma.post as unknown as ModDelegate, id, action, adminId, body.reason ?? null, 'bài viết');
    const p = await prisma.post.findUniqueOrThrow({ where: { id }, include: postInclude });
    await auditService.record(adminId, {
      action: `post.${action}`, targetType: 'post', targetId: id, targetLabel: excerpt(p.content, 80), reason: body.reason, note: body.note,
      metadata: { community: p.communityId, from: modStatus(prev as unknown as { hidden: boolean; removedAt: Date | null }) },
    });
    if (action !== 'restore' && body.notifyAuthor !== false) {
      tell(p.authorId, action === 'hide' ? 'Bài viết của bạn đã bị ẩn' : 'Bài viết của bạn đã bị gỡ', `"${excerpt(p.content, 60)}"${body.reason ? ` — Lý do: ${body.reason}` : ''}`, p.communityId);
    }
    return (await toPostItems([p]))[0]!;
  },

  async bulkPosts(adminId: string, b: z.infer<typeof bulkBody>) {
    return bulk(b, (id) => this.postAction(adminId, id, b.action, { reason: b.reason, notifyAuthor: true }));
  },

  /* ---------------------------------------------------------------- comments */
  async commentsSummary() {
    const [total, today, removed, hidden, reported] = await Promise.all([
      prisma.postComment.count(),
      prisma.postComment.count({ where: { createdAt: { gte: startOfUtcDay() } } }),
      prisma.postComment.count({ where: { removedAt: { not: null } } }),
      prisma.postComment.count({ where: { hidden: true, removedAt: null } }),
      reportCounts('comment').then((m) => m.size),
    ]);
    return { total, today, reported, removed, hidden };
  },

  async listComments(q: z.infer<typeof commentsQuery>) {
    const statuses = enumList(q.status, [...MOD_STATUSES, 'under_review'] as const, 'status');
    const where: Prisma.PostCommentWhereInput = {
      ...(await modStatusWhere(statuses, async () => [...(await reportCounts('comment')).keys()])),
      ...(q.communityId ? { post: { communityId: q.communityId } } : {}),
      ...(q.authorId ? { authorId: q.authorId } : {}),
      ...(q.postId ? { postId: q.postId } : {}),
    };
    if (q.q) {
      const prefix = codePrefix(q.q, 'CMT');
      where.AND = [{ OR: [{ content: likeAny(q.q) }, { author: authorMatch(q.q) }, ...(prefix ? [{ id: { startsWith: prefix } }] : [])] }];
    }
    const skip = (q.page - 1) * q.limit;
    if (q.sort === 'reports') {
      const [ids, counts] = await Promise.all([prisma.postComment.findMany({ where, select: { id: true, createdAt: true } }), reportCounts('comment')]);
      ids.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || b.createdAt.getTime() - a.createdAt.getTime());
      const pageIds = ids.slice(skip, skip + q.limit).map((r) => r.id);
      const rows = await prisma.postComment.findMany({ where: { id: { in: pageIds } }, include: commentInclude });
      const by = new Map(rows.map((r) => [r.id, r]));
      return { data: await toCommentItems(pageIds.map((id) => by.get(id)!).filter(Boolean)), meta: pageMeta(q.page, q.limit, ids.length) };
    }
    const orderBy: Prisma.PostCommentOrderByWithRelationInput[] = q.sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.postComment.findMany({ where, orderBy, skip, take: q.limit, include: commentInclude }),
      prisma.postComment.count({ where }),
    ]);
    return { data: await toCommentItems(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  async commentDetail(id: string) {
    const c = await prisma.postComment.findUnique({ where: { id }, include: commentInclude });
    if (!c) throw HttpError.notFound('Không tìm thấy bình luận');
    const [[item], reports, history] = await Promise.all([toCommentItems([c]), reportList('comment', id), auditService.forTarget('comment', id)]);
    return { ...item!, content: c.content, reportList: reports, history };
  },

  async commentAction(adminId: string, id: string, action: ModAction, body: { reason?: string | null; note?: string; notifyAuthor?: boolean }) {
    const prev = await modTransition(prisma.postComment as unknown as ModDelegate, id, action, adminId, body.reason ?? null, 'bình luận');
    const c = await prisma.postComment.findUniqueOrThrow({ where: { id }, include: commentInclude });
    // Bình luận bị gỡ không còn tính vào số bình luận của bài; khôi phục thì cộng lại.
    if (action === 'remove' && !prev.removedAt) await prisma.$executeRaw`UPDATE "Post" SET "commentsCount" = GREATEST("commentsCount" - 1, 0) WHERE "id" = ${c.postId}`;
    if (action === 'restore' && prev.removedAt) await prisma.post.update({ where: { id: c.postId }, data: { commentsCount: { increment: 1 } } });
    await auditService.record(adminId, {
      action: `comment.${action}`, targetType: 'comment', targetId: id, targetLabel: excerpt(c.content, 80), reason: body.reason, note: body.note,
      metadata: { community: c.post.communityId, postId: c.postId },
    });
    if (action !== 'restore' && body.notifyAuthor !== false) {
      tell(c.authorId, action === 'hide' ? 'Bình luận của bạn đã bị ẩn' : 'Bình luận của bạn đã bị gỡ', `"${excerpt(c.content, 60)}"${body.reason ? ` — Lý do: ${body.reason}` : ''}`, c.post.communityId);
    }
    return (await toCommentItems([c]))[0]!;
  },

  async bulkComments(adminId: string, b: z.infer<typeof bulkBody>) {
    return bulk(b, (id) => this.commentAction(adminId, id, b.action, { reason: b.reason, notifyAuthor: true }));
  },

  /* ---------------------------------------------------------------- courses (entity Course = Khóa học) */
  async coursesSummary() {
    const [total, draft, archived, removed] = await Promise.all([
      prisma.course.count(),
      prisma.course.count({ where: { publishStatus: 'draft', removedAt: null } }),
      prisma.course.count({ where: { publishStatus: 'archived', removedAt: null } }),
      prisma.course.count({ where: { removedAt: { not: null } } }),
    ]);
    return { total, published: total - draft - archived - removed, draft, archived, removed };
  },

  async listCourses(q: z.infer<typeof coursesQuery>) {
    const statuses = enumList(q.status, COURSE_STATUSES, 'status');
    const ors: Prisma.CourseWhereInput[] = [];
    for (const s of statuses) ors.push(s === 'removed' ? { removedAt: { not: null } } : { publishStatus: s, removedAt: null });
    const where: Prisma.CourseWhereInput = {
      ...(ors.length ? { OR: ors } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.q ? { AND: [{ OR: [{ title: likeAny(q.q) }, { community: { title: likeAny(q.q) } }, { community: { owner: authorMatch(q.q) } }] }] } : {}),
    };
    const orderBy: Prisma.CourseOrderByWithRelationInput[] =
      q.sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : q.sort === 'title' ? [{ title: 'asc' }, { id: 'asc' }]
          : q.sort === 'students' ? [{ community: { enrollments: { _count: 'desc' } } }, { id: 'asc' }]
              : [{ createdAt: 'desc' }, { id: 'asc' }];
    if (q.sort === 'lessons') {
      // Prisma không sắp theo số bài học (lồng 2 cấp qua module) -> lấy id khớp bộ lọc, đếm bài học bằng SQL rồi phân trang.
      const skip = (q.page - 1) * q.limit;
      const ids = await prisma.course.findMany({ where, select: { id: true } });
      const counts = ids.length
        ? await prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
            SELECT m."learningCourseId" AS id, COUNT(*)::int AS n FROM "ClassroomLesson" l JOIN "ClassroomModule" m ON m."id" = l."moduleId"
            WHERE m."learningCourseId" = ANY(${ids.map((r) => r.id)}::text[]) GROUP BY m."learningCourseId"`)
        : [];
      const n = new Map(counts.map((c) => [c.id, c.n]));
      const sorted = ids.map((r) => r.id).sort((a, b) => (n.get(b) ?? 0) - (n.get(a) ?? 0) || a.localeCompare(b));
      const pageIds = sorted.slice(skip, skip + q.limit);
      const rows = await prisma.course.findMany({ where: { id: { in: pageIds } }, include: courseInclude });
      const by = new Map(rows.map((r) => [r.id, r]));
      return { data: await toCourseItems(pageIds.map((id) => by.get(id)!).filter(Boolean)), meta: pageMeta(q.page, q.limit, sorted.length) };
    }
    const [rows, total] = await Promise.all([
      prisma.course.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: courseInclude }),
      prisma.course.count({ where }),
    ]);
    return { data: await toCourseItems(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  async courseDetail(id: string) {
    const m = await prisma.course.findUnique({ where: { id }, include: courseInclude });
    if (!m) throw HttpError.notFound('Không tìm thấy khóa học');
    const [[item], lessons, modules, history] = await Promise.all([
      toCourseItems([m]),
      prisma.classroomLesson.findMany({ where: { module: { learningCourseId: id } }, orderBy: [{ module: { index: 'asc' } }, { index: 'asc' }, { createdAt: 'asc' }] }),
      prisma.classroomModule.findMany({
        where: { learningCourseId: id },
        orderBy: [{ index: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, publishStatus: true, removedAt: true, _count: { select: { lessons: true } } },
      }),
      auditService.forTarget('course', id),
    ]);
    return {
      ...item!,
      description: m.description,
      lessonList: lessons.map((l) => ({ id: l.id, title: l.title, type: l.type, durationMin: l.durationMin, status: modStatus(l) })),
      moduleList: modules.map((mod) => ({ id: mod.id, title: mod.title, lessons: mod._count.lessons, status: courseStatus(mod) })),
      history,
    };
  },

  async courseAction(adminId: string, id: string, action: 'publish' | 'unpublish' | 'archive' | 'remove' | 'restore', body: { reason?: string | null; note?: string; notifyAuthor?: boolean }) {
    const now = new Date();
    const spec = {
      publish: { where: { removedAt: null, publishStatus: { in: ['draft', 'archived'] as Array<'draft' | 'archived'> } }, data: { publishStatus: 'published' as const, modReason: null }, conflict: 'Chỉ xuất bản được khóa học đang ở trạng thái nháp hoặc lưu trữ' },
      unpublish: { where: { removedAt: null, publishStatus: 'published' as const }, data: { publishStatus: 'draft' as const, modReason: body.reason ?? null }, conflict: 'Chỉ hủy xuất bản được khóa học đang xuất bản' },
      archive: { where: { removedAt: null, publishStatus: { in: ['published', 'draft'] as Array<'published' | 'draft'> } }, data: { publishStatus: 'archived' as const, modReason: body.reason ?? null }, conflict: 'Khóa học đã lưu trữ hoặc đã bị gỡ' },
      remove: { where: { removedAt: null }, data: { removedAt: now, modReason: body.reason ?? null }, conflict: 'Khóa học đã bị gỡ' },
      restore: { where: { removedAt: { not: null } }, data: { removedAt: null, modReason: null }, conflict: 'Khóa học chưa bị gỡ' },
    }[action];
    const exists = await prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw HttpError.notFound('Không tìm thấy khóa học');
    const r = await prisma.course.updateMany({ where: { id, ...spec.where }, data: { ...spec.data, modAt: now, modById: adminId } });
    if (r.count === 0) throw HttpError.conflict(spec.conflict);
    const m = await prisma.course.findUniqueOrThrow({ where: { id }, include: courseInclude });
    await auditService.record(adminId, {
      action: `course.${action}`, targetType: 'course', targetId: id, targetLabel: m.title, reason: body.reason, note: body.note, metadata: { community: m.communityId },
    });
    if (['unpublish', 'remove'].includes(action) && body.notifyAuthor !== false) {
      tell(m.community.owner?.id, action === 'remove' ? 'Khóa học đã bị gỡ' : 'Khóa học đã bị hủy xuất bản', `"${m.title}"${body.reason ? ` — Lý do: ${body.reason}` : ''}`, m.communityId);
    }
    return (await toCourseItems([m]))[0]!;
  },

  /* ---------------------------------------------------------------- lessons */
  async lessonsSummary() {
    const [total, hidden, removed] = await Promise.all([
      prisma.classroomLesson.count(),
      prisma.classroomLesson.count({ where: { hidden: true, removedAt: null } }),
      prisma.classroomLesson.count({ where: { removedAt: { not: null } } }),
    ]);
    return { total, published: total - hidden - removed, hidden, removed };
  },

  async listLessons(q: z.infer<typeof lessonsQuery>) {
    const statuses = enumList(q.status, MOD_STATUSES, 'status');
    const where = {
      ...(await modStatusWhere(statuses, async () => [])),
      ...(q.type ? { type: q.type } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.moduleId ? { moduleId: q.moduleId } : {}),
      ...(q.learningCourseId ? { module: { learningCourseId: q.learningCourseId } } : {}),
      ...(q.q ? { AND: [{ OR: [{ title: likeAny(q.q) }, { module: { title: likeAny(q.q) } }, { community: { title: likeAny(q.q) } }, ...(codePrefix(q.q, 'LSN') ? [{ id: { startsWith: codePrefix(q.q, 'LSN')! } }] : [])] }] } : {}),
    } as Prisma.ClassroomLessonWhereInput;
    const orderBy: Prisma.ClassroomLessonOrderByWithRelationInput[] =
      q.sort === 'views' ? [{ progress: { _count: 'desc' } }, { id: 'asc' }] : q.sort === 'title' ? [{ title: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.classroomLesson.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: lessonInclude }),
      prisma.classroomLesson.count({ where }),
    ]);
    return { data: await toLessonItems(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  async lessonDetail(id: string) {
    const l = await prisma.classroomLesson.findUnique({ where: { id }, include: lessonInclude });
    if (!l) throw HttpError.notFound('Không tìm thấy bài học');
    const [[item], history] = await Promise.all([toLessonItems([l]), auditService.forTarget('lesson', id)]);
    return { ...item!, body: l.body, videoUrl: l.videoUrl, embedUrl: l.embedUrl, attachments: l.attachments, history };
  },

  async lessonAction(adminId: string, id: string, action: ModAction, body: { reason?: string | null; note?: string; notifyAuthor?: boolean }) {
    await modTransition(prisma.classroomLesson as unknown as ModDelegate, id, action, adminId, body.reason ?? null, 'bài học');
    const l = await prisma.classroomLesson.findUniqueOrThrow({ where: { id }, include: { ...lessonInclude, community: { select: { id: true, title: true, ownerId: true } } } });
    await auditService.record(adminId, {
      action: `lesson.${action}`, targetType: 'lesson', targetId: id, targetLabel: l.title, reason: body.reason, note: body.note, metadata: { community: l.communityId, moduleId: l.moduleId },
    });
    if (action !== 'restore' && body.notifyAuthor !== false) {
      tell(l.community.ownerId, action === 'hide' ? 'Bài học đã bị ẩn' : 'Bài học đã bị gỡ', `"${l.title}"${body.reason ? ` — Lý do: ${body.reason}` : ''}`, l.communityId);
    }
    return (await toLessonItems([l]))[0]!;
  },

  /* ---------------------------------------------------------------- events */
  async eventsSummary() {
    const now = new Date();
    const liveFrom = new Date(now.getTime() - LIVE_WINDOW_MS);
    const alive = { cancelledAt: null, removedAt: null };
    const [total, upcoming, live, completed, cancelled] = await Promise.all([
      prisma.communityEvent.count({ where: { removedAt: null } }),
      prisma.communityEvent.count({ where: { ...alive, startAt: { gt: now } } }),
      prisma.communityEvent.count({ where: { ...alive, startAt: { lte: now, gt: liveFrom } } }),
      prisma.communityEvent.count({ where: { ...alive, startAt: { lte: liveFrom } } }),
      prisma.communityEvent.count({ where: { cancelledAt: { not: null }, removedAt: null } }),
    ]);
    return { total, upcoming, live, completed, cancelled };
  },

  async listEvents(q: z.infer<typeof eventsQuery>) {
    const statuses = enumList(q.status, EVENT_STATUSES, 'status');
    const where: Prisma.CommunityEventWhereInput = {
      ...(statuses.length ? eventStatusWhere(statuses) : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.q ? { AND: [{ OR: [{ title: likeAny(q.q) }, { community: { title: likeAny(q.q) } }, { host: authorMatch(q.q) }] }] } : {}),
    };
    const orderBy: Prisma.CommunityEventOrderByWithRelationInput[] = q.sort === 'newest' ? [{ createdAt: 'desc' }, { id: 'asc' }] : [{ startAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.communityEvent.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: eventInclude }),
      prisma.communityEvent.count({ where }),
    ]);
    return { data: await toEventItems(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  async eventDetail(id: string) {
    const e = await prisma.communityEvent.findUnique({ where: { id }, include: eventInclude });
    if (!e) throw HttpError.notFound('Không tìm thấy sự kiện');
    const [[item], rsvps, history] = await Promise.all([
      toEventItems([e]),
      prisma.eventRsvp.findMany({ where: { eventId: id }, take: 50, orderBy: { createdAt: 'asc' }, include: { user: { select: personSelect } } }),
      auditService.forTarget('event', id),
    ]);
    return { ...item!, description: e.description, rsvps: rsvps.map((r) => person(r.user)), history };
  },

  async updateEvent(adminId: string, id: string, body: z.infer<typeof eventPatchBody>) {
    const e = await prisma.communityEvent.findUnique({ where: { id }, include: { _count: { select: { rsvps: true } } } });
    if (!e) throw HttpError.notFound('Không tìm thấy sự kiện');
    if (body.capacity != null && body.capacity < e._count.rsvps) throw HttpError.conflict('Sức chứa không được nhỏ hơn số người đã đăng ký');
    const startChanged = body.startAt !== undefined && new Date(body.startAt).getTime() !== e.startAt.getTime();
    await prisma.communityEvent.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.startAt !== undefined ? { startAt: new Date(body.startAt) } : {}),
        ...(body.meetingLink !== undefined ? { meetingLink: body.meetingLink } : {}),
        ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      },
    });
    if (startChanged) await prisma.eventRsvp.updateMany({ where: { eventId: id }, data: { remindedAt: null } }); // đổi giờ => cho nhắc lại
    const { note: _n, ...changes } = body;
    await auditService.record(adminId, { action: 'event.update', targetType: 'event', targetId: id, targetLabel: e.title, note: body.note, metadata: { changes } });
    return (await this.eventDetail(id));
  },

  async eventAction(adminId: string, id: string, action: 'cancel' | 'remove' | 'restore', body: { reason?: string | null; note?: string; notifyAttendees?: boolean }) {
    const e0 = await prisma.communityEvent.findUnique({ where: { id }, select: { id: true } });
    if (!e0) throw HttpError.notFound('Không tìm thấy sự kiện');
    const now = new Date();
    const liveFrom = new Date(now.getTime() - LIVE_WINDOW_MS);
    const spec = {
      cancel: { where: { cancelledAt: null, removedAt: null, startAt: { gt: liveFrom } }, data: { cancelledAt: now, cancelReason: body.reason ?? null }, conflict: 'Chỉ hủy được sự kiện sắp/đang diễn ra và chưa bị hủy' },
      remove: { where: { removedAt: null }, data: { removedAt: now, modReason: body.reason ?? null }, conflict: 'Sự kiện đã bị gỡ' },
      restore: { where: { OR: [{ cancelledAt: { not: null } }, { removedAt: { not: null } }] }, data: { cancelledAt: null, cancelReason: null, removedAt: null, modReason: null }, conflict: 'Sự kiện không ở trạng thái hủy/gỡ' },
    }[action];
    const r = await prisma.communityEvent.updateMany({ where: { id, ...spec.where }, data: { ...spec.data, modAt: now, modById: adminId } });
    if (r.count === 0) throw HttpError.conflict(spec.conflict);
    const e = await prisma.communityEvent.findUniqueOrThrow({ where: { id }, include: eventInclude });
    await auditService.record(adminId, {
      action: `event.${action}`, targetType: 'event', targetId: id, targetLabel: e.title, reason: body.reason, note: body.note, metadata: { community: e.communityId },
    });
    if (action !== 'restore' && body.notifyAttendees !== false) {
      const rsvps = await prisma.eventRsvp.findMany({ where: { eventId: id }, select: { userId: true } });
      for (const u of rsvps) {
        tell(u.userId, 'Sự kiện đã bị hủy', `Sự kiện "${e.title}" đã bị quản trị viên ${action === 'cancel' ? 'hủy' : 'gỡ'}${body.reason ? ` (${body.reason})` : ''}.`, e.communityId);
      }
    }
    return (await toEventItems([e]))[0]!;
  },

  /* ---------------------------------------------------------------- media */
  async mediaSummary() {
    const base = { status: 'uploaded' as const };
    const [agg, flagged, removed, groups] = await Promise.all([
      prisma.upload.aggregate({ where: base, _count: { _all: true }, _sum: { size: true } }),
      prisma.upload.count({ where: { ...base, flagged: true, removedAt: null } }),
      prisma.upload.count({ where: { ...base, removedAt: { not: null } } }),
      prisma.upload.groupBy({ by: ['contentType'], where: base, _count: { _all: true } }),
    ]);
    const byKind: Record<Kind, number> = { image: 0, video: 0, document: 0, audio: 0 };
    for (const g of groups) byKind[mediaKind(g.contentType)] += g._count._all;
    return { total: agg._count._all, totalSizeBytes: agg._sum.size ?? 0, flagged, removed, byKind };
  },

  async listMedia(q: z.infer<typeof mediaQuery>) {
    const statuses = enumList(q.status, ['active', 'flagged', 'removed'] as const, 'status');
    const ors: Prisma.UploadWhereInput[] = [];
    if (statuses.includes('active')) ors.push({ flagged: false, removedAt: null });
    if (statuses.includes('flagged')) ors.push({ flagged: true, removedAt: null });
    if (statuses.includes('removed')) ors.push({ removedAt: { not: null } });
    const and: Prisma.UploadWhereInput[] = [];
    if (ors.length) and.push({ OR: ors });
    if (q.kind) {
      and.push(q.kind === 'document'
        ? { NOT: [{ contentType: { startsWith: 'image/' } }, { contentType: { startsWith: 'video/' } }, { contentType: { startsWith: 'audio/' } }] }
        : { contentType: { startsWith: `${q.kind}/` } });
    }
    if (q.q) and.push({ OR: [{ filename: likeAny(q.q) }, { owner: authorMatch(q.q) }, { community: { title: likeAny(q.q) } }] });
    const where: Prisma.UploadWhereInput = {
      status: 'uploaded',
      ...(q.purpose ? { purpose: q.purpose as never } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    const orderBy: Prisma.UploadOrderByWithRelationInput[] =
      q.sort === 'size' ? [{ size: 'desc' }, { key: 'asc' }] : q.sort === 'name' ? [{ filename: 'asc' }, { key: 'asc' }] : [{ createdAt: 'desc' }, { key: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.upload.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: mediaInclude }),
      prisma.upload.count({ where }),
    ]);
    return { data: await toMediaItems(rows), meta: pageMeta(q.page, q.limit, total) };
  },

  async mediaDetail(key: string) {
    const u = await prisma.upload.findFirst({ where: { key, status: 'uploaded' }, include: mediaInclude });
    if (!u) throw HttpError.notFound('Không tìm thấy file');
    const [[item], history] = await Promise.all([toMediaItems([u]), auditService.forTarget('media', key)]);
    return { ...item!, history };
  },

  async mediaAction(adminId: string, key: string, action: 'flag' | 'unflag' | 'remove' | 'restore', body: { reason?: string | null; note?: string; notifyOwner?: boolean }) {
    const now = new Date();
    const spec = {
      flag: { where: { flagged: false, removedAt: null }, data: { flagged: true, flagReason: body.reason ?? null }, conflict: 'File đã được gắn cờ hoặc đã bị gỡ' },
      unflag: { where: { flagged: true, removedAt: null }, data: { flagged: false, flagReason: null }, conflict: 'File không ở trạng thái gắn cờ' },
      remove: { where: { removedAt: null }, data: { removedAt: now, modReason: body.reason ?? null }, conflict: 'File đã bị gỡ' },
      restore: { where: { removedAt: { not: null } }, data: { removedAt: null, modReason: null }, conflict: 'File chưa bị gỡ' },
    }[action];
    const exists = await prisma.upload.findFirst({ where: { key, status: 'uploaded' }, select: { key: true } });
    if (!exists) throw HttpError.notFound('Không tìm thấy file');
    const r = await prisma.upload.updateMany({ where: { key, status: 'uploaded', ...spec.where }, data: { ...spec.data, modAt: now, modById: adminId } });
    if (r.count === 0) throw HttpError.conflict(spec.conflict);
    const u = await prisma.upload.findUniqueOrThrow({ where: { key }, include: mediaInclude });
    await auditService.record(adminId, {
      action: `media.${action}`, targetType: 'media', targetId: key, targetLabel: u.filename, reason: body.reason, note: body.note, metadata: { owner: u.ownerId, size: u.size },
    });
    if (action === 'remove' && body.notifyOwner !== false) {
      tell(u.ownerId, 'File của bạn đã bị gỡ', `"${u.filename}"${body.reason ? ` — Lý do: ${body.reason}` : ''}`, u.communityId ?? undefined);
    }
    return (await toMediaItems([u]))[0]!;
  },

  /** Lấy thông tin để route stream file gốc (kể cả đã gỡ). */
  async mediaForDownload(key: string) {
    const u = await prisma.upload.findFirst({ where: { key, status: 'uploaded' }, select: { key: true, filename: true } });
    if (!u) throw HttpError.notFound('Không tìm thấy file');
    return u;
  },
};

/** Chạy hành động lần lượt cho từng id; lỗi nghiệp vụ (404/409) của 1 id không dừng cả lô. */
async function bulk(b: { ids: string[] }, fn: (id: string) => Promise<unknown>) {
  let updated = 0;
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const id of [...new Set(b.ids)]) {
    try {
      await fn(id);
      updated++;
    } catch (e) {
      if (e instanceof HttpError) skipped.push({ id, reason: e.message });
      else throw e;
    }
  }
  return { updated, skipped };
}

void DAY;
