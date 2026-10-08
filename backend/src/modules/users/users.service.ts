import { HttpError } from '../../utils/http-error.js';
import { accountService } from '../auth/account.service.js';
import { userRepository } from '../auth/auth.repository.js';
import { classroomRepository } from '../classroom/classroom.repository.js';
import type { CommunityBriefRow } from '../catalog/catalog.repository.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { levelFor } from '../points/points.levels.js';
import { pointsService } from '../points/points.service.js';

export interface CourseBrief {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
  visibility: string;
}

const toBrief = (c: CommunityBriefRow): CourseBrief => ({
  id: c.id,
  title: c.title,
  thumbnail: c.thumbnail,
  category: c.category,
  visibility: c.visibility,
});

export const usersService = {
  /**
   * Hồ sơ công khai: KHÔNG có email; chỉ liệt kê cộng đồng công khai. `idOrHandle` là id hoặc handle (có thể kèm "@").
   * Vị trí chỉ lộ khi chủ hồ sơ bật `showOnMap` (hoặc chính chủ xem). `communityCount` của chính chủ tính cả cộng đồng riêng tư.
   */
  async publicProfile(idOrHandle: string, viewerId?: string) {
    const user =
      (await userRepository.findById(idOrHandle)) ?? (await userRepository.findByHandle(idOrHandle.replace(/^@/, '').toLowerCase()));
    if (!user || user.deletedAt) throw HttpError.notFound('Không tìm thấy người dùng');
    const userId = user.id;
    const isSelf = viewerId === userId;
    const memberships = await enrollmentService.listByUser(userId);
    const briefs = await catalogService.briefsByIds(memberships.map((m) => m.communityId));
    const communities = [];
    for (const m of memberships) {
      const course = briefs.get(m.communityId);
      if (!course || course.visibility !== 'public') continue;
      communities.push({ course: toBrief(course), role: m.role, joinedAt: m.enrolledAt });
    }
    const points = await pointsService.summaryForUser(userId, 0);
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      bio: user.bio ?? null,
      handle: user.handle ?? null,
      location: isSelf || (user.showOnMap ?? true) ? (user.location ?? null) : null,
      website: user.website ?? null,
      instagram: user.instagram ?? null,
      youtube: user.youtube ?? null,
      avatarUrl: user.avatarUrl ?? null,
      coverUrl: user.coverUrl ?? null,
      joinedAt: user.createdAt,
      communities,
      communityCount: isSelf ? memberships.length : communities.length,
      totalPoints: points.total,
      level: levelFor(points.total).level,
    };
  },

  handleAvailability: accountService.handleAvailability,

  /** 4 truy vấn cố định bất kể số cộng đồng: ghi danh (2) + thông tin khóa (1) + tiến độ gộp (1). */
  async myEnrollments(userId: string) {
    const memberships = await enrollmentService.listByUser(userId);
    const ids = memberships.map((m) => m.communityId);
    const [briefs, progress] = await Promise.all([catalogService.briefsByIds(ids), classroomRepository.progressByCommunity(userId, ids)]);
    const items = [];
    for (const m of memberships) {
      const course = briefs.get(m.communityId);
      if (!course) continue;
      const { total = 0, done = 0 } = progress.get(m.communityId) ?? {};
      items.push({
        course: toBrief(course),
        role: m.role,
        enrolledAt: m.enrolledAt,
        progressPct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
      });
    }
    return items;
  },

  async myPoints(userId: string) {
    const summary = await pointsService.summaryForUser(userId, 20);
    const briefs = await catalogService.briefsByIds(summary.byCourse.map((r) => r.communityId));
    const byCourse = [];
    for (const row of summary.byCourse) {
      const course = briefs.get(row.communityId);
      byCourse.push({ course: course ? toBrief(course) : { id: row.communityId }, points: row.points });
    }
    return { total: summary.total, byCourse, recent: summary.recent };
  },
};
