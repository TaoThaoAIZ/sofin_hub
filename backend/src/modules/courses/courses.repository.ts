import { centsToUsd, usdToCents } from '../../db/enums.js';
import { prisma } from '../../db/prisma.js';
import type { Course as DbCourse, Prisma } from '../../generated/prisma/client.js';
import type { Course, CoursePatch } from './course.types.js';
import { rankedScores } from '../discovery/ranking.js';
import type { ListCoursesQuery } from './courses.schema.js';

export interface CourseMemberStats {
  /** Số thành viên đang hoạt động trong 15 phút gần nhất (thật). */
  online: number;
  /** Số owner + admin thật (không tính người bị ban). */
  admins: number;
}

/** Lớp truy cập dữ liệu khóa học/cộng đồng (Postgres qua Prisma, bảng Course). */
export interface CourseRepository {
  /**
   * Danh sách công khai. Mặc định chỉ cộng đồng `discoveryStatus=listed`; `forSearch` (tìm kiếm nội bộ) lấy cả hidden/unlisted
   * nhưng loại những cộng đồng đặt `searchVisibility=hidden`.
   */
  findMany(query: ListCoursesQuery, opts?: { forSearch?: boolean }): Promise<{ items: Course[]; total: number }>;
  findById(id: string): Promise<Course | undefined>;
  countByCategory(): Promise<Record<string, number>>;
  /** Thêm cộng đồng do người dùng tạo. */
  create(course: Course): Promise<Course>;
  /** Sửa một phần; trả về bản mới hoặc undefined nếu không có. */
  update(id: string, patch: CoursePatch): Promise<Course | undefined>;
  /** Slug đã dùng (kể cả cộng đồng đã xóa mềm) — để sinh id duy nhất. */
  idExists(id: string): Promise<boolean>;
  /** Lý do khóa (Course.lockReason); undefined nếu không bị khóa. */
  getLockReason(id: string): Promise<string | undefined>;
  memberStats(id: string): Promise<CourseMemberStats>;
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
 * Cộng đồng seed cộng thêm vào số nền `Course.students`; cộng đồng người dùng tạo chỉ dùng số thật.
 */
async function realMemberCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ courseId: string; n: number }[]>`
    SELECT e."courseId", COUNT(*)::int AS n
    FROM "Enrollment" e
    JOIN "User" u ON u."id" = e."userId"
    WHERE e."courseId" = ANY(${ids}::text[])
      AND u."isDemo" = false
      AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
    GROUP BY e."courseId"`;
  return new Map(rows.map((r) => [r.courseId, r.n]));
}

/** Cộng đồng seed = có trendingRank (người dùng tạo thì null). */
const isSeedRow = (row: DbCourse) => row.trendingRank !== null;

function toCourse(row: DbCourse, real: number): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tag: row.tag,
    thumbnail: row.thumbnail,
    instructor: { name: row.instructorName, role: row.instructorRole },
    lessons: row.lessons,
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

async function withCounts(rows: DbCourse[]): Promise<Course[]> {
  const counts = await realMemberCounts(rows.map((r) => r.id));
  return rows.map((r) => toCourse(r, counts.get(r.id) ?? 0));
}

const rankOf = (r: DbCourse) => r.trendingRank ?? 1e9;

const sorters: Record<ListCoursesQuery['sort'], (a: DbCourse, b: DbCourse) => number> = {
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
function toRowPatch(patch: CoursePatch): Prisma.CourseUpdateInput {
  const data: Prisma.CourseUpdateInput = {};
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

export const courseRepository: CourseRepository = {
  async findMany({ q, category, pricing, visibility, status, language, sort, page, limit }, opts = {}) {
    // Cộng đồng bị xóa mềm hoặc bị khóa không xuất hiện ở danh sách công khai.
    const where: Prisma.CourseWhereInput = { deletedAt: null, locked: false, moderationStatus: 'active', category, pricing, visibility, status, language };
    if (opts.forSearch) where.searchVisibility = { not: 'hidden' };
    else {
      where.discoveryStatus = 'listed';
      if (q) where.searchVisibility = { not: 'hidden' }; // Admin ẩn khỏi tìm kiếm => cũng không ra khi lọc theo từ khóa
    }
    const needle = q ? normalize(q) : '';

    // Không tìm kiếm + sort trending/newest: để DB sắp xếp và phân trang.
    if (!needle && sort !== 'top' && sort !== 'ranked') {
      const orderBy: Prisma.CourseOrderByWithRelationInput[] =
        sort === 'trending'
          ? [{ trendingRank: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }];
      const [rows, total] = await Promise.all([
        prisma.course.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
        prisma.course.count({ where }),
      ]);
      return { items: await withCounts(rows), total };
    }

    // Tìm kiếm tiếng Việt không dấu + sort "top" (công thức rating*ln(1+count)): lọc/sắp xếp trong bộ nhớ trên tập đã lọc theo cột.
    let rows = await prisma.course.findMany({ where });
    if (needle) {
      rows = rows.filter((c) => normalize(`${c.title} ${c.description} ${c.instructorName}`).includes(needle));
    }
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
    const row = await prisma.course.findFirst({ where: { id, deletedAt: null } });
    return row ? (await withCounts([row]))[0] : undefined;
  },

  async countByCategory() {
    const groups = await prisma.course.groupBy({ by: ['category'], where: { deletedAt: null, locked: false, moderationStatus: 'active', discoveryStatus: 'listed' }, _count: { _all: true } });
    return Object.fromEntries(groups.map((g) => [g.category, g._count._all]));
  },

  async create(course) {
    const row = await prisma.course.create({
      data: {
        id: course.id,
        title: course.title,
        description: course.description,
        category: course.category,
        tag: course.tag,
        thumbnail: course.thumbnail,
        instructorName: course.instructor.name,
        instructorRole: course.instructor.role,
        lessons: course.lessons,
        durationMinutes: course.durationMinutes,
        students: course.students,
        rating: course.rating,
        ratingCount: course.ratingCount,
        priceCents: usdToCents(course.priceUsd),
        pricing: course.pricing,
        visibility: course.visibility,
        status: course.status,
        language: course.language,
        ownerId: course.ownerId ?? null,
        locked: course.locked ?? false,
        createdAt: new Date(course.createdAt),
      },
    });
    return (await withCounts([row]))[0]!;
  },

  async update(id, patch) {
    try {
      const data = toRowPatch(patch);
      // updateMany-kiểu điều kiện "chưa xóa mềm" qua where kép: update chỉ nhận unique nên kiểm tra trước.
      const exists = await prisma.course.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!exists) return undefined;
      const row = await prisma.course.update({ where: { id }, data });
      return (await withCounts([row]))[0];
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') return undefined;
      throw e;
    }
  },

  async idExists(id) {
    return (await prisma.course.count({ where: { id } })) > 0;
  },

  async getLockReason(id) {
    const row = await prisma.course.findUnique({ where: { id }, select: { locked: true, lockReason: true } });
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
};

/** @deprecated Tên cũ (từng là seed trong bộ nhớ). Nay là Prisma; dùng `courseRepository`. Giữ alias để module khác (meta) không vỡ. */
export const inMemoryCourseRepository: CourseRepository = courseRepository;
