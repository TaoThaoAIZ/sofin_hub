import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Phải đặt trước khi nạp app/env (dynamic import bên dưới).
const ADMIN_EMAIL = 'padmin-payments@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

const DAY = 86_400_000;

describe('thanh toán chuyển khoản, gói thành viên, hoàn tiền, webhook SePay', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let paymentsService: typeof import('../src/modules/payments/payments.service.js').paymentsService;
  let bankGateway: typeof import('../src/modules/payments/payments.gateway.js').bankGateway;
  let prisma: typeof import('../src/db/prisma.js').prisma;
  let repo: typeof import('../src/modules/payments/payments.repository.js').paymentsRepository;
  let createPaymentsService: typeof import('../src/modules/payments/payments.service.js').createPaymentsService;
  let admin: { token: string; id: string };

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ paymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ bankGateway } = await import('../src/modules/payments/payments.gateway.js'));
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ paymentsRepository: repo } = await import('../src/modules/payments/payments.repository.js'));
    ({ createPaymentsService } = await import('../src/modules/payments/payments.service.js'));
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  /** checkout + confirm; trả về payment đã thành công. */
  async function pay(user: { token: string }, courseId: string, headers?: Record<string, string>) {
    const co = await c.call('POST', `/courses/${courseId}/checkout`, { token: user.token, body: { method: 'stripe' }, headers });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.payIntent(co.body.data.id, user.token);
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data;
  }

  let txN = 0;
  const txId = (p = 'PT') => `${p}${Date.now()}${++txN}`;
  /** Header xác thực webhook SePay (cho test gọi thẳng service, không qua HTTP). */
  const authHeader = () => `Apikey ${process.env.SEPAY_WEBHOOK_KEY}`;
  /** Cổng "quan sát" hoàn tiền: ghi lại mọi lần gọi (cùng idempotency key = cùng 1 khoản hoàn ở bankGateway). */
  function spyRefunds() {
    const calls: number[] = [];
    return { calls, gw: { refund: async (ch: string, amt: number, key: string) => { calls.push(amt); return bankGateway.refund(ch, amt, key); } } };
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
      assert.equal(co.body.data.amountUsd, 175_000);
      assert.equal(co.body.data.amountCents, 175_000);
      assert.equal(co.body.data.method, 'bank_transfer');
      assert.ok(co.body.data.refCode && co.body.data.transfer);
      assert.equal((await enrollmentService.isEnrolled(u.id, 'ai')), false);

      const cf1 = await c.payIntent(co.body.data.id, u.token);
      const cf2 = await c.payIntent(co.body.data.id, u.token);
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
        c.payIntent(co.body.data.id, u.token),
        c.payIntent(co.body.data.id, u.token),
      ]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal(a.body.data.invoiceNumber, b.body.data.invoiceNumber);
      const other = await c.registerUser('other');
      assert.equal((await c.payIntent(co.body.data.id, other.token)).status, 403);
      assert.equal((await c.call('POST', `/payments/khong-co/confirm`, { token: u.token })).status, 404);
    });

    it('Idempotency-Key: cùng key trả cùng giao dịch, key khác tạo giao dịch mới', async () => {
      const u = await c.registerUser('idem');
      const h = { 'Idempotency-Key': 'key-abc' };
      const a = await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' }, headers: h });
      const b = await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' }, headers: h });
      const d = await c.call('POST', '/courses/biz/checkout', { token: u.token, body: { method: 'stripe' }, headers: { 'Idempotency-Key': 'key-xyz' } });
      assert.equal(a.body.data.id, b.body.data.id);
      // Key khác nhưng vẫn còn intent pending chưa hết hạn cho cùng (user, course): tái dùng intent đó (chống 2 intent song song → double-charge).
      assert.equal(a.body.data.id, d.body.data.id);
      // Cùng key nhưng khóa học khác → 409.
      const e = await c.call('POST', '/courses/mkt/checkout', { token: u.token, body: { method: 'stripe' }, headers: h });
      assert.equal(e.status, 409);
    });

    it('chuyển thiếu tiền → giao dịch vẫn pending, không cấp quyền (thay cho thẻ bị từ chối)', async () => {
      const u = await c.registerUser('underpaid');
      const co = await c.call('POST', '/courses/des/checkout', { token: u.token, body: { method: 'stripe' } });
      const cf = await c.payIntent(co.body.data.id, u.token, { amount: co.body.data.amountCents - 1000 });
      assert.equal(cf.status, 200);
      assert.equal(cf.body.data.status, 'pending');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'des'), false);
      const hist = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(hist.body.data[0].status, 'pending');
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

    it('gia hạn = hóa đơn QR mỗi kỳ (trả tiền mới nối kỳ); không trả → hết hạn + thu hồi quyền', async () => {
      const u = await c.registerUser('renew');
      await pay(u, 'data');
      const sub0 = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
      const nearEnd = new Date(sub0.currentPeriodEnd.getTime() - DAY);
      const r = await paymentsService.issueRenewalInvoices(nearEnd);
      assert.ok(r.issued >= 1);
      const inv = await prisma.payment.findFirstOrThrow({ where: { userId: u.id, kind: 'renewal' } });
      assert.equal(inv.status, 'pending');
      // Chưa trả tiền thì chưa có giao dịch gia hạn thành công.
      assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal', status: 'succeeded' } }), 0);
      const w = await c.bankWebhook(c.sepayTx({ id: txId(), refCode: inv.refCode!, amount: inv.amountCents }));
      assert.equal(w.status, 200);
      const hist = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(hist.body.meta.total, 2);
      assert.deepEqual(hist.body.data.map((p: any) => p.kind).sort(), ['initial', 'renewal']);
      assert.notEqual(hist.body.data[0].invoiceNumber, hist.body.data[1].invoiceNumber);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'data'), true);
      const sub1 = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
      assert.equal(sub1.currentPeriodEnd.getTime() - sub0.currentPeriodEnd.getTime(), 30 * DAY);

      // Không trả hóa đơn gia hạn (quá hết kỳ + ân hạn) → hết hạn, thu hồi quyền.
      const f = await c.registerUser('renewfail');
      await pay(f, 'write');
      const fsub = (await prisma.subscription.findFirst({ where: { userId: f.id } }))!;
      await paymentsService.issueRenewalInvoices(new Date(fsub.currentPeriodEnd.getTime() - DAY));
      const r2 = await paymentsService.processDueSubscriptions(new Date(fsub.currentPeriodEnd.getTime() + 3 * DAY));
      assert.ok(r2.renewalFailed >= 1);
      assert.equal(await enrollmentService.isEnrolled(f.id, 'write'), false);
      assert.equal((await prisma.subscription.findFirst({ where: { userId: f.id } }))!.status, 'expired');
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
      const payment = await pay(buyer, 'des');
      const owner = await c.registerUser('invowner');
      await enrollmentService.grant(owner.id, 'des', 'owner');
      const adminMember = await c.registerUser('invadmin');
      await enrollmentService.grant(adminMember.id, 'des', 'admin');

      const mine = await c.call('GET', `/payments/${payment.id}/invoice`, { token: buyer.token });
      assert.equal(mine.status, 200);
      assert.equal(mine.body.data.invoiceNumber, payment.invoiceNumber);
      assert.equal(mine.body.data.totalCents, 250_000);
      assert.equal(mine.body.data.buyer.id, buyer.id);
      assert.equal(mine.body.data.community.id, 'des');
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
      const co = await c.call('POST', '/courses/des/checkout', { token: s.token, body: { method: 'stripe' } });
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
      assert.equal(r.body.data.amountCents, 175_000);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      const hist = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(hist.body.data[0].status, 'refunded');
      assert.equal(hist.body.data[0].refundedCents, 175_000);
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

  describe('webhook SePay', () => {
    it('key đúng: tiền về cấp quyền; gửi lại cùng giao dịch → 200 không tác dụng phụ (không cấp / không hóa đơn lần 2)', async () => {
      const u = await c.registerUser('wh');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const before = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(before.body.data[0].status, 'pending');
      const tx = c.sepayTx({ id: txId(), refCode: co.body.data.refCode, amount: co.body.data.amountCents });
      const a = await c.bankWebhook(tx);
      assert.equal(a.status, 200);
      assert.equal(a.body.message, 'credited');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), true);
      const inv1 = (await c.call('GET', '/me/payments', { token: u.token })).body.data[0].invoiceNumber;

      const b = await c.bankWebhook(tx);
      assert.equal(b.status, 200);
      assert.equal(b.body.message, 'already');
      const inv2 = (await c.call('GET', '/me/payments', { token: u.token })).body.data[0].invoiceNumber;
      assert.equal(inv1, inv2);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
    });

    it('key sai / thiếu → 401 chung chung, không đổi dữ liệu', async () => {
      const u = await c.registerUser('wh-bad');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const tx = c.sepayTx({ id: txId(), refCode: co.body.data.refCode, amount: co.body.data.amountCents });
      const wrong = await c.bankWebhook(tx, { key: 'sai-key' });
      assert.equal(wrong.status, 401);
      assert.doesNotMatch(JSON.stringify(wrong.body), /apikey|secret|hmac|SEPAY/i);
      assert.equal((await c.bankWebhook(tx, { key: null })).status, 401);
      const noHeader = await fetch(`${server.baseUrl}/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) });
      assert.equal(noHeader.status, 401);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);
      assert.equal(await prisma.bankTransaction.count({ where: { externalId: tx.id } }), 0, 'request bị từ chối không được ghi gì');
    });

    it('phiên hết hạn → failed; tiền RA / body thiếu id bị bỏ qua (200); mã lạ chỉ được lưu để admin soi', async () => {
      const u = await c.registerUser('wh-types');
      const f = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      await prisma.payment.update({ where: { id: f.body.data.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await paymentsService.expireStaleSessions()).expired >= 1, true);
      const row = (await c.call('GET', '/me/payments', { token: u.token })).body.data[0];
      assert.equal(row.status, 'failed');
      assert.equal(row.failureReason, 'expired');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);

      const out = await c.bankWebhook({ ...c.sepayTx({ id: txId('O'), refCode: f.body.data.refCode, amount: 1000 }), transferType: 'out' });
      assert.equal(out.status, 200);
      assert.equal(out.body.message, 'bỏ qua (không phải tiền vào)');
      const noId = await c.bankWebhook({ transferType: 'in', transferAmount: 1000, content: 'x' });
      assert.equal(noId.status, 200);
      assert.equal(noId.body.message, 'bỏ qua (không phải tiền vào)');
      const unknown = await c.bankWebhook(c.sepayTx({ id: txId(), refCode: 'SFHZZZZZZZZ', amount: 1000 }));
      assert.equal(unknown.status, 200);
      assert.equal(unknown.body.message, 'unmatched');
    });

    it('đã hoàn tiền (refunded) rồi nhận thêm giao dịch cùng mã: ghi nhận chuyển trùng, KHÔNG cấp lại quyền', async () => {
      const u = await c.registerUser('wh-refunded');
      const p = await pay(u, 'ux');
      await c.call('POST', `/payments/${p.id}/refund-request`, { token: u.token, body: { reason: 'không cần' } });
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);
      const dup = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents });
      assert.equal((await c.bankWebhook(dup)).body.message, 'duplicate');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ux'), false);
      assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status, 'refunded');
    });
  });

  describe('đồng thời (DB thật): idempotency, confirm, hóa đơn, webhook, hoàn tiền, gia hạn', () => {
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

    it('2 webhook song song (2 instance service, không chung promise) chỉ ghi nhận 1 lần: 1 hóa đơn, 1 gói, số hóa đơn tăng đúng 1', async () => {
      const u = await c.registerUser('confirm-race');
      const co = await c.call('POST', '/courses/des/checkout', { token: u.token, body: { method: 'stripe' } });
      const s1 = createPaymentsService(repo, bankGateway);
      const s2 = createPaymentsService(repo, bankGateway);
      const year = new Date().getUTCFullYear();
      const before = (await prisma.invoiceSequence.findUnique({ where: { year } }))?.lastNumber ?? 0;
      const ref = co.body.data.refCode;
      const amt = co.body.data.amountCents;
      // Hai giao dịch ngân hàng KHÁC nhau cùng trỏ vào 1 phiên (khách chuyển 2 lần sát nhau) + hai instance: vẫn chỉ cấp 1 lần.
      await Promise.all([
        s1.handleBankWebhook(authHeader(), c.sepayTx({ id: txId(), refCode: ref, amount: amt })),
        s2.handleBankWebhook(authHeader(), c.sepayTx({ id: txId(), refCode: ref, amount: amt })),
      ]);
      const p = await prisma.payment.findUniqueOrThrow({ where: { id: co.body.data.id } });
      assert.equal(p.status, 'succeeded');
      assert.match(p.invoiceNumber ?? '', /^INV-/);
      const after = (await prisma.invoiceSequence.findUnique({ where: { year } }))!.lastNumber;
      assert.equal(after, before + 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id, communityId: 'des' } }), 1);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.enrollment.count({ where: { userId: u.id, communityId: 'des' } }), 1);
    });

    it('số hóa đơn tuần tự, không trùng, không hở dưới đồng thời; reset theo năm', async () => {
      const users = await Promise.all(Array.from({ length: 8 }, (_, i) => c.registerUser(`inv-seq${i}`)));
      const cos = await Promise.all(users.map((u) => c.call('POST', '/courses/write/checkout', { token: u.token, body: { method: 'stripe' } })));
      const rs = await Promise.all(users.map((u, i) => c.payIntent(cos[i]!.body.data.id, u.token)));
      const nums = rs.map((r) => r.body.data.invoiceNumber as string);
      assert.equal(new Set(nums).size, 8);
      const n = nums.map((x) => Number(x.split('-')[2])).sort((x, y) => x - y);
      for (let i = 1; i < n.length; i++) assert.equal(n[i], n[i - 1]! + 1, `hở số hóa đơn: ${n.join(',')}`);
      // Năm khác có dãy riêng, bắt đầu từ 1.
      const y = await Promise.all([1, 2, 3].map(() => repo.nextInvoiceNumber(2098)));
      assert.deepEqual(y.sort(), ['INV-2098-000001', 'INV-2098-000002', 'INV-2098-000003']);
      assert.equal(await repo.nextInvoiceNumber(2099), 'INV-2099-000001');
    });

    it('webhook gửi trùng song song cùng giao dịch: chỉ 1 BankTransaction, 1 lần cấp, 1 hóa đơn', async () => {
      const u = await c.registerUser('wh-race');
      const co = await c.call('POST', '/courses/ux/checkout', { token: u.token, body: { method: 'stripe' } });
      const tx = c.sepayTx({ id: txId('WR'), refCode: co.body.data.refCode, amount: co.body.data.amountCents });
      const rs = await Promise.all(Array.from({ length: 6 }, () => c.bankWebhook(tx)));
      for (const r of rs) assert.equal(r.status, 200);
      assert.equal(await prisma.bankTransaction.count({ where: { externalId: tx.id } }), 1);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded', invoiceNumber: { not: null } } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1);
    });

    it('2 yêu cầu hoàn tiền song song chỉ tạo 1; 2 admin duyệt song song chỉ 1 thắng (ghi nhận hoàn 1 lần); ghi nhận hoàn thất bại ⇒ rollback nguyên vẹn', async () => {
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
      const { calls, gw: spy } = spyRefunds();
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

    it('2 processDueSubscriptions song song không phát hóa đơn gia hạn kép (SKIP LOCKED): mỗi gói đúng 1 hóa đơn, trả xong nối kỳ', async () => {
      const users = await Promise.all(Array.from({ length: 4 }, (_, i) => c.registerUser(`due-race${i}`)));
      for (const u of users) await pay(u, 'data');
      const now = new Date(Date.now() + 31 * DAY);
      const renewalsBefore = await prisma.payment.count({ where: { kind: 'renewal' } });
      const [a, b] = await Promise.all([createPaymentsService(repo, bankGateway).processDueSubscriptions(now), createPaymentsService(repo, bankGateway).processDueSubscriptions(now)]);
      const created = (await prisma.payment.count({ where: { kind: 'renewal' } })) - renewalsBefore;
      assert.equal(a.invoiced + b.invoiced, created, 'số hóa đơn báo cáo = số hóa đơn thật sự tạo ra');
      for (const u of users) {
        assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 1);
        const inv = await prisma.payment.findFirstOrThrow({ where: { userId: u.id, kind: 'renewal' } });
        assert.equal(inv.status, 'pending');
        const sub0 = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
        assert.equal(inv.periodStart?.getTime(), sub0.currentPeriodEnd.getTime());
        await c.bankWebhook(c.sepayTx({ id: txId(), refCode: inv.refCode!, amount: inv.amountCents }));
        const sub = (await prisma.subscription.findFirst({ where: { userId: u.id } }))!;
        assert.ok(sub.currentPeriodEnd.getTime() > now.getTime());
        assert.equal(await prisma.payment.count({ where: { userId: u.id, kind: 'renewal', status: 'succeeded' } }), 1);
      }
      const invs = await prisma.payment.findMany({ where: { userId: { in: users.map((u) => u.id) }, invoiceNumber: { not: null } }, select: { invoiceNumber: true } });
      assert.equal(new Set(invs.map((x) => x.invoiceNumber)).size, invs.length);
    });
  });
});
