import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Đặt trước khi nạp env (dynamic import). Ngưỡng rút $10 để test không cần quá nhiều giao dịch.
const ADMIN_EMAIL = 'padmin-revenue@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
process.env.PAYOUT_MIN_USD = '10';
process.env.PLATFORM_COMMISSION_PCT = '10';
process.env.GATEWAY_FEE_PCT = '2.9';
process.env.GATEWAY_FEE_FIXED_CENTS = '30';
// Chính sách rút tiền (holding period + reserve) được test riêng ở money-lifecycle.test.ts; ở đây tắt reserve và lùi ngày thanh toán để kiểm số học doanh thu/payout.
process.env.PAYOUT_RESERVE_PCT = '0';
process.env.PAYOUT_DISPUTE_WINDOW_DAYS = '0';

const COURSE = 'ai'; // giá $7 = 700 cent
const BANK = { type: 'bank', bankName: 'Vietcombank', accountNumber: '0123456789', accountHolder: 'NGUYEN VAN A' };

describe('doanh thu & payout cho Owner', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let notificationStore: typeof import('../src/modules/notifications/notifications.service.js').notificationStore;
  let admin: { token: string; id: string };
  let owner: { token: string; id: string };
  let buyers: { token: string; id: string }[] = [];
  let payments: any[] = [];
  let prisma: typeof import('../src/db/prisma.js').prisma;
  /** Lùi mọi thanh toán gần đây 30 ngày để vượt holding period (refund window 7 ngày) — số dư mới rút được. */
  const age = () => prisma.payment.updateMany({ where: { confirmedAt: { gt: new Date(Date.now() - 10 * 86_400_000) } }, data: { confirmedAt: new Date(Date.now() - 30 * 86_400_000) } });

  async function pay(user: { token: string }) {
    const co = await c.call('POST', `/courses/${COURSE}/checkout`, { token: user.token, body: { method: 'stripe' } });
    const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: user.token });
    assert.equal(cf.status, 200);
    return cf.body.data;
  }

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ notificationStore } = await import('../src/modules/notifications/notifications.service.js'));
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
    owner = await c.registerUser('owner');
    await enrollmentService.grant(owner.id, COURSE, 'owner'); // chưa có API tạo cộng đồng nên cấp owner trực tiếp
    for (let i = 0; i < 2; i++) {
      const b = await c.registerUser(`buyer${i}`);
      buyers.push(b);
      payments.push(await pay(b));
    }
    await age();
  });
  after(() => server.close());

  it('401 khi thiếu token; 404 cộng đồng lạ', async () => {
    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`)).status, 401);
    assert.equal((await c.call('GET', `/courses/nope/revenue`, { token: owner.token })).status, 404);
    assert.equal((await c.call('GET', `/courses/${COURSE}/payouts`)).status, 401);
    assert.equal((await c.call('POST', `/courses/${COURSE}/payouts`, { body: {} })).status, 401);
  });

  it('member thường và admin/mod cộng đồng gọi revenue/payouts → 403', async () => {
    const member = buyers[0]!;
    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`, { token: member.token })).status, 403);
    assert.equal((await c.call('GET', `/courses/${COURSE}/payouts`, { token: member.token })).status, 403);

    for (const role of ['mod', 'admin'] as const) {
      const u = await c.registerUser(role);
      await enrollmentService.grant(u.id, COURSE, role);
      assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`, { token: u.token })).status, 403, role);
      assert.equal((await c.call('GET', `/courses/${COURSE}/payouts`, { token: u.token })).status, 403, role);
      assert.equal((await c.call('POST', `/courses/${COURSE}/payouts`, { token: u.token, body: { amountCents: 1000, method: BANK } })).status, 403, role);
    }
    const outsider = await c.registerUser('outsider');
    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`, { token: outsider.token })).status, 403);
  });

  it('owner xem doanh thu: số liệu nguyên cent đúng, MRR, giao dịch gần nhất; platform admin cũng xem được', async () => {
    const r = await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token });
    assert.equal(r.status, 200);
    const d = r.body.data;
    // 2 x 700: hoa hồng 10% = 70 mỗi giao dịch; phí cổng = round(700*2.9%)=20 + 30 = 50 mỗi giao dịch.
    assert.equal(d.grossCents, 1400);
    assert.equal(d.refundsCents, 0);
    assert.equal(d.platformCommissionCents, 140);
    assert.equal(d.gatewayFeeCents, 100);
    assert.equal(d.netCents, 1160);
    assert.equal(d.availableBalanceCents, 1160);
    assert.equal(d.activePaidMembers, 2);
    assert.equal(d.mrrCents, 1400);
    assert.equal(d.recentTransactions.length, 2);
    assert.equal(d.assumptions.platformCommissionPct, 10);
    for (const k of ['grossCents', 'netCents', 'availableBalanceCents', 'mrrCents']) assert.ok(Number.isInteger(d[k]), k);

    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`, { token: admin.token })).status, 200);
  });

  it('lọc theo from/to: tương lai → 0; query sai → 400', async () => {
    const future = new Date(Date.now() + 86_400_000 * 2).toISOString().slice(0, 10);
    const r = await c.call('GET', `/courses/${COURSE}/revenue?from=${future}`, { token: owner.token });
    assert.equal(r.body.data.grossCents, 0);
    assert.equal(r.body.data.availableBalanceCents, 1160); // số dư không phụ thuộc bộ lọc
    // Thanh toán đã được lùi về 30 ngày trước (xem `age`).
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const inRange = await c.call('GET', `/courses/${COURSE}/revenue?from=${day(31)}&to=${day(29)}`, { token: owner.token });
    assert.equal(inRange.body.data.grossCents, 1400);
    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue?from=khong-phai-ngay`, { token: owner.token })).status, 400);
  });

  it('payout: validate, dưới ngưỡng, vượt số dư, che số tài khoản, không vượt khi gọi song song', async () => {
    const url = `/courses/${COURSE}/payouts`;
    assert.equal((await c.call('POST', url, { token: owner.token, body: { amountCents: 10.5, method: BANK } })).status, 400);
    assert.equal((await c.call('POST', url, { token: owner.token, body: { amountCents: 1000, method: { ...BANK, accountNumber: 'abc' } } })).status, 400);
    assert.equal((await c.call('POST', url, { token: owner.token, body: { amountCents: 1000 } })).status, 400);
    assert.equal((await c.call('POST', url, { token: owner.token, body: { amountCents: 900, method: BANK } })).status, 400); // dưới $10
    assert.equal((await c.call('POST', url, { token: owner.token, body: { amountCents: 1161, method: BANK } })).status, 400); // vượt số dư
    // Platform Admin không được tạo lệnh rút thay Owner.
    assert.equal((await c.call('POST', url, { token: admin.token, body: { amountCents: 1000, method: BANK } })).status, 403);

    // Hai lệnh song song 1000 + 1000 khi chỉ còn 1160: chỉ 1 lệnh được chấp nhận.
    const [a, b] = await Promise.all([
      c.call('POST', url, { token: owner.token, body: { amountCents: 1000, method: BANK } }),
      c.call('POST', url, { token: owner.token, body: { amountCents: 1000, method: BANK } }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 400]);
    const ok = a.status === 201 ? a : b;
    assert.equal(ok.body.data.status, 'requested');
    assert.equal(ok.body.data.method.accountMasked, '****6789');
    assert.equal(JSON.stringify(ok.body).includes('0123456789'), false);

    const rev = await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token });
    assert.equal(rev.body.data.availableBalanceCents, 160);
    const list = await c.call('GET', url, { token: owner.token });
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.meta.total, 1);
    assert.equal(JSON.stringify(list.body).includes('0123456789'), false);
  });

  it('admin xử lý payout: list/filter, approve → mark_paid, reject hoàn lại số dư, notify owner, 403 cho người thường', async () => {
    const payoutId = (await c.call('GET', `/courses/${COURSE}/payouts`, { token: owner.token })).body.data[0].id as string;

    assert.equal((await c.call('GET', '/admin/payouts', { token: owner.token })).status, 403);
    assert.equal((await c.call('PATCH', `/admin/payouts/${payoutId}`, { token: owner.token, body: { action: 'approve' } })).status, 403);
    assert.equal((await c.call('GET', '/admin/payouts')).status, 401);
    assert.equal((await c.call('GET', '/admin/payouts?status=bogus', { token: admin.token })).status, 400);
    assert.equal((await c.call('PATCH', `/admin/payouts/${payoutId}`, { token: admin.token, body: { action: 'explode' } })).status, 400);
    assert.equal((await c.call('PATCH', `/admin/payouts/nope`, { token: admin.token, body: { action: 'approve' } })).status, 404);

    const pending = await c.call('GET', '/admin/payouts?status=requested', { token: admin.token });
    assert.ok(pending.body.data.some((p: any) => p.id === payoutId));

    const approved = await c.call('PATCH', `/admin/payouts/${payoutId}`, { token: admin.token, body: { action: 'approve', note: 'OK' } });
    assert.equal(approved.body.data.status, 'approved');
    assert.equal((await c.call('PATCH', `/admin/payouts/${payoutId}`, { token: admin.token, body: { action: 'approve' } })).status, 409);
    const paid = await c.call('PATCH', `/admin/payouts/${payoutId}`, { token: admin.token, body: { action: 'mark_paid' } });
    assert.equal(paid.body.data.status, 'paid');
    assert.equal((await c.call('PATCH', `/admin/payouts/${payoutId}`, { token: admin.token, body: { action: 'reject' } })).status, 409);
    assert.ok(notificationStore.all().filter((n) => n.userId === owner.id && n.type === 'system').length >= 2);
    // Đã chi thì số dư vẫn trừ.
    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token })).body.data.availableBalanceCents, 160);

    // Lệnh mới bị từ chối → số dư được hoàn lại.
    for (let i = 0; i < 2; i++) await pay(await c.registerUser(`buyer-more${i}`));
    await age();
    const balance = (await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token })).body.data.availableBalanceCents as number;
    assert.equal(balance, 160 + 2 * 580);
    const p2 = await c.call('POST', `/courses/${COURSE}/payouts`, { token: owner.token, body: { amountCents: 1200, method: BANK } });
    assert.equal(p2.status, 201);
    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token })).body.data.availableBalanceCents, 120);
    const rej = await c.call('PATCH', `/admin/payouts/${p2.body.data.id}`, { token: admin.token, body: { action: 'reject', note: 'Sai tài khoản' } });
    assert.equal(rej.body.data.status, 'rejected');
    assert.equal((await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token })).body.data.availableBalanceCents, 1320);
  });

  it('hoàn tiền làm giảm doanh thu: hoa hồng tính trên phần giữ lại, phí cổng không được trả lại', async () => {
    // Giao dịch mới (chưa lùi ngày) ⇒ còn trong cửa sổ hoàn tiền nên tự duyệt.
    const nb = await c.registerUser('refund-new');
    const np = await pay(nb);
    const before = (await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token })).body.data;
    const r = await c.call('POST', `/payments/${np.id}/refund-request`, { token: nb.token, body: { reason: 'Đổi ý' } });
    assert.equal(r.body.data.status, 'approved');
    const after = (await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token })).body.data;
    assert.equal(after.refundsCents, 700);
    assert.equal(after.grossCents, before.grossCents);
    assert.equal(after.platformCommissionCents, before.platformCommissionCents - 70);
    assert.equal(after.gatewayFeeCents, before.gatewayFeeCents);
    assert.equal(after.netCents, before.netCents - 700 + 70);
    assert.equal(after.activePaidMembers, before.activePaidMembers - 1);
  });
  it('nhiều payout song song cùng vượt số dư: tổng đã chấp nhận không vượt số dư khả dụng (khóa Course FOR UPDATE)', async () => {
    for (let i = 0; i < 4; i++) await pay(await c.registerUser('buyer-pay' + i));
    await age();
    const url = `/courses/${COURSE}/payouts`;
    const bal = async () => (await c.call('GET', `/courses/${COURSE}/revenue`, { token: owner.token })).body.data.availableBalanceCents as number;
    const before = await bal();
    const amount = 1000;
    const expectOk = Math.floor(before / amount);
    assert.ok(expectOk >= 2 && expectOk < 6, 'kịch bản cần vài lệnh thắng, vài lệnh thua: ' + before);
    const rs = await Promise.all(Array.from({ length: 6 }, () => c.call('POST', url, { token: owner.token, body: { amountCents: amount, method: BANK } })));
    const ok = rs.filter((r) => r.status === 201).length;
    assert.equal(ok, expectOk);
    assert.equal(rs.filter((r) => r.status === 400).length, 6 - expectOk);
    assert.equal(await bal(), before - ok * amount);
    assert.ok((await bal()) >= 0);
  });
});
