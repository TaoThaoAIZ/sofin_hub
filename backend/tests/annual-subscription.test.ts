import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const DAY = 86_400_000;
const thisYear = new Date().getUTCFullYear();
const card = (over: Record<string, unknown> = {}) => ({
  type: 'card',
  token: `tok_mock_${randomBytes(6).toString('hex')}`,
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: thisYear + 2,
  ...over,
});

describe('gói thành viên theo năm, báo giá, dùng thử có thẻ, nhắc trước ngày trừ tiền', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let paymentsService: typeof import('../src/modules/payments/payments.service.js').paymentsService;
  let mockGateway: typeof import('../src/modules/payments/payments.gateway.js').mockGateway;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let writeOverrides: typeof import('../src/modules/settings/settings.service.js').writeOverrides;
  let getOverrides: typeof import('../src/modules/settings/settings.service.js').getOverrides;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ paymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ mockGateway } = await import('../src/modules/payments/payments.gateway.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ writeOverrides, getOverrides } = await import('../src/modules/settings/settings.service.js'));
  });
  after(() => server.close());

  let n = 0;
  /** Cộng đồng có phí do 1 owner mới tạo (mặc định $7/tháng, $48/năm). */
  async function paidCommunity(over: Record<string, unknown> = {}) {
    const owner = await c.registerUser('own');
    const r = await c.call('POST', '/communities', { token: owner.token, body: { title: `Gói Năm ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: 7, priceAnnualUsd: 48, visibility: 'public', ...over } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { id: r.body.data.id as string, owner };
  }
  async function checkout(user: { token: string }, id: string, body: Record<string, unknown> = {}, headers?: Record<string, string>) {
    return c.call('POST', `/communities/${id}/checkout`, { token: user.token, body: { method: 'stripe', ...body }, headers });
  }
  async function pay(user: { token: string }, id: string, body: Record<string, unknown> = {}) {
    const co = await checkout(user, id, body);
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: user.token });
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data;
  }
  const subOf = (userId: string, communityId: string) => db.prisma.subscription.findFirst({ where: { userId, communityId }, orderBy: { createdAt: 'desc' } });

  describe('báo giá (checkout-quote) do server tính', () => {
    it('monthly + annual: giá/tháng, % tiết kiệm, ngày trừ tiền đầu, ngày nhắc; 7 ngày dùng thử', async () => {
      const { id } = await paidCommunity();
      const now = new Date('2026-10-01T00:00:00.000Z');
      const q = await paymentsService.quote(id, undefined, 'annual', now);
      assert.deepEqual(q.plans.map((p) => p.interval), ['monthly', 'annual']);
      assert.deepEqual(q.plans[0], { interval: 'monthly', label: 'Hàng tháng', priceUsd: 7, billedUsd: 7, perMonthUsd: 7, savingsPct: 0, popular: true, periodDays: 30 });
      assert.deepEqual(q.plans[1], { interval: 'annual', label: 'Hàng năm', priceUsd: 48, billedUsd: 48, perMonthUsd: 4, savingsPct: 43, popular: false, periodDays: 365 });
      assert.equal(q.selected, 'annual');
      assert.equal(q.trialDays, 7);
      assert.equal(q.firstChargeDate, '2026-10-08T00:00:00.000Z');
      assert.equal(q.remindAt, '2026-10-05T00:00:00.000Z');
      assert.equal(q.firstChargeAmountUsd, 48);
      assert.equal(q.firstChargeAmountCents, 4800);
      assert.equal(q.dueTodayUsd, 0);
      assert.equal(q.remindDaysBefore, 3);
      assert.equal(q.currency, 'USD');
      assert.equal(q.provider, 'stripe');

      const m = await paymentsService.quote(id, undefined, 'monthly', now);
      assert.equal(m.firstChargeAmountCents, 700);

      // qua HTTP (không cần đăng nhập)
      const h = await c.call('GET', `/communities/${id}/checkout-quote?interval=annual`);
      assert.equal(h.status, 200);
      assert.equal(new Date(h.body.data.firstChargeDate).getTime() - new Date(h.body.data.startsAt).getTime(), 7 * DAY);
      assert.equal((await c.call('GET', `/communities/${id}/checkout-quote`)).body.data.selected, 'monthly');
    });

    it('lỗi: 404, miễn phí 400, giá năm không có 400, interval sai 400; tắt dùng thử / đã dùng thử ⇒ trialDays 0', async () => {
      assert.equal((await c.call('GET', '/communities/khong-co/checkout-quote')).status, 404);
      assert.equal((await c.call('GET', '/communities/photo/checkout-quote')).body.error.code, 'COMMUNITY_FREE');
      const noAnnual = await paidCommunity({ priceAnnualUsd: undefined });
      const q = await c.call('GET', `/communities/${noAnnual.id}/checkout-quote`);
      assert.deepEqual(q.body.data.plans.map((p: { interval: string }) => p.interval), ['monthly']);
      assert.equal((await c.call('GET', `/communities/${noAnnual.id}/checkout-quote?interval=annual`)).body.error.code, 'INTERVAL_UNAVAILABLE');
      assert.equal((await c.call('GET', `/communities/${noAnnual.id}/checkout-quote?interval=weekly`)).status, 400);

      const off = await paidCommunity({ memberTrialEnabled: false });
      const o = (await c.call('GET', `/communities/${off.id}/checkout-quote?interval=annual`)).body.data;
      assert.equal(o.trialDays, 0);
      assert.equal(o.trialEligible, false);
      assert.equal(o.dueTodayUsd, 48);
      assert.equal(o.remindAt, null);
      assert.equal(o.firstChargeDate, o.startsAt);

      const { id } = await paidCommunity();
      const u = await c.registerUser('qt');
      assert.equal((await c.call('GET', `/communities/${id}/checkout-quote`, { token: u.token })).body.data.trialDays, 7);
      assert.equal((await c.call('POST', `/communities/${id}/trial`, { token: u.token, body: {} })).status, 201);
      await c.call('POST', `/communities/${id}/subscription/cancel`, { token: u.token, body: { atPeriodEnd: false } });
      const after = (await c.call('GET', `/communities/${id}/checkout-quote`, { token: u.token })).body.data;
      assert.equal(after.trialDays, 0, 'đã dùng thử rồi');
      assert.equal(after.dueTodayUsd, 7);
    });
  });

  describe('checkout / confirm / gia hạn / hoàn tiền theo chu kỳ', () => {
    it('monthly mặc định y như cũ; annual lấy giá năm từ server (bỏ qua số tiền client), kỳ 365 ngày', async () => {
      const { id } = await paidCommunity();
      const m = await c.registerUser('mo');
      const mp = await pay(m, id);
      assert.equal(mp.interval, 'monthly');
      assert.equal(mp.amountCents, 700);
      const ms = (await subOf(m.id, id))!;
      assert.equal(ms.interval, 'monthly');
      assert.equal(Math.round((ms.currentPeriodEnd.getTime() - ms.currentPeriodStart.getTime()) / DAY), 30);

      const a = await c.registerUser('an');
      const co = await checkout(a, id, { interval: 'annual', amountCents: 1, amountUsd: 0.01 });
      assert.equal(co.body.data.interval, 'annual');
      assert.equal(co.body.data.amountCents, 4800);
      const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: a.token });
      assert.equal(cf.body.data.status, 'succeeded');
      assert.match(cf.body.data.invoiceNumber, /^INV-/);
      const s = (await subOf(a.id, id))!;
      assert.equal(s.interval, 'annual');
      assert.equal(s.priceCents, 4800);
      assert.equal(Math.round((s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime()) / DAY), 365);
      assert.equal(new Date(cf.body.data.periodEnd).getTime(), s.currentPeriodEnd.getTime());
      assert.equal(await enrollmentService.isEnrolled(a.id, id), true);

      assert.equal((await checkout(a, id, { interval: 'biennial' })).status, 400);
      const noAnnual = await paidCommunity({ priceAnnualUsd: undefined });
      const u = await c.registerUser('na');
      assert.equal((await checkout(u, noAnnual.id, { interval: 'annual' })).body.error.code, 'INTERVAL_UNAVAILABLE');
    });

    it('kỳ năm lấy từ Global Settings payments.annualPeriodDays', async () => {
      const { id } = await paidCommunity();
      const prev = getOverrides();
      await writeOverrides({ ...prev, 'payments.annualPeriodDays': 100 }, null);
      try {
        const u = await c.registerUser('cfg');
        await pay(u, id, { interval: 'annual' });
        const s = (await subOf(u.id, id))!;
        assert.equal(Math.round((s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime()) / DAY), 100);
      } finally {
        await writeOverrides(prev, null);
      }
    });

    it('tái dùng intent pending cùng chu kỳ (idempotent); đổi chu kỳ ⇒ intent mới; Idempotency-Key giữ nguyên', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('reuse');
      const a1 = await checkout(u, id, { interval: 'annual' });
      const a2 = await checkout(u, id, { interval: 'annual' });
      assert.equal(a1.body.data.id, a2.body.data.id);
      const m1 = await checkout(u, id, { interval: 'monthly' });
      assert.notEqual(m1.body.data.id, a1.body.data.id);
      assert.equal(m1.body.data.amountCents, 700);
      const k1 = await checkout(u, id, { interval: 'annual' }, { 'Idempotency-Key': 'k-annual-1' });
      const k2 = await checkout(u, id, { interval: 'annual' }, { 'Idempotency-Key': 'k-annual-1' });
      assert.equal(k1.body.data.id, k2.body.data.id);
    });

    it('chống trừ tiền trùng: 2 intent khác chu kỳ cùng người ⇒ chỉ 1 gói sống, intent thứ hai bị chặn TRƯỚC khi gọi cổng', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('dbl');
      const a = await checkout(u, id, { interval: 'annual' });
      const m = await checkout(u, id, { interval: 'monthly' });
      assert.equal((await c.call('POST', `/payments/${a.body.data.id}/confirm`, { token: u.token })).status, 200);
      const second = await c.call('POST', `/payments/${m.body.data.id}/confirm`, { token: u.token });
      assert.equal(second.status, 409);
      assert.equal(await db.prisma.subscription.count({ where: { userId: u.id, communityId: id, status: { in: ['active', 'trialing'] } } }), 1);
      assert.equal((await subOf(u.id, id))!.interval, 'annual');
      const blocked = await db.prisma.payment.findUnique({ where: { id: m.body.data.id } });
      assert.equal(blocked!.status, 'pending');
      assert.equal(blocked!.gatewayChargeId, null, 'cổng không bị gọi ⇒ không bị trừ tiền');
      assert.equal((await checkout(u, id, { interval: 'monthly' })).status, 409, 'đã có gói active');
    });

    it('gia hạn năm: chưa đến hạn sau 31 ngày; sau 366 ngày trừ đúng 4800 và tiến thêm 365 ngày; thẻ lỗi ⇒ expired', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('rn');
      await pay(u, id, { interval: 'annual' });
      const before = (await subOf(u.id, id))!;
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await db.prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'gói năm không gia hạn sau 31 ngày');

      const r = await paymentsService.processDueSubscriptions(new Date(Date.now() + 366 * DAY));
      assert.ok(r.renewed >= 1);
      const pays = await db.prisma.payment.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'asc' } });
      assert.deepEqual(pays.map((p) => [p.kind, p.interval, p.amountCents]), [['initial', 'annual', 4800], ['renewal', 'annual', 4800]]);
      assert.notEqual(pays[0]!.invoiceNumber, pays[1]!.invoiceNumber);
      const after = (await subOf(u.id, id))!;
      assert.equal(after.currentPeriodEnd.getTime() - before.currentPeriodEnd.getTime(), 365 * DAY);

      const f = await c.registerUser('rnf');
      await pay(f, id, { interval: 'annual' });
      mockGateway.failFor(f.id);
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 366 * DAY));
      mockGateway.failFor(f.id, false);
      assert.equal(await enrollmentService.isEnrolled(f.id, id), false);
      assert.equal((await subOf(f.id, id))!.status, 'expired');
    });

    it('rời cộng đồng khi đang gói năm: hủy cuối kỳ (không trừ tiếp), vào lại được tới hết năm, hết kỳ thì kết thúc', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('lv');
      await pay(u, id, { interval: 'annual' });
      assert.equal((await c.call('POST', `/communities/${id}/enroll`, { token: u.token })).body.data.enrolled, false);
      const sub = (await subOf(u.id, id))!;
      assert.equal(sub.cancelAtPeriodEnd, true);
      assert.equal((await c.call('POST', `/communities/${id}/enroll`, { token: u.token })).body.data.enrolled, true);
      assert.equal(await db.prisma.payment.count({ where: { userId: u.id } }), 1);
      await c.call('POST', `/communities/${id}/enroll`, { token: u.token }); // rời lại
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 100 * DAY));
      assert.equal((await subOf(u.id, id))!.status, 'active', 'còn trong năm đã trả');
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 366 * DAY));
      assert.equal((await subOf(u.id, id))!.status, 'canceled');
      assert.equal(await db.prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0);
    });

    it('hoàn tiền gói năm trong cửa sổ: thu hồi quyền, payment refunded 4800; doanh thu: MRR gói năm = giá/12', async () => {
      const { id, owner } = await paidCommunity();
      const a = await c.registerUser('rf');
      const m = await c.registerUser('rfm');
      const ap = await pay(a, id, { interval: 'annual' });
      await pay(m, id, { interval: 'monthly' });
      const rev = (await c.call('GET', `/communities/${id}/revenue`, { token: owner.token })).body.data;
      assert.equal(rev.mrrCents, 400 + 700);
      assert.equal(rev.activePaidMembers, 2);
      assert.equal(rev.grossCents, 4800 + 700);

      const rf = await c.call('POST', `/payments/${ap.id}/refund-request`, { token: a.token, body: { reason: 'Đổi ý' } });
      assert.equal(rf.status, 201, JSON.stringify(rf.body));
      assert.equal(rf.body.data.status, 'approved');
      assert.equal(rf.body.data.amountCents, 4800);
      assert.equal(await enrollmentService.isEnrolled(a.id, id), false);
      assert.equal((await subOf(a.id, id))!.status, 'canceled');
      assert.equal(mockGateway.refundedTotal(ap.gatewayChargeId), 4800);
      const rev2 = (await c.call('GET', `/communities/${id}/revenue`, { token: owner.token })).body.data;
      assert.equal(rev2.mrrCents, 700);
      assert.equal(rev2.refundsCents, 4800);
    });

    it('cộng đồng riêng tư: cần được duyệt, trừ khi chủ bật autoApprovePaid', async () => {
      const strict = await paidCommunity({ visibility: 'private' });
      const u = await c.registerUser('pv');
      assert.equal((await checkout(u, strict.id, { interval: 'annual' })).body.error.code, 'JOIN_REQUEST_REQUIRED');
      const auto = await paidCommunity({ visibility: 'private', autoApprovePaid: true });
      const co = await checkout(u, auto.id, { interval: 'annual' });
      assert.equal(co.status, 201, JSON.stringify(co.body));
      assert.equal(co.body.data.amountCents, 4800);
    });
  });

  describe('dùng thử có thẻ: tự trừ cuối kỳ thử, nhắc trước 3 ngày', () => {
    it('không PAN/CVC: object strict từ chối số thẻ/cvc, thẻ hết hạn, token sai; chỉ lưu brand/last4/hạn', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('pan');
      const bad = (paymentMethod: unknown) => c.call('POST', `/communities/${id}/trial`, { token: u.token, body: { interval: 'annual', paymentMethod } });
      assert.equal((await bad({ ...card(), number: '4242424242424242' })).status, 400);
      assert.equal((await bad({ ...card(), cvc: '123' })).status, 400);
      assert.equal((await bad(card({ expYear: thisYear - 1 }))).status, 400);
      assert.equal((await bad(card({ expMonth: 13 }))).status, 400);
      assert.equal((await bad(card({ token: '4242424242424242' }))).status, 400);
      assert.equal((await bad(card({ brand: 'bitcoin' }))).status, 400);
      assert.equal((await checkout(u, id, { paymentMethod: { ...card(), cvc: '123' } })).status, 400);
      assert.equal(await db.prisma.paymentCard.count({ where: { userId: u.id } }), 0);
      assert.equal(await db.prisma.subscription.count({ where: { userId: u.id } }), 0);

      const ok = await bad(card({ token: 'tok_mock_safe123456' }));
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.deepEqual(ok.body.data.paymentMethod && Object.keys(ok.body.data.paymentMethod).sort(), ['brand', 'createdAt', 'expMonth', 'expYear', 'id', 'last4']);
      assert.equal(JSON.stringify(ok.body).includes('tok_mock_safe123456'), false, 'token cổng không lộ ra API');
      assert.equal(ok.body.data.nextChargeAmountCents, 4800);
      assert.equal(ok.body.data.interval, 'annual');
      assert.equal(ok.body.data.status, 'trialing');
      const rows = await db.prisma.paymentCard.findMany({ where: { userId: u.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.last4, '4242');
      assert.ok(!/\d{13,19}/.test(JSON.stringify(rows)));
    });

    it('tắt dùng thử ở cộng đồng ⇒ 400 TRIAL_NOT_AVAILABLE; trial không thẻ giữ hành vi cũ (hết thử là hết quyền)', async () => {
      const off = await paidCommunity({ memberTrialEnabled: false });
      const u = await c.registerUser('toff');
      assert.equal((await c.call('POST', `/communities/${off.id}/trial`, { token: u.token, body: {} })).body.error.code, 'TRIAL_NOT_AVAILABLE');

      const { id } = await paidCommunity();
      const t = await c.call('POST', `/communities/${id}/trial`, { token: u.token });
      assert.equal(t.status, 201);
      assert.equal(t.body.data.interval, 'monthly');
      assert.equal(t.body.data.nextChargeAmountCents, null);
      const r = await paymentsService.processDueSubscriptions(new Date(Date.now() + 8 * DAY));
      assert.ok(r.trialsExpired >= 1);
      assert.equal(await enrollmentService.isEnrolled(u.id, id), false);
    });

    it('nhắc 3 ngày trước ngày trừ tiền: đúng cửa sổ, đúng 1 lần dù chạy lặp/song song, email + thông báo', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('rem');
      await c.call('POST', `/communities/${id}/trial`, { token: u.token, body: { interval: 'annual', paymentMethod: card() } });
      const outbox = async () => (await c.call('GET', `/dev/outbox?to=${encodeURIComponent(u.email)}`)).body.data as Array<{ subject: string; text: string }>;

      assert.equal((await paymentsService.sendTrialReminders(new Date(Date.now() + 2 * DAY))).sent, 0, 'còn 5 ngày: chưa nhắc');
      assert.equal((await outbox()).length, 0);
      const [r1, r2] = await Promise.all([paymentsService.sendTrialReminders(new Date(Date.now() + 4.5 * DAY)), paymentsService.sendTrialReminders(new Date(Date.now() + 4.5 * DAY))]);
      assert.equal(r1.sent + r2.sent, 1, 'chạy song song vẫn chỉ nhắc 1 lần');
      assert.equal((await paymentsService.sendTrialReminders(new Date(Date.now() + 5 * DAY))).sent, 0, 'chạy lại không nhắc nữa');
      const mails = await outbox();
      assert.equal(mails.length, 1);
      assert.match(mails[0]!.text, /48\.00 USD/);
      assert.match(mails[0]!.text, /4242/);
      assert.ok((await db.prisma.subscription.findFirst({ where: { userId: u.id } }))!.trialReminderSentAt);
      const notes = await c.call('GET', '/notifications', { token: u.token });
      assert.ok(JSON.stringify(notes.body).includes('Dùng thử sắp kết thúc'));

      // không nhắc: đã hủy / không có thẻ
      const v = await c.registerUser('rem2');
      await c.call('POST', `/communities/${id}/trial`, { token: v.token, body: { paymentMethod: card() } });
      await c.call('POST', `/communities/${id}/subscription/cancel`, { token: v.token, body: { atPeriodEnd: true } });
      const w = await c.registerUser('rem3');
      await c.call('POST', `/communities/${id}/trial`, { token: w.token });
      await paymentsService.sendTrialReminders(new Date(Date.now() + 4.5 * DAY));
      assert.equal((await db.prisma.subscription.findFirst({ where: { userId: v.id } }))!.trialReminderSentAt, null);
      assert.equal((await db.prisma.subscription.findFirst({ where: { userId: w.id } }))!.trialReminderSentAt, null);
    });

    it('hết thử: tự trừ 4800, chuyển active kỳ 365 ngày tính từ cuối thử, hóa đơn, vẫn là thành viên; chạy lại không trừ lần hai', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('conv');
      await c.call('POST', `/communities/${id}/trial`, { token: u.token, body: { interval: 'annual', paymentMethod: card() } });
      const trial = (await subOf(u.id, id))!;
      assert.equal(Math.round((trial.currentPeriodEnd.getTime() - trial.currentPeriodStart.getTime()) / DAY), 7);
      assert.equal(trial.status, 'trialing');

      const at = new Date(Date.now() + 8 * DAY);
      const r = await paymentsService.processDueSubscriptions(at);
      assert.ok(r.trialsConverted >= 1);
      await paymentsService.processDueSubscriptions(new Date(at.getTime() + 60_000));
      const s = (await subOf(u.id, id))!;
      assert.equal(s.status, 'active');
      assert.equal(s.interval, 'annual');
      assert.equal(s.currentPeriodStart.getTime(), trial.currentPeriodEnd.getTime());
      assert.equal(s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime(), 365 * DAY);
      const pays = await db.prisma.payment.findMany({ where: { userId: u.id } });
      assert.equal(pays.length, 1, 'đúng 1 lần trừ');
      assert.deepEqual([pays[0]!.kind, pays[0]!.status, pays[0]!.amountCents, pays[0]!.interval], ['initial', 'succeeded', 4800, 'annual']);
      assert.ok(pays[0]!.invoiceNumber);
      assert.equal(pays[0]!.subscriptionId, s.id);
      assert.equal(await enrollmentService.isEnrolled(u.id, id), true);
      // trừ xong, hoàn tiền trong cửa sổ vẫn được
      const rf = await c.call('POST', `/payments/${pays[0]!.id}/refund-request`, { token: u.token, body: { reason: 'Không dùng nữa' } });
      assert.equal(rf.body.data.status, 'approved');
    });

    it('thẻ bị từ chối lúc trừ tiền cuối thử ⇒ expired, thu hồi quyền, ghi giao dịch failed; hủy trước hạn ⇒ không bị trừ', async () => {
      const { id } = await paidCommunity();
      const bad = await c.registerUser('decl');
      await c.call('POST', `/communities/${id}/trial`, { token: bad.token, body: { interval: 'annual', paymentMethod: card({ token: 'tok_mock_declined' }) } });
      const cancelled = await c.registerUser('canc');
      await c.call('POST', `/communities/${id}/trial`, { token: cancelled.token, body: { interval: 'annual', paymentMethod: card() } });
      const cr = await c.call('POST', `/communities/${id}/subscription/cancel`, { token: cancelled.token, body: { atPeriodEnd: true } });
      assert.equal(cr.status, 200);

      const r = await paymentsService.processDueSubscriptions(new Date(Date.now() + 8 * DAY));
      assert.ok(r.renewalFailed >= 1);
      assert.equal((await subOf(bad.id, id))!.status, 'expired');
      assert.equal(await enrollmentService.isEnrolled(bad.id, id), false);
      const failed = await db.prisma.payment.findMany({ where: { userId: bad.id } });
      assert.deepEqual(failed.map((p) => [p.status, p.kind, p.failureReason]), [['failed', 'initial', 'card_declined']]);

      assert.equal(await db.prisma.payment.count({ where: { userId: cancelled.id } }), 0, 'đã hủy ⇒ không bị trừ');
      assert.ok(['expired', 'canceled'].includes((await subOf(cancelled.id, id))!.status), 'hết thử mà đã hủy: gói kết thúc, không active');
      assert.equal(await enrollmentService.isEnrolled(cancelled.id, id), false);
    });

    it('statusFor trả thẻ (chỉ brand/last4/hạn); /me/payment-methods; 401', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('st');
      assert.equal((await c.call('GET', '/me/payment-methods')).status, 401);
      await c.call('POST', `/communities/${id}/trial`, { token: u.token, body: { paymentMethod: card({ brand: 'mastercard', last4: '4444' }) } });
      const st = (await c.call('GET', `/communities/${id}/subscription`, { token: u.token })).body.data;
      assert.equal(st.subscription.paymentMethod.last4, '4444');
      assert.equal(st.subscription.interval, 'monthly');
      const list = (await c.call('GET', '/me/payment-methods', { token: u.token })).body.data;
      assert.equal(list.length, 1);
      assert.equal(list[0].brand, 'mastercard');
    });
  });
});
