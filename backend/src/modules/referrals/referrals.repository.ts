import { prisma } from '../../db/prisma.js';
import type { CommissionStatus, ReferralKind } from '../../generated/prisma/client.js';

/** Truy cập DB cho chương trình giới thiệu (Prisma). Không chứa nghiệp vụ. */
export const referralsRepository = {
  findCodeByUser: (userId: string) => prisma.referralCode.findUnique({ where: { userId } }),
  findCode: (code: string) => prisma.referralCode.findUnique({ where: { code } }),
  /** Trả null khi mã đã bị người khác chiếm (P2002 do caller xử lý). */
  createCode: (userId: string, code: string) => prisma.referralCode.create({ data: { userId, code } }),
  findUser: (id: string) => prisma.user.findUnique({ where: { id }, select: { id: true, handle: true, firstName: true, lastName: true } }),
  findUserByHandle: (handle: string) => prisma.user.findUnique({ where: { handle }, select: { id: true } }),

  createReferral: (data: { referrerId: string; referredUserId: string; code: string; expiresAt: Date }) => prisma.referral.create({ data }),
  findReferralOf: (referredUserId: string) => prisma.referral.findUnique({ where: { referredUserId } }),
  findReferral: (referrerId: string, referredUserId: string) => prisma.referral.findFirst({ where: { referrerId, referredUserId } }),
  listReferrals: (referrerId: string, take: number) =>
    prisma.referral.findMany({
      where: { referrerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      include: { referredUser: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    }),
  countReferrals: (referrerId: string, since?: Date) => prisma.referral.count({ where: { referrerId, ...(since ? { createdAt: { gte: since } } : {}) } }),

  /** Gói mới nhất của từng người (mọi cộng đồng), kèm tên cộng đồng. */
  listSubscriptions: (userIds: string[]) =>
    prisma.subscription.findMany({
      where: { userId: { in: userIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { userId: true, communityId: true, status: true, cancelAtPeriodEnd: true, createdAt: true, community: { select: { title: true } } },
    }),
  /** Cộng đồng (đã publish, chưa xóa) mà từng người làm chủ + gói hosting. */
  listOwnedCommunities: (userIds: string[]) =>
    prisma.community.findMany({
      where: { ownerId: { in: userIds }, deletedAt: null, moderationStatus: { not: 'draft' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, ownerId: true, hostingPlan: { select: { planKey: true, status: true } } },
    }),

  findCommissionBySource: (sourceRef: string) => prisma.referralCommission.findUnique({ where: { sourceRef } }),
  hasCommissionFor: (referredUserId: string, kind: ReferralKind) => prisma.referralCommission.count({ where: { referredUserId, kind } }).then((n) => n > 0),
  createCommission: (data: {
    referrerId: string;
    referredUserId: string;
    kind: ReferralKind;
    communityId: string | null;
    sourceRef: string;
    baseCents: number;
    rateBps: number;
    amountCents: number;
    payoutOn: Date;
  }) => prisma.referralCommission.create({ data }),
  /** Chỉ hủy hoa hồng còn `pending` (đã chi trả thì không thu hồi được ở đây). */
  voidPendingBySource: (sourceRef: string) => prisma.referralCommission.updateMany({ where: { sourceRef, status: 'pending' }, data: { status: 'void' } }),

  sumCommissions: async (referrerId: string, kind: ReferralKind, where: { status?: CommissionStatus | { not: CommissionStatus }; from?: Date; to?: Date }) => {
    const r = await prisma.referralCommission.aggregate({
      where: { referrerId, kind, ...(where.status ? { status: where.status } : {}), ...(where.from || where.to ? { createdAt: { ...(where.from ? { gte: where.from } : {}), ...(where.to ? { lt: where.to } : {}) } } : {}) },
      _sum: { amountCents: true },
    });
    return r._sum.amountCents ?? 0;
  },
  earnedByUser: async (referrerId: string, kind: ReferralKind, userIds: string[]) => {
    const rows = await prisma.referralCommission.groupBy({
      by: ['referredUserId'],
      where: { referrerId, kind, referredUserId: { in: userIds }, status: { not: 'void' } },
      _sum: { amountCents: true },
    });
    return new Map(rows.map((r) => [r.referredUserId, r._sum.amountCents ?? 0]));
  },
  listCommissions: (referrerId: string, referredUserId: string, kind: ReferralKind, take: number) =>
    prisma.referralCommission.findMany({ where: { referrerId, referredUserId, kind }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take }),

  /** Thành viên đã thanh toán thành công nhưng chưa có hoa hồng (đối soát khi hook sau commit bị mất). */
  listUncommissionedPayments: (since: Date, limit: number) =>
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id" FROM "Payment" p
      JOIN "Referral" r ON r."referredUserId" = p."userId"
      WHERE p."status" = 'succeeded' AND p."amountCents" > 0 AND p."confirmedAt" >= ${since}
        AND NOT EXISTS (SELECT 1 FROM "ReferralCommission" c WHERE c."sourceRef" = 'payment:' || p."id")
      ORDER BY p."confirmedAt" LIMIT ${limit}`,
  findPayment: (id: string) => prisma.payment.findUnique({ where: { id } }),
  recentReminder: (userId: string, title: string, bodyPrefix: string, since: Date) =>
    prisma.notification.count({ where: { userId, title, body: { startsWith: bodyPrefix }, createdAt: { gte: since } } }),
};
