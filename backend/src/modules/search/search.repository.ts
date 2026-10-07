import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { normalizeText } from './search.text.js';

/**
 * Truy vấn tìm kiếm trong Postgres (STEP 8 audit): lọc + xếp hạng + phân trang ở SQL, dựa trên các cột `searchVector`
 * (tsvector GENERATED, đã gập dấu bằng sf_fold) và chỉ mục pg_trgm. Quy tắc hiển thị (khóa/xóa/ẩn/gỡ/searchVisibility, thành viên bị cấm...)
 * nằm trong WHERE nên cả số đếm lẫn trang kết quả đều chính xác.
 *
 * Một từ khóa khớp khi MỘT trong các điều kiện sau đúng:
 *  1. toàn văn (cấu hình `simple` + chữ không dấu): MỌI từ trong q là tiền tố của một từ trong văn bản (gõ dở từ vẫn khớp);
 *  2. chuỗi con không dấu trong trường ngắn (tên khóa học / tên thành viên) — dùng chỉ mục trigram;
 *  3. gõ sai chính tả trên trường ngắn (pg_trgm word_similarity), chỉ khi từ khóa >= 4 ký tự.
 */
export interface SearchTerms {
  /** Từ khóa đã gập dấu + chữ thường. */
  needle: string;
  tokens: string[];
  /** Chuỗi to_tsquery (`a:* & b:*`) hoặc null nếu không có từ nào dùng được. */
  tsq: string | null;
  /** Mẫu LIKE (đã escape) cho khớp chuỗi con. */
  like: string;
  fuzzy: boolean;
  /** needle có '-' => khớp thêm theo slug của handle (tên-nối-gạch). */
  slugLike: boolean;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function buildTerms(q: string, trgmAvailable = true): SearchTerms {
  const needle = normalizeText(q).replace(/\s+/g, ' ').trim();
  const tokens = needle.split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 10);
  return {
    needle,
    tokens,
    tsq: tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null,
    like: `%${escapeLike(needle)}%`,
    fuzzy: trgmAvailable && needle.length >= 4,
    slugLike: needle.includes('-'),
  };
}

let trgmSchemaP: Promise<string | null> | undefined;
/** Schema chứa extension pg_trgm (toán tử/hàm phải kèm schema vì search_path chỉ có schema của app). null nếu chưa cài. */
export function trgmSchema(): Promise<string | null> {
  return (trgmSchemaP ??= prisma
    .$queryRaw<{ s: string }[]>`SELECT n.nspname AS s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm'`
    .then((r) => r[0]?.s ?? null)
    .catch(() => null));
}

const ident = (s: string) => Prisma.raw(`"${s.replaceAll('"', '""')}"`);

export interface CourseHit {
  id: string;
  title: string;
  description: string;
}
export interface MemberHit {
  id: string;
  courseId: string;
  courseTitle: string;
  firstName: string;
  lastName: string;
  role: 'member' | 'mod' | 'admin' | 'owner';
}
export interface PostHit {
  id: string;
  courseId: string;
  courseTitle: string;
  content: string;
  tags: string[];
  createdAt: Date;
  authorName: string;
}

export interface PageSpec {
  offset: number;
  limit: number;
}

const tsqOf = (t: SearchTerms) => Prisma.sql`to_tsquery('simple', ${t.tsq})`;

/** Biểu thức tên đã gập dấu — phải GIỐNG HỆT biểu thức của chỉ mục User_name_trgm_idx. */
const userFold = (a: string) => Prisma.raw(`sf_fold(${a}."firstName" || ' ' || ${a}."lastName")`);

function fuzzyOp(t: SearchTerms, S: string | null, expr: Prisma.Sql) {
  return t.fuzzy && S ? Prisma.sql`${t.needle} OPERATOR(${ident(S)}.<%) ${expr}` : null;
}
function wordSim(t: SearchTerms, S: string | null, expr: Prisma.Sql) {
  return t.fuzzy && S ? Prisma.sql`${ident(S)}.word_similarity(${t.needle}, ${expr})` : Prisma.sql`0`;
}

function userMatch(a: string, t: SearchTerms, S: string | null, opts: { fuzzy: boolean; slug: boolean }) {
  const fold = userFold(a);
  const parts: Prisma.Sql[] = [Prisma.sql`${fold} LIKE ${t.like}`];
  if (t.tsq) parts.push(Prisma.sql`${Prisma.raw(`${a}."searchVector"`)} @@ ${tsqOf(t)}`);
  if (opts.fuzzy) {
    const f = fuzzyOp(t, S, fold);
    if (f) parts.push(f);
  }
  if (opts.slug && t.slugLike) parts.push(Prisma.sql`regexp_replace(${fold}, '[^a-z0-9]+', '-', 'g') LIKE ${t.like}`);
  return Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
}

function userScore(a: string, t: SearchTerms, S: string | null) {
  const fold = userFold(a);
  const rank = t.tsq ? Prisma.sql`ts_rank(${Prisma.raw(`${a}."searchVector"`)}, ${tsqOf(t)}, 1)` : Prisma.sql`0`;
  return Prisma.sql`(CASE WHEN ${fold} LIKE ${t.like} THEN 1 ELSE 0 END + ${rank} + 0.5 * ${wordSim(t, S, fold)})`;
}

/** Khóa học công khai tìm được: chưa xóa/khóa, đang `active`, không bị admin ẩn khỏi tìm kiếm (listed/unlisted đều được). */
/**
 * Điều kiện khớp văn bản cho khóa học (không kèm quy tắc hiển thị) — dùng chung cho tìm kiếm toàn cục và `GET /courses?q=`.
 * CHỈ tìm theo tiêu đề (không mô tả, không tên giảng viên): chuỗi con không phân biệt hoa/thường/dấu OR gõ sai tên. Alias bảng bắt buộc là `c`.
 */
export function courseTextMatch(t: SearchTerms, S: string | null) {
  const title = Prisma.sql`sf_fold(c."title")`;
  const parts: Prisma.Sql[] = [Prisma.sql`${title} LIKE ${t.like}`];
  const f = fuzzyOp(t, S, title);
  if (f) parts.push(f);
  return Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
}

/** Id các khóa học khớp văn bản (chưa lọc quyền hiển thị — caller lọc tiếp bằng Prisma where). */
export async function matchingCourseIds(q: string): Promise<string[]> {
  const S = await trgmSchema();
  const t = buildTerms(q, S !== null);
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT c."id" FROM "Course" c WHERE ${courseTextMatch(t, S)}`;
  return rows.map((r) => r.id);
}

function courseWhere(t: SearchTerms, S: string | null, courseId?: string) {
  return Prisma.sql`c."deletedAt" IS NULL AND NOT c."locked" AND c."moderationStatus" = 'active' AND c."searchVisibility" <> 'hidden' AND c."visibility" = 'public'
    ${courseId ? Prisma.sql`AND c."id" = ${courseId}` : Prisma.empty}
    AND ${courseTextMatch(t, S)}`;
}

function memberFrom(ids: string[], t: SearchTerms, S: string | null) {
  return Prisma.sql`
    FROM "Enrollment" e
    JOIN "User" u ON u."id" = e."userId"
    JOIN "Course" c ON c."id" = e."courseId"
    WHERE e."courseId" = ANY(${ids}::text[])
      AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      AND ${userMatch('u', t, S, { fuzzy: true, slug: true })}`;
}

/** Bài tìm được: không bị gỡ; bài ẩn chỉ mod trở lên (hoặc Platform Admin) thấy — tác giả KHÔNG tự thấy bài ẩn của mình ở đây (như bản cũ). */
function postFrom(ids: string[], t: SearchTerms, S: string | null, viewerId: string, viewerIsPlatformAdmin: boolean) {
  const matchParts: Prisma.Sql[] = [
    Prisma.sql`p."authorId" IN (SELECT au."id" FROM "User" au WHERE ${userMatch('au', t, S, { fuzzy: false, slug: false })})`,
  ];
  if (t.tsq) matchParts.unshift(Prisma.sql`p."searchVector" @@ ${tsqOf(t)}`);
  return Prisma.sql`
    FROM "Post" p
    JOIN "Course" c ON c."id" = p."courseId"
    JOIN "User" u ON u."id" = p."authorId"
    WHERE p."courseId" = ANY(${ids}::text[])
      AND p."removedAt" IS NULL
      AND (NOT p."hidden" OR ${viewerIsPlatformAdmin}::boolean OR EXISTS (
            SELECT 1 FROM "Enrollment" ve WHERE ve."userId" = ${viewerId} AND ve."courseId" = p."courseId" AND ve."role" IN ('mod', 'admin', 'owner')))
      AND (${Prisma.join(matchParts, ' OR ')})`;
}

export const searchRepository = {
  /** Cộng đồng user đang là thành viên (không bị cấm, chưa xóa mềm, không bị khóa), theo thứ tự tham gia. */
  async scopeCourseIds(userId: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT c."id" FROM "Enrollment" e
      JOIN "Course" c ON c."id" = e."courseId"
      WHERE e."userId" = ${userId} AND c."deletedAt" IS NULL AND NOT c."locked"
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      ORDER BY e."enrolledAt", c."id"`;
    return rows.map((r) => r.id);
  },

  async countCourses(t: SearchTerms, courseId?: string): Promise<number> {
    const S = await trgmSchema();
    const [r] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Course" c WHERE ${courseWhere(t, S, courseId)}`;
    return r?.n ?? 0;
  },

  /** Xếp hạng: searchVisibility=reduced xếp sau; rồi điểm (ts_rank + khớp chuỗi con trong tên + độ giống trigram); rồi mới nhất. */
  async pageCourses(t: SearchTerms, page: PageSpec, courseId?: string): Promise<CourseHit[]> {
    const S = await trgmSchema();
    const title = Prisma.sql`sf_fold(c."title")`;
    const rank = t.tsq ? Prisma.sql`ts_rank(c."searchVector", ${tsqOf(t)}, 1)` : Prisma.sql`0`;
    const score = Prisma.sql`(${rank} + CASE WHEN ${title} LIKE ${t.like} THEN 1 ELSE 0 END + 0.5 * ${wordSim(t, S, title)})`;
    return prisma.$queryRaw<CourseHit[]>`
      SELECT c."id", c."title", c."description" FROM "Course" c
      WHERE ${courseWhere(t, S, courseId)}
      ORDER BY (c."searchVisibility" = 'reduced'), ${score} DESC, c."createdAt" DESC, c."id"
      LIMIT ${page.limit} OFFSET ${page.offset}`;
  },

  async countMembers(ids: string[], t: SearchTerms): Promise<number> {
    if (ids.length === 0) return 0;
    const S = await trgmSchema();
    const [r] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${memberFrom(ids, t, S)}`;
    return r?.n ?? 0;
  },

  async pageMembers(ids: string[], t: SearchTerms, page: PageSpec): Promise<MemberHit[]> {
    if (ids.length === 0) return [];
    const S = await trgmSchema();
    return prisma.$queryRaw<MemberHit[]>`
      SELECT u."id", e."courseId", c."title" AS "courseTitle", u."firstName", u."lastName", e."role"::text AS "role"
      ${memberFrom(ids, t, S)}
      ORDER BY ${userScore('u', t, S)} DESC, e."lastActiveAt" DESC, u."id", e."courseId"
      LIMIT ${page.limit} OFFSET ${page.offset}`;
  },

  async countPosts(ids: string[], t: SearchTerms, viewerId: string, viewerIsPlatformAdmin: boolean): Promise<number> {
    if (ids.length === 0) return 0;
    const S = await trgmSchema();
    const [r] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${postFrom(ids, t, S, viewerId, viewerIsPlatformAdmin)}`;
    return r?.n ?? 0;
  },

  async pagePosts(ids: string[], t: SearchTerms, viewerId: string, viewerIsPlatformAdmin: boolean, page: PageSpec): Promise<PostHit[]> {
    if (ids.length === 0) return [];
    const S = await trgmSchema();
    const rank = t.tsq ? Prisma.sql`ts_rank(p."searchVector", ${tsqOf(t)}, 1)` : Prisma.sql`0`;
    return prisma.$queryRaw<PostHit[]>`
      SELECT p."id", p."courseId", c."title" AS "courseTitle", p."content", p."tags", p."createdAt",
             CASE WHEN u."deletedAt" IS NULL THEN u."firstName" || ' ' || u."lastName" ELSE 'Thành viên đã xóa' END AS "authorName"
      ${postFrom(ids, t, S, viewerId, viewerIsPlatformAdmin)}
      ORDER BY ${rank} DESC, p."createdAt" DESC, p."id"
      LIMIT ${page.limit} OFFSET ${page.offset}`;
  },
};
