import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { pageMeta, pageQuery } from './admin.common.js';
import { person, personSelect } from './admin-b2.common.js';

/**
 * Admin > Thanh toán > Giao dịch giới thiệu: ai giới thiệu ai + hoa hồng phát sinh.
 *  - view=commissions: từng khoản hoa hồng (member = từ gói thành viên/mua module; creator = từ phí hosting).
 *  - view=referrals: từng lượt giới thiệu (kể cả người chưa trả đồng nào) kèm tổng hoa hồng đã sinh.
 * Tiền theo VND (đồng).
 */
export const referralsQuery = pageQuery.extend({
  view: z.enum(['commissions', 'referrals']).default('commissions'),
  /** Tìm theo tên/email của người giới thiệu hoặc người được giới thiệu, hoặc mã giới thiệu. */
  q: z.string().trim().max(100).optional(),
  kind: z.enum(['member', 'creator', 'community']).optional(),
  status: z.enum(['pending', 'paid', 'void']).optional(),
});

const userMatch = (q: string): Prisma.UserWhereInput => ({
  OR: [
    { email: { contains: q, mode: 'insensitive' } },
    { firstName: { contains: q, mode: 'insensitive' } },
    { lastName: { contains: q, mode: 'insensitive' } },
  ],
});

export const adminReferralsService = {
  async summary() {
    const [referrals, byStatus] = await Promise.all([
      prisma.referral.count(),
      prisma.referralCommission.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountCents: true } }),
    ]);
    const sum = (s: string) => byStatus.find((x) => x.status === s)?._sum.amountCents ?? 0;
    return {
      referrals,
      commissions: byStatus.reduce((a, x) => a + x._count._all, 0),
      pendingCents: sum('pending'),
      paidCents: sum('paid'),
      voidCents: sum('void'),
    };
  },

  async list(q: z.infer<typeof referralsQuery>) {
    const skip = (q.page - 1) * q.limit;
    if (q.view === 'referrals') {
      const where: Prisma.ReferralWhereInput = q.q
        ? { OR: [{ referrer: userMatch(q.q) }, { referredUser: userMatch(q.q) }, { code: { contains: q.q, mode: 'insensitive' } }] }
        : {};
      const [rows, total] = await Promise.all([
        prisma.referral.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: q.limit,
          include: { referrer: { select: personSelect }, referredUser: { select: personSelect } },
        }),
        prisma.referral.count({ where }),
      ]);
      const sums = rows.length
        ? await prisma.referralCommission.groupBy({
            by: ['referrerId', 'referredUserId'],
            where: { status: { not: 'void' }, OR: rows.map((r) => ({ referrerId: r.referrerId, referredUserId: r.referredUserId })) },
            _sum: { amountCents: true },
            _count: { _all: true },
          })
        : [];
      const now = Date.now();
      return {
        data: rows.map((r) => {
          const s = sums.find((x) => x.referrerId === r.referrerId && x.referredUserId === r.referredUserId);
          return {
            id: r.id,
            referrer: person(r.referrer),
            referred: person(r.referredUser),
            code: r.code,
            signedUpAt: r.createdAt.toISOString(),
            expiresAt: r.expiresAt.toISOString(),
            windowActive: r.expiresAt.getTime() > now,
            commissionCount: s?._count._all ?? 0,
            commissionCents: s?._sum.amountCents ?? 0,
          };
        }),
        meta: pageMeta(q.page, q.limit, total),
      };
    }

    const where: Prisma.ReferralCommissionWhereInput = {
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ referrer: userMatch(q.q) }, { referredUser: userMatch(q.q) }, { sourceRef: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.referralCommission.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: q.limit,
        include: { referrer: { select: personSelect }, referredUser: { select: personSelect } },
      }),
      prisma.referralCommission.count({ where }),
    ]);
    const ids = [...new Set(rows.flatMap((r) => (r.communityId ? [r.communityId] : [])))];
    const titles = new Map((ids.length ? await prisma.community.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }) : []).map((c) => [c.id, c.title]));
    return {
      data: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        referrer: person(r.referrer),
        referred: person(r.referredUser),
        kind: r.kind,
        community: r.communityId ? { id: r.communityId, name: titles.get(r.communityId) ?? null } : null,
        sourceRef: r.sourceRef,
        baseCents: r.baseCents,
        rateBps: r.rateBps,
        amountCents: r.amountCents,
        status: r.status,
        payoutOn: r.payoutOn?.toISOString() ?? null,
      })),
      meta: pageMeta(q.page, q.limit, total),
    };
  },
};
