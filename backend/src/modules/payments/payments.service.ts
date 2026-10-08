import { HttpError } from '../../utils/http-error.js';
import { assertUserCan } from '../auth/user-status.js';
import { fileUserRepository } from '../auth/auth.repository.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { mailService } from '../mail/mail.service.js';
import { notify } from '../notifications/notifications.service.js';
import { annualSavingsPct, type Community } from '../catalog/community.types.js';
import { getRole, atLeast, isCommunityOwner, requireRole, requireStaff } from '../permissions/policy.js';
import { paymentGateway, type PaymentGateway } from './payments.gateway.js';
import {
  isUniqueViolation,
  paymentsRepository,
  type BalanceFigures,
  type LedgerEntryInput,
  type PaymentsOps,
  type PaymentsRepository,
  type RevenueRates,
  type StoredCard,
} from './payments.repository.js';
import { cfg } from '../settings/settings.service.js';
import { referralsService } from '../referrals/referrals.service.js';
import { refundStatuses } from './payments.cards.js';
import { webhookEventBody, type PaymentMethodInput } from './payments.schema.js';
import type { BillingInterval, PaymentCardView, PaymentIntent, PaymentMethod, Payout, RefundRequest, Subscription } from './payments.types.js';

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const toCents = (usd: number) => Math.round(usd * 100);
/** Phần trăm (có thể lẻ, vd. 2.9) → basis point nguyên để tính bằng số nguyên (cả trong SQL). */
const bp = (pct: number) => Math.round(pct * 100);

/** Intent `pending` được checkout tái dùng trong khoảng này (quá hạn thì tạo intent mới). */
export const PENDING_INTENT_TTL_MS = 30 * MIN_MS;
/** Webhook ở `processing` quá lâu coi như process đã chết → được nhận lại. */
export const WEBHOOK_PROCESSING_STALE_MS = 2 * MIN_MS;
const WEBHOOK_MAX_ATTEMPTS = 8;
/** Mặc định: yêu cầu hoàn tiền kẹt `refunding` / charge chưa settle quá lâu mới đối soát (tránh giẫm chân request đang chạy). */
const RECONCILE_AFTER_MS = 5 * MIN_MS;

/** Độ dài kỳ (ngày) theo chu kỳ: monthly = subscriptionPeriodDays, annual = annualPeriodDays (Global Settings). */
export const periodDaysFor = (interval: BillingInterval) => (interval === 'annual' ? cfg().payments.annualPeriodDays : cfg().payments.subscriptionPeriodDays);

/** Giá (cent) của 1 chu kỳ do SERVER quyết định; cộng đồng không bán gói năm thì 400. */
export function intervalPriceCents(course: Pick<Community, 'priceUsd' | 'priceAnnualUsd'>, interval: BillingInterval): number {
  if (interval === 'annual') {
    if (course.priceAnnualUsd == null) throw HttpError.coded(400, 'INTERVAL_UNAVAILABLE', 'Cộng đồng này không bán gói năm');
    return toCents(course.priceAnnualUsd);
  }
  return toCents(course.priceUsd);
}

export const cardView = (c: StoredCard | undefined | null): PaymentCardView | null =>
  c ? { id: c.id, brand: c.brand, last4: c.last4, expMonth: c.expMonth, expYear: c.expYear, createdAt: c.createdAt } : null;

const revenueRates = (): RevenueRates => ({
  commissionBp: bp(cfg().payments.commissionPct),
  gatewayFeeBp: bp(cfg().payments.gatewayFeePct),
  gatewayFeeFixedCents: cfg().payments.gatewayFeeFixedCents,
});

/** Chính sách rút tiền hiện hành (đọc từ Global Settings; giá trị tạm chờ chủ sở hữu chốt). */
export function payoutPolicy(now = new Date()) {
  const p = cfg().payments;
  const holdDays = p.refundWindowDays + p.disputeWindowDays;
  return {
    refundWindowDays: p.refundWindowDays,
    disputeWindowDays: p.disputeWindowDays,
    holdDays,
    reservePct: p.payoutReservePct,
    eligibleBefore: new Date(now.getTime() - holdDays * DAY_MS),
  };
}

/**
 * Số dư của Owner từ số liệu SQL:
 *  - total: net toàn thời gian − payout đã yêu cầu (có thể ÂM = còn nợ);
 *  - held: phần net chưa qua holding period (refundWindowDays + disputeWindowDays) — chưa được rút;
 *  - reserve: rolling reserve = reservePct% phần đã đủ điều kiện, luôn giữ lại;
 *  - withdrawable: số có thể rút ngay = max(0, min(eligible − reserve − requested, total)); 0 khi còn nợ;
 *  - debt: nợ (total < 0) — chặn payout cho tới khi doanh thu mới bù.
 */
export function balanceView(b: BalanceFigures, reservePct: number) {
  const total = b.net - b.requested;
  const reserve = Math.floor((Math.max(0, b.eligible) * bp(reservePct)) / 10_000);
  return {
    total,
    held: Math.max(0, b.net - b.eligible),
    reserve,
    withdrawable: Math.max(0, Math.min(b.eligible - reserve - b.requested, total)),
    debt: Math.max(0, -total),
  };
}

function pageMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

type NotifyInput = Parameters<typeof notify>[0];
/** Thông báo chỉ phát SAU khi transaction commit (rollback thì không có thông báo "ma"). */
type After = Array<() => void | Promise<void>>;
const later = (after: After, input: NotifyInput) =>
  after.push(() => {
    try {
      void Promise.resolve(notify(input)).catch(() => undefined);
    } catch {
      /* thông báo lỗi không được làm hỏng luồng tiền */
    }
  });

const locked = () => HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');

export function createPaymentsService(repo: PaymentsRepository = paymentsRepository, gateway: PaymentGateway = paymentGateway) {
  /** Chạy trong 1 transaction DB; thông báo gom lại và phát sau commit. */
  async function inTx<T>(fn: (ops: PaymentsOps, after: After) => Promise<T>, timeoutMs?: number): Promise<T> {
    const after: After = [];
    const result = await repo.transaction((ops) => fn(ops, after), { timeoutMs });
    // Callback sau commit có thể bất đồng bộ (hook giới thiệu tự cô lập lỗi) — chờ để thứ tự/kết quả xác định.
    for (const f of after) await f();
    return result;
  }

  async function courseTitle(communityId: string) {
    try {
      return (await catalogService.getById(communityId)).title;
    } catch {
      return communityId;
    }
  }

  function subscriptionView(sub: Subscription, title?: string) {
    return { ...sub, courseTitle: title, accessUntil: sub.status === 'active' || sub.status === 'trialing' ? sub.currentPeriodEnd : null };
  }

  // Cùng instance: 2 confirm song song dùng chung 1 promise (cổng chỉ bị gọi 1 lần). Khác instance: idempotencyKey gửi cổng +
  // transition có điều kiện trong DB đảm bảo chỉ 1 bên ghi nhận (hóa đơn, gói, quyền truy cập).
  const inflightConfirm = new Map<string, Promise<PaymentIntent>>();

  /** Cộng đồng riêng tư: chỉ người đã được duyệt (join request approved / lời mời đã chấp nhận) hoặc đang là thành viên mới được mua/dùng thử. */
  async function assertMayPurchase(userId: string, communityId: string, visibility: 'public' | 'private', autoApprovePaid = false) {
    if (visibility !== 'private') return;
    if (autoApprovePaid) return; // chủ bật "Tự duyệt người trả phí": thanh toán/dùng thử thay cho bước duyệt
    if (await enrollmentService.isEnrolled(userId, communityId)) return; // dùng thử → trả phí
    if (await repo.hasApprovedJoinRequest(userId, communityId)) return;
    throw HttpError.coded(403, 'JOIN_REQUEST_REQUIRED', 'Cộng đồng riêng tư: hãy gửi yêu cầu tham gia (được duyệt) hoặc dùng lời mời trước khi thanh toán');
  }

  /**
   * Đánh dấu thanh toán thành công + số hóa đơn + tạo/gia hạn gói + cấp quyền — MỘT transaction.
   *
   * THỨ TỰ KHÓA (thống nhất với scheduler để không deadlock): advisory(user,course) → hàng Subscription → hàng Payment →
   * (tạo/sửa Subscription, Enrollment) → số hóa đơn (InvoiceSequence) CUỐI CÙNG. Scheduler: Subscription → Payment mới → số hóa đơn.
   *
   * Nguyên tử theo trạng thái 'pending': bên thua cuộc (double-confirm / webhook trùng) nhận lại bản ghi đã xử lý.
   * Nếu user ĐÃ có gói active (hoặc đã là thành viên mà không phải đang dùng thử) thì khoản vừa trừ là TRÙNG: giao dịch bị đánh dấu
   * `failed`/`duplicate_charge` và trả `voided=true` để caller hoàn tiền qua cổng (ngoài transaction).
   */
  async function settle(intent: PaymentIntent, chargeId: string): Promise<{ payment: PaymentIntent; voided: boolean }> {
    return inTx(async (ops, after) => {
      const at = new Date();
      if (intent.moduleId) return settleModule(ops, after, intent, chargeId);
      await ops.advisoryLock(`sub:${intent.userId}:${intent.communityId}`);
      let sub = await ops.lockLiveSubscription(intent.userId, intent.communityId); // (1) Subscription trước
      const current = await ops.findById(intent.id);
      if (!current || current.status !== 'pending') return { payment: current ?? intent, voided: false }; // đã xử lý trước đó

      const enrolled = await ops.isEnrolled(intent.userId, intent.communityId);
      if ((sub && sub.status === 'active') || (enrolled && sub?.status !== 'trialing')) {
        const voided = await ops.transition(intent.id, ['pending'], { status: 'failed', gatewayChargeId: chargeId, failureReason: 'duplicate_charge' });
        return { payment: voided ?? current, voided: true };
      }

      const done = await ops.transition(intent.id, ['pending'], { status: 'succeeded', confirmedAt: at.toISOString(), gatewayChargeId: chargeId });
      if (!done) return { payment: (await ops.findById(intent.id))!, voided: false };

      const periodEnd = addDays(at, periodDaysFor(intent.interval));
      if (sub) {
        // Chuyển từ dùng thử sang trả phí: bắt đầu kỳ mới từ bây giờ.
        sub = await ops.updateSubscription(sub.id, {
          status: 'active',
          priceCents: intent.amountCents,
          interval: intent.interval,
          paymentCardId: intent.paymentCardId ?? sub.paymentCardId ?? null,
          currentPeriodStart: at.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          cancelAtPeriodEnd: false,
        });
      } else {
        sub = await ops.createSubscription({
          userId: intent.userId,
          communityId: intent.communityId,
          status: 'active',
          priceCents: intent.amountCents,
          interval: intent.interval,
          paymentCardId: intent.paymentCardId,
          currentPeriodStart: at.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          cancelAtPeriodEnd: false,
        });
      }
      // Bị cấm sau khi tạo giao dịch: vẫn ghi nhận thanh toán (có thể hoàn tiền) nhưng không cấp quyền.
      if (!(await ops.isBanned(intent.userId, intent.communityId))) await ops.grantAccess(intent.userId, intent.communityId);
      // Số hóa đơn LUÔN cấp cuối cùng (giữ khóa InvoiceSequence ngắn nhất, cùng thứ tự với recordRenewal).
      const invoiceNumber = await ops.nextInvoiceNumber(at.getUTCFullYear());
      const final = await ops.transition(intent.id, ['succeeded'], {
        invoiceNumber,
        subscriptionId: sub!.id,
        periodStart: at.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      after.push(() => referralsService.onPaymentSucceeded(final!)); // hoa hồng giới thiệu (cô lập lỗi, sau commit)
      later(after, {
        userId: intent.userId,
        type: 'payment_succeeded',
        title: 'Thanh toán thành công',
        body: `Bạn đã thanh toán ${(intent.amountCents / 100).toFixed(2)} USD. Hóa đơn ${invoiceNumber}.`,
        link: `/courses/${intent.communityId}/community`,
        communityId: intent.communityId,
      });
      return { payment: final!, voided: false };
    });
  }

  /**
   * Chốt thanh toán MUA LẺ module trong transaction của `settle`: đánh dấu thành công → cấp ModuleAccess('purchase') → số hóa đơn (cuối cùng).
   * Không đụng tới Subscription/Enrollment. Đã sở hữu module (đua với request khác / owner cấp tay) ⇒ void `duplicate_charge` để hoàn tiền.
   * Bị cấm sau khi tạo giao dịch: vẫn ghi nhận thanh toán (hoàn tiền được) nhưng không cấp quyền — như gói thành viên.
   */
  async function settleModule(ops: PaymentsOps, after: After, intent: PaymentIntent, chargeId: string): Promise<{ payment: PaymentIntent; voided: boolean }> {
    const moduleId = intent.moduleId!;
    await ops.advisoryLock(`module:${intent.userId}:${moduleId}`);
    const current = await ops.findById(intent.id);
    if (!current || current.status !== 'pending') return { payment: current ?? intent, voided: false };
    if (await ops.hasModuleAccess(intent.userId, moduleId)) {
      const voided = await ops.transition(intent.id, ['pending'], { status: 'failed', gatewayChargeId: chargeId, failureReason: 'duplicate_charge' });
      return { payment: voided ?? current, voided: true };
    }
    const at = new Date();
    const done = await ops.transition(intent.id, ['pending'], { status: 'succeeded', confirmedAt: at.toISOString(), gatewayChargeId: chargeId });
    if (!done) return { payment: (await ops.findById(intent.id))!, voided: false };
    if (!(await ops.isBanned(intent.userId, intent.communityId))) await ops.grantModuleAccess(intent.userId, moduleId);
    const invoiceNumber = await ops.nextInvoiceNumber(at.getUTCFullYear());
    const final = await ops.transition(intent.id, ['succeeded'], { invoiceNumber });
    const title = (await ops.moduleTitles([moduleId])).get(moduleId) ?? 'module';
    after.push(() => referralsService.onPaymentSucceeded(final!));
    later(after, {
      userId: intent.userId,
      type: 'payment_succeeded',
      title: 'Bạn đã mở khóa module',
      body: `Bạn đã mở khóa module "${title}" với ${(intent.amountCents / 100).toFixed(2)} USD. Hóa đơn ${invoiceNumber}.`,
      link: `/communities/${intent.communityId}/community/lop-hoc/module/${moduleId}`,
      communityId: intent.communityId,
    });
    return { payment: final!, voided: false };
  }

  /** Hoàn khoản trừ trùng (đã void trong DB) qua cổng — NGOÀI transaction, idempotency key cố định theo giao dịch ⇒ gọi lại an toàn. */
  async function refundVoidedCharge(payment: PaymentIntent) {
    if (!payment.gatewayChargeId || payment.refundedCents > 0) return;
    const r = await gateway.refund(payment.gatewayChargeId, payment.amountCents, `void:${payment.id}`);
    if (!r.ok) return; // job đối soát (reconcileVoidedCharges) thử lại
    await repo.transition(payment.id, ['failed'], { refundedCents: payment.amountCents });
    notify({
      userId: payment.userId,
      type: 'system',
      title: 'Đã hoàn khoản thanh toán trùng',
      body: payment.moduleId
        ? `Bạn đã sở hữu module này nên khoản thanh toán ${(payment.amountCents / 100).toFixed(2)} USD bị trùng đã được hoàn lại.`
        : `Bạn đã có gói thành viên nên khoản thanh toán ${(payment.amountCents / 100).toFixed(2)} USD bị trùng đã được hoàn lại.`,
      link: `/courses/${payment.communityId}`,
      communityId: payment.communityId,
    });
  }

  /** settle + (nếu trùng) hoàn tiền. `throwOnVoid`: confirm trả 409 cho bên thua; webhook/job chỉ ghi nhận. */
  async function settleAndVoid(intent: PaymentIntent, chargeId: string, throwOnVoid = true): Promise<PaymentIntent> {
    const r = await settle(intent, chargeId);
    if (r.voided) {
      await refundVoidedCharge(r.payment);
      if (throwOnVoid) {
        if (r.payment.moduleId) throw HttpError.coded(409, 'ALREADY_OWNED', 'Bạn đã sở hữu module này; khoản thanh toán trùng đã được hoàn lại');
        throw HttpError.conflict('Bạn đã có gói thành viên ở cộng đồng này; khoản thanh toán trùng đã được hoàn lại');
      }
    }
    return r.payment;
  }

  async function failPayment(intent: PaymentIntent, reason: string) {
    const failed = await repo.transition(intent.id, ['pending'], { status: 'failed', failureReason: reason });
    if (failed) {
      notify({
        userId: intent.userId,
        type: 'payment_failed',
        title: 'Thanh toán thất bại',
        body: `Giao dịch không thành công (${reason}). Vui lòng thử lại hoặc dùng phương thức khác.`,
        link: `/courses/${intent.communityId}`,
        communityId: intent.communityId,
      });
    }
    return failed;
  }

  /** Tạo giao dịch gia hạn đã thành công (scheduler sau khi cổng trừ tiền OK, hoặc webhook subscription.renewed). Chạy trong transaction của caller (đã khóa Subscription). */
  async function recordRenewal(ops: PaymentsOps, after: After, sub: Subscription, chargeId: string, at: Date, kind: 'renewal' | 'initial' = 'renewal') {
    const start = new Date(sub.currentPeriodEnd);
    const end = addDays(start, periodDaysFor(sub.interval));
    let payment = await ops.create({
      communityId: sub.communityId,
      userId: sub.userId,
      method: 'stripe',
      amountUsd: sub.priceCents / 100,
      amountCents: sub.priceCents,
      trialDays: 0,
      interval: sub.interval,
      paymentCardId: sub.paymentCardId,
      kind,
      status: 'succeeded',
      confirmedAt: at.toISOString(),
      subscriptionId: sub.id,
      gatewayChargeId: chargeId,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
    await ops.updateSubscription(sub.id, {
      status: 'active',
      currentPeriodStart: start.toISOString(),
      currentPeriodEnd: end.toISOString(),
    });
    // Nhất quán với settle: gia hạn xong thì đảm bảo quyền truy cập (người bị cấm thì không cấp lại).
    if (!(await ops.isBanned(sub.userId, sub.communityId))) await ops.grantAccess(sub.userId, sub.communityId);
    // Số hóa đơn cấp CUỐI CÙNG (cùng thứ tự khóa với settle).
    const invoiceNumber = await ops.nextInvoiceNumber(at.getUTCFullYear());
    payment = (await ops.transition(payment.id, ['succeeded'], { invoiceNumber })) ?? payment;
    const paid = payment;
    after.push(() => referralsService.onPaymentSucceeded(paid)); // hoa hồng giới thiệu (cô lập lỗi, sau commit)
    later(after, {
      userId: sub.userId,
      type: 'payment_succeeded',
      title: kind === 'initial' ? 'Đã bắt đầu gói thành viên' : 'Gia hạn gói thành công',
      body: kind === 'initial'
        ? `Hết dùng thử, bạn đã được trừ ${(sub.priceCents / 100).toFixed(2)} USD. Gói có hiệu lực đến ${end.toISOString().slice(0, 10)}. Hóa đơn ${invoiceNumber}.`
        : `Gói của bạn được gia hạn đến ${end.toISOString().slice(0, 10)}. Hóa đơn ${invoiceNumber}.`,
      link: `/courses/${sub.communityId}/community`,
      communityId: sub.communityId,
    });
    return payment;
  }

  /** Kết thúc gói + thu hồi quyền (cùng transaction của caller). */
  async function endSubscription(ops: PaymentsOps, after: After, sub: Subscription, status: 'canceled' | 'expired', at: Date, why?: string) {
    await ops.updateSubscription(sub.id, { status, canceledAt: at.toISOString(), cancelAtPeriodEnd: false });
    await ops.revokeAccess(sub.userId, sub.communityId);
    if (why) {
      later(after, {
        userId: sub.userId,
        type: 'system',
        title: 'Gói thành viên đã kết thúc',
        body: why,
        link: `/courses/${sub.communityId}`,
        communityId: sub.communityId,
      });
    }
  }

  // ================================================================================================ hoàn tiền (2 pha)
  /**
   * Hoàn tiền KHÔNG giữ transaction trong lúc gọi cổng:
   *   tx1 (claim): yêu cầu pending → `refunding` (khóa độc quyền; bên thua nhận 409 và cổng không bị gọi 2 lần)
   *   gọi cổng NGOÀI transaction với idempotencyKey = refund.id (retry/đối soát gọi lại an toàn)
   *   tx2 (commit): Payment succeeded → refunded, yêu cầu → approved (+ mã hoàn của cổng), thu hồi quyền, ghi nợ owner nếu cần
   * Cổng từ chối ⇒ hoàn lại trạng thái (xóa yêu cầu tự tạo / về `pending`). Lỗi giữa chừng (timeout...) ⇒ yêu cầu nằm ở `refunding`
   * cho tới khi `reconcileStuckRefunds` chốt (gọi lại cổng cùng key — không hoàn thêm).
   */
  async function claimRefund(ops: PaymentsOps, refund: RefundRequest, patch: { note?: string; amountCents?: number } = {}) {
    const payment = await ops.findById(refund.paymentId);
    if (!payment || payment.status !== 'succeeded') throw HttpError.conflict('Giao dịch không còn ở trạng thái có thể hoàn tiền');
    const moved = await ops.transitionRefund(refund.id, ['pending'], {
      status: 'refunding',
      refundingAt: new Date().toISOString(),
      note: patch.note ?? refund.note,
      amountCents: patch.amountCents ?? refund.amountCents,
    });
    if (!moved) throw HttpError.conflict('Yêu cầu này đã được xử lý');
    return moved;
  }

  async function recordDebt(ops: PaymentsOps, communityId: string, before: BalanceFigures, entry: Omit<LedgerEntryInput, 'communityId' | 'amountCents'>) {
    const after = await ops.balance(communityId, revenueRates());
    const debt = (b: BalanceFigures) => Math.max(0, -(b.net - b.requested));
    const delta = debt(after) - debt(before);
    if (delta > 0) await ops.addLedgerEntry({ ...entry, communityId, amountCents: -delta });
  }

  /** Chốt hoàn tiền trong transaction của caller (đã giữ advisory `refund:<paymentId>`). `from` = trạng thái yêu cầu hiện tại. */
  async function applyRefund(
    ops: PaymentsOps,
    after: After,
    refund: RefundRequest,
    resolvedBy: string | undefined,
    from: RefundRequest['status'][],
    gatewayRefundId?: string,
    ledgerKind: 'refund_after_payout' | 'chargeback_after_payout' = 'refund_after_payout',
  ) {
    const payment = await ops.findById(refund.paymentId);
    if (!payment || payment.status !== 'succeeded') throw HttpError.conflict('Giao dịch không còn ở trạng thái có thể hoàn tiền');
    const balanceBefore = await ops.balance(payment.communityId, revenueRates());
    // Hoàn một phần (admin) thì giữ quyền truy cập; hoàn toàn bộ mới thu hồi.
    const full = refund.amountCents >= payment.amountCents - payment.refundedCents;
    const done = await ops.transition(payment.id, ['succeeded'], { status: 'refunded', refundedCents: refund.amountCents });
    if (!done) throw HttpError.conflict('Giao dịch đã được xử lý');
    const at = new Date();
    const updated = await ops.transitionRefund(refund.id, from, {
      status: 'approved',
      resolvedBy,
      resolvedAt: at.toISOString(),
      note: refund.note,
      amountCents: refund.amountCents,
      gatewayRefundId,
    });
    if (!updated) throw HttpError.conflict('Yêu cầu này đã được xử lý');

    // Thu hồi quyền nếu giao dịch này là kỳ đang hiệu lực của gói.
    if (full && payment.subscriptionId) {
      const sub = await ops.findSubscription(payment.subscriptionId);
      if (sub && (sub.status === 'active' || sub.status === 'trialing') && sub.currentPeriodEnd === payment.periodEnd) {
        await endSubscription(ops, after, sub, 'canceled', at);
      }
    }
    // Mua lẻ module: hoàn toàn bộ thì thu hồi quyền mở module (chỉ dòng source 'purchase'); không đụng gói thành viên.
    if (full && payment.moduleId) await ops.revokeModuleAccess(payment.userId, payment.moduleId);
    // Hoàn tiền SAU khi owner đã rút (số dư ròng < 0) ⇒ ghi sổ nợ.
    await recordDebt(ops, payment.communityId, balanceBefore, { kind: ledgerKind, paymentId: payment.id, refundId: refund.id, note: refund.reason });
    if (full) after.push(() => referralsService.voidForPayment(payment.id)); // hủy hoa hồng giới thiệu chưa chi trả (sau commit)
    later(after, {
      userId: refund.userId,
      type: 'system',
      title: 'Hoàn tiền thành công',
      body: `Đã hoàn ${(refund.amountCents / 100).toFixed(2)} USD cho giao dịch của bạn.`,
      link: `/courses/${refund.communityId}`,
      communityId: refund.communityId,
    });
    return updated;
  }

  async function abortRefund(refund: RefundRequest, createdHere: boolean) {
    if (createdHere) await repo.deleteRefund(refund.id);
    else await repo.transitionRefund(refund.id, ['refunding'], { status: 'pending', refundingAt: null });
  }

  /** Pha 2 + 3 của hoàn tiền: gọi cổng (ngoài transaction) rồi chốt. `refund` phải đang ở `refunding`. */
  async function finishRefund(refund: RefundRequest, resolvedBy: string | undefined, createdHere: boolean) {
    const payment = await repo.findById(refund.paymentId);
    if (!payment) throw HttpError.notFound('Không tìm thấy giao dịch');
    let result;
    try {
      result = await gateway.refund(payment.gatewayChargeId ?? '', refund.amountCents, refund.id);
    } catch {
      // Không biết cổng đã hoàn hay chưa: GIỮ `refunding` để job đối soát gọi lại với cùng key.
      throw new HttpError(502, 'GATEWAY_ERROR', 'Chưa xác nhận được kết quả hoàn tiền, hệ thống sẽ tự đối soát. Vui lòng không gửi lại yêu cầu.');
    }
    if (!result.ok) {
      await abortRefund(refund, createdHere);
      throw new HttpError(502, 'GATEWAY_ERROR', 'Cổng thanh toán từ chối hoàn tiền, vui lòng thử lại sau');
    }
    return inTx(async (ops, after) => {
      await ops.advisoryLock(`refund:${refund.paymentId}`);
      return applyRefund(ops, after, refund, resolvedBy, ['refunding'], result.refundId);
    });
  }

  /** Lần thanh toán đầu của gói chứa giao dịch này — mốc tính cửa sổ hoàn tiền. */
  async function firstPaymentAt(ops: PaymentsOps, payment: PaymentIntent): Promise<Date> {
    const earliest = payment.subscriptionId ? await ops.earliestConfirmedForSubscription(payment.subscriptionId) : undefined;
    return earliest ?? new Date(payment.confirmedAt ?? payment.createdAt);
  }

  function payoutView(p: Payout) {
    const { accountLast4, ...method } = p.method;
    return { ...p, method: { ...method, accountMasked: `****${accountLast4}` } };
  }

  function notifyPayout(p: Payout, title: string, body: string) {
    notify({ userId: p.ownerId, type: 'system', title, body, link: `/courses/${p.communityId}/revenue`, communityId: p.communityId });
  }

  async function idempotentReplay(userId: string, communityId: string, key: string) {
    const existingId = await repo.findIdempotent(userId, key);
    if (!existingId) return undefined;
    const existing = await repo.findById(existingId);
    if (existing && existing.communityId !== communityId) throw HttpError.conflict('Idempotency-Key này đã được dùng cho giao dịch khác');
    return existing;
  }

  // ================================================================================================ webhook
  async function processWebhookEvent(event: { id: string; type: string; data: Record<string, unknown> }) {
    const str = (k: string) => (typeof event.data[k] === 'string' ? (event.data[k] as string) : undefined);
    switch (event.type) {
      case 'payment.succeeded': {
        const p = str('paymentId') ? await repo.findById(str('paymentId')!) : undefined;
        if (!p) return { received: true, ignored: true };
        if (p.status === 'pending') await settleAndVoid(p, str('chargeId') ?? `webhook_${event.id}`, false);
        break;
      }
      case 'payment.failed': {
        const p = str('paymentId') ? await repo.findById(str('paymentId')!) : undefined;
        if (!p) return { received: true, ignored: true };
        await failPayment(p, str('reason') ?? 'declined');
        break;
      }
      case 'payment.refunded': {
        const p = str('paymentId') ? await repo.findById(str('paymentId')!) : undefined;
        if (!p) return { received: true, ignored: true };
        await inTx(async (ops, after) => {
          await ops.advisoryLock(`refund:${p.id}`);
          const cur = await ops.findById(p.id);
          if (cur && cur.status === 'succeeded' && !(await ops.findOpenRefundForPayment(cur.id))) {
            const refund = await ops.createRefund({
              paymentId: cur.id,
              communityId: cur.communityId,
              userId: cur.userId,
              amountCents: cur.amountCents - cur.refundedCents,
              reason: 'Hoàn tiền từ cổng thanh toán',
              status: 'pending',
              auto: true,
            });
            await applyRefund(ops, after, refund, undefined, ['pending']); // cổng đã hoàn rồi, không gọi lại
          }
        });
        break;
      }
      case 'subscription.renewed': {
        const sub = str('subscriptionId') ? await repo.findSubscription(str('subscriptionId')!) : undefined;
        if (!sub) return { received: true, ignored: true };
        if (sub.status === 'active' || sub.status === 'expired') {
          await inTx(async (ops, after) => {
            await ops.advisoryLock(`sub:${sub.userId}:${sub.communityId}`);
            await recordRenewal(ops, after, sub, str('chargeId') ?? `webhook_${event.id}`, new Date());
          });
        }
        break;
      }
      case 'subscription.canceled': {
        const sub = str('subscriptionId') ? await repo.findSubscription(str('subscriptionId')!) : undefined;
        if (!sub) return { received: true, ignored: true };
        if (sub.status === 'active' || sub.status === 'trialing') {
          await inTx((ops, after) => endSubscription(ops, after, sub, 'canceled', new Date(), 'Gói thành viên của bạn đã bị hủy bởi cổng thanh toán.'));
        }
        break;
      }
      default:
        return { received: true, ignored: true };
    }
    return { received: true };
  }

  async function runClaimedWebhook(event: { id: string; type: string; data: Record<string, unknown> }) {
    try {
      const result = await processWebhookEvent(event);
      await repo.finishWebhookEvent(event.id, { ok: true });
      return result;
    } catch (err) {
      await repo.finishWebhookEvent(event.id, { ok: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /** Thay đổi trạng thái gói của 1 user ở 1 cộng đồng (kick/ban/leave/xóa/khóa cộng đồng). Mọi thay đổi trong 1 transaction có khóa. */
  async function changeLiveSubscription(userId: string, communityId: string, mode: 'end_now' | 'cancel_at_period_end', why: string, at = new Date()) {
    return inTx(async (ops, after) => {
      await ops.advisoryLock(`sub:${userId}:${communityId}`);
      const sub = await ops.lockLiveSubscription(userId, communityId);
      if (!sub) return false;
      if (mode === 'end_now') {
        await endSubscription(ops, after, sub, 'canceled', at, why);
      } else if (!sub.cancelAtPeriodEnd) {
        await ops.updateSubscription(sub.id, { cancelAtPeriodEnd: true, canceledAt: at.toISOString() });
        later(after, { userId, type: 'system', title: 'Gói thành viên sẽ không gia hạn', body: why, link: `/courses/${communityId}`, communityId });
      }
      return true;
    });
  }

  const service = {
    // ----------------------------------------------------------------- checkout (giữ tương thích FE cũ)
    async checkout(communityId: string, userId: string, method: PaymentMethod, idempotencyKey?: string, opts: { interval?: BillingInterval; paymentMethod?: PaymentMethodInput } = {}) {
      await assertUserCan(userId, 'purchase');
      const course = await catalogService.getById(communityId);
      if (course.locked) throw locked();
      if (course.priceUsd <= 0) throw HttpError.badRequest('Khóa học này miễn phí, không cần thanh toán');
      const interval = opts.interval ?? 'monthly';
      const amountCents = intervalPriceCents(course, interval); // giá do server quyết định theo chu kỳ

      // Cùng Idempotency-Key → trả lại đúng giao dịch cũ, không tạo giao dịch thứ hai.
      if (idempotencyKey) {
        const replay = await idempotentReplay(userId, communityId, idempotencyKey);
        if (replay) return replay;
      }

      const live = await repo.lockLiveSubscription(userId, communityId);
      const trialing = live?.status === 'trialing';
      if (live?.status === 'active') {
        throw HttpError.conflict('Bạn đang có gói thành viên còn hiệu lực ở cộng đồng này — hãy vào lại cộng đồng, không cần thanh toán lại');
      }
      if ((await enrollmentService.isEnrolled(userId, communityId)) && !trialing) throw HttpError.conflict('Bạn đã tham gia khóa học này rồi');
      await assertMayPurchase(userId, communityId, course.visibility, course.autoApprovePaid);
      const card = opts.paymentMethod ? await repo.upsertCard(userId, opts.paymentMethod) : undefined; // chỉ brand/last4/hạn + token

      try {
        // Giá luôn lấy từ server, không nhận số tiền từ client. Giao dịch + khóa idempotency cùng commit: 2 request song song
        // cùng key ⇒ một bên vi phạm unique (userId,key) ⇒ rollback ⇒ trả giao dịch của bên thắng.
        // Khóa cố vấn (user, course): 2 checkout song song của cùng người tái dùng CÙNG 1 intent pending thay vì tạo 2 intent.
        return await repo.transaction(async (ops) => {
          await ops.advisoryLock(`checkout:${userId}:${communityId}`);
          const reusable = await ops.findReusablePending(userId, communityId, new Date(Date.now() - PENDING_INTENT_TTL_MS), { interval, amountCents });
          const intent =
            reusable ??
            (await ops.create({
              communityId,
              userId,
              method,
              amountUsd: amountCents / 100,
              amountCents,
              trialDays: cfg().payments.trialDays,
              interval,
              paymentCardId: card?.id,
            }));
          if (idempotencyKey) await ops.saveIdempotent(userId, idempotencyKey, intent.id);
          return intent;
        });
      } catch (e) {
        if (idempotencyKey && isUniqueViolation(e)) {
          const replay = await idempotentReplay(userId, communityId, idempotencyKey);
          if (replay) return replay;
        }
        throw e;
      }
    },

    async getOrThrow(paymentIntentId: string) {
      const intent = await repo.findById(paymentIntentId);
      if (!intent) throw HttpError.notFound('Không tìm thấy giao dịch');
      return intent;
    },

    /**
     * Xác nhận thanh toán: gọi cổng trừ tiền rồi cấp quyền. Idempotent và chống double-confirm (xem `settle`).
     * Ghi `gatewayChargeId` vào Payment NGAY sau khi cổng trừ tiền (trước settle): nếu settle lỗi thì tiền đã trừ vẫn truy vết được và
     * `reconcileUnsettledCharges` hoàn tất giao dịch.
     */
    async confirm(paymentIntentId: string, userId: string): Promise<PaymentIntent> {
      const intent = await service.getOrThrow(paymentIntentId);
      if (intent.userId !== userId) throw HttpError.forbidden();
      if (intent.status === 'succeeded' || intent.status === 'refunded') return intent;
      if (intent.status === 'failed') throw HttpError.conflict('Giao dịch đã thất bại, vui lòng tạo giao dịch mới');

      const running = inflightConfirm.get(intent.id);
      if (running) return running;

      const job = (async () => {
        const course = await catalogService.getById(intent.communityId);
        if (course.locked) throw locked();
        if (await enrollmentService.isBanned(userId, intent.communityId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
        if (intent.moduleId) {
          if (await repo.hasModuleAccess(userId, intent.moduleId)) throw HttpError.coded(409, 'ALREADY_OWNED', 'Bạn đã sở hữu module này');
          const card = intent.paymentCardId ? await repo.findCard(intent.paymentCardId) : undefined;
          const title = (await repo.moduleTitles([intent.moduleId])).get(intent.moduleId) ?? intent.moduleId;
          const charge = await gateway.createCharge({
            amountCents: intent.amountCents,
            currency: 'usd',
            description: `Module ${title} — ${course.title}`,
            customerId: userId,
            idempotencyKey: intent.id,
            paymentToken: card?.gatewayToken,
          });
          if (!charge.ok) {
            await failPayment(intent, charge.failureReason ?? 'declined');
            throw new HttpError(402, 'PAYMENT_FAILED', 'Thanh toán không thành công, vui lòng thử lại hoặc dùng phương thức khác');
          }
          await repo.transition(intent.id, ['pending'], { gatewayChargeId: charge.chargeId });
          return settleAndVoid(intent, charge.chargeId);
        }
        const live = await repo.lockLiveSubscription(userId, intent.communityId);
        if (live?.status === 'active' || ((await enrollmentService.isEnrolled(userId, intent.communityId)) && live?.status !== 'trialing')) {
          throw HttpError.conflict('Bạn đã tham gia khóa học này rồi');
        }
        const card = intent.paymentCardId ? await repo.findCard(intent.paymentCardId) : undefined;
        const charge = await gateway.createCharge({
          amountCents: intent.amountCents,
          currency: 'usd',
          description: `Gói thành viên ${course.title}`,
          customerId: userId,
          idempotencyKey: intent.id,
          paymentToken: card?.gatewayToken,
        });
        if (!charge.ok) {
          await failPayment(intent, charge.failureReason ?? 'declined');
          throw new HttpError(402, 'PAYMENT_FAILED', 'Thanh toán không thành công, vui lòng thử lại hoặc dùng phương thức khác');
        }
        await repo.transition(intent.id, ['pending'], { gatewayChargeId: charge.chargeId }); // lưu vết trước khi settle
        return settleAndVoid(intent, charge.chargeId);
      })().finally(() => inflightConfirm.delete(intent.id));
      inflightConfirm.set(intent.id, job);
      return job;
    },

    async statusFor(communityId: string, userId: string) {
      const enrolled = await enrollmentService.isEnrolled(userId, communityId);
      const latest = await repo.findLatestForUser(communityId, userId);
      const sub = await repo.findSubscriptionFor(userId, communityId);
      const card = sub?.paymentCardId ? await repo.findCard(sub.paymentCardId) : undefined;
      return { enrolled, latestPayment: latest, subscription: sub ? { ...subscriptionView(sub), paymentMethod: cardView(card) } : null };
    },

    // ----------------------------------------------------------------- mua lẻ module trả phí (một lần)
    /**
     * Kiểm tra điều kiện mua + trả về module. Thứ tự lỗi: cộng đồng khóa 403 → module không có/không thuộc cộng đồng 404 → không phải module trả phí 400
     * MODULE_NOT_PAID → staff 409 STAFF_EXEMPT → bị cấm 403 → chưa tham gia 403 JOIN_REQUIRED → đã sở hữu 409 ALREADY_OWNED.
     */
    async assertModulePurchasable(communityId: string, moduleId: string, userId: string) {
      const course = await catalogService.getById(communityId);
      if (course.locked) throw locked();
      const mod = await repo.findModuleForPurchase(communityId, moduleId);
      if (!mod) throw HttpError.notFound('Không tìm thấy module');
      if (mod.accessMode !== 'paid' || !mod.priceCents || mod.priceCents <= 0) throw HttpError.coded(400, 'MODULE_NOT_PAID', 'Module này không bán riêng');
      if (atLeast(await getRole(userId, communityId), 'mod')) throw HttpError.coded(409, 'STAFF_EXEMPT', 'Bạn là quản trị cộng đồng nên không cần mua module');
      if (await enrollmentService.isBanned(userId, communityId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      if (!(await enrollmentService.isEnrolled(userId, communityId))) {
        throw HttpError.coded(403, 'JOIN_REQUIRED', 'Hãy tham gia cộng đồng trước khi mua module');
      }
      if (await repo.hasModuleAccess(userId, moduleId)) throw HttpError.coded(409, 'ALREADY_OWNED', 'Bạn đã sở hữu module này');
      return { course, mod, priceCents: mod.priceCents };
    },

    /** Báo giá mua module: giá do server quyết định; lỗi điều kiện mua (đã sở hữu, chưa tham gia...) trả về dưới dạng `blocked` để UI hiển thị thay vì ném lỗi. */
    async moduleQuote(communityId: string, moduleId: string, userId: string) {
      const course = await catalogService.getById(communityId);
      if (course.locked) throw locked();
      const mod = await repo.findModuleForPurchase(communityId, moduleId);
      if (!mod) throw HttpError.notFound('Không tìm thấy module');
      if (mod.accessMode !== 'paid' || !mod.priceCents || mod.priceCents <= 0) throw HttpError.coded(400, 'MODULE_NOT_PAID', 'Module này không bán riêng');
      let blocked: string | null = null;
      try {
        await service.assertModulePurchasable(communityId, moduleId, userId);
      } catch (e) {
        if (!(e instanceof HttpError) || !e.code) throw e;
        blocked = e.code;
      }
      return {
        communityId,
        moduleId,
        title: mod.title,
        currency: 'USD',
        priceCents: mod.priceCents,
        priceUsd: mod.priceCents / 100,
        oneTime: true,
        provider: 'stripe',
        canPurchase: blocked === null,
        blocked,
        owned: blocked === 'ALREADY_OWNED',
      };
    },

    /** Mua module: tạo giao dịch (tái dùng intent pending / replay theo Idempotency-Key) rồi trừ tiền + cấp quyền bằng `confirm`. Trả giao dịch đã chốt. */
    async purchaseModule(communityId: string, moduleId: string, userId: string, opts: { paymentMethod?: PaymentMethodInput; idempotencyKey?: string } = {}) {
      await assertUserCan(userId, 'purchase');
      const { idempotencyKey } = opts;
      if (idempotencyKey) {
        const replay = await idempotentReplay(userId, communityId, idempotencyKey);
        if (replay) {
          if (replay.moduleId !== moduleId) throw HttpError.conflict('Idempotency-Key này đã được dùng cho giao dịch khác');
          if (replay.status === 'failed') throw new HttpError(402, 'PAYMENT_FAILED', 'Thanh toán không thành công, vui lòng thử lại hoặc dùng phương thức khác');
          return service.confirm(replay.id, userId); // pending → chạy tiếp; succeeded/refunded → trả nguyên
        }
      }
      const { priceCents } = await service.assertModulePurchasable(communityId, moduleId, userId);
      const card = opts.paymentMethod ? await repo.upsertCard(userId, opts.paymentMethod) : undefined;
      let intent: PaymentIntent;
      try {
        intent = await repo.transaction(async (ops) => {
          await ops.advisoryLock(`module:${userId}:${moduleId}`);
          const reusable = await ops.findReusablePendingModule(userId, moduleId, new Date(Date.now() - PENDING_INTENT_TTL_MS), priceCents);
          const created =
            reusable ??
            (await ops.create({
              communityId, userId, method: 'stripe', amountUsd: priceCents / 100, amountCents: priceCents, trialDays: 0,
              kind: 'module', moduleId, paymentCardId: card?.id,
            }));
          if (idempotencyKey) await ops.saveIdempotent(userId, idempotencyKey, created.id);
          return created;
        });
      } catch (e) {
        if (idempotencyKey && isUniqueViolation(e)) {
          const replay = await idempotentReplay(userId, communityId, idempotencyKey);
          if (replay) return service.confirm(replay.id, userId);
        }
        throw e;
      }
      return service.confirm(intent.id, userId);
    },

    // ----------------------------------------------------------------- báo giá cho hộp thoại tham gia
    /**
     * Mọi con số/ngày của hộp thoại "Chọn gói thành viên" đều do server tính (FE không tự cộng ngày/tiền). `userId` (nếu có) dùng để
     * biết người này đã dùng thử rồi hay đã là thành viên (khi đó không còn dùng thử).
     */
    async quote(communityId: string, userId: string | undefined, interval: BillingInterval = 'monthly', now = new Date()) {
      const course = await catalogService.getById(communityId);
      if (course.priceUsd <= 0) throw HttpError.coded(400, 'COMMUNITY_FREE', 'Cộng đồng này miễn phí, không cần thanh toán');
      const selectedCents = intervalPriceCents(course, interval); // 400 INTERVAL_UNAVAILABLE nếu không bán gói năm
      const plans = [
        { interval: 'monthly' as const, label: 'Hàng tháng', priceUsd: course.priceUsd, billedUsd: course.priceUsd, perMonthUsd: course.priceUsd, savingsPct: 0, popular: true, periodDays: periodDaysFor('monthly') },
        ...(course.priceAnnualUsd == null
          ? []
          : [{
              interval: 'annual' as const,
              label: 'Hàng năm',
              priceUsd: course.priceAnnualUsd,
              billedUsd: course.priceAnnualUsd,
              perMonthUsd: Math.round((course.priceAnnualUsd / 12) * 100) / 100,
              savingsPct: annualSavingsPct(course.priceUsd, course.priceAnnualUsd),
              popular: false,
              periodDays: periodDaysFor('annual'),
            }]),
      ];
      const trialAllowed =
        course.memberTrialEnabled && !(userId && ((await repo.hasHadTrial(userId, communityId)) || (await enrollmentService.isEnrolled(userId, communityId))));
      const trialDays = trialAllowed ? cfg().payments.trialDays : 0;
      const firstCharge = addDays(now, trialDays);
      const remindDays = cfg().payments.trialReminderDays;
      return {
        communityId,
        currency: 'USD',
        paid: true,
        plans,
        selected: interval,
        trialDays,
        trialEligible: trialDays > 0,
        startsAt: now.toISOString(),
        firstChargeDate: firstCharge.toISOString(),
        firstChargeAmountUsd: selectedCents / 100,
        firstChargeAmountCents: selectedCents,
        dueTodayUsd: trialDays > 0 ? 0 : selectedCents / 100,
        remindDaysBefore: remindDays,
        remindAt: trialDays > 0 ? new Date(Math.max(now.getTime(), firstCharge.getTime() - remindDays * DAY_MS)).toISOString() : null,
        cancelAnytime: true,
        provider: 'stripe',
      };
    },

    /** Thẻ đã lưu của user (chỉ brand/last4/hạn dùng). */
    async myCards(userId: string) {
      return (await repo.listCards(userId)).map((c) => cardView(c)!);
    },

    /**
     * Job nhắc trước ngày trừ tiền đầu tiên (hết dùng thử có thẻ). `claimTrialReminders` đánh dấu nguyên tử trong DB TRƯỚC khi gửi ⇒ mỗi gói nhắc đúng 1 lần
     * dù job chạy lặp/song song nhiều instance (đổi lại: mail lỗi thì không gửi lại — mailService đã nuốt lỗi gửi).
     */
    async sendTrialReminders(now = new Date()) {
      const days = cfg().payments.trialReminderDays;
      if (days <= 0) return { sent: 0 };
      let sent = 0;
      for (const sub of await repo.claimTrialReminders(now, days, 200)) {
        try {
          const [user, card, title] = await Promise.all([fileUserRepository.findById(sub.userId), sub.paymentCardId ? repo.findCard(sub.paymentCardId) : undefined, courseTitle(sub.communityId)]);
          const when = sub.currentPeriodEnd.slice(0, 10);
          const amount = (sub.priceCents / 100).toFixed(2);
          const text = `Dùng thử "${title}" của bạn kết thúc vào ngày ${when}. Lần thanh toán đầu tiên ${amount} USD${card ? ` (thẻ •••• ${card.last4})` : ''} sẽ diễn ra vào ngày đó. Bạn có thể hủy bất cứ lúc nào chỉ với 1 lần bấm trước ngày ${when} để không bị trừ tiền.`;
          if (user?.email) await mailService.send({ to: user.email, subject: `Dùng thử "${title}" sắp kết thúc`, text });
          notify({ userId: sub.userId, type: 'system', title: 'Dùng thử sắp kết thúc', body: text, link: `/courses/${sub.communityId}`, communityId: sub.communityId });
          sent++;
        } catch (err) {
          console.error('sendTrialReminders: bỏ qua 1 gói do lỗi:', err);
        }
      }
      return { sent };
    },

    // ----------------------------------------------------------------- gói thành viên
    async mySubscriptions(userId: string) {
      const subs = await repo.listSubscriptionsByUser(userId);
      return Promise.all(subs.map(async (s) => subscriptionView(s, await courseTitle(s.communityId))));
    },

    async startTrial(communityId: string, userId: string, at = new Date(), opts: { interval?: BillingInterval; paymentMethod?: PaymentMethodInput } = {}) {
      const course = await catalogService.getById(communityId);
      if (course.locked) throw locked();
      if (course.priceUsd <= 0) throw HttpError.badRequest('Cộng đồng miễn phí không có dùng thử');
      if (!course.memberTrialEnabled) throw HttpError.coded(400, 'TRIAL_NOT_AVAILABLE', 'Cộng đồng này không có dùng thử miễn phí');
      const interval = opts.interval ?? 'monthly';
      const priceCents = intervalPriceCents(course, interval);
      if (await enrollmentService.isEnrolled(userId, communityId)) throw HttpError.conflict('Bạn đã tham gia cộng đồng này rồi');
      if (await repo.hasHadTrial(userId, communityId)) throw HttpError.conflict('Bạn đã dùng thử cộng đồng này rồi');
      await assertMayPurchase(userId, communityId, course.visibility, course.autoApprovePaid);
      const end = addDays(at, cfg().payments.trialDays);
      const card = opts.paymentMethod ? await repo.upsertCard(userId, opts.paymentMethod) : undefined; // chỉ brand/last4/hạn + token
      const sub = await inTx(async (ops, after) => {
        await ops.advisoryLock(`sub:${userId}:${communityId}`);
        if (await ops.lockLiveSubscription(userId, communityId)) throw HttpError.conflict('Bạn đang có gói thành viên còn hiệu lực ở cộng đồng này');
        if (await ops.hasHadTrial(userId, communityId)) throw HttpError.conflict('Bạn đã dùng thử cộng đồng này rồi'); // đua với request song song
        const created = await ops.createSubscription({
          userId,
          communityId,
          status: 'trialing',
          priceCents,
          interval,
          paymentCardId: card?.id,
          currentPeriodStart: at.toISOString(),
          currentPeriodEnd: end.toISOString(),
          cancelAtPeriodEnd: false,
          trialEndsAt: end.toISOString(),
        });
        await ops.grantAccess(userId, communityId); // 403 nếu đang bị cấm ⇒ rollback cả gói dùng thử
        later(after, {
          userId,
          type: 'system',
          title: 'Bắt đầu dùng thử',
          body: card
            ? `Bạn được dùng thử "${course.title}" đến ${end.toISOString().slice(0, 10)}. Sau đó thẻ •••• ${card.last4} sẽ bị trừ ${(priceCents / 100).toFixed(2)} USD, trừ khi bạn hủy trước.`
            : `Bạn được dùng thử "${course.title}" đến ${end.toISOString().slice(0, 10)}.`,
          link: `/courses/${communityId}/community`,
          communityId,
        });
        return created;
      });
      return { ...subscriptionView(sub, course.title), paymentMethod: cardView(card), nextChargeAmountCents: card ? priceCents : null };
    },

    async cancelSubscription(communityId: string, userId: string, atPeriodEnd: boolean, at = new Date()) {
      const sub = await repo.findSubscriptionFor(userId, communityId);
      if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) throw HttpError.notFound('Bạn không có gói thành viên đang hoạt động ở cộng đồng này');
      if (atPeriodEnd) {
        const updated = await repo.updateSubscription(sub.id, { cancelAtPeriodEnd: true, canceledAt: at.toISOString() });
        return subscriptionView(updated!);
      }
      await inTx((ops, after) => endSubscription(ops, after, sub, 'canceled', at, 'Gói thành viên của bạn đã được hủy và quyền truy cập đã bị thu hồi.'));
      return subscriptionView((await repo.findSubscription(sub.id))!);
    },

    async resumeSubscription(communityId: string, userId: string, at = new Date()) {
      const sub = await repo.findSubscriptionFor(userId, communityId);
      if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) throw HttpError.notFound('Bạn không có gói thành viên đang hoạt động ở cộng đồng này');
      if (!sub.cancelAtPeriodEnd) throw HttpError.conflict('Gói này không ở trạng thái hủy cuối kỳ');
      if (new Date(sub.currentPeriodEnd) <= at) throw HttpError.conflict('Gói đã hết kỳ, không thể tiếp tục');
      const updated = await repo.updateSubscription(sub.id, { cancelAtPeriodEnd: false, canceledAt: null });
      return subscriptionView(updated!);
    },

    // ----------------------------------------------------------------- vòng đời thành viên ↔ gói (communities/enrollments/moderation gọi)
    /** Gói còn hiệu lực (active|trialing, chưa hết kỳ) của user ở cộng đồng — dùng để vào lại cộng đồng mà không phải trả tiền lần nữa. */
    async hasLiveSubscription(userId: string, communityId: string, at = new Date()): Promise<boolean> {
      const sub = await repo.findSubscriptionFor(userId, communityId);
      return !!sub && (sub.status === 'active' || sub.status === 'trialing') && new Date(sub.currentPeriodEnd) > at;
    },

    /** Thành viên tự rời: hủy gói CUỐI KỲ (không trừ tiền tiếp; vẫn có thể vào lại tới hết kỳ đã trả). */
    onMemberLeft: (userId: string, communityId: string) =>
      changeLiveSubscription(userId, communityId, 'cancel_at_period_end', 'Bạn đã rời cộng đồng nên gói sẽ không gia hạn. Bạn vẫn có thể vào lại đến hết kỳ đã thanh toán.'),

    /** Bị kick / cộng đồng bị xóa: kết thúc gói NGAY (thu hồi quyền). */
    endMembership: (userId: string, communityId: string, why: string) => changeLiveSubscription(userId, communityId, 'end_now', why),

    /** Bị cấm / cộng đồng bị khóa-đình chỉ: dừng gia hạn (hủy cuối kỳ); gỡ cấm trong kỳ thì khôi phục quyền (không trừ tiền, không đổi kỳ). */
    stopRenewals: (userId: string, communityId: string, why: string) => changeLiveSubscription(userId, communityId, 'cancel_at_period_end', why),

    /** Mọi gói đang sống của 1 cộng đồng (xóa → kết thúc ngay; khóa/đình chỉ → dừng gia hạn). Lỗi từng gói không chặn các gói khác. */
    async endAllForCommunity(communityId: string, mode: 'end_now' | 'cancel_at_period_end', why: string): Promise<number> {
      let n = 0;
      for (const sub of await repo.listLiveSubscriptionsForCourse(communityId)) {
        try {
          if (await changeLiveSubscription(sub.userId, communityId, mode, why)) n++;
        } catch (err) {
          console.error('endAllForCommunity: bỏ qua 1 gói do lỗi:', err);
        }
      }
      return n;
    },

    /** Gỡ cấm: nếu gói còn hiệu lực thì cấp lại quyền (không trừ tiền, không reset kỳ). */
    async restoreAccessIfSubscribed(userId: string, communityId: string): Promise<boolean> {
      if (!(await service.hasLiveSubscription(userId, communityId))) return false;
      await repo.grantAccess(userId, communityId);
      return true;
    },

    /**
     * Xử lý gói đến hạn (scheduler gọi mỗi 5 phút): cộng đồng đã xóa / người dùng đã bị cấm hoặc không còn là thành viên → kết thúc (không trừ tiền);
     * hết dùng thử → expired; đã hủy-cuối-kỳ → canceled; còn lại gia hạn (mỗi lần chạy tiến 1 kỳ). Cộng đồng đang khóa/đình chỉ bị bỏ qua.
     * Thẻ bị từ chối → expired + thu hồi quyền.
     *
     * Mỗi gói được xử lý trong MỘT transaction riêng, chọn bằng `FOR UPDATE SKIP LOCKED`: nhiều instance/lượt chạy song song
     * không bao giờ xử lý cùng một gói (bên chậm hơn bỏ qua gói đang bị khóa, hoặc thấy nó đã hết hạn-xử-lý sau khi bên kia commit).
     * Lỗi ở một gói (vd. cổng lỗi mạng) chỉ rollback gói đó, các gói khác vẫn được xử lý; lần chạy sau thử lại.
     */
    async processDueSubscriptions(now = new Date()) {
      const result = { renewed: 0, renewalFailed: 0, trialsExpired: 0, trialsConverted: 0, ended: 0 };
      const seen: string[] = [];
      for (;;) {
        const st: { outcome?: keyof typeof result; more: boolean } = { more: true };
        try {
          await inTx(async (ops, after) => {
            const sub = await ops.lockNextDueSubscription(now, seen);
            if (!sub) {
              st.more = false;
              return;
            }
            seen.push(sub.id);
            const state = await ops.courseState(sub.communityId);
            if (state.deleted) {
              await endSubscription(ops, after, sub, 'canceled', now, 'Cộng đồng đã bị xóa nên gói thành viên của bạn đã được hủy và sẽ không bị tính phí thêm.');
              st.outcome = 'ended';
            } else if (sub.status === 'trialing' && sub.paymentCardId && !sub.cancelAtPeriodEnd && !(await ops.isBanned(sub.userId, sub.communityId)) && (await ops.isEnrolled(sub.userId, sub.communityId))) {
              // Hết dùng thử CÓ THẺ: trừ tiền lần đầu (cổng giả lập) rồi chuyển active; thất bại ⇒ expired. Khóa idempotency cố định theo gói.
              const card = await ops.findCard(sub.paymentCardId);
              const charge = await gateway.createCharge({
                amountCents: sub.priceCents,
                currency: 'usd',
                description: `Bắt đầu gói ${sub.communityId}`,
                customerId: sub.userId,
                idempotencyKey: `${sub.id}:trial-end`,
                paymentToken: card?.gatewayToken,
              });
              if (charge.ok) {
                await recordRenewal(ops, after, sub, charge.chargeId, now, 'initial');
                st.outcome = 'trialsConverted';
              } else {
                await ops.create({
                  communityId: sub.communityId, userId: sub.userId, method: 'stripe', amountUsd: sub.priceCents / 100, amountCents: sub.priceCents,
                  trialDays: 0, interval: sub.interval, paymentCardId: sub.paymentCardId, kind: 'initial', status: 'failed', subscriptionId: sub.id,
                  failureReason: charge.failureReason ?? 'declined',
                });
                await endSubscription(ops, after, sub, 'expired', now);
                later(after, {
                  userId: sub.userId, type: 'payment_failed', title: 'Không trừ được tiền sau dùng thử',
                  body: 'Thẻ của bạn bị từ chối khi bắt đầu gói trả phí nên quyền truy cập đã kết thúc. Hãy đăng ký lại bằng thẻ khác.',
                  link: `/courses/${sub.communityId}`, communityId: sub.communityId,
                });
                st.outcome = 'renewalFailed';
              }
            } else if (sub.status === 'trialing') {
              await endSubscription(ops, after, sub, 'expired', now, 'Thời gian dùng thử đã kết thúc. Hãy đăng ký gói để tiếp tục truy cập.');
              st.outcome = 'trialsExpired';
            } else if (sub.cancelAtPeriodEnd) {
              await endSubscription(ops, after, sub, 'canceled', now, 'Gói thành viên của bạn đã hết hạn theo yêu cầu hủy.');
              st.outcome = 'ended';
            } else if ((await ops.isBanned(sub.userId, sub.communityId)) || !(await ops.isEnrolled(sub.userId, sub.communityId))) {
              // Bị kick/cấm hoặc không còn là thành viên: không có quyền thì không trừ tiền.
              await endSubscription(ops, after, sub, 'canceled', now, 'Bạn không còn là thành viên của cộng đồng nên gói đã được hủy và sẽ không bị tính phí thêm.');
              st.outcome = 'ended';
            } else {
              const charge = await gateway.createCharge({
                amountCents: sub.priceCents,
                currency: 'usd',
                description: `Gia hạn gói ${sub.communityId}`,
                customerId: sub.userId,
                idempotencyKey: `${sub.id}:${sub.currentPeriodEnd}`,
                paymentToken: sub.paymentCardId ? (await ops.findCard(sub.paymentCardId))?.gatewayToken : undefined,
              });
              if (charge.ok) {
                await recordRenewal(ops, after, sub, charge.chargeId, now);
                st.outcome = 'renewed';
              } else {
                await ops.create({
                  communityId: sub.communityId,
                  userId: sub.userId,
                  method: 'stripe',
                  amountUsd: sub.priceCents / 100,
                  amountCents: sub.priceCents,
                  trialDays: 0,
                  interval: sub.interval,
                  paymentCardId: sub.paymentCardId,
                  kind: 'renewal',
                  status: 'failed',
                  subscriptionId: sub.id,
                });
                await endSubscription(ops, after, sub, 'expired', now);
                later(after, {
                  userId: sub.userId,
                  type: 'payment_failed',
                  title: 'Gia hạn thất bại',
                  body: 'Không thể trừ tiền gia hạn nên gói đã hết hiệu lực. Vui lòng đăng ký lại.',
                  link: `/courses/${sub.communityId}`,
                  communityId: sub.communityId,
                });
                st.outcome = 'renewalFailed';
              }
            }
          }, 30_000);
        } catch (err) {
          console.error('processDueSubscriptions: bỏ qua 1 gói do lỗi:', err);
          continue; // gói lỗi đã nằm trong `seen`, sang gói kế tiếp
        }
        if (!st.more) break;
        if (st.outcome) result[st.outcome]++;
      }
      return result;
    },

    // ----------------------------------------------------------------- đối soát (scheduler gọi; test gọi trực tiếp)
    /** Yêu cầu hoàn tiền kẹt ở `refunding`: gọi lại cổng với CÙNG idempotencyKey (không hoàn thêm) rồi chốt; cổng từ chối ⇒ về `pending`. */
    async reconcileStuckRefunds(opts: { olderThanMs?: number; limit?: number } = {}) {
      const out = { finalized: 0, reverted: 0, failed: 0 };
      const stuck = await repo.listStuckRefunds(new Date(Date.now() - (opts.olderThanMs ?? RECONCILE_AFTER_MS)), opts.limit ?? 50);
      for (const refund of stuck) {
        try {
          const payment = await repo.findById(refund.paymentId);
          if (!payment || payment.status !== 'succeeded') {
            // Giao dịch đã được chốt bằng đường khác: không để yêu cầu kẹt mãi.
            await repo.transitionRefund(refund.id, ['refunding'], { status: payment?.status === 'refunded' ? 'approved' : 'pending', refundingAt: null });
            out.reverted++;
            continue;
          }
          const r = await gateway.refund(payment.gatewayChargeId ?? '', refund.amountCents, refund.id);
          if (!r.ok) {
            await abortRefund(refund, false);
            out.reverted++;
            continue;
          }
          await inTx(async (ops, after) => {
            await ops.advisoryLock(`refund:${refund.paymentId}`);
            await applyRefund(ops, after, refund, refund.resolvedBy, ['refunding'], r.refundId);
          });
          out.finalized++;
        } catch (err) {
          console.error('reconcileStuckRefunds: bỏ qua 1 yêu cầu do lỗi:', err);
          out.failed++;
        }
      }
      return out;
    },

    /** Cổng đã trừ tiền (có gatewayChargeId) nhưng giao dịch vẫn `pending` (settle lỗi/process chết): hoàn tất settle (hoặc void nếu trùng). */
    async reconcileUnsettledCharges(opts: { olderThanMs?: number; limit?: number } = {}) {
      const out = { settled: 0, failed: 0 };
      for (const p of await repo.listUnsettledCharges(new Date(Date.now() - (opts.olderThanMs ?? RECONCILE_AFTER_MS)), opts.limit ?? 50)) {
        try {
          await settleAndVoid(p, p.gatewayChargeId!, false);
          out.settled++;
        } catch (err) {
          console.error('reconcileUnsettledCharges: bỏ qua 1 giao dịch do lỗi:', err);
          out.failed++;
        }
      }
      return out;
    },

    /** Khoản trừ trùng đã void trong DB nhưng cổng chưa hoàn xong: gọi lại (idempotent). */
    async reconcileVoidedCharges(opts: { olderThanMs?: number; limit?: number } = {}) {
      let refunded = 0;
      for (const p of await repo.listUnrefundedVoids(new Date(Date.now() - (opts.olderThanMs ?? RECONCILE_AFTER_MS)), opts.limit ?? 50)) {
        try {
          await refundVoidedCharge(p);
          refunded++;
        } catch (err) {
          console.error('reconcileVoidedCharges: bỏ qua 1 giao dịch do lỗi:', err);
        }
      }
      return { refunded };
    },

    /** Webhook kẹt (processing quá hạn / failed / received): xử lý lại từ payload đã lưu. */
    async reapStaleWebhooks(opts: { staleMs?: number; limit?: number } = {}) {
      const out = { replayed: 0, failed: 0 };
      const staleBefore = new Date(Date.now() - (opts.staleMs ?? WEBHOOK_PROCESSING_STALE_MS));
      for (const w of await repo.listReclaimableWebhooks(staleBefore, WEBHOOK_MAX_ATTEMPTS, opts.limit ?? 50)) {
        const parsed = webhookEventBody.safeParse(w.payload);
        if (!parsed.success) continue;
        try {
          const claim = await repo.claimWebhookEvent({ id: w.eventId }, staleBefore);
          if (!claim.claimed) continue; // bên khác đã nhận
          await runClaimedWebhook(parsed.data);
          out.replayed++;
        } catch {
          out.failed++;
        }
      }
      return out;
    },

    /** Gom mọi job đối soát tiền (scheduler gọi mỗi 5 phút). */
    async reconcileMoney() {
      const [refunds, charges, voids, webhooks] = [
        await service.reconcileStuckRefunds(),
        await service.reconcileUnsettledCharges(),
        await service.reconcileVoidedCharges(),
        await service.reapStaleWebhooks(),
      ];
      return { refunds, charges, voids, webhooks };
    },

    // ----------------------------------------------------------------- lịch sử & hóa đơn
    async myPayments(userId: string, page: number, limit: number) {
      const { items, total } = await repo.listByUser(userId, page, limit);
      const titles = new Map<string, string>();
      for (const id of new Set(items.map((p) => p.communityId))) titles.set(id, await courseTitle(id));
      const refunds = await refundStatuses(items.map((p) => p.id));
      const moduleTitles = await repo.moduleTitles([...new Set(items.flatMap((p) => (p.moduleId ? [p.moduleId] : [])))]);
      return {
        data: items.map((p) => ({ ...p, courseTitle: titles.get(p.communityId), ...(p.moduleId ? { moduleTitle: moduleTitles.get(p.moduleId) ?? null } : {}), refundStatus: refunds.get(p.id) ?? null })),
        meta: pageMeta(total, page, limit),
      };
    },

    async invoice(paymentId: string, userId: string) {
      const p = await service.getOrThrow(paymentId);
      // Chủ giao dịch, Owner cộng đồng đó hoặc Platform Admin.
      if (p.userId !== userId && !atLeast(await getRole(userId, p.communityId), 'owner')) throw HttpError.forbidden();
      if (!p.invoiceNumber) throw HttpError.conflict('Giao dịch này chưa có hóa đơn');
      const buyer = await fileUserRepository.findById(p.userId);
      const title = await courseTitle(p.communityId);
      const period = p.periodStart && p.periodEnd ? ` (${p.periodStart.slice(0, 10)} – ${p.periodEnd.slice(0, 10)})` : '';
      return {
        invoiceNumber: p.invoiceNumber,
        issuedAt: p.confirmedAt,
        status: p.status,
        currency: p.currency,
        buyer: { id: p.userId, name: buyer ? `${buyer.firstName} ${buyer.lastName}` : 'Thành viên SofinHub', email: buyer?.email },
        community: { id: p.communityId, title },
        items: [{ description: p.moduleId ? `Module "${(await repo.moduleTitles([p.moduleId])).get(p.moduleId) ?? p.moduleId}" — ${title}` : `Gói thành viên "${title}"${period}`, quantity: 1, unitCents: p.amountCents, amountCents: p.amountCents }],
        subtotalCents: p.amountCents,
        refundedCents: p.refundedCents,
        totalCents: p.amountCents,
        paymentId: p.id,
      };
    },

    // ----------------------------------------------------------------- hoàn tiền
    async requestRefund(paymentId: string, userId: string, reason: string, at = new Date()) {
      const pre = await service.getOrThrow(paymentId);
      if (pre.userId !== userId) throw HttpError.forbidden();
      // tx1: tạo yêu cầu; trong cửa sổ hoàn tiền thì khóa luôn sang `refunding` (cổng chưa bị gọi).
      const { refund, run } = await inTx(async (ops) => {
        await ops.advisoryLock(`refund:${paymentId}`); // 2 yêu cầu song song cho cùng giao dịch: chỉ 1 yêu cầu được tạo
        const p = await ops.findById(paymentId);
        if (!p) throw HttpError.notFound('Không tìm thấy giao dịch');
        if (p.status !== 'succeeded') throw HttpError.conflict('Chỉ giao dịch đã thanh toán thành công mới được hoàn tiền');
        if (await ops.findOpenRefundForPayment(p.id)) throw HttpError.conflict('Giao dịch này đã có yêu cầu hoàn tiền');

        const inWindow = at.getTime() - (await firstPaymentAt(ops, p)).getTime() <= cfg().payments.refundWindowDays * DAY_MS;
        const created = await ops.createRefund({
          paymentId: p.id,
          communityId: p.communityId,
          userId,
          amountCents: p.amountCents - p.refundedCents,
          reason,
          status: 'pending',
          auto: inWindow,
        });
        return inWindow ? { refund: await claimRefund(ops, created), run: true } : { refund: created, run: false };
      });
      if (!run) return refund;
      return finishRefund(refund, undefined, true);
    },

    async listRefunds(adminId: string, status: RefundRequest['status'] | undefined, page: number, limit: number) {
      await requireStaff(adminId);
      const { items, total } = await repo.listRefunds(status, page, limit);
      return { data: items, meta: pageMeta(total, page, limit) };
    },

    async resolveRefund(adminId: string, refundId: string, action: 'approve' | 'reject', note?: string) {
      await requireStaff(adminId);
      const refund = await repo.findRefund(refundId);
      if (!refund) throw HttpError.notFound('Không tìm thấy yêu cầu hoàn tiền');
      if (refund.status !== 'pending') throw HttpError.conflict('Yêu cầu này đã được xử lý');
      if (action === 'approve') {
        const claimed = await inTx(async (ops) => {
          await ops.advisoryLock(`refund:${refund.paymentId}`);
          return claimRefund(ops, refund, { note });
        });
        return finishRefund(claimed, adminId, false);
      }
      const rejected = await repo.transitionRefund(refund.id, ['pending'], { status: 'rejected', note, resolvedBy: adminId, resolvedAt: new Date().toISOString() });
      if (!rejected) throw HttpError.conflict('Yêu cầu này đã được xử lý');
      notify({
        userId: refund.userId,
        type: 'system',
        title: 'Yêu cầu hoàn tiền bị từ chối',
        body: note ? `Lý do: ${note}` : 'Yêu cầu hoàn tiền của bạn không được chấp nhận.',
        communityId: refund.communityId,
      });
      return rejected;
    },

    // ----------------------------------------------------------------- Admin đợt 2 (dùng bởi modules/admin/admin-payments.service.ts)
    /** Duyệt yêu cầu hoàn tiền, có thể hoàn MỘT PHẦN (amountCents < số tiền yêu cầu). */
    async adminApproveRefund(adminId: string, refundId: string, opts: { note?: string; amountCents?: number }) {
      const refund = await repo.findRefund(refundId);
      if (!refund) throw HttpError.notFound('Không tìm thấy yêu cầu hoàn tiền');
      if (refund.status !== 'pending') throw HttpError.conflict('Yêu cầu này đã được xử lý');
      const amount = opts.amountCents ?? refund.amountCents;
      if (amount < 1 || amount > refund.amountCents) throw HttpError.badRequest('Số tiền hoàn phải từ 1 cent tới số tiền yêu cầu');
      const claimed = await inTx(async (ops) => {
        await ops.advisoryLock(`refund:${refund.paymentId}`);
        return claimRefund(ops, refund, { note: opts.note, amountCents: amount });
      });
      return finishRefund(claimed, adminId, false);
    },

    /** Admin hoàn tiền trực tiếp 1 giao dịch (không cần khách yêu cầu, bỏ qua cửa sổ hoàn tiền). */
    async adminRefundPayment(adminId: string, paymentId: string, opts: { reason: string; amountCents?: number; note?: string }) {
      const claimed = await inTx(async (ops) => {
        await ops.advisoryLock(`refund:${paymentId}`);
        const p = await ops.findById(paymentId);
        if (!p) throw HttpError.notFound('Không tìm thấy giao dịch');
        if (p.status !== 'succeeded') throw HttpError.conflict('Chỉ giao dịch đã thanh toán thành công mới được hoàn tiền');
        if (await ops.findOpenRefundForPayment(p.id)) throw HttpError.conflict('Giao dịch này đang có yêu cầu hoàn tiền chờ xử lý — hãy duyệt ở mục Refunds');
        const remaining = p.amountCents - p.refundedCents;
        const amount = opts.amountCents ?? remaining;
        if (amount < 1 || amount > remaining) throw HttpError.badRequest('Số tiền hoàn phải từ 1 cent tới phần còn lại của giao dịch');
        const refund = await ops.createRefund({
          paymentId: p.id, communityId: p.communityId, userId: p.userId, amountCents: amount, reason: opts.reason, status: 'pending', auto: false, note: opts.note,
        });
        return claimRefund(ops, refund);
      });
      return finishRefund(claimed, adminId, true);
    },

    /** Chargeback thua: coi như tiền đã bị lấy lại — đánh dấu hoàn tiền + thu hồi quyền, KHÔNG gọi cổng. Giao dịch đã hoàn rồi thì bỏ qua. */
    async adminApplyChargebackLoss(adminId: string, paymentId: string, note: string) {
      return inTx(async (ops, after) => {
        await ops.advisoryLock(`refund:${paymentId}`);
        const p = await ops.findById(paymentId);
        if (!p || p.status !== 'succeeded') return false;
        const open = await ops.findOpenRefundForPayment(p.id);
        if (open) await ops.transitionRefund(open.id, ['pending', 'refunding'], { status: 'rejected', note: 'Thay bằng chargeback', resolvedBy: adminId, resolvedAt: new Date().toISOString() });
        const refund = await ops.createRefund({
          paymentId: p.id, communityId: p.communityId, userId: p.userId, amountCents: p.amountCents - p.refundedCents, reason: 'Chargeback', status: 'pending', auto: false, note,
        });
        await applyRefund(ops, after, refund, adminId, ['pending'], undefined, 'chargeback_after_payout');
        return true;
      });
    },

    /** Chạy lại thanh toán thất bại (chỉ lần thanh toán đầu). Cổng mock: thành công => kích hoạt gói như confirm. */
    async adminRetryPayment(paymentId: string) {
      const p = await service.getOrThrow(paymentId);
      if (p.status !== 'failed') throw HttpError.conflict('Chỉ giao dịch thất bại mới thử lại được');
      if (p.kind !== 'initial') throw HttpError.conflict('Chỉ thử lại được giao dịch thanh toán lần đầu; gia hạn do hệ thống tự chạy');
      const course = await catalogService.getById(p.communityId);
      if (course.locked) throw locked();
      const moved = await repo.transition(p.id, ['failed'], { status: 'pending' });
      if (!moved) throw HttpError.conflict('Giao dịch đã được xử lý');
      const charge = await gateway.createCharge({
        amountCents: p.amountCents,
        currency: 'usd',
        description: `Gói thành viên ${course.title}`,
        customerId: p.userId,
        idempotencyKey: `${p.id}:admin-retry:${Date.now()}`,
      });
      if (!charge.ok) {
        await failPayment(moved, charge.failureReason ?? 'declined');
        return (await repo.findById(p.id))!;
      }
      await repo.transition(p.id, ['pending'], { gatewayChargeId: charge.chargeId });
      return settleAndVoid(moved, charge.chargeId, false);
    },

    /** Admin đổi trạng thái gói: pause / resume / cancel (tức thì hoặc cuối kỳ). Thông báo cho người dùng. */
    async adminSubscriptionAction(subId: string, action: 'pause' | 'resume' | 'cancel', opts: { atPeriodEnd?: boolean; reason?: string }) {
      const now = new Date();
      const title = await courseTitle((await repo.findSubscription(subId))?.communityId ?? '');
      try {
        return await inTx(async (ops, after) => {
          const sub = await ops.findSubscription(subId);
          if (!sub) throw HttpError.notFound('Không tìm thấy gói thành viên');
          const tell = (t: string, body: string) => later(after, { userId: sub.userId, type: 'system', title: t, body, link: `/courses/${sub.communityId}`, communityId: sub.communityId });
          if (action === 'pause') {
            if (!['trialing', 'active', 'past_due'].includes(sub.status)) throw HttpError.conflict('Chỉ tạm dừng được gói đang hoạt động');
            await ops.updateSubscription(sub.id, { status: 'paused' });
            await ops.revokeAccess(sub.userId, sub.communityId);
            tell('Gói thành viên bị tạm dừng', `Gói của bạn ở ${title} đã bị tạm dừng${opts.reason ? ` (${opts.reason})` : ''}.`);
          } else if (action === 'resume') {
            if (!['paused', 'past_due'].includes(sub.status)) throw HttpError.conflict('Chỉ tiếp tục được gói đang tạm dừng hoặc quá hạn');
            if (await ops.isBanned(sub.userId, sub.communityId)) throw HttpError.conflict('Người dùng đang bị cấm khỏi cộng đồng này');
            const expired = new Date(sub.currentPeriodEnd) <= now;
            await ops.updateSubscription(sub.id, {
              status: 'active',
              cancelAtPeriodEnd: false,
              ...(expired ? { currentPeriodStart: now.toISOString(), currentPeriodEnd: addDays(now, periodDaysFor(sub.interval)).toISOString() } : {}),
            });
            await ops.grantAccess(sub.userId, sub.communityId);
            tell('Gói thành viên đã hoạt động lại', `Gói của bạn ở ${title} đã được kích hoạt lại.`);
          } else if (opts.atPeriodEnd) {
            if (!['trialing', 'active'].includes(sub.status)) throw HttpError.conflict('Chỉ hủy cuối kỳ được gói đang hoạt động');
            if (sub.cancelAtPeriodEnd) throw HttpError.conflict('Gói đã được đặt hủy cuối kỳ');
            await ops.updateSubscription(sub.id, { cancelAtPeriodEnd: true, canceledAt: now.toISOString() });
            tell('Gói thành viên sẽ kết thúc cuối kỳ', `Gói của bạn ở ${title} sẽ không gia hạn.`);
          } else {
            if (!['trialing', 'active', 'past_due', 'paused'].includes(sub.status)) throw HttpError.conflict('Gói đã kết thúc');
            await endSubscription(ops, after, sub, 'canceled', now, `Gói thành viên của bạn ở ${title} đã bị hủy bởi quản trị viên.`);
          }
          return (await ops.findSubscription(sub.id))!;
        });
      } catch (e) {
        // Tiếp tục gói khi user đã có gói active/trialing khác (unique index một gói sống / user / cộng đồng).
        if (isUniqueViolation(e)) throw HttpError.conflict('Người dùng đã có một gói khác đang hoạt động ở cộng đồng này');
        throw e;
      }
    },

    // ----------------------------------------------------------------- webhook
    /**
     * Xác thực chữ ký trên RAW body rồi xử lý. Sai chữ ký/replay → 400 chung chung (không lộ chi tiết).
     * Mỗi event có trạng thái received → processing → done|failed (kèm type + payload + attempts). `duplicate` chỉ khi đã `done` hoặc
     * đang `processing` còn mới; failed / processing quá hạn (process chết) được nhận xử lý lại — ngay lúc cổng gửi lại hoặc bởi `reapStaleWebhooks`.
     */
    async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
      if (!rawBody || !gateway.verifyWebhookSignature(rawBody, signature)) throw HttpError.badRequest('Yêu cầu không hợp lệ');
      let json: unknown;
      try {
        json = JSON.parse(rawBody.toString('utf8'));
      } catch {
        throw HttpError.badRequest('Yêu cầu không hợp lệ');
      }
      const event = webhookEventBody.parse(json);

      const claim = await repo.claimWebhookEvent({ id: event.id, type: event.type, payload: json }, new Date(Date.now() - WEBHOOK_PROCESSING_STALE_MS));
      if (!claim.claimed) return { received: true, duplicate: true };
      return runClaimedWebhook(event);
    },

    // ----------------------------------------------------------------- doanh thu & payout
    /** Số dư của 1 cộng đồng theo chính sách rút tiền hiện hành (dùng cho owner revenue + admin). */
    async balanceFor(communityId: string, now = new Date()) {
      const policy = payoutPolicy(now);
      const figures = await repo.balance(communityId, revenueRates(), { eligibleBefore: policy.eligibleBefore });
      return { ...balanceView(figures, policy.reservePct), requested: figures.requested, net: figures.net, eligible: figures.eligible, policy };
    },

    async revenue(communityId: string, userId: string, q: { from?: string; to?: string }) {
      await catalogService.getById(communityId);
      await requireRole(userId, communityId, 'owner'); // Admin/Mod cộng đồng mặc định KHÔNG xem được doanh thu (và cộng đồng bị khóa thì không ai ngoài Platform Admin)

      const from = q.from ? new Date(q.from) : undefined;
      // `to` dạng ngày (YYYY-MM-DD) tính hết ngày đó.
      const to = q.to ? new Date(new Date(q.to).getTime() + (q.to.length === 10 ? DAY_MS - 1 : 0)) : undefined;
      const rates = revenueRates();
      // Toàn bộ là aggregate SQL (SUM/COUNT/FILTER) — không load giao dịch vào bộ nhớ (trừ 20 dòng gần nhất).
      const [sum, bal, subs, recent] = await Promise.all([
        repo.revenueTotals(communityId, { from, to }, rates),
        service.balanceFor(communityId),
        repo.subscriptionStats(communityId),
        repo.recentPaid(communityId, 20),
      ]);
      return {
        currency: 'usd',
        range: { from: q.from ?? null, to: q.to ?? null },
        grossCents: sum.grossCents,
        refundsCents: sum.refundsCents,
        platformCommissionCents: sum.platformCommissionCents,
        gatewayFeeCents: sum.gatewayFeeCents,
        netCents: sum.netCents,
        // Số dư KHẢ DỤNG ĐỂ RÚT (toàn thời gian, không phụ thuộc from/to): phần đã qua cửa sổ hoàn tiền + tranh chấp, trừ reserve và payout đã yêu cầu; 0 nếu còn nợ.
        availableBalanceCents: bal.withdrawable,
        payoutRequestedCents: bal.requested,
        // --- thêm mới (chỉ thêm): phân rã số dư ---
        totalBalanceCents: bal.total, // net − payout đã yêu cầu (có thể âm = còn nợ)
        heldCents: bal.held, // còn trong holding period
        reserveCents: bal.reserve, // rolling reserve
        debtCents: bal.debt, // nợ do hoàn tiền/chargeback sau khi đã rút
        payoutPolicy: {
          holdDays: bal.policy.holdDays,
          refundWindowDays: bal.policy.refundWindowDays,
          disputeWindowDays: bal.policy.disputeWindowDays,
          reservePct: bal.policy.reservePct,
          note: 'Giá trị tạm chờ chủ sở hữu chốt (cấu hình ở Global Settings)',
        },
        activePaidMembers: subs.active,
        trialingMembers: subs.trialing,
        mrrCents: subs.mrrCents,
        assumptions: {
          platformCommissionPct: cfg().payments.commissionPct,
          gatewayFeePct: cfg().payments.gatewayFeePct,
          gatewayFeeFixedCents: cfg().payments.gatewayFeeFixedCents,
          note: 'Giá trị tạm chờ chốt mô hình doanh thu (PLAN.md câu hỏi #6)',
        },
        recentTransactions: recent.map((p) => ({
          id: p.id,
          userId: p.userId,
          kind: p.kind,
          status: p.status,
          amountCents: p.amountCents,
          refundedCents: p.refundedCents,
          invoiceNumber: p.invoiceNumber,
          confirmedAt: p.confirmedAt,
        })),
      };
    },

    async requestPayout(communityId: string, userId: string, body: { amountCents: number; method?: { type: 'bank'; bankName: string; accountNumber: string; accountHolder: string } }) {
      await catalogService.getById(communityId);
      // Chỉ chính Owner mới đặt lệnh rút (Platform Admin không tạo lệnh rút thay Owner).
      if (!(await isCommunityOwner(userId, communityId))) throw HttpError.forbidden('Chỉ chủ cộng đồng mới được yêu cầu rút tiền');
      if ((await repo.courseState(communityId)).locked) throw locked(); // cộng đồng bị khóa: owner không được rút tiền
      // Wizard: "Bỏ qua, làm sau" cho phép publish nhưng chặn rút tiền cho tới khi kết nối tài khoản. Cộng đồng tạo kiểu cũ (không có bản ghi) giữ luồng cũ.
      const account = await repo.findPayoutAccount(communityId);
      if (account?.status === 'skipped') {
        throw HttpError.coded(400, 'PAYOUT_ACCOUNT_REQUIRED', 'Hãy kết nối tài khoản nhận tiền (Cài đặt › Thanh toán) trước khi rút tiền');
      }
      const target = body.method
        ? { bankName: body.method.bankName, accountHolder: body.method.accountHolder, accountLast4: body.method.accountNumber.slice(-4) }
        : account?.status === 'connected' && account.bankName && account.accountHolder && account.accountLast4
          ? { bankName: account.bankName, accountHolder: account.accountHolder, accountLast4: account.accountLast4 }
          : undefined;
      if (!target) throw HttpError.coded(400, 'PAYOUT_ACCOUNT_REQUIRED', 'Thiếu thông tin tài khoản nhận tiền');
      const minCents = toCents(cfg().payments.payoutMinUsd);
      if (body.amountCents < minCents) throw HttpError.badRequest(`Số tiền rút tối thiểu là ${(minCents / 100).toFixed(2)} USD`);

      // Khóa hàng Course (FOR UPDATE) rồi tính số dư + tạo payout trong cùng transaction ⇒ các lệnh rút song song của cùng
      // cộng đồng chạy tuần tự, lệnh sau thấy số dư đã trừ lệnh trước.
      const payout = await repo.transaction(async (ops) => {
        await ops.lockCourse(communityId);
        const policy = payoutPolicy();
        const view = balanceView(await ops.balance(communityId, revenueRates(), { eligibleBefore: policy.eligibleBefore }), policy.reservePct);
        if (view.debt > 0) {
          throw HttpError.coded(400, 'PAYOUT_BLOCKED', `Số dư ròng đang âm (còn nợ ${(view.debt / 100).toFixed(2)} USD do hoàn tiền sau khi đã rút) — chưa thể rút thêm`);
        }
        if (body.amountCents > view.withdrawable) {
          throw HttpError.coded(
            400,
            'PAYOUT_EXCEEDS_AVAILABLE',
            `Số tiền rút vượt quá số dư có thể rút (${(view.withdrawable / 100).toFixed(2)} USD). Tiền mới chỉ rút được sau ${policy.holdDays} ngày và luôn giữ lại ${policy.reservePct}% làm dự phòng.`,
          );
        }
        return ops.createPayout({
          communityId,
          ownerId: userId,
          amountCents: body.amountCents,
          method: { type: 'bank', ...target },
          status: 'requested',
        });
      });
      return payoutView(payout);
    },

    async listPayouts(communityId: string, userId: string, page: number, limit: number) {
      await catalogService.getById(communityId);
      await requireRole(userId, communityId, 'owner');
      const { items, total } = await repo.listPayouts({ communityId }, page, limit);
      return { data: items.map(payoutView), meta: pageMeta(total, page, limit) };
    },

    async adminListPayouts(adminId: string, status: Payout['status'] | undefined, page: number, limit: number) {
      await requireStaff(adminId);
      const { items, total } = await repo.listPayouts({ status }, page, limit);
      return { data: items.map(payoutView), meta: pageMeta(total, page, limit) };
    },

    async resolvePayout(adminId: string, payoutId: string, action: 'approve' | 'mark_paid' | 'reject', note?: string) {
      await requireStaff(adminId);
      // Mỗi hành động là một chuyển trạng thái CÓ ĐIỀU KIỆN trong DB (không đọc-rồi-ghi) nên xử lý đồng thời chỉ một bên thắng.
      const conflict = async (message: string): Promise<never> => {
        if (!(await repo.findPayout(payoutId))) throw HttpError.notFound('Không tìm thấy yêu cầu rút tiền');
        throw HttpError.conflict(message);
      };
      if (action === 'approve') {
        const u = await repo.transitionPayout(payoutId, ['requested'], { status: 'approved', note });
        if (!u) return conflict('Chỉ duyệt được yêu cầu đang chờ');
        notifyPayout(u, 'Yêu cầu rút tiền đã được duyệt', `Yêu cầu rút ${(u.amountCents / 100).toFixed(2)} USD đã được duyệt và sẽ được chuyển khoản.`);
        return payoutView(u);
      }
      if (action === 'mark_paid') {
        const u = await repo.transitionPayout(payoutId, ['approved', 'requested'], { status: 'paid', note });
        if (!u) return conflict('Yêu cầu không ở trạng thái có thể đánh dấu đã chi');
        notifyPayout(u, 'Đã chuyển tiền', `${(u.amountCents / 100).toFixed(2)} USD đã được chuyển vào tài khoản ****${u.method.accountLast4}.`);
        return payoutView(u);
      }
      // reject: hoàn lại số dư vì payout bị loại khỏi phần đã yêu cầu
      const u = await repo.transitionPayout(payoutId, ['requested', 'approved'], { status: 'rejected', note });
      if (!u) return conflict('Yêu cầu đã được xử lý xong');
      notifyPayout(u, 'Yêu cầu rút tiền bị từ chối', note ? `Lý do: ${note}` : `Yêu cầu rút ${(u.amountCents / 100).toFixed(2)} USD không được chấp nhận.`);
      return payoutView(u);
    },
  };
  return service;
}

export const paymentsService = createPaymentsService();
