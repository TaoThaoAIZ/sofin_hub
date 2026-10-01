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
export type RefundPatch = Partial<Pick<RefundRequest, 'status' | 'note' | 'resolvedBy' | 'resolvedAt' | 'amountCents'>> & {
  gatewayRefundId?: string;
  /** Thời điểm vào trạng thái `refunding` (ISO). */
  refundingAt?: string | null;
};
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

/** Số liệu nền để tính số dư có thể rút (tính trong SQL). */
export interface BalanceFigures {
  /** Net toàn thời gian (mọi giao dịch succeeded|refunded). */
  net: number;
  /** Tổng payout chưa bị từ chối. */
  requested: number;
  /** Phần net đã qua holding period (+ mọi khoản net âm như phí cổng của giao dịch đã hoàn) — chỉ phần này mới được rút. */
  eligible: number;
}
export interface BalancePolicy {
  /** Giao dịch xác nhận trước mốc này mới đủ điều kiện rút. */
  eligibleBefore: Date;
}

export type WebhookClaim = { claimed: true; attempts: number } | { claimed: false; status: 'done' | 'processing' | 'received' | 'failed' };

export interface StoredWebhook {
  eventId: string;
  type: string | null;
  payload: unknown;
  status: 'received' | 'processing' | 'done' | 'failed';
  attempts: number;
}

export interface LedgerEntryInput {
  communityId: string;
  ownerId?: string | null;
  kind: 'refund_after_payout' | 'chargeback_after_payout' | 'adjustment';
  amountCents: number;
  paymentId?: string;
  refundId?: string;
  note?: string;
}

export interface CourseState {
  exists: boolean;
  deleted: boolean;
  locked: boolean;
  visibility: 'public' | 'private';
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
  findLatestForUser(communityId: string, userId: string): Promise<PaymentIntent | undefined>;
  listByUser(userId: string, page: number, limit: number): Promise<Page<PaymentIntent>>;
  /** Mốc thanh toán đầu tiên (confirmedAt nhỏ nhất) của một gói — mốc cửa sổ hoàn tiền. */
  earliestConfirmedForSubscription(subscriptionId: string): Promise<Date | undefined>;
  /** Cấp số hóa đơn kế tiếp `INV-<năm>-<6 số>` (InvoiceSequence increment atomic; giữ khóa hàng tới hết transaction). */
  nextInvoiceNumber(year: number): Promise<string>;

  // --- idempotency / webhook
  findIdempotent(userId: string, key: string): Promise<string | undefined>;
  /** Ghi (userId,key)→paymentId. Key đã tồn tại ⇒ ném lỗi P2002 (kiểm bằng `isUniqueViolation`); trong transaction lỗi này rollback cả transaction — bắt ở NGOÀI `transaction()`. */
  saveIdempotent(userId: string, key: string, paymentId: string): Promise<void>;
  /**
   * Nhận xử lý 1 webhook (atomic). Chưa có → INSERT status=processing. Đã có → chỉ nhận lại nếu `failed`/`received` hoặc `processing` quá `staleBefore`;
   * `done` hoặc đang `processing` còn mới → claimed=false (trùng).
   */
  claimWebhookEvent(event: { id: string; type?: string; payload?: unknown }, staleBefore: Date): Promise<WebhookClaim>;
  /** Chốt xử lý xong (done) hoặc lỗi (failed + lastError) — giữ lại để điều tra/replay, KHÔNG xóa. */
  finishWebhookEvent(eventId: string, outcome: { ok: true } | { ok: false; error: string }): Promise<void>;
  /** Webhook cần xử lý lại: failed, hoặc processing/received quá `staleBefore` và còn payload, attempts < maxAttempts. */
  listReclaimableWebhooks(staleBefore: Date, maxAttempts: number, limit: number): Promise<StoredWebhook[]>;

  // --- subscriptions
  createSubscription(data: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription>;
  findSubscription(id: string): Promise<Subscription | undefined>;
  /** Gói mới nhất của user ở cộng đồng (mọi trạng thái). */
  findSubscriptionFor(userId: string, communityId: string): Promise<Subscription | undefined>;
  updateSubscription(id: string, patch: SubscriptionPatch): Promise<Subscription | undefined>;
  listSubscriptionsByUser(userId: string): Promise<Subscription[]>;
  hasHadTrial(userId: string, communityId: string): Promise<boolean>;
  /**
   * Khóa (FOR UPDATE SKIP LOCKED) và trả về MỘT gói đến hạn (active|trialing, currentPeriodEnd <= now) chưa nằm trong `excludeIds`.
   * Phải gọi trong transaction; instance khác đang xử lý gói nào thì gói đó bị bỏ qua. Gói của cộng đồng đang bị khóa/đình chỉ bị BỎ QUA
   * (không gia hạn); cộng đồng đã xóa vẫn được trả về để service kết thúc gói.
   */
  lockNextDueSubscription(now: Date, excludeIds: string[]): Promise<Subscription | undefined>;
  /** Gói đang sống (trialing|active) của (user, community), khóa FOR UPDATE — luôn gọi TRƯỚC khi ghi bất kỳ thứ gì khác (thứ tự khóa: Subscription → ... → số hóa đơn). */
  lockLiveSubscription(userId: string, communityId: string): Promise<Subscription | undefined>;
  listLiveSubscriptionsForCourse(communityId: string): Promise<Subscription[]>;
  /** Intent `initial` đang pending, tạo từ `since` trở lại đây (mới nhất) — checkout tái dùng thay vì tạo thêm. */
  findReusablePending(userId: string, communityId: string, since: Date): Promise<PaymentIntent | undefined>;
  /** Giao dịch pending đã có gatewayChargeId (cổng đã trừ tiền nhưng chưa settle) quá `olderThan`. */
  listUnsettledCharges(olderThan: Date, limit: number): Promise<PaymentIntent[]>;
  /** Khoản trừ trùng đã bị void nhưng chưa hoàn tiền xong (failed + failureReason duplicate_charge + refundedCents=0). */
  listUnrefundedVoids(olderThan: Date, limit: number): Promise<PaymentIntent[]>;

  // --- refunds
  createRefund(data: Omit<RefundRequest, 'id' | 'createdAt'>): Promise<RefundRequest>;
  findRefund(id: string): Promise<RefundRequest | undefined>;
  findOpenRefundForPayment(paymentId: string): Promise<RefundRequest | undefined>;
  /** Chuyển trạng thái có điều kiện (pending→approved/rejected) — chỉ một bên thắng khi xử lý đồng thời. */
  transitionRefund(id: string, from: RefundRequest['status'][], patch: RefundPatch): Promise<RefundRequest | undefined>;
  listRefunds(status: RefundRequest['status'] | undefined, page: number, limit: number): Promise<Page<RefundRequest>>;
  deleteRefund(id: string): Promise<void>;
  /** Yêu cầu kẹt ở `refunding` từ trước `olderThan` (job đối soát). */
  listStuckRefunds(olderThan: Date, limit: number): Promise<RefundRequest[]>;

  // --- payouts
  createPayout(data: Omit<Payout, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payout>;
  findPayout(id: string): Promise<Payout | undefined>;
  transitionPayout(id: string, from: Payout['status'][], patch: PayoutPatch): Promise<Payout | undefined>;
  listPayouts(filter: { communityId?: string; status?: Payout['status'] }, page: number, limit: number): Promise<Page<Payout>>;

  // --- quyền truy cập (cùng transaction với thanh toán/hoàn tiền)
  /** Ghi danh (giữ vai trò cũ nếu đã có). 403 nếu đang bị cấm. */
  grantAccess(userId: string, communityId: string): Promise<void>;
  /** Thu hồi quyền truy cập, trừ Owner (Owner không bao giờ mất cộng đồng của mình vì hết gói). */
  revokeAccess(userId: string, communityId: string): Promise<void>;
  isBanned(userId: string, communityId: string): Promise<boolean>;
  isEnrolled(userId: string, communityId: string): Promise<boolean>;
  /** Trạng thái hiện tại của cộng đồng (xóa/khóa/riêng tư). */
  courseState(communityId: string): Promise<CourseState>;
  /** Người dùng đã có yêu cầu tham gia được duyệt (hoặc lời mời đã chấp nhận) cho cộng đồng này chưa. */
  hasApprovedJoinRequest(userId: string, communityId: string): Promise<boolean>;

  // --- khóa
  /** `pg_advisory_xact_lock(hashtext(key))` — tuần tự hóa theo khóa logic đến hết transaction (chỉ có tác dụng trong transaction). */
  advisoryLock(key: string): Promise<void>;
  /** `SELECT ... FOR UPDATE` dòng Course — tuần tự hóa các payout của cùng cộng đồng. */
  lockCourse(communityId: string): Promise<void>;

  // --- aggregate SQL (không load bản ghi vào bộ nhớ)
  revenueTotals(communityId: string, range: { from?: Date; to?: Date }, rates: RevenueRates): Promise<RevenueTotals>;
  /**
   * net toàn thời gian (mọi giao dịch succeeded|refunded), tổng payout chưa bị từ chối, và phần net đã đủ điều kiện rút
   * (qua `policy.eligibleBefore`, cộng mọi khoản net âm). Không truyền policy ⇒ eligible = net (hành vi cũ).
   */
  balance(communityId: string, rates: RevenueRates, policy?: BalancePolicy): Promise<BalanceFigures>;
  addLedgerEntry(entry: LedgerEntryInput): Promise<void>;
  /** Tổng nợ đã ghi sổ (giá trị dương) của cộng đồng — để hiển thị/đối soát. */
  ledgerDebtCents(communityId: string): Promise<number>;
  subscriptionStats(communityId: string): Promise<{ active: number; trialing: number; mrrCents: number }>;
  recentPaid(communityId: string, limit: number): Promise<PaymentIntent[]>;
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
    communityId: r.communityId,
  courseId: r.communityId,
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
    communityId: r.communityId,
  courseId: r.communityId,
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
    communityId: r.communityId,
  courseId: r.communityId,
    userId: r.userId,
    amountCents: r.amountCents,
    reason: r.reason,
    status: r.status,
    auto: r.auto,
    note: r.note ?? undefined,
    resolvedBy: r.resolvedById ?? undefined,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: iso(r.resolvedAt),
    gatewayRefundId: r.gatewayRefundId ?? undefined,
    refundingAt: iso(r.refundingAt),
  };
}

function toPayout(r: PayoutRow): Payout {
  return {
    id: r.id,
    communityId: r.communityId,
  courseId: r.communityId,
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
          communityId: data.communityId,
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
    async findLatestForUser(communityId, userId) {
      const row = await db.payment.findFirst({ where: { communityId, userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
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
    async claimWebhookEvent(event, staleBefore) {
      const now = new Date();
      try {
        await db.webhookEvent.create({
          data: { eventId: event.id, type: event.type ?? null, payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined, status: 'processing', attempts: 1, processingAt: now },
        });
        return { claimed: true, attempts: 1 };
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
      // Đã có: chỉ nhận lại khi chưa xong và không có ai đang xử lý (failed / received / processing đã quá hạn). Atomic bằng updateMany có điều kiện.
      const { count } = await db.webhookEvent.updateMany({
        where: {
          eventId: event.id,
          OR: [{ status: { in: ['failed', 'received'] } }, { status: 'processing', OR: [{ processingAt: null }, { processingAt: { lt: staleBefore } }] }],
        },
        data: { status: 'processing', attempts: { increment: 1 }, processingAt: now, updatedAt: now },
      });
      const row = await db.webhookEvent.findUnique({ where: { eventId: event.id } });
      if (count === 1 && row) return { claimed: true, attempts: row.attempts };
      return { claimed: false, status: row?.status ?? 'done' };
    },
    async finishWebhookEvent(eventId, outcome) {
      const now = new Date();
      await db.webhookEvent.updateMany({
        where: { eventId },
        data: outcome.ok ? { status: 'done', processedAt: now, lastError: null, updatedAt: now } : { status: 'failed', lastError: outcome.error.slice(0, 500), updatedAt: now },
      });
    },
    async listReclaimableWebhooks(staleBefore, maxAttempts, limit) {
      const rows = await db.webhookEvent.findMany({
        where: {
          attempts: { lt: maxAttempts },
          payload: { not: Prisma.DbNull },
          OR: [{ status: 'failed' }, { status: { in: ['processing', 'received'] }, updatedAt: { lt: staleBefore } }],
        },
        orderBy: { receivedAt: 'asc' },
        take: limit,
      });
      return rows.map((r) => ({ eventId: r.eventId, type: r.type, payload: r.payload, status: r.status, attempts: r.attempts }));
    },

    async createSubscription(data) {
      const row = await db.subscription.create({
        data: {
          userId: data.userId,
          communityId: data.communityId,
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
    async findSubscriptionFor(userId, communityId) {
      const row = await db.subscription.findFirst({ where: { userId, communityId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
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
    async hasHadTrial(userId, communityId) {
      return (await db.subscription.count({ where: { userId, communityId, trialEndsAt: { not: null } } })) > 0;
    },
    async lockNextDueSubscription(now, excludeIds) {
      // JOIN Course: cộng đồng đang khóa/đình chỉ (chưa xóa) bị bỏ qua — không gia hạn. Cộng đồng đã xóa vẫn được chọn để service hủy gói.
      const [row] = await db.$queryRaw<{ id: string }[]>`
        SELECT s."id" FROM "Subscription" s
        JOIN "Course" c ON c."id" = s."courseId"
        WHERE s."status" IN ('active', 'trialing') AND s."currentPeriodEnd" <= ${ts(now)}
          AND NOT (s."id" = ANY(${excludeIds}::text[]))
          AND NOT (c."deletedAt" IS NULL AND (c."locked" OR c."moderationStatus" = 'suspended'))
        ORDER BY s."currentPeriodEnd", s."id"
        LIMIT 1
        FOR UPDATE OF s SKIP LOCKED`;
      return row ? ops.findSubscription(row.id) : undefined;
    },
    async lockLiveSubscription(userId, communityId) {
      const [row] = await db.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Subscription" WHERE "userId" = ${userId} AND "courseId" = ${communityId} AND "status" IN ('trialing', 'active')
        ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`;
      return row ? ops.findSubscription(row.id) : undefined;
    },
    async listLiveSubscriptionsForCourse(communityId) {
      const rows = await db.subscription.findMany({ where: { communityId, status: { in: ['trialing', 'active'] } }, orderBy: { createdAt: 'asc' } });
      return rows.map(toSubscription);
    },
    async findReusablePending(userId, communityId, since) {
      const row = await db.payment.findFirst({
        where: { userId, communityId, status: 'pending', kind: 'initial', createdAt: { gte: since } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return row ? toPayment(row) : undefined;
    },
    async listUnsettledCharges(olderThan, limit) {
      const rows = await db.payment.findMany({ where: { status: 'pending', gatewayChargeId: { not: null }, updatedAt: { lt: olderThan } }, orderBy: { createdAt: 'asc' }, take: limit });
      return rows.map(toPayment);
    },
    async listUnrefundedVoids(olderThan, limit) {
      const rows = await db.payment.findMany({
        where: { status: 'failed', failureReason: 'duplicate_charge', refundedCents: 0, gatewayChargeId: { not: null }, updatedAt: { lt: olderThan } },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return rows.map(toPayment);
    },

    async createRefund(data) {
      const row = await db.refundRequest.create({
        data: {
          paymentId: data.paymentId,
          communityId: data.communityId,
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
        data: {
          status: patch.status,
          note: patch.note,
          amountCents: patch.amountCents,
          resolvedById: patch.resolvedBy,
          resolvedAt: patch.resolvedAt ? new Date(patch.resolvedAt) : undefined,
          gatewayRefundId: patch.gatewayRefundId,
          refundingAt: patch.refundingAt === undefined ? undefined : patch.refundingAt === null ? null : new Date(patch.refundingAt),
        },
      });
      return count === 0 ? undefined : ops.findRefund(id);
    },
    async deleteRefund(id) {
      await db.refundRequest.deleteMany({ where: { id } });
    },
    async listStuckRefunds(olderThan, limit) {
      const rows = await db.refundRequest.findMany({ where: { status: 'refunding', refundingAt: { lt: olderThan } }, orderBy: { refundingAt: 'asc' }, take: limit });
      return rows.map(toRefund);
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
          communityId: data.communityId,
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
    async listPayouts({ communityId, status }, page, limit) {
      const where = { ...(communityId ? { communityId } : {}), ...(status ? { status } : {}) };
      const [rows, total] = await Promise.all([
        db.payout.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        db.payout.count({ where }),
      ]);
      return { items: rows.map(toPayout), total };
    },

    async grantAccess(userId, communityId) {
      if (await ops.isBanned(userId, communityId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      await db.enrollment.upsert({ where: { userId_communityId: { userId, communityId } }, create: { userId, communityId, role: 'member' }, update: {} });
    },
    async revokeAccess(userId, communityId) {
      await db.enrollment.deleteMany({ where: { userId, communityId, role: { not: 'owner' } } });
    },
    async isBanned(userId, communityId) {
      return (await db.communityBan.count({ where: { userId, communityId } })) > 0;
    },
    async isEnrolled(userId, communityId) {
      const [row] = await db.$queryRaw<{ ok: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM "Enrollment" e WHERE e."userId" = ${userId} AND e."courseId" = ${communityId}
            AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
        ) AS ok`;
      return row?.ok === true;
    },
    async courseState(communityId) {
      const c = await db.community.findUnique({ where: { id: communityId }, select: { deletedAt: true, locked: true, moderationStatus: true, visibility: true } });
      if (!c) return { exists: false, deleted: true, locked: false, visibility: 'public' };
      return { exists: true, deleted: !!c.deletedAt, locked: c.locked || c.moderationStatus === 'suspended', visibility: c.visibility };
    },
    async hasApprovedJoinRequest(userId, communityId) {
      return (await db.joinRequest.count({ where: { userId, communityId, status: 'approved' } })) > 0;
    },

    async advisoryLock(key) {
      await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS locked`;
    },
    async lockCourse(communityId) {
      await db.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${communityId} FOR UPDATE`;
    },

    async revenueTotals(communityId, range, rates) {
      const at = Prisma.sql`COALESCE("confirmedAt", "createdAt")`;
      const from = range.from ? Prisma.sql`AND ${at} >= ${ts(range.from)}` : Prisma.empty;
      const to = range.to ? Prisma.sql`AND ${at} <= ${ts(range.to)}` : Prisma.empty;
      const [r] = await db.$queryRaw<{ gross: bigint; refunds: bigint; commission: bigint; fee: bigint }[]>`
        SELECT COALESCE(SUM("amountCents"), 0)::bigint AS gross,
               COALESCE(SUM("refundedCents"), 0)::bigint AS refunds,
               COALESCE(SUM((("amountCents" - "refundedCents")::bigint * ${rates.commissionBp} + 5000) / 10000), 0)::bigint AS commission,
               COALESCE(SUM((("amountCents"::bigint * ${rates.gatewayFeeBp} + 5000) / 10000) + ${rates.gatewayFeeFixedCents}), 0)::bigint AS fee
        FROM "Payment"
        WHERE "courseId" = ${communityId} AND "status" IN ('succeeded', 'refunded') ${from} ${to}`;
      const gross = num(r?.gross);
      const refunds = num(r?.refunds);
      const commission = num(r?.commission);
      const fee = num(r?.fee);
      return { grossCents: gross, refundsCents: refunds, platformCommissionCents: commission, gatewayFeeCents: fee, netCents: gross - refunds - commission - fee };
    },
    async balance(communityId, rates, policy) {
      // `n` = net của từng giao dịch (đã trừ hoàn tiền, hoa hồng trên phần giữ lại, phí cổng). Giao dịch đủ điều kiện rút khi đã qua
      // holding period HOẶC n < 0 (phí cổng của giao dịch đã hoàn là khoản lỗ phải trừ ngay, không đợi).
      const before = policy ? ts(policy.eligibleBefore) : Prisma.sql`'infinity'::timestamp`;
      const [r] = await db.$queryRaw<{ net: bigint; eligible: bigint; requested: bigint }[]>`
        SELECT COALESCE(SUM(t."n"), 0)::bigint AS net,
               COALESCE(SUM(t."n") FILTER (WHERE t."n" < 0 OR t."at" <= ${before}), 0)::bigint AS eligible,
               (SELECT COALESCE(SUM("amountCents"), 0)::bigint FROM "Payout" WHERE "courseId" = ${communityId} AND "status" <> 'rejected') AS requested
        FROM (
          SELECT COALESCE("confirmedAt", "createdAt") AS "at",
                 ("amountCents" - "refundedCents"
                   - ((("amountCents" - "refundedCents")::bigint * ${rates.commissionBp} + 5000) / 10000)
                   - ((("amountCents"::bigint * ${rates.gatewayFeeBp} + 5000) / 10000) + ${rates.gatewayFeeFixedCents}))::bigint AS "n"
          FROM "Payment" WHERE "courseId" = ${communityId} AND "status" IN ('succeeded', 'refunded')
        ) t`;
      const net = num(r?.net);
      return { net, requested: num(r?.requested), eligible: policy ? num(r?.eligible) : net };
    },
    async addLedgerEntry(e) {
      await db.ownerBalanceLedger.create({
        data: { communityId: e.communityId, ownerId: e.ownerId ?? null, kind: e.kind, amountCents: e.amountCents, paymentId: e.paymentId, refundId: e.refundId, note: e.note },
      });
    },
    async ledgerDebtCents(communityId) {
      const agg = await db.ownerBalanceLedger.aggregate({ where: { communityId }, _sum: { amountCents: true } });
      return Math.max(0, -(agg._sum.amountCents ?? 0));
    },
    async subscriptionStats(communityId) {
      const [r] = await db.$queryRaw<{ active: bigint; trialing: bigint; mrr: bigint }[]>`
        SELECT COUNT(*) FILTER (WHERE "status" = 'active')::bigint AS active,
               COUNT(*) FILTER (WHERE "status" = 'trialing')::bigint AS trialing,
               COALESCE(SUM("priceCents") FILTER (WHERE "status" = 'active' AND NOT "cancelAtPeriodEnd"), 0)::bigint AS mrr
        FROM "Subscription" WHERE "courseId" = ${communityId}`;
      return { active: num(r?.active), trialing: num(r?.trialing), mrrCents: num(r?.mrr) };
    },
    async recentPaid(communityId, limit) {
      const rows = await db.payment.findMany({
        where: { communityId, status: { in: ['succeeded', 'refunded'] } },
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
