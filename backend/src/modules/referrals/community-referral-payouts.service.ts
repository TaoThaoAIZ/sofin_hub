import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { notify } from '../notifications/notifications.service.js';
import { referralWithdrawalsService } from './referral-withdrawals.service.js';

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD');
const nameOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

export const payoutsQuery = z.object({
  from: isoDay.optional(),
  to: isoDay.optional(),
  q: z.string().trim().max(80).optional(),
  status: z.enum(['all', 'due', 'paid']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(6),
});
export type PayoutsQuery = z.infer<typeof payoutsQuery>;

export const payBody = z.strictObject({
  referrerIds: z.array(z.string().min(1).max(64)).min(1, 'Chọn ít nhất một cộng tác viên').max(200),
  from: isoDay.optional(),
  to: isoDay.optional(),
  note: z.string().trim().max(200).optional(),
});
export type PayBody = z.infer<typeof payBody>;

export const exportQuery = z.object({ from: isoDay.optional(), to: isoDay.optional(), ids: z.string().max(8000).optional() });

/** Khoảng thời gian (theo ngày UTC, gồm cả ngày cuối). Mặc định: đầu tháng hiện tại → hết hôm nay. */
function rangeOf(q: { from?: string | undefined; to?: string | undefined }, now = new Date()) {
  const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  if (from.getTime() > to.getTime()) throw HttpError.badRequest('Ngày bắt đầu phải trước ngày kết thúc');
  const len = to.getTime() - from.getTime() + 1;
  return { from, to, prevFrom: new Date(from.getTime() - len), prevTo: new Date(from.getTime() - 1) };
}
const pctChange = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

/** Hoa hồng giới thiệu của cộng đồng do CHỦ cộng đồng tự chuyển khoản rồi ghi nhận ở đây (kind = 'community'). */
export const communityReferralPayoutsService = {
  /** KPI + bảng cộng tác viên cần chi trả + lịch sử chi trả gần đây, theo khoảng ngày (ngày phát sinh hoa hồng). */
  async overview(communityId: string, query: PayoutsQuery, now = new Date()) {
    const r = rangeOf(query, now);
    const community = await prisma.community.findFirst({ where: { id: communityId, deletedAt: null }, select: { referralRateBps: true } });
    if (!community) throw HttpError.notFound('Không tìm thấy cộng đồng');

    const refs = await prisma.communityReferral.findMany({ where: { communityId }, select: { referrerId: true, referredUserId: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
    const firstSeen = new Map<string, Date>();
    const referredCount = new Map<string, number>();
    for (const x of refs) {
      if (!firstSeen.has(x.referrerId)) firstSeen.set(x.referrerId, x.createdAt);
      referredCount.set(x.referrerId, (referredCount.get(x.referrerId) ?? 0) + 1);
    }
    const inRange = (d: Date) => d >= r.from && d <= r.to;
    const newReferrers = [...firstSeen.values()].filter(inRange).length;
    const newReferred = refs.filter((x) => inRange(x.createdAt)).length;

    const base: Prisma.ReferralCommissionWhereInput = { kind: 'community', communityId, status: { not: 'void' } };
    const [commissions, prevCommission, paidNow, paidPrev] = await Promise.all([
      prisma.referralCommission.groupBy({ by: ['referrerId', 'status', 'payoutId'], where: { ...base, createdAt: { gte: r.from, lte: r.to } }, _sum: { amountCents: true } }),
      prisma.referralCommission.aggregate({ where: { ...base, createdAt: { gte: r.prevFrom, lte: r.prevTo } }, _sum: { amountCents: true } }),
      prisma.communityCommissionPayout.aggregate({ where: { communityId, createdAt: { gte: r.from, lte: r.to } }, _sum: { amountCents: true } }),
      prisma.communityCommissionPayout.aggregate({ where: { communityId, createdAt: { gte: r.prevFrom, lte: r.prevTo } }, _sum: { amountCents: true } }),
    ]);
    const money = new Map<string, { total: number; due: number; paid: number }>();
    for (const c of commissions) {
      const cur = money.get(c.referrerId) ?? { total: 0, due: 0, paid: 0 };
      const v = c._sum.amountCents ?? 0;
      cur.total += v;
      if (c.payoutId) cur.paid += v;
      else if (c.status === 'pending') cur.due += v;
      money.set(c.referrerId, cur);
    }
    const dueTotal = [...money.values()].reduce((s, m) => s + m.due, 0);
    const commissionTotal = [...money.values()].reduce((s, m) => s + m.total, 0);
    const paidTotal = paidNow._sum.amountCents ?? 0;

    // Bảng: mọi người giới thiệu (kể cả chưa phát sinh hoa hồng trong kỳ), lọc theo tìm kiếm + trạng thái.
    const ids = [...firstSeen.keys()];
    const tokens = (query.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const users = await prisma.user.findMany({
      where: {
        id: { in: ids },
        ...(tokens.length
          ? { AND: tokens.map((t) => ({ OR: [{ firstName: { contains: t, mode: 'insensitive' as const } }, { lastName: { contains: t, mode: 'insensitive' as const } }, { email: { contains: t, mode: 'insensitive' as const } }] })) }
          : {}),
      },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });
    const all = users
      .map((u) => {
        const m = money.get(u.id) ?? { total: 0, due: 0, paid: 0 };
        const status: 'due' | 'paid' | 'none' = m.due > 0 ? 'due' : m.paid > 0 ? 'paid' : 'none';
        return {
          userId: u.id,
          name: nameOf(u),
          email: u.email,
          avatarUrl: u.avatarUrl,
          joinedAt: firstSeen.get(u.id)!.toISOString(),
          referredCount: referredCount.get(u.id) ?? 0,
          rateBps: community.referralRateBps,
          totalCents: m.total,
          dueCents: m.due,
          paidCents: m.paid,
          status,
        };
      })
      .filter((x) => (query.status === 'all' ? true : x.status === query.status))
      .sort((a, b) => b.dueCents - a.dueCents || b.totalCents - a.totalCents || a.name.localeCompare(b.name));
    const total = all.length;
    const rows = all.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);

    const history = await prisma.communityCommissionPayout.findMany({
      where: { communityId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      include: { referrer: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    });

    return {
      range: { from: r.from.toISOString().slice(0, 10), to: r.to.toISOString().slice(0, 10) },
      rateBps: community.referralRateBps,
      kpis: {
        collaborators: { value: firstSeen.size, delta: newReferrers > 0 ? newReferrers : null },
        referred: { value: refs.length, delta: newReferred > 0 ? newReferred : null },
        due: { cents: dueTotal, deltaPct: pctChange(commissionTotal, prevCommission._sum.amountCents ?? 0) },
        paid: { cents: paidTotal, deltaPct: pctChange(paidTotal, paidPrev._sum.amountCents ?? 0) },
      },
      rows,
      meta: { total, page: query.page, pageSize: query.pageSize },
      history: history.map((h) => ({
        id: h.id,
        referrerId: h.referrerId,
        name: nameOf(h.referrer),
        avatarUrl: h.referrer.avatarUrl,
        amountCents: h.amountCents,
        commissionCount: h.commissionCount,
        note: h.note,
        paidAt: h.createdAt.toISOString(),
      })),
    };
  },

  /**
   * Chủ cộng đồng đã chuyển khoản cho các cộng tác viên: đánh dấu hoa hồng cộng đồng còn `pending` (trong khoảng ngày) là đã chi + ghi lịch sử.
   * Tiền do nền tảng giữ hộ chỉ được "trả lại" cho chủ ở những khoản này (không còn trừ vào doanh thu) và người nhận không rút lại được lần nữa:
   * chỉ ghi nhận phần KHÔNG vượt số dư rút được của người nhận (nếu họ đã rút qua nền tảng thì phần đó nền tảng đã trả rồi, để nguyên `pending`).
   */
  async pay(communityId: string, ownerId: string, body: PayBody, now = new Date()) {
    const r = rangeOf(body, now);
    const referrers = await prisma.communityReferral.findMany({ where: { communityId, referrerId: { in: body.referrerIds } }, distinct: ['referrerId'], select: { referrerId: true } });
    const valid = new Set(referrers.map((x) => x.referrerId));
    const results: { referrerId: string; paidCents: number; commissionCount: number; leftCents: number; reason: 'ok' | 'nothing_due' | 'already_withdrawn' | 'not_referrer' }[] = [];

    for (const referrerId of [...new Set(body.referrerIds)]) {
      if (!valid.has(referrerId)) {
        results.push({ referrerId, paidCents: 0, commissionCount: 0, leftCents: 0, reason: 'not_referrer' });
        continue;
      }
      const done = await prisma.$transaction(async (tx) => {
        // Cùng khóa với việc rút tiền của chính người nhận: hai bên không thể cùng "trả" một khoản.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refwd:${referrerId}`}))`;
        const due = await tx.referralCommission.findMany({
          where: { referrerId, kind: 'community', communityId, status: 'pending', payoutId: null, createdAt: { gte: r.from, lte: r.to } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const dueCents = due.reduce((s, c) => s + c.amountCents, 0);
        if (due.length === 0) return { paidCents: 0, commissionCount: 0, leftCents: 0, reason: 'nothing_due' as const };
        let room = (await referralWithdrawalsService.balanceInTx(tx, referrerId)).withdrawableCents;
        const pick: typeof due = [];
        for (const c of due) {
          if (c.amountCents <= room) {
            pick.push(c);
            room -= c.amountCents;
          }
        }
        const paidCents = pick.reduce((s, c) => s + c.amountCents, 0);
        if (pick.length === 0) return { paidCents: 0, commissionCount: 0, leftCents: dueCents, reason: 'already_withdrawn' as const };
        const payout = await tx.communityCommissionPayout.create({ data: { communityId, referrerId, paidById: ownerId, amountCents: paidCents, commissionCount: pick.length, note: body.note ?? null } });
        await tx.referralCommission.updateMany({ where: { id: { in: pick.map((c) => c.id) }, payoutId: null }, data: { status: 'paid', payoutId: payout.id } });
        return { paidCents, commissionCount: pick.length, leftCents: dueCents - paidCents, reason: 'ok' as const };
      });
      results.push({ referrerId, ...done });
      if (done.paidCents > 0) {
        notify({
          userId: referrerId,
          type: 'system',
          title: 'Chủ cộng đồng đã chi trả hoa hồng giới thiệu',
          body: `Bạn đã được chi trả ${vnd(done.paidCents)} hoa hồng giới thiệu. Khoản này được chuyển khoản trực tiếp nên không còn trong số dư rút của bạn.`,
          link: `/communities/${communityId}/chuong-trinh-gioi-thieu`,
          communityId,
        });
      }
    }
    const paidCents = results.reduce((s, x) => s + x.paidCents, 0);
    return { results, totals: { paidCents, paidPeople: results.filter((x) => x.paidCents > 0).length } };
  },

  /** CSV danh sách cần thanh toán (mặc định mọi người còn khoản cần chi; `ids` = chỉ những người đã chọn). Có BOM để Excel đọc đúng tiếng Việt. */
  async exportCsv(communityId: string, query: { from?: string | undefined; to?: string | undefined; ids?: string | undefined }, now = new Date()) {
    const r = rangeOf(query, now);
    const wanted = query.ids ? new Set(query.ids.split(',').map((s) => s.trim()).filter(Boolean)) : null;
    const groups = await prisma.referralCommission.groupBy({
      by: ['referrerId'],
      where: { kind: 'community', communityId, status: 'pending', payoutId: null, createdAt: { gte: r.from, lte: r.to }, ...(wanted ? { referrerId: { in: [...wanted] } } : {}) },
      _sum: { amountCents: true },
      _count: { _all: true },
    });
    const ids = groups.map((g) => g.referrerId);
    const [users, accounts, referred, community] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true } }),
      prisma.referralPayoutAccount.findMany({ where: { userId: { in: ids } }, select: { userId: true, bankName: true, accountHolder: true, accountLast4: true } }),
      prisma.communityReferral.groupBy({ by: ['referrerId'], where: { communityId, referrerId: { in: ids } }, _count: { _all: true } }),
      prisma.community.findFirst({ where: { id: communityId }, select: { referralRateBps: true } }),
    ]);
    const u = new Map(users.map((x) => [x.id, x]));
    const a = new Map(accounts.map((x) => [x.userId, x]));
    const n = new Map(referred.map((x) => [x.referrerId, x._count._all]));
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ['Cộng tác viên', 'Email', 'Người được giới thiệu', 'Tỷ lệ hoa hồng (%)', 'Số khoản hoa hồng', 'Cần chi trả (đ)', 'Ngân hàng', 'Chủ tài khoản', 'Số tài khoản (4 số cuối)'];
    const lines = groups
      .map((g) => {
        const usr = u.get(g.referrerId);
        const acc = a.get(g.referrerId);
        return [usr ? nameOf(usr) : g.referrerId, usr?.email ?? '', n.get(g.referrerId) ?? 0, (community?.referralRateBps ?? 0) / 100, g._count._all, g._sum.amountCents ?? 0, acc?.bankName ?? '', acc?.accountHolder ?? '', acc ? `••••${acc.accountLast4}` : ''];
      })
      .sort((x, y) => Number(y[5]) - Number(x[5]));
    return `﻿${[header, ...lines].map((row) => row.map(esc).join(',')).join('\r\n')}\r\n`;
  },
};
