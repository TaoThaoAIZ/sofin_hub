import { pointsRepository, type PointsRepository } from './points.repository.js';
import { POINT_VALUES, type LeaderboardRow, type LeaderboardWindow, type PointReason } from './points.types.js';

export function createPointsService(repo: PointsRepository = pointsRepository) {
  return {
    award(userId: string, courseId: string, reason: PointReason) {
      return repo.award(userId, courseId, reason, POINT_VALUES[reason]);
    },

    /** Bảng xếp hạng (tổng hợp trong DB); `limit` cắt top N. */
    async leaderboard(courseId: string, window: LeaderboardWindow, limit?: number): Promise<LeaderboardRow[]> {
      const rows = await repo.totalsByCourse(courseId, window, limit);
      return rows.map((row, i) => ({ ...row, rank: i + 1 }));
    },

    totalFor(courseId: string, userId: string, window: LeaderboardWindow): Promise<number> {
      return repo.totalFor(courseId, userId, window);
    },

    /** Tổng điểm theo từng cộng đồng + tổng chung + các sự kiện gần nhất (mới trước). */
    summaryForUser(userId: string, recentLimit = 20) {
      return repo.summaryForUser(userId, recentLimit);
    },
  };
}

export const pointsService = createPointsService();
