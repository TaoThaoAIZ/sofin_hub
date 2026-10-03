import { prisma } from '../../db/prisma.js';
import type { BillingInterval, HostingPlanStatus, MemberRole, SubscriptionStatus, Visibility } from '../../generated/prisma/client.js';

export interface EnrollmentRow {
  communityId: string;
  title: string;
  logoUrl: string | null;
  thumbnail: string;
  visibility: Visibility;
  priceCents: number;
  role: MemberRole;
  enrolledAt: Date;
  sidebarVisible: boolean;
  pinned: boolean;
  sortOrder: number | null;
}

export interface SubscriptionRow {
  communityId: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface PendingRequestRow {
  id: string;
  communityId: string;
  title: string;
  logoUrl: string | null;
  thumbnail: string;
  createdAt: Date;
}

/** Cộng đồng chưa xóa, không phải bản nháp (bản nháp wizard có luồng riêng). */
const liveCommunity = { deletedAt: null, moderationStatus: { not: 'draft' as const } };

export const myCommunitiesRepository = {
  /** Ghi danh còn hiệu lực (loại người bị cấm), kèm thông tin cộng đồng. */
  async listEnrollments(userId: string): Promise<EnrollmentRow[]> {
    const bans = await prisma.communityBan.findMany({ where: { userId }, select: { communityId: true } });
    const rows = await prisma.enrollment.findMany({
      where: { userId, ...(bans.length ? { communityId: { notIn: bans.map((b) => b.communityId) } } : {}), community: liveCommunity },
      select: {
        communityId: true,
        role: true,
        enrolledAt: true,
        sidebarVisible: true,
        pinned: true,
        sortOrder: true,
        community: { select: { title: true, logoUrl: true, thumbnail: true, visibility: true, priceCents: true } },
      },
    });
    return rows.map(({ community, ...e }) => ({ ...e, ...community }));
  },

  /** Số thành viên (không tính người bị cấm) của nhiều cộng đồng — 1 truy vấn. */
  async memberCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.$queryRaw<{ id: string; n: bigint }[]>`
      SELECT e."courseId" AS id, COUNT(*)::bigint AS n FROM "Enrollment" e
      WHERE e."courseId" = ANY(${ids}::text[])
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      GROUP BY e."courseId"`;
    return new Map(rows.map((r) => [r.id, Number(r.n)]));
  },

  /** Gói thành viên của user: ưu tiên gói còn hiệu lực (trialing/active), không thì gói mới nhất. */
  async subscriptions(userId: string, ids: string[]): Promise<Map<string, SubscriptionRow>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.subscription.findMany({
      where: { userId, communityId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: { communityId: true, status: true, interval: true, trialEndsAt: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    });
    const out = new Map<string, SubscriptionRow>();
    for (const r of rows) {
      const cur = out.get(r.communityId);
      const live = r.status === 'trialing' || r.status === 'active';
      if (!cur || (live && cur.status !== 'trialing' && cur.status !== 'active')) out.set(r.communityId, r);
    }
    return out;
  },

  /** Gói hosting (dùng thử) của owner cho các cộng đồng. */
  async hostingPlans(ids: string[]): Promise<Map<string, { status: HostingPlanStatus; trialEndsAt: Date | null }>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.hostingPlan.findMany({ where: { communityId: { in: ids } }, select: { communityId: true, status: true, trialEndsAt: true } });
    return new Map(rows.map((r) => [r.communityId, r]));
  },

  async patchEnrollment(userId: string, communityId: string, data: { sidebarVisible?: boolean; pinned?: boolean }): Promise<boolean> {
    if ((await prisma.communityBan.count({ where: { userId, communityId } })) > 0) return false;
    return (await prisma.enrollment.updateMany({ where: { userId, communityId }, data })).count > 0;
  },

  /** Ghi sortOrder = vị trí trong `ids` (0..n-1) trong 1 transaction. */
  async setOrder(userId: string, ids: string[]): Promise<void> {
    await prisma.$transaction(ids.map((communityId, i) => prisma.enrollment.updateMany({ where: { userId, communityId }, data: { sortOrder: i } })));
  },

  async pendingJoinRequests(userId: string): Promise<PendingRequestRow[]> {
    const rows = await prisma.joinRequest.findMany({
      where: { userId, status: 'pending', community: liveCommunity },
      orderBy: { createdAt: 'desc' },
      select: { id: true, communityId: true, createdAt: true, community: { select: { title: true, logoUrl: true, thumbnail: true } } },
    });
    return rows.map(({ community, ...r }) => ({ ...r, ...community }));
  },
};
