import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { LEVELS } from '../points/points.levels.js';
import { windowStart } from '../points/points.repository.js';
import type { LeaderboardWindow } from '../points/points.types.js';
import type { MemberRole } from '../enrollments/enrollments.repository.js';

/** Một dòng thành viên (Enrollment JOIN User). */
export interface MemberRow {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: MemberRole;
  enrolledAt: string;
  lastActiveAt: string;
}

export interface MemberQuery {
  filter: 'all' | 'online' | 'admin';
  sort: 'active' | 'joined';
  /** Có `skip/take` thì phân trang ở DB; bỏ trống = trả toàn bộ (dùng khi cần lọc theo handle ở tầng service). */
  skip?: number;
  take?: number;
}

const NON_MEMBER_ROLES: MemberRole[] = ['mod', 'admin', 'owner'];

/** Điều kiện "đang là thành viên": có Enrollment và không bị cấm. */
async function bannedIds(communityId: string): Promise<string[]> {
  return (await prisma.communityBan.findMany({ where: { communityId }, select: { userId: true } })).map((b) => b.userId);
}

function baseWhere(communityId: string, banned: string[]): Prisma.EnrollmentWhereInput {
  return { communityId, ...(banned.length ? { userId: { notIn: banned } } : {}) };
}

export const communityRepository = {
  /** Đếm thành viên: tất cả / online (lastActiveAt >= since) / quản trị (mod, admin, owner). */
  async memberCounts(communityId: string, onlineSince: Date) {
    const where = baseWhere(communityId, await bannedIds(communityId));
    const [all, online, admins] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.enrollment.count({ where: { ...where, lastActiveAt: { gte: onlineSince } } }),
      prisma.enrollment.count({ where: { ...where, role: { in: NON_MEMBER_ROLES } } }),
    ]);
    return { all, online, admins };
  },

  /** Danh sách thành viên đã lọc + sắp xếp (mới hoạt động / mới tham gia trước) và tổng số khớp. */
  async listMembers(communityId: string, onlineSince: Date, q: MemberQuery): Promise<{ rows: MemberRow[]; total: number }> {
    const where: Prisma.EnrollmentWhereInput = {
      ...baseWhere(communityId, await bannedIds(communityId)),
      ...(q.filter === 'online' ? { lastActiveAt: { gte: onlineSince } } : {}),
      ...(q.filter === 'admin' ? { role: { in: NON_MEMBER_ROLES } } : {}),
    };
    const field = q.sort === 'joined' ? 'enrolledAt' : 'lastActiveAt';
    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        orderBy: [{ [field]: 'desc' }, { userId: 'asc' }],
        skip: q.skip,
        take: q.take,
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      }),
      prisma.enrollment.count({ where }),
    ]);
    return {
      rows: rows.map((e) => ({
        userId: e.userId,
        firstName: e.user.firstName,
        lastName: e.user.lastName,
        avatarUrl: e.user.avatarUrl ?? undefined,
        role: e.role,
        enrolledAt: e.enrolledAt.toISOString(),
        lastActiveAt: e.lastActiveAt.toISOString(),
      })),
      total,
    };
  },

  /** Toàn bộ thành viên (mọi cột cần cho lọc theo tên + handle) — chỉ dùng khi có từ khóa `q`. */
  async allMembers(communityId: string, onlineSince: Date, q: Pick<MemberQuery, 'filter' | 'sort'>): Promise<MemberRow[]> {
    return (await this.listMembers(communityId, onlineSince, q)).rows;
  },

  async namesOf(userIds: string[]): Promise<Map<string, { name: string; avatarUrl?: string }>> {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, avatarUrl: true } });
    return new Map(rows.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`, avatarUrl: u.avatarUrl ?? undefined }]));
  },

  /**
   * Phân bố cấp độ của mọi thành viên (kể cả người 0 điểm) theo tổng điểm `all`: level -> số thành viên.
   * Toàn bộ tính trong DB: tổng điểm theo người rồi đếm số ngưỡng cấp độ mà tổng đạt tới.
   */
  async levelDistribution(communityId: string): Promise<Map<number, number>> {
    const thresholds = LEVELS.map((l) => l.minPoints);
    const rows = await prisma.$queryRaw<{ level: number; n: number }[]>`
      SELECT (SELECT COUNT(*)::int FROM unnest(${thresholds}::int[]) t WHERE t <= m.total) AS "level", COUNT(*)::int AS "n"
      FROM (
        SELECT e."userId", COALESCE((SELECT SUM(p."points") FROM "PointEvent" p WHERE p."courseId" = e."courseId" AND p."userId" = e."userId"), 0)::int AS total
        FROM "Enrollment" e
        WHERE e."courseId" = ${communityId}
          AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      ) m
      GROUP BY 1`;
    return new Map(rows.map((r) => [r.level, r.n]));
  },

  /** Hạng của 1 thành viên (1 = đứng đầu) trong bảng xếp hạng cửa sổ `window`; null nếu chưa có điểm > 0. */
  async rankOf(communityId: string, userId: string, window: LeaderboardWindow): Promise<number | null> {
    const since = windowStart(window);
    const [row] = await prisma.$queryRaw<{ rank: number | null }[]>`
      WITH totals AS (
        SELECT p."userId" AS uid, SUM(p."points")::int AS pts
        FROM "PointEvent" p
        JOIN "Enrollment" e ON e."courseId" = p."courseId" AND e."userId" = p."userId"
        WHERE p."courseId" = ${communityId}
          AND (${since}::timestamp IS NULL OR p."createdAt" >= ${since}::timestamp)
          AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = p."courseId" AND b."userId" = p."userId")
        GROUP BY p."userId"
        HAVING SUM(p."points") > 0
      )
      SELECT (SELECT COUNT(*)::int + 1 FROM totals o WHERE o.pts > t.pts OR (o.pts = t.pts AND o.uid < t.uid)) AS "rank"
      FROM totals t WHERE t.uid = ${userId}`;
    return row?.rank ?? null;
  },
};
