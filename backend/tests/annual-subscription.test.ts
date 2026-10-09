import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const DAY = 86_400_000;
/** VND: 7 USD ≈ 175.000đ/tháng, 48 USD ≈ 1.200.000đ/năm (seedVnd). */
const M = 175_000;
const A = 1_200_000;
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

describe('gói thành viên theo năm, báo giá (không còn dùng thử), gói trialing cũ: hết hạn/nhắc/chuyển active (chuyển khoản VND)', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let paymentsService: typeof import('../src/modules/payments/payments.service.js').paymentsService;
  let bankGateway: typeof import('../src/modules/payments/payments.gateway.js').bankGateway;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let writeOverrides: typeof import('../src/modules/settings/settings.service.js').writeOverrides;
  let getOverrides: typeof import('../src/modules/settings/settings.service.js').getOverrides;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ paymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ bankGateway } = await import('../src/modules/payments/payments.gateway.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ writeOverrides, getOverrides } = await import('../src/modules/settings/settings.service.js'));
  });
  after(() => server.close());

  let n = 0;
  /** Cộng đồng có phí do 1 owner mới tạo (mặc định 175.000đ/tháng, 1.200.000đ/năm). */
  async function paidCommunity(over: Record<string, unknown> = {}) {
    const owner = await c.registerUser('own');
    const r = await c.call('POST', '/communities', { token: owner.token, body: { title: `Gói Năm ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: M, priceAnnualUsd: A, visibility: 'public', ...over } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { id: r.body.data.id as string, owner };
  }
  async function checkout(user: { token: string }, id: string, body: Record<string, unknown> = {}, headers?: Record<string, string>) {
    return c.call('POST', `/communities/${id}/checkout`, { token: user.token, body: { method: 'bank_transfer', ...body }, headers });
  }
  async function pay(user: { token: string }, id: string, body: Record<string, unknown> = {}) {
    const co = await checkout(user, id, body);
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.payIntent(co.body.data.id, user.token);
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data;
  }
  const subOf = (userId: string, communityId: string) => db.prisma.subscription.findFirst({ where: { userId, communityId }, orderBy: { createdAt: 'desc' } });

  describe('báo giá (checkout-quote) do server tính', () => {
    it('monthly + annual: giá/tháng, % tiết kiệm, ngày trừ tiền đầu, ngày nhắc; không còn dùng thử (trialDays 0)', async () => {
      const { id } = await paidCommunity();
      const now = new Date('2026-10-01T00:00:00.000Z');
      const q = await paymentsService.quote(id, undefined, 'annual', now);
      assert.deepEqual(q.plans.map((p) => p.interval), ['monthly', 'annual']);
      assert.deepEqual(q.plans[0], { interval: 'monthly', label: 'Hàng tháng', priceUsd: M, billedUsd: M, perMonthUsd: M, savingsPct: 0, popular: true, periodDays: 30 });
      assert.deepEqual(q.plans[1], { interval: 'annual', label: 'Hàng năm', priceUsd: A, billedUsd: A, perMonthUsd: 100_000, savingsPct: 43, popular: false, periodDays: 365 });
      assert.equal(q.selected, 'annual');
      assert.equal(q.trialDays, 0);
      assert.equal(q.trialEligible, false);
      assert.equal(q.firstChargeDate, '2026-10-01T00:00:00.000Z', 'thu ngay, không có thời gian dùng thử');
      assert.equal(q.remindAt, null);
      assert.equal(q.firstChargeAmountUsd, A);
      assert.equal(q.firstChargeAmountCents, A);
      assert.equal(q.dueTodayUsd, A);
      assert.equal(q.remindDaysBefore, 3);
      assert.equal(q.currency, 'VND');
      assert.equal(q.provider, 'bank_transfer');

      const m = await paymentsService.quote(id, undefined, 'monthly', now);
      assert.equal(m.firstChargeAmountCents, M);

      // qua HTTP (không cần đăng nhập)
      const h = await c.call('GET', `/communities/${id}/checkout-quote?interval=annual`);
      assert.equal(h.status, 200);
      assert.equal(h.body.data.firstChargeDate, h.body.data.startsAt);
      assert.equal(h.body.data.trialDays, 0);
      assert.equal((await c.call('GET', `/communities/${id}/checkout-quote`)).body.data.selected, 'monthly');
    });

    it('lỗi: 404, miễn phí 400, giá năm không có 400, interval sai 400; memberTrialEnabled bị bỏ qua ⇒ luôn trialDays 0 / trialEligible false', async () => {
      assert.equal((await c.call('GET', '/communities/khong-co/checkout-quote')).status, 404);
      assert.equal((await c.call('GET', '/communities/photo/checkout-quote')).body.error.code, 'COMMUNITY_FREE');
      const noAnnual = await paidCommunity({ priceAnnualUsd: undefined });
      const q = await c.call('GET', `/communities/${noAnnual.id}/checkout-quote`);
      assert.deepEqual(q.body.data.plans.map((p: { interval: string }) => p.interval), ['monthly']);
      assert.equal((await c.call('GET', `/communities/${noAnnual.id}/checkout-quote?interval=annual`)).body.error.code, 'INTERVAL_UNAVAILABLE');
      assert.equal((await c.call('GET', `/communities/${noAnnual.id}/checkout-quote?interval=weekly`)).status, 400);

      // dù client gửi memberTrialEnabled: true hay false, cộng đồng không có dùng thử
      for (const flag of [true, false]) {
        const cm = await paidCommunity({ memberTrialEnabled: flag });
        const detail = await c.call('GET', `/communities/${cm.id}`);
        assert.equal(detail.body.data.memberTrialEnabled, false, 'luôn false trong API');
        const o = (await c.call('GET', `/communities/${cm.id}/checkout-quote?interval=annual`)).body.data;
        assert.equal(o.trialDays, 0);
        assert.equal(o.trialEligible, false);
        assert.equal(o.dueTodayUsd, A);
        assert.equal(o.remindAt, null);
        assert.equal(o.firstChargeDate, o.startsAt);
      }

      const { id } = await paidCommunity();
      const u = await c.registerUser('qt');
      const own = (await c.call('GET', `/communities/${id}/checkout-quote`, { token: u.token })).body.data;
      assert.equal(own.trialDays, 0);
      assert.equal(own.trialEligible, false);
      assert.equal(own.dueTodayUsd, M);
    });
  });

  describe('checkout / confirm / gia hạn / hoàn tiền theo chu kỳ', () => {
    it('monthly mặc định y như cũ; annual lấy giá năm từ server (bỏ qua số tiền client), kỳ 365 ngày', async () => {
      const { id } = await paidCommunity();
      const m = await c.registerUser('mo');
      const mp = await pay(m, id);
      assert.equal(mp.interval, 'monthly');
      assert.equal(mp.amountCents, M);
      const ms = (await subOf(m.id, id))!;
      assert.equal(ms.interval, 'monthly');
      assert.equal(Math.round((ms.currentPeriodEnd.getTime() - ms.currentPeriodStart.getTime()) / DAY), 30);

      const a = await c.registerUser('an');
      const co = await checkout(a, id, { interval: 'annual', amountCents: 1, amountUsd: 0.01 });
      assert.equal(co.body.data.interval, 'annual');
      assert.equal(co.body.data.amountCents, A);
      const cf = await c.payIntent(co.body.data.id, a.token);
      assert.equal(cf.body.data.status, 'succeeded');
      assert.match(cf.body.data.invoiceNumber, /^INV-/);
      const s = (await subOf(a.id, id))!;
      assert.equal(s.interval, 'annual');
      assert.equal(s.priceCents, A);
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
      assert.equal(m1.body.data.amountCents, M);
      const k1 = await checkout(u, id, { interval: 'annual' }, { 'Idempotency-Key': 'k-annual-1' });
      const k2 = await checkout(u, id, { interval: 'annual' }, { 'Idempotency-Key': 'k-annual-1' });
      assert.equal(k1.body.data.id, k2.body.data.id);
    });

    it('chống cấp trùng: 2 phiên khác chu kỳ cùng người ⇒ chỉ 1 gói sống; tiền phiên thứ hai bị void (duplicate_charge) để hoàn, không cấp gói thứ hai', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('dbl');
      const a = await checkout(u, id, { interval: 'annual' });
      const m = await checkout(u, id, { interval: 'monthly' });
      assert.equal((await c.payIntent(a.body.data.id, u.token)).status, 200);
      const second = await c.payIntent(m.body.data.id, u.token);
      assert.equal(second.status, 200);
      assert.equal(second.body.data.status, 'failed', 'không cấp gói thứ hai');
      assert.equal(await db.prisma.subscription.count({ where: { userId: u.id, communityId: id, status: { in: ['active', 'trialing'] } } }), 1);
      assert.equal((await subOf(u.id, id))!.interval, 'annual');
      const blocked = await db.prisma.payment.findUnique({ where: { id: m.body.data.id } });
      assert.equal(blocked!.status, 'failed');
      assert.equal(blocked!.failureReason, 'duplicate_charge', 'tiền đã về nhưng bị void để hoàn');
      assert.equal(blocked!.invoiceNumber, null);
      assert.equal(await db.prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal((await checkout(u, id, { interval: 'monthly' })).status, 409, 'đã có gói active');
    });

    it('gia hạn năm: chưa phát hóa đơn sau 31 ngày; sát hạn phát đúng 1 hóa đơn A, trả tiền thì tiến thêm 365 ngày; không trả ⇒ hết ân hạn thì expired', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('rn');
      await pay(u, id, { interval: 'annual' });
      const before = (await subOf(u.id, id))!;
      await paymentsService.issueRenewalInvoices(new Date(Date.now() + 31 * DAY));
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 31 * DAY));
      assert.equal(await db.prisma.payment.count({ where: { userId: u.id, kind: 'renewal' } }), 0, 'gói năm không gia hạn sau 31 ngày');

      const soon = new Date(Date.now() + 363 * DAY);
      assert.ok((await paymentsService.issueRenewalInvoices(soon)).issued >= 1);
      assert.equal((await paymentsService.issueRenewalInvoices(soon)).issued, 0, 'chạy lặp không phát trùng');
      const inv = await db.prisma.payment.findFirstOrThrow({ where: { userId: u.id, kind: 'renewal' } });
      assert.deepEqual([inv.status, inv.interval, inv.amountCents], ['pending', 'annual', A]);
      assert.equal((await c.payIntent(inv.id, u.token)).body.data.status, 'succeeded');
      const pays = await db.prisma.payment.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'asc' } });
      assert.deepEqual(pays.map((p) => [p.kind, p.interval, p.amountCents]), [['initial', 'annual', A], ['renewal', 'annual', A]]);
      assert.notEqual(pays[0]!.invoiceNumber, pays[1]!.invoiceNumber);
      const after = (await subOf(u.id, id))!;
      assert.equal(after.currentPeriodEnd.getTime() - before.currentPeriodEnd.getTime(), 365 * DAY);
      assert.equal(after.status, 'active');

      const f = await c.registerUser('rnf');
      await pay(f, id, { interval: 'annual' });
      await paymentsService.issueRenewalInvoices(soon);
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 366 * DAY)); // trong ân hạn: giữ quyền
      assert.equal(await enrollmentService.isEnrolled(f.id, id), true);
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 370 * DAY)); // quá ân hạn, không có tiền về
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

    it('hoàn tiền gói năm trong cửa sổ: thu hồi quyền, payment refunded A; doanh thu: MRR gói năm = giá/12', async () => {
      const { id, owner } = await paidCommunity();
      const a = await c.registerUser('rf');
      const m = await c.registerUser('rfm');
      const ap = await pay(a, id, { interval: 'annual' });
      await pay(m, id, { interval: 'monthly' });
      const rev = (await c.call('GET', `/communities/${id}/revenue`, { token: owner.token })).body.data;
      assert.equal(rev.mrrCents, A / 12 + M);
      assert.equal(rev.activePaidMembers, 2);
      assert.equal(rev.grossCents, A + M);

      const rf = await c.call('POST', `/payments/${ap.id}/refund-request`, { token: a.token, body: { reason: 'Đổi ý' } });
      assert.equal(rf.status, 201, JSON.stringify(rf.body));
      assert.equal(rf.body.data.status, 'approved');
      assert.equal(rf.body.data.amountCents, A);
      assert.equal(await enrollmentService.isEnrolled(a.id, id), false);
      assert.equal((await subOf(a.id, id))!.status, 'canceled');
      assert.equal(bankGateway.refundedTotal(ap.gatewayChargeId), A);
      const rev2 = (await c.call('GET', `/communities/${id}/revenue`, { token: owner.token })).body.data;
      assert.equal(rev2.mrrCents, M);
      assert.equal(rev2.refundsCents, A);
    });

    it('cộng đồng riêng tư: cần được duyệt, trừ khi chủ bật autoApprovePaid', async () => {
      const strict = await paidCommunity({ visibility: 'private' });
      const u = await c.registerUser('pv');
      assert.equal((await checkout(u, strict.id, { interval: 'annual' })).body.error.code, 'JOIN_REQUEST_REQUIRED');
      const auto = await paidCommunity({ visibility: 'private', autoApprovePaid: true });
      const co = await checkout(u, auto.id, { interval: 'annual' });
      assert.equal(co.status, 201, JSON.stringify(co.body));
      assert.equal(co.body.data.amountCents, A);
    });
  });

  /** Gói trialing CŨ (dữ liệu từ trước khi bỏ dùng thử), tạo thẳng bằng prisma. */
  async function legacyTrial(userId: string, communityId: string, opts: { interval?: 'monthly' | 'annual'; endsInDays?: number; cancelAtPeriodEnd?: boolean } = {}) {
    const interval = opts.interval ?? 'monthly';
    const start = new Date();
    const end = new Date(start.getTime() + (opts.endsInDays ?? 7) * DAY);
    const sub = await db.prisma.subscription.create({
      data: {
        userId, communityId, status: 'trialing', priceCents: interval === 'annual' ? A : M, interval,
        currentPeriodStart: start, currentPeriodEnd: end, trialEndsAt: end, cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
      },
    });
    await db.prisma.enrollment.create({ data: { userId, communityId } });
    return sub;
  }

  describe('đã bỏ dùng thử miễn phí; gói trialing CŨ: nhắc trước 3 ngày, thanh toán QR, hết hạn', () => {
    it('POST /communities/:id/trial → 404 với mọi body (kể cả paymentMethod sai/đúng); không tạo gói, không lưu thẻ; checkout vẫn từ chối PAN/CVC', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('pan');
      const post = (body: unknown) => c.call('POST', `/communities/${id}/trial`, { token: u.token, body });
      assert.equal((await post({})).status, 404);
      assert.equal((await post({ interval: 'annual', paymentMethod: { ...card(), cvc: '123' } })).status, 404);
      assert.equal((await post({ interval: 'annual', paymentMethod: card({ token: 'tok_mock_safe123456' }) })).status, 404);
      assert.equal((await c.call('POST', `/communities/${id}/trial`, { body: {} })).status, 404);
      assert.equal((await checkout(u, id, { paymentMethod: { ...card(), cvc: '123' } })).status, 400);
      assert.equal(await db.prisma.paymentCard.count({ where: { userId: u.id } }), 0);
      assert.equal(await db.prisma.subscription.count({ where: { userId: u.id } }), 0);
      assert.equal(await enrollmentService.isEnrolled(u.id, id), false);
    });

    it('gói trialing cũ không thẻ: hết thử không trả là hết quyền (expired)', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('toff');
      await legacyTrial(u.id, id);
      assert.equal(await enrollmentService.isEnrolled(u.id, id), true);
      const r = await paymentsService.processDueSubscriptions(new Date(Date.now() + 8 * DAY));
      assert.ok(r.trialsExpired >= 1);
      assert.equal(await enrollmentService.isEnrolled(u.id, id), false);
      assert.equal((await subOf(u.id, id))!.status, 'expired');
    });

    it('nhắc 3 ngày trước hết thử (gói trialing cũ): đúng cửa sổ, đúng 1 lần dù chạy lặp/song song, email (hướng dẫn chuyển khoản) + thông báo; đã hủy thì không nhắc', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('rem');
      await legacyTrial(u.id, id, { interval: 'annual' });
      // chỉ xét gói trialing do test này tạo (test khác trong file có thể để lại gói đang thử).
      await db.prisma.subscription.updateMany({ where: { status: 'trialing', userId: { not: u.id } }, data: { trialReminderSentAt: new Date() } });
      const outbox = async () => (await c.call('GET', `/dev/outbox?to=${encodeURIComponent(u.email)}`)).body.data as Array<{ subject: string; text: string }>;

      assert.equal((await paymentsService.sendTrialReminders(new Date(Date.now() + 2 * DAY))).sent, 0, 'còn 5 ngày: chưa nhắc');
      assert.equal((await outbox()).length, 0);
      const [r1, r2] = await Promise.all([paymentsService.sendTrialReminders(new Date(Date.now() + 4.5 * DAY)), paymentsService.sendTrialReminders(new Date(Date.now() + 4.5 * DAY))]);
      assert.equal(r1.sent + r2.sent, 1, 'chạy song song vẫn chỉ nhắc 1 lần');
      assert.equal((await paymentsService.sendTrialReminders(new Date(Date.now() + 5 * DAY))).sent, 0, 'chạy lại không nhắc nữa');
      const mails = await outbox();
      assert.equal(mails.length, 1);
      assert.match(mails[0]!.text, /1\.200\.000/);
      assert.match(mails[0]!.text, /chuyển khoản/);
      assert.ok((await db.prisma.subscription.findFirst({ where: { userId: u.id } }))!.trialReminderSentAt);
      const notes = await c.call('GET', '/notifications', { token: u.token });
      assert.ok(JSON.stringify(notes.body).includes('Dùng thử sắp kết thúc'));

      // không nhắc: đã đặt hủy cuối kỳ
      const v = await c.registerUser('rem2');
      await legacyTrial(v.id, id, { cancelAtPeriodEnd: true });
      await paymentsService.sendTrialReminders(new Date(Date.now() + 4.5 * DAY));
      assert.equal((await db.prisma.subscription.findFirst({ where: { userId: v.id } }))!.trialReminderSentAt, null);
    });

    it('trả tiền QR khi còn gói trialing cũ: chuyển active, kỳ 365 ngày, hóa đơn, vẫn là thành viên, đúng 1 payment; xử lý đến hạn không phát sinh thêm', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('conv');
      const trial = await legacyTrial(u.id, id, { interval: 'annual' });
      assert.equal(trial.status, 'trialing');

      const paid = await pay(u, id, { interval: 'annual' });
      assert.equal(paid.status, 'succeeded');
      await paymentsService.processDueSubscriptions(new Date(Date.now() + 8 * DAY));
      const s = (await subOf(u.id, id))!;
      assert.equal(s.id, trial.id, 'cùng một gói, chuyển từ trialing sang active');
      assert.equal(s.status, 'active');
      assert.equal(s.interval, 'annual');
      assert.equal(s.currentPeriodEnd.getTime() - s.currentPeriodStart.getTime(), 365 * DAY);
      const pays = await db.prisma.payment.findMany({ where: { userId: u.id } });
      assert.equal(pays.length, 1, 'đúng 1 khoản thanh toán');
      assert.deepEqual([pays[0]!.kind, pays[0]!.status, pays[0]!.amountCents, pays[0]!.interval], ['initial', 'succeeded', A, 'annual']);
      assert.ok(pays[0]!.invoiceNumber);
      assert.equal(pays[0]!.subscriptionId, s.id);
      assert.equal(await enrollmentService.isEnrolled(u.id, id), true);
      // hoàn tiền trong cửa sổ vẫn được
      const rf = await c.call('POST', `/payments/${pays[0]!.id}/refund-request`, { token: u.token, body: { reason: 'Không dùng nữa' } });
      assert.equal(rf.body.data.status, 'approved');
    });

    it('gói trialing cũ hết thử không trả ⇒ expired + thu hồi quyền, không có giao dịch nào; đã hủy trước hạn cũng không bị tính phí', async () => {
      const { id } = await paidCommunity();
      const lapsed = await c.registerUser('lapse');
      await legacyTrial(lapsed.id, id, { interval: 'annual' });
      const cancelled = await c.registerUser('canc');
      await legacyTrial(cancelled.id, id, { interval: 'annual' });
      const cr = await c.call('POST', `/communities/${id}/subscription/cancel`, { token: cancelled.token, body: { atPeriodEnd: true } });
      assert.equal(cr.status, 200);

      const r = await paymentsService.processDueSubscriptions(new Date(Date.now() + 8 * DAY));
      assert.ok(r.trialsExpired >= 1);
      assert.equal((await subOf(lapsed.id, id))!.status, 'expired');
      assert.equal(await enrollmentService.isEnrolled(lapsed.id, id), false);
      assert.equal(await db.prisma.payment.count({ where: { userId: lapsed.id } }), 0, 'không tạo giao dịch nào');

      assert.equal(await db.prisma.payment.count({ where: { userId: cancelled.id } }), 0, 'đã hủy ⇒ không bị tính phí');
      assert.ok(['expired', 'canceled'].includes((await subOf(cancelled.id, id))!.status), 'hết thử mà đã hủy: gói kết thúc, không active');
      assert.equal(await enrollmentService.isEnrolled(cancelled.id, id), false);
    });

    it('statusFor gói trialing cũ: không có thẻ (paymentMethod null); /me/payment-methods rỗng; 401', async () => {
      const { id } = await paidCommunity();
      const u = await c.registerUser('st');
      assert.equal((await c.call('GET', '/me/payment-methods')).status, 401);
      await legacyTrial(u.id, id);
      const st = (await c.call('GET', `/communities/${id}/subscription`, { token: u.token })).body.data;
      assert.equal(st.subscription.paymentMethod, null);
      assert.equal(st.subscription.interval, 'monthly');
      const list = (await c.call('GET', '/me/payment-methods', { token: u.token })).body.data;
      assert.equal(list.length, 0);
    });
  });
});
