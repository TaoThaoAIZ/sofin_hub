import { pointsRepository, type PointsRepository } from './points.repository.js';
import { POINT_VALUES, type LeaderboardRow, type LeaderboardWindow, type PointReason, type PointSource } from './points.types.js';

export function createPointsService(repo: PointsRepository = pointsRepository) {
  return {
    /** Cộng điểm (idempotent theo `source` — xem PointSource). Trả `undefined` nếu khóa nghiệp vụ này đã được cộng. */
    award(userId: string, communityId: string, reason: PointReason, source?: PointSource) {
      return repo.award(userId, communityId, reason, POINT_VALUES[reason], source);
    },

    /** Bảng xếp hạng (tổng hợp trong DB); `limit` cắt top N. */
    async leaderboard(communityId: string, window: LeaderboardWindow, limit?: number): Promise<LeaderboardRow[]> {
      const rows = await repo.totalsByCourse(communityId, window, limit);
      return rows.map((row, i) => ({ ...row, rank: i + 1 }));
    },

    totalFor(communityId: string, userId: string, window: LeaderboardWindow): Promise<number> {
      return repo.totalFor(communityId, userId, window);
    },

    /** Tổng điểm theo từng cộng đồng + tổng chung + các sự kiện gần nhất (mới trước). */
    summaryForUser(userId: string, recentLimit = 20) {
      return repo.summaryForUser(userId, recentLimit);
    },
  };
}

export const pointsService = createPointsService();
