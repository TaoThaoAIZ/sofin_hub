import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

/** Rút hoa hồng giới thiệu: mã tham chiếu + SePay đối soát tiền RA (giống nạp), số tài khoản mã hóa, không rút quá số dư. */
describe('rút hoa hồng giới thiệu', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let prisma: typeof import('../src/db/prisma.js').prisma;
  let svc: typeof import('../src/modules/referrals/referral-withdrawals.service.js').referralWithdrawalsService;
  let decryptSecret: typeof import('../src/modules/referrals/referral-payout-crypto.js').decryptSecret;
  let n = 0;

  before(async () => {
    server = await startTestServer();
    await useTestDb();
    c = makeClient(server.baseUrl);
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ referralWithdrawalsService: svc } = await import('../src/modules/referrals/referral-withdrawals.service.js'));
    ({ decryptSecret } = await import('../src/modules/referrals/referral-payout-crypto.js'));
  });
  after(() => server.close());

  async function signup(prefix: string) {
    const email = `${prefix}${Date.now().toString(36)}${n++}@t.io`;
    const r = await c.registerVerified({ email, password: 'Passw0rd!x', firstName: 'Rut', lastName: prefix });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    return { token: r.body.data.accessToken as string, id: r.body.data.user.id as string };
  }
  /** Người giới thiệu có `cents` hoa hồng member chưa rút. */
  async function referrerWith(cents: number) {
    const ref = await signup('ref');
    const referred = await signup('inv');
    await prisma.referralCommission.create({
      data: { referrerId: ref.id, referredUserId: referred.id, kind: 'member', sourceRef: `test:${ref.id}`, baseCents: cents * 10, rateBps: 1000, amountCents: cents, payoutOn: new Date() },
    });
    return ref;
  }
  const account = { bankBin: '970422', accountNumber: '0123 4567 89012', accountHolder: 'Nguyễn Văn A' };
  const outTx = (ref: string, amount: number, id: string) => ({ id, gateway: 'MBBank', transactionDate: '2026-10-09 10:30:00', content: `CK ${ref} hoa hong`, transferType: 'out', transferAmount: amount });

  it('số dư = hoa hồng; phải có tài khoản; chặn dưới mức tối thiểu và vượt số dư', async () => {
    const u = await referrerWith(500_000);
    const o = (await c.call('GET', '/me/referral/withdraw', { token: u.token })).body.data;
    assert.equal(o.withdrawableCents, 500_000);
    assert.equal(o.account, null);

    const noAcc = await c.call('POST', '/me/referral/withdrawals', { token: u.token, body: { amountCents: 300_000 } });
    assert.equal(noAcc.status, 409);
    assert.equal(noAcc.body.error.code, 'NO_ACCOUNT');

    const saved = await c.call('PUT', '/me/referral/withdraw/account', { token: u.token, body: account });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.accountLast4, '9012');
    assert.equal(saved.body.data.accountHolder, 'NGUYEN VAN A');
    assert.equal(saved.body.data.accountNumber, undefined, 'không trả số tài khoản đầy đủ');
    assert.equal((await c.call('PUT', '/me/referral/withdraw/account', { token: u.token, body: { ...account, bankBin: '111111' } })).status, 400);
    assert.equal((await c.call('PUT', '/me/referral/withdraw/account', { token: u.token, body: { ...account, accountNumber: '12ab' } })).status, 400);

    const low = await c.call('POST', '/me/referral/withdrawals', { token: u.token, body: { amountCents: 100_000 } });
    assert.equal(low.body.error.code, 'BELOW_MIN');
    const over = await c.call('POST', '/me/referral/withdrawals', { token: u.token, body: { amountCents: 600_000 } });
    assert.equal(over.body.error.code, 'INSUFFICIENT_BALANCE');
    assert.equal((await c.call('POST', '/me/referral/withdrawals', { token: u.token, body: {} })).status, 400);
    assert.equal((await c.call('GET', '/me/referral/withdraw')).status, 401);
  });

  it('rút: trừ số dư ngay, số tài khoản mã hóa trong DB, SePay báo tiền RA khớp mã thì paid (idempotent)', async () => {
    const u = await referrerWith(500_000);
    await c.call('PUT', '/me/referral/withdraw/account', { token: u.token, body: account });
    const r = await c.call('POST', '/me/referral/withdrawals', { token: u.token, body: { amountCents: 300_000 } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const w = r.body.data;
    assert.equal(w.status, 'requested');
    assert.match(w.refCode, /^[A-Z0-9]{11}$/);

    const o = (await c.call('GET', '/me/referral/withdraw', { token: u.token })).body.data;
    assert.equal(o.withdrawableCents, 200_000);
    assert.equal(o.pendingCents, 300_000);

    const row = await prisma.referralWithdrawal.findUniqueOrThrow({ where: { id: w.id } });
    assert.ok(!row.accountNumberEnc.includes('012345678'), 'không lưu số tài khoản dạng rõ');
    assert.equal(decryptSecret(row.accountNumberEnc), '0123456789012');

    // Tiền ra thiếu: chưa đủ
    const under = await c.bankWebhook(outTx(w.refCode, 100_000, 'OUTU1'));
    assert.equal(under.body.message, 'tiền ra: underpaid');
    assert.equal((await c.call('GET', `/me/referral/withdrawals/${w.id}`, { token: u.token })).body.data.status, 'requested');

    const ok = await c.bankWebhook(outTx(w.refCode, 300_000, 'OUT1'));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.message, 'tiền ra: paid');
    const after = (await c.call('GET', `/me/referral/withdrawals/${w.id}`, { token: u.token })).body.data;
    assert.equal(after.status, 'paid');
    assert.ok(after.paidAt);
    assert.equal((await c.bankWebhook(outTx(w.refCode, 300_000, 'OUT1'))).body.message, 'tiền ra: already');
    assert.equal((await c.bankWebhook(outTx(w.refCode, 300_000, 'OUT2'))).body.message, 'tiền ra: duplicate');
    assert.equal((await c.bankWebhook(outTx('SFHZZZZZZZZ', 300_000, 'OUT3'))).body.message, 'tiền ra: unmatched');

    const o2 = (await c.call('GET', '/me/referral/withdraw', { token: u.token })).body.data;
    assert.equal(o2.paidCents, 300_000);
    assert.equal(o2.withdrawableCents, 200_000);
    // Người khác không xem được yêu cầu này
    const other = await signup('oth');
    assert.equal((await c.call('GET', `/me/referral/withdrawals/${w.id}`, { token: other.token })).status, 404);
  });

  it('hai yêu cầu song song không cùng rút một khoản; từ chối thì hoàn lại số dư', async () => {
    const u = await referrerWith(400_000);
    await c.call('PUT', '/me/referral/withdraw/account', { token: u.token, body: account });
    const [a, b] = await Promise.all([
      c.call('POST', '/me/referral/withdrawals', { token: u.token, body: { amountCents: 300_000 } }),
      c.call('POST', '/me/referral/withdrawals', { token: u.token, body: { amountCents: 300_000 } }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    const won = a.status === 201 ? a : b;
    assert.equal((await svc.balanceOf(u.id)).withdrawableCents, 100_000);

    const admin = await signup('adm');
    await svc.reject(admin.id, won.body.data.id, 'Sai thông tin tài khoản');
    assert.equal((await svc.balanceOf(u.id)).withdrawableCents, 400_000);
    await assert.rejects(() => svc.markPaid(admin.id, won.body.data.id), /đã được xử lý/);
    // Đã từ chối thì SePay báo tiền ra cũng không chuyển sang paid
    assert.equal(await svc.settleByBank(won.body.data.refCode, 300_000, 'OUTR'), 'rejected');
  });
});
