import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

const ADMIN_EMAIL = 'padmin-modpay@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
process.env.PLATFORM_COMMISSION_PCT = '10';
process.env.GATEWAY_FEE_PCT = '2.9';
process.env.GATEWAY_FEE_FIXED_CENTS = '30';

const COMMUNITY = 'photo'; // cộng đồng MIỄN PHÍ
/** 5 USD ≈ 125.000đ, 9 USD ≈ 225.000đ (seedVnd). */
const P1 = 125_000;
const P2 = 225_000;

/** Mua lẻ module trả phí trong cộng đồng miễn phí: một lần, không tạo gói thành viên. */
describe('mua lẻ module trả phí', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let prisma: typeof import('../src/db/prisma.js').prisma;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let flush: () => Promise<void>;
  let owner: { token: string; id: string };
  let paidId: string;
  let otherPaidId: string;
  let freeId: string;

  const base = `/communities/${COMMUNITY}`;
  const quote = (u: { token: string }, id = paidId) => c.call('GET', `${base}/modules/${id}/purchase-quote`, { token: u.token });
  const buy = (u: { token: string }, body: Record<string, unknown> = {}, id = paidId) =>
    c.call('POST', `${base}/modules/${id}/purchase`, { token: u.token, body });
  /** Mua → phiên chuyển khoản pending (201) → khách chuyển đúng tiền (webhook) → trả phiên đã cập nhật. */
  const buyAndPay = async (u: { token: string }, id = paidId) => {
    const r = await buy(u, {}, id);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const paid = await c.payIntent(r.body.data.id, u.token);
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    return paid.body.data;
  };
  const member = async (prefix: string) => {
    const u = await c.registerUser(prefix);
    await enrollmentService.grant(u.id, COMMUNITY);
    return u;
  };
  const view = async (u: { token: string }, id = paidId) => (await c.call('GET', `${base}/modules`, { token: u.token })).body.data.find((m: any) => m.id === id);
  const newModule = async (body: Record<string, unknown>) =>
    (await c.call('POST', `${base}/modules`, { token: owner.token, body: { title: 'M', description: 'd', ...body } })).body.data.id as string;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ flushNotifications: flush } = await import('../src/modules/notifications/notifications.service.js'));
    owner = await c.registerUser('mpowner');
    await enrollmentService.grant(owner.id, COMMUNITY, 'owner');
    paidId = await newModule({ title: 'Module trả phí', accessMode: 'paid', priceCents: P1 });
    otherPaidId = await newModule({ title: 'Module trả phí 2', accessMode: 'paid', priceCents: P2 });
    freeId = await newModule({ title: 'Module miễn phí' });
  });
  after(() => server.close());

  it('quote: giá do server quyết định; chưa tham gia / staff / module không bán / không tồn tại', async () => {
    const m = await member('q');
    const q = await quote(m);
    assert.equal(q.status, 200);
    assert.deepEqual(
      [q.body.data.priceCents, q.body.data.currency, q.body.data.canPurchase, q.body.data.owned, q.body.data.oneTime, q.body.data.title],
      [P1, 'VND', true, false, true, 'Module trả phí'],
    );
    const outsider = await c.registerUser('qout');
    const qo = await quote(outsider);
    assert.equal(qo.status, 200);
    assert.deepEqual([qo.body.data.canPurchase, qo.body.data.blocked], [false, 'JOIN_REQUIRED']);
    assert.equal((await quote(owner)).body.data.blocked, 'STAFF_EXEMPT');
    assert.equal((await quote(m, freeId)).status, 400);
    assert.equal((await quote(m, 'nope')).status, 404);
    assert.equal((await c.call('GET', `${base}/modules/${paidId}/purchase-quote`)).status, 401);
    assert.equal((await c.call('GET', `/communities/ai/modules/${paidId}/purchase-quote`, { token: m.token })).status, 404); // module không thuộc cộng đồng này
  });

  it('điều kiện: chưa tham gia 403 JOIN_REQUIRED; bị cấm 403; staff 409; module không bán 400; sai module/cộng đồng 404', async () => {
    const outsider = await c.registerUser('out');
    const r = await buy(outsider);
    assert.deepEqual([r.status, r.body.code ?? r.body.error?.code], [403, 'JOIN_REQUIRED']);
    const banned = await member('ban');
    await enrollmentService.setBanned(banned.id, COMMUNITY, true);
    assert.equal((await buy(banned)).status, 403);
    const staff = await buy(owner);
    assert.deepEqual([staff.status, staff.body.code ?? staff.body.error?.code], [409, 'STAFF_EXEMPT']);
    const m = await member('cond');
    assert.equal((await buy(m, {}, freeId)).status, 400);
    assert.equal((await buy(m, {}, 'nope')).status, 404);
    assert.equal((await c.call('POST', `/communities/ai/modules/${paidId}/purchase`, { token: m.token, body: {} })).status, 404);
    assert.equal((await c.call('POST', `${base}/modules/${paidId}/purchase`, { body: {} })).status, 401);
    assert.equal(await prisma.payment.count({ where: { userId: { in: [outsider.id, banned.id, owner.id, m.id] } } }), 0, 'không tạo giao dịch khi bị từ chối');
  });

  it('chưa chuyển / chuyển thiếu tiền: phiên pending, KHÔNG cấp quyền, module vẫn khóa; chuyển đủ thì mở khóa', async () => {
    const m = await member('unpaid');
    const r = await buy(m);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const p = r.body.data;
    assert.deepEqual([p.status, p.kind, p.moduleId, p.method], ['pending', 'module', paidId, 'bank_transfer']);
    assert.match(p.refCode, /^SFH[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(p.transfer.amount, P1);
    assert.equal(p.transfer.transferContent, p.refCode);
    assert.equal(await prisma.moduleAccess.count({ where: { userId: m.id } }), 0);
    // đọc lại / confirm chỉ trả trạng thái, không cấp quyền
    assert.equal((await c.call('POST', `/payments/${p.id}/confirm`, { token: m.token })).body.data.status, 'pending');
    // chuyển thiếu tiền
    const under = await c.bankWebhook(c.sepayTx({ id: `U${p.id.replaceAll('-', '')}`, refCode: p.refCode, amount: P1 - 1000 }));
    assert.equal(under.body.message, 'underpaid');
    assert.equal(await prisma.moduleAccess.count({ where: { userId: m.id } }), 0);
    const v = await view(m);
    assert.deepEqual([v.locked, v.lockReason], [true, 'paid']);
    // chuyển đủ: thành công
    const paid = await c.payIntent(p.id, m.token);
    assert.equal(paid.body.data.status, 'succeeded');
    assert.equal((await view(m)).locked, false);
  });

  let buyer: { token: string; id: string };
  let paymentId: string;
  it('mua thành công: cấp ModuleAccess(purchase), hóa đơn, mở khóa, thông báo, doanh thu owner, không tạo gói thành viên', async () => {
    buyer = await member('buyer');
    const before = (await c.call('GET', `${base}/revenue`, { token: owner.token })).body.data;
    const r = await buy(buyer);
    assert.equal(r.status, 201);
    assert.equal(r.body.data.status, 'pending', 'mua chưa cấp quyền: chờ tiền về');
    assert.equal(await prisma.moduleAccess.count({ where: { userId: buyer.id } }), 0);
    assert.equal((await view(buyer)).locked, true);
    const p = (await c.payIntent(r.body.data.id, buyer.token)).body.data;
    paymentId = p.id;
    assert.deepEqual([p.status, p.kind, p.moduleId, p.amountCents], ['succeeded', 'module', paidId, P1]);
    assert.match(p.invoiceNumber, /^INV-\d{4}-\d{6}$/);

    const access = await prisma.moduleAccess.findUniqueOrThrow({ where: { moduleId_userId: { moduleId: paidId, userId: buyer.id } } });
    assert.equal(access.source, 'purchase');
    const v = await view(buyer);
    assert.deepEqual([v.locked, v.lockReason ?? null], [false, null]);
    assert.equal((await view(buyer, otherPaidId)).locked, true, 'module trả phí khác vẫn khóa');
    assert.equal(await prisma.subscription.count({ where: { userId: buyer.id } }), 0);

    await flush();
    const notes = await prisma.notification.findMany({ where: { userId: buyer.id, type: 'payment_succeeded' } });
    assert.ok(notes.some((n) => /mở khóa module/i.test(n.title) && n.body.includes('Module trả phí')));

    const after = (await c.call('GET', `${base}/revenue`, { token: owner.token })).body.data;
    assert.equal(after.grossCents - before.grossCents, P1);
    assert.equal(after.platformCommissionCents - before.platformCommissionCents, P1 / 10);
    assert.ok(after.gatewayFeeCents > before.gatewayFeeCents);
    assert.equal(after.netCents - before.netCents, P1 - P1 / 10 - (after.gatewayFeeCents - before.gatewayFeeCents));

    const inv = await c.call('GET', `/payments/${paymentId}/invoice`, { token: buyer.token });
    assert.equal(inv.status, 200);
    assert.match(inv.body.data.items[0].description, /Module "Module trả phí"/);
    const mine = await c.call('GET', '/me/payments', { token: buyer.token });
    assert.equal(mine.body.data.find((x: any) => x.id === paymentId).moduleTitle, 'Module trả phí');
    // payment của module không bị coi là "thanh toán gói" của cộng đồng
    assert.equal((await c.call('GET', `${base}/subscription`, { token: buyer.token })).body.data.latestPayment, undefined);
  });

  it('đã sở hữu: mua lại 409 ALREADY_OWNED, không tạo phiên mới; quote báo owned', async () => {
    const r = await buy(buyer);
    assert.deepEqual([r.status, r.body.code ?? r.body.error?.code], [409, 'ALREADY_OWNED']);
    assert.equal(await prisma.payment.count({ where: { userId: buyer.id, kind: 'module' } }), 1);
    assert.equal((await quote(buyer)).body.data.owned, true);
    // owner tự cấp tay cho module khác (selected) cũng tính là đã sở hữu
    await c.call('PUT', `${base}/modules/${otherPaidId}/access`, { token: owner.token, body: { userIds: [buyer.id] } });
    assert.equal((await buy(buyer, {}, otherPaidId)).status, 409);
  });

  it('idempotency: cùng key (tuần tự và song song) → đúng 1 phiên; tiền về (kể cả webhook gửi trùng song song) chỉ cấp 1 lần', async () => {
    const m = await member('idem');
    const key = `k-${randomBytes(6).toString('hex')}`;
    const body = { idempotencyKey: key };
    const [a, b] = await Promise.all([buy(m, body), buy(m, body)]);
    assert.ok([a.status, b.status].every((s) => s === 201), `${a.status}/${b.status}`);
    assert.equal(a.body.data.id, b.body.data.id);
    const again = await buy(m, body);
    assert.equal(again.status, 201);
    assert.equal(again.body.data.id, a.body.data.id);
    assert.equal(a.body.data.status, 'pending');
    assert.equal(await prisma.payment.count({ where: { userId: m.id } }), 1);
    assert.equal(await prisma.moduleAccess.count({ where: { userId: m.id } }), 0, 'chưa có tiền thì chưa cấp');
    const [w1, w2] = await Promise.all([c.payIntent(a.body.data.id, m.token), c.payIntent(a.body.data.id, m.token)]);
    assert.ok([w1, w2].every((w) => w.status === 200 && w.body.data.status === 'succeeded'));
    assert.equal(await prisma.payment.count({ where: { userId: m.id } }), 1);
    assert.equal(await prisma.moduleAccess.count({ where: { userId: m.id } }), 1);
    assert.equal(await prisma.bankTransaction.count({ where: { matchedPaymentId: a.body.data.id } }), 1, 'webhook trùng chỉ ghi 1 giao dịch');
    // cùng key nhưng module khác → 409
    const other = await buy(m, { idempotencyKey: key }, otherPaidId);
    assert.equal(other.status, 409);
    // header Idempotency-Key cũng được
    const m2 = await member('idem2');
    const h = { 'idempotency-key': `h-${randomBytes(6).toString('hex')}` };
    const r1 = await c.call('POST', `${base}/modules/${paidId}/purchase`, { token: m2.token, body: {}, headers: h });
    const r2 = await c.call('POST', `${base}/modules/${paidId}/purchase`, { token: m2.token, body: {}, headers: h });
    assert.equal(r1.body.data.id, r2.body.data.id);
    assert.equal(await prisma.payment.count({ where: { userId: m2.id } }), 1);
  });

  it('hoàn tiền: thu hồi ModuleAccess (purchase), khóa lại module, giữ thành viên, doanh thu trừ lại', async () => {
    const before = (await c.call('GET', `${base}/revenue`, { token: owner.token })).body.data;
    const rf = await c.call('POST', `/payments/${paymentId}/refund-request`, { token: buyer.token, body: { reason: 'Không cần nữa' } });
    assert.equal(rf.status, 201);
    assert.equal(rf.body.data.status, 'approved');
    assert.equal(await prisma.moduleAccess.count({ where: { userId: buyer.id, moduleId: paidId } }), 0);
    const v = await view(buyer);
    assert.deepEqual([v.locked, v.lockReason], [true, 'paid']);
    assert.equal(await enrollmentService.isEnrolled(buyer.id, COMMUNITY), true);
    assert.equal(await prisma.subscription.count({ where: { userId: buyer.id } }), 0);
    const after = (await c.call('GET', `${base}/revenue`, { token: owner.token })).body.data;
    assert.equal(before.grossCents - after.grossCents, 0, 'gross giữ nguyên, refund tăng');
    assert.equal(after.refundsCents - before.refundsCents, P1);
    // mua lại sau hoàn tiền được
    assert.equal((await buyAndPay(buyer)).status, 'succeeded');
    assert.equal((await view(buyer)).locked, false);
  });

  it('admin: danh sách giao dịch hiển thị module, lọc kind=module, hoàn tiền admin thu hồi quyền', async () => {
    const reg = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    const admin = { token: reg.body.data.accessToken as string };
    const m = await member('adm');
    const paid = await buyAndPay(m);
    const list = await c.call('GET', '/admin/payments/transactions?kind=module&limit=50', { token: admin.token });
    assert.equal(list.status, 200);
    const tx = list.body.data.find((t: any) => t.id === paid.id);
    assert.equal(tx.kind, 'module');
    assert.equal(tx.product.type, 'module');
    assert.match(tx.product.label, /Module trả phí/);
    assert.equal((await c.call('GET', `/admin/payments/transactions/${paid.id}`, { token: admin.token })).status, 200);
    assert.equal((await c.call('GET', '/admin/payments/transactions?limit=50', { token: admin.token })).status, 200);

    // quyền do owner cấp tay (selected) KHÔNG bị hoàn tiền xóa: người khác được cấp tay module 2
    await c.call('PUT', `${base}/modules/${otherPaidId}/access`, { token: owner.token, body: { userIds: [m.id, buyer.id] } });
    const rf = await c.call('POST', `/admin/payments/transactions/${paid.id}/refund`, { token: admin.token, body: { reason: 'Admin hoàn tiền' } });
    assert.equal(rf.status, 200, JSON.stringify(rf.body));
    assert.equal(await prisma.moduleAccess.count({ where: { userId: m.id, moduleId: paidId } }), 0);
    assert.equal(await prisma.moduleAccess.count({ where: { userId: m.id, moduleId: otherPaidId, source: 'selected' } }), 1);
    assert.equal((await view(m)).locked, true);
    assert.equal(await enrollmentService.isEnrolled(m.id, COMMUNITY), true);
  });

  it('cộng đồng bị khóa → 403 COMMUNITY_LOCKED, không tạo phiên thanh toán', async () => {
    const m = await member('lock');
    await prisma.community.update({ where: { id: COMMUNITY }, data: { locked: true } });
    try {
      const r = await buy(m);
      assert.deepEqual([r.status, r.body.code ?? r.body.error?.code], [403, 'COMMUNITY_LOCKED']);
      assert.equal(await prisma.payment.count({ where: { userId: m.id } }), 0);
    } finally {
      await prisma.community.update({ where: { id: COMMUNITY }, data: { locked: false } });
    }
  });
});
