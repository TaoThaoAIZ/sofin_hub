import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Phải đặt trước khi nạp app/env (dynamic import bên dưới).
const ADMIN_EMAIL = 'padmin-money@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.PAYOUT_MIN_USD = '10';
process.env.PLATFORM_COMMISSION_PCT = '10';
process.env.GATEWAY_FEE_PCT = '2.9';
process.env.GATEWAY_FEE_FIXED_CENTS = '30';

const DAY = 86_400_000;
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
 * Regression cho audit mục 3 (5 lỗi tiền) + P1 liên quan. Mỗi kịch bản 3.x được viết TRƯỚC khi sửa và đã được chạy để thấy FAIL
 * trên code cũ (xem docs/api/payments.md, "Vòng đời tiền").
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
  let mockGateway: typeof import('../src/modules/payments/payments.gateway.js').mockGateway;
  let signWebhookPayload: typeof import('../src/modules/payments/payments.gateway.js').signWebhookPayload;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ paymentsService, createPaymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ paymentsRepository: repo } = await import('../src/modules/payments/payments.repository.js'));
    ({ mockGateway, signWebhookPayload } = await import('../src/modules/payments/payments.gateway.js'));
    const r = await c.call('POST', '/auth/register', { body: { email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' } });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  async function pay(user: { token: string }, courseId: string) {
    const co = await c.call('POST', `/courses/${courseId}/checkout`, { token: user.token, body: { method: 'stripe' } });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: user.token });
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data;
  }
  async function ownerOf(courseId: string) {
    const o = await c.registerUser('owner');
    await enrollmentService.grant(o.id, courseId, 'owner');
    return o;
  }

  /** Cổng "quan sát": ghi lại mọi lần trừ/hoàn để tính số tiền khách thực mất (charge duy nhất − hoàn duy nhất). */
  function spyGateway() {
    const charges = new Map<string, number>(); // chargeId -> amount
    const refunds = new Map<string, number>(); // refundId -> amount (cùng id = cùng 1 khoản hoàn)
    const calls = { refund: 0 };
    const gw = {
      createCharge: async (req: Parameters<typeof mockGateway.createCharge>[0]) => {
        const r = await mockGateway.createCharge(req);
        if (r.ok) charges.set(r.chargeId, req.amountCents);
        return r;
      },
      refund: async (chargeId: string, amountCents: number, idempotencyKey?: string) => {
        calls.refund++;
        const r = await (mockGateway.refund as (a: string, b: number, c?: string) => ReturnType<typeof mockGateway.refund>)(chargeId, amountCents, idempotencyKey);
        if (r.ok) refunds.set(r.refundId, amountCents);
        return r;
      },
      verifyWebhookSignature: (b: Buffer | string, s: string | undefined) => mockGateway.verifyWebhookSignature(b, s),
    };
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    return { gw, calls, netCharged: () => sum(charges) - sum(refunds), chargedTotal: () => sum(charges), refundedTotal: () => sum(refunds) };
  }

  // ------------------------------------------------------------------------------------------------ 3.1
  describe('3.1 double-charge: 2 intent song song của cùng user', () => {
    it('API: checkout ×2 tái dùng intent pending; confirm ×2 song song chỉ ghi nhận 1 lần trừ tiền', async () => {
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
        c.call('POST', `/payments/${a.body.data.id}/confirm`, { token: u.token }),
        c.call('POST', `/payments/${b.body.data.id}/confirm`, { token: u.token }),
      ]);
      assert.equal(x.status, 200);
      assert.equal(y.status, 200);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1);
    });

    it('2 intent pending KHÁC NHAU (dữ liệu cũ) confirm song song: chỉ 1 thành công, khoản trừ thừa được hoàn, tổng khách mất = 1 kỳ', async () => {
      const u = await c.registerUser('dbl2');
      const mk = () => prisma.payment.create({ data: { communityId: 'ai', userId: u.id, method: 'stripe', amountCents: 700, trialDays: 7 } });
      const [p1, p2] = [await mk(), await mk()];
      const spy = spyGateway();
      const s1 = createPaymentsService(repo, spy.gw);
      const s2 = createPaymentsService(repo, spy.gw);
      const rs = await Promise.allSettled([s1.confirm(p1.id, u.id), s2.confirm(p2.id, u.id)]);
      assert.equal(rs.filter((r) => r.status === 'fulfilled').length >= 1, true);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id, status: { in: ['active', 'trialing'] } } }), 1);
      assert.equal(spy.netCharged(), 700, `khách phải mất đúng 700¢, thực tế ${spy.netCharged()}`);
    });

    it('DB chặn cứng: không thể có 2 gói trialing/active của cùng (user, course)', async () => {
      const u = await c.registerUser('uniq');
      const base = { userId: u.id, communityId: 'ai', priceCents: 700, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + DAY) };
      await prisma.subscription.create({ data: { ...base, status: 'active' } });
      await assert.rejects(prisma.subscription.create({ data: { ...base, status: 'trialing' } }), (e: any) => e.code === 'P2002');
      await prisma.subscription.create({ data: { ...base, status: 'canceled' } }); // gói đã kết thúc thì được phép nhiều
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.2
  describe('3.2 không trừ tiền người bị kick/ban, cộng đồng đã xóa/khóa', () => {
    it('kick + ban rồi chạy gia hạn: không có giao dịch gia hạn, gói không còn active', async () => {
      const u = await c.registerUser('banned');
      await pay(u, 'des');
      const owner = await ownerOf('des');
      const ban = await c.call('POST', `/courses/des/members/${u.id}/ban`, { token: owner.token, body: { reason: 'spam' } });
      assert.ok(ban.status < 300, JSON.stringify(ban.body));
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'không được trừ tiền người đã bị cấm');
      const sub = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
      assert.notEqual(sub.status, 'active');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'des'), false);
    });

    it('cộng đồng bị xóa mềm: gói bị hủy ngay (thông báo), gia hạn không trừ tiền', async () => {
      const u = await c.registerUser('delcom');
      await pay(u, 'write');
      const del = await c.call('DELETE', '/courses/write', { token: admin.token });
      assert.ok(del.status === 204 || del.status === 200, JSON.stringify(del.body));
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'không được trừ tiền cộng đồng đã xóa');
      assert.equal((await prisma.subscription.findFirst({ where: { userId: u.id } }))!.status, 'canceled');
      const notes = await eventually(() => prisma.notification.findMany({ where: { userId: u.id } }), (n) => n.length > 0);
      assert.ok(notes.some((n) => /gói|xóa/i.test(n.title + n.body)));
    });

    it('cộng đồng bị khóa: checkout/trial/confirm bị từ chối; gói đang có không bị gia hạn', async () => {
      const early = await c.registerUser('lockpaid');
      await pay(early, 'mkt');
      const pending = await c.registerUser('lockpending');
      const co = await c.call('POST', '/courses/mkt/checkout', { token: pending.token, body: { method: 'stripe' } });
      assert.equal(co.status, 201);

      assert.equal((await c.call('POST', '/admin/courses/mkt/lock', { token: admin.token, body: { reason: 'lừa đảo' } })).status, 200);

      const u = await c.registerUser('locked');
      assert.equal((await c.call('POST', '/courses/mkt/checkout', { token: u.token, body: { method: 'stripe' } })).status, 403);
      assert.equal((await c.call('POST', '/courses/mkt/trial', { token: u.token })).status, 403);
      const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: pending.token });
      assert.equal(cf.status, 403, 'không trừ tiền khi cộng đồng bị khóa');
      assert.equal(await prisma.payment.count({ where: { userId: pending.id, status: 'succeeded' } }), 0);

      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: early.id, kind: 'renewal' } }), 0, 'không gia hạn khi cộng đồng bị khóa');
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.3
  describe('3.3 rời cộng đồng / gỡ cấm không được làm mất hay trừ thêm tiền', () => {
    it('rời cộng đồng hủy gói cuối kỳ (không bị trừ tiếp); vào lại khi gói còn hạn: 200, không 402, không trừ lần hai', async () => {
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
      // Đang có gói còn hiệu lực: checkout bị chặn thay vì trừ tiền lần hai.
      const left2 = await c.call('POST', '/courses/biz/enroll', { token: u.token });
      assert.equal(left2.body.data.enrolled, false);
      assert.equal((await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' } })).status, 409);
      assert.equal((await prisma.subscription.findFirst({ where: { userId: u.id } }))!.currentPeriodEnd.getTime(), sub.currentPeriodEnd.getTime(), 'không reset kỳ');

      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'đã rời thì không bị gia hạn');
    });

    it('gỡ cấm trả lại quyền khi gói còn hiệu lực: không trừ lần hai, không reset kỳ', async () => {
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

    it('gia hạn thủ công qua webhook subscription.renewed cấp lại quyền (recordRenewal nhất quán)', async () => {
      const u = await c.registerUser('renewgrant');
      await pay(u, 'biz');
      await prisma.enrollment.deleteMany({ where: { userId: u.id, communityId: 'biz' } }); // mô phỏng mất quyền
      const subId = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!.id;
      const raw = JSON.stringify({ id: `evt_rg_${u.id}`, type: 'subscription.renewed', data: { subscriptionId: subId, chargeId: 'ch_rg' } });
      const res = await fetch(`${server.baseUrl}/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sofin-signature': signWebhookPayload(raw, 'test-webhook-secret') }, body: raw });
      assert.equal(res.status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'biz'), true);
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.4
  describe('3.4 hoàn tiền: idempotency key + gọi cổng ngoài transaction + đối soát', () => {
    it('MockGateway dedupe theo idempotency key (cùng key = cùng khoản hoàn)', async () => {
      const g = mockGateway as unknown as { refund(c: string, a: number, k: string): Promise<{ ok: boolean; refundId: string }>; refundedTotal(c: string): number };
      const a = await g.refund('ch_dedupe', 700, 'key-1');
      const b = await g.refund('ch_dedupe', 700, 'key-1');
      assert.equal(a.refundId, b.refundId);
      assert.equal(g.refundedTotal('ch_dedupe'), 700);
      await g.refund('ch_dedupe', 100, 'key-2');
      assert.equal(g.refundedTotal('ch_dedupe'), 800);
    });

    it('cổng hoàn thành công nhưng tx chốt thất bại: không hoàn lần hai (key = refund.id), đối soát chốt `refunded`', async () => {
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
                // Mô phỏng timeout/deadlock đúng lúc chốt sau khi cổng đã hoàn tiền thật.
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
      const rec = (svc as unknown as { reconcileStuckRefunds?: (o: { olderThanMs: number }) => Promise<unknown> }).reconcileStuckRefunds;
      if (rec) await rec.call(svc, { olderThanMs: 0 });
      assert.equal(spy.refundedTotal(), 700, `cổng chỉ được hoàn đúng 700¢, thực tế ${spy.refundedTotal()}`);
      const pay0 = (await prisma.payment.findUnique({ where: { id: p.id } }))!;
      assert.equal(pay0.status, 'refunded');
      assert.equal(pay0.refundedCents, 700);
      assert.equal(await prisma.refundRequest.count({ where: { paymentId: p.id } }), 1);
    });

    it('cổng từ chối hoàn: yêu cầu tự duyệt biến mất, giao dịch giữ nguyên succeeded, quyền còn', async () => {
      const u = await c.registerUser('refund-reject');
      const p = await pay(u, 'ai');
      const svc = createPaymentsService(repo, { ...spyGateway().gw, refund: async () => ({ ok: false, refundId: '' }) });
      await assert.rejects(svc.requestRefund(p.id, u.id, 'thử'), (e: any) => e.status === 502);
      assert.equal((await prisma.payment.findUnique({ where: { id: p.id } }))!.status, 'succeeded');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
    });
  });

  // ------------------------------------------------------------------------------------------------ 3.5
  describe('3.5 số dư owner: holding period, reserve, sổ nợ, chặn payout khi âm', () => {
    it('kịch bản audit: owner không rút được tiền còn trong cửa sổ hoàn tiền (không còn lỗ khi 10/10 người hoàn)', async () => {
      const owner = await ownerOf('py');
      const buyers: { token: string; id: string }[] = [];
      for (let i = 0; i < 4; i++) {
        const b = await c.registerUser(`py${i}`);
        buyers.push(b);
        await pay(b, 'py');
      }
      const rev = await c.call('GET', '/courses/py/revenue', { token: owner.token });
      assert.equal(rev.status, 200);
      assert.equal(rev.body.data.availableBalanceCents, 0, 'tiền mới vào chưa được rút');
      assert.ok(rev.body.data.heldCents > 0, 'có trường heldCents (additive)');
      const r = await c.call('POST', '/courses/py/payouts', { token: owner.token, body: { amountCents: 1000, method: BANK } });
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
      // net mỗi giao dịch $10: 1000 - 100 (10%) - (29 + 30) = 841; 4 giao dịch = 3364; reserve 10% = 336 (làm tròn xuống)
      assert.equal(rev.totalBalanceCents, 3364);
      assert.equal(rev.reserveCents, 336);
      assert.equal(rev.availableBalanceCents, 3364 - 336);
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
      const blocked = await c.call('POST', '/courses/lead/payouts', { token: owner.token, body: { amountCents: 1000, method: BANK } });
      assert.equal(blocked.status, 400, 'còn nợ ⇒ chặn payout');
    });
  });
  // ------------------------------------------------------------------------------------------------ P1 §6.1
  describe('P1: charge-xong-settle-lỗi, webhook bị nuốt, deadlock settle↔scheduler', () => {
    async function postWebhook(event: unknown) {
      const raw = JSON.stringify(event);
      const res = await fetch(`${server.baseUrl}/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sofin-signature': signWebhookPayload(raw, 'test-webhook-secret') }, body: raw });
      return { status: res.status, body: await res.json() };
    }

    it('cổng đã trừ tiền nhưng settle lỗi: gatewayChargeId được lưu trước; reconcileUnsettledCharges hoàn tất (không trừ lại)', async () => {
      const u = await c.registerUser('settle-fail');
      const co = await c.call('POST', '/courses/ai/checkout', { token: u.token, body: { method: 'stripe' } });
      const spy = spyGateway();
      let calls = 0;
      const flaky: typeof repo = {
        ...repo,
        transaction: (fn, opts) => {
          if (++calls === 1) return Promise.reject(new Error('simulated settle failure (deadlock/timeout)'));
          return repo.transaction(fn, opts);
        },
      };
      const svc = createPaymentsService(flaky, spy.gw);
      await assert.rejects(svc.confirm(co.body.data.id, u.id));
      const mid = (await prisma.payment.findUnique({ where: { id: co.body.data.id } }))!;
      assert.equal(mid.status, 'pending');
      assert.ok(mid.gatewayChargeId, 'tiền đã trừ phải truy vết được trên Payment');
      assert.equal(spy.chargedTotal(), 700);

      const r = await svc.reconcileUnsettledCharges({ olderThanMs: 0 });
      assert.equal(r.settled, 1);
      const done = (await prisma.payment.findUnique({ where: { id: co.body.data.id } }))!;
      assert.equal(done.status, 'succeeded');
      assert.ok(done.invoiceNumber);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
      assert.equal(spy.chargedTotal(), 700, 'đối soát không được trừ tiền lần nữa');
    });

    it('webhook: lưu type + payload + trạng thái; duplicate chỉ khi done / đang xử lý còn mới; processing quá hạn (process chết) được xử lý lại', async () => {
      const u = await c.registerUser('wh-status');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const ev = { id: 'evt_status_1', type: 'payment.succeeded', data: { paymentId: co.body.data.id, chargeId: 'ch_status_1' } };
      const a = await postWebhook(ev);
      assert.equal(a.status, 200);
      const row = (await prisma.webhookEvent.findUnique({ where: { eventId: ev.id } }))!;
      assert.equal(row.status, 'done');
      assert.equal(row.type, 'payment.succeeded');
      assert.deepEqual((row.payload as any).data.paymentId, co.body.data.id);
      assert.equal(row.attempts, 1);
      assert.equal((await postWebhook(ev)).body.duplicate, true);

      // Process chết sau khi claim (SIGTERM giữa chừng): hàng `processing` đã quá hạn => lần gửi lại KHÔNG bị coi là trùng.
      const u2 = await c.registerUser('wh-crash');
      const co2 = await c.call('POST', '/courses/ux/checkout', { token: u2.token, body: { method: 'stripe' } });
      const ev2 = { id: 'evt_crash_1', type: 'payment.succeeded', data: { paymentId: co2.body.data.id, chargeId: 'ch_crash_1' } };
      const old = new Date(Date.now() - 10 * 60_000);
      await prisma.webhookEvent.create({ data: { eventId: ev2.id, type: ev2.type, payload: ev2, status: 'processing', attempts: 1, processingAt: old, updatedAt: old } });
      const b = await postWebhook(ev2);
      assert.equal(b.status, 200);
      assert.equal(b.body.duplicate, undefined, 'processing quá hạn không phải duplicate');
      assert.equal(await enrollmentService.isEnrolled(u2.id, 'ux'), true);
      const row2 = (await prisma.webhookEvent.findUnique({ where: { eventId: ev2.id } }))!;
      assert.equal(row2.status, 'done');
      assert.equal(row2.attempts, 2);

      // Đang processing còn mới => bên kia đang xử lý: coi là trùng, không xử lý lần hai.
      const ev3 = { id: 'evt_fresh_1', type: 'payment.succeeded', data: { paymentId: 'khong-ton-tai' } };
      await prisma.webhookEvent.create({ data: { eventId: ev3.id, type: ev3.type, payload: ev3, status: 'processing', attempts: 1, processingAt: new Date() } });
      assert.equal((await postWebhook(ev3)).body.duplicate, true);
    });

    it('webhook lỗi xử lý => failed + lastError (không xóa, không "duplicate mãi mãi"); gửi lại xử lý được; reaper replay từ payload', async () => {
      const u = await c.registerUser('wh-fail');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const ev = { id: 'evt_fail_1', type: 'payment.succeeded', data: { paymentId: co.body.data.id, chargeId: 'ch_fail_1' } };
      await prisma.webhookEvent.create({ data: { eventId: ev.id, type: ev.type, payload: ev, status: 'failed', attempts: 1, lastError: 'boom', updatedAt: new Date(Date.now() - 60_000) } });
      const r = await paymentsService.reapStaleWebhooks({ staleMs: 0 });
      assert.ok(r.replayed >= 1);
      assert.equal((await prisma.webhookEvent.findUnique({ where: { eventId: ev.id } }))!.status, 'done');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), true);

      // Handler ném lỗi thật => failed.
      const bad = { id: 'evt_fail_2', type: 'payment.succeeded', data: { paymentId: 'x', chargeId: 'y' } };
      const failingRepo: typeof repo = { ...repo, findById: async () => { throw new Error('db down'); } };
      const svc = createPaymentsService(failingRepo, mockGateway);
      const raw = Buffer.from(JSON.stringify(bad));
      await assert.rejects(svc.handleWebhook(raw, signWebhookPayload(raw, 'test-webhook-secret')));
      const row = (await prisma.webhookEvent.findUnique({ where: { eventId: bad.id } }))!;
      assert.equal(row.status, 'failed');
      assert.match(row.lastError ?? '', /db down/);
      // Gửi lại: được nhận xử lý lại (không phải duplicate).
      const again = await postWebhook(bad);
      assert.equal(again.status, 200);
      assert.notEqual(again.body.duplicate, true);
    });

    it('stress: confirm (dùng thử -> trả phí) song song với processDueSubscriptions trên cùng gói — không deadlock, trạng thái nhất quán', async () => {
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
          ...users.map((u, i) => createPaymentsService(repo, mockGateway).confirm(intents[i]!.body.data.id, u.id)),
          createPaymentsService(repo, mockGateway).processDueSubscriptions(due),
          createPaymentsService(repo, mockGateway).processDueSubscriptions(due),
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
