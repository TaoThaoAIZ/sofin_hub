import { prisma, type Tx } from '../../db/prisma.js';
import type { PointEvent as DbPointEvent } from '../../generated/prisma/client.js';
import type { LeaderboardWindow, PointEvent, PointReason, PointSource } from './points.types.js';

/**
 * Sổ điểm (Postgres, bảng PointEvent — append-only). Mọi tổng hợp (theo cửa sổ 7d/30d/all, theo cộng đồng, theo user)
 * là truy vấn SUM/GROUP BY trong DB, không tải sự kiện về bộ nhớ.
 */
export interface PointsRepository {
  /**
   * Cộng điểm. Có `source` ⇒ idempotent theo khóa nghiệp vụ (userId, reason, sourceType, sourceId): lần thứ hai trả `undefined`, không cộng.
   * Không có `source` (dòng cũ/ngoại lệ) ⇒ luôn ghi.
   */
  award(userId: string, communityId: string, reason: PointReason, points: number, source?: PointSource): Promise<PointEvent | undefined>;
  /**
   * Tổng điểm theo người trong 1 cộng đồng và cửa sổ thời gian, điểm cao trước (hòa: userId tăng dần).
   * Chỉ tính người đang là thành viên (có Enrollment, không bị cấm) và tổng > 0.
   */
  totalsByCourse(communityId: string, window: LeaderboardWindow, limit?: number): Promise<{ userId: string; points: number }[]>;
  totalFor(communityId: string, userId: string, window: LeaderboardWindow): Promise<number>;
  /** Tổng chung + theo cộng đồng + các sự kiện gần nhất (mới trước). */
  summaryForUser(userId: string, recentLimit: number): Promise<{
    total: number;
    byCourse: { communityId: string; courseId: string; points: number }[];
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
  communityId: e.communityId,
  courseId: e.communityId,
  points: e.points,
  reason: e.reason,
  ...(e.sourceType ? { sourceType: e.sourceType } : {}),
  ...(e.sourceId ? { sourceId: e.sourceId } : {}),
  createdAt: e.createdAt.toISOString(),
});

/**
 * Điểm âm bù cho mọi điểm đã sinh từ 1 nguồn (bài viết/sự kiện) — gọi TRONG cùng transaction với việc xóa nguồn.
 * `related`: các nguồn con cùng gốc (vd. like_received của bài: sourceId bắt đầu bằng `${postId}:`). Mỗi (user, nguồn) chỉ bù 1 lần (unique).
 */
export async function revokePointsInTx(tx: Tx, spec: { sourceType: PointSource['type']; sourceId: string; related?: { sourceType: PointSource['type']; idPrefix: string } }): Promise<number> {
  const groups = await tx.pointEvent.groupBy({
    by: ['userId', 'communityId'],
    where: {
      reason: { not: 'revoked' },
      OR: [{ sourceType: spec.sourceType, sourceId: spec.sourceId }, ...(spec.related ? [{ sourceType: spec.related.sourceType, sourceId: { startsWith: spec.related.idPrefix } }] : [])],
    },
    _sum: { points: true },
  });
  const data = groups
    .filter((g) => (g._sum.points ?? 0) > 0)
    .map((g) => ({ userId: g.userId, communityId: g.communityId, points: -(g._sum.points ?? 0), reason: 'revoked' as const, sourceType: spec.sourceType, sourceId: spec.sourceId }));
  if (data.length === 0) return 0;
  const r = await tx.pointEvent.createMany({ data, skipDuplicates: true });
  return r.count;
}

export const pointsRepository: PointsRepository = {
  async award(userId, communityId, reason, points, source) {
    if (!source) return toEvent(await prisma.pointEvent.create({ data: { userId, communityId, reason, points } }));
    const data = { userId, communityId, reason, points, sourceType: source.type, sourceId: source.id };
    const r = await prisma.pointEvent.createMany({ data: [data], skipDuplicates: true });
    if (r.count === 0) return undefined; // đã cộng cho khóa nghiệp vụ này rồi
    return toEvent((await prisma.pointEvent.findFirst({ where: { userId, reason, sourceType: source.type, sourceId: source.id } }))!);
  },

  async totalsByCourse(communityId, window, limit) {
    const since = windowStart(window);
    const rows = await prisma.$queryRaw<{ userId: string; points: number }[]>`
      SELECT p."userId" AS "userId", SUM(p."points")::int AS "points"
      FROM "PointEvent" p
      JOIN "Enrollment" e ON e."courseId" = p."courseId" AND e."userId" = p."userId"
      WHERE p."courseId" = ${communityId}
        AND (${since}::timestamp IS NULL OR p."createdAt" >= ${since}::timestamp)
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = p."courseId" AND b."userId" = p."userId")
      GROUP BY p."userId"
      HAVING SUM(p."points") > 0
      ORDER BY "points" DESC, p."userId" ASC
      LIMIT ${limit ?? null}`;
    return rows;
  },

  async totalFor(communityId, userId, window) {
    const since = windowStart(window);
    const agg = await prisma.pointEvent.aggregate({
      where: { communityId, userId, ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { points: true },
    });
    return agg._sum.points ?? 0;
  },

  async summaryForUser(userId, recentLimit) {
    const [groups, recent] = await Promise.all([
      prisma.pointEvent.groupBy({ by: ['communityId'], where: { userId }, _sum: { points: true }, orderBy: { communityId: 'asc' } }),
      recentLimit > 0
        ? prisma.pointEvent.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: recentLimit })
        : Promise.resolve([]),
    ]);
    const byCourse = groups.map((g) => ({ communityId: g.communityId, courseId: g.communityId, points: g._sum.points ?? 0 }));
    return { total: byCourse.reduce((s, c) => s + c.points, 0), byCourse, recent: recent.map(toEvent) };
  },
};
