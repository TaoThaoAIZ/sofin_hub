import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const DAY = 86_400_000;
const ADMIN_EMAIL = 'pa-hosting@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

/** Thu phí gói hosting Pro qua chuyển khoản: hóa đơn tự phát, thanh toán → gia hạn + hoa hồng creator 30%, quá hạn → hạ gói. */
describe('thu phí gói hosting (Pro) + hoa hồng giới thiệu creator', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let paymentsService: typeof import('../src/modules/payments/payments.service.js').paymentsService;
  let paymentsRepository: typeof import('../src/modules/payments/payments.repository.js').paymentsRepository;
  let n = 0;
  let admin: { token: string; id: string };

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ paymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ paymentsRepository } = await import('../src/modules/payments/payments.repository.js'));
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  async function signup(prefix: string, referralCode?: string) {
    const email = `${prefix.slice(0, 6)}${Date.now().toString(36)}${n++}@t.io`;
    const r = await c.registerVerified({ email, password: 'Passw0rd!x', firstName: 'Host', lastName: prefix, ...(referralCode !== undefined ? { referralCode } : {}) });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    return { token: r.body.data.accessToken as string, id: r.body.data.user.id as string };
  }

  /** Người giới thiệu + chủ cộng đồng được mời, có gói Pro dùng thử hết hạn sau `trialEndsInDays` ngày. */
  async function setup(trialEndsInDays: number) {
    const ref = await signup('ref');
    const code = (await c.call('GET', '/me/referral?kind=creator', { token: ref.token })).body.data.code as string;
    const owner = await signup('own', code);
    const created = await c.call('POST', '/communities', { token: owner.token, body: { title: `Host ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: 0, visibility: 'public' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const communityId = created.body.data.id as string;
    const plan = await db.prisma.hostingPlan.create({
      data: { communityId, ownerId: owner.id, planKey: 'pro', cycle: 'monthly', priceAmount: 299_000, currency: 'VND', status: 'trialing', trialStartedAt: new Date(), trialEndsAt: new Date(Date.now() + trialEndsInDays * DAY) },
    });
    return { ref, owner, communityId, plan };
  }

  it('chưa tới hạn: không phát hóa đơn; tới hạn: phát đúng 1 hóa đơn (idempotent) kèm QR', async () => {
    const far = await setup(30);
    const before1 = await paymentsService.processHostingBilling(new Date());
    assert.equal(await db.prisma.payment.count({ where: { hostingPlanId: far.plan.id } }), 0, JSON.stringify(before1));

    const near = await setup(1);
    await paymentsService.processHostingBilling(new Date());
    await paymentsService.processHostingBilling(new Date()); // lặp: không tạo thêm
    const invoices = await db.prisma.payment.findMany({ where: { hostingPlanId: near.plan.id } });
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0]!.kind, 'hosting');
    assert.equal(invoices[0]!.amountCents, 299_000);
    assert.equal(invoices[0]!.status, 'pending');
    assert.ok(invoices[0]!.refCode);

    const view = await c.call('GET', `/communities/${near.communityId}/hosting-plan`, { token: near.owner.token });
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.data.invoice.id, invoices[0]!.id);
    assert.ok(view.body.data.invoice.transfer.qrUrl);
  });

  it('trả hóa đơn: gói active tới hết kỳ, hoa hồng creator 30% cho người giới thiệu, KHÔNG có hoa hồng member, không vào số dư creator', async () => {
    const s = await setup(1);
    await paymentsService.processHostingBilling(new Date());
    const inv = await db.prisma.payment.findFirstOrThrow({ where: { hostingPlanId: s.plan.id } });
    const paid = await c.payIntent(inv.id, s.owner.token);
    assert.equal(paid.body.data.status, 'succeeded', JSON.stringify(paid.body));
    assert.ok(paid.body.data.invoiceNumber);

    const plan = await db.prisma.hostingPlan.findUniqueOrThrow({ where: { id: s.plan.id } });
    assert.equal(plan.status, 'active');
    assert.ok(plan.currentPeriodEnd && plan.currentPeriodEnd.getTime() > Date.now() + 25 * DAY);

    const creator = (await c.call('GET', '/me/referral?kind=creator', { token: s.ref.token })).body.data;
    assert.equal(creator.kpis.commissionThisMonth.cents, 89_700);
    assert.equal(creator.kpis.paying.value, 1);
    const member = (await c.call('GET', '/me/referral?kind=member', { token: s.ref.token })).body.data;
    assert.equal(member.kpis.commissionThisMonth.cents, 0);
    assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: s.ref.id, sourceRef: `hosting:${inv.id}` } }), 1);

    const bal = await paymentsRepository.balance(s.communityId, { commissionBp: 1000, gatewayFeeBp: 0, gatewayFeeFixedCents: 0 });
    assert.equal(bal.net, 0); // phí hosting là tiền của nền tảng, không phải doanh thu của creator

    // Kỳ kế: còn 2 ngày tới hết kỳ ⇒ phát hóa đơn gia hạn nối tiếp kỳ cũ.
    const periodEnd = new Date(Date.now() + 2 * DAY);
    await db.prisma.hostingPlan.update({ where: { id: s.plan.id }, data: { currentPeriodEnd: periodEnd } });
    await paymentsService.processHostingBilling(new Date());
    const all = await db.prisma.payment.findMany({ where: { hostingPlanId: s.plan.id }, orderBy: { createdAt: 'asc' } });
    assert.equal(all.length, 2);
    assert.equal(all[1]!.status, 'pending');
    assert.equal(all[1]!.periodStart!.getTime(), periodEnd.getTime());
  });

  it('không trả đến hết hạn: hóa đơn expired ⇒ hạ về gói Khởi đầu, không có hoa hồng', async () => {
    const s = await setup(1);
    await paymentsService.processHostingBilling(new Date());
    const inv = await db.prisma.payment.findFirstOrThrow({ where: { hostingPlanId: s.plan.id } });
    // Giả lập đã qua hạn dùng thử và hạn trả hóa đơn.
    await db.prisma.hostingPlan.update({ where: { id: s.plan.id }, data: { trialEndsAt: new Date(Date.now() - 4 * DAY) } });
    await db.prisma.payment.update({ where: { id: inv.id }, data: { expiresAt: new Date(Date.now() - DAY), periodStart: new Date(Date.now() - 4 * DAY) } });
    await paymentsService.expireStaleSessions(new Date());
    const out = await paymentsService.processHostingBilling(new Date());
    assert.equal(out.downgraded >= 1, true, JSON.stringify(out));
    const plan = await db.prisma.hostingPlan.findUniqueOrThrow({ where: { id: s.plan.id } });
    assert.equal(plan.planKey, 'start');
    assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: s.ref.id } }), 0);
  });

  it('tìm tiền vào ngân hàng theo mã giao dịch / mã tham chiếu (không phân biệt hoa thường), trả kèm số tài khoản', async () => {
    const s = await setup(1);
    await paymentsService.processHostingBilling(new Date());
    const inv = await db.prisma.payment.findFirstOrThrow({ where: { hostingPlanId: s.plan.id } });
    await c.payIntent(inv.id, s.owner.token);
    const tx = await db.prisma.bankTransaction.findFirstOrThrow({ where: { referenceCode: inv.refCode } });

    for (const q of [tx.externalId, inv.refCode!, tx.externalId.slice(2, 8).toLowerCase()]) {
      const r = await paymentsRepository.listBankTransactions({ q }, 1, 20);
      assert.ok(r.items.some((x) => x.id === tx.id), `q=${q}`);
    }
    assert.equal((await paymentsRepository.listBankTransactions({ q: 'khong-co-giao-dich-nay' }, 1, 20)).total, 0);
    const listed = await paymentsRepository.listBankTransactions({}, 1, 50);
    assert.ok('accountNumber' in (listed.items[0] ?? { accountNumber: null }));
  });

  it('admin: giao dịch hosting hiện đúng nhãn/nền tảng giữ 100%; trang Giao dịch giới thiệu liệt kê người giới thiệu + hoa hồng', async () => {
    const s = await setup(1);
    await paymentsService.processHostingBilling(new Date());
    const inv = await db.prisma.payment.findFirstOrThrow({ where: { hostingPlanId: s.plan.id } });
    await c.payIntent(inv.id, s.owner.token);

    const tx = await c.call('GET', '/admin/payments/transactions?kind=hosting&limit=50', { token: admin.token });
    assert.equal(tx.status, 200, JSON.stringify(tx.body));
    const row = tx.body.data.find((x: { id: string }) => x.id === inv.id);
    assert.ok(row, 'giao dịch hosting phải có trong danh sách admin');
    assert.equal(row.product.label, 'Hosting · Pro');
    assert.equal(row.platformFeeCents, 299_000);
    assert.equal(row.creatorEarningsCents, 0);

    const refEmail = (await db.prisma.user.findUniqueOrThrow({ where: { id: s.ref.id } })).email;
    const list = await c.call('GET', `/admin/payments/referrals?view=commissions&q=${encodeURIComponent(refEmail)}`, { token: admin.token });
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.data.length, 1);
    const cm = list.body.data[0];
    assert.equal(cm.kind, 'creator');
    assert.equal(cm.amountCents, 89_700);
    assert.equal(cm.referrer.id, s.ref.id);
    assert.equal(cm.referred.id, s.owner.id);
    assert.equal(cm.community.id, s.communityId);
    assert.equal(cm.status, 'pending');

    // Người được mời chưa trả đồng nào vẫn có mặt ở tab "Lượt giới thiệu".
    const idle = await signup('idle', (await c.call('GET', '/me/referral?kind=member', { token: s.ref.token })).body.data.code);
    const refs = await c.call('GET', `/admin/payments/referrals?view=referrals&q=${encodeURIComponent(refEmail)}`, { token: admin.token });
    assert.equal(refs.body.data.length, 2);
    const paidRow = refs.body.data.find((x: { referred: { id: string } }) => x.referred.id === s.owner.id);
    const idleRow = refs.body.data.find((x: { referred: { id: string } }) => x.referred.id === idle.id);
    assert.equal(paidRow.commissionCents, 89_700);
    assert.equal(idleRow.commissionCents, 0);
    assert.equal(idleRow.windowActive, true);

    const summary = await c.call('GET', '/admin/payments/referrals/summary', { token: admin.token });
    assert.ok(summary.body.data.referrals >= 2 && summary.body.data.pendingCents >= 89_700);
    // Lọc theo loại/trạng thái + người thường không vào được.
    assert.equal((await c.call('GET', '/admin/payments/referrals?kind=member&q=' + encodeURIComponent(refEmail), { token: admin.token })).body.data.length, 0);
    assert.equal((await c.call('GET', '/admin/payments/referrals', { token: s.owner.token })).status, 403);
  });
});
