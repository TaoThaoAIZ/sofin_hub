import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const thisYear = new Date().getUTCFullYear();
const card = (over: Record<string, unknown> = {}) => ({
  type: 'card',
  token: `tok_mock_${randomBytes(6).toString('hex')}`,
  brand: 'visa',
  last4: String(1000 + Math.floor(Math.random() * 8999)),
  expMonth: 12,
  expYear: thisYear + 2,
  ...over,
});

describe('quản lý thẻ (Cài đặt > Thanh toán) + tổng quan thanh toán', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  let n = 0;
  async function paidCommunity(over: Record<string, unknown> = {}) {
    const owner = await c.registerUser('own');
    const r = await c.call('POST', '/communities', { token: owner.token, body: { title: `Thẻ ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: 7, priceAnnualUsd: 48, visibility: 'public', ...over } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data.id as string;
  }
  async function pay(user: { token: string }, id: string, body: Record<string, unknown> = {}) {
    const co = await c.call('POST', `/communities/${id}/checkout`, { token: user.token, body: { method: 'stripe', ...body } });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: user.token });
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data;
  }
  const list = async (u: { token: string }) => (await c.call('GET', '/me/payment-methods', { token: u.token })).body.data as { id: string; isDefault: boolean; last4: string; brand: string }[];

  describe('thêm / liệt kê', () => {
    it('cần đăng nhập', async () => {
      assert.equal((await c.call('POST', '/me/payment-methods', { body: card() })).status, 401);
      assert.equal((await c.call('GET', '/me/billing-summary')).status, 401);
    });

    it('thẻ đầu tiên là mặc định; thẻ sau không đổi mặc định; không lộ token/PAN', async () => {
      const u = await c.registerUser('card');
      const a = await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ last4: '4242' }) });
      assert.equal(a.status, 201, JSON.stringify(a.body));
      assert.equal(a.body.data.isDefault, true);
      assert.deepEqual(Object.keys(a.body.data).sort(), ['brand', 'createdAt', 'expMonth', 'expYear', 'id', 'isDefault', 'last4']);
      const b = await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ last4: '1111', brand: 'mastercard' }) });
      assert.equal(b.status, 201);
      assert.equal(b.body.data.isDefault, false);
      const l = await list(u);
      assert.deepEqual(l.map((x) => [x.last4, x.isDefault]), [['4242', true], ['1111', false]]);
      assert.equal(JSON.stringify(l).includes('tok_'), false);
    });

    it('từ chối: thẻ hết hạn, trường lạ (số thẻ/CVC), token sai, brand sai, trùng thẻ', async () => {
      const u = await c.registerUser('cardbad');
      assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ expYear: thisYear - 1 }) })).status, 400);
      assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ number: '4242424242424242' }) })).status, 400);
      assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ cvc: '123' }) })).status, 400);
      assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ token: '4242' }) })).status, 400);
      assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ brand: 'foo' }) })).status, 400);
      const ok = card({ last4: '4242' });
      assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: ok })).status, 201);
      const dupToken = await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ token: ok.token, last4: '9999' }) });
      assert.equal(dupToken.status, 409);
      const dupCard = await c.call('POST', '/me/payment-methods', { token: u.token, body: { ...ok, token: `tok_mock_${randomBytes(6).toString('hex')}` } });
      assert.equal(dupCard.status, 409);
      assert.equal(dupCard.body.error?.code ?? dupCard.body.code, 'CARD_EXISTS');
    });

    it('tối đa 10 thẻ', async () => {
      const u = await c.registerUser('cardmax');
      for (let i = 0; i < 10; i++) assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ last4: String(2000 + i) }) })).status, 201);
      assert.equal((await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ last4: '3000' }) })).status, 400);
    });
  });

  describe('đặt mặc định / cập nhật / xóa', () => {
    it('PATCH default đổi thẻ mặc định, chuyển gói đang gia hạn sang thẻ mới', async () => {
      const u = await c.registerUser('def');
      const communityId = await paidCommunity();
      const first = card({ last4: '4242' });
      await pay(u, communityId, { paymentMethod: first }); // thẻ vừa dùng ở thanh toán là mặc định
      const second = (await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ last4: '5555', brand: 'mastercard' }) })).body.data;
      assert.equal((await list(u))[0]!.last4, '4242');
      const r = await c.call('PATCH', `/me/payment-methods/${second.id}/default`, { token: u.token });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.data.map((x: { last4: string; isDefault: boolean }) => [x.last4, x.isDefault]), [['5555', true], ['4242', false]]);
      const sub = await db.prisma.subscription.findFirst({ where: { userId: u.id, communityId } });
      assert.equal(sub?.paymentCardId, second.id);
      // Gọi lại trên thẻ đang mặc định: idempotent.
      assert.equal((await c.call('PATCH', `/me/payment-methods/${second.id}/default`, { token: u.token })).status, 200);
    });

    it('thẻ của người khác → 404 cho mọi thao tác', async () => {
      const a = await c.registerUser('own1');
      const b = await c.registerUser('own2');
      const created = (await c.call('POST', '/me/payment-methods', { token: a.token, body: card() })).body.data;
      assert.equal((await c.call('PATCH', `/me/payment-methods/${created.id}/default`, { token: b.token })).status, 404);
      assert.equal((await c.call('PUT', `/me/payment-methods/${created.id}`, { token: b.token, body: card() })).status, 404);
      assert.equal((await c.call('DELETE', `/me/payment-methods/${created.id}`, { token: b.token })).status, 404);
      assert.equal((await list(a)).length, 1);
    });

    it('PUT thay thông tin thẻ, giữ id + vị trí mặc định + gói đang gắn', async () => {
      const u = await c.registerUser('upd');
      const communityId = await paidCommunity();
      await pay(u, communityId, { paymentMethod: card({ last4: '4242' }) });
      const before = (await list(u))[0]!;
      const r = await c.call('PUT', `/me/payment-methods/${before.id}`, { token: u.token, body: card({ last4: '0005', brand: 'amex', expMonth: 3, expYear: thisYear + 4 }) });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual({ id: r.body.data.id, last4: r.body.data.last4, brand: r.body.data.brand, isDefault: r.body.data.isDefault, exp: [r.body.data.expMonth, r.body.data.expYear] }, { id: before.id, last4: '0005', brand: 'amex', isDefault: true, exp: [3, thisYear + 4] });
      const sub = await db.prisma.subscription.findFirst({ where: { userId: u.id, communityId } });
      assert.equal(sub?.paymentCardId, before.id);
      assert.equal((await c.call('PUT', `/me/payment-methods/${before.id}`, { token: u.token, body: card({ expYear: thisYear - 1 }) })).status, 400);
    });

    it('xóa thẻ không dùng → ok; thẻ duy nhất đang dùng cho gói → 409 CARD_IN_USE', async () => {
      const u = await c.registerUser('del');
      const communityId = await paidCommunity();
      await pay(u, communityId, { paymentMethod: card({ last4: '4242' }) });
      const only = (await list(u))[0]!;
      const blocked = await c.call('DELETE', `/me/payment-methods/${only.id}`, { token: u.token });
      assert.equal(blocked.status, 409);
      assert.equal(blocked.body.error?.code ?? blocked.body.code, 'CARD_IN_USE');
      assert.equal((await list(u)).length, 1);

      // Có thẻ khác → xóa được, gói được chuyển sang thẻ còn lại.
      const other = (await c.call('POST', '/me/payment-methods', { token: u.token, body: card({ last4: '1881' }) })).body.data;
      const r = await c.call('DELETE', `/me/payment-methods/${only.id}`, { token: u.token });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.data.map((x: { id: string; isDefault: boolean }) => [x.id, x.isDefault]), [[other.id, true]]);
      const sub = await db.prisma.subscription.findFirst({ where: { userId: u.id, communityId } });
      assert.equal(sub?.paymentCardId, other.id);
      // Lịch sử thanh toán giữ nguyên dù thẻ cũ đã xóa.
      const pays = await c.call('GET', '/me/payments', { token: u.token });
      assert.equal(pays.body.data.length, 1);
    });

    it('thẻ của gói đã đặt hủy cuối kỳ thì xóa được dù là thẻ duy nhất', async () => {
      const u = await c.registerUser('delc');
      const communityId = await paidCommunity();
      await pay(u, communityId, { paymentMethod: card({ last4: '4242' }) });
      assert.equal((await c.call('POST', `/communities/${communityId}/subscription/cancel`, { token: u.token, body: { atPeriodEnd: true } })).status, 200);
      const only = (await list(u))[0]!;
      assert.equal((await c.call('DELETE', `/me/payment-methods/${only.id}`, { token: u.token })).status, 200);
      assert.equal((await list(u)).length, 0);
    });
  });

  describe('GET /me/billing-summary', () => {
    it('chưa có gói: next = null, tổng = 0', async () => {
      const u = await c.registerUser('sum0');
      const r = await c.call('GET', '/me/billing-summary', { token: u.token });
      assert.deepEqual(r.body.data, { currency: 'USD', next: null, monthlyTotalCents: 0, activeCount: 0 });
    });

    it('gộp gói tháng + gói năm (/12), next = gói đến hạn sớm nhất, bỏ gói đã hủy cuối kỳ', async () => {
      const u = await c.registerUser('sum');
      const monthly = await paidCommunity(); // $7/tháng
      const annual = await paidCommunity(); // $48/năm
      const cancelled = await paidCommunity();
      await pay(u, monthly);
      await pay(u, annual, { interval: 'annual' });
      await pay(u, cancelled);
      await c.call('POST', `/communities/${cancelled}/subscription/cancel`, { token: u.token, body: { atPeriodEnd: true } });
      const r = (await c.call('GET', '/me/billing-summary', { token: u.token })).body.data;
      assert.equal(r.activeCount, 2);
      assert.equal(r.monthlyTotalCents, 700 + 400); // 7$ + 48$/12
      assert.equal(r.next.communityId, monthly); // kỳ tháng hết sớm hơn kỳ năm
      assert.equal(r.next.amountCents, 700);
      assert.equal(r.next.trialing, false);
    });
  });

  describe('GET /me/payments kèm trạng thái hoàn tiền', () => {
    it('refundStatus = null khi chưa yêu cầu, approved sau khi hoàn trong cửa sổ', async () => {
      const u = await c.registerUser('rf');
      const communityId = await paidCommunity();
      const p = await pay(u, communityId);
      let row = (await c.call('GET', '/me/payments', { token: u.token })).body.data[0];
      assert.equal(row.refundStatus, null);
      const rr = await c.call('POST', `/payments/${p.id}/refund-request`, { token: u.token, body: { reason: 'không cần nữa' } });
      assert.equal(rr.status, 201, JSON.stringify(rr.body));
      row = (await c.call('GET', '/me/payments', { token: u.token })).body.data[0];
      assert.equal(row.refundStatus, 'approved');
      assert.equal(row.status, 'refunded');
    });
  });
});
