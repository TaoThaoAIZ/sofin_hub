import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { referralsService, nextPayoutDate } from './referrals.service.js';
import { referralsRepository as repo } from './referrals.repository.js';

/** Trần hoa hồng chủ cộng đồng được đặt: 50% giá thanh toán (phần còn lại vẫn đủ trả phí nền tảng + phí cổng). */
export const MAX_COMMUNITY_RATE_BPS = 5000;
const MAX_ROWS = 100;
/** Số lượt giới thiệu tối đa trả về cho chủ cộng đồng (mới nhất trước). */
const MAX_OWNER_ROWS = 2000;
const DAY_MS = 86_400_000;

export const setRateBody = z.strictObject({
  rateBps: z.number({ error: 'Nhập phần trăm hoa hồng' }).int('Phần trăm hoa hồng phải là số nguyên basis point').min(0, 'Tối thiểu 0%').max(MAX_COMMUNITY_RATE_BPS, 'Tối đa 50%'),
});

const nameOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
const isUnique = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';
const linkOf = (communityId: string, code: string) => `${env.FRONTEND_URL.replace(/\/$/, '')}/communities/${communityId}?cref=${encodeURIComponent(code)}`;

/** Lỗi trong chương trình giới thiệu không bao giờ được làm hỏng luồng thanh toán đang chạy. */
async function isolate<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.error(`communityReferral.${label}: bỏ qua do lỗi:`, err);
    return undefined;
  }
}

/**
 * Chương trình giới thiệu THEO TỪNG CỘNG ĐỒNG: thành viên có link riêng của cộng đồng (`?cref=<mã>`); người được mời thanh toán gói/module
 * thì người mời nhận X% (do CHỦ CỘNG ĐỒNG đặt, 0 = tắt) trên số tiền thanh toán, TRỪ vào phần creator nhận (nền tảng vẫn giữ phí của mình).
 */
export const communityReferralService = {
  /** Tổng quan cho người đang xem: tỉ lệ, link của riêng họ, KPI + danh sách người họ đã mời. */
  async program(communityId: string, userId: string) {
    const community = await prisma.community.findFirst({ where: { id: communityId, deletedAt: null }, select: { id: true, ownerId: true, referralRateBps: true } });
    if (!community) throw HttpError.notFound('Không tìm thấy cộng đồng');
    const role = await enrollmentService.getActiveRole(userId, communityId);
    const isOwner = community.ownerId === userId || role === 'owner';
    const isMember = !!role;
    const base = { rateBps: community.referralRateBps, enabled: community.referralRateBps > 0, maxRateBps: MAX_COMMUNITY_RATE_BPS, isOwner, isMember };
    if (!isMember) return { ...base, code: null, link: null, stats: null, referred: [], owner: null };

    const code = await referralsService.ensureCode(userId);
    const [refs, commissions] = await Promise.all([
      prisma.communityReferral.findMany({
        where: { communityId, referrerId: userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_ROWS,
        include: { referredUser: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      prisma.referralCommission.groupBy({
        by: ['referredUserId', 'status'],
        where: { referrerId: userId, kind: 'community', communityId },
        _sum: { amountCents: true },
      }),
    ]);
    const earned = new Map<string, number>();
    let commissionCents = 0;
    let pendingCents = 0;
    for (const c of commissions) {
      if (c.status === 'void') continue;
      const v = c._sum.amountCents ?? 0;
      earned.set(c.referredUserId, (earned.get(c.referredUserId) ?? 0) + v);
      commissionCents += v;
      if (c.status === 'pending') pendingCents += v;
    }
    const referred = refs.map((r) => ({
      userId: r.referredUserId,
      name: nameOf(r.referredUser),
      avatarUrl: r.referredUser.avatarUrl,
      signedUpAt: r.createdAt.toISOString(),
      status: (earned.get(r.referredUserId) ?? 0) > 0 ? ('paid' as const) : ('none' as const),
      earnedCents: earned.get(r.referredUserId) ?? 0,
    }));
    let owner: { referrers: number; referred: number; commissionCents: number } | null = null;
    if (isOwner) {
      const [referrers, referredN, agg] = await Promise.all([
        prisma.communityReferral.findMany({ where: { communityId }, distinct: ['referrerId'], select: { referrerId: true } }),
        prisma.communityReferral.count({ where: { communityId } }),
        prisma.referralCommission.aggregate({ where: { kind: 'community', communityId, status: { not: 'void' } }, _sum: { amountCents: true } }),
      ]);
      owner = { referrers: referrers.length, referred: referredN, commissionCents: agg._sum.amountCents ?? 0 };
    }
    return {
      ...base,
      code,
      link: linkOf(communityId, code),
      stats: { referred: refs.length, paying: referred.filter((r) => r.status === 'paid').length, commissionCents, pendingCents, payoutOn: nextPayoutDate(new Date()).toISOString() },
      referred,
      owner,
    };
  },

  /**
   * CHỦ CỘNG ĐỒNG xem TẤT CẢ người giới thiệu của cộng đồng (chủ là người trả % hoa hồng cho họ): mỗi người giới thiệu kèm số người đã mời,
   * số người đang trả phí, hoa hồng phải trả / đang chờ chi trả và danh sách từng người được mời. Chỉ tính hoa hồng của chương trình cộng đồng (kind = community).
   */
  async referrers(communityId: string) {
    const refs = await prisma.communityReferral.findMany({
      where: { communityId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_OWNER_ROWS,
      include: {
        referrer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        referredUser: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    if (refs.length === 0) return { referrers: [], totals: { referrers: 0, referred: 0, paying: 0, commissionCents: 0, pendingCents: 0 } };
    const referredIds = refs.map((r) => r.referredUserId);
    const [commissions, members] = await Promise.all([
      prisma.referralCommission.groupBy({
        by: ['referrerId', 'referredUserId', 'status'],
        where: { kind: 'community', communityId, status: { not: 'void' } },
        _sum: { amountCents: true },
      }),
      prisma.enrollment.findMany({ where: { communityId, userId: { in: referredIds } }, select: { userId: true } }),
    ]);
    const memberSet = new Set(members.map((m) => m.userId));
    const earned = new Map<string, { total: number; pending: number }>(); // khóa: referrerId:referredUserId
    for (const c of commissions) {
      const k = `${c.referrerId}:${c.referredUserId}`;
      const cur = earned.get(k) ?? { total: 0, pending: 0 };
      const v = c._sum.amountCents ?? 0;
      cur.total += v;
      if (c.status === 'pending') cur.pending += v;
      earned.set(k, cur);
    }
    const byReferrer = new Map<string, { userId: string; name: string; avatarUrl: string | null; referred: { userId: string; name: string; avatarUrl: string | null; joinedAt: string; status: 'paid' | 'joined' | 'none'; earnedCents: number }[]; commissionCents: number; pendingCents: number }>();
    for (const r of refs) {
      const e = earned.get(`${r.referrerId}:${r.referredUserId}`) ?? { total: 0, pending: 0 };
      const row = byReferrer.get(r.referrerId) ?? { userId: r.referrerId, name: nameOf(r.referrer), avatarUrl: r.referrer.avatarUrl, referred: [], commissionCents: 0, pendingCents: 0 };
      row.referred.push({
        userId: r.referredUserId,
        name: nameOf(r.referredUser),
        avatarUrl: r.referredUser.avatarUrl,
        joinedAt: r.createdAt.toISOString(),
        status: e.total > 0 ? 'paid' : memberSet.has(r.referredUserId) ? 'joined' : 'none',
        earnedCents: e.total,
      });
      row.commissionCents += e.total;
      row.pendingCents += e.pending;
      byReferrer.set(r.referrerId, row);
    }
    const referrers = [...byReferrer.values()]
      .map((r) => ({ ...r, referredCount: r.referred.length, payingCount: r.referred.filter((x) => x.status === 'paid').length }))
      .sort((a, b) => b.commissionCents - a.commissionCents || b.referredCount - a.referredCount || a.name.localeCompare(b.name));
    return {
      referrers,
      totals: {
        referrers: referrers.length,
        referred: refs.length,
        paying: referrers.reduce((s, r) => s + r.payingCount, 0),
        commissionCents: referrers.reduce((s, r) => s + r.commissionCents, 0),
        pendingCents: referrers.reduce((s, r) => s + r.pendingCents, 0),
      },
    };
  },

  /** Chủ cộng đồng đặt % hoa hồng (0 = tắt). Chỉ áp cho thanh toán SAU khi đặt; hoa hồng đã ghi giữ nguyên tỉ lệ lúc đó. */
  async setRate(communityId: string, rateBps: number) {
    await prisma.community.update({ where: { id: communityId }, data: { referralRateBps: rateBps } });
    return { rateBps, enabled: rateBps > 0 };
  },

  /**
   * Ghi nhận người giới thiệu cho (cộng đồng, người thanh toán) theo mã trên link. Người đầu tiên thắng. Bỏ qua êm: chương trình tắt,
   * mã lạ, tự giới thiệu, người mời không còn là thành viên, người được mời đã là thành viên. Không bao giờ ném lỗi ra ngoài.
   */
  async attribute(payerId: string, communityId: string, rawCode: string | undefined | null): Promise<boolean> {
    const code = rawCode?.trim().toLowerCase();
    if (!code) return false;
    return (
      (await isolate('attribute', async () => {
        const community = await prisma.community.findFirst({ where: { id: communityId, deletedAt: null }, select: { referralRateBps: true } });
        if (!community || community.referralRateBps <= 0) return false;
        const found = await repo.findCode(code);
        const referrerId = found?.userId ?? (await repo.findUserByHandle(code))?.id;
        if (!referrerId || referrerId === payerId) return false;
        if (!(await enrollmentService.getActiveRole(referrerId, communityId))) return false;
        if (await enrollmentService.getActiveRole(payerId, communityId)) return false;
        try {
          await prisma.communityReferral.create({ data: { communityId, referrerId, referredUserId: payerId, code } });
          return true;
        } catch (e) {
          if (isUnique(e)) return false; // đã được ghi nhận (người đầu tiên thắng)
          throw e;
        }
      })) ?? false
    );
  },

  /** Gọi SAU KHI thanh toán thành công đã commit (cùng chỗ hoa hồng nền tảng). Idempotent theo `sourceRef = cpayment:<id>`. */
  async onPaymentSucceeded(p: { id: string; userId: string; communityId: string; amountCents: number; kind?: string; confirmedAt?: string }): Promise<void> {
    await isolate('onPaymentSucceeded', async () => {
      if (p.amountCents <= 0 || p.kind === 'hosting') return;
      const sourceRef = `cpayment:${p.id}`;
      if (await repo.findCommissionBySource(sourceRef)) return;
      const [ref, community] = await Promise.all([
        prisma.communityReferral.findUnique({ where: { communityId_referredUserId: { communityId: p.communityId, referredUserId: p.userId } } }),
        prisma.community.findUnique({ where: { id: p.communityId }, select: { referralRateBps: true } }),
      ]);
      if (!ref || !community || community.referralRateBps <= 0) return;
      const at = p.confirmedAt ? new Date(p.confirmedAt) : new Date();
      try {
        await repo.createCommission({
          referrerId: ref.referrerId,
          referredUserId: p.userId,
          kind: 'community',
          communityId: p.communityId,
          sourceRef,
          baseCents: p.amountCents,
          rateBps: community.referralRateBps,
          amountCents: Math.round((p.amountCents * community.referralRateBps) / 10_000),
          payoutOn: nextPayoutDate(at),
        });
      } catch (e) {
        if (!isUnique(e)) throw e;
      }
    });
  },

  /** Đối soát: thanh toán thành công gần đây của người được mời còn thiếu hoa hồng (hook sau commit bị mất). Idempotent. */
  async reconcile(now = new Date(), opts: { sinceDays?: number; limit?: number } = {}) {
    const since = new Date(now.getTime() - (opts.sinceDays ?? 3) * DAY_MS);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id" FROM "Payment" p
      JOIN "CommunityReferral" r ON r."courseId" = p."courseId" AND r."referredUserId" = p."userId"
      JOIN "Course" c ON c."id" = p."courseId" AND c."referralRateBps" > 0
      WHERE p."status" = 'succeeded' AND p."kind" <> 'hosting' AND p."amountCents" > 0 AND p."confirmedAt" >= ${since}
        AND NOT EXISTS (SELECT 1 FROM "ReferralCommission" rc WHERE rc."sourceRef" = 'cpayment:' || p."id")
      ORDER BY p."confirmedAt" LIMIT ${opts.limit ?? 100}`;
    let created = 0;
    for (const { id } of rows) {
      const p = await repo.findPayment(id);
      if (!p) continue;
      await this.onPaymentSucceeded({ id: p.id, userId: p.userId, communityId: p.communityId, amountCents: p.amountCents, kind: p.kind, confirmedAt: p.confirmedAt?.toISOString() });
      if (await repo.findCommissionBySource(`cpayment:${id}`)) created++;
    }
    return { scanned: rows.length, created };
  },
};
