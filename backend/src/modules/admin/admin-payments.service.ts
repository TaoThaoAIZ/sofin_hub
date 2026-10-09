import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { cfg } from '../settings/settings.service.js';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PayoutStatus } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { notify } from '../notifications/notifications.service.js';
import { balanceView, paymentsService, payoutPolicy } from '../payments/payments.service.js';
import { auditService } from './admin-audit.service.js';
import { DAY, code, codePrefix, dateRangeFields, nameMap, pctRound, person, personSelect, ref, resolveRange } from './admin-b2.common.js';
import { likeEscape, enumList, iso, noteField, pageMeta, pageQuery, reasonField } from './admin.common.js';

/** Admin đợt 2 — Payments: transactions, subscriptions, refunds, chargebacks (mô phỏng), creator revenue, payouts. Contract: docs/api/admin-batch2.md. */

const MAX_SERIES_DAYS = 400;
const likeAny = (q: string): Prisma.StringFilter => ({ contains: likeEscape(q), mode: 'insensitive' });
const userMatch = (q: string): Prisma.UserWhereInput => ({ OR: [{ firstName: likeAny(q) }, { lastName: likeAny(q) }, { email: likeAny(q) }] });

const bp = (pct: number) => Math.round(pct * 100);
const rates = () => ({ commissionBp: bp(cfg().payments.commissionPct), gatewayFeeBp: bp(cfg().payments.gatewayFeePct), gatewayFeeFixedCents: cfg().payments.gatewayFeeFixedCents });
const METHOD_LABEL = { stripe: 'Stripe', vnpay: 'VNPay', momo: 'MoMo', bank_transfer: 'Chuyển khoản' } as const;

const tell = (userId: string | null | undefined, title: string, body: string, communityId?: string) => {
  if (userId) notify({ userId, type: 'system', title, body, ...(communityId ? { communityId } : {}) });
};
const usd = (vnd: number) => `${Math.round(vnd).toLocaleString('vi-VN')}đ`; // tên cũ; tiền nay là VND

/** Phí theo công thức của `/courses/:id/revenue` (số nguyên, làm tròn như SQL). Giao dịch chưa thành công = 0. */
function fees(p: { status: string; amountCents: number; refundedCents: number }) {
  if (p.status !== 'succeeded' && p.status !== 'refunded') return { platformFeeCents: 0, gatewayFeeCents: 0, creatorEarningsCents: 0 };
  const r = rates();
  const platformFeeCents = Math.floor(((p.amountCents - p.refundedCents) * r.commissionBp + 5000) / 10000);
  const gatewayFeeCents = Math.floor((p.amountCents * r.gatewayFeeBp + 5000) / 10000) + r.gatewayFeeFixedCents;
  return { platformFeeCents, gatewayFeeCents, creatorEarningsCents: p.amountCents - p.refundedCents - platformFeeCents - gatewayFeeCents };
}

/* -------------------------------------------------------------------------------- schemas */
export const txQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  method: z.enum(['stripe', 'vnpay', 'momo', 'bank_transfer']).optional(),
  communityId: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  ownerId: z.string().max(100).optional(),
  kind: z.enum(['initial', 'renewal', 'module']).optional(),
  ...dateRangeFields,
  sort: z.enum(['newest', 'oldest', 'amount']).default('newest'),
});
export const rangeQuery = z.object({ ...dateRangeFields });
export const txRefundBody = z.object({ reason: reasonField, amountCents: z.number().int().min(1).optional(), note: noteField });
export const noteOnly = z.object({ note: noteField });
export const subsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  communityId: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  sort: z.enum(['newest', 'amount', 'nextBilling']).default('newest'),
});
export const pauseBody = z.object({ reason: reasonField, note: noteField });
export const cancelSubBody = z.object({ reason: reasonField, atPeriodEnd: z.boolean().default(false), note: noteField });
export const refundsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  communityId: z.string().max(100).optional(),
  sort: z.enum(['newest', 'amount']).default('newest'),
});
export const approveRefundBody = z.object({ note: noteField, amountCents: z.number().int().min(1).optional() });
export const rejectRefundBody = z.object({ reason: reasonField, note: noteField });
const CB_REASONS = ['fraudulent', 'product_not_received', 'duplicate', 'subscription_cancelled', 'unrecognized', 'product_not_as_described'] as const;
export const cbQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  reason: z.enum(CB_REASONS).optional(),
  communityId: z.string().max(100).optional(),
  sort: z.enum(['deadline', 'newest', 'amount']).default('deadline'),
});
export const createCbBody = z.object({
  paymentId: z.string().min(1).max(100),
  reason: z.enum(CB_REASONS),
  amountCents: z.number().int().min(1).optional(),
  deadlineDays: z.number().int().min(1).max(30).default(7),
});
export const evidenceBody = z.object({ note: z.string().trim().min(1, 'Vui lòng mô tả bằng chứng').max(2000), evidenceUrls: z.array(z.string().trim().max(500)).max(10).default([]) });
export const creatorsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['net', 'gross', 'pending', 'name']).default('net'),
  ...dateRangeFields,
});
const PAYOUT_STATUSES = ['requested', 'approved', 'paid', 'failed', 'on_hold', 'rejected'] as const;
export const payoutsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  communityId: z.string().max(100).optional(),
  ownerId: z.string().max(100).optional(),
  sort: z.enum(['newest', 'amount', 'scheduled']).default('newest'),
});
export const payoutReasonBody = z.object({ reason: reasonField, note: noteField });

/* -------------------------------------------------------------------------------- transactions */
const txInclude = {
  user: { select: personSelect },
  community: { select: { id: true, title: true, owner: { select: personSelect } } },
  module: { select: { id: true, title: true } },
} satisfies Prisma.PaymentInclude;
type TxRow = Prisma.PaymentGetPayload<{ include: typeof txInclude }>;

const toTx = (p: TxRow) => ({
  id: p.id,
  code: code('TXN', p.id),
  invoiceNumber: p.invoiceNumber,
  customer: person(p.user),
  community: { id: p.community.id, name: p.community.title, ownerName: p.community.owner ? person(p.community.owner)!.name : null },
  product: p.kind === 'module'
    ? { type: 'module' as const, label: `Module · ${p.module?.title ?? 'đã xóa'}` }
    : { type: 'membership' as const, label: p.kind === 'renewal' ? 'Membership · Renewal' : 'Membership · Monthly' },
  kind: p.kind,
  method: p.method,
  paymentMethodLabel: METHOD_LABEL[p.method],
  currency: p.currency,
  amountCents: p.amountCents,
  refundedCents: p.refundedCents,
  ...fees(p),
  status: p.status,
  failureReason: p.failureReason,
  /** Mã chuyển khoản khách ghi vào nội dung CK; có mã + status pending/expired ⇒ admin duyệt tay được. */
  refCode: p.refCode,
  expiresAt: iso(p.expiresAt),
  subscriptionId: p.subscriptionId,
  createdAt: p.createdAt.toISOString(),
  confirmedAt: iso(p.confirmedAt),
});
export type AdminTransaction = ReturnType<typeof toTx>;

function txWhere(q: z.infer<typeof txQuery>): Prisma.PaymentWhereInput {
  const statuses = enumList(q.status, ['succeeded', 'failed', 'pending', 'refunded'] as const, 'status');
  const { from, to } = resolveRange(q);
  const and: Prisma.PaymentWhereInput[] = [];
  if (q.q) {
    const t = codePrefix(q.q, 'TXN');
    and.push({ OR: [{ invoiceNumber: likeAny(q.q) }, { gatewayChargeId: likeAny(q.q) }, { refCode: likeAny(q.q) }, { user: userMatch(q.q) }, { community: { title: likeAny(q.q) } }, ...(t ? [{ id: { startsWith: t } }] : [])] });
  }
  return {
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(q.method ? { method: q.method } : {}),
    ...(q.communityId ? { communityId: q.communityId } : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.ownerId ? { community: { ownerId: q.ownerId } } : {}),
    ...(q.kind ? { kind: q.kind } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

async function loadTx(id: string): Promise<TxRow> {
  const p = await prisma.payment.findUnique({ where: { id }, include: txInclude });
  if (!p) throw HttpError.notFound('Không tìm thấy giao dịch');
  return p;
}

/* -------------------------------------------------------------------------------- subscriptions */
const subInclude = { user: { select: personSelect }, community: { select: { id: true, title: true } } } satisfies Prisma.SubscriptionInclude;
type SubRow = Prisma.SubscriptionGetPayload<{ include: typeof subInclude }>;
const toSub = (s: SubRow) => ({
  id: s.id,
  code: code('SUB', s.id),
  user: person(s.user),
  community: ref(s.community),
  plan: s.trialEndsAt ? ('trial' as const) : ('paid' as const),
  amountCents: s.priceCents,
  billingCycle: 'monthly' as const,
  status: s.status,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  currentPeriodStart: s.currentPeriodStart.toISOString(),
  currentPeriodEnd: s.currentPeriodEnd.toISOString(),
  nextBillingAt: ['active', 'trialing', 'past_due'].includes(s.status) && !s.cancelAtPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
  trialEndsAt: iso(s.trialEndsAt),
  canceledAt: iso(s.canceledAt),
  createdAt: s.createdAt.toISOString(),
});

/* -------------------------------------------------------------------------------- refunds */
const refundInclude = {
  user: { select: personSelect },
  community: { select: { id: true, title: true, owner: { select: personSelect } } },
  payment: { select: { id: true, amountCents: true } },
  resolvedBy: { select: personSelect },
} satisfies Prisma.RefundRequestInclude;
type RefundRow = Prisma.RefundRequestGetPayload<{ include: typeof refundInclude }>;
const toRefund = (r: RefundRow) => ({
  id: r.id,
  code: code('RF', r.id),
  paymentId: r.paymentId,
  transactionCode: code('TXN', r.paymentId),
  customer: person(r.user),
  creator: person(r.community.owner),
  community: ref(r.community),
  amountCents: r.amountCents,
  paymentAmountCents: r.payment.amountCents,
  reason: r.reason,
  status: r.status,
  auto: r.auto,
  note: r.note,
  requestedAt: r.createdAt.toISOString(),
  resolvedAt: iso(r.resolvedAt),
  resolvedBy: person(r.resolvedBy),
});
export type AdminRefund = ReturnType<typeof toRefund>;

/* -------------------------------------------------------------------------------- chargebacks */
const cbInclude = {
  user: { select: personSelect },
  community: { select: { id: true, title: true, owner: { select: personSelect } } },
} satisfies Prisma.ChargebackInclude;
type CbRow = Prisma.ChargebackGetPayload<{ include: typeof cbInclude }>;
const toCb = (c: CbRow) => ({
  id: c.id,
  code: `CB-${String(c.caseNo).padStart(5, '0')}`,
  paymentId: c.paymentId,
  transactionCode: code('TXN', c.paymentId),
  customer: person(c.user),
  creator: person(c.community.owner),
  community: ref(c.community),
  amountCents: c.amountCents,
  reason: c.reason,
  status: c.status,
  deadlineAt: c.deadlineAt.toISOString(),
  daysLeft: c.status === 'open' || c.status === 'under_review' ? Math.max(0, Math.ceil((c.deadlineAt.getTime() - Date.now()) / DAY)) : null,
  evidence: c.evidenceSubmittedAt ? ('submitted' as const) : ('missing' as const),
  evidenceNote: c.evidenceNote,
  evidenceUrls: c.evidenceUrls,
  gatewayDisputeId: c.gatewayDisputeId,
  openedAt: c.openedAt.toISOString(),
  resolvedAt: iso(c.resolvedAt),
});
export type AdminChargeback = ReturnType<typeof toCb>;
const CB_STATUSES = ['open', 'under_review', 'won', 'lost'] as const;

/* -------------------------------------------------------------------------------- payouts */
const payoutInclude = {
  owner: { select: personSelect },
  community: { select: { id: true, title: true } },
} satisfies Prisma.PayoutInclude;
type PayoutRow = Prisma.PayoutGetPayload<{ include: typeof payoutInclude }>;

/** Ngày chi kế tiếp: mồng 1 hoặc 16 (00:00 UTC) sau thời điểm tạo lệnh. */
export function scheduledFor(createdAt: Date): Date {
  const y = createdAt.getUTCFullYear();
  const m = createdAt.getUTCMonth();
  const candidates = [Date.UTC(y, m, 1), Date.UTC(y, m, 16), Date.UTC(y, m + 1, 1)];
  return new Date(candidates.find((t) => t > createdAt.getTime())!);
}

const toPayout = (p: PayoutRow) => ({
  id: p.id,
  code: code('PO', p.id),
  creator: person(p.owner),
  community: ref(p.community),
  amountCents: p.amountCents,
  method: { type: 'bank' as const, bankName: p.bankName, accountMasked: `****${p.accountLast4}`, label: `Bank · ${p.bankName} •• ${p.accountLast4}` },
  status: p.status,
  scheduledFor: scheduledFor(p.createdAt).toISOString(),
  paidAt: p.status === 'paid' ? p.updatedAt.toISOString() : null,
  failureReason: p.failureReason,
  heldFromStatus: p.heldFromStatus,
  note: p.note,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});
export type AdminPayout = ReturnType<typeof toPayout>;

/* ================================================================================ service */
export const adminPaymentsService = {
  /* ---------------------------------------------------------------- transactions */
  async txSummary(q: { from?: string; to?: string }) {
    const { from, to } = resolveRange(q);
    const range = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
    const r = rates();
    const rangeSql = Prisma.sql`${from ? Prisma.sql`AND "createdAt" >= ${from.toISOString()}::timestamp` : Prisma.empty} ${to ? Prisma.sql`AND "createdAt" <= ${to.toISOString()}::timestamp` : Prisma.empty}`;
    const [byStatus, [fee]] = await Promise.all([
      prisma.payment.groupBy({ by: ['status'], where: range, _count: { _all: true }, _sum: { amountCents: true, refundedCents: true } }),
      prisma.$queryRaw<{ platform: bigint }[]>(Prisma.sql`
        SELECT COALESCE(SUM((("amountCents" - "refundedCents")::bigint * ${r.commissionBp} + 5000) / 10000), 0)::bigint AS platform
        FROM "Payment" WHERE "status" IN ('succeeded', 'refunded') ${rangeSql}`),
    ]);
    const sum = (s: string, f: 'amountCents' | 'refundedCents') => byStatus.find((x) => x.status === s)?._sum[f] ?? 0;
    const count = (s: string) => byStatus.find((x) => x.status === s)?._count._all ?? 0;
    const transactions = byStatus.reduce((a, x) => a + x._count._all, 0);
    return {
      grossVolumeCents: sum('succeeded', 'amountCents') + sum('refunded', 'amountCents'),
      netRevenueCents: Number(fee?.platform ?? 0),
      transactions,
      failed: count('failed'),
      failedRatePct: pctRound(count('failed'), transactions),
      refundsCents: sum('succeeded', 'refundedCents') + sum('refunded', 'refundedCents'),
    };
  },

  async listTx(q: z.infer<typeof txQuery>) {
    const where = txWhere(q);
    const orderBy: Prisma.PaymentOrderByWithRelationInput[] =
      q.sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }] : q.sort === 'amount' ? [{ amountCents: 'desc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: txInclude }),
      prisma.payment.count({ where }),
    ]);
    return { data: rows.map(toTx), meta: pageMeta(q.page, q.limit, total) };
  },

  async txDetail(id: string) {
    const p = await loadTx(id);
    const [u, sub, refunds, cbs, history] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: p.userId }, select: { createdAt: true, status: true } }),
      p.subscriptionId ? prisma.subscription.findUnique({ where: { id: p.subscriptionId }, select: { id: true, status: true, currentPeriodEnd: true } }) : null,
      prisma.refundRequest.findMany({ where: { paymentId: id }, orderBy: { createdAt: 'desc' }, include: refundInclude }),
      prisma.chargeback.findMany({ where: { paymentId: id }, orderBy: { openedAt: 'desc' }, include: cbInclude }),
      auditService.forTarget('payment', id),
    ]);
    const tx = toTx(p);
    const timeline: Array<{ type: string; title: string; detail: string; at: string }> = [
      { type: 'checkout', title: 'Checkout started', detail: `${tx.customer?.name ?? ''} · ${tx.product.label}`, at: tx.createdAt },
    ];
    if (p.status === 'failed') timeline.push({ type: 'payment_failed', title: 'Payment failed', detail: p.failureReason ?? 'declined', at: p.updatedAt.toISOString() });
    if (p.confirmedAt) timeline.push({ type: 'payment_captured', title: 'Payment captured', detail: `${usd(p.amountCents)} via ${tx.paymentMethodLabel}`, at: p.confirmedAt.toISOString() });
    for (const r of refunds) if (r.status === 'approved' && r.resolvedAt) timeline.push({ type: 'refunded', title: 'Refunded', detail: `${usd(r.amountCents)} returned to customer`, at: r.resolvedAt.toISOString() });
    for (const c of cbs) timeline.push({ type: 'chargeback', title: 'Chargeback opened', detail: `${c.reason} · ${usd(c.amountCents)}`, at: c.openedAt.toISOString() });
    timeline.sort((a, b) => b.at.localeCompare(a.at));
    return {
      ...tx,
      gatewayChargeId: p.gatewayChargeId,
      gateway: p.method === 'bank_transfer' ? 'Chuyển khoản VietQR (SePay)' : `${METHOD_LABEL[p.method]} (cũ)`,
      customerInfo: { ...person(p.user)!, joinedAt: u.createdAt.toISOString(), status: u.status },
      creator: person(p.community.owner),
      subscription: sub ? { id: sub.id, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd.toISOString() } : null,
      refunds: refunds.map(toRefund),
      chargebacks: cbs.map(toCb),
      timeline,
      history,
    };
  },

  async refundTx(adminId: string, id: string, body: z.infer<typeof txRefundBody>) {
    const before = await loadTx(id);
    const refund = await paymentsService.adminRefundPayment(adminId, id, body);
    await auditService.record(adminId, {
      action: 'payment.refund', targetType: 'payment', targetId: id, targetLabel: code('TXN', id), reason: body.reason, note: body.note,
      metadata: { amountCents: refund.amountCents, paymentAmountCents: before.amountCents },
    });
    const full = await prisma.refundRequest.findUniqueOrThrow({ where: { id: refund.id }, include: refundInclude });
    return { transaction: toTx(await loadTx(id)), refund: toRefund(full) };
  },

  async retryTx(adminId: string, id: string, body: { note?: string }) {
    const after = await paymentsService.adminRetryPayment(id);
    await auditService.record(adminId, {
      action: 'payment.retry', targetType: 'payment', targetId: id, targetLabel: code('TXN', id), note: body.note, metadata: { result: after.status },
    });
    return toTx(await loadTx(id));
  },

  /* ---------------------------------------------------------------- subscriptions */
  async subsSummary() {
    const d30 = new Date(Date.now() - 30 * DAY);
    const [active, new30d, mrr, pastDue, paused, ended30] = await Promise.all([
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { createdAt: { gte: d30 } } }),
      prisma.subscription.aggregate({ where: { status: 'active', cancelAtPeriodEnd: false }, _sum: { priceCents: true } }),
      prisma.subscription.count({ where: { status: 'past_due' } }),
      prisma.subscription.count({ where: { status: 'paused' } }),
      prisma.subscription.count({ where: { status: { in: ['canceled', 'expired'] }, updatedAt: { gte: d30 } } }),
    ]);
    return { active, new30d, mrrCents: mrr._sum.priceCents ?? 0, churnPct: pctRound(ended30, active + ended30), pastDue, paused };
  },

  async listSubs(q: z.infer<typeof subsQuery>) {
    const statuses = enumList(q.status, ['trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'] as const, 'status');
    const t = q.q ? codePrefix(q.q, 'SUB') : undefined;
    const where: Prisma.SubscriptionWhereInput = {
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.q ? { AND: [{ OR: [{ user: userMatch(q.q) }, { community: { title: likeAny(q.q) } }, ...(t ? [{ id: { startsWith: t } }] : [])] }] } : {}),
    };
    const orderBy: Prisma.SubscriptionOrderByWithRelationInput[] =
      q.sort === 'amount' ? [{ priceCents: 'desc' }, { id: 'asc' }] : q.sort === 'nextBilling' ? [{ currentPeriodEnd: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.subscription.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: subInclude }),
      prisma.subscription.count({ where }),
    ]);
    return { data: rows.map(toSub), meta: pageMeta(q.page, q.limit, total) };
  },

  async subDetail(id: string) {
    const s = await prisma.subscription.findUnique({ where: { id }, include: subInclude });
    if (!s) throw HttpError.notFound('Không tìm thấy gói thành viên');
    const [pays, history] = await Promise.all([
      prisma.payment.findMany({ where: { subscriptionId: id }, orderBy: { createdAt: 'desc' }, take: 10, include: txInclude }),
      auditService.forTarget('subscription', id),
    ]);
    return { ...toSub(s), payments: pays.map(toTx), history };
  },

  async subAction(adminId: string, id: string, action: 'pause' | 'resume' | 'cancel', body: { reason?: string; note?: string; atPeriodEnd?: boolean }) {
    const prev = await prisma.subscription.findUnique({ where: { id }, select: { status: true } });
    if (!prev) throw HttpError.notFound('Không tìm thấy gói thành viên');
    await paymentsService.adminSubscriptionAction(id, action, { atPeriodEnd: body.atPeriodEnd, reason: body.reason });
    const s = await prisma.subscription.findUniqueOrThrow({ where: { id }, include: subInclude });
    await auditService.record(adminId, {
      action: action === 'cancel' && body.atPeriodEnd ? 'subscription.cancel_at_period_end' : `subscription.${action}`,
      targetType: 'subscription', targetId: id, targetLabel: `${code('SUB', id)} · ${person(s.user)?.name ?? ''}`, reason: body.reason, note: body.note,
      metadata: { from: prev.status, to: s.status, community: s.communityId },
    });
    return toSub(s);
  },

  /* ---------------------------------------------------------------- refunds */
  async refundsSummary() {
    const [groups] = await Promise.all([prisma.refundRequest.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountCents: true } })]);
    const g = (s: string) => groups.find((x) => x.status === s);
    return {
      pending: g('pending')?._count._all ?? 0,
      refunding: g('refunding')?._count._all ?? 0, // đang hoàn tiền / chờ đối soát
      approved: g('approved')?._count._all ?? 0,
      rejected: g('rejected')?._count._all ?? 0,
      pendingAmountCents: g('pending')?._sum.amountCents ?? 0,
      refundedAmountCents: g('approved')?._sum.amountCents ?? 0,
    };
  },

  async listRefunds(q: z.infer<typeof refundsQuery>) {
    const statuses = enumList(q.status, ['pending', 'refunding', 'approved', 'rejected'] as const, 'status');
    const rf = q.q ? codePrefix(q.q, 'RF') : undefined;
    const tx = q.q ? codePrefix(q.q, 'TXN') : undefined;
    const where: Prisma.RefundRequestWhereInput = {
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.q
        ? { AND: [{ OR: [{ user: userMatch(q.q) }, { community: { title: likeAny(q.q) } }, { community: { owner: userMatch(q.q) } }, { reason: likeAny(q.q) }, ...(rf ? [{ id: { startsWith: rf } }] : []), ...(tx ? [{ paymentId: { startsWith: tx } }] : [])] }] }
        : {}),
    };
    const orderBy: Prisma.RefundRequestOrderByWithRelationInput[] = q.sort === 'amount' ? [{ amountCents: 'desc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.refundRequest.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: refundInclude }),
      prisma.refundRequest.count({ where }),
    ]);
    return { data: rows.map(toRefund), meta: pageMeta(q.page, q.limit, total) };
  },

  async refundDetail(id: string) {
    const r = await prisma.refundRequest.findUnique({ where: { id }, include: refundInclude });
    if (!r) throw HttpError.notFound('Không tìm thấy yêu cầu hoàn tiền');
    const [payment, hist, prev, reports, user, history] = await Promise.all([
      loadTx(r.paymentId),
      prisma.payment.findMany({ where: { userId: r.userId, communityId: r.communityId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.refundRequest.findMany({ where: { userId: r.userId, id: { not: id } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.report.count({ where: { targetUserId: r.userId } }),
      prisma.user.findUniqueOrThrow({ where: { id: r.userId }, select: { createdAt: true } }),
      auditService.forTarget('refund', id),
    ]);
    return {
      ...toRefund(r),
      payment: toTx(payment),
      paymentHistory: hist.map((p) => ({ id: p.id, code: code('TXN', p.id), amountCents: p.amountCents, status: p.status, createdAt: p.createdAt.toISOString() })),
      customerHistory: {
        memberSince: user.createdAt.toISOString(),
        previousRefunds: prev.map((p) => ({ id: p.id, amountCents: p.amountCents, status: p.status, requestedAt: p.createdAt.toISOString() })),
        reportsReceived: reports,
      },
      creatorResponse: null,
      history,
    };
  },

  async approveRefund(adminId: string, id: string, body: z.infer<typeof approveRefundBody>) {
    const before = await prisma.refundRequest.findUnique({ where: { id }, select: { amountCents: true } });
    await paymentsService.adminApproveRefund(adminId, id, body);
    await auditService.record(adminId, {
      action: 'refund.approve', targetType: 'refund', targetId: id, targetLabel: code('RF', id), note: body.note,
      metadata: { requestedCents: before?.amountCents, refundedCents: body.amountCents ?? before?.amountCents, partial: !!body.amountCents && body.amountCents < (before?.amountCents ?? 0) },
    });
    return toRefund(await prisma.refundRequest.findUniqueOrThrow({ where: { id }, include: refundInclude }));
  },

  async rejectRefund(adminId: string, id: string, body: z.infer<typeof rejectRefundBody>) {
    await paymentsService.resolveRefund(adminId, id, 'reject', [body.reason, body.note].filter(Boolean).join(' — ').slice(0, 500));
    await auditService.record(adminId, { action: 'refund.reject', targetType: 'refund', targetId: id, targetLabel: code('RF', id), reason: body.reason, note: body.note });
    return toRefund(await prisma.refundRequest.findUniqueOrThrow({ where: { id }, include: refundInclude }));
  },

  /* ---------------------------------------------------------------- chargebacks (mô phỏng) */
  async cbSummary() {
    const g = await prisma.chargeback.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountCents: true } });
    const c = (s: string) => g.find((x) => x.status === s)?._count._all ?? 0;
    const sum = (s: string) => g.find((x) => x.status === s)?._sum.amountCents ?? 0;
    return { open: c('open'), underReview: c('under_review'), won: c('won'), lost: c('lost'), disputedAmountCents: sum('open') + sum('under_review') };
  },

  async listCb(q: z.infer<typeof cbQuery>) {
    const statuses = enumList(q.status, CB_STATUSES, 'status');
    const t = q.q ? codePrefix(q.q, 'TXN') : undefined;
    const no = q.q ? /^(?:CB-)?0*(\d{1,9})$/i.exec(q.q.trim())?.[1] : undefined;
    const where: Prisma.ChargebackWhereInput = {
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(q.reason ? { reason: q.reason } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.q ? { AND: [{ OR: [{ user: userMatch(q.q) }, { community: { title: likeAny(q.q) } }, ...(t ? [{ paymentId: { startsWith: t } }] : []), ...(no ? [{ caseNo: Number(no) }] : [])] }] } : {}),
    };
    const orderBy: Prisma.ChargebackOrderByWithRelationInput[] =
      q.sort === 'amount' ? [{ amountCents: 'desc' }, { id: 'asc' }] : q.sort === 'newest' ? [{ openedAt: 'desc' }, { id: 'asc' }] : [{ status: 'asc' }, { deadlineAt: 'asc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.chargeback.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: cbInclude }),
      prisma.chargeback.count({ where }),
    ]);
    return { data: rows.map(toCb), meta: pageMeta(q.page, q.limit, total) };
  },

  async cbDetail(id: string) {
    const c = await prisma.chargeback.findUnique({ where: { id }, include: cbInclude });
    if (!c) throw HttpError.notFound('Không tìm thấy chargeback');
    const [payment, history] = await Promise.all([loadTx(c.paymentId), auditService.forTarget('chargeback', id)]);
    return { ...toCb(c), payment: toTx(payment), history };
  },

  async createCb(adminId: string, body: z.infer<typeof createCbBody>) {
    const p = await prisma.payment.findUnique({ where: { id: body.paymentId } });
    if (!p) throw HttpError.notFound('Không tìm thấy giao dịch');
    if (p.status !== 'succeeded') throw HttpError.conflict('Chỉ giao dịch đã thanh toán thành công mới có chargeback');
    if (await prisma.chargeback.count({ where: { paymentId: p.id, status: { in: ['open', 'under_review'] } } })) throw HttpError.conflict('Giao dịch này đã có chargeback đang xử lý');
    const remaining = p.amountCents - p.refundedCents;
    const amount = body.amountCents ?? remaining;
    if (amount > remaining) throw HttpError.badRequest('Số tiền tranh chấp vượt quá phần còn lại của giao dịch');
    const c = await prisma.chargeback.create({
      data: {
        paymentId: p.id, communityId: p.communityId, userId: p.userId, amountCents: amount, reason: body.reason,
        deadlineAt: new Date(Date.now() + body.deadlineDays * DAY), gatewayDisputeId: `mock_dp_${randomUUID().slice(0, 12)}`,
      },
      include: cbInclude,
    });
    await auditService.record(adminId, {
      action: 'chargeback.create', targetType: 'chargeback', targetId: c.id, targetLabel: toCb(c).code, reason: body.reason,
      metadata: { paymentId: p.id, amountCents: amount, simulated: true },
    });
    tell(c.community.owner?.id, 'Có tranh chấp thanh toán mới', `Giao dịch ${code('TXN', p.id)} (${usd(amount)}) bị mở chargeback.`, p.communityId);
    return toCb(c);
  },

  async cbAction(adminId: string, id: string, action: 'submit-evidence' | 'accept' | 'mark-won' | 'mark-lost', body: { note?: string; evidenceUrls?: string[] }) {
    const c0 = await prisma.chargeback.findUnique({ where: { id } });
    if (!c0) throw HttpError.notFound('Không tìm thấy chargeback');
    const now = new Date();
    let to: 'under_review' | 'won' | 'lost';
    let r: { count: number };
    if (action === 'submit-evidence') {
      to = 'under_review';
      r = await prisma.chargeback.updateMany({
        where: { id, status: { in: ['open', 'under_review'] } },
        data: { status: 'under_review', evidenceNote: body.note, evidenceUrls: body.evidenceUrls ?? [], evidenceSubmittedAt: now },
      });
    } else if (action === 'accept') {
      to = 'lost';
      r = await prisma.chargeback.updateMany({ where: { id, status: { in: ['open', 'under_review'] } }, data: { status: 'lost', resolutionNote: body.note ?? 'Accepted', resolvedById: adminId, resolvedAt: now } });
    } else {
      to = action === 'mark-won' ? 'won' : 'lost';
      r = await prisma.chargeback.updateMany({ where: { id, status: 'under_review' }, data: { status: to, resolutionNote: body.note ?? null, resolvedById: adminId, resolvedAt: now } });
    }
    if (r.count === 0) {
      throw HttpError.conflict(action === 'mark-won' || action === 'mark-lost' ? 'Chỉ chốt thắng/thua được chargeback đang xem xét (đã nộp bằng chứng)' : 'Chargeback đã được chốt');
    }
    if (to === 'lost') await paymentsService.adminApplyChargebackLoss(adminId, c0.paymentId, `Chargeback ${id} thua`);
    const c = await prisma.chargeback.findUniqueOrThrow({ where: { id }, include: cbInclude });
    await auditService.record(adminId, {
      action: `chargeback.${action.replace('-', '_')}`, targetType: 'chargeback', targetId: id, targetLabel: toCb(c).code, note: body.note,
      metadata: { from: c0.status, to, paymentId: c0.paymentId, simulated: true },
    });
    if (to !== 'under_review') tell(c.community.owner?.id, `Chargeback ${to === 'won' ? 'thắng' : 'thua'}`, `${toCb(c).code} (${usd(c.amountCents)}) đã được chốt: ${to === 'won' ? 'thắng' : 'thua'}.`, c.communityId);
    return toCb(c);
  },

  /* ---------------------------------------------------------------- creator revenue */
  async creatorRows(range: { from?: Date; to?: Date }) {
    const r = rates();
    const win = Prisma.sql`${range.from ? Prisma.sql`AND COALESCE(p."confirmedAt", p."createdAt") >= ${range.from.toISOString()}::timestamp` : Prisma.empty} ${range.to ? Prisma.sql`AND COALESCE(p."confirmedAt", p."createdAt") <= ${range.to.toISOString()}::timestamp` : Prisma.empty}`;
    const comm = Prisma.sql`((p."amountCents" - p."refundedCents")::bigint * ${r.commissionBp} + 5000) / 10000`;
    const gate = Prisma.sql`((p."amountCents"::bigint * ${r.gatewayFeeBp} + 5000) / 10000) + ${r.gatewayFeeFixedCents}`;
    const [all, inRange, payouts, owned] = await Promise.all([
      prisma.$queryRaw<{ id: string; net: bigint }[]>(Prisma.sql`
        SELECT c."ownerId" AS id, COALESCE(SUM(p."amountCents" - p."refundedCents" - (${comm}) - (${gate})), 0)::bigint AS net
        FROM "Payment" p JOIN "Course" c ON c."id" = p."courseId"
        WHERE c."ownerId" IS NOT NULL AND p."status" IN ('succeeded', 'refunded') GROUP BY c."ownerId"`),
      prisma.$queryRaw<{ id: string; gross: bigint; refunds: bigint; platform: bigint; gateway: bigint }[]>(Prisma.sql`
        SELECT c."ownerId" AS id, COALESCE(SUM(p."amountCents"), 0)::bigint AS gross, COALESCE(SUM(p."refundedCents"), 0)::bigint AS refunds,
               COALESCE(SUM(${comm}), 0)::bigint AS platform, COALESCE(SUM(${gate}), 0)::bigint AS gateway
        FROM "Payment" p JOIN "Course" c ON c."id" = p."courseId"
        WHERE c."ownerId" IS NOT NULL AND p."status" IN ('succeeded', 'refunded') ${win} GROUP BY c."ownerId"`),
      prisma.$queryRaw<{ id: string; requested: bigint; paid: bigint }[]>(Prisma.sql`
        SELECT c."ownerId" AS id, COALESCE(SUM(po."amountCents") FILTER (WHERE po."status" <> 'rejected'), 0)::bigint AS requested,
               COALESCE(SUM(po."amountCents") FILTER (WHERE po."status" = 'paid'), 0)::bigint AS paid
        FROM "Payout" po JOIN "Course" c ON c."id" = po."courseId" WHERE c."ownerId" IS NOT NULL GROUP BY c."ownerId"`),
      prisma.community.groupBy({ by: ['ownerId'], where: { deletedAt: null, ownerId: { not: null } }, _count: { _all: true } }),
    ]);
    // Số dư theo chính sách rút tiền (holding period + reserve + nợ) — tính từng cộng đồng rồi cộng theo chủ. Chỉ THÊM trường mới.
    const policy = payoutPolicy();
    const perCourse = await prisma.$queryRaw<{ owner: string; net: bigint; eligible: bigint; requested: bigint }[]>(Prisma.sql`
      SELECT c."ownerId" AS owner,
             COALESCE(SUM(t."n"), 0)::bigint AS net,
             COALESCE(SUM(t."n") FILTER (WHERE t."n" < 0 OR t."at" <= ${policy.eligibleBefore.toISOString()}::timestamp), 0)::bigint AS eligible,
             COALESCE((SELECT SUM(po."amountCents") FROM "Payout" po WHERE po."courseId" = c."id" AND po."status" <> 'rejected'), 0)::bigint AS requested
      FROM "Course" c
      JOIN LATERAL (
        SELECT COALESCE(p."confirmedAt", p."createdAt") AS "at",
               (p."amountCents" - p."refundedCents" - (${comm}) - (${gate}))::bigint AS "n"
        FROM "Payment" p WHERE p."courseId" = c."id" AND p."status" IN ('succeeded', 'refunded')
      ) t ON true
      WHERE c."ownerId" IS NOT NULL
      GROUP BY c."ownerId", c."id"`);
    const bal = new Map<string, { withdrawableCents: number; heldCents: number; reserveCents: number; debtCents: number }>();
    for (const x of perCourse) {
      const v = balanceView({ net: Number(x.net), eligible: Number(x.eligible), requested: Number(x.requested) }, policy.reservePct);
      const cur = bal.get(x.owner) ?? { withdrawableCents: 0, heldCents: 0, reserveCents: 0, debtCents: 0 };
      bal.set(x.owner, { withdrawableCents: cur.withdrawableCents + v.withdrawable, heldCents: cur.heldCents + v.held, reserveCents: cur.reserveCents + v.reserve, debtCents: cur.debtCents + v.debt });
    }
    const rg = new Map(inRange.map((x) => [x.id, x]));
    const po = new Map(payouts.map((x) => [x.id, x]));
    const own = new Map(owned.map((x) => [x.ownerId!, x._count._all]));
    return all.map((a) => {
      const x = rg.get(a.id);
      const gross = Number(x?.gross ?? 0), refunds = Number(x?.refunds ?? 0), platform = Number(x?.platform ?? 0), gateway = Number(x?.gateway ?? 0);
      return {
        ownerId: a.id,
        communities: own.get(a.id) ?? 0,
        grossCents: gross,
        refundsCents: refunds,
        platformFeeCents: platform,
        gatewayFeeCents: gateway,
        netCents: gross - refunds - platform - gateway,
        pendingBalanceCents: Number(a.net) - Number(po.get(a.id)?.requested ?? 0),
        paidOutCents: Number(po.get(a.id)?.paid ?? 0),
        ...(bal.get(a.id) ?? { withdrawableCents: 0, heldCents: 0, reserveCents: 0, debtCents: 0 }),
      };
    });
  },

  async creatorsSummary(q: { from?: string; to?: string }) {
    const rows = await this.creatorRows(resolveRange(q));
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
    return {
      creators: rows.length,
      grossCents: sum((r) => r.grossCents),
      refundsCents: sum((r) => r.refundsCents),
      platformFeeCents: sum((r) => r.platformFeeCents),
      gatewayFeeCents: sum((r) => r.gatewayFeeCents),
      netCents: sum((r) => r.netCents),
      pendingBalanceCents: sum((r) => r.pendingBalanceCents),
      withdrawableCents: sum((r) => r.withdrawableCents),
      heldCents: sum((r) => r.heldCents),
      reserveCents: sum((r) => r.reserveCents),
      debtCents: sum((r) => r.debtCents),
    };
  },

  async listCreators(q: z.infer<typeof creatorsQuery>) {
    let rows = await this.creatorRows(resolveRange(q));
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId) } }, select: personSelect });
    const byUser = new Map(users.map((u) => [u.id, u]));
    if (q.q) {
      const needle = q.q.toLowerCase();
      const courses = await prisma.community.findMany({ where: { title: likeAny(q.q), ownerId: { not: null } }, select: { ownerId: true } });
      const viaCourse = new Set(courses.map((c) => c.ownerId));
      rows = rows.filter((r) => {
        const u = byUser.get(r.ownerId);
        return viaCourse.has(r.ownerId) || (u && `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(needle));
      });
    }
    const nm = (id: string) => { const u = byUser.get(id); return u ? `${u.firstName} ${u.lastName}`.toLowerCase() : ''; };
    rows.sort((a, b) =>
      q.sort === 'name' ? nm(a.ownerId).localeCompare(nm(b.ownerId))
        : q.sort === 'gross' ? b.grossCents - a.grossCents : q.sort === 'pending' ? b.pendingBalanceCents - a.pendingBalanceCents : b.netCents - a.netCents,
    );
    const page = rows.slice((q.page - 1) * q.limit, q.page * q.limit);
    return {
      data: page.map(({ ownerId, ...r }) => ({ creator: person(byUser.get(ownerId) ?? null), ...r })),
      meta: pageMeta(q.page, q.limit, rows.length),
    };
  },

  async creatorDetail(userId: string, q: { from?: string; to?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: personSelect });
    if (!user) throw HttpError.notFound('Không tìm thấy chủ cộng đồng');
    const range = resolveRange(q);
    const all = await this.creatorRows(range);
    const mine = all.find((r) => r.ownerId === userId);
    if (!mine && !(await prisma.community.count({ where: { ownerId: userId } }))) throw HttpError.notFound('Người dùng này không sở hữu cộng đồng nào');
    const { ownerId: _o, communities: _c, ...kpis } = mine ?? { ownerId: userId, communities: 0, grossCents: 0, refundsCents: 0, platformFeeCents: 0, gatewayFeeCents: 0, netCents: 0, pendingBalanceCents: 0, paidOutCents: 0, withdrawableCents: 0, heldCents: 0, reserveCents: 0, debtCents: 0 };
    // Không truyền from/to: KPI là toàn thời gian nên chuỗi cũng phủ toàn bộ giao dịch (từ ngày đầu tiên, tối thiểu 30 và tối đa MAX_SERIES_DAYS ngày gần nhất).
    const to = range.to ?? new Date();
    const r = rates();
    const [series, perCourse, txs, payouts] = await Promise.all([
      prisma.$queryRaw<{ d: Date; gross: bigint; refunds: bigint; net: bigint }[]>(Prisma.sql`
        SELECT date_trunc('day', COALESCE(p."confirmedAt", p."createdAt")) AS d, SUM(p."amountCents")::bigint AS gross, SUM(p."refundedCents")::bigint AS refunds,
               SUM(p."amountCents" - p."refundedCents" - (((p."amountCents" - p."refundedCents")::bigint * ${r.commissionBp} + 5000) / 10000)
                   - (((p."amountCents"::bigint * ${r.gatewayFeeBp} + 5000) / 10000) + ${r.gatewayFeeFixedCents}))::bigint AS net
        FROM "Payment" p JOIN "Course" c ON c."id" = p."courseId"
        WHERE c."ownerId" = ${userId} AND p."status" IN ('succeeded', 'refunded')
          ${range.from ? Prisma.sql`AND COALESCE(p."confirmedAt", p."createdAt") >= ${range.from.toISOString()}::timestamp` : Prisma.empty} AND COALESCE(p."confirmedAt", p."createdAt") <= ${to.toISOString()}::timestamp
        GROUP BY 1`),
      prisma.$queryRaw<{ id: string; title: string; gross: bigint; net: bigint; requested: bigint }[]>(Prisma.sql`
        SELECT c."id", c."title",
          COALESCE((SELECT SUM(p."amountCents") FROM "Payment" p WHERE p."courseId" = c."id" AND p."status" IN ('succeeded','refunded')), 0)::bigint AS gross,
          COALESCE((SELECT SUM(p."amountCents" - p."refundedCents" - (((p."amountCents" - p."refundedCents")::bigint * ${r.commissionBp} + 5000) / 10000)
                   - (((p."amountCents"::bigint * ${r.gatewayFeeBp} + 5000) / 10000) + ${r.gatewayFeeFixedCents}))
                   FROM "Payment" p WHERE p."courseId" = c."id" AND p."status" IN ('succeeded','refunded')), 0)::bigint AS net,
          COALESCE((SELECT SUM(po."amountCents") FROM "Payout" po WHERE po."courseId" = c."id" AND po."status" <> 'rejected'), 0)::bigint AS requested
        FROM "Course" c WHERE c."ownerId" = ${userId} AND c."deletedAt" IS NULL ORDER BY c."title"`),
      prisma.payment.findMany({ where: { community: { ownerId: userId } }, orderBy: { createdAt: 'desc' }, take: 20, include: txInclude }),
      prisma.payout.findMany({ where: { community: { ownerId: userId } }, orderBy: { createdAt: 'desc' }, take: 10, include: payoutInclude }),
    ]);
    const firstDay = series.reduce<Date | null>((m, x) => (!m || x.d < m ? x.d : m), null);
    const from = range.from ?? new Date(Math.max(Math.min(firstDay?.getTime() ?? Infinity, to.getTime() - 29 * DAY), to.getTime() - (MAX_SERIES_DAYS - 1) * DAY));
    const byDay = new Map(series.map((s) => [s.d.toISOString().slice(0, 10), s]));
    const days: Array<{ date: string; grossCents: number; netCents: number; refundsCents: number }> = [];
    for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t <= to.getTime() && days.length < MAX_SERIES_DAYS; t += DAY) {
      const key = new Date(t).toISOString().slice(0, 10);
      const s = byDay.get(key);
      days.push({ date: key, grossCents: Number(s?.gross ?? 0), netCents: Number(s?.net ?? 0), refundsCents: Number(s?.refunds ?? 0) });
    }
    return {
      creator: person(user),
      kpis,
      series: days,
      communities: await Promise.all(
        perCourse.map(async (c) => {
          const b = await paymentsService.balanceFor(c.id);
          return { id: c.id, name: c.title, grossCents: Number(c.gross), netCents: Number(c.net), pendingBalanceCents: Number(c.net) - Number(c.requested), withdrawableCents: b.withdrawable, heldCents: b.held, reserveCents: b.reserve, debtCents: b.debt };
        }),
      ),
      transactions: txs.map(toTx),
      payouts: payouts.map(toPayout),
    };
  },

  /* ---------------------------------------------------------------- payouts */
  async payoutsSummary() {
    const g = await prisma.payout.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountCents: true } });
    const sum = (s: PayoutStatus) => g.find((x) => x.status === s)?._sum.amountCents ?? 0;
    const cnt = (s: PayoutStatus) => g.find((x) => x.status === s)?._count._all ?? 0;
    return {
      pendingCents: sum('requested'), processingCents: sum('approved'), paidCents: sum('paid'), failedCents: sum('failed'), onHoldCents: sum('on_hold'),
      counts: Object.fromEntries(PAYOUT_STATUSES.map((s) => [s, cnt(s)])) as Record<(typeof PAYOUT_STATUSES)[number], number>,
    };
  },

  async listPayouts(q: z.infer<typeof payoutsQuery>) {
    const statuses = enumList(q.status, PAYOUT_STATUSES, 'status');
    const t = q.q ? codePrefix(q.q, 'PO') : undefined;
    const where: Prisma.PayoutWhereInput = {
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.q ? { AND: [{ OR: [{ owner: userMatch(q.q) }, { community: { title: likeAny(q.q) } }, { bankName: likeAny(q.q) }, ...(t ? [{ id: { startsWith: t } }] : [])] }] } : {}),
    };
    const orderBy: Prisma.PayoutOrderByWithRelationInput[] =
      q.sort === 'amount' ? [{ amountCents: 'desc' }, { id: 'asc' }] : q.sort === 'scheduled' ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      prisma.payout.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit, include: payoutInclude }),
      prisma.payout.count({ where }),
    ]);
    return { data: rows.map(toPayout), meta: pageMeta(q.page, q.limit, total) };
  },

  async payoutDetail(id: string) {
    const p = await prisma.payout.findUnique({ where: { id }, include: payoutInclude });
    if (!p) throw HttpError.notFound('Không tìm thấy yêu cầu rút tiền');
    const [bal, history] = await Promise.all([paymentsService.balanceFor(p.communityId), auditService.forTarget('payout', id)]);
    return {
      ...toPayout(p),
      // availableCents giữ nghĩa cũ (net − đã yêu cầu); các trường sau là THÊM MỚI theo chính sách holding period/reserve/nợ.
      creatorBalance: {
        netCents: bal.net, requestedCents: bal.requested, availableCents: bal.net - bal.requested,
        withdrawableCents: bal.withdrawable, heldCents: bal.held, reserveCents: bal.reserve, debtCents: bal.debt, holdDays: bal.policy.holdDays,
      },
      history,
    };
  },

  async payoutAction(adminId: string, id: string, action: 'approve' | 'mark-paid' | 'mark-failed' | 'retry' | 'hold' | 'release' | 'reject', body: { reason?: string; note?: string }) {
    const p = await prisma.payout.findUnique({ where: { id } });
    if (!p) throw HttpError.notFound('Không tìm thấy yêu cầu rút tiền');
    const rules: Record<typeof action, { from: PayoutStatus[]; data: Prisma.PayoutUncheckedUpdateManyInput; msg: string }> = {
      approve: { from: ['requested'], data: { status: 'approved' }, msg: 'Chỉ duyệt được yêu cầu đang chờ' },
      'mark-paid': { from: ['requested', 'approved'], data: { status: 'paid', failureReason: null }, msg: 'Yêu cầu không ở trạng thái có thể đánh dấu đã chi' },
      'mark-failed': { from: ['approved'], data: { status: 'failed', failureReason: body.reason ?? null }, msg: 'Chỉ đánh dấu thất bại được yêu cầu đang xử lý' },
      retry: { from: ['failed'], data: { status: 'approved', failureReason: null }, msg: 'Chỉ thử lại được yêu cầu thất bại' },
      hold: { from: ['requested', 'approved', 'failed'], data: { status: 'on_hold', heldFromStatus: p.status }, msg: 'Không thể giữ yêu cầu ở trạng thái này' },
      release: { from: ['on_hold'], data: { status: p.heldFromStatus ?? 'requested', heldFromStatus: null }, msg: 'Yêu cầu không đang bị giữ' },
      reject: { from: ['requested', 'approved', 'failed', 'on_hold'], data: { status: 'rejected', heldFromStatus: null }, msg: 'Yêu cầu đã được xử lý xong' },
    };
    const rule = rules[action];
    const noteText = action === 'reject' || action === 'hold' ? [body.reason, body.note].filter(Boolean).join(' — ') : body.note;
    const r = await prisma.payout.updateMany({ where: { id, status: { in: rule.from } }, data: { ...rule.data, ...(noteText ? { note: noteText } : {}) } });
    if (r.count === 0) throw HttpError.conflict(rule.msg);
    const after = await prisma.payout.findUniqueOrThrow({ where: { id }, include: payoutInclude });
    await auditService.record(adminId, {
      action: `payout.${action.replace('-', '_')}`, targetType: 'payout', targetId: id, targetLabel: `${code('PO', id)} · ${person(after.owner)?.name ?? ''}`, reason: body.reason, note: body.note,
      metadata: { from: p.status, to: after.status, amountCents: p.amountCents },
    });
    const msgs: Record<typeof action, [string, string]> = {
      approve: ['Yêu cầu rút tiền đã được duyệt', `Yêu cầu rút ${usd(p.amountCents)} đang được xử lý.`],
      'mark-paid': ['Đã chuyển tiền', `${usd(p.amountCents)} đã được chuyển vào tài khoản ****${p.accountLast4}.`],
      'mark-failed': ['Chuyển tiền thất bại', `Lệnh rút ${usd(p.amountCents)} thất bại${body.reason ? `: ${body.reason}` : ''}. Chúng tôi sẽ thử lại.`],
      retry: ['Đang thử chuyển tiền lại', `Lệnh rút ${usd(p.amountCents)} đang được xử lý lại.`],
      hold: ['Yêu cầu rút tiền đang được giữ', `Lệnh rút ${usd(p.amountCents)} tạm giữ${body.reason ? `: ${body.reason}` : ''}.`],
      release: ['Yêu cầu rút tiền đã được tiếp tục', `Lệnh rút ${usd(p.amountCents)} đã được tiếp tục xử lý.`],
      reject: ['Yêu cầu rút tiền bị từ chối', `Lệnh rút ${usd(p.amountCents)} không được chấp nhận${body.reason ? `: ${body.reason}` : ''}.`],
    };
    tell(p.ownerId, msgs[action][0], msgs[action][1], p.communityId);
    return toPayout(after);
  },
};

void nameMap;
void noteField;
