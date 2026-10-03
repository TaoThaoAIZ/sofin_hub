import { HttpError } from '../../utils/http-error.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { levelFor } from '../points/points.levels.js';
import { pointsService } from '../points/points.service.js';
import { myCommunitiesRepository as repo, type EnrollmentRow } from './my-communities.repository.js';
import type { PatchMyCommunityBody } from './my-communities.schema.js';

/** Ghim lên trước, rồi theo thứ tự người dùng kéo thả (chưa kéo => cuối), rồi theo ngày tham gia. */
export function sortEnrollments<T extends Pick<EnrollmentRow, 'pinned' | 'sortOrder' | 'enrolledAt' | 'communityId'>>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.enrolledAt.getTime() - b.enrolledAt.getTime() ||
      a.communityId.localeCompare(b.communityId),
  );
}

export const myCommunitiesService = {
  /** Danh sách "Cộng đồng đã tham gia" (đã sắp xếp) — số truy vấn cố định bất kể số cộng đồng. */
  async list(userId: string) {
    const rows = sortEnrollments(await repo.listEnrollments(userId));
    const ids = rows.map((r) => r.communityId);
    const ownedIds = rows.filter((r) => r.role === 'owner').map((r) => r.communityId);
    const [counts, subs, hosting, points] = await Promise.all([
      repo.memberCounts(ids),
      repo.subscriptions(userId, ids),
      repo.hostingPlans(ownedIds),
      pointsService.summaryForUser(userId, 0),
    ]);
    const pointsBy = new Map(points.byCourse.map((p) => [p.communityId, p.points]));
    return rows.map((r) => {
      const sub = subs.get(r.communityId);
      const host = hosting.get(r.communityId);
      const pts = pointsBy.get(r.communityId) ?? 0;
      return {
        id: r.communityId,
        title: r.title,
        logoUrl: r.logoUrl,
        thumbnail: r.thumbnail,
        visibility: r.visibility,
        free: r.priceCents === 0,
        role: r.role,
        enrolledAt: r.enrolledAt.toISOString(),
        memberCount: counts.get(r.communityId) ?? 0,
        points: pts,
        level: levelFor(pts).level,
        sidebarVisible: r.sidebarVisible,
        pinned: r.pinned,
        sortOrder: r.sortOrder,
        subscription: sub
          ? {
              status: sub.status,
              interval: sub.interval,
              trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
              currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }
          : null,
        hosting: host ? { status: host.status, trialEndsAt: host.trialEndsAt?.toISOString() ?? null } : null,
      };
    });
  },

  async patch(userId: string, communityId: string, body: PatchMyCommunityBody) {
    if (!(await repo.patchEnrollment(userId, communityId, body))) throw HttpError.notFound('Bạn chưa tham gia cộng đồng này');
    return { id: communityId, ...body };
  },

  /** `ids` phải là cộng đồng user đang tham gia; cái nào không có trong `ids` được xếp sau (giữ thứ tự cũ). */
  async reorder(userId: string, ids: string[]) {
    const mine = sortEnrollments(await repo.listEnrollments(userId));
    const set = new Set(mine.map((m) => m.communityId));
    if (ids.some((id) => !set.has(id))) throw HttpError.badRequest('Danh sách có cộng đồng bạn chưa tham gia');
    const listed = new Set(ids);
    const full = [...ids, ...mine.map((m) => m.communityId).filter((id) => !listed.has(id))];
    await repo.setOrder(userId, full);
    return { ids: full };
  },

  /** Rời cộng đồng: dùng lại luồng cũ của enrollmentService (owner không rời được, gói trả phí hủy cuối kỳ). */
  async leave(userId: string, communityId: string) {
    if (!(await enrollmentService.isEnrolled(userId, communityId))) throw HttpError.notFound('Bạn chưa tham gia cộng đồng này');
    const r = await enrollmentService.toggle(userId, communityId);
    return { left: !r.enrolled };
  },

  /** Yêu cầu tham gia đang chờ duyệt do chính user gửi. Lời mời là link/mã chung (Invite không có người nhận) nên không có hộp thư lời mời theo user. */
  async pending(userId: string) {
    const rows = await repo.pendingJoinRequests(userId);
    return {
      requests: rows.map((r) => ({ id: r.id, communityId: r.communityId, title: r.title, logoUrl: r.logoUrl, thumbnail: r.thumbnail, createdAt: r.createdAt.toISOString() })),
      invites: [] as never[],
    };
  },
};
