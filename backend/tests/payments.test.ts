import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Phải đặt trước khi nạp app/env (dynamic import bên dưới).
const ADMIN_EMAIL = 'padmin-payments@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';

const DAY = 86_400_000;

describe('thanh toán, gói thành viên, hoàn tiền, webhook', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let paymentsService: typeof import('../src/modules/payments/payments.service.js').paymentsService;
  let mockGateway: typeof import('../src/modules/payments/payments.gateway.js').mockGateway;
  let signWebhookPayload: typeof import('../src/modules/payments/payments.gateway.js').signWebhookPayload;
  let admin: { token: string; id: string };

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ paymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ mockGateway, signWebhookPayload } = await import('../src/modules/payments/payments.gateway.js'));
    const r = await c.call('POST', '/auth/register', { body: { email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' } });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  /** checkout + confirm; trả về payment đã thành công. */
  async function pay(user: { token: string }, courseId: string, headers?: Record<string, string>) {
    const co = await c.call('POST', `/courses/${courseId}/checkout`, { token: user.token, body: { method: 'stripe' }, headers });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: user.token });
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data;
  }

  async function sendWebhook(event: unknown, opts: { secret?: string; ts?: number; signature?: string } = {}) {
    const raw = JSON.stringify(event);
    const sig = opts.signature ?? signWebhookPayload(raw, opts.secret ?? 'test-webhook-secret', opts.ts);
    const res = await fetch(`${server.baseUrl}/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sofin-signature': sig }, body: raw });
    return { status: res.status, body: await res.json() };
  }

  describe('checkout / confirm', () => {
    it('401 khi thiếu token, 404 khóa học lạ, 400 body sai / khóa miễn phí', async () => {
      assert.equal((await c.call('POST', '/courses/ai/checkout', { body: { method: 'stripe' } })).status, 401);
      const u = await c.registerUser('co');
      assert.equal((await c.call('POST', '/courses/nope/checkout', { token: u.token, body: { method: 'stripe' } })).status, 404);
      assert.equal((await c.call('POST', '/courses/ai/checkout', { token: u.token, body: { method: 'bitcoin' } })).status, 400);
      assert.equal((await c.call('POST', '/courses/photo/checkout', { token: u.token, body: { method: 'stripe' } })).status, 400);
    });

    it('happy path: giá lấy từ server, cấp quyền, số hóa đơn tuần tự, confirm 2 lần không tính phí trùng', async () => {
      const u = await c.registerUser('buyer');
      const co = await c.call('POST', '/courses/ai/checkout', { token: u.token, body: { method: 'stripe', amountUsd: 0.01, amountCents: 1 } });
      assert.equal(co.status, 201);
      assert.equal(co.body.data.status, 'pending');
      assert.equal(co.body.data.amountUsd, 7);
      assert.equal(co.body.data.amountCents, 700);
      assert.equal((await enrollmentService.isEnrolled(u.id, 'ai')), false);

      const cf1 = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: u.token });
      const cf2 = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: u.token });
      assert.equal(cf1.status, 200);
      assert.equal(cf1.body.data.status, 'succeeded');
      assert.match(cf1.body.data.invoiceNumber, /^INV-\d{4}-\d{6}$/);
      assert.equal(cf2.body.data.invoiceNumber, cf1.body.data.invoiceNumber);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);

      const sub = await c.call('GET', '/courses/ai/subscription', { token: u.token });
      assert.equal(sub.body.data.enrolled, true);
      assert.equal(sub.body.data.latestPayment.id, co.body.data.id);
      // Đã tham gia rồi thì checkout lại → 409.
      assert.equal((await c.call('POST', '/courses/ai/checkout', { token: u.token, body: { method: 'stripe' } })).status, 409);
    });

    it('confirm song song chỉ tạo 1 hóa đơn; người khác confirm → 403', async () => {
      const u = await c.registerUser('race');
      const co = await c.call('POST', '/courses/yt/checkout', { token: u.token, body: { method: 'stripe' } });
      const [a, b] = await Promise.all([
        c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: u.token }),
        c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: u.token }),
      ]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal(a.body.data.invoiceNumber, b.body.data.invoiceNumber);
      const other = await c.registerUser('other');
      assert.equal((await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: other.token })).status, 403);
      assert.equal((await c.call('POST', `/payments/khong-co/confirm`, { token: u.token })).status, 404);
    });

    it('Idempotency-Key: cùng key trả cùng giao dịch, key khác tạo giao dịch mới', async () => {
      const u = await c.registerUser('idem');
      const h = { 'Idempotency-Key': 'key-abc' };
      const a = await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' }, headers: h });
      const b = await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' }, headers: h });
      const d = await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' }, headers: { 'Idempotency-Key': 'key-xyz' } });
      assert.equal(a.body.data.id, b.body.data.id);
      assert.notEqual(a.body.data.id, d.body.data.id);
      // Cùng key nhưng khóa học khác → 409.
      const e = await c.call('POST', '/courses/mkt/checkout', { token: u.token, body: { method: 'stripe' }, headers: h });
      assert.equal(e.status, 409);
    });

    it('cổng từ chối thẻ → 402, giao dịch failed, không cấp quyền', async () => {
      const u = await c.registerUser('declined');
      mockGateway.failFor(u.id);
      const co = await c.call('POST', '/courses/des/checkout', { token: u.token, body: { method: 'stripe' } });
      const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: u.token });
      mockGateway.failFor(u.id, false);
      assert.equal(cf.status, 402);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'des'), false);
      const hist = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(hist.body.data[0].status, 'failed');
    });
  });

  describe('hủy / tiếp tục / dùng thử / gia hạn', () => {
    it('hủy cuối kỳ vẫn truy cập tới hết kỳ, resume được, hết kỳ thì mất quyền', async () => {
      const u = await c.registerUser('cancel');
      await pay(u, 'ai');
      assert.equal((await c.call('POST', '/courses/ai/subscription/resume', { token: u.token })).status, 409); // chưa hủy

      const cancel = await c.call('POST', '/courses/ai/subscription/cancel', { token: u.token, body: {} });
      assert.equal(cancel.status, 200);
      assert.equal(cancel.body.data.cancelAtPeriodEnd, true);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);

      const resume = await c.call('POST', '/courses/ai/subscription/resume', { token: u.token });
      assert.equal(resume.body.data.cancelAtPeriodEnd, false);

      await c.call('POST', '/courses/ai/subscription/cancel', { token: u.token, body: { atPeriodEnd: true } });
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      const subs = await c.call('GET', '/me/subscriptions', { token: u.token });
      assert.equal(subs.body.data[0].status, 'canceled');
      // Hết kỳ rồi thì không resume được.
      assert.equal((await c.call('POST', '/courses/ai/subscription/resume', { token: u.token })).status, 404);
    });

    it('hủy ngay mất quyền truy cập; không có gói → 404; 401; body sai 400', async () => {
      const u = await c.registerUser('cancelnow');
      assert.equal((await c.call('POST', '/courses/ai/subscription/cancel', { token: u.token, body: {} })).status, 404);
      assert.equal((await c.call('POST', '/courses/ai/subscription/cancel', { body: {} })).status, 401);
      await pay(u, 'ai');
      const r = await c.call('POST', '/courses/ai/subscription/cancel', { token: u.token, body: { atPeriodEnd: false } });
      assert.equal(r.body.data.status, 'canceled');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      assert.equal((await c.call('POST', '/courses/ai/subscription/cancel', { token: u.token, body: { atPeriodEnd: 'x' } })).status, 400);

    });

    it('dùng thử: 1 lần / cộng đồng, cấp quyền ngay, hết hạn thì thu hồi', async () => {
      const u = await c.registerUser('trial');
      assert.equal((await c.call('POST', '/courses/yoga/trial')).status, 401);
      assert.equal((await c.call('POST', '/courses/photo/trial', { token: u.token })).status, 400); // miễn phí
      assert.equal((await c.call('POST', '/courses/nope/trial', { token: u.token })).status, 404);

      const t = await c.call('POST', '/courses/yoga/trial', { token: u.token });
      assert.equal(t.status, 201);
      assert.equal(t.body.data.status, 'trialing');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'yoga'), true);
      assert.equal((await c.call('POST', '/courses/yoga/trial', { token: u.token })).status, 409); // đã tham gia

      const r = await paymentsService.processDueSubscriptions(new Date(Date.now() + 8 * DAY));
      assert.ok(r.trialsExpired >= 1);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'yoga'), false);
      assert.equal((await c.call('GET', '/me/subscriptions', { token: u.token })).body.data[0].status, 'expired');
      assert.equal((await c.call('POST', '/courses/yoga/trial', { token: u.token })).status, 409); // đã dùng thử rồi
    });

    it('dùng thử rồi thanh toán → chuyển thành gói active, không bị thu hồi khi hết hạn dùng thử', async () => {
      const u = await c.registerUser('convert');
      await c.call('POST', '/courses/cook/trial', { token: u.token });
      await pay(u, 'cook'); // checkout khi đang dùng thử được phép
      const sub = (await c.call('GET', '/me/subscriptions', { token: u.token })).body.data[0];
      assert.equal(sub.status, 'active');
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 8 * DAY));
      assert.equal(await enrollmentService.isEnrolled(u.id, 'cook'), true);
    });

    it('gia hạn tạo giao dịch mới mỗi kỳ; thẻ bị từ chối khi gia hạn → hết hạn + thu hồi', async () => {
      const u = await c.registerUser('renew');
      await pay(u, 'data');
      const r = await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.ok(r.renewed >= 1);
      const hist = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(hist.body.meta.total, 2);
      assert.deepEqual(hist.body.data.map((p: any) => p.kind).sort(), ['initial', 'renewal']);
      assert.notEqual(hist.body.data[0].invoiceNumber, hist.body.data[1].invoiceNumber);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'data'), true);

      const f = await c.registerUser('renewfail');
      await pay(f, 'write');
      mockGateway.failFor(f.id);
      const r2 = await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      mockGateway.failFor(f.id, false);
      assert.ok(r2.renewalFailed >= 1);
      assert.equal(await enrollmentService.isEnrolled(f.id, 'write'), false);
    });
  });

  describe('lịch sử & hóa đơn', () => {
    it('phân trang /me/payments, 401, 400 query sai', async () => {
      const u = await c.registerUser('hist');
      await pay(u, 'ai');
      await c.call('POST', '/courses/ai/subscription/cancel', { token: u.token, body: { atPeriodEnd: false } });
      await pay(u, 'ai');
      const p1 = await c.call('GET', '/me/payments?page=1&limit=1', { token: u.token });
      assert.equal(p1.body.data.length, 1);
      assert.equal(p1.body.meta.total, 2);
      assert.equal(p1.body.meta.totalPages, 2);
      assert.equal((await c.call('GET', '/me/payments')).status, 401);
      assert.equal((await c.call('GET', '/me/payments?limit=0', { token: u.token })).status, 400);
    });

    it('hóa đơn: chủ giao dịch / owner cộng đồng / platform admin được xem; người khác 403', async () => {
      const buyer = await c.registerUser('inv');
      const payment = await pay(buyer, 'lead');
      const owner = await c.registerUser('invowner');
      await enrollmentService.grant(owner.id, 'lead', 'owner');
      const adminMember = await c.registerUser('invadmin');
      await enrollmentService.grant(adminMember.id, 'lead', 'admin');

      const mine = await c.call('GET', `/payments/${payment.id}/invoice`, { token: buyer.token });
      assert.equal(mine.status, 200);
      assert.equal(mine.body.data.invoiceNumber, payment.invoiceNumber);
      assert.equal(mine.body.data.totalCents, 1000);
      assert.equal(mine.body.data.buyer.id, buyer.id);
      assert.equal(mine.body.data.community.id, 'lead');
      assert.equal(mine.body.data.items.length, 1);
      assert.equal(mine.body.data.status, 'succeeded');

      assert.equal((await c.call('GET', `/payments/${payment.id}/invoice`, { token: owner.token })).status, 200);
      assert.equal((await c.call('GET', `/payments/${payment.id}/invoice`, { token: admin.token })).status, 200);
      assert.equal((await c.call('GET', `/payments/${payment.id}/invoice`, { token: adminMember.token })).status, 403);
      const stranger = await c.registerUser('inv-stranger');
      assert.equal((await c.call('GET', `/payments/${payment.id}/invoice`, { token: stranger.token })).status, 403);
      assert.equal((await c.call('GET', `/payments/${payment.id}/invoice`)).status, 401);
      assert.equal((await c.call('GET', `/payments/nope/invoice`, { token: buyer.token })).status, 404);

      // Giao dịch chưa thanh toán chưa có hóa đơn.
      const s = await c.registerUser('inv-pending');
      const co = await c.call('POST', '/courses/lead/checkout', { token: s.token, body: { method: 'stripe' } });
      assert.equal((await c.call('GET', `/payments/${co.body.data.id}/invoice`, { token: s.token })).status, 409);
    });
  });

  describe('hoàn tiền', () => {
    it('trong cửa sổ hoàn tiền: tự duyệt, giao dịch refunded, thu hồi quyền; không hoàn 2 lần', async () => {
      const u = await c.registerUser('refund-in');
      const payment = await pay(u, 'ai');
      assert.equal((await c.call('POST', `/payments/${payment.id}/refund-request`, { body: { reason: 'không cần' } })).status, 401);
      assert.equal((await c.call('POST', `/payments/${payment.id}/refund-request`, { token: u.token, body: {} })).status, 400);
      const other = await c.registerUser('refund-other');
      assert.equal((await c.call('POST', `/payments/${payment.id}/refund-request`, { token: other.token, body: { reason: 'thử xem' } })).status, 403);

      const r = await c.call('POST', `/payments/${payment.id}/refund-request`, { token: u.token, body: { reason: 'Không phù hợp' } });
      assert.equal(r.status, 201);
      assert.equal(r.body.data.status, 'approved');
      assert.equal(r.body.data.auto, true);
      assert.equal(r.body.data.amountCents, 700);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      const hist = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(hist.body.data[0].status, 'refunded');
      assert.equal(hist.body.data[0].refundedCents, 700);
      assert.equal((await c.call('POST', `/payments/${payment.id}/refund-request`, { token: u.token, body: { reason: 'lần nữa' } })).status, 409);
    });

    it('ngoài cửa sổ: chuyển pending, Platform Admin duyệt / từ chối; người thường 403', async () => {
      const u = await c.registerUser('refund-out');
      const payment = await pay(u, 'ai');
      // Giả lập yêu cầu sau 10 ngày (cửa sổ mặc định 7 ngày).
      const pending = await paymentsService.requestRefund(payment.id, u.id, 'Muộn rồi', new Date(Date.now() + 10 * DAY));
      assert.equal(pending.status, 'pending');
      assert.equal(pending.auto, false);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);

      assert.equal((await c.call('GET', '/admin/refunds', { token: u.token })).status, 403);
      assert.equal((await c.call('PATCH', `/admin/refunds/${pending.id}`, { token: u.token, body: { action: 'approve' } })).status, 403);
      assert.equal((await c.call('GET', '/admin/refunds')).status, 401);

      const list = await c.call('GET', '/admin/refunds?status=pending', { token: admin.token });
      assert.equal(list.status, 200);
      assert.ok(list.body.data.some((x: any) => x.id === pending.id));
      assert.equal((await c.call('GET', '/admin/refunds?status=bogus', { token: admin.token })).status, 400);

      const approved = await c.call('PATCH', `/admin/refunds/${pending.id}`, { token: admin.token, body: { action: 'approve', note: 'Ngoại lệ' } });
      assert.equal(approved.status, 200);
      assert.equal(approved.body.data.status, 'approved');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      // Đã xử lý rồi → 409.
      assert.equal((await c.call('PATCH', `/admin/refunds/${pending.id}`, { token: admin.token, body: { action: 'reject' } })).status, 409);
      assert.equal((await c.call('PATCH', `/admin/refunds/nope`, { token: admin.token, body: { action: 'reject' } })).status, 404);

      const u2 = await c.registerUser('refund-out2');
      const p2 = await pay(u2, 'ai');
      const pend2 = await paymentsService.requestRefund(p2.id, u2.id, 'Muộn', new Date(Date.now() + 10 * DAY));
      const rej = await c.call('PATCH', `/admin/refunds/${pend2.id}`, { token: admin.token, body: { action: 'reject', note: 'Quá hạn' } });
      assert.equal(rej.body.data.status, 'rejected');
      assert.equal(await enrollmentService.isEnrolled(u2.id, 'ai'), true);
    });
  });

  describe('webhook', () => {
    it('chữ ký đúng: payment.succeeded cấp quyền; gửi lại cùng event id → 200 không tác dụng phụ', async () => {
      const u = await c.registerUser('wh');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const before = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(before.body.data[0].status, 'pending');
      const event = { id: 'evt_ok_1', type: 'payment.succeeded', data: { paymentId: co.body.data.id, chargeId: 'ch_real_1' } };
      const a = await sendWebhook(event);
      assert.equal(a.status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), true);
      const inv1 = (await c.call('GET', '/me/payments', { token: u.token })).body.data[0].invoiceNumber;

      const b = await sendWebhook(event);
      assert.equal(b.status, 200);
      assert.equal(b.body.duplicate, true);
      const inv2 = (await c.call('GET', '/me/payments', { token: u.token })).body.data[0].invoiceNumber;
      assert.equal(inv1, inv2);
    });

    it('chữ ký sai / thiếu / secret khác → 400 chung chung, không đổi dữ liệu', async () => {
      const u = await c.registerUser('wh-bad');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const event = { id: 'evt_bad_1', type: 'payment.succeeded', data: { paymentId: co.body.data.id } };
      const wrong = await sendWebhook(event, { secret: 'sai-secret' });
      assert.equal(wrong.status, 400);
      assert.doesNotMatch(JSON.stringify(wrong.body), /signature|secret|hmac/i);
      assert.equal((await sendWebhook(event, { signature: 'rác' })).status, 400);
      const noHeader = await fetch(`${server.baseUrl}/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
      assert.equal(noHeader.status, 400);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);
    });

    it('chống replay: timestamp cũ hơn 5 phút bị từ chối; sửa body sau khi ký cũng bị từ chối', async () => {
      const u = await c.registerUser('wh-replay');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const event = { id: 'evt_replay_1', type: 'payment.succeeded', data: { paymentId: co.body.data.id } };
      const old = Math.floor(Date.now() / 1000) - 10 * 60;
      assert.equal((await sendWebhook(event, { ts: old })).status, 400);
      const future = Math.floor(Date.now() / 1000) + 10 * 60;
      assert.equal((await sendWebhook(event, { ts: future })).status, 400);
      // Ký body A rồi gửi body B.
      const sig = signWebhookPayload(JSON.stringify(event), 'test-webhook-secret');
      const tampered = { ...event, data: { paymentId: co.body.data.id, extra: 1 } };
      assert.equal((await sendWebhook(tampered, { signature: sig })).status, 400);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);
      // Timestamp trong dung sai vẫn được (lệch 2 phút).
      assert.equal((await sendWebhook(event, { ts: Math.floor(Date.now() / 1000) - 120 })).status, 200);
    });

    it('payment.failed, payment.refunded, subscription.canceled, subscription.renewed, loại lạ', async () => {
      const u = await c.registerUser('wh-types');
      const f = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      assert.equal((await sendWebhook({ id: 'evt_t1', type: 'payment.failed', data: { paymentId: f.body.data.id, reason: 'expired_card' } })).status, 200);
      assert.equal((await c.call('GET', '/me/payments', { token: u.token })).body.data[0].status, 'failed');

      const p = await pay(u, 'ux');
      assert.equal((await sendWebhook({ id: 'evt_t2', type: 'payment.refunded', data: { paymentId: p.id } })).status, 200);
      assert.equal((await c.call('GET', '/me/payments', { token: u.token })).body.data[0].status, 'refunded');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);

      const v = await c.registerUser('wh-sub');
      await pay(v, 'ux');
      const subId = (await c.call('GET', '/me/subscriptions', { token: v.token })).body.data[0].id;
      assert.equal((await sendWebhook({ id: 'evt_t3', type: 'subscription.renewed', data: { subscriptionId: subId, chargeId: 'ch_r' } })).status, 200);
      assert.equal((await c.call('GET', '/me/payments', { token: v.token })).body.meta.total, 2);
      assert.equal((await sendWebhook({ id: 'evt_t4', type: 'subscription.canceled', data: { subscriptionId: subId } })).status, 200);
      assert.equal(await enrollmentService.isEnrolled(v.id, 'ux'), false);

      assert.equal((await sendWebhook({ id: 'evt_t5', type: 'something.else', data: {} })).status, 200);
      assert.equal((await sendWebhook({ id: 'evt_t6', type: 'payment.succeeded', data: { paymentId: 'khong-ton-tai' } })).status, 200);
      // Body không hợp lệ (thiếu id) dù chữ ký đúng → 400.
      assert.equal((await sendWebhook({ type: 'payment.succeeded' })).status, 400);
    });
  });

  describe('đồng thời (DB thật): idempotency, confirm, hóa đơn, webhook, hoàn tiền, gia hạn', () => {
    let prisma: typeof import('../src/db/prisma.js').prisma;
    let repo: typeof import('../src/modules/payments/payments.repository.js').paymentsRepository;
    let createPaymentsService: typeof import('../src/modules/payments/payments.service.js').createPaymentsService;
    before(async () => {
      ({ prisma } = await import('../src/db/prisma.js'));
      ({ paymentsRepository: repo } = await import('../src/modules/payments/payments.repository.js'));
      ({ createPaymentsService } = await import('../src/modules/payments/payments.service.js'));
    });

    it('2 checkout song song cùng Idempotency-Key: cùng giao dịch, DB chỉ 1 Payment + 1 IdempotencyKey; key dùng cho khóa khác → 409', async () => {
      const u = await c.registerUser('idem-race');
      const h = { 'Idempotency-Key': 'race-key-1' };
      const rs = await Promise.all(Array.from({ length: 5 }, () => c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' }, headers: h })));
      for (const r of rs) assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(new Set(rs.map((r) => r.body.data.id)).size, 1);
      assert.equal(await prisma.payment.count({ where: { userId: u.id } }), 1);
      assert.equal(await prisma.idempotencyKey.count({ where: { userId: u.id } }), 1);
      const other = await c.call('POST', '/courses/mkt/checkout', { token: u.token, body: { method: 'stripe' }, headers: h });
      assert.equal(other.status, 409);
      // Cùng key nhưng người dùng khác là khóa khác (PK là (userId,key)).
      const u2 = await c.registerUser('idem-race2');
      const r2 = await c.call('POST', '/courses/mkt/checkout', { token: u2.token, body: { method: 'stripe' }, headers: h });
      assert.equal(r2.status, 201);
    });

    it('2 confirm song song (2 instance service, không chung promise) chỉ ghi nhận 1 lần: 1 hóa đơn, 1 gói, số hóa đơn tăng đúng 1', async () => {
      const u = await c.registerUser('confirm-race');
      const co = await c.call('POST', '/courses/lead/checkout', { token: u.token, body: { method: 'stripe' } });
      const s1 = createPaymentsService(repo, mockGateway);
      const s2 = createPaymentsService(repo, mockGateway);
      const year = new Date().getUTCFullYear();
      const before = (await prisma.invoiceSequence.findUnique({ where: { year } }))?.lastNumber ?? 0;
      const [a, b] = await Promise.all([s1.confirm(co.body.data.id, u.id), s2.confirm(co.body.data.id, u.id)]);
      assert.equal(a.status, 'succeeded');
      assert.equal(b.status, 'succeeded');
      assert.equal(a.invoiceNumber, b.invoiceNumber);
      const after = (await prisma.invoiceSequence.findUnique({ where: { year } }))!.lastNumber;
      assert.equal(after, before + 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id, courseId: 'lead' } }), 1);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.enrollment.count({ where: { userId: u.id, courseId: 'lead' } }), 1);
    });

    it('số hóa đơn tuần tự, không trùng, không hở dưới đồng thời; reset theo năm', async () => {
      const users = await Promise.all(Array.from({ length: 8 }, (_, i) => c.registerUser(`inv-seq${i}`)));
      const cos = await Promise.all(users.map((u) => c.call('POST', '/courses/write/checkout', { token: u.token, body: { method: 'stripe' } })));
      const rs = await Promise.all(users.map((u, i) => c.call('POST', `/payments/${cos[i]!.body.data.id}/confirm`, { token: u.token })));
      const nums = rs.map((r) => r.body.data.invoiceNumber as string);
      assert.equal(new Set(nums).size, 8);
      const n = nums.map((x) => Number(x.split('-')[2])).sort((x, y) => x - y);
      for (let i = 1; i < n.length; i++) assert.equal(n[i], n[i - 1]! + 1, `hở số hóa đơn: ${n.join(',')}`);
      // Năm khác có dãy riêng, bắt đầu từ 1.
      const y = await Promise.all([1, 2, 3].map(() => repo.nextInvoiceNumber(2098)));
      assert.deepEqual(y.sort(), ['INV-2098-000001', 'INV-2098-000002', 'INV-2098-000003']);
      assert.equal(await repo.nextInvoiceNumber(2099), 'INV-2099-000001');
    });

    it('webhook gửi trùng song song cùng event id: đúng 1 bên xử lý, còn lại duplicate; chỉ 1 hóa đơn', async () => {
      const u = await c.registerUser('wh-race');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const event = { id: 'evt_race_1', type: 'payment.succeeded', data: { paymentId: co.body.data.id, chargeId: 'ch_race' } };
      const rs = await Promise.all(Array.from({ length: 6 }, () => sendWebhook(event)));
      for (const r of rs) assert.equal(r.status, 200);
      assert.equal(rs.filter((r) => r.body.duplicate === true).length, 5);
      assert.equal(await prisma.webhookEvent.count({ where: { eventId: 'evt_race_1' } }), 1);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded', invoiceNumber: { not: null } } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1);
    });

    it('2 yêu cầu hoàn tiền song song chỉ tạo 1; 2 admin duyệt song song chỉ 1 thắng (cổng hoàn 1 lần); cổng từ chối hoàn ⇒ rollback nguyên vẹn', async () => {
      const u = await c.registerUser('refund-race');
      const p = await pay(u, 'ai');
      const [r1, r2] = await Promise.all([
        c.call('POST', `/payments/${p.id}/refund-request`, { token: u.token, body: { reason: 'song song 1' } }),
        c.call('POST', `/payments/${p.id}/refund-request`, { token: u.token, body: { reason: 'song song 2' } }),
      ]);
      assert.deepEqual([r1.status, r2.status].sort(), [201, 409]);
      assert.equal(await prisma.refundRequest.count({ where: { paymentId: p.id } }), 1);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);

      // Duyệt song song một yêu cầu pending (ngoài cửa sổ).
      const v = await c.registerUser('refund-race2');
      const pv = await pay(v, 'ai');
      const pending = await paymentsService.requestRefund(pv.id, v.id, 'Muộn', new Date(Date.now() + 10 * DAY));
      const calls: number[] = [];
      const spy = { createCharge: (x: any) => mockGateway.createCharge(x), verifyWebhookSignature: () => false, refund: async (ch: string, amt: number) => { calls.push(amt); return mockGateway.refund(ch, amt); } };
      const svc = createPaymentsService(repo, spy);
      const res = await Promise.allSettled([svc.resolveRefund(admin.id, pending.id, 'approve'), svc.resolveRefund(admin.id, pending.id, 'approve')]);
      assert.equal(res.filter((x) => x.status === 'fulfilled').length, 1);
      assert.equal(res.filter((x) => x.status === 'rejected' && (x.reason as any).status === 409).length, 1);
      assert.equal(calls.length, 1);
      assert.equal(await enrollmentService.isEnrolled(v.id, 'ai'), false);

      // Cổng từ chối hoàn tiền: toàn bộ rollback (giao dịch vẫn succeeded, còn quyền, không có RefundRequest mồ côi).
      const w = await c.registerUser('refund-gw-fail');
      const pw = await pay(w, 'ai');
      const failing = createPaymentsService(repo, { ...spy, refund: async () => ({ ok: false, refundId: '' }) });
      await assert.rejects(failing.requestRefund(pw.id, w.id, 'thử'), (e: any) => e.status === 502);
      assert.equal((await prisma.payment.findUnique({ where: { id: pw.id } }))!.status, 'succeeded');
      assert.equal(await prisma.refundRequest.count({ where: { paymentId: pw.id } }), 0);
      assert.equal(await enrollmentService.isEnrolled(w.id, 'ai'), true);
    });

    it('2 processDueSubscriptions song song không gia hạn kép (SKIP LOCKED): mỗi gói đúng 1 giao dịch gia hạn', async () => {
      const users = await Promise.all(Array.from({ length: 4 }, (_, i) => c.registerUser(`due-race${i}`)));
      for (const u of users) await pay(u, 'data');
      const now = new Date(Date.now() + 31 * DAY);
      const due = await prisma.subscription.count({ where: { status: { in: ['active', 'trialing'] }, currentPeriodEnd: { lte: now } } });
      const [a, b] = await Promise.all([createPaymentsService(repo, mockGateway).processDueSubscriptions(now), createPaymentsService(repo, mockGateway).processDueSubscriptions(now)]);
      const handled = (r: typeof a) => r.renewed + r.renewalFailed + r.trialsExpired + r.ended;
      assert.equal(handled(a) + handled(b), due);
      for (const u of users) {
        assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal', status: 'succeeded' } }), 1);
        const sub = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
        assert.ok(sub.currentPeriodEnd.getTime() > now.getTime());
      }
      const invs = await prisma.payment.findMany({ where: { userId: { in: users.map((u) => u.id) }, invoiceNumber: { not: null } }, select: { invoiceNumber: true } });
      assert.equal(new Set(invs.map((x) => x.invoiceNumber)).size, invs.length);
    });
  });
});
