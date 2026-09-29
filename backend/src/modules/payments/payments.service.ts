import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { fileUserRepository } from '../auth/auth.repository.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { getRole, atLeast, isCourseOwner, requirePlatformAdmin, requireRole } from '../permissions/policy.js';
import { paymentGateway, type PaymentGateway } from './payments.gateway.js';
import { isUniqueViolation, paymentsRepository, type PaymentsOps, type PaymentsRepository, type RevenueRates } from './payments.repository.js';
import { webhookEventBody } from './payments.schema.js';
import type { PaymentIntent, PaymentMethod, Payout, RefundRequest, Subscription } from './payments.types.js';

const DAY_MS = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const toCents = (usd: number) => Math.round(usd * 100);
/** Phần trăm (có thể lẻ, vd. 2.9) → basis point nguyên để tính bằng số nguyên (cả trong SQL). */
const bp = (pct: number) => Math.round(pct * 100);

const revenueRates = (): RevenueRates => ({
  commissionBp: bp(env.PLATFORM_COMMISSION_PCT),
  gatewayFeeBp: bp(env.GATEWAY_FEE_PCT),
  gatewayFeeFixedCents: env.GATEWAY_FEE_FIXED_CENTS,
});

function pageMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

type NotifyInput = Parameters<typeof notify>[0];
/** Thông báo chỉ phát SAU khi transaction commit (rollback thì không có thông báo "ma"). */
type After = Array<() => void>;
const later = (after: After, input: NotifyInput) =>
  after.push(() => {
    try {
      void Promise.resolve(notify(input)).catch(() => undefined);
    } catch {
      /* thông báo lỗi không được làm hỏng luồng tiền */
    }
  });

export function createPaymentsService(repo: PaymentsRepository = paymentsRepository, gateway: PaymentGateway = paymentGateway) {
  /** Chạy trong 1 transaction DB; thông báo gom lại và phát sau commit. */
  async function inTx<T>(fn: (ops: PaymentsOps, after: After) => Promise<T>, timeoutMs?: number): Promise<T> {
    const after: After = [];
    const result = await repo.transaction((ops) => fn(ops, after), { timeoutMs });
    for (const f of after) f();
    return result;
  }

  async function courseTitle(courseId: string) {
    try {
      return (await courseService.getById(courseId)).title;
    } catch {
      return courseId;
    }
  }

  function subscriptionView(sub: Subscription, title?: string) {
    return { ...sub, courseTitle: title, accessUntil: sub.status === 'active' || sub.status === 'trialing' ? sub.currentPeriodEnd : null };
  }

  // Cùng instance: 2 confirm song song dùng chung 1 promise (cổng chỉ bị gọi 1 lần). Khác instance: idempotencyKey gửi cổng +
  // transition có điều kiện trong DB đảm bảo chỉ 1 bên ghi nhận (hóa đơn, gói, quyền truy cập).
  const inflightConfirm = new Map<string, Promise<PaymentIntent>>();

  /**
   * Đánh dấu thanh toán thành công + số hóa đơn + tạo/gia hạn gói + cấp quyền — MỘT transaction.
   * Nguyên tử theo trạng thái 'pending': bên thua cuộc (double-confirm / webhook trùng) nhận lại bản ghi đã xử lý.
   */
  async function settle(intent: PaymentIntent, chargeId: string): Promise<PaymentIntent> {
    return inTx(async (ops, after) => {
      const at = new Date();
      // Tuần tự hóa theo (user, khóa học) để 2 giao dịch khác nhau của cùng người không tạo 2 gói active.
      await ops.advisoryLock(`sub:${intent.userId}:${intent.courseId}`);
      const done = await ops.transition(intent.id, ['pending'], {
        status: 'succeeded',
        confirmedAt: at.toISOString(),
        gatewayChargeId: chargeId,
      });
      if (!done) return (await ops.findById(intent.id))!; // đã xử lý trước đó

      const invoiceNumber = await ops.nextInvoiceNumber(at.getUTCFullYear());
      const periodEnd = addDays(at, env.SUBSCRIPTION_PERIOD_DAYS);
      let sub = await ops.findSubscriptionFor(intent.userId, intent.courseId);
      if (sub && (sub.status === 'trialing' || sub.status === 'active')) {
        // Chuyển từ dùng thử sang trả phí (hoặc gia hạn thủ công): bắt đầu kỳ mới từ bây giờ.
        sub = await ops.updateSubscription(sub.id, {
          status: 'active',
          priceCents: intent.amountCents,
          currentPeriodStart: at.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          cancelAtPeriodEnd: false,
        });
      } else {
        sub = await ops.createSubscription({
          userId: intent.userId,
          courseId: intent.courseId,
          status: 'active',
          priceCents: intent.amountCents,
          currentPeriodStart: at.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          cancelAtPeriodEnd: false,
        });
      }
      const final = await ops.transition(intent.id, ['succeeded'], {
        invoiceNumber,
        subscriptionId: sub!.id,
        periodStart: at.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      // Bị cấm sau khi tạo giao dịch: vẫn ghi nhận thanh toán (có thể hoàn tiền) nhưng không cấp quyền.
      if (!(await ops.isBanned(intent.userId, intent.courseId))) await ops.grantAccess(intent.userId, intent.courseId);
      later(after, {
        userId: intent.userId,
        type: 'payment_succeeded',
        title: 'Thanh toán thành công',
        body: `Bạn đã thanh toán ${(intent.amountCents / 100).toFixed(2)} USD. Hóa đơn ${invoiceNumber}.`,
        link: `/courses/${intent.courseId}/community`,
        courseId: intent.courseId,
      });
      return final!;
    });
  }

  async function failPayment(intent: PaymentIntent, reason: string) {
    const failed = await repo.transition(intent.id, ['pending'], { status: 'failed' });
    if (failed) {
      notify({
        userId: intent.userId,
        type: 'payment_failed',
        title: 'Thanh toán thất bại',
        body: `Giao dịch không thành công (${reason}). Vui lòng thử lại hoặc dùng phương thức khác.`,
        link: `/courses/${intent.courseId}`,
        courseId: intent.courseId,
      });
    }
    return failed;
  }

  /** Tạo giao dịch gia hạn đã thành công (scheduler sau khi cổng trừ tiền OK, hoặc webhook subscription.renewed). Chạy trong transaction của caller. */
  async function recordRenewal(ops: PaymentsOps, after: After, sub: Subscription, chargeId: string, at: Date) {
    const start = new Date(sub.currentPeriodEnd);
    const end = addDays(start, env.SUBSCRIPTION_PERIOD_DAYS);
    const invoiceNumber = await ops.nextInvoiceNumber(at.getUTCFullYear());
    const payment = await ops.create({
      courseId: sub.courseId,
      userId: sub.userId,
      method: 'stripe',
      amountUsd: sub.priceCents / 100,
      amountCents: sub.priceCents,
      trialDays: 0,
      kind: 'renewal',
      status: 'succeeded',
      confirmedAt: at.toISOString(),
      subscriptionId: sub.id,
      gatewayChargeId: chargeId,
      invoiceNumber,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
    await ops.updateSubscription(sub.id, {
      status: 'active',
      currentPeriodStart: start.toISOString(),
      currentPeriodEnd: end.toISOString(),
    });
    later(after, {
      userId: sub.userId,
      type: 'payment_succeeded',
      title: 'Gia hạn gói thành công',
      body: `Gói của bạn được gia hạn đến ${end.toISOString().slice(0, 10)}. Hóa đơn ${invoiceNumber}.`,
      link: `/courses/${sub.courseId}/community`,
      courseId: sub.courseId,
    });
    return payment;
  }

  /** Kết thúc gói + thu hồi quyền (cùng transaction của caller). */
  async function endSubscription(ops: PaymentsOps, after: After, sub: Subscription, status: 'canceled' | 'expired', at: Date, why?: string) {
    await ops.updateSubscription(sub.id, { status, canceledAt: at.toISOString(), cancelAtPeriodEnd: false });
    await ops.revokeAccess(sub.userId, sub.courseId);
    if (why) {
      later(after, {
        userId: sub.userId,
        type: 'system',
        title: 'Gói thành viên đã kết thúc',
        body: why,
        link: `/courses/${sub.courseId}`,
        courseId: sub.courseId,
      });
    }
  }

  /**
   * Hoàn tiền thật, MỘT transaction: chuyển giao dịch succeeded→refunded có điều kiện (bên thua nhận 409, cổng không bị gọi 2 lần),
   * gọi cổng (trừ khi cổng đã hoàn rồi — webhook; cổng từ chối ⇒ rollback toàn bộ), duyệt yêu cầu, thu hồi quyền nếu là kỳ hiện tại.
   */
  async function executeRefund(ops: PaymentsOps, after: After, refund: RefundRequest, resolvedBy: string | undefined, opts: { callGateway: boolean }) {
    const payment = await ops.findById(refund.paymentId);
    if (!payment || payment.status !== 'succeeded') throw HttpError.conflict('Giao dịch không còn ở trạng thái có thể hoàn tiền');
    const done = await ops.transition(payment.id, ['succeeded'], { status: 'refunded', refundedCents: refund.amountCents });
    if (!done) throw HttpError.conflict('Giao dịch đã được xử lý');
    if (opts.callGateway) {
      const r = await gateway.refund(payment.gatewayChargeId ?? '', refund.amountCents);
      if (!r.ok) throw new HttpError(502, 'GATEWAY_ERROR', 'Cổng thanh toán từ chối hoàn tiền, vui lòng thử lại sau');
    }
    const at = new Date();
    const updated = await ops.transitionRefund(refund.id, ['pending'], { status: 'approved', resolvedBy, resolvedAt: at.toISOString(), note: refund.note });
    if (!updated) throw HttpError.conflict('Yêu cầu này đã được xử lý');

    // Thu hồi quyền nếu giao dịch này là kỳ đang hiệu lực của gói.
    if (payment.subscriptionId) {
      const sub = await ops.findSubscription(payment.subscriptionId);
      if (sub && (sub.status === 'active' || sub.status === 'trialing') && sub.currentPeriodEnd === payment.periodEnd) {
        await endSubscription(ops, after, sub, 'canceled', at);
      }
    }
    later(after, {
      userId: refund.userId,
      type: 'system',
      title: 'Hoàn tiền thành công',
      body: `Đã hoàn ${(refund.amountCents / 100).toFixed(2)} USD cho giao dịch của bạn.`,
      link: `/courses/${refund.courseId}`,
      courseId: refund.courseId,
    });
    return updated;
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
    notify({ userId: p.ownerId, type: 'system', title, body, link: `/courses/${p.courseId}/revenue`, courseId: p.courseId });
  }

  async function idempotentReplay(userId: string, courseId: string, key: string) {
    const existingId = await repo.findIdempotent(userId, key);
    if (!existingId) return undefined;
    const existing = await repo.findById(existingId);
    if (existing && existing.courseId !== courseId) throw HttpError.conflict('Idempotency-Key này đã được dùng cho giao dịch khác');
    return existing;
  }

  const service = {
    // ----------------------------------------------------------------- checkout (giữ tương thích FE cũ)
    async checkout(courseId: string, userId: string, method: PaymentMethod, idempotencyKey?: string) {
      const course = await courseService.getById(courseId);
      if (course.priceUsd <= 0) throw HttpError.badRequest('Khóa học này miễn phí, không cần thanh toán');

      // Cùng Idempotency-Key → trả lại đúng giao dịch cũ, không tạo giao dịch thứ hai.
      if (idempotencyKey) {
        const replay = await idempotentReplay(userId, courseId, idempotencyKey);
        if (replay) return replay;
      }

      const sub = await repo.findSubscriptionFor(userId, courseId);
      const trialing = sub?.status === 'trialing';
      if ((await enrollmentService.isEnrolled(userId, courseId)) && !trialing) throw HttpError.conflict('Bạn đã tham gia khóa học này rồi');

      try {
        // Giá luôn lấy từ server, không nhận số tiền từ client. Giao dịch + khóa idempotency cùng commit: 2 request song song
        // cùng key ⇒ một bên vi phạm unique (userId,key) ⇒ rollback ⇒ trả giao dịch của bên thắng.
        return await repo.transaction(async (ops) => {
          const intent = await ops.create({
            courseId,
            userId,
            method,
            amountUsd: course.priceUsd,
            amountCents: toCents(course.priceUsd),
            trialDays: env.TRIAL_DAYS,
          });
          if (idempotencyKey) await ops.saveIdempotent(userId, idempotencyKey, intent.id);
          return intent;
        });
      } catch (e) {
        if (idempotencyKey && isUniqueViolation(e)) {
          const replay = await idempotentReplay(userId, courseId, idempotencyKey);
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
     */
    async confirm(paymentIntentId: string, userId: string): Promise<PaymentIntent> {
      const intent = await service.getOrThrow(paymentIntentId);
      if (intent.userId !== userId) throw HttpError.forbidden();
      if (intent.status === 'succeeded' || intent.status === 'refunded') return intent;
      if (intent.status === 'failed') throw HttpError.conflict('Giao dịch đã thất bại, vui lòng tạo giao dịch mới');

      const running = inflightConfirm.get(intent.id);
      if (running) return running;

      const job = (async () => {
        if (await enrollmentService.isBanned(userId, intent.courseId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
        const sub = await repo.findSubscriptionFor(userId, intent.courseId);
        if ((await enrollmentService.isEnrolled(userId, intent.courseId)) && sub?.status !== 'trialing') {
          throw HttpError.conflict('Bạn đã tham gia khóa học này rồi');
        }
        const course = await courseService.getById(intent.courseId);
        const charge = await gateway.createCharge({
          amountCents: intent.amountCents,
          currency: 'usd',
          description: `Gói thành viên ${course.title}`,
          customerId: userId,
          idempotencyKey: intent.id,
        });
        if (!charge.ok) {
          await failPayment(intent, charge.failureReason ?? 'declined');
          throw new HttpError(402, 'PAYMENT_FAILED', 'Thanh toán không thành công, vui lòng thử lại hoặc dùng phương thức khác');
        }
        return settle(intent, charge.chargeId);
      })().finally(() => inflightConfirm.delete(intent.id));
      inflightConfirm.set(intent.id, job);
      return job;
    },

    async statusFor(courseId: string, userId: string) {
      const enrolled = await enrollmentService.isEnrolled(userId, courseId);
      const latest = await repo.findLatestForUser(courseId, userId);
      const sub = await repo.findSubscriptionFor(userId, courseId);
      return { enrolled, latestPayment: latest, subscription: sub ? subscriptionView(sub) : null };
    },

    // ----------------------------------------------------------------- gói thành viên
    async mySubscriptions(userId: string) {
      const subs = await repo.listSubscriptionsByUser(userId);
      return Promise.all(subs.map(async (s) => subscriptionView(s, await courseTitle(s.courseId))));
    },

    async startTrial(courseId: string, userId: string, at = new Date()) {
      const course = await courseService.getById(courseId);
      if (course.priceUsd <= 0) throw HttpError.badRequest('Cộng đồng miễn phí không có dùng thử');
      if (await enrollmentService.isEnrolled(userId, courseId)) throw HttpError.conflict('Bạn đã tham gia cộng đồng này rồi');
      if (await repo.hasHadTrial(userId, courseId)) throw HttpError.conflict('Bạn đã dùng thử cộng đồng này rồi');
      const end = addDays(at, env.TRIAL_DAYS);
      const sub = await inTx(async (ops, after) => {
        await ops.advisoryLock(`sub:${userId}:${courseId}`);
        if (await ops.hasHadTrial(userId, courseId)) throw HttpError.conflict('Bạn đã dùng thử cộng đồng này rồi'); // đua với request song song
        const created = await ops.createSubscription({
          userId,
          courseId,
          status: 'trialing',
          priceCents: toCents(course.priceUsd),
          currentPeriodStart: at.toISOString(),
          currentPeriodEnd: end.toISOString(),
          cancelAtPeriodEnd: false,
          trialEndsAt: end.toISOString(),
        });
        await ops.grantAccess(userId, courseId); // 403 nếu đang bị cấm ⇒ rollback cả gói dùng thử
        later(after, {
          userId,
          type: 'system',
          title: 'Bắt đầu dùng thử',
          body: `Bạn được dùng thử "${course.title}" đến ${end.toISOString().slice(0, 10)}.`,
          link: `/courses/${courseId}/community`,
          courseId,
        });
        return created;
      });
      return subscriptionView(sub, course.title);
    },

    async cancelSubscription(courseId: string, userId: string, atPeriodEnd: boolean, at = new Date()) {
      const sub = await repo.findSubscriptionFor(userId, courseId);
      if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) throw HttpError.notFound('Bạn không có gói thành viên đang hoạt động ở cộng đồng này');
      if (atPeriodEnd) {
        const updated = await repo.updateSubscription(sub.id, { cancelAtPeriodEnd: true, canceledAt: at.toISOString() });
        return subscriptionView(updated!);
      }
      await inTx((ops, after) => endSubscription(ops, after, sub, 'canceled', at, 'Gói thành viên của bạn đã được hủy và quyền truy cập đã bị thu hồi.'));
      return subscriptionView((await repo.findSubscription(sub.id))!);
    },

    async resumeSubscription(courseId: string, userId: string, at = new Date()) {
      const sub = await repo.findSubscriptionFor(userId, courseId);
      if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) throw HttpError.notFound('Bạn không có gói thành viên đang hoạt động ở cộng đồng này');
      if (!sub.cancelAtPeriodEnd) throw HttpError.conflict('Gói này không ở trạng thái hủy cuối kỳ');
      if (new Date(sub.currentPeriodEnd) <= at) throw HttpError.conflict('Gói đã hết kỳ, không thể tiếp tục');
      const updated = await repo.updateSubscription(sub.id, { cancelAtPeriodEnd: false, canceledAt: null });
      return subscriptionView(updated!);
    },

    /**
     * Xử lý gói đến hạn (scheduler gọi mỗi 5 phút): hết dùng thử → expired; đã hủy-cuối-kỳ → canceled; còn lại gia hạn
     * (tạo giao dịch mới mỗi kỳ, mỗi lần chạy tiến 1 kỳ). Thẻ bị từ chối → expired + thu hồi quyền.
     *
     * Mỗi gói được xử lý trong MỘT transaction riêng, chọn bằng `FOR UPDATE SKIP LOCKED`: nhiều instance/lượt chạy song song
     * không bao giờ xử lý cùng một gói (bên chậm hơn bỏ qua gói đang bị khóa, hoặc thấy nó đã hết hạn-xử-lý sau khi bên kia commit).
     * Lỗi ở một gói (vd. cổng lỗi mạng) chỉ rollback gói đó, các gói khác vẫn được xử lý; lần chạy sau thử lại.
     */
    async processDueSubscriptions(now = new Date()) {
      const result = { renewed: 0, renewalFailed: 0, trialsExpired: 0, ended: 0 };
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
            if (sub.status === 'trialing') {
              await endSubscription(ops, after, sub, 'expired', now, 'Thời gian dùng thử đã kết thúc. Hãy đăng ký gói để tiếp tục truy cập.');
              st.outcome = 'trialsExpired';
            } else if (sub.cancelAtPeriodEnd) {
              await endSubscription(ops, after, sub, 'canceled', now, 'Gói thành viên của bạn đã hết hạn theo yêu cầu hủy.');
              st.outcome = 'ended';
            } else {
              const charge = await gateway.createCharge({
                amountCents: sub.priceCents,
                currency: 'usd',
                description: `Gia hạn gói ${sub.courseId}`,
                customerId: sub.userId,
                idempotencyKey: `${sub.id}:${sub.currentPeriodEnd}`,
              });
              if (charge.ok) {
                await recordRenewal(ops, after, sub, charge.chargeId, now);
                st.outcome = 'renewed';
              } else {
                await ops.create({
                  courseId: sub.courseId,
                  userId: sub.userId,
                  method: 'stripe',
                  amountUsd: sub.priceCents / 100,
                  amountCents: sub.priceCents,
                  trialDays: 0,
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
                  link: `/courses/${sub.courseId}`,
                  courseId: sub.courseId,
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

    // ----------------------------------------------------------------- lịch sử & hóa đơn
    async myPayments(userId: string, page: number, limit: number) {
      const { items, total } = await repo.listByUser(userId, page, limit);
      const titles = new Map<string, string>();
      for (const id of new Set(items.map((p) => p.courseId))) titles.set(id, await courseTitle(id));
      return { data: items.map((p) => ({ ...p, courseTitle: titles.get(p.courseId) })), meta: pageMeta(total, page, limit) };
    },

    async invoice(paymentId: string, userId: string) {
      const p = await service.getOrThrow(paymentId);
      // Chủ giao dịch, Owner cộng đồng đó hoặc Platform Admin.
      if (p.userId !== userId && !atLeast(await getRole(userId, p.courseId), 'owner')) throw HttpError.forbidden();
      if (!p.invoiceNumber) throw HttpError.conflict('Giao dịch này chưa có hóa đơn');
      const buyer = await fileUserRepository.findById(p.userId);
      const title = await courseTitle(p.courseId);
      const period = p.periodStart && p.periodEnd ? ` (${p.periodStart.slice(0, 10)} – ${p.periodEnd.slice(0, 10)})` : '';
      return {
        invoiceNumber: p.invoiceNumber,
        issuedAt: p.confirmedAt,
        status: p.status,
        currency: p.currency,
        buyer: { id: p.userId, name: buyer ? `${buyer.firstName} ${buyer.lastName}` : 'Thành viên SofinHub', email: buyer?.email },
        community: { id: p.courseId, title },
        items: [{ description: `Gói thành viên "${title}"${period}`, quantity: 1, unitCents: p.amountCents, amountCents: p.amountCents }],
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
      return inTx(async (ops, after) => {
        await ops.advisoryLock(`refund:${paymentId}`); // 2 yêu cầu song song cho cùng giao dịch: chỉ 1 yêu cầu được tạo
        const p = await ops.findById(paymentId);
        if (!p) throw HttpError.notFound('Không tìm thấy giao dịch');
        if (p.status !== 'succeeded') throw HttpError.conflict('Chỉ giao dịch đã thanh toán thành công mới được hoàn tiền');
        if (await ops.findOpenRefundForPayment(p.id)) throw HttpError.conflict('Giao dịch này đã có yêu cầu hoàn tiền');

        const inWindow = at.getTime() - (await firstPaymentAt(ops, p)).getTime() <= env.REFUND_WINDOW_DAYS * DAY_MS;
        const refund = await ops.createRefund({
          paymentId: p.id,
          courseId: p.courseId,
          userId,
          amountCents: p.amountCents - p.refundedCents,
          reason,
          status: 'pending',
          auto: inWindow,
        });
        if (inWindow) return executeRefund(ops, after, refund, undefined, { callGateway: true });
        return refund;
      });
    },

    async listRefunds(adminId: string, status: RefundRequest['status'] | undefined, page: number, limit: number) {
      await requirePlatformAdmin(adminId);
      const { items, total } = await repo.listRefunds(status, page, limit);
      return { data: items, meta: pageMeta(total, page, limit) };
    },

    async resolveRefund(adminId: string, refundId: string, action: 'approve' | 'reject', note?: string) {
      await requirePlatformAdmin(adminId);
      const refund = await repo.findRefund(refundId);
      if (!refund) throw HttpError.notFound('Không tìm thấy yêu cầu hoàn tiền');
      if (refund.status !== 'pending') throw HttpError.conflict('Yêu cầu này đã được xử lý');
      if (action === 'approve') {
        return inTx((ops, after) => executeRefund(ops, after, { ...refund, note }, adminId, { callGateway: true }));
      }
      const rejected = await repo.transitionRefund(refund.id, ['pending'], { status: 'rejected', note, resolvedBy: adminId, resolvedAt: new Date().toISOString() });
      if (!rejected) throw HttpError.conflict('Yêu cầu này đã được xử lý');
      notify({
        userId: refund.userId,
        type: 'system',
        title: 'Yêu cầu hoàn tiền bị từ chối',
        body: note ? `Lý do: ${note}` : 'Yêu cầu hoàn tiền của bạn không được chấp nhận.',
        courseId: refund.courseId,
      });
      return rejected;
    },

    // ----------------------------------------------------------------- webhook
    /** Xác thực chữ ký trên RAW body rồi xử lý. Sai chữ ký/replay → 400 chung chung (không lộ chi tiết). */
    async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
      if (!rawBody || !gateway.verifyWebhookSignature(rawBody, signature)) throw HttpError.badRequest('Yêu cầu không hợp lệ');
      let json: unknown;
      try {
        json = JSON.parse(rawBody.toString('utf8'));
      } catch {
        throw HttpError.badRequest('Yêu cầu không hợp lệ');
      }
      const event = webhookEventBody.parse(json);

      // Idempotent theo event id (unique trong DB): cổng hay gửi lại, kể cả song song → chỉ một bên xử lý, còn lại trả 200 không làm gì.
      if (!(await repo.claimWebhookEvent(event.id))) return { received: true, duplicate: true };
      try {
        const str = (k: string) => (typeof event.data[k] === 'string' ? (event.data[k] as string) : undefined);
        switch (event.type) {
          case 'payment.succeeded': {
            const p = str('paymentId') ? await repo.findById(str('paymentId')!) : undefined;
            if (!p) return { received: true, ignored: true };
            if (p.status === 'pending') await settle(p, str('chargeId') ?? `webhook_${event.id}`);
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
                  courseId: cur.courseId,
                  userId: cur.userId,
                  amountCents: cur.amountCents - cur.refundedCents,
                  reason: 'Hoàn tiền từ cổng thanh toán',
                  status: 'pending',
                  auto: true,
                });
                await executeRefund(ops, after, refund, undefined, { callGateway: false }); // cổng đã hoàn rồi, không gọi lại
              }
            });
            break;
          }
          case 'subscription.renewed': {
            const sub = str('subscriptionId') ? await repo.findSubscription(str('subscriptionId')!) : undefined;
            if (!sub) return { received: true, ignored: true };
            if (sub.status === 'active' || sub.status === 'expired') {
              await inTx(async (ops, after) => {
                await recordRenewal(ops, after, sub, str('chargeId') ?? `webhook_${event.id}`, new Date());
                await ops.grantAccess(sub.userId, sub.courseId);
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
      } catch (err) {
        await repo.releaseWebhookEvent(event.id); // để cổng gửi lại được
        throw err;
      }
      return { received: true };
    },

    // ----------------------------------------------------------------- doanh thu & payout
    async revenue(courseId: string, userId: string, q: { from?: string; to?: string }) {
      await courseService.getById(courseId);
      await requireRole(userId, courseId, 'owner'); // Admin/Mod cộng đồng mặc định KHÔNG xem được doanh thu

      const from = q.from ? new Date(q.from) : undefined;
      // `to` dạng ngày (YYYY-MM-DD) tính hết ngày đó.
      const to = q.to ? new Date(new Date(q.to).getTime() + (q.to.length === 10 ? DAY_MS - 1 : 0)) : undefined;
      const rates = revenueRates();
      // Toàn bộ là aggregate SQL (SUM/COUNT/FILTER) — không load giao dịch vào bộ nhớ (trừ 20 dòng gần nhất).
      const [sum, balance, subs, recent] = await Promise.all([
        repo.revenueTotals(courseId, { from, to }, rates),
        repo.balance(courseId, rates),
        repo.subscriptionStats(courseId),
        repo.recentPaid(courseId, 20),
      ]);
      return {
        currency: 'usd',
        range: { from: q.from ?? null, to: q.to ?? null },
        grossCents: sum.grossCents,
        refundsCents: sum.refundsCents,
        platformCommissionCents: sum.platformCommissionCents,
        gatewayFeeCents: sum.gatewayFeeCents,
        netCents: sum.netCents,
        // Số dư khả dụng tính trên toàn thời gian (không phụ thuộc from/to): net - các payout đã yêu cầu/duyệt/đã chi.
        availableBalanceCents: balance.net - balance.requested,
        payoutRequestedCents: balance.requested,
        activePaidMembers: subs.active,
        trialingMembers: subs.trialing,
        mrrCents: subs.mrrCents,
        assumptions: {
          platformCommissionPct: env.PLATFORM_COMMISSION_PCT,
          gatewayFeePct: env.GATEWAY_FEE_PCT,
          gatewayFeeFixedCents: env.GATEWAY_FEE_FIXED_CENTS,
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

    async requestPayout(courseId: string, userId: string, body: { amountCents: number; method: { type: 'bank'; bankName: string; accountNumber: string; accountHolder: string } }) {
      await courseService.getById(courseId);
      // Chỉ chính Owner mới đặt lệnh rút (Platform Admin không tạo lệnh rút thay Owner).
      if (!(await isCourseOwner(userId, courseId))) throw HttpError.forbidden('Chỉ chủ cộng đồng mới được yêu cầu rút tiền');
      const minCents = toCents(env.PAYOUT_MIN_USD);
      if (body.amountCents < minCents) throw HttpError.badRequest(`Số tiền rút tối thiểu là ${(minCents / 100).toFixed(2)} USD`);

      // Khóa hàng Course (FOR UPDATE) rồi tính số dư + tạo payout trong cùng transaction ⇒ các lệnh rút song song của cùng
      // cộng đồng chạy tuần tự, lệnh sau thấy số dư đã trừ lệnh trước.
      const payout = await repo.transaction(async (ops) => {
        await ops.lockCourse(courseId);
        const { net, requested } = await ops.balance(courseId, revenueRates());
        if (body.amountCents > net - requested) throw HttpError.badRequest('Số tiền rút vượt quá số dư khả dụng');
        return ops.createPayout({
          courseId,
          ownerId: userId,
          amountCents: body.amountCents,
          method: {
            type: 'bank',
            bankName: body.method.bankName,
            accountHolder: body.method.accountHolder,
            accountLast4: body.method.accountNumber.slice(-4),
          },
          status: 'requested',
        });
      });
      return payoutView(payout);
    },

    async listPayouts(courseId: string, userId: string, page: number, limit: number) {
      await courseService.getById(courseId);
      await requireRole(userId, courseId, 'owner');
      const { items, total } = await repo.listPayouts({ courseId }, page, limit);
      return { data: items.map(payoutView), meta: pageMeta(total, page, limit) };
    },

    async adminListPayouts(adminId: string, status: Payout['status'] | undefined, page: number, limit: number) {
      await requirePlatformAdmin(adminId);
      const { items, total } = await repo.listPayouts({ status }, page, limit);
      return { data: items.map(payoutView), meta: pageMeta(total, page, limit) };
    },

    async resolvePayout(adminId: string, payoutId: string, action: 'approve' | 'mark_paid' | 'reject', note?: string) {
      await requirePlatformAdmin(adminId);
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
