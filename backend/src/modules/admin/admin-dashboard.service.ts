import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { iso } from './admin.common.js';

const DAY = 86_400_000;
export const dashboardQuery = z.object({ range: z.enum(['7', '30', '90']).default('30').transform(Number) });

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Đếm theo ngày UTC (bảng/cột là hằng nội bộ, không nhận từ người dùng). */
async function daily(table: string, col: string, since: Date, extra: Prisma.Sql = Prisma.empty, agg: Prisma.Sql = Prisma.sql`COUNT(*)`): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ d: string; n: number }[]>(Prisma.sql`
    SELECT to_char(date_trunc('day', ${Prisma.raw(`"${col}"`)}), 'YYYY-MM-DD') AS d, ${agg}::int AS n
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${Prisma.raw(`"${col}"`)} >= ${since} ${extra}
    GROUP BY 1`);
  return new Map(rows.map((r) => [r.d, r.n]));
}

const pct = (now: number, base: number) => (base > 0 ? Math.round(((now - base) / base) * 1000) / 10 : null);

const ACTION_TEXT: Record<string, string> = {
  'community.approve': 'approved community',
  'community.request_changes': 'requested changes on community',
  'community.reject': 'rejected community',
  'community.suspend': 'suspended community',
  'community.restore': 'restored community',
  'community.delete': 'deleted community',
  'community.undelete': 'restored deleted community',
  'community.lock': 'locked community',
  'community.unlock': 'unlocked community',
  'user.restrict': 'restricted user',
  'user.suspend': 'suspended user',
  'user.ban': 'banned user',
  'user.reinstate': 'reinstated user',
  'user.warn': 'warned user',
  'case.warn': 'warned user (case)',
  'case.remove_content': 'removed content',
  'case.suspend_user': 'suspended user (case)',
  'case.ban_user': 'banned user (case)',
  'case.restrict_user': 'restricted user (case)',
  'case.dismiss': 'dismissed case',
  'case.resolve': 'resolved case',
  'case.escalate': 'escalated case',
  'case.assign': 'assigned case',
};

interface SubRow {
  priceCents: number;
  status: string;
  createdAt: Date;
  canceledAt: Date | null;
  currentPeriodEnd: Date;
}
/** MRR tại thời điểm `at` dựng lại từ vòng đời subscription (không tính dùng thử). */
function mrrAt(subs: SubRow[], at: Date): number {
  let sum = 0;
  for (const s of subs) {
    if (s.status === 'trialing' || s.createdAt > at) continue;
    const endedAt = s.canceledAt ?? (s.status === 'expired' ? s.currentPeriodEnd : null);
    if (!endedAt || endedAt > at) sum += s.priceCents;
  }
  return sum;
}

export const adminDashboardService = {
  async get(range: 7 | 30 | 90) {
    const now = new Date();
    const today = startOfUtcDay(now);
    const since = new Date(today.getTime() - (range - 1) * DAY);
    const prevSince = new Date(since.getTime() - range * DAY);
    const realUser = Prisma.sql`AND "isDemo" = false AND "deletedAt" IS NULL`;
    const liveCourse = Prisma.sql`AND "deletedAt" IS NULL AND "moderationStatus" = 'active' AND "locked" = false`;
    const realUsers = { isDemo: false, deletedAt: null };

    const [
      totalUsers, usersBefore, activeNow, activePrev, communitiesNow, communitiesBefore, subs, pendingReports, criticalReports,
      pendingReview, oldestPending, suspicious, payouts, refunds,
      newUsersD, activeUsersD, createdD, createdActiveD, createdPaidD, suspendedD, revenueD, refundsD, postsD, commentsD, lessonsD, rsvpD,
      baseActive, basePaid, auditRecent, signupsRecent, communitiesRecent,
    ] = await Promise.all([
      prisma.user.count({ where: realUsers }),
      prisma.user.count({ where: { ...realUsers, createdAt: { lt: since } } }),
      prisma.session.findMany({ where: { lastUsedAt: { gte: since }, user: realUsers }, distinct: ['userId'], select: { userId: true } }),
      prisma.session.findMany({ where: { lastUsedAt: { gte: prevSince, lt: since }, user: realUsers }, distinct: ['userId'], select: { userId: true } }),
      prisma.course.count({ where: { deletedAt: null, moderationStatus: 'active', locked: false } }),
      prisma.course.count({ where: { deletedAt: null, moderationStatus: 'active', locked: false, createdAt: { lt: since } } }),
      prisma.subscription.findMany({ select: { priceCents: true, status: true, createdAt: true, canceledAt: true, currentPeriodEnd: true } }),
      prisma.report.count({ where: { status: { in: ['open', 'under_review'] } } }),
      prisma.report.count({ where: { status: { in: ['open', 'under_review'] }, risk: 'critical' } }),
      prisma.course.count({ where: { deletedAt: null, moderationStatus: 'pending_review' } }),
      prisma.course.findFirst({ where: { deletedAt: null, moderationStatus: 'pending_review' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS n FROM (
          SELECT r."targetUserId" FROM "Report" r JOIN "User" u ON u."id" = r."targetUserId"
          WHERE r."createdAt" >= ${new Date(now.getTime() - 30 * DAY)} AND u."status" <> 'banned' AND u."isDemo" = false
          GROUP BY r."targetUserId" HAVING COUNT(*) >= 3) t`),
      prisma.payout.aggregate({ where: { status: 'requested' }, _count: { _all: true }, _sum: { amountCents: true } }),
      prisma.refundRequest.aggregate({ where: { status: 'pending' }, _count: { _all: true }, _sum: { amountCents: true } }),
      daily('User', 'createdAt', since, realUser),
      daily('Session', 'lastUsedAt', since, Prisma.empty, Prisma.sql`COUNT(DISTINCT "userId")`),
      daily('Course', 'createdAt', since, Prisma.sql`AND "deletedAt" IS NULL`),
      daily('Course', 'createdAt', since, liveCourse),
      daily('Course', 'createdAt', since, Prisma.sql`${liveCourse} AND "pricing" <> 'free'`),
      daily('AdminAuditLog', 'createdAt', since, Prisma.sql`AND "action" = 'community.suspend'`),
      daily('Payment', 'createdAt', since, Prisma.sql`AND "status" IN ('succeeded', 'refunded')`, Prisma.sql`COALESCE(SUM("amountCents"), 0)`),
      daily('RefundRequest', 'resolvedAt', since, Prisma.sql`AND "status" = 'approved'`, Prisma.sql`COALESCE(SUM("amountCents"), 0)`),
      daily('Post', 'createdAt', since),
      daily('PostComment', 'createdAt', since),
      daily('LessonProgress', 'completedAt', since),
      daily('EventRsvp', 'createdAt', since),
      prisma.course.count({ where: { deletedAt: null, moderationStatus: 'active', locked: false, createdAt: { lt: since } } }),
      prisma.course.count({ where: { deletedAt: null, moderationStatus: 'active', locked: false, createdAt: { lt: since }, pricing: { not: 'free' } } }),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
      prisma.user.findMany({ where: realUsers, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, firstName: true, lastName: true, createdAt: true } }),
      prisma.course.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, title: true, createdAt: true, owner: { select: { id: true, firstName: true, lastName: true } } } }),
    ]);

    // ---- chuỗi theo ngày (đủ `range` điểm, ngày trống = 0)
    const days = Array.from({ length: range }, (_, i) => new Date(since.getTime() + i * DAY));
    let cumActive = baseActive;
    let cumPaid = basePaid;
    const userGrowth = days.map((d) => ({ date: ymd(d), newUsers: newUsersD.get(ymd(d)) ?? 0, activeUsers: activeUsersD.get(ymd(d)) ?? 0 }));
    const communityGrowth = days.map((d) => {
      cumActive += createdActiveD.get(ymd(d)) ?? 0;
      cumPaid += createdPaidD.get(ymd(d)) ?? 0;
      return { date: ymd(d), created: createdD.get(ymd(d)) ?? 0, active: cumActive, paid: cumPaid, suspended: suspendedD.get(ymd(d)) ?? 0 };
    });
    const revenue = days.map((d) => ({
      date: ymd(d),
      mrrCents: mrrAt(subs, new Date(d.getTime() + DAY - 1)),
      revenueCents: revenueD.get(ymd(d)) ?? 0,
      refundsCents: refundsD.get(ymd(d)) ?? 0,
    }));
    const engagement = days.map((d) => ({
      date: ymd(d),
      posts: postsD.get(ymd(d)) ?? 0,
      comments: commentsD.get(ymd(d)) ?? 0,
      lessonsCompleted: lessonsD.get(ymd(d)) ?? 0,
      eventRsvps: rsvpD.get(ymd(d)) ?? 0,
    }));

    const mrrNow = subs.filter((s) => s.status === 'active').reduce((a, s) => a + s.priceCents, 0);
    const newInRange = [...newUsersD.values()].reduce((a, b) => a + b, 0);

    // ---- hoạt động gần đây
    const labelOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
    const activity = [
      ...auditRecent.map((a) => ({
        type: 'audit' as const, icon: 'history', actor: { id: a.actorId, name: a.actorName },
        text: ACTION_TEXT[a.action] ?? a.action, target: a.targetLabel, createdAt: a.createdAt,
      })),
      ...signupsRecent.map((u) => ({
        type: 'signup' as const, icon: 'person_add', actor: { id: u.id, name: labelOf(u) }, text: 'signed up', target: '', createdAt: u.createdAt,
      })),
      ...communitiesRecent.map((c) => ({
        type: 'community_created' as const, icon: 'add_business', actor: c.owner ? { id: c.owner.id, name: labelOf(c.owner) } : null,
        text: 'created a community', target: c.title, createdAt: c.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((a) => ({ ...a, createdAt: iso(a.createdAt) }));

    return {
      range,
      kpis: {
        totalUsers: { value: totalUsers, deltaPct: pct(totalUsers, usersBefore) },
        activeUsers: { value: activeNow.length, deltaPct: pct(activeNow.length, activePrev.length) },
        communities: { value: communitiesNow, deltaPct: pct(communitiesNow, communitiesBefore) },
        mrrCents: { value: mrrNow, deltaPct: pct(mrrNow, mrrAt(subs, since)) },
        pendingReports: { value: pendingReports, critical: criticalReports },
        pendingReviewCommunities: { value: pendingReview },
        openSupportTickets: { value: null },
      },
      series: { userGrowth, communityGrowth, revenue, engagement },
      needsAttention: {
        pendingReviewCommunities: { count: pendingReview, oldestWaitingHours: oldestPending ? Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 3_600_000) : 0 },
        openReports: { count: pendingReports, critical: criticalReports },
        suspiciousUsers: { count: suspicious[0]?.n ?? 0 },
        pendingPayouts: { count: payouts._count._all, amountCents: payouts._sum.amountCents ?? 0 },
        pendingRefunds: { count: refunds._count._all, amountCents: refunds._sum.amountCents ?? 0 },
      },
      recentActivity: activity,
      _meta: { newUsersInRange: newInRange },
    };
  },
};
