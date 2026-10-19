import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const PRICE = 250_000;

/** Chương trình giới thiệu theo cộng đồng: chủ đặt %, thành viên mời bằng link ?cref=, hoa hồng trừ vào phần creator nhận. */
describe('giới thiệu theo cộng đồng: % do chủ đặt, hoa hồng trừ vào phần creator', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let paymentsRepository: typeof import('../src/modules/payments/payments.repository.js').paymentsRepository;
  let communityReferralService: typeof import('../src/modules/referrals/community-referral.service.js').communityReferralService;
  let n = 0;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ paymentsRepository } = await import('../src/modules/payments/payments.repository.js'));
    ({ communityReferralService } = await import('../src/modules/referrals/community-referral.service.js'));
  });
  after(() => server.close());

  async function signup(prefix: string) {
    const email = `${prefix.slice(0, 6)}${Date.now().toString(36)}${n++}@t.io`;
    const r = await c.registerVerified({ email, password: 'Passw0rd!x', firstName: 'Cref', lastName: prefix });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    return { token: r.body.data.accessToken as string, id: r.body.data.user.id as string };
  }
  async function community() {
    const owner = await signup('own');
    const r = await c.call('POST', '/communities', { token: owner.token, body: { title: `Cref ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: PRICE, visibility: 'public' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { id: r.body.data.id as string, owner };
  }
  const setRate = (communityId: string, token: string, rateBps: number) => c.call('PUT', `/communities/${communityId}/referral-program`, { token, body: { rateBps } });
  const program = async (communityId: string, token: string) => (await c.call('GET', `/communities/${communityId}/referral-program`, { token })).body.data;
  async function checkoutAndPay(user: { token: string }, communityId: string, referralCode?: string) {
    const co = await c.call('POST', `/communities/${communityId}/checkout`, { token: user.token, body: { method: 'stripe', ...(referralCode ? { referralCode } : {}) } });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const paid = await c.payIntent(co.body.data.id, user.token);
    assert.equal(paid.body.data.status, 'succeeded', JSON.stringify(paid.body));
    return paid.body.data as { id: string; amountCents: number };
  }
  /** Thành viên (đã trả phí) của cộng đồng + mã giới thiệu của họ. */
  async function member(communityId: string, prefix: string) {
    const u = await signup(prefix);
    await checkoutAndPay(u, communityId);
    const p = await program(communityId, u.token);
    return { ...u, code: p.code as string };
  }

  it('chỉ chủ cộng đồng đặt được %, 0..50%; thành viên xem được; người ngoài bị chặn', async () => {
    const { id, owner } = await community();
    const m = await member(id, 'mem');
    assert.equal((await setRate(id, m.token, 1000)).status, 403);
    assert.equal((await setRate(id, owner.token, 5001)).status, 400);
    assert.equal((await setRate(id, owner.token, -1)).status, 400);
    assert.equal((await setRate(id, owner.token, 12.5)).status, 400);
    const ok = await setRate(id, owner.token, 2000);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(ok.body.data, { rateBps: 2000, enabled: true });

    const p = await program(id, m.token);
    assert.equal(p.rateBps, 2000);
    assert.equal(p.enabled, true);
    assert.equal(p.isOwner, false);
    assert.ok(p.link.includes(`/communities/${id}?cref=`), p.link);
    assert.equal(p.owner, null);
    const po = await program(id, owner.token);
    assert.equal(po.isOwner, true);
    assert.deepEqual(po.owner, { referrers: 0, referred: 0, commissionCents: 0 });

    const stranger = await signup('str');
    assert.equal((await c.call('GET', `/communities/${id}/referral-program`, { token: stranger.token })).status, 403);
  });

  it('mời bằng link: người mời nhận đúng % trên thanh toán; số dư creator bị trừ khoản đó; hoàn tiền hủy hoa hồng', async () => {
    const { id, owner } = await community();
    await setRate(id, owner.token, 2000);
    const a = await member(id, 'refa');
    const b = await signup('invb');
    const pay = await checkoutAndPay(b, id, a.code);
    assert.equal(pay.amountCents, PRICE);

    const rows = await db.prisma.referralCommission.findMany({ where: { referrerId: a.id, kind: 'community' } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.amountCents, 50_000); // 20% × 250.000
    assert.equal(rows[0]!.baseCents, PRICE);
    assert.equal(rows[0]!.rateBps, 2000);
    assert.equal(rows[0]!.communityId, id);
    assert.equal(rows[0]!.sourceRef, `cpayment:${pay.id}`);

    const pa = await program(id, a.token);
    assert.equal(pa.stats.referred, 1);
    assert.equal(pa.stats.paying, 1);
    assert.equal(pa.stats.commissionCents, 50_000);
    assert.equal(pa.stats.pendingCents, 50_000);
    assert.equal(pa.referred[0].userId, b.id);
    assert.equal(pa.referred[0].earnedCents, 50_000);
    assert.deepEqual((await program(id, owner.token)).owner, { referrers: 1, referred: 1, commissionCents: 50_000 });

    // Doanh thu creator: 2 thanh toán × 250.000, trừ phí nền tảng 10% và hoa hồng giới thiệu 50.000.
    const rates = { commissionBp: 1000, gatewayFeeBp: 0, gatewayFeeFixedCents: 0 };
    const bal = await paymentsRepository.balance(id, rates);
    assert.equal(bal.net, 2 * PRICE - 2 * 25_000 - 50_000);
    const totals = await paymentsRepository.revenueTotals(id, {}, rates);
    assert.equal(totals.referralCommissionCents, 50_000);
    assert.equal(totals.netCents, 2 * PRICE - 2 * 25_000 - 50_000);

    // Hoàn tiền toàn bộ giao dịch của B ⇒ hoa hồng pending bị hủy, số dư creator không còn bị trừ.
    const { referralsService } = await import('../src/modules/referrals/referrals.service.js');
    await referralsService.voidForPayment(pay.id);
    assert.equal((await db.prisma.referralCommission.findUniqueOrThrow({ where: { id: rows[0]!.id } })).status, 'void');
    assert.equal((await paymentsRepository.balance(id, rates)).net, 2 * PRICE - 2 * 25_000);
  });

  it('chỉ tính từ khi chủ bật; người đầu tiên thắng; tự mời / mã lạ / người mời không phải thành viên bị bỏ qua', async () => {
    const { id, owner } = await community();
    const a = await member(id, 'refa');
    const a2 = await member(id, 'refx');

    // Chương trình tắt (0%): không ghi nhận, không có hoa hồng.
    const off = await signup('off');
    await checkoutAndPay(off, id, a.code);
    assert.equal(await db.prisma.communityReferral.count({ where: { communityId: id, referredUserId: off.id } }), 0);
    assert.equal(await db.prisma.referralCommission.count({ where: { kind: 'community', referredUserId: off.id } }), 0);

    await setRate(id, owner.token, 1000);
    // Mã lạ, người mời không phải thành viên của cộng đồng này → bỏ qua êm (vẫn thanh toán bình thường).
    const outsider = await signup('outs');
    const outsiderCode = (await c.call('GET', '/me/referral?kind=member', { token: outsider.token })).body.data.code as string;
    const u1 = await signup('u1');
    await checkoutAndPay(u1, id, 'ma-khong-ton-tai');
    const u2 = await signup('u2');
    await checkoutAndPay(u2, id, outsiderCode);
    assert.equal(await db.prisma.communityReferral.count({ where: { communityId: id, referredUserId: { in: [u1.id, u2.id] } } }), 0);

    // Người đầu tiên thắng: B dùng mã của A rồi mới tới mã của A2 ⇒ vẫn là A.
    const b = await signup('invb');
    assert.equal(await communityReferralService.attribute(b.id, id, a.code), true);
    assert.equal(await communityReferralService.attribute(b.id, id, a2.code), false);
    await checkoutAndPay(b, id, a2.code);
    const ref = await db.prisma.communityReferral.findUniqueOrThrow({ where: { communityId_referredUserId: { communityId: id, referredUserId: b.id } } });
    assert.equal(ref.referrerId, a.id);
    assert.equal(await db.prisma.referralCommission.count({ where: { kind: 'community', referrerId: a.id, referredUserId: b.id } }), 1);
    assert.equal(await db.prisma.referralCommission.count({ where: { kind: 'community', referrerId: a2.id } }), 0);

    // Tự mời bị bỏ qua; người đã là thành viên không thể được "mời" lại.
    assert.equal(await communityReferralService.attribute(a.id, id, a.code), false);
    assert.equal(await communityReferralService.attribute(a.id, id, a2.code), false);
  });

  it('đổi % sau đó: hoa hồng đã ghi giữ tỉ lệ cũ; đối soát tạo lại hoa hồng bị thiếu (idempotent)', async () => {
    const { id, owner } = await community();
    await setRate(id, owner.token, 1000);
    const a = await member(id, 'refa');
    const b = await signup('invb');
    const pay = await checkoutAndPay(b, id, a.code);
    await setRate(id, owner.token, 3000);
    const first = await db.prisma.referralCommission.findFirstOrThrow({ where: { sourceRef: `cpayment:${pay.id}` } });
    assert.equal(first.rateBps, 1000);
    assert.equal(first.amountCents, 25_000);

    // Xóa tay hoa hồng (giả lập hook sau commit bị mất) rồi đối soát: tạo lại đúng 1 dòng, chạy lần 2 không nhân đôi.
    await db.prisma.referralCommission.delete({ where: { id: first.id } });
    const r1 = await communityReferralService.reconcile(new Date());
    assert.ok(r1.created >= 1, JSON.stringify(r1));
    await communityReferralService.reconcile(new Date());
    assert.equal(await db.prisma.referralCommission.count({ where: { sourceRef: `cpayment:${pay.id}` } }), 1);
  });

  it('cộng đồng MIỄN PHÍ: vào qua link (enroll) vẫn được ghi nhận người mời; mã lạ/đã là thành viên bị bỏ qua', async () => {
    const owner = await signup('fown');
    const cr = await c.call('POST', '/communities', { token: owner.token, body: { title: `Free ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: 0, visibility: 'public' } });
    assert.equal(cr.status, 201, JSON.stringify(cr.body));
    const id = cr.body.data.id as string;
    assert.equal((await setRate(id, owner.token, 1000)).status, 200);

    const referrer = await signup('frf');
    assert.equal((await c.call('POST', `/communities/${id}/enroll`, { token: referrer.token, body: {} })).status, 200);
    const code = (await program(id, referrer.token)).code as string;

    const guest = await signup('fgu');
    assert.equal((await c.call('POST', `/communities/${id}/enroll`, { token: guest.token, body: { referralCode: code } })).status, 200);
    const p = await program(id, referrer.token);
    assert.equal(p.stats.referred, 1);
    assert.equal(p.referred[0].userId, guest.id);

    // Mã lạ: vẫn vào được cộng đồng nhưng không ghi nhận.
    const g2 = await signup('fg2');
    assert.equal((await c.call('POST', `/communities/${id}/enroll`, { token: g2.token, body: { referralCode: 'khongco' } })).status, 200);
    assert.equal((await program(id, referrer.token)).stats.referred, 1);
  });
});
