import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

const ADMIN_EMAIL = 'padmin-bank@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

const DAY = 86_400_000;
/** 'ai' là cộng đồng có phí nền: 7 USD ≈ 175.000đ (seedVnd). */
const AI_PRICE = 175_000;

describe('thanh toán chuyển khoản VietQR + SePay', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let admin: { token: string; id: string };
  let prisma: typeof import('../src/db/prisma.js').prisma;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let paymentsService: typeof import('../src/modules/payments/payments.service.js').paymentsService;
  let createPaymentsService: typeof import('../src/modules/payments/payments.service.js').createPaymentsService;
  let repo: typeof import('../src/modules/payments/payments.repository.js').paymentsRepository;
  let bank: typeof import('../src/modules/payments/payments.bank.js');
  let n = 0;
  const txId = (p = 'TX') => `${p}${Date.now()}${++n}`;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ paymentsService, createPaymentsService } = await import('../src/modules/payments/payments.service.js'));
    ({ paymentsRepository: repo } = await import('../src/modules/payments/payments.repository.js'));
    bank = await import('../src/modules/payments/payments.bank.js');
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  async function checkout(user: { token: string }, courseId = 'ai', body: Record<string, unknown> = {}) {
    const co = await c.call('POST', `/courses/${courseId}/checkout`, { token: user.token, body });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    return co.body.data;
  }
  const bankCount = (where: object = {}) => prisma.bankTransaction.count({ where });

  describe('checkout tạo phiên chuyển khoản', () => {
    it('trả mã tham chiếu + QR VietQR, giá do server quyết định, hạn 15 phút, tái dùng phiên pending', async () => {
      const u = await c.registerUser('bt');
      const a = await checkout(u, 'ai', { amountCents: 1, amountUsd: 0.01 });
      assert.equal(a.status, 'pending');
      assert.equal(a.method, 'bank_transfer');
      assert.equal(a.amountCents, AI_PRICE);
      assert.match(a.refCode, /^SFH[A-HJ-NP-Z2-9]{8}$/);
      assert.equal(a.transfer.transferContent, a.refCode);
      assert.equal(a.transfer.amount, AI_PRICE);
      assert.ok(a.transfer.qrUrl.startsWith('https://img.vietqr.io/image/970422-0123456789-compact2.png'));
      assert.ok(a.transfer.qrUrl.includes(`amount=${AI_PRICE}`) && a.transfer.qrUrl.includes(`addInfo=${a.refCode}`));
      const ttl = new Date(a.expiresAt).getTime() - Date.now();
      assert.ok(ttl > 14 * 60_000 && ttl <= 15 * 60_000, `ttl=${ttl}`);
      const b = await checkout(u);
      assert.equal(b.id, a.id, 'cùng QR, không tạo phiên thứ hai');
      assert.equal(b.refCode, a.refCode);
    });

    it('GET /payments/:id trả trạng thái + QR cho chủ phiên; người khác 403; không tồn tại 404', async () => {
      const u = await c.registerUser('st');
      const p = await checkout(u);
      const got = await c.call('GET', `/payments/${p.id}`, { token: u.token });
      assert.equal(got.status, 200);
      assert.equal(got.body.data.status, 'pending');
      assert.equal(got.body.data.transfer.refCode, p.refCode);
      const other = await c.registerUser('st2');
      assert.equal((await c.call('GET', `/payments/${p.id}`, { token: other.token })).status, 403);
      assert.equal((await c.call('GET', '/payments/khong-co', { token: u.token })).status, 404);
      // confirm KHÔNG cấp quyền, chỉ đọc lại trạng thái.
      const cf = await c.call('POST', `/payments/${p.id}/confirm`, { token: u.token });
      assert.equal(cf.body.data.status, 'pending');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
    });
  });

  describe('(A) webhook SePay', () => {
    it('thiếu/sai key → 401; Bearer và Apikey đều được; không có key trong server → từ chối hết', async () => {
      const u = await c.registerUser('wh');
      const p = await checkout(u);
      const body = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents });
      assert.equal((await c.bankWebhook(body, { key: null })).status, 401);
      assert.equal((await c.bankWebhook(body, { key: 'sai-key' })).status, 401);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      const ok = await c.bankWebhook(body, { scheme: 'Bearer' });
      assert.equal(ok.status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
      const { webhookAuthorized } = bank;
      assert.equal(webhookAuthorized(undefined), false);
      assert.equal(webhookAuthorized('Apikey '), false);
    });

    it('tiền đủ → cấp quyền + hóa đơn + ghi BankTransaction; gửi lại cùng giao dịch KHÔNG cộng đôi', async () => {
      const u = await c.registerUser('ok');
      const p = await checkout(u);
      const body = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents });
      const [r1, r2, r3] = await Promise.all([c.bankWebhook(body), c.bankWebhook(body), c.bankWebhook(body)]);
      for (const r of [r1, r2, r3]) assert.equal(r.status, 200);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1);
      const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
      assert.match(row.invoiceNumber ?? '', /^INV-\d{4}-\d{6}$/);
      assert.equal(row.gatewayChargeId, body.id);
      assert.equal(await bankCount({ externalId: body.id }), 1);
      const tx = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: body.id } });
      assert.equal(tx.credited, true);
      assert.equal(tx.matchedPaymentId, p.id);
      // Phiên đã xong: GET trả succeeded và không còn QR.
      const st = await c.call('GET', `/payments/${p.id}`, { token: u.token });
      assert.equal(st.body.data.status, 'succeeded');
      assert.equal(st.body.data.transfer, undefined);
    });

    it('nội dung CK có chữ thường/dấu cách xen kẽ vẫn khớp mã; webhook tiền RA bị bỏ qua', async () => {
      const u = await c.registerUser('fuzzy');
      const p = await checkout(u);
      const mangled = `ck ${p.refCode.slice(0, 5).toLowerCase()} ${p.refCode.slice(5).toLowerCase()} tks`;
      const out = await c.bankWebhook({ ...c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents }), content: mangled });
      assert.equal(out.status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
      const outgoing = await c.bankWebhook({ ...c.sepayTx({ id: txId('OUT'), refCode: 'SFHAAAAAAAA', amount: 5 }), transferType: 'out' });
      assert.equal(outgoing.status, 200);
      assert.equal(outgoing.body.message, 'bỏ qua (không phải tiền vào)');
    });

    it('thiếu tiền: không cấp, ghi unmatched kèm lý do; chuyển bù đủ thì cấp', async () => {
      const u = await c.registerUser('under');
      const p = await checkout(u);
      const t1 = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents - 1000 });
      assert.equal((await c.bankWebhook(t1)).body.message, 'underpaid');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      const row = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: t1.id } });
      assert.equal(row.credited, false);
      assert.match(row.note ?? '', /thiếu tiền/);
      const t2 = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents });
      assert.equal((await c.bankWebhook(t2)).body.message, 'credited');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
    });

    it('chuyển dư: vẫn cấp, ghi chú phần dư để admin hoàn', async () => {
      const u = await c.registerUser('over');
      const p = await checkout(u);
      const t = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents + 50_000 });
      await c.bankWebhook(t);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
      const row = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: t.id } });
      assert.match(row.note ?? '', /chuyển dư 50000đ/);
    });

    it('mã lạ / không có mã / vượt trần: lưu để admin soi, không cấp gì', async () => {
      const a = c.sepayTx({ id: txId(), refCode: 'SFHZZZZZZZZ', amount: 100_000 });
      assert.equal((await c.bankWebhook(a)).body.message, 'unmatched');
      const b = { ...c.sepayTx({ id: txId(), refCode: 'x', amount: 100_000 }), content: 'chuyen tien linh tinh' };
      assert.equal((await c.bankWebhook(b)).body.message, 'no_ref');
      const big = c.sepayTx({ id: txId(), refCode: 'SFHZZZZZZZZ', amount: bank.MAX_SINGLE_AMOUNT + 1 });
      assert.equal((await c.bankWebhook(big)).body.message, 'unmatched');
      for (const t of [a, b, big]) {
        const row = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: t.id } });
        assert.equal(row.credited, false);
        assert.ok(row.note);
      }
    });

    it('một giao dịch chuyển trùng cho phiên đã trả: không cấp lần 2, ghi chú cần hoàn', async () => {
      const u = await c.registerUser('twice');
      const p = await checkout(u);
      await c.bankWebhook(c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents }));
      const dup = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents });
      assert.equal((await c.bankWebhook(dup)).body.message, 'duplicate');
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      const row = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: dup.id } });
      assert.equal(row.credited, false);
      assert.match(row.note ?? '', /chuyển trùng/);
    });

    it('phiên hết hạn: tiền về muộn không tự cấp, admin duyệt tay (gán giao dịch) thì cấp đúng 1 lần', async () => {
      const u = await c.registerUser('late');
      const p = await checkout(u);
      await prisma.payment.update({ where: { id: p.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const t = c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents });
      assert.equal((await c.bankWebhook(t)).body.message, 'expired');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), false);
      assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status, 'failed');

      const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: t.id } });
      assert.equal((await c.call('POST', `/admin/bank/payments/${p.refCode}/approve`, { token: u.token, body: {} })).status, 403);
      const ok = await c.call('POST', `/admin/bank/payments/${p.refCode}/approve`, { token: admin.token, body: { bankTransactionId: bt.id } });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(ok.body.data.status, 'succeeded');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'ai'), true);
      assert.equal((await prisma.bankTransaction.findUniqueOrThrow({ where: { id: bt.id } })).credited, true);
      // Duyệt lần 2 → 409; giao dịch ngân hàng đã dùng không gán lại được.
      assert.equal((await c.call('POST', `/admin/bank/payments/${p.refCode}/approve`, { token: admin.token, body: {} })).status, 409);
    });
  });

  describe('(C) admin duyệt tay & danh sách giao dịch ngân hàng', () => {
    it('duyệt tay phiên pending không cần giao dịch ngân hàng; gán giao dịch thiếu tiền bị từ chối; list lọc chưa khớp', async () => {
      const u = await c.registerUser('man');
      const p = await checkout(u, 'yt');
      const short = c.sepayTx({ id: txId(), refCode: 'SFHZZZZZZZZ', amount: 1000 });
      await c.bankWebhook(short);
      const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { externalId: short.id } });
      const bad = await c.call('POST', `/admin/bank/payments/${p.refCode}/approve`, { token: admin.token, body: { bankTransactionId: bt.id } });
      assert.equal(bad.status, 400);
      assert.equal((await c.call('POST', '/admin/bank/payments/SFHKHONGCO/approve', { token: admin.token, body: {} })).status, 404);

      const ok = await c.call('POST', `/admin/bank/payments/${p.refCode}/approve`, { token: admin.token, body: {} });
      assert.equal(ok.status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'yt'), true);
      assert.match((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).gatewayChargeId ?? '', /^manual:/);

      const list = await c.call('GET', '/admin/bank/transactions?credited=false&limit=100', { token: admin.token });
      assert.equal(list.status, 200);
      assert.ok(list.body.data.some((t: { externalId: string }) => t.externalId === short.id));
      assert.ok(list.body.data.every((t: { credited: boolean }) => t.credited === false));
      assert.equal((await c.call('GET', '/admin/bank/transactions', { token: (await c.registerUser('nonadmin')).token })).status, 403);
      assert.equal((await c.call('GET', '/admin/bank/status', { token: admin.token })).body.data.configured, true);
    });

    it('mở lại phiên hết hạn (admin retry): cùng mã, hạn mới', async () => {
      const u = await c.registerUser('retry');
      const p = await checkout(u, 'biz');
      await prisma.payment.update({ where: { id: p.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await paymentsService.expireStaleSessions()).expired >= 1, true);
      assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).failureReason, 'expired');
      const re = await paymentsService.adminRetryPayment(p.id);
      assert.equal(re.status, 'pending');
      assert.equal(re.refCode, p.refCode);
      assert.ok(new Date(re.expiresAt!).getTime() > Date.now());
      // void do trùng thì KHÔNG mở lại được.
      await prisma.payment.update({ where: { id: p.id }, data: { status: 'failed', failureReason: 'duplicate_charge' } });
      await assert.rejects(paymentsService.adminRetryPayment(p.id), /không mở lại được/);
    });
  });

  describe('(B) cron quét SePay', () => {
    const fakeHttp = (txs: unknown[], status = 200) =>
      (async () => new Response(JSON.stringify({ transactions: txs }), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    const listTx = (id: string, ref: string, amount: number) => ({
      id, bank_brand_name: 'MBBank', account_number: '0123456789', transaction_date: '2026-10-09 11:00:00', amount_in: `${amount}.00`, amount_out: '0.00',
      transaction_content: `${ref} CK`, reference_number: `FT${id}`, code: null,
    });

    it('quét cộng tiền đúng 1 lần dù webhook cũng tới; bỏ qua tiền ra; token sai/thiếu không làm sập', async () => {
      const u = await c.registerUser('scan');
      const p = await checkout(u, 'mkt');
      const id = txId('S');
      const svc = createPaymentsService(repo, undefined, { sepayToken: 'tok', http: fakeHttp([listTx(id, p.refCode, p.amountCents), { ...listTx(txId('O'), p.refCode, 5000), amount_in: '0.00', amount_out: '5000.00' }]) });
      const r = await svc.scanBankTransactions();
      assert.equal(r.credited, 1);
      assert.equal(r.scanned, 1);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'mkt'), true);
      // Quét lại + webhook cùng giao dịch: không cộng thêm.
      const r2 = await svc.scanBankTransactions();
      assert.equal(r2.credited, 0);
      assert.equal(r2.already, 1);
      await c.bankWebhook({ ...c.sepayTx({ id, refCode: p.refCode, amount: p.amountCents }) });
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await bankCount({ externalId: id }), 1);

      const noToken = createPaymentsService(repo, undefined, { sepayToken: '', http: fakeHttp([]) });
      assert.equal((await noToken.scanBankTransactions()).skipped, true);
      const unauthorized = createPaymentsService(repo, undefined, { sepayToken: 'x', http: fakeHttp([], 401) });
      assert.equal((await unauthorized.scanBankTransactions()).errors, 1);
    });

    it('webhook và quét chạy ĐỒNG THỜI trên cùng giao dịch: đúng 1 lần cấp', async () => {
      const u = await c.registerUser('race');
      const p = await checkout(u, 'des');
      const id = txId('R');
      const svc = createPaymentsService(repo, undefined, { sepayToken: 'tok', http: fakeHttp([listTx(id, p.refCode, p.amountCents)]) });
      await Promise.all([svc.scanBankTransactions(), c.bankWebhook(c.sepayTx({ id, refCode: p.refCode, amount: p.amountCents })), svc.scanBankTransactions()]);
      assert.equal(await prisma.payment.count({ where: { userId: u.id, status: 'succeeded' } }), 1);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1);
      assert.equal(await bankCount({ externalId: id }), 1);
    });
  });

  describe('gia hạn gói bằng hóa đơn QR', () => {
    async function activeSub(prefix: string, courseId: string, endsInDays: number) {
      const u = await c.registerUser(prefix);
      const p = await checkout(u, courseId);
      await c.bankWebhook(c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents }));
      const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } });
      const end = new Date(Date.now() + endsInDays * DAY);
      await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: end, currentPeriodStart: new Date(end.getTime() - 30 * DAY) } });
      return { u, sub: await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } }) };
    }

    it('sắp hết kỳ → phát ĐÚNG 1 hóa đơn (chạy lặp không trùng); trả tiền → nối kỳ, hóa đơn mới, vẫn là 1 gói', async () => {
      const { u, sub } = await activeSub('rn1', 'data', 2);
      const first = await paymentsService.issueRenewalInvoices();
      assert.ok(first.issued >= 1);
      assert.equal((await paymentsService.issueRenewalInvoices()).issued, 0, 'đã có hóa đơn thì không phát thêm');
      const inv = await prisma.payment.findFirstOrThrow({ where: { subscriptionId: sub.id, kind: 'renewal' } });
      assert.equal(inv.status, 'pending');
      assert.equal(inv.method, 'bank_transfer');
      assert.equal(inv.periodStart?.getTime(), sub.currentPeriodEnd.getTime());
      assert.ok(inv.expiresAt!.getTime() > sub.currentPeriodEnd.getTime(), 'hạn trả = hết kỳ + ân hạn');

      const w = c.sepayTx({ id: txId('RN'), refCode: inv.refCode!, amount: inv.amountCents });
      await Promise.all([c.bankWebhook(w), c.bankWebhook(w)]);
      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      assert.equal(after.status, 'active');
      assert.equal(after.currentPeriodStart.getTime(), sub.currentPeriodEnd.getTime());
      assert.equal(after.currentPeriodEnd.getTime() - sub.currentPeriodEnd.getTime(), 30 * DAY);
      const paid = await prisma.payment.findUniqueOrThrow({ where: { id: inv.id } });
      assert.equal(paid.status, 'succeeded');
      assert.match(paid.invoiceNumber ?? '', /^INV-/);
      assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1);
      assert.equal(await prisma.payment.count({ where: { subscriptionId: sub.id, status: 'succeeded' } }), 2);
    });

    it('hết kỳ mà chưa trả: còn trong ân hạn giữ quyền; hết ân hạn → expired + mất quyền; trả muộn (admin duyệt) → kích hoạt lại từ bây giờ', async () => {
      const { u, sub } = await activeSub('rn2', 'biz', -1); // đã quá hạn 1 ngày, chưa có hóa đơn
      const r1 = await paymentsService.processDueSubscriptions();
      assert.ok(r1.invoiced >= 1, 'chưa có hóa đơn ⇒ phát hóa đơn ân hạn thay vì đá ngay');
      assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status, 'active');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'biz'), true);
      await paymentsService.processDueSubscriptions(); // lượt 2 vẫn trong ân hạn
      assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status, 'active');

      // Hết ân hạn.
      const inv = await prisma.payment.findFirstOrThrow({ where: { subscriptionId: sub.id, kind: 'renewal' } });
      await prisma.payment.update({ where: { id: inv.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await paymentsService.expireStaleSessions();
      const r2 = await paymentsService.processDueSubscriptions();
      assert.ok(r2.renewalFailed >= 1);
      assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status, 'expired');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'biz'), false);

      // Khách chuyển muộn → tiền được ghi nhận; admin duyệt tay → gói sống lại từ bây giờ.
      const late = c.sepayTx({ id: txId('L'), refCode: inv.refCode!, amount: inv.amountCents });
      assert.equal((await c.bankWebhook(late)).body.message, 'expired');
      const ok = await c.call('POST', `/admin/bank/payments/${inv.refCode}/approve`, { token: admin.token, body: {} });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      const back = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      assert.equal(back.status, 'active');
      assert.ok(back.currentPeriodEnd.getTime() > Date.now() + 29 * DAY);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'biz'), true);
    });

    it('gói đã đặt hủy cuối kỳ không được phát hóa đơn gia hạn', async () => {
      const { sub } = await activeSub('rn3', 'mkt', 1);
      await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
      await paymentsService.issueRenewalInvoices();
      assert.equal(await prisma.payment.count({ where: { subscriptionId: sub.id, kind: 'renewal' } }), 0);
    });
  });

  describe('dùng thử không thẻ', () => {
    it('trial không cần thẻ; thanh toán trong lúc thử chuyển sang gói trả phí; hết thử không trả → hết quyền', async () => {
      const u = await c.registerUser('trial');
      const pending = await prisma.community.findUniqueOrThrow({ where: { id: 'des' } });
      await prisma.community.update({ where: { id: pending.id }, data: { memberTrialEnabled: true } });
      const t = await c.call('POST', '/courses/des/trial', { token: u.token, body: {} });
      assert.equal(t.status, 201, JSON.stringify(t.body));
      assert.equal(t.body.data.status, 'trialing');
      assert.equal(t.body.data.paymentMethod, null);

      const p = await checkout(u, 'des');
      await c.bankWebhook(c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents }));
      const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } });
      assert.equal(sub.status, 'active');

      const u2 = await c.registerUser('trial2');
      await c.call('POST', '/courses/des/trial', { token: u2.token, body: {} });
      await prisma.subscription.updateMany({ where: { userId: u2.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
      const r = await paymentsService.processDueSubscriptions();
      assert.ok(r.trialsExpired >= 1);
      assert.equal(await enrollmentService.isEnrolled(u2.id, 'des'), false);
    });
  });

  describe('báo tin cho admin / owner / Telegram', () => {
    it('thanh toán thành công: admin + owner nhận thông báo; Telegram được gọi khi có cấu hình; tiền lạ báo "cần xử lý"', async () => {
      const owner = await c.registerUser('own');
      await prisma.community.update({ where: { id: 'yoga' }, data: { ownerId: owner.id } });
      const calls: { url: string; body: string }[] = [];
      const realFetch = globalThis.fetch;
      process.env.TELEGRAM_BOT_TOKEN = 'tg-token';
      process.env.TELEGRAM_CHAT_ID = '111,222';
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith('https://api.telegram.org/')) {
          calls.push({ url, body: String(init?.body) });
          return new Response('{}', { status: 200 });
        }
        return realFetch(input, init);
      }) as typeof fetch;
      try {
        const u = await c.registerUser('payer');
        const p = await checkout(u, 'yoga');
        await c.bankWebhook(c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents }));
        // chuyển dư => cảnh báo tiền cần xử lý
        const u2 = await c.registerUser('payer2');
        const p2 = await checkout(u2, 'yoga');
        await c.bankWebhook(c.sepayTx({ id: txId(), refCode: p2.refCode, amount: p2.amountCents + 10_000 }));

        const adminNoti = await c.call('GET', '/notifications?limit=50', { token: admin.token });
        const titles = (adminNoti.body.data as { title: string }[]).map((n) => n.title);
        assert.ok(titles.some((t) => t.startsWith('Thanh toán mới')), JSON.stringify(titles));
        assert.ok(titles.includes('Cần xử lý tiền chuyển khoản'));
        const ownerNoti = await c.call('GET', '/notifications?limit=50', { token: owner.token });
        assert.ok((ownerNoti.body.data as { title: string }[]).some((n) => n.title === 'Có thành viên mới thanh toán'));
        // 2 chat x (2 thanh toán + 1 cảnh báo dư) = 6 lần gọi Telegram
        assert.equal(calls.length, 6);
        assert.ok(calls.some((x) => x.body.includes('THANH TOÁN MỚI')) && calls.some((x) => x.body.includes('CẦN XỬ LÝ')));
        assert.ok(calls.every((x) => x.url === 'https://api.telegram.org/bottg-token/sendMessage'));
      } finally {
        globalThis.fetch = realFetch;
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
      }
    });

    it('Telegram lỗi mạng không làm hỏng việc cấp quyền', async () => {
      const realFetch = globalThis.fetch;
      process.env.TELEGRAM_BOT_TOKEN = 'tg-token';
      process.env.TELEGRAM_CHAT_ID = '111';
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).startsWith('https://api.telegram.org/')) throw new Error('network down');
        return realFetch(input, init);
      }) as typeof fetch;
      try {
        const u = await c.registerUser('tgfail');
        const p = await checkout(u, 'eng');
        const r = await c.bankWebhook(c.sepayTx({ id: txId(), refCode: p.refCode, amount: p.amountCents }));
        assert.equal(r.status, 200);
        assert.equal(await enrollmentService.isEnrolled(u.id, 'eng'), true);
      } finally {
        globalThis.fetch = realFetch;
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
      }
    });
  });

  describe('tiền VND', () => {
    it('giá hiển thị = giá lưu (không chia 100); quote trả VND + provider chuyển khoản', async () => {
      const q = await c.call('GET', '/courses/ai/checkout-quote');
      assert.equal(q.status, 200);
      assert.equal(q.body.data.currency, 'VND');
      assert.equal(q.body.data.provider, 'bank_transfer');
      assert.equal(q.body.data.firstChargeAmountCents, AI_PRICE);
      assert.equal(q.body.data.plans[0].priceUsd, AI_PRICE);
    });

    it('extractRef/makeRefCode: mã sinh ra luôn tự trích lại được', () => {
      for (let i = 0; i < 200; i++) {
        const code = bank.makeRefCode();
        assert.equal(bank.extractRef(`nội dung ${code} cảm ơn`), code);
      }
      assert.equal(bank.extractRef('không có mã', '', undefined), '');
    });
  });
});
