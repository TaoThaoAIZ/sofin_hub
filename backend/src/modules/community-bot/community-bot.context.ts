import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { learningCourseRepository } from '../classroom/learning-courses.repository.js';
import { classroomService } from '../classroom/classroom.service.js';
import type { LessonAccess } from '../classroom/classroom.types.js';
import { isPaymentTopic } from '../chatbot/chatbot.context.js';
import { normalizeText } from '../search/search.text.js';
import { chatbotRepository, queryTerms } from '../chatbot/chatbot.repository.js';
import type { BotAccess } from './community-bot.access.js';

/**
 * Ngữ cảnh cho bot của 1 cộng đồng (chatbot.md mục 4.4): CHỈ dữ liệu của cộng đồng đó, theo quyền của CHÍNH người hỏi.
 * Bài học luôn lọc qua classroomService.lessonAccess (cùng logic khóa với lớp học): bài người đó chưa mở => chỉ tên + lý do khóa,
 * KHÔNG có nội dung. Bài đăng / sự kiện đã ẩn, gỡ không bao giờ vào ngữ cảnh.
 */
export interface CommunityContext {
  community: {
    name: string;
    description: string;
    promise: string | null;
    benefits: string[];
    rules: { title: string; body: string }[];
    instructor: string;
    price: string;
  };
  sampleAnswers: { id: string; question: string; answer: string }[];
  documents: { document: string; section: string; content: string }[];
  lessons: { title: string; module: string; link: string; status: 'open' | 'locked'; content?: string; howToUnlock?: string }[];
  curriculum: { module: string; lessons: number; locked: boolean; howToUnlock?: string }[];
  /** Bài đăng liên quan: bài ghim, bài khớp câu hỏi / ngày nhắc tới / bình chọn, bài mới nhất — kèm kết quả bình chọn nếu có. */
  posts: PostView[];
  events: { title: string; startAt: string; description: string; cancelled: boolean }[];
  /** Gói của CHÍNH người hỏi trong cộng đồng này — chỉ khi câu hỏi nói về thanh toán (null = không kèm). */
  mySubscription: { status: string; renewsAt: string; cancelAtPeriodEnd: boolean } | null;
  /** ID nguồn — KHÔNG đưa vào prompt; ghi vào toolCalls để kiểm tra rò rỉ. */
  sources: { qaIds: string[]; chunkIds: string[]; lessonIds: string[]; lockedLessonIds: string[]; postIds: string[]; eventIds: string[] };
}

export interface PostView {
  content: string;
  author: string;
  createdAt: string;
  category: string;
  pinned: boolean;
  likes: number;
  comments: number;
  link: string;
  poll?: {
    question: string;
    multiple: boolean;
    closesAt: string | null;
    closed: boolean;
    voters: number;
    options: { text: string; votes: number; percent: number }[];
    /** Lựa chọn nhiều phiếu nhất (nhiều mục = đang hòa); [] = chưa ai bình chọn. */
    leading: string[];
  };
}

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const vnTime = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Cách mở bài đang khóa — chỉ thông tin công khai của module (không lộ nội dung). */
export function howToUnlock(a: LessonAccess): string {
  switch (a.reason) {
    case 'level':
      return `cần đạt cấp độ ${a.requiredLevel ?? '?'} trong cộng đồng`;
    case 'paid':
      return a.priceCents ? `cần mua module "${a.moduleTitle}" (${vnd(a.priceCents)}) ở trang Lớp học` : `cần mua module "${a.moduleTitle}" ở trang Lớp học`;
    case 'selected':
      return 'chỉ dành cho thành viên được chủ cộng đồng chọn';
    case 'previous_module':
      return 'cần học xong module trước';
    default:
      return 'cần học xong các bài trước trong module (học tuần tự)';
  }
}

function priceOf(c: { pricing: string; priceCents: number; priceAnnualCents: number | null }): string {
  if (c.pricing === 'free' || c.priceCents === 0) return 'Miễn phí';
  return `${vnd(c.priceCents)}/tháng${c.priceAnnualCents ? ` hoặc ${vnd(c.priceAnnualCents)}/năm` : ''}`;
}

async function searchLessons(communityId: string, tsq: string, limit: number) {
  return prisma.$queryRaw<{ id: string; title: string; body: string; learningCourseId: string }[]>`
    SELECT l."id", l."title", l."body", m."learningCourseId"
    FROM "ClassroomLesson" l JOIN "ClassroomModule" m ON m."id" = l."moduleId"
    WHERE l."courseId" = ${communityId} AND l."removedAt" IS NULL AND l."hidden" = false AND m."removedAt" IS NULL
      AND l."searchVector" @@ to_tsquery('simple', ${tsq})
    ORDER BY ts_rank(l."searchVector", to_tsquery('simple', ${tsq})) DESC, l."id"
    LIMIT ${limit}`;
}

async function searchPosts(communityId: string, tsq: string, limit: number) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p."id" FROM "Post" p
    WHERE p."courseId" = ${communityId} AND p."removedAt" IS NULL AND p."hidden" = false
      AND p."searchVector" @@ to_tsquery('simple', ${tsq})
    ORDER BY ts_rank(p."searchVector", to_tsquery('simple', ${tsq})) DESC, p."createdAt" DESC
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

/** Câu hỏi về bình chọn / vote => đưa thêm các bài có bình chọn gần nhất (tìm theo chữ dễ trượt vì bài thường không có chữ "vote"). */
const POLL_TOPIC = /\b(vote|binh chon|bau chon|poll|khao sat|phieu|lua chon nhieu nhat)\b/;
const CATEGORY_LABEL: Record<string, string> = { general: 'Thảo luận chung', qa: 'Hỏi đáp', case_study: 'Case study', announcement: 'Thông báo' };
/** Số bài đăng tối đa trong ngữ cảnh (giữ prompt gọn). */
const MAX_POSTS = 8;
const VN_OFFSET_MS = 7 * 3600_000;

/** Ngày được nhắc trong câu hỏi ("13/10", "ngày 13/10/2026") => khoảng [đầu ngày, cuối ngày) theo giờ Việt Nam. Tối đa 2 ngày. */
export function mentionedDays(text: string, now = new Date()): { from: Date; to: Date }[] {
  const out: { from: Date; to: Date }[] = [];
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?(?!\d)/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
    let y = m[3] ? Number(m[3]) : vnNow.getUTCFullYear();
    // Không ghi năm mà ngày nằm sau hôm nay => hiểu là năm trước ("13/12" hỏi vào tháng 1).
    if (!m[3] && Date.UTC(y, mo - 1, d) > vnNow.getTime()) y -= 1;
    const from = new Date(Date.UTC(y, mo - 1, d) - VN_OFFSET_MS);
    out.push({ from, to: new Date(from.getTime() + 24 * 3600_000) });
    if (out.length >= 2) break;
  }
  return out;
}

type PollDef = { question?: string; options?: { id: string; text: string }[]; multiple?: boolean; closesAt?: string };

/** Dựng PostView (kèm kết quả bình chọn) cho các bài theo đúng thứ tự `ids`. */
async function postViews(communityId: string, ids: string[]): Promise<PostView[]> {
  if (!ids.length) return [];
  const [rows, tally, voters] = await Promise.all([
    prisma.post.findMany({
      where: { id: { in: ids }, communityId, removedAt: null, hidden: false },
      select: { id: true, content: true, category: true, pinned: true, likesCount: true, commentsCount: true, createdAt: true, poll: true, author: { select: { firstName: true, lastName: true, deletedAt: true } } },
    }),
    prisma.pollVote.groupBy({ by: ['postId', 'optionId'], where: { postId: { in: ids } }, _count: { _all: true } }),
    prisma.pollVote.groupBy({ by: ['postId', 'userId'], where: { postId: { in: ids } } }),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = Date.now();
  return ids.flatMap((id): PostView[] => {
    const p = byId.get(id);
    if (!p) return [];
    const def = p.poll as PollDef | null;
    let poll: PostView['poll'];
    if (def?.options?.length) {
      const votes = (optionId: string) => tally.find((t) => t.postId === id && t.optionId === optionId)?._count._all ?? 0;
      const total = voters.filter((v) => v.postId === id).length;
      const options = def.options.map((o) => ({ text: o.text, votes: votes(o.id), percent: total ? Math.round((votes(o.id) / total) * 100) : 0 }));
      const max = Math.max(0, ...options.map((o) => o.votes));
      poll = {
        question: def.question ?? '',
        multiple: Boolean(def.multiple),
        closesAt: def.closesAt ? vnTime(new Date(def.closesAt)) : null,
        closed: Boolean(def.closesAt && new Date(def.closesAt).getTime() <= now),
        voters: total,
        options,
        leading: max > 0 ? options.filter((o) => o.votes === max).map((o) => o.text) : [],
      };
    }
    return [{
      content: clip(p.content.trim(), 600),
      author: p.author.deletedAt ? 'Thành viên đã xóa' : `${p.author.firstName} ${p.author.lastName}`.trim(),
      createdAt: vnTime(p.createdAt),
      category: CATEGORY_LABEL[p.category] ?? p.category,
      pinned: p.pinned,
      likes: p.likesCount,
      comments: p.commentsCount,
      link: `/communities/${communityId}/community?post=${p.id}`,
      ...(poll ? { poll } : {}),
    }];
  });
}

/**
 * Bài đăng cho ngữ cảnh — gộp nhiều nguồn vì tìm theo chữ dễ trượt với câu hỏi dài / hỏi theo ngày / hỏi về bình chọn.
 * Ưu tiên: bài đăng đúng ngày được nhắc → bài có bình chọn (khi hỏi về vote) → bài khớp chữ → bài ghim → bài mới nhất.
 */
async function relevantPostIds(communityId: string, text: string, tsq: string | null): Promise<string[]> {
  const live = { communityId, removedAt: null, hidden: false } as const;
  const days = mentionedDays(text);
  const wantPolls = POLL_TOPIC.test(normalizeText(text));
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  const [byDate, polls, search, pinned, recent] = await Promise.all([
    days.length
      ? prisma.post.findMany({ where: { ...live, OR: days.map((d) => ({ createdAt: { gte: d.from, lt: d.to } })) }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true } }).then(ids)
      : Promise.resolve([]),
    wantPolls ? prisma.post.findMany({ where: { ...live, poll: { not: Prisma.AnyNull } }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true } }).then(ids) : Promise.resolve([]),
    tsq ? searchPosts(communityId, tsq, 4) : Promise.resolve([]),
    prisma.post.findMany({ where: { ...live, pinned: true }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true } }).then(ids),
    prisma.post.findMany({ where: live, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true } }).then(ids),
  ]);
  return [...new Set([...byDate, ...polls, ...search, ...pinned, ...recent])].slice(0, MAX_POSTS);
}

export async function gatherCommunityContext(
  a: BotAccess,
  input: { userId: string; communityId: string; text: string; recentUserTexts?: string[] },
): Promise<CommunityContext> {
  const { userId, communityId, text } = input;
  const { tsq } = queryTerms(text);
  const now = new Date();
  const wantPayments = isPaymentTopic([text, ...(input.recentUserTexts ?? []).slice(-1)]);

  const [community, qa, chunks, lessonHits, postHits, upcoming, matchedEvents, courses, sub] = await Promise.all([
    prisma.community.findUniqueOrThrow({
      where: { id: communityId },
      select: { title: true, description: true, promise: true, benefits: true, rules: true, instructorName: true, instructorRole: true, pricing: true, priceCents: true, priceAnnualCents: true },
    }),
    chatbotRepository.matchQa(text, { limit: 5, order: 'blend', communityId }),
    chatbotRepository.searchChunks(text, 4, communityId),
    tsq ? searchLessons(communityId, tsq, 5) : Promise.resolve([]),
    relevantPostIds(communityId, text, tsq).then((ids) => postViews(communityId, ids).then((views) => ({ ids, views }))),
    prisma.communityEvent.findMany({
      where: { communityId, removedAt: null, startAt: { gte: now } },
      orderBy: { startAt: 'asc' },
      take: 5,
      select: { id: true, title: true, description: true, startAt: true, cancelledAt: true },
    }),
    tsq
      ? prisma.$queryRaw<{ id: string; title: string; description: string; startAt: Date; cancelledAt: Date | null }[]>`
          SELECT e."id", e."title", e."description", e."startAt", e."cancelledAt" FROM "CommunityEvent" e
          WHERE e."courseId" = ${communityId} AND e."removedAt" IS NULL AND e."searchVector" @@ to_tsquery('simple', ${tsq})
          ORDER BY ts_rank(e."searchVector", to_tsquery('simple', ${tsq})) DESC LIMIT 3`
      : Promise.resolve([]),
    learningCourseRepository.list(communityId),
    wantPayments
      ? prisma.subscription.findFirst({ where: { userId, communityId }, orderBy: { createdAt: 'desc' }, select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } })
      : Promise.resolve(null),
  ]);

  // Quyền đọc bài học (mọi khóa học của cộng đồng) — cùng logic khóa với lớp học.
  const access = await classroomService.lessonAccess(communityId, userId, courses.map((c) => c.id));
  const lessons: CommunityContext['lessons'] = [];
  const sources: CommunityContext['sources'] = { qaIds: qa.map((q) => q.id), chunkIds: chunks.map((c) => c.id), lessonIds: [], lockedLessonIds: [], postIds: [], eventIds: [] };
  for (const l of lessonHits) {
    const acc = access.get(l.id);
    if (!acc) continue; // không hiển thị với người hỏi (nháp/khóa học chưa xuất bản...)
    const link = `/communities/${communityId}/community/lop-hoc/${l.id}`;
    if (acc.open) {
      lessons.push({ title: l.title, module: acc.moduleTitle, link, status: 'open', content: clip(l.body.trim(), a.limits.lessonExcerptChars) });
      sources.lessonIds.push(l.id);
    } else {
      lessons.push({ title: l.title, module: acc.moduleTitle, link, status: 'locked', howToUnlock: howToUnlock(acc) });
      sources.lockedLessonIds.push(l.id);
    }
  }

  // Mục lục (tên module + số bài + khóa/mở) — trả lời "lộ trình học", "có những bài gì" mà không lộ nội dung.
  const byModule = new Map<string, { lessons: number; locked: number; sample?: LessonAccess }>();
  for (const acc of access.values()) {
    const m = byModule.get(acc.moduleTitle) ?? { lessons: 0, locked: 0 };
    m.lessons++;
    if (!acc.open) {
      m.locked++;
      m.sample ??= acc;
    }
    byModule.set(acc.moduleTitle, m);
  }
  const curriculum = [...byModule.entries()].slice(0, 20).map(([module, m]) => ({
    module,
    lessons: m.lessons,
    locked: m.locked === m.lessons && m.lessons > 0,
    ...(m.locked === m.lessons && m.sample ? { howToUnlock: howToUnlock(m.sample) } : {}),
  }));

  const eventRows = [...matchedEvents, ...upcoming.filter((e) => !matchedEvents.some((m) => m.id === e.id))].slice(0, 6);
  sources.postIds = postHits.ids;
  sources.eventIds = eventRows.map((e) => e.id);

  const rules = Array.isArray(community.rules) ? (community.rules as { title?: unknown; body?: unknown }[]) : [];
  return {
    community: {
      name: community.title,
      description: clip(community.description, 1200),
      promise: community.promise,
      benefits: community.benefits.slice(0, 10),
      rules: rules.slice(0, 15).map((r) => ({ title: String(r.title ?? ''), body: clip(String(r.body ?? ''), 300) })),
      instructor: [community.instructorName, community.instructorRole].filter(Boolean).join(' — '),
      price: priceOf(community),
    },
    sampleAnswers: qa.map((q) => ({ id: q.id, question: q.question, answer: q.answer })),
    documents: chunks.map((c) => ({ document: c.documentTitle, section: c.heading, content: c.content })),
    lessons,
    curriculum,
    posts: postHits.views,
    events: eventRows.map((e) => ({ title: e.title, startAt: vnTime(e.startAt), description: clip(e.description, 300), cancelled: Boolean(e.cancelledAt) })),
    mySubscription: sub ? { status: sub.status, renewsAt: vnTime(sub.currentPeriodEnd), cancelAtPeriodEnd: sub.cancelAtPeriodEnd } : null,
    sources,
  };
}

/** Văn bản nguồn cho guardrail đầu ra (con số trong câu trả lời phải có ở đây hoặc trong tin khách). */
export const communitySourcesOf = (c: CommunityContext, userText: string): string[] => [userText, JSON.stringify({ ...c, sources: undefined })];
