import { randomUUID } from 'node:crypto';
import { centsToUsd, usdToCents } from '../../db/enums.js';
import { prisma } from '../../db/prisma.js';
import { Prisma as PrismaNamespace, type Community as DbCommunity, type Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import type { Community, CommunityPatch } from './community.types.js';
import { rankedScores } from '../discovery/ranking.js';
import { matchingCourseIds } from '../search/search.repository.js';
import type { ListCommunitiesQuery } from './catalog.schema.js';

export interface CommunityBriefRow {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
  visibility: string;
}

export interface CommunityMemberStats {
  /** Số thành viên đang hoạt động trong 15 phút gần nhất (thật). */
  online: number;
  /** Số owner + admin thật (không tính người bị ban). */
  admins: number;
}

/** Lớp truy cập dữ liệu khóa học/cộng đồng (Postgres qua Prisma, bảng Community). */
export interface CatalogRepository {
  /**
   * Danh sách công khai. Mặc định chỉ cộng đồng `discoveryStatus=listed`; `forSearch` (tìm kiếm nội bộ) lấy cả hidden/unlisted
   * nhưng loại những cộng đồng đặt `searchVisibility=hidden`.
   */
  findMany(query: ListCommunitiesQuery, opts?: { forSearch?: boolean }): Promise<{ items: Community[]; total: number }>;
  findById(id: string): Promise<Community | undefined>;
  /** Thông tin tóm tắt nhiều cộng đồng (chưa xóa mềm) bằng 1 truy vấn, không đếm thành viên: id → brief. */
  findBriefs(ids: string[]): Promise<Map<string, CommunityBriefRow>>;
  /** Kiểm tra nhẹ (1 truy vấn, không đếm thành viên): cộng đồng còn tồn tại (chưa xóa mềm) không và có đang bị khóa không. */
  lockState(id: string): Promise<{ locked: boolean } | undefined>;
  countByCategory(): Promise<Record<string, number>>;
  /** Thêm cộng đồng do người dùng tạo. */
  create(community: Community): Promise<Community>;
  /** Sửa một phần; trả về bản mới hoặc undefined nếu không có. */
  update(id: string, patch: CommunityPatch): Promise<Community | undefined>;
  /** Slug đã dùng (kể cả cộng đồng đã xóa mềm) — để sinh id duy nhất. */
  idExists(id: string): Promise<boolean>;
  /** Lý do khóa (Community.lockReason); undefined nếu không bị khóa. */
  getLockReason(id: string): Promise<string | undefined>;
  memberStats(id: string): Promise<CommunityMemberStats>;
  /**
   * Tạo cộng đồng + ghi danh Owner + khóa học mặc định trong MỘT transaction; slug `baseSlug`, `baseSlug-2`, ... — va chạm (đua) thì thử slug kế tiếp
   * thay vì lỗi 500. Trả cộng đồng đã tạo và id khóa học mặc định.
   */
  createWithOwner(community: Omit<Community, 'id'>, baseSlug: string, ownerId: string): Promise<{ community: Community; defaultCourseId: string }>;
  /** Số bài học thật mà thành viên thấy (module published, chưa gỡ; bài không ẩn/gỡ). */
  lessonCount(id: string): Promise<number>;
  /** Khóa học đang xuất bản của cộng đồng: số lượng + id khóa mặc định (position nhỏ nhất). */
  courseInfo(id: string): Promise<{ coursesCount: number; defaultCourseId: string | null }>;
}

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');

/**
 * Số thành viên THẬT của từng cộng đồng: ghi danh không bị ban, bỏ thành viên minh họa (isDemo).
 * Cộng đồng seed cộng thêm vào số nền `Community.students`; cộng đồng người dùng tạo chỉ dùng số thật.
 */
async function realMemberCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ communityId: string; n: number }[]>`
    SELECT e."courseId" AS "communityId", COUNT(*)::int AS n
    FROM "Enrollment" e
    JOIN "User" u ON u."id" = e."userId"
    WHERE e."courseId" = ANY(${ids}::text[])
      AND u."isDemo" = false
      AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
    GROUP BY e."courseId"`;
  return new Map(rows.map((r) => [r.communityId, r.n]));
}

/**
 * Số bài học THẬT hiển thị với thành viên của từng cộng đồng (module published + bài không ẩn/gỡ, thuộc khóa học published chưa gỡ).
 * `Community.lessons` (cột seed) không còn được trả ra — số này luôn tính từ lớp học.
 */
async function realLessonCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ communityId: string; n: number }[]>`
    SELECT l."courseId" AS "communityId", COUNT(*)::int AS n
    FROM "ClassroomLesson" l
    JOIN "ClassroomModule" m ON m."id" = l."moduleId" AND m."publishStatus" = 'published' AND m."removedAt" IS NULL
    JOIN "LearningCourse" lc ON lc."id" = m."learningCourseId" AND lc."publishStatus" = 'published' AND lc."removedAt" IS NULL
    WHERE l."courseId" = ANY(${ids}::text[]) AND NOT l."hidden" AND l."removedAt" IS NULL
    GROUP BY l."courseId"`;
  return new Map(rows.map((r) => [r.communityId, r.n]));
}

/** Cộng đồng seed = có trendingRank (người dùng tạo thì null). */
const isSeedRow = (row: DbCommunity) => row.trendingRank !== null;

function toCommunity(row: DbCommunity, real: number, lessons: number): Community {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tag: row.tag,
    thumbnail: row.thumbnail,
    instructor: { name: row.instructorName, role: row.instructorRole },
    lessons,
    durationMinutes: row.durationMinutes,
    students: (isSeedRow(row) ? row.students : 0) + real,
    rating: row.rating,
    ratingCount: row.ratingCount,
    priceUsd: centsToUsd(row.priceCents),
    pricing: row.pricing,
    visibility: row.visibility,
    status: row.status,
    language: row.language,
    createdAt: row.createdAt.toISOString(),
    ...(row.searchVisibility !== 'searchable' ? { searchVisibility: row.searchVisibility } : {}),
    // Chỉ thêm khi có giá trị để hình dạng JSON giữ nguyên như bản cũ.
    ...(row.ownerId ? { ownerId: row.ownerId } : {}),
    ...(row.locked ? { locked: true } : {}),
    ...(row.deletedAt ? { deletedAt: row.deletedAt.toISOString() } : {}),
  };
}

async function withCounts(rows: DbCommunity[]): Promise<Community[]> {
  const ids = rows.map((r) => r.id);
  const [counts, lessons] = await Promise.all([realMemberCounts(ids), realLessonCounts(ids)]);
  return rows.map((r) => toCommunity(r, counts.get(r.id) ?? 0, lessons.get(r.id) ?? 0));
}

const rankOf = (r: DbCommunity) => r.trendingRank ?? 1e9;

const sorters: Record<ListCommunitiesQuery['sort'], (a: DbCommunity, b: DbCommunity) => number> = {
  // Cộng đồng mới tạo (không có trong seed) xếp sau seed, mới hơn lên trước.
  // Điểm `ranked` được gán ở findMany (cần dữ liệu thật); ở đây chỉ là thứ tự dự phòng.
  ranked: (a, b) => rankOf(a) - rankOf(b) || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id),
  trending: (a, b) => rankOf(a) - rankOf(b) || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id),
  top: (a, b) =>
    b.rating * Math.log1p(b.ratingCount) - a.rating * Math.log1p(a.ratingCount) ||
    rankOf(a) - rankOf(b) ||
    b.createdAt.getTime() - a.createdAt.getTime(),
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id),
};

/** Bản dịch patch domain -> cột Prisma (chỉ các trường có mặt trong patch). */
function toRowPatch(patch: CommunityPatch): Prisma.CommunityUpdateInput {
  const data: Prisma.CommunityUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.tag !== undefined) data.tag = patch.tag;
  if (patch.thumbnail !== undefined) data.thumbnail = patch.thumbnail;
  if (patch.instructor !== undefined) {
    data.instructorName = patch.instructor.name;
    data.instructorRole = patch.instructor.role;
  }
  if (patch.lessons !== undefined) data.lessons = patch.lessons;
  if (patch.durationMinutes !== undefined) data.durationMinutes = patch.durationMinutes;
  if (patch.students !== undefined) data.students = patch.students;
  if (patch.rating !== undefined) data.rating = patch.rating;
  if (patch.ratingCount !== undefined) data.ratingCount = patch.ratingCount;
  if (patch.priceUsd !== undefined) data.priceCents = usdToCents(patch.priceUsd);
  if (patch.pricing !== undefined) data.pricing = patch.pricing;
  if (patch.visibility !== undefined) data.visibility = patch.visibility;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.language !== undefined) data.language = patch.language;
  if (patch.ownerId !== undefined) data.owner = { connect: { id: patch.ownerId } };
  if (patch.locked !== undefined) data.locked = patch.locked;
  if (patch.lockReason !== undefined) data.lockReason = patch.lockReason;
  if (patch.deletedAt !== undefined) data.deletedAt = new Date(patch.deletedAt);
  return data;
}

/** Domain -> dữ liệu tạo dòng Community. */
function toRowCreate(community: Community): Prisma.CommunityUncheckedCreateInput {
  return {
    id: community.id,
    title: community.title,
    description: community.description,
    category: community.category,
    tag: community.tag,
    thumbnail: community.thumbnail,
    instructorName: community.instructor.name,
    instructorRole: community.instructor.role,
    lessons: community.lessons,
    durationMinutes: community.durationMinutes,
    students: community.students,
    rating: community.rating,
    ratingCount: community.ratingCount,
    priceCents: usdToCents(community.priceUsd),
    pricing: community.pricing,
    visibility: community.visibility,
    status: community.status,
    language: community.language,
    ownerId: community.ownerId ?? null,
    locked: community.locked ?? false,
    createdAt: new Date(community.createdAt),
  };
}

export const catalogRepository: CatalogRepository = {
  async findMany({ q, category, pricing, visibility, status, language, sort, page, limit }, opts = {}) {
    // Cộng đồng bị xóa mềm hoặc bị khóa không xuất hiện ở danh sách công khai.
    const where: Prisma.CommunityWhereInput = { deletedAt: null, locked: false, moderationStatus: 'active', category, pricing, visibility, status, language };
    if (opts.forSearch) where.searchVisibility = { not: 'hidden' };
    else {
      where.discoveryStatus = 'listed';
      if (q) where.searchVisibility = { not: 'hidden' }; // Admin ẩn khỏi tìm kiếm => cũng không ra khi lọc theo từ khóa
    }
    const needle = q ? normalize(q) : '';

    // Không tìm kiếm + sort trending/newest: để DB sắp xếp và phân trang.
    if (!needle && sort !== 'top' && sort !== 'ranked') {
      const orderBy: Prisma.CommunityOrderByWithRelationInput[] =
        sort === 'trending'
          ? [{ trendingRank: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }];
      const [rows, total] = await Promise.all([
        prisma.community.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
        prisma.community.count({ where }),
      ]);
      return { items: await withCounts(rows), total };
    }

    // Có từ khóa: SQL (tsvector + trigram, không dấu) chọn id khớp; chỉ nạp các khóa học đó (không còn đọc cả bảng rồi lọc trong JS).
    // sort "top" (rating*ln(1+count)) và "ranked" cần dữ liệu thật nên vẫn sắp xếp trên tập đã lọc nhỏ này.
    if (needle) where.id = { in: await matchingCourseIds(q!) };
    let rows = await prisma.community.findMany({ where });
    rows.sort(sorters[sort]);
    if (sort === 'ranked') {
      const scores = await rankedScores(rows.map((r) => r.id));
      rows = rows.map((r, i) => ({ r, i })).sort((a, b) => (scores.get(b.r.id) ?? 0) - (scores.get(a.r.id) ?? 0) || a.i - b.i).map((x) => x.r);
    }
    // `reduced`: giảm hiển thị khi tìm kiếm — xếp sau mọi kết quả `searchable` (sắp ổn định nên thứ tự cũ được giữ trong mỗi nhóm).
    if (needle) rows = rows.map((r, i) => ({ r, i })).sort((a, b) => Number(a.r.searchVisibility === 'reduced') - Number(b.r.searchVisibility === 'reduced') || a.i - b.i).map((x) => x.r);
    const start = (page - 1) * limit;
    return { items: await withCounts(rows.slice(start, start + limit)), total: rows.length };
  },

  async findById(id) {
    const row = await prisma.community.findFirst({ where: { id, deletedAt: null } });
    return row ? (await withCounts([row]))[0] : undefined;
  },

  async findBriefs(ids) {
    if (ids.length === 0) return new Map();
    const rows = await prisma.community.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, title: true, thumbnail: true, category: true, visibility: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  },

  async lockState(id) {
    const row = await prisma.community.findFirst({ where: { id, deletedAt: null }, select: { locked: true } });
    return row ? { locked: row.locked } : undefined;
  },

  async countByCategory() {
    const groups = await prisma.community.groupBy({ by: ['category'], where: { deletedAt: null, locked: false, moderationStatus: 'active', discoveryStatus: 'listed' }, _count: { _all: true } });
    return Object.fromEntries(groups.map((g) => [g.category, g._count._all]));
  },

  async createWithOwner(community, baseSlug, ownerId) {
    for (let n = 1; n <= 100; n++) {
      const id = n === 1 ? baseSlug : `${baseSlug}-${n}`;
      if (await prisma.community.findUnique({ where: { id }, select: { id: true } })) continue; // nhanh: bỏ qua slug đã có
      try {
        const { row, defaultCourseId } = await prisma.$transaction(async (tx) => {
          const row = await tx.community.create({ data: { ...toRowCreate({ ...community, id }) } });
          await tx.enrollment.create({ data: { userId: ownerId, communityId: id, role: 'owner' } });
          const course = await tx.course.create({ data: { id: randomUUID(), communityId: id, title: community.title, description: community.description, position: 1, publishStatus: 'published' } });
          return { row, defaultCourseId: course.id };
        });
        return { community: (await withCounts([row]))[0]!, defaultCourseId };
      } catch (e) {
        if (e instanceof PrismaNamespace.PrismaClientKnownRequestError && e.code === 'P2002') continue; // slug bị người khác lấy giữa lúc kiểm tra và ghi
        throw e;
      }
    }
    throw HttpError.conflict('Không tạo được địa chỉ (slug) cho cộng đồng, hãy đổi tên');
  },

  async create(community) {
    const row = await prisma.community.create({ data: toRowCreate(community) });
    return (await withCounts([row]))[0]!;
  },

  async update(id, patch) {
    try {
      const data = toRowPatch(patch);
      // updateMany-kiểu điều kiện "chưa xóa mềm" qua where kép: update chỉ nhận unique nên kiểm tra trước.
      const exists = await prisma.community.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!exists) return undefined;
      const row = await prisma.community.update({ where: { id }, data });
      return (await withCounts([row]))[0];
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') return undefined;
      throw e;
    }
  },

  async idExists(id) {
    return (await prisma.community.count({ where: { id } })) > 0;
  },

  async getLockReason(id) {
    const row = await prisma.community.findUnique({ where: { id }, select: { locked: true, lockReason: true } });
    return row?.locked ? (row.lockReason ?? undefined) : undefined;
  },

  async memberStats(id) {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS);
    const [row] = await prisma.$queryRaw<{ online: number; admins: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE e."lastActiveAt" >= ${since})::int AS online,
        COUNT(*) FILTER (WHERE e."role" IN ('admin', 'owner'))::int AS admins
      FROM "Enrollment" e
      WHERE e."courseId" = ${id}
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")`;
    return { online: row?.online ?? 0, admins: row?.admins ?? 0 };
  },

  async courseInfo(id) {
    const rows = await prisma.course.findMany({
      where: { communityId: id, publishStatus: 'published', removedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    return { coursesCount: rows.length, defaultCourseId: rows[0]?.id ?? null };
  },

  async lessonCount(id) {
    return prisma.classroomLesson.count({
      where: { communityId: id, hidden: false, removedAt: null, module: { publishStatus: 'published', removedAt: null, course: { publishStatus: 'published', removedAt: null } } },
    });
  },
};

/** @deprecated Tên cũ (từng là seed trong bộ nhớ). Nay là Prisma; dùng `catalogRepository`. Giữ alias để module khác (meta) không vỡ. */
export const inMemoryCatalogRepository: CatalogRepository = catalogRepository;
