import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const PRICE = 250_000;
const RATE_BPS = 2000; // 20% => 50.000đ mỗi thanh toán
const EACH = 50_000;

/** Chủ cộng đồng chi trả hoa hồng cho cộng tác viên: tự chuyển khoản rồi ghi nhận; không trừ doanh thu/không cho rút lại khoản đã chi. */
describe('giới thiệu theo cộng đồng: chủ cộng đồng chi trả hoa hồng cho cộng tác viên', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let paymentsRepository: typeof import('../src/modules/payments/payments.repository.js').paymentsRepository;
  let referralWithdrawalsService: typeof import('../src/modules/referrals/referral-withdrawals.service.js').referralWithdrawalsService;
  let n = 0;
  const rates = { commissionBp: 1000, gatewayFeeBp: 0, gatewayFeeFixedCents: 0 };

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ paymentsRepository } = await import('../src/modules/payments/payments.repository.js'));
    ({ referralWithdrawalsService } = await import('../src/modules/referrals/referral-withdrawals.service.js'));
  });
  after(() => server.close());

  async function signup(prefix: string) {
    const email = `${prefix.slice(0, 6)}${Date.now().toString(36)}${n++}@t.io`;
    const r = await c.registerVerified({ email, password: 'Passw0rd!x', firstName: 'Pay', lastName: prefix });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    return { token: r.body.data.accessToken as string, id: r.body.data.user.id as string };
  }
  async function community() {
    const owner = await signup('own');
    const r = await c.call('POST', '/communities', { token: owner.token, body: { title: `Pay ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: PRICE, visibility: 'public' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const id = r.body.data.id as string;
    assert.equal((await c.call('PUT', `/communities/${id}/referral-program`, { token: owner.token, body: { rateBps: RATE_BPS } })).status, 200);
    return { id, owner };
  }
  async function checkoutAndPay(user: { token: string }, communityId: string, referralCode?: string) {
    const co = await c.call('POST', `/communities/${communityId}/checkout`, { token: user.token, body: { method: 'stripe', ...(referralCode ? { referralCode } : {}) } });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const paid = await c.payIntent(co.body.data.id, user.token);
    assert.equal(paid.body.data.status, 'succeeded', JSON.stringify(paid.body));
  }
  async function member(communityId: string, prefix: string) {
    const u = await signup(prefix);
    await checkoutAndPay(u, communityId);
    const code = (await c.call('GET', `/communities/${communityId}/referral-program`, { token: u.token })).body.data.code as string;
    return { ...u, code };
  }
  const overview = (id: string, token: string, qs = '') => c.call('GET', `/communities/${id}/referral-program/payouts${qs}`, { token });
  const pay = (id: string, token: string, body: unknown) => c.call('POST', `/communities/${id}/referral-program/payouts`, { token, body });
  /** Cả khoảng thời gian chứa mọi giao dịch của test (hôm qua → ngày mai, theo UTC). */
  const wide = () => ({ from: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), to: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) });

  it('tổng quan + bảng cộng tác viên: KPI, cần chi trả, tìm kiếm, lọc trạng thái; chỉ chủ cộng đồng xem được', async () => {
    const { id, owner } = await community();
    const a = await member(id, 'colla');
    const b = await signup('bb');
    const d = await signup('dd');
    await checkoutAndPay(b, id, a.code);
    await checkoutAndPay(d, id, a.code);
    const w = wide();
    const qs = `?from=${w.from}&to=${w.to}`;

    const r = await overview(id, owner.token, qs);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const o = r.body.data;
    assert.equal(o.rateBps, RATE_BPS);
    assert.equal(o.kpis.collaborators.value, 1);
    assert.equal(o.kpis.referred.value, 2);
    assert.equal(o.kpis.due.cents, 2 * EACH);
    assert.equal(o.kpis.paid.cents, 0);
    assert.equal(o.meta.total, 1);
    assert.equal(o.rows[0].userId, a.id);
    assert.equal(o.rows[0].referredCount, 2);
    assert.equal(o.rows[0].dueCents, 2 * EACH);
    assert.equal(o.rows[0].status, 'due');
    assert.equal(o.history.length, 0);

    assert.equal((await overview(id, owner.token, `${qs}&q=zzzkhongco`)).body.data.meta.total, 0);
    assert.equal((await overview(id, owner.token, `${qs}&q=colla`)).body.data.meta.total, 1);
    assert.equal((await overview(id, owner.token, `${qs}&status=paid`)).body.data.meta.total, 0);
    assert.equal((await overview(id, owner.token, `${qs}&status=due`)).body.data.meta.total, 1);
    // Khoảng ngày không có hoa hồng: không còn khoản cần chi.
    assert.equal((await overview(id, owner.token, '?from=2020-01-01&to=2020-01-31')).body.data.kpis.due.cents, 0);
    assert.equal((await overview(id, owner.token, '?from=2020-02-01&to=2020-01-01')).status, 400);

    assert.equal((await overview(id, a.token, qs)).status, 403); // thành viên (kể cả cộng tác viên) không xem được
    assert.equal((await pay(id, a.token, { referrerIds: [a.id] })).status, 403);
  });

  it('chi trả: đánh dấu đã chi + ghi lịch sử; không còn trong số dư rút; creator không còn bị trừ; chi trả lại thì không có gì', async () => {
    const { id, owner } = await community();
    const a = await member(id, 'collb');
    const b = await signup('bb2');
    await checkoutAndPay(b, id, a.code);
    const w = wide();
    const balBefore = await paymentsRepository.balance(id, rates);
    const wdBefore = await referralWithdrawalsService.balanceOf(a.id);
    assert.equal(wdBefore.earnedCents, EACH);

    const res = await pay(id, owner.token, { referrerIds: [a.id], ...w, note: 'CK 20/10' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.totals.paidCents, EACH);
    assert.equal(res.body.data.results[0].reason, 'ok');

    const rows = await db.prisma.referralCommission.findMany({ where: { referrerId: a.id, kind: 'community' } });
    assert.equal(rows[0]!.status, 'paid');
    assert.ok(rows[0]!.payoutId);
    const payout = await db.prisma.communityCommissionPayout.findUniqueOrThrow({ where: { id: rows[0]!.payoutId! } });
    assert.equal(payout.amountCents, EACH);
    assert.equal(payout.paidById, owner.id);
    assert.equal(payout.note, 'CK 20/10');

    // Người nhận không rút lại khoản đã được chủ chuyển khoản; doanh thu creator không còn bị trừ khoản đó (+ EACH).
    assert.equal((await referralWithdrawalsService.balanceOf(a.id)).earnedCents, 0);
    assert.equal((await paymentsRepository.balance(id, rates)).net, balBefore.net + EACH);

    const o = (await overview(id, owner.token, `?from=${w.from}&to=${w.to}`)).body.data;
    assert.equal(o.kpis.due.cents, 0);
    assert.equal(o.kpis.paid.cents, EACH);
    assert.equal(o.rows[0].status, 'paid');
    assert.equal(o.history[0].amountCents, EACH);
    assert.equal(o.history[0].referrerId, a.id);

    // Chi trả lần hai: không còn gì để chi, không tạo thêm bản ghi.
    const again = await pay(id, owner.token, { referrerIds: [a.id], ...w });
    assert.equal(again.body.data.results[0].reason, 'nothing_due');
    assert.equal(await db.prisma.communityCommissionPayout.count({ where: { communityId: id } }), 1);

    // Thông báo cho người nhận + người lạ (không phải cộng tác viên) bị bỏ qua.
    const { flushNotifications } = await import('../src/modules/notifications/notifications.service.js');
    await flushNotifications();
    assert.equal(await db.prisma.notification.count({ where: { userId: a.id, title: 'Chủ cộng đồng đã chi trả hoa hồng giới thiệu' } }), 1);
    const stranger = await signup('str');
    assert.equal((await pay(id, owner.token, { referrerIds: [stranger.id], ...w })).body.data.results[0].reason, 'not_referrer');
    assert.equal((await pay(id, owner.token, { referrerIds: [] })).status, 400);
  });

  it('cộng tác viên đã rút một phần qua nền tảng: chủ chỉ chi phần còn lại, không bị chi trả hai lần', async () => {
    const { id, owner } = await community();
    const a = await member(id, 'collc');
    const w = wide();
    for (const p of ['cc1', 'cc2']) await checkoutAndPay(await signup(p), id, a.code);
    // A đã yêu cầu rút 1 khoản (50.000) qua nền tảng trước khi chủ chi trả.
    await db.prisma.referralPayoutAccount.create({ data: { userId: a.id, bankBin: '970436', bankName: 'VCB', accountHolder: 'PAY A', accountNumberEnc: 'x', accountLast4: '1234' } });
    await db.prisma.referralWithdrawal.create({ data: { userId: a.id, amountCents: EACH, refCode: `WD${Date.now()}${n++}`, bankBin: '970436', bankName: 'VCB', accountHolder: 'PAY A', accountNumberEnc: 'x', accountLast4: '1234', status: 'requested' } });
    assert.equal((await referralWithdrawalsService.balanceOf(a.id)).withdrawableCents, EACH); // 100.000 kiếm được − 50.000 đang rút

    const res = (await pay(id, owner.token, { referrerIds: [a.id], ...w })).body.data;
    assert.equal(res.results[0].paidCents, EACH); // chỉ phần còn rút được
    assert.equal(res.results[0].leftCents, EACH);
    assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: a.id, kind: 'community', status: 'paid' } }), 1);
    assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: a.id, kind: 'community', status: 'pending' } }), 1);
    assert.equal((await referralWithdrawalsService.balanceOf(a.id)).withdrawableCents, 0); // không âm, không rút lại được

    // Phần còn lại đã bị rút hết: chủ không chi thêm được (nền tảng đã/đang trả).
    const second = (await pay(id, owner.token, { referrerIds: [a.id], ...w })).body.data;
    assert.equal(second.results[0].reason, 'already_withdrawn');
    assert.equal(second.totals.paidCents, 0);
  });

  it('xuất danh sách thanh toán (CSV): chỉ người còn khoản cần chi, hoặc đúng những người đã chọn; chỉ chủ cộng đồng tải được', async () => {
    const { id, owner } = await community();
    const a = await member(id, 'colld');
    const a2 = await member(id, 'colle');
    await checkoutAndPay(await signup('dd1'), id, a.code);
    await checkoutAndPay(await signup('dd2'), id, a2.code);
    const w = wide();
    const get = (qs: string, token = owner.token) => c.call('GET', `/communities/${id}/referral-program/payouts/export.csv?from=${w.from}&to=${w.to}${qs}`, { token });

    const all = await get('');
    assert.equal(all.status, 200);
    const text = String(all.body);
    assert.ok(text.includes('Cộng tác viên'), text.slice(0, 200));
    assert.ok(text.includes(`${EACH}`));
    assert.equal(text.trim().split(/\r?\n/).length, 3); // tiêu đề + 2 cộng tác viên

    const one = await get(`&ids=${a.id}`);
    assert.equal(String(typeof one.body === 'string' ? one.body : one.raw ?? '').trim().split(/\r?\n/).length, 2);
    assert.equal((await get('', a.token)).status, 403);
  });
});
