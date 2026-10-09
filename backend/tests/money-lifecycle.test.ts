import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Phải đặt trước khi nạp app/env (dynamic import bên dưới).
const ADMIN_EMAIL = 'padmin-money@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
// Tiền là VND: tối thiểu rút 10 USD cũ ≈ 250.000đ; phí cổng cố định 30¢ ≈ 7.500đ.
process.env.PAYOUT_MIN_USD = '250000';
process.env.PLATFORM_COMMISSION_PCT = '10';
process.env.GATEWAY_FEE_PCT = '2.9';
process.env.GATEWAY_FEE_FIXED_CENTS = '7500';

const DAY = 86_400_000;
/** Giá cộng đồng 'ai' (7 USD cũ) và 'lead' (10 USD cũ) theo VND. */
const AI_PRICE = 175_000;
/** Thông báo được ghi nền nên đợi tới khi điều kiện đúng (tối đa ~4s). */
async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  let v = await fn();
  for (let i = 0; i < 40 && !ok(v); i++) {
    await new Promise((r) => setTimeout(r, 100));
    v = await fn();
  }
  return v;
}
const BANK = { type: 'bank', bankName: 'Vietcombank', accountNumber: '0123456789', accountHolder: 'NGUYEN VAN A' };

/**
 * Regression cho audit mục 3 (5 lỗi tiền) + P1 liên quan, viết lại cho luồng CHUYỂN KHOẢN (VietQR + SePay, VND).
 * Mỗi kịch bản 3.x được viết TRƯỚC khi sửa và đã được chạy để thấy FAIL trên code cũ (xem docs/api/payments.md, "Vòng đời tiền").
 */
describe('vòng đời tiền: 5 kịch bản audit §3 + P1', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let admin: { token: string; id: string };
  let prisma: typeof import('../src/db/prisma.js').prisma;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let paymentsService: typeof import('../src/modules/payments/payments.service.js').paymentsService;
  let createPaymentsService: typeof import('../src/modules/payments/payments.service.js').createPaymentsService;
  let repo: typeof import('../src/modules/payments/payments.repository.js').paymentsRepository;
  let bankGateway: typeof import('../src/modules/payments/payments.gateway.js').bankGateway;
  let bank: typeof import('../src/modules/payments/payments.bank.js');

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ paymentsService, createPaymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ paymentsRepository: repo } = await import('../src/modules/payments/payments.repository.js'));
    ({ bankGateway } = await import('../src/modules/payments/payments.gateway.js'));
    bank = await import('../src/modules/payments/payments.bank.js');
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  let txN = 0;
  const txId = (p = 'ML') => `${p}${Date.now()}${++txN}`;
  const authHeader = () => `Apikey ${process.env.SEPAY_WEBHOOK_KEY}`;

  async function pay(user: { token: string }, courseId: string) {
    const co = await c.call('POST', `/courses/${courseId}/checkout`, { token: user.token, body: { method: 'stripe' } });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.payIntent(co.body.data.id, user.token);
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data;
  }
  async function ownerOf(courseId: string) {
    const o = await c.registerUser('owner');
    await enrollmentService.grant(o.id, courseId, 'owner');
    return o;
  }

  /** Cổng "quan sát": ghi lại mọi lần hoàn (cùng refundId = cùng 1 khoản hoàn) để tính số tiền khách thực mất. */
  function spyGateway() {
    const refunds = new Map<string, number>(); // refundId -> amount
    const calls = { refund: 0 };
    const gw = {
      refund: async (chargeId: string, amountCents: number, idempotencyKey: string) => {
        calls.refund++;
        const r = await bankGateway.refund(chargeId, amountCents, idempotencyKey);
        if (r.ok) refunds.set(r.refundId, amountCents);
        return r;
      },
    };
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    return { gw, calls, refundedTotal: () => sum(refunds) };
  }

  // ------------------------------------------------------------------------------------------------ 3.1
  describe('3.1 double-charge: 2 intent song song của cùng user', () => {
    it('API: checkout ×2 tái dùng intent pending; trả tiền ×2 song song chỉ ghi nhận 1 lần', async () => {
      const u = await c.registerUser('dbl');
      const [a, b] = await Promise.all([
        c.call('POST', '/courses/data/checkout', { token: u.token, body: { method: 'stripe' } }),
        c.call('POST', '/courses/data/checkout', { token: u.token, body: { method: 'stripe' } }),
      ]);
      assert.equal(a.status, 201);
      assert.equal(b.status, 201);
      assert.equal(a.body.data.id, b.body.data.id, 'checkout phải tái dùng intent pending chưa hết hạn');
      assert.equal(await prisma.payment.count({ where: { userId: u.id } }), 1);
      const [x, y] = await Promise.all([
        c.payIntent(a.body.data.id, u.token),
        c.payIntent(b.body.data.id, u.token),
      ]);
      assert.equal(x.status, 200);
      assert.equal(y.status, 200);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1);
    });

    it('2 phiên pending KHÁC NHAU (dữ liệu cũ) được trả song song: chỉ 1 thành công, khoản chuyển thừa được ghi nhận hoàn, tổng khách mất = 1 kỳ', async () => {
      const u = await c.registerUser('dbl2');
      const mk = () =>
        prisma.payment.create({
          data: { communityId: 'ai', userId: u.id, method: 'bank_transfer', amountCents: AI_PRICE, refCode: bank.makeRefCode(), expiresAt: new Date(Date.now() + 10 * 60_000) },
        });
      const [p1, p2] = [await mk(), await mk()];
      const spy = spyGateway();
      const s1 = createPaymentsService(repo, spy.gw);
      const s2 = createPaymentsService(repo, spy.gw);
      // Khách đã chuyển ĐỦ tiền cho cả hai phiên (2 giao dịch ngân hàng thật).
      await Promise.all([
        s1.handleBankWebhook(authHeader(), c.sepayTx({ id: txId(), refCode: p1.refCode!, amount: AI_PRICE })),
        s2.handleBankWebhook(authHeader(), c.sepayTx({ id: txId(), refCode: p2.refCode!, amount: AI_PRICE })),
      ]);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id, status: { in: ['active', 'trialing'] } } }), 1);
      const voided = await prisma.payment.findMany({ where: { userId: u.id, status: 'failed' } });
      assert.equal(voided.length, 1);
      assert.equal(voided[0]!.failureReason, 'duplicate_charge');
      assert.equal(voided[0]!.refundedCents, AI_PRICE, 'phiên trùng phải được ghi nhận hoàn đủ');
      const netPaid = 2 * AI_PRICE - spy.refundedTotal();
      assert.equal(netPaid, AI_PRICE, `khách phải mất đúng ${AI_PRICE}đ, thực tế ${netPaid}đ`);
    });

    it('DB chặn cứng: không thể có 2 gói trialing/active của cùng (user, course)', async () => {
      const u = await c.registerUser('uniq');
      const base = { userId: u.id, communityId: 'ai', priceCents: AI_PRICE, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + DAY) };
      await prisma.subscription.create({ data: { ...base, status: 'active' } });
      await assert.rejects(prisma.subscription.create({ data: { ...base, status: 'trialing' } }), (e: any) => e.code === 'P2002');
      await prisma.subscription.create({ data: { ...base, status: 'canceled' } }); // gói đã kết thúc thì được phép nhiều
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.2
  describe('3.2 không đòi tiền người bị kick/ban, cộng đồng đã xóa/khóa', () => {
    it('kick + ban rồi chạy gia hạn: không có hóa đơn gia hạn, gói không còn active', async () => {
      const u = await c.registerUser('banned');
      await pay(u, 'des');
      const owner = await ownerOf('des');
      const ban = await c.call('POST', `/courses/des/members/${u.id}/ban`, { token: owner.token, body: { reason: 'spam' } });
      assert.ok(ban.status < 300, JSON.stringify(ban.body));
      await paymentsService.issueRenewalInvoices(new Date(Date.now() + 29 * DAY));
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'không được đòi tiền người đã bị cấm');
      const sub = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
      assert.notEqual(sub.status, 'active');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'des'), false);
    });

    it('cộng đồng bị xóa mềm: gói bị hủy ngay (thông báo), gia hạn không phát hóa đơn', async () => {
      const u = await c.registerUser('delcom');
      await pay(u, 'write');
      const del = await c.call('DELETE', '/courses/write', { token: admin.token });
      assert.ok(del.status === 204 || del.status === 200, JSON.stringify(del.body));
      await paymentsService.issueRenewalInvoices(new Date(Date.now() + 29 * DAY));
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'không được đòi tiền cộng đồng đã xóa');
      assert.equal((await prisma.subscription.findFirst({ where: { userId: u.id } }))!.status, 'canceled');
      const notes = await eventually(() => prisma.notification.findMany({ where: { userId: u.id } }), (n) => n.length > 0);
      assert.ok(notes.some((n) => /gói|xóa/i.test(n.title + n.body)));
    });

    it('cộng đồng bị khóa: checkout/trial bị từ chối; tiền về sau khi khóa KHÔNG tự cấp quyền; gói đang có không bị gia hạn', async () => {
      const early = await c.registerUser('lockpaid');
      await pay(early, 'mkt');
      const pending = await c.registerUser('lockpending');
      const co = await c.call('POST', '/courses/mkt/checkout', { token: pending.token, body: { method: 'stripe' } });
      assert.equal(co.status, 201);

      assert.equal((await c.call('POST', '/admin/courses/mkt/lock', { token: admin.token, body: { reason: 'lừa đảo' } })).status, 200);

      const u = await c.registerUser('locked');
      assert.equal((await c.call('POST', '/courses/mkt/checkout', { token: u.token, body: { method: 'stripe' } })).status, 403);
      assert.equal((await c.call('POST', '/courses/mkt/trial', { token: u.token })).status, 403);
      // Khách đã quét QR từ trước khi khóa và tiền về: không được cấp quyền vào cộng đồng đang khóa.
      await c.bankWebhook(c.sepayTx({ id: txId(), refCode: co.body.data.refCode, amount: co.body.data.amountCents }));
      assert.equal(await prisma.payment.count({ where: { userId: pending.id, status: 'succeeded' } }), 0, 'không cấp quyền khi cộng đồng bị khóa');
      assert.equal(await enrollmentService.isEnrolled(pending.id, 'mkt'), false);

      await paymentsService.issueRenewalInvoices(new Date(Date.now() + 29 * DAY));
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: early.id, kind: 'renewal', status: 'succeeded' } }), 0, 'không gia hạn khi cộng đồng bị khóa');
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.3
  describe('3.3 rời cộng đồng / gỡ cấm không được làm mất hay đòi thêm tiền', () => {
    it('rời cộng đồng hủy gói cuối kỳ (không phát hóa đơn tiếp); vào lại khi gói còn hạn: 200, không 402, không thu lần hai', async () => {
      const u = await c.registerUser('leave');
      await pay(u, 'biz');
      const left = await c.call('POST', '/courses/biz/enroll', { token: u.token });
      assert.equal(left.status, 200);
      assert.equal(left.body.data.enrolled, false);
      const sub = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
      assert.equal(sub.cancelAtPeriodEnd, true, 'rời cộng đồng phải hủy gói cuối kỳ');

      const back = await c.call('POST', '/courses/biz/enroll', { token: u.token });
      assert.equal(back.status, 200, JSON.stringify(back.body));
      assert.equal(back.body.data.enrolled, true);
      assert.equal(await prisma.payment.count({ where: { userId: u.id } }), 1, 'vào lại không phát sinh giao dịch');
      // Đang có gói còn hiệu lực: checkout bị chặn thay vì tạo phiên thu tiền lần hai.
      const left2 = await c.call('POST', '/courses/biz/enroll', { token: u.token });
      assert.equal(left2.body.data.enrolled, false);
      assert.equal((await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' } })).status, 409);
      assert.equal((await prisma.subscription.findFirst({ where: { userId: u.id } }))!.currentPeriodEnd.getTime(), sub.currentPeriodEnd.getTime(), 'không reset kỳ');

      await paymentsService.issueRenewalInvoices(new Date(Date.now() + 29 * DAY));
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'đã rời thì không bị gia hạn');
    });

    it('gỡ cấm trả lại quyền khi gói còn hiệu lực: không thu lần hai, không reset kỳ', async () => {
      const u = await c.registerUser('unban');
      await pay(u, 'biz');
      const owner = await ownerOf('biz');
      const periodBefore = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!.currentPeriodEnd.getTime();
      await c.call('POST', `/courses/biz/members/${u.id}/ban`, { token: owner.token, body: { reason: 'nhầm' } });
      assert.equal(await enrollmentService.isEnrolled(u.id, 'biz'), false);
      assert.equal((await c.call('DELETE', `/courses/biz/members/${u.id}/ban`, { token: owner.token })).status < 300, true);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'biz'), true, 'gỡ cấm khi gói còn hạn phải trả lại quyền');
      assert.equal(await prisma.payment.count({ where: { userId: u.id } }), 1);
      assert.equal((await prisma.subscription.findFirst({ where: { userId: u.id } }))!.currentPeriodEnd.getTime(), periodBefore);
    });

    it('trả hóa đơn gia hạn cấp lại quyền (settleRenewal nhất quán với settle lần đầu)', async () => {
      const u = await c.registerUser('renewgrant');
      await pay(u, 'biz');
      const sub = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
      await paymentsService.issueRenewalInvoices(new Date(sub.currentPeriodEnd.getTime() - DAY));
      const inv = await prisma.payment.findFirstOrThrow({ where: { userId: u.id, kind: 'renewal' } });
      await prisma.enrollment.deleteMany({ where: { userId: u.id, communityId: 'biz' } }); // mô phỏng mất quyền
      const res = await c.bankWebhook(c.sepayTx({ id: txId(), refCode: inv.refCode!, amount: inv.amountCents }));
      assert.equal(res.status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'biz'), true);
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.4
  describe('3.4 hoàn tiền: idempotency key + ghi nhận ngoài transaction + đối soát', () => {
    it('bankGateway dedupe theo idempotency key (cùng key = cùng khoản hoàn)', async () => {
      const a = await bankGateway.refund('ch_dedupe', AI_PRICE, 'key-1');
      const b = await bankGateway.refund('ch_dedupe', AI_PRICE, 'key-1');
      assert.equal(a.refundId, b.refundId);
      assert.match(a.refundId, /^manual:/);
      assert.equal(bankGateway.refundedTotal('ch_dedupe'), AI_PRICE);
      await bankGateway.refund('ch_dedupe', 25_000, 'key-2');
      assert.equal(bankGateway.refundedTotal('ch_dedupe'), AI_PRICE + 25_000);
    });

    it('ghi nhận hoàn thành công nhưng tx chốt thất bại: không hoàn lần hai (key = refund.id), đối soát chốt `refunded`', async () => {
      const u = await c.registerUser('refund-flaky');
      const p = await pay(u, 'ai');
      const spy = spyGateway();
      let failedOnce = false;
      const flaky: typeof repo = {
        ...repo,
        transaction: (fn, opts) =>
          repo.transaction(
            (ops) =>
              fn({
                ...ops,
                // Mô phỏng timeout/deadlock đúng lúc chốt sau khi khoản hoàn đã được ghi nhận.
                transitionRefund: async (id, from, patch) => {
                  if (patch.status === 'approved' && !failedOnce) {
                    failedOnce = true;
                    throw new Error('simulated tx failure after gateway refund');
                  }
                  return ops.transitionRefund(id, from, patch);
                },
              }),
            opts,
          ),
      };
      const svc = createPaymentsService(flaky, spy.gw);
      await assert.rejects(svc.requestRefund(p.id, u.id, 'lỗi tx'));
      // Người dùng bấm lại: không được hoàn thêm lần nữa.
      await svc.requestRefund(p.id, u.id, 'bấm lại').catch(() => undefined);
      await svc.reconcileStuckRefunds({ olderThanMs: 0 });
      assert.equal(spy.refundedTotal(), AI_PRICE, `chỉ được hoàn đúng ${AI_PRICE}đ, thực tế ${spy.refundedTotal()}đ`);
      const pay0 = (await prisma.payment.findUnique({ where: { id: p.id } }))!;
      assert.equal(pay0.status, 'refunded');
      assert.equal(pay0.refundedCents, AI_PRICE);
      assert.equal(await prisma.refundRequest.count({ where: { paymentId: p.id } }), 1);
    });

    it('ghi nhận hoàn bị từ chối (failRefunds): yêu cầu tự duyệt biến mất, giao dịch giữ nguyên succeeded, quyền còn', async () => {
      const u = await c.registerUser('refund-reject');
      const p = await pay(u, 'ai');
      bankGateway.failRefunds(true);
      try {
        await assert.rejects(paymentsService.requestRefund(p.id, u.id, 'thử'), (e: any) => e.status === 502);
      } finally {
        bankGateway.failRefunds(false);
      }
      assert.equal((await prisma.payment.findUnique({ where: { id: p.id } }))!.status, 'succeeded');
      assert.equal(await prisma.refundRequest.count({ where: { paymentId: p.id } }), 0);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.5
  describe('3.5 số dư owner: holding period, reserve, sổ nợ, chặn payout khi âm', () => {
    it('kịch bản audit: owner không rút được tiền còn trong cửa sổ hoàn tiền (không còn lỗ khi 10/10 người hoàn)', async () => {
      const owner = await ownerOf('py');
      for (let i = 0; i < 4; i++) {
        const b = await c.registerUser(`py${i}`);
        await pay(b, 'py');
      }
      const rev = await c.call('GET', '/courses/py/revenue', { token: owner.token });
      assert.equal(rev.status, 200);
      assert.equal(rev.body.data.availableBalanceCents, 0, 'tiền mới vào chưa được rút');
      assert.ok(rev.body.data.heldCents > 0, 'có trường heldCents (additive)');
      const r = await c.call('POST', '/courses/py/payouts', { token: owner.token, body: { amountCents: 250_000, method: BANK } });
      assert.equal(r.status, 400, 'rút tiền còn trong holding period phải bị từ chối');
    });

    it('sau holding period: rút được phần trừ reserve; hoàn tiền sau payout ghi nợ và chặn payout mới', async () => {
      const owner = await ownerOf('lead');
      const buyers: { token: string; id: string; payId: string }[] = [];
      for (let i = 0; i < 4; i++) {
        const b = await c.registerUser(`lead${i}`);
        // 'lead' là cộng đồng riêng tư: cấp quyền mua qua yêu cầu tham gia đã duyệt.
        await prisma.joinRequest.create({ data: { communityId: 'lead', userId: b.id, status: 'approved' } });
        const p = await pay(b, 'lead');
        buyers.push({ ...b, payId: p.id });
      }
      // Lùi thời điểm thanh toán 60 ngày (qua cửa sổ hoàn tiền + tranh chấp).
      await prisma.payment.updateMany({ where: { communityId: 'lead' }, data: { confirmedAt: new Date(Date.now() - 60 * DAY) } });
      const rev = (await c.call('GET', '/courses/lead/revenue', { token: owner.token })).body.data;
      // net mỗi giao dịch 250.000đ: 250000 - 25000 (10%) - (7250 [2.9%] + 7500 [cố định]) = 210250; 4 giao dịch = 841000; reserve 10% = 84100
      assert.equal(rev.totalBalanceCents, 841_000);
      assert.equal(rev.reserveCents, 84_100);
      assert.equal(rev.availableBalanceCents, 841_000 - 84_100);
      assert.equal((await c.call('POST', '/courses/lead/payouts', { token: owner.token, body: { amountCents: rev.availableBalanceCents + 1, method: BANK } })).status, 400);
      const ok = await c.call('POST', '/courses/lead/payouts', { token: owner.token, body: { amountCents: rev.availableBalanceCents, method: BANK } });
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      const payoutId = ok.body.data.id as string;
      assert.equal((await c.call('PATCH', `/admin/payouts/${payoutId}`, { token: admin.token, body: { action: 'mark_paid' } })).status, 200);

      // Tất cả hoàn tiền SAU khi đã chi (admin hoàn trực tiếp, bỏ qua cửa sổ).
      for (const b of buyers) {
        const rf = await paymentsService.adminRefundPayment(admin.id, b.payId, { reason: 'khiếu nại' });
        assert.equal(rf.status, 'approved');
      }
      const after = (await c.call('GET', '/courses/lead/revenue', { token: owner.token })).body.data;
      assert.equal(after.availableBalanceCents, 0);
      assert.ok(after.debtCents > 0, 'phải ghi nhận nợ khi hoàn tiền sau payout');
      const ledger = await prisma.ownerBalanceLedger.findMany({ where: { communityId: 'lead' } });
      assert.ok(ledger.length >= 1 && ledger.every((l) => l.amountCents < 0 && l.kind === 'refund_after_payout'));
      // Doanh thu mới vào (đã qua holding) không được rút khi còn nợ.
      const nb = await c.registerUser('lead-new');
      await prisma.joinRequest.create({ data: { communityId: 'lead', userId: nb.id, status: 'approved' } });
      await pay(nb, 'lead');
      await prisma.payment.updateMany({ where: { userId: nb.id }, data: { confirmedAt: new Date(Date.now() - 60 * DAY) } });
      const blocked = await c.call('POST', '/courses/lead/payouts', { token: owner.token, body: { amountCents: 250_000, method: BANK } });
      assert.equal(blocked.status, 400, 'còn nợ ⇒ chặn payout');
    });
  });

  // ------------------------------------------------------------------------------------------------ P1 §6.1
  describe('P1: tiền-về-settle-lỗi, webhook gửi lại, deadlock settle↔scheduler', () => {
    /** Repo mà transaction ĐẦU TIÊN (= settle) ném lỗi như deadlock/timeout; các lần sau chạy thật. */
    function flakyOnce(): typeof repo {
      let calls = 0;
      return {
        ...repo,
        transaction: (fn, opts) => {
          if (++calls === 1) return Promise.reject(new Error('simulated settle failure (deadlock/timeout)'));
          return repo.transaction(fn, opts);
        },
      };
    }

    it('tiền đã về nhưng settle lỗi: payment giữ pending, giao dịch ngân hàng được ghi (chưa credited); admin duyệt tay gán giao dịch ⇒ cấp đúng 1 lần', async () => {
      const u = await c.registerUser('settle-fail');
      const co = await c.call('POST', '/courses/ai/checkout', { token: u.token, body: { method: 'stripe' } });
      const svc = createPaymentsService(flakyOnce(), spyGateway().gw);
      const tx = c.sepayTx({ id: txId('SF'), refCode: co.body.data.refCode, amount: co.body.data.amountCents });
      const out = await svc.handleBankWebhook(authHeader(), tx);
      assert.equal(out.message, 'error');
      assert.equal(out.success, false);
      const mid = (await prisma.payment.findUnique({ where: { id: co.body.data.id } }))!;
      assert.equal(mid.status, 'pending');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: tx.id } });
      assert.equal(bt.credited, false, 'tiền đã về phải truy vết được');
      assert.match(bt.note ?? '', /chưa cấp được/);

      const ok = await c.call('POST', `/admin/bank/payments/${co.body.data.refCode}/approve`, { token: admin.token, body: { bankTransactionId: bt.id } });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      const done = (await prisma.payment.findUnique({ where: { id: co.body.data.id } }))!;
      assert.equal(done.status, 'succeeded');
      assert.equal(done.gatewayChargeId, tx.id);
      assert.ok(done.invoiceNumber);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
      assert.equal((await prisma.bankTransaction.findUniqueOrThrow({ where: { id: bt.id } })).credited, true);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
    });

    it('webhook lỗi xử lý ⇒ KHÔNG nuốt: gửi lại cùng giao dịch (hoặc cron quét) xử lý được, không "duplicate mãi mãi", không cộng đôi', async () => {
      const u = await c.registerUser('wh-fail');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const tx = c.sepayTx({ id: txId('WF'), refCode: co.body.data.refCode, amount: co.body.data.amountCents });
      const failing = createPaymentsService(flakyOnce(), bankGateway);
      assert.equal((await failing.handleBankWebhook(authHeader(), tx)).message, 'error');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);
      // SePay retry cùng giao dịch: được nhận xử lý lại (bản ghi cũ chưa credited), không phải 'already'.
      const again = await c.bankWebhook(tx);
      assert.equal(again.status, 200);
      assert.equal(again.body.message, 'credited');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), true);
      assert.equal(await prisma.bankTransaction.count({ where: { externalId: tx.id } }), 1);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      // Lần thứ ba: đã xong ⇒ 'already'.
      assert.equal((await c.bankWebhook(tx)).body.message, 'already');

      // Đường cron quét cũng hoàn tất được giao dịch kẹt (webhook bị mất hẳn).
      const u2 = await c.registerUser('wh-fail2');
      const co2 = await c.call('POST', '/courses/ux/checkout', { token: u2.token, body: { method: 'stripe' } });
      const id2 = txId('WS');
      const tx2 = c.sepayTx({ id: id2, refCode: co2.body.data.refCode, amount: co2.body.data.amountCents });
      assert.equal((await createPaymentsService(flakyOnce(), bankGateway).handleBankWebhook(authHeader(), tx2)).message, 'error');
      const http = (async () =>
        new Response(
          JSON.stringify({ transactions: [{ id: id2, bank_brand_name: 'MBBank', account_number: '0123456789', transaction_date: '2026-10-09 11:00:00', amount_in: `${co2.body.data.amountCents}.00`, amount_out: '0.00', transaction_content: `${co2.body.data.refCode} CK`, code: null }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )) as unknown as typeof fetch;
      const scan = await createPaymentsService(repo, bankGateway, { sepayToken: 'tok', http }).scanBankTransactions();
      assert.equal(scan.credited, 1);
      assert.equal(await enrollmentService.isEnrolled(u2.id, 'ux'), true);
    });

    it('stress: thanh toán (dùng thử -> trả phí) song song với processDueSubscriptions trên cùng gói — không deadlock, trạng thái nhất quán', async () => {
      const users = await Promise.all(Array.from({ length: 6 }, (_, i) => c.registerUser(`dl${i}`)));
      const errors: unknown[] = [];
      const origError = console.error;
      console.error = (...a: unknown[]) => {
        errors.push(a);
      };
      try {
        for (const u of users) await c.call('POST', '/courses/yoga/trial', { token: u.token });
        const intents = await Promise.all(users.map((u) => c.call('POST', '/courses/yoga/checkout', { token: u.token, body: { method: 'stripe' } })));
        const due = new Date(Date.now() + 8 * DAY);
        const results = await Promise.allSettled([
          ...users.map((_, i) =>
            createPaymentsService(repo, bankGateway).handleBankWebhook(authHeader(), c.sepayTx({ id: txId('DL'), refCode: intents[i]!.body.data.refCode, amount: intents[i]!.body.data.amountCents })),
          ),
          createPaymentsService(repo, bankGateway).processDueSubscriptions(due),
          createPaymentsService(repo, bankGateway).processDueSubscriptions(due),
        ]);
        for (const r of results) {
          if (r.status === 'rejected') assert.ok((r.reason as any)?.status === 409 || (r.reason as any)?.status === 403, `không được lỗi 500/deadlock: ${String((r.reason as any)?.message)}`);
        }
      } finally {
        console.error = origError;
      }
      assert.equal(errors.filter((e) => /40P01|deadlock/i.test(JSON.stringify(e))).length, 0, 'không có deadlock 40P01');
      for (const u of users) {
        assert.ok((await prisma.subscription.count({ where: { userId: u.id, status: { in: ['active', 'trialing'] } } })) <= 1);
        assert.ok((await prisma.payment.count({ where: { userId: u.id, status: 'succeeded', kind: 'initial' } })) <= 1);
      }
      const invs = await prisma.payment.findMany({ where: { invoiceNumber: { not: null } }, select: { invoiceNumber: true } });
      assert.equal(new Set(invs.map((x) => x.invoiceNumber)).size, invs.length, 'số hóa đơn không trùng');
    });
  });
});
