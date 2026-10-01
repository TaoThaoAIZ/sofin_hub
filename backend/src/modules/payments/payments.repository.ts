import { prisma, type Tx } from '../../db/prisma.js';
import { centsToUsd } from '../../db/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  Payment as PaymentRow,
  Payout as PayoutRow,
  RefundRequest as RefundRow,
  Subscription as SubscriptionRow,
} from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import type { PaymentIntent, PaymentStatus, Payout, RefundRequest, Subscription } from './payments.types.js';

/**
 * Dữ liệu thanh toán trên Postgres (Prisma). Mọi số tiền là Int cent.
 *
 * Kiến trúc: `PaymentsOps` là tập thao tác (đọc/ghi từng bảng + khóa + aggregate SQL). Có 2 dạng:
 *  - `paymentsRepository` (ops gắn với `prisma`, mỗi lệnh tự commit) — dùng cho truy vấn đơn lẻ.
 *  - `repo.transaction(async (ops) => ...)` cho ops gắn với MỘT transaction — mọi thao tác nhiều bảng (thanh toán + hóa đơn + gói + quyền
 *    truy cập; hoàn tiền + thu hồi; tạo payout theo số dư...) phải chạy trong đây để commit/rollback cùng nhau.
 * Tính đúng đắn dưới đồng thời dựa vào DB (không dùng lock trong bộ nhớ): transition có điều kiện (`updateMany where status in`),
 * unique (P2002) cho idempotency/webhook, `InvoiceSequence` upsert-increment atomic, `FOR UPDATE` (Course) và `FOR UPDATE SKIP LOCKED` (Subscription).
 */
export type NewPayment = Omit<PaymentIntent, 'id' | 'status' | 'createdAt' | 'confirmedAt' | 'refundedCents' | 'currency' | 'kind'> &
  Partial<Pick<PaymentIntent, 'kind' | 'status' | 'confirmedAt'>>;

export type PaymentPatch = Partial<Omit<PaymentIntent, 'id'>>;
export type SubscriptionPatch = Partial<Omit<Subscription, 'id' | 'canceledAt'>> & { canceledAt?: string | null };
export type RefundPatch = Partial<Pick<RefundRequest, 'status' | 'note' | 'resolvedBy' | 'resolvedAt' | 'amountCents'>>;
export type PayoutPatch = Partial<Pick<Payout, 'status' | 'note'>>;

/** Tỷ lệ hoa hồng/phí cổng ở dạng basis point nguyên (tính doanh thu bằng số nguyên ngay trong SQL). */
export interface RevenueRates {
  commissionBp: number;
  gatewayFeeBp: number;
  gatewayFeeFixedCents: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface RevenueTotals {
  grossCents: number;
  refundsCents: number;
  platformCommissionCents: number;
  gatewayFeeCents: number;
  netCents: number;
}

export interface PaymentsOps {
  // --- payments
  create(data: NewPayment): Promise<PaymentIntent>;
  findById(id: string): Promise<PaymentIntent | undefined>;
  /** So sánh-và-đặt nguyên tử: chỉ cập nhật nếu trạng thái hiện tại thuộc `from` (chặn double-confirm). count=0 → undefined. */
  transition(id: string, from: PaymentStatus[], patch: PaymentPatch): Promise<PaymentIntent | undefined>;
  findLatestForUser(courseId: string, userId: string): Promise<PaymentIntent | undefined>;
  listByUser(userId: string, page: number, limit: number): Promise<Page<PaymentIntent>>;
  /** Mốc thanh toán đầu tiên (confirmedAt nhỏ nhất) của một gói — mốc cửa sổ hoàn tiền. */
  earliestConfirmedForSubscription(subscriptionId: string): Promise<Date | undefined>;
  /** Cấp số hóa đơn kế tiếp `INV-<năm>-<6 số>` (InvoiceSequence increment atomic; giữ khóa hàng tới hết transaction). */
  nextInvoiceNumber(year: number): Promise<string>;

  // --- idempotency / webhook
  findIdempotent(userId: string, key: string): Promise<string | undefined>;
  /** Ghi (userId,key)→paymentId. Key đã tồn tại ⇒ ném lỗi P2002 (kiểm bằng `isUniqueViolation`); trong transaction lỗi này rollback cả transaction — bắt ở NGOÀI `transaction()`. */
  saveIdempotent(userId: string, key: string, paymentId: string): Promise<void>;
  /** true nếu event id mới (đã ghi WebhookEvent); false nếu đã có (P2002). */
  claimWebhookEvent(eventId: string): Promise<boolean>;
  releaseWebhookEvent(eventId: string): Promise<void>;

  // --- subscriptions
  createSubscription(data: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription>;
  findSubscription(id: string): Promise<Subscription | undefined>;
  /** Gói mới nhất của user ở cộng đồng (mọi trạng thái). */
  findSubscriptionFor(userId: string, courseId: string): Promise<Subscription | undefined>;
  updateSubscription(id: string, patch: SubscriptionPatch): Promise<Subscription | undefined>;
  listSubscriptionsByUser(userId: string): Promise<Subscription[]>;
  hasHadTrial(userId: string, courseId: string): Promise<boolean>;
  /**
   * Khóa (FOR UPDATE SKIP LOCKED) và trả về MỘT gói đến hạn (active|trialing, currentPeriodEnd <= now) chưa nằm trong `excludeIds`.
   * Phải gọi trong transaction; instance khác đang xử lý gói nào thì gói đó bị bỏ qua.
   */
  lockNextDueSubscription(now: Date, excludeIds: string[]): Promise<Subscription | undefined>;

  // --- refunds
  createRefund(data: Omit<RefundRequest, 'id' | 'createdAt'>): Promise<RefundRequest>;
  findRefund(id: string): Promise<RefundRequest | undefined>;
  findOpenRefundForPayment(paymentId: string): Promise<RefundRequest | undefined>;
  /** Chuyển trạng thái có điều kiện (pending→approved/rejected) — chỉ một bên thắng khi xử lý đồng thời. */
  transitionRefund(id: string, from: RefundRequest['status'][], patch: RefundPatch): Promise<RefundRequest | undefined>;
  listRefunds(status: RefundRequest['status'] | undefined, page: number, limit: number): Promise<Page<RefundRequest>>;

  // --- payouts
  createPayout(data: Omit<Payout, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payout>;
  findPayout(id: string): Promise<Payout | undefined>;
  transitionPayout(id: string, from: Payout['status'][], patch: PayoutPatch): Promise<Payout | undefined>;
  listPayouts(filter: { courseId?: string; status?: Payout['status'] }, page: number, limit: number): Promise<Page<Payout>>;

  // --- quyền truy cập (cùng transaction với thanh toán/hoàn tiền)
  /** Ghi danh (giữ vai trò cũ nếu đã có). 403 nếu đang bị cấm. */
  grantAccess(userId: string, courseId: string): Promise<void>;
  /** Thu hồi quyền truy cập, trừ Owner (Owner không bao giờ mất cộng đồng của mình vì hết gói). */
  revokeAccess(userId: string, courseId: string): Promise<void>;
  isBanned(userId: string, courseId: string): Promise<boolean>;

  // --- khóa
  /** `pg_advisory_xact_lock(hashtext(key))` — tuần tự hóa theo khóa logic đến hết transaction (chỉ có tác dụng trong transaction). */
  advisoryLock(key: string): Promise<void>;
  /** `SELECT ... FOR UPDATE` dòng Course — tuần tự hóa các payout của cùng cộng đồng. */
  lockCourse(courseId: string): Promise<void>;

  // --- aggregate SQL (không load bản ghi vào bộ nhớ)
  revenueTotals(courseId: string, range: { from?: Date; to?: Date }, rates: RevenueRates): Promise<RevenueTotals>;
  /** net toàn thời gian (mọi giao dịch succeeded|refunded) và tổng payout chưa bị từ chối. */
  balance(courseId: string, rates: RevenueRates): Promise<{ net: number; requested: number }>;
  subscriptionStats(courseId: string): Promise<{ active: number; trialing: number; mrrCents: number }>;
  recentPaid(courseId: string, limit: number): Promise<PaymentIntent[]>;
}

export interface PaymentsRepository extends PaymentsOps {
  /** Chạy `fn` trong một transaction Postgres; ops truyền vào gắn với transaction đó. Lỗi ném ra ⇒ rollback. */
  transaction<T>(fn: (ops: PaymentsOps) => Promise<T>, opts?: { timeoutMs?: number }): Promise<T>;
}

// ------------------------------------------------------------------------------------------------ mapping
const iso = (d: Date | null | undefined): string | undefined => (d ? d.toISOString() : undefined);
const dateOrUndef = (s: string | null | undefined): Date | null | undefined => (s === undefined ? undefined : s === null ? null : new Date(s));

function toPayment(r: PaymentRow): PaymentIntent {
  return {
    id: r.id,
    courseId: r.courseId,
    userId: r.userId,
    method: r.method,
    amountUsd: centsToUsd(r.amountCents),
    amountCents: r.amountCents,
    currency: 'usd',
    trialDays: r.trialDays,
    status: r.status,
    kind: r.kind,
    subscriptionId: r.subscriptionId ?? undefined,
    invoiceNumber: r.invoiceNumber ?? undefined,
    gatewayChargeId: r.gatewayChargeId ?? undefined,
    refundedCents: r.refundedCents,
    failureReason: r.failureReason ?? undefined,
    periodStart: iso(r.periodStart),
    periodEnd: iso(r.periodEnd),
    confirmedAt: iso(r.confirmedAt),
    createdAt: r.createdAt.toISOString(),
  };
}

function toSubscription(r: SubscriptionRow): Subscription {
  return {
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    status: r.status,
    priceCents: r.priceCents,
    currentPeriodStart: r.currentPeriodStart.toISOString(),
    currentPeriodEnd: r.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: r.cancelAtPeriodEnd,
    trialEndsAt: iso(r.trialEndsAt),
    canceledAt: iso(r.canceledAt),
    createdAt: r.createdAt.toISOString(),
  };
}

function toRefund(r: RefundRow): RefundRequest {
  return {
    id: r.id,
    paymentId: r.paymentId,
    courseId: r.courseId,
    userId: r.userId,
    amountCents: r.amountCents,
    reason: r.reason,
    status: r.status,
    auto: r.auto,
    note: r.note ?? undefined,
    resolvedBy: r.resolvedById ?? undefined,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: iso(r.resolvedAt),
  };
}

function toPayout(r: PayoutRow): Payout {
  return {
    id: r.id,
    courseId: r.courseId,
    ownerId: r.ownerId,
    amountCents: r.amountCents,
    method: { type: 'bank', bankName: r.bankName, accountHolder: r.accountHolder, accountLast4: r.accountLast4 },
    status: r.status,
    note: r.note ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function paymentData(p: PaymentPatch): Prisma.PaymentUncheckedUpdateManyInput {
  return {
    status: p.status,
    confirmedAt: dateOrUndef(p.confirmedAt),
    gatewayChargeId: p.gatewayChargeId,
    invoiceNumber: p.invoiceNumber,
    subscriptionId: p.subscriptionId,
    periodStart: dateOrUndef(p.periodStart),
    periodEnd: dateOrUndef(p.periodEnd),
    refundedCents: p.refundedCents,
    failureReason: p.failureReason,
  };
}

const num = (v: bigint | number | null | undefined): number => (v == null ? 0 : Number(v));
/** Timestamp cột `timestamp(3)` không múi giờ lưu UTC ⇒ truyền chuỗi ISO và ép `::timestamp` (bỏ hậu tố Z) cho kết quả tất định. */
const ts = (d: Date) => Prisma.sql`${d.toISOString()}::timestamp`;

// ------------------------------------------------------------------------------------------------ ops
type Db = Tx | typeof prisma;

function makeOps(db: Db): PaymentsOps {
  const ops: PaymentsOps = {
    async create(data) {
      const row = await db.payment.create({
        data: {
          courseId: data.courseId,
          userId: data.userId,
          method: data.method,
          amountCents: data.amountCents,
          trialDays: data.trialDays,
          status: data.status ?? 'pending',
          kind: data.kind ?? 'initial',
          subscriptionId: data.subscriptionId,
          invoiceNumber: data.invoiceNumber,
          gatewayChargeId: data.gatewayChargeId,
          periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
          periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
          confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : undefined,
        },
      });
      return toPayment(row);
    },
    async findById(id) {
      const row = await db.payment.findUnique({ where: { id } });
      return row ? toPayment(row) : undefined;
    },
    async transition(id, from, patch) {
      const { count } = await db.payment.updateMany({ where: { id, status: { in: from } }, data: paymentData(patch) });
      if (count === 0) return undefined;
      return ops.findById(id);
    },
    async findLatestForUser(courseId, userId) {
      const row = await db.payment.findFirst({ where: { courseId, userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return row ? toPayment(row) : undefined;
    },
    async listByUser(userId, page, limit) {
      const [rows, total] = await Promise.all([
        db.payment.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        db.payment.count({ where: { userId } }),
      ]);
      return { items: rows.map(toPayment), total };
    },
    async earliestConfirmedForSubscription(subscriptionId) {
      const r = await db.payment.aggregate({ where: { subscriptionId, confirmedAt: { not: null } }, _min: { confirmedAt: true } });
      return r._min.confirmedAt ?? undefined;
    },
    async nextInvoiceNumber(year) {
      const [row] = await db.$queryRaw<{ lastNumber: number }[]>`
        INSERT INTO "InvoiceSequence" ("year", "lastNumber") VALUES (${year}, 1)
        ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "InvoiceSequence"."lastNumber" + 1
        RETURNING "lastNumber"`;
      return `INV-${year}-${String(row!.lastNumber).padStart(6, '0')}`;
    },

    async findIdempotent(userId, key) {
      const row = await db.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
      return row?.paymentId;
    },
    async saveIdempotent(userId, key, paymentId) {
      await db.idempotencyKey.create({ data: { userId, key, paymentId } });
    },
    async claimWebhookEvent(eventId) {
      try {
        await db.webhookEvent.create({ data: { eventId } });
        return true;
      } catch (e) {
        if (isUniqueViolation(e)) return false;
        throw e;
      }
    },
    async releaseWebhookEvent(eventId) {
      await db.webhookEvent.deleteMany({ where: { eventId } });
    },

    async createSubscription(data) {
      const row = await db.subscription.create({
        data: {
          userId: data.userId,
          courseId: data.courseId,
          status: data.status,
          priceCents: data.priceCents,
          currentPeriodStart: new Date(data.currentPeriodStart),
          currentPeriodEnd: new Date(data.currentPeriodEnd),
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
          trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
          canceledAt: data.canceledAt ? new Date(data.canceledAt) : null,
        },
      });
      return toSubscription(row);
    },
    async findSubscription(id) {
      const row = await db.subscription.findUnique({ where: { id } });
      return row ? toSubscription(row) : undefined;
    },
    async findSubscriptionFor(userId, courseId) {
      const row = await db.subscription.findFirst({ where: { userId, courseId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return row ? toSubscription(row) : undefined;
    },
    async updateSubscription(id, patch) {
      const { count } = await db.subscription.updateMany({
        where: { id },
        data: {
          status: patch.status,
          priceCents: patch.priceCents,
          currentPeriodStart: dateOrUndef(patch.currentPeriodStart) ?? undefined,
          currentPeriodEnd: dateOrUndef(patch.currentPeriodEnd) ?? undefined,
          cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
          canceledAt: dateOrUndef(patch.canceledAt),
        },
      });
      return count === 0 ? undefined : ops.findSubscription(id);
    },
    async listSubscriptionsByUser(userId) {
      const rows = await db.subscription.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return rows.map(toSubscription);
    },
    async hasHadTrial(userId, courseId) {
      return (await db.subscription.count({ where: { userId, courseId, trialEndsAt: { not: null } } })) > 0;
    },
    async lockNextDueSubscription(now, excludeIds) {
      const [row] = await db.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Subscription"
        WHERE "status" IN ('active', 'trialing') AND "currentPeriodEnd" <= ${ts(now)}
          AND NOT ("id" = ANY(${excludeIds}::text[]))
        ORDER BY "currentPeriodEnd", "id"
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      return row ? ops.findSubscription(row.id) : undefined;
    },

    async createRefund(data) {
      const row = await db.refundRequest.create({
        data: {
          paymentId: data.paymentId,
          courseId: data.courseId,
          userId: data.userId,
          amountCents: data.amountCents,
          reason: data.reason,
          status: data.status,
          auto: data.auto,
          note: data.note,
          resolvedById: data.resolvedBy,
          resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined,
        },
      });
      return toRefund(row);
    },
    async findRefund(id) {
      const row = await db.refundRequest.findUnique({ where: { id } });
      return row ? toRefund(row) : undefined;
    },
    async findOpenRefundForPayment(paymentId) {
      const row = await db.refundRequest.findFirst({ where: { paymentId, status: { not: 'rejected' } }, orderBy: { createdAt: 'desc' } });
      return row ? toRefund(row) : undefined;
    },
    async transitionRefund(id, from, patch) {
      const { count } = await db.refundRequest.updateMany({
        where: { id, status: { in: from } },
        data: { status: patch.status, note: patch.note, amountCents: patch.amountCents, resolvedById: patch.resolvedBy, resolvedAt: patch.resolvedAt ? new Date(patch.resolvedAt) : undefined },
      });
      return count === 0 ? undefined : ops.findRefund(id);
    },
    async listRefunds(status, page, limit) {
      const where = status ? { status } : {};
      const [rows, total] = await Promise.all([
        db.refundRequest.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        db.refundRequest.count({ where }),
      ]);
      return { items: rows.map(toRefund), total };
    },

    async createPayout(data) {
      const row = await db.payout.create({
        data: {
          courseId: data.courseId,
          ownerId: data.ownerId,
          amountCents: data.amountCents,
          bankName: data.method.bankName,
          accountHolder: data.method.accountHolder,
          accountLast4: data.method.accountLast4,
          status: data.status,
          note: data.note,
        },
      });
      return toPayout(row);
    },
    async findPayout(id) {
      const row = await db.payout.findUnique({ where: { id } });
      return row ? toPayout(row) : undefined;
    },
    async transitionPayout(id, from, patch) {
      const { count } = await db.payout.updateMany({ where: { id, status: { in: from } }, data: { status: patch.status, note: patch.note } });
      return count === 0 ? undefined : ops.findPayout(id);
    },
    async listPayouts({ courseId, status }, page, limit) {
      const where = { ...(courseId ? { courseId } : {}), ...(status ? { status } : {}) };
      const [rows, total] = await Promise.all([
        db.payout.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        db.payout.count({ where }),
      ]);
      return { items: rows.map(toPayout), total };
    },

    async grantAccess(userId, courseId) {
      if (await ops.isBanned(userId, courseId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      await db.enrollment.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId, role: 'member' }, update: {} });
    },
    async revokeAccess(userId, courseId) {
      await db.enrollment.deleteMany({ where: { userId, courseId, role: { not: 'owner' } } });
    },
    async isBanned(userId, courseId) {
      return (await db.communityBan.count({ where: { userId, courseId } })) > 0;
    },

    async advisoryLock(key) {
      await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS locked`;
    },
    async lockCourse(courseId) {
      await db.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${courseId} FOR UPDATE`;
    },

    async revenueTotals(courseId, range, rates) {
      const at = Prisma.sql`COALESCE("confirmedAt", "createdAt")`;
      const from = range.from ? Prisma.sql`AND ${at} >= ${ts(range.from)}` : Prisma.empty;
      const to = range.to ? Prisma.sql`AND ${at} <= ${ts(range.to)}` : Prisma.empty;
      const [r] = await db.$queryRaw<{ gross: bigint; refunds: bigint; commission: bigint; fee: bigint }[]>`
        SELECT COALESCE(SUM("amountCents"), 0)::bigint AS gross,
               COALESCE(SUM("refundedCents"), 0)::bigint AS refunds,
               COALESCE(SUM((("amountCents" - "refundedCents")::bigint * ${rates.commissionBp} + 5000) / 10000), 0)::bigint AS commission,
               COALESCE(SUM((("amountCents"::bigint * ${rates.gatewayFeeBp} + 5000) / 10000) + ${rates.gatewayFeeFixedCents}), 0)::bigint AS fee
        FROM "Payment"
        WHERE "courseId" = ${courseId} AND "status" IN ('succeeded', 'refunded') ${from} ${to}`;
      const gross = num(r?.gross);
      const refunds = num(r?.refunds);
      const commission = num(r?.commission);
      const fee = num(r?.fee);
      return { grossCents: gross, refundsCents: refunds, platformCommissionCents: commission, gatewayFeeCents: fee, netCents: gross - refunds - commission - fee };
    },
    async balance(courseId, rates) {
      const [r] = await db.$queryRaw<{ net: bigint; requested: bigint }[]>`
        SELECT
          (SELECT COALESCE(SUM("amountCents" - "refundedCents"
                 - ((("amountCents" - "refundedCents")::bigint * ${rates.commissionBp} + 5000) / 10000)
                 - ((("amountCents"::bigint * ${rates.gatewayFeeBp} + 5000) / 10000) + ${rates.gatewayFeeFixedCents})), 0)::bigint
             FROM "Payment" WHERE "courseId" = ${courseId} AND "status" IN ('succeeded', 'refunded')) AS net,
          (SELECT COALESCE(SUM("amountCents"), 0)::bigint FROM "Payout" WHERE "courseId" = ${courseId} AND "status" <> 'rejected') AS requested`;
      return { net: num(r?.net), requested: num(r?.requested) };
    },
    async subscriptionStats(courseId) {
      const [r] = await db.$queryRaw<{ active: bigint; trialing: bigint; mrr: bigint }[]>`
        SELECT COUNT(*) FILTER (WHERE "status" = 'active')::bigint AS active,
               COUNT(*) FILTER (WHERE "status" = 'trialing')::bigint AS trialing,
               COALESCE(SUM("priceCents") FILTER (WHERE "status" = 'active' AND NOT "cancelAtPeriodEnd"), 0)::bigint AS mrr
        FROM "Subscription" WHERE "courseId" = ${courseId}`;
      return { active: num(r?.active), trialing: num(r?.trialing), mrrCents: num(r?.mrr) };
    },
    async recentPaid(courseId, limit) {
      const rows = await db.payment.findMany({
        where: { courseId, status: { in: ['succeeded', 'refunded'] } },
        orderBy: [{ confirmedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: limit,
      });
      return rows.map(toPayment);
    },
  };
  return ops;
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

export function createPrismaPaymentsRepository(client: typeof prisma = prisma): PaymentsRepository {
  return {
    ...makeOps(client),
    transaction: (fn, opts) => client.$transaction((tx) => fn(makeOps(tx)), { timeout: opts?.timeoutMs ?? 15_000, maxWait: 10_000 }),
  };
}

export const paymentsRepository: PaymentsRepository = createPrismaPaymentsRepository();
