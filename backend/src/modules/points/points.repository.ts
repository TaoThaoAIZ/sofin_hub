import { prisma } from '../../db/prisma.js';
import type { PointEvent as DbPointEvent } from '../../generated/prisma/client.js';
import type { LeaderboardWindow, PointEvent, PointReason } from './points.types.js';

/**
 * Sổ điểm (Postgres, bảng PointEvent — append-only). Mọi tổng hợp (theo cửa sổ 7d/30d/all, theo cộng đồng, theo user)
 * là truy vấn SUM/GROUP BY trong DB, không tải sự kiện về bộ nhớ.
 */
export interface PointsRepository {
  award(userId: string, courseId: string, reason: PointReason, points: number): Promise<PointEvent>;
  /**
   * Tổng điểm theo người trong 1 cộng đồng và cửa sổ thời gian, điểm cao trước (hòa: userId tăng dần).
   * Chỉ tính người đang là thành viên (có Enrollment, không bị cấm) và tổng > 0.
   */
  totalsByCourse(courseId: string, window: LeaderboardWindow, limit?: number): Promise<{ userId: string; points: number }[]>;
  totalFor(courseId: string, userId: string, window: LeaderboardWindow): Promise<number>;
  /** Tổng chung + theo cộng đồng + các sự kiện gần nhất (mới trước). */
  summaryForUser(userId: string, recentLimit: number): Promise<{
    total: number;
    byCourse: { courseId: string; points: number }[];
    recent: PointEvent[];
  }>;
}

/** Mốc bắt đầu của cửa sổ (`null` = từ đầu). */
export function windowStart(window: LeaderboardWindow, now = new Date()): Date | null {
  if (window === 'all') return null;
  const d = new Date(now);
  d.setDate(d.getDate() - (window === '7d' ? 7 : 30));
  return d;
}

const toEvent = (e: DbPointEvent): PointEvent => ({
  id: e.id,
  userId: e.userId,
  courseId: e.courseId,
  points: e.points,
  reason: e.reason,
  createdAt: e.createdAt.toISOString(),
});

export const pointsRepository: PointsRepository = {
  async award(userId, courseId, reason, points) {
    return toEvent(await prisma.pointEvent.create({ data: { userId, courseId, reason, points } }));
  },

  async totalsByCourse(courseId, window, limit) {
    const since = windowStart(window);
    const rows = await prisma.$queryRaw<{ userId: string; points: number }[]>`
      SELECT p."userId" AS "userId", SUM(p."points")::int AS "points"
      FROM "PointEvent" p
      JOIN "Enrollment" e ON e."courseId" = p."courseId" AND e."userId" = p."userId"
      WHERE p."courseId" = ${courseId}
        AND (${since}::timestamp IS NULL OR p."createdAt" >= ${since}::timestamp)
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = p."courseId" AND b."userId" = p."userId")
      GROUP BY p."userId"
      HAVING SUM(p."points") > 0
      ORDER BY "points" DESC, p."userId" ASC
      LIMIT ${limit ?? null}`;
    return rows;
  },

  async totalFor(courseId, userId, window) {
    const since = windowStart(window);
    const agg = await prisma.pointEvent.aggregate({
      where: { courseId, userId, ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { points: true },
    });
    return agg._sum.points ?? 0;
  },

  async summaryForUser(userId, recentLimit) {
    const [groups, recent] = await Promise.all([
      prisma.pointEvent.groupBy({ by: ['courseId'], where: { userId }, _sum: { points: true }, orderBy: { courseId: 'asc' } }),
      recentLimit > 0
        ? prisma.pointEvent.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: recentLimit })
        : Promise.resolve([]),
    ]);
    const byCourse = groups.map((g) => ({ courseId: g.courseId, points: g._sum.points ?? 0 }));
    return { total: byCourse.reduce((s, c) => s + c.points, 0), byCourse, recent: recent.map(toEvent) };
  },
};
