import type { SeedContext } from './context.js';
import { demoUserId } from './demo-ids.js';

/**
 * Kịch bản TEST THỦ CÔNG cho module payments, trên cộng đồng CÓ PHÍ do owner làm chủ: `paid-demo` (do seed communities-scenarios tạo,
 * $19/tháng; nếu chưa có thì dùng `yt` — cũng do owner làm chủ, có phí). Idempotent: id cố định (`seed-*`), chạy lại không nhân đôi
 * (bản ghi đã có thì bỏ qua, số hóa đơn chỉ cấp cho giao dịch MỚI qua InvoiceSequence).
 *
 * Tài khoản test (mật khẩu chung, xem seed-accounts.ts):
 *  - member1  : gói ACTIVE (2 giao dịch succeeded: initial 40 ngày trước + renewal 10 ngày trước, mỗi cái có hóa đơn INV). Còn hạn ~20 ngày.
 *  - member2  : gói ACTIVE nhưng ĐÃ HỦY CUỐI KỲ (cancelAtPeriodEnd, còn truy cập ~15 ngày; có thể "Tiếp tục gói").
 *  - member3  : đang DÙNG THỬ (trialing, còn ~4 ngày) — chưa có thanh toán.
 *  - newbie   : chưa có gì => checkout + confirm + hoàn tiền trong cửa sổ 7 ngày (tự duyệt).
 *  - owner    : xem /courses/<paid-demo>/revenue: doanh thu ~90 ngày (nhiều giao dịch), MRR, số dư khả dụng; 1 payout requested + 1 payout paid.
 *  - admin    : /admin/refunds?status=pending có 1 yêu cầu hoàn tiền NGOÀI cửa sổ chờ duyệt (người yêu cầu: thành viên minh họa #2);
 *               /admin/payouts?status=requested có 1 payout chờ duyệt.
 * Thành viên minh họa (isDemo) đóng vai người mua trong lịch sử: #1 = giao dịch ĐÃ HOÀN TIỀN (RefundRequest approved), #2 = yêu cầu hoàn tiền pending,
 * #3..#10 = lịch sử thanh toán hàng tháng để owner có số liệu doanh thu.
 */
const DAY = 86_400_000;
const PERIOD_DAYS = 30;

type Db = SeedContext['db'];

interface PaySeed {
  id: string;
  userId: string;
  subId: string;
  kind: 'initial' | 'renewal';
  confirmedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  status?: 'succeeded' | 'refunded';
  refundedCents?: number;
}

async function nextInvoiceNumber(db: Db, year: number): Promise<string> {
  const [row] = await db.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "InvoiceSequence" ("year", "lastNumber") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "InvoiceSequence"."lastNumber" + 1
    RETURNING "lastNumber"`;
  return `INV-${year}-${String(row!.lastNumber).padStart(6, '0')}`;
}

export async function seedPayments(ctx: SeedContext): Promise<void> {
  const { db, userIds } = ctx;
  const course = (await db.community.findUnique({ where: { id: 'paid-demo' } })) ?? (await db.community.findUnique({ where: { id: 'yt' } }));
  if (!course || course.priceCents <= 0) return;
  const communityId = course.id;
  const price = course.priceCents;
  const now = Date.now();
  const ago = (days: number) => new Date(now - days * DAY);
  const ahead = (days: number) => new Date(now + days * DAY);

  // Demo user có thật trong DB (do seed communities tạo); thiếu thì bỏ qua kịch bản của họ.
  const demoIds = Array.from({ length: 11 }, (_, i) => demoUserId(communityId, i));
  const existing = new Set((await db.user.findMany({ where: { id: { in: demoIds } }, select: { id: true } })).map((u) => u.id));
  const demo = (i: number) => (existing.has(demoIds[i]!) ? demoIds[i]! : undefined);

  // ------------------------------------------------------------------ ghi danh cho tài khoản test
  for (const key of ['member1', 'member2', 'member3'] as const) {
    await db.enrollment.upsert({
      where: { userId_communityId: { userId: userIds[key], communityId: communityId } },
      create: { userId: userIds[key], communityId: communityId, role: 'member' },
      update: {},
    });
  }
  await db.enrollment.upsert({
    where: { userId_communityId: { userId: userIds.owner, communityId: communityId } },
    create: { userId: userIds.owner, communityId: communityId, role: 'owner' },
    update: {},
  });

  // ------------------------------------------------------------------ gói (Subscription)
  interface SubSeed {
    id: string;
    userId: string;
    status: 'trialing' | 'active' | 'canceled' | 'expired';
    start: Date;
    end: Date;
    cancelAtPeriodEnd?: boolean;
    trialEndsAt?: Date;
    canceledAt?: Date;
  }
  const subs: SubSeed[] = [
    { id: 'seed-sub-member1', userId: userIds.member1, status: 'active', start: ago(10), end: ahead(20) },
    { id: 'seed-sub-member2', userId: userIds.member2, status: 'active', start: ago(15), end: ahead(15), cancelAtPeriodEnd: true, canceledAt: ago(2) },
    { id: 'seed-sub-member3', userId: userIds.member3, status: 'trialing', start: ago(3), end: ahead(4), trialEndsAt: ahead(4) },
  ];
  const pays: PaySeed[] = [
    { id: 'seed-pay-member1-a', userId: userIds.member1, subId: 'seed-sub-member1', kind: 'initial', confirmedAt: ago(40), periodStart: ago(40), periodEnd: ago(10) },
    { id: 'seed-pay-member1-b', userId: userIds.member1, subId: 'seed-sub-member1', kind: 'renewal', confirmedAt: ago(10), periodStart: ago(10), periodEnd: ahead(20) },
    { id: 'seed-pay-member2-a', userId: userIds.member2, subId: 'seed-sub-member2', kind: 'initial', confirmedAt: ago(15), periodStart: ago(15), periodEnd: ahead(15) },
  ];

  // Giao dịch đã hoàn tiền (thành viên minh họa #1) + yêu cầu hoàn tiền đang chờ (thành viên minh họa #2).
  const refundedUser = demo(1);
  if (refundedUser) {
    subs.push({ id: 'seed-sub-refunded', userId: refundedUser, status: 'canceled', start: ago(20), end: ahead(10), canceledAt: ago(19) });
    pays.push({ id: 'seed-pay-refunded', userId: refundedUser, subId: 'seed-sub-refunded', kind: 'initial', confirmedAt: ago(20), periodStart: ago(20), periodEnd: ahead(10), status: 'refunded', refundedCents: price });
  }
  const pendingUser = demo(2);
  if (pendingUser) {
    subs.push({ id: 'seed-sub-pendref', userId: pendingUser, status: 'active', start: ago(12), end: ahead(18) });
    pays.push({ id: 'seed-pay-pendref', userId: pendingUser, subId: 'seed-sub-pendref', kind: 'initial', confirmedAt: ago(12), periodStart: ago(12), periodEnd: ahead(18) });
  }

  // Lịch sử hàng tháng cho owner có số liệu doanh thu: người thứ i mua từ d0 ngày trước, gia hạn mỗi 30 ngày.
  for (let i = 3; i <= 10; i++) {
    const uid = demo(i);
    if (!uid) continue;
    const d0 = 15 + i * 9;
    const periods = Math.floor(d0 / PERIOD_DAYS) + 1;
    const subId = `seed-sub-hist-${i}`;
    const lastAgo = d0 - PERIOD_DAYS * (periods - 1);
    subs.push({ id: subId, userId: uid, status: 'active', start: ago(lastAgo), end: ahead(PERIOD_DAYS - lastAgo), cancelAtPeriodEnd: i === 10 });
    for (let k = 0; k < periods; k++) {
      const startAgo = d0 - PERIOD_DAYS * k;
      pays.push({
        id: `seed-pay-hist-${i}-${k}`,
        userId: uid,
        subId,
        kind: k === 0 ? 'initial' : 'renewal',
        confirmedAt: ago(startAgo),
        periodStart: ago(startAgo),
        periodEnd: ago(startAgo - PERIOD_DAYS),
      });
    }
  }

  for (const s of subs) {
    await db.subscription.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        userId: s.userId,
        communityId: communityId,
        status: s.status,
        priceCents: price,
        currentPeriodStart: s.start,
        currentPeriodEnd: s.end,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd ?? false,
        trialEndsAt: s.trialEndsAt ?? null,
        canceledAt: s.canceledAt ?? null,
        createdAt: s.start,
      },
      update: {},
    });
  }

  // ------------------------------------------------------------------ giao dịch (Payment) + hóa đơn tuần tự theo thời gian
  pays.sort((a, b) => a.confirmedAt.getTime() - b.confirmedAt.getTime());
  const have = new Set((await db.payment.findMany({ where: { id: { in: pays.map((p) => p.id) } }, select: { id: true } })).map((p) => p.id));
  for (const p of pays) {
    if (have.has(p.id)) continue;
    const invoiceNumber = await nextInvoiceNumber(db, p.confirmedAt.getUTCFullYear());
    await db.payment.create({
      data: {
        id: p.id,
        communityId: communityId,
        userId: p.userId,
        method: 'bank_transfer',
        amountCents: price,
        trialDays: 0,
        status: p.status ?? 'succeeded',
        kind: p.kind,
        subscriptionId: p.subId,
        invoiceNumber,
        gatewayChargeId: `seed_ch_${p.id}`,
        refundedCents: p.refundedCents ?? 0,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        confirmedAt: p.confirmedAt,
        createdAt: p.confirmedAt,
      },
    });
  }

  // ------------------------------------------------------------------ hoàn tiền
  if (refundedUser) {
    await db.refundRequest.upsert({
      where: { id: 'seed-refund-approved' },
      create: {
        id: 'seed-refund-approved',
        paymentId: 'seed-pay-refunded',
        communityId: communityId,
        userId: refundedUser,
        amountCents: price,
        reason: 'Không phù hợp nhu cầu (seed)',
        status: 'approved',
        auto: true,
        resolvedAt: ago(19),
        createdAt: ago(19),
      },
      update: {},
    });
  }
  if (pendingUser) {
    await db.refundRequest.upsert({
      where: { id: 'seed-refund-pending' },
      create: {
        id: 'seed-refund-pending',
        paymentId: 'seed-pay-pendref',
        communityId: communityId,
        userId: pendingUser,
        amountCents: price,
        reason: 'Xin hoàn tiền sau 12 ngày — ngoài cửa sổ 7 ngày (seed)',
        status: 'pending',
        auto: false,
        createdAt: ago(1),
      },
      update: {},
    });
  }

  // ------------------------------------------------------------------ payout: 1 đã chi + 1 đang chờ duyệt
  const bank = { bankName: 'Vietcombank', accountHolder: 'OLIVIA OWNER', accountLast4: '6789' };
  await db.payout.upsert({
    where: { id: 'seed-payout-paid' },
    create: { id: 'seed-payout-paid', communityId: communityId, ownerId: userIds.owner, amountCents: 1_250_000, ...bank, status: 'paid', note: 'Đã chuyển khoản (seed)', createdAt: ago(20), updatedAt: ago(15) },
    update: {},
  });
  await db.payout.upsert({
    where: { id: 'seed-payout-pending' },
    create: { id: 'seed-payout-pending', communityId: communityId, ownerId: userIds.owner, amountCents: 1_250_000, ...bank, status: 'requested', createdAt: ago(1), updatedAt: ago(1) },
    update: {},
  });
}
