import { userBriefView } from '../auth/user-view.js';
import { LEVELS, levelFor } from '../points/points.levels.js';
import { pointsService } from '../points/points.service.js';
import type { LeaderboardWindow } from '../points/points.types.js';
import { handleFor } from './community.handle.js';
import { communityRepository, type MemberRow } from './community.repository.js';
import type { ListMembersQuery } from './community.schema.js';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

interface MemberView {
  id: string;
  name: string;
  handle: string;
  role: 'admin' | 'member';
  /** Vai trò thật: member | mod | admin | owner (thêm mới, `role` cũ giữ nguyên cho FE). */
  roleDetail: 'member' | 'mod' | 'admin' | 'owner';
  enrolledAt: string;
  lastActiveAt: string;
  online: boolean;
}

export function createCommunityService(repo = communityRepository) {
  const toView = (m: MemberRow, now: number): MemberView => {
    const name = `${m.firstName} ${m.lastName}`;
    return {
      id: m.userId,
      name,
      handle: handleFor(name, m.userId),
      role: m.role === 'member' ? 'member' : 'admin', // FE chỉ phân biệt admin/member (mod/admin/owner đều là quản trị)
      roleDetail: m.role,
      enrolledAt: m.enrolledAt,
      lastActiveAt: m.lastActiveAt,
      online: now - new Date(m.lastActiveAt).getTime() < ONLINE_WINDOW_MS,
    };
  };

  return {
    async listMembers(courseId: string, query: ListMembersQuery) {
      const now = Date.now();
      const onlineSince = new Date(now - ONLINE_WINDOW_MS);
      const counts = await repo.memberCounts(courseId, onlineSince);
      const opts = { filter: query.filter, sort: query.sort };

      let views: MemberView[];
      let total: number;
      if (query.q) {
        // Tìm theo tên + handle: handle là giá trị tính khi đọc (không có cột) nên lọc ở service trên tập đã lọc/sắp xếp bởi DB.
        const q = query.q.toLowerCase();
        const matched = (await repo.allMembers(courseId, onlineSince, opts))
          .map((m) => toView(m, now))
          .filter((m) => m.name.toLowerCase().includes(q) || m.handle.includes(q));
        total = matched.length;
        const start = (query.page - 1) * query.limit;
        views = matched.slice(start, start + query.limit);
      } else {
        const { rows, total: t } = await repo.listMembers(courseId, onlineSince, {
          ...opts,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        views = rows.map((m) => toView(m, now));
        total = t;
      }
      return {
        data: views,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
        counts,
      };
    },

    async leaderboard(courseId: string, window: LeaderboardWindow) {
      const rows = await pointsService.leaderboard(courseId, window, 10);
      const names = await repo.namesOf(rows.map((r) => r.userId));
      return rows.map((r) => ({ userId: r.userId, name: names.get(r.userId) ?? '', points: r.points, rank: r.rank }));
    },

    /** Hành trình thăng cấp: danh sách cấp + % thành viên ở mỗi cấp + vị trí/điểm của người đang xem. */
    async levels(courseId: string, viewerId: string) {
      const [dist, points, rank, counts] = await Promise.all([
        repo.levelDistribution(courseId),
        pointsService.totalFor(courseId, viewerId, 'all'),
        repo.rankOf(courseId, viewerId, 'all'),
        repo.memberCounts(courseId, new Date()),
      ]);
      const cur = levelFor(points);
      const next = LEVELS.find((l) => l.level === cur.level + 1);
      const maxPoints = LEVELS[LEVELS.length - 1]!.minPoints;
      return {
        levels: LEVELS.map((l) => ({ ...l, memberPct: Math.round(((dist.get(l.level) ?? 0) / Math.max(1, counts.all)) * 100) })),
        me: {
          userId: viewerId,
          name: (await userBriefView(viewerId)).name,
          points,
          rank,
          level: cur.level,
          levelName: cur.name,
          pointsToNext: next ? next.minPoints - points : 0,
          journeyPct: Math.min(100, Math.round((points / maxPoints) * 100)),
        },
      };
    },
  };
}

export const communityService = createCommunityService();
