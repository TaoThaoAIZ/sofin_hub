import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

describe('đăng ký + OTP email, đăng nhập mạng xã hội', () => {
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
  const fresh = (prefix = 'otp') => ({ email: `${prefix}-${Date.now()}-${n++}@test.local`, password: 'Passw0rd!x', firstName: 'Otp', lastName: 'Test' });
  const register = (body: ReturnType<typeof fresh> & { referralCode?: string }) => c.call('POST', '/auth/register', { body });
  const verify = (email: string, code: string, extra: object = {}) => c.call('POST', '/auth/register/verify', { body: { email, code, ...extra } });
  /** Cho phép gửi lại ngay: lùi mốc gửi cuối (cooldown 60 giây) về quá khứ. */
  const skipCooldown = async (email: string) => {
    const u = await db.prisma.user.findUniqueOrThrow({ where: { email } });
    await db.prisma.emailOtp.updateMany({ where: { userId: u.id }, data: { lastSentAt: new Date(Date.now() - 61_000) } });
  };
  const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

  describe('đăng ký', () => {
    it('202, không cấp phiên/cookie, gửi OTP 6 số; chưa đăng nhập được (403 EMAIL_NOT_VERIFIED)', async () => {
      const u = fresh();
      const r = await register(u);
      assert.equal(r.status, 202, JSON.stringify(r.body));
      assert.equal(r.body.data.verificationRequired, true);
      assert.equal(r.body.data.email, u.email);
      assert.equal(r.body.data.accessToken, undefined);
      assert.equal(r.headers.getSetCookie().length, 0);
      assert.match(await c.otpFor(u.email), /^\d{6}$/);

      const row = await db.prisma.user.findUniqueOrThrow({ where: { email: u.email } });
      assert.equal(row.emailVerified, false);
      const login = await c.call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      assert.equal(login.status, 403);
      assert.equal(login.body.error.code, 'EMAIL_NOT_VERIFIED');
      // Sai mật khẩu vẫn là 401 (không lộ trạng thái cho người đoán mật khẩu).
      assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: 'Sai1!xxxxx' } })).status, 401);
    });

    it('chỉ lưu HMAC của mã, không lưu mã thô', async () => {
      const u = fresh();
      await register(u);
      const code = await c.otpFor(u.email);
      const user = await db.prisma.user.findUniqueOrThrow({ where: { email: u.email } });
      const row = await db.prisma.emailOtp.findFirstOrThrow({ where: { userId: user.id } });
      assert.notEqual(row.codeHash, code);
      assert.match(row.codeHash, /^[0-9a-f]{64}$/);
      assert.ok(row.expiresAt.getTime() - Date.now() <= 10 * 60_000 && row.expiresAt.getTime() > Date.now());
    });

    it('email của tài khoản ĐÃ xác thực: 409; validate 400', async () => {
      const u = await c.registerUser('dup');
      const r = await register({ email: u.email, password: u.password, firstName: 'A', lastName: 'B' });
      assert.equal(r.status, 409);
      assert.equal((await register({ ...fresh(), email: 'khong-phai-email' })).status, 400);
      assert.equal((await register({ ...fresh(), password: 'yeu' })).status, 400);
    });

    it('đăng ký lại email CHƯA xác thực: ghi đè mật khẩu/họ tên, mã cũ vô hiệu; trong cooldown thì 429 và không đổi gì', async () => {
      const u = fresh('redo');
      await register(u);
      const oldCode = await c.otpFor(u.email);
      const again = { ...u, password: 'Moi1!password', firstName: 'Đổi', lastName: 'Tên' };
      assert.equal((await register(again)).status, 429);
      assert.equal((await db.prisma.user.findUniqueOrThrow({ where: { email: u.email } })).firstName, 'Otp');

      await skipCooldown(u.email);
      assert.equal((await register(again)).status, 202);
      const newCode = await c.otpFor(u.email);
      if (newCode !== oldCode) assert.equal((await verify(u.email, oldCode)).status, 400);
      const ok = await verify(u.email, newCode);
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(ok.body.data.user.firstName, 'Đổi');
      assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
      assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: again.password } })).status, 200);
    });
  });

  describe('xác thực OTP', () => {
    it('đúng mã: 200 + phiên + cookie refresh, emailVerified=true; mã dùng 1 lần', async () => {
      const u = fresh();
      await register(u);
      const code = await c.otpFor(u.email);
      const r = await verify(u.email, code);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.ok(r.body.data.accessToken);
      assert.equal(r.body.data.user.emailVerified, true);
      assert.match(r.headers.getSetCookie().join(';'), /refresh_token=/);
      assert.equal((await c.call('GET', '/auth/me', { token: r.body.data.accessToken })).status, 200);
      assert.equal(await db.prisma.emailOtp.count({ where: { userId: r.body.data.user.id } }), 0);
      assert.equal((await verify(u.email, code)).status, 400);
      assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 200);
    });

    it('chấp nhận mã có khoảng trắng; từ chối mã không đủ 6 số (400)', async () => {
      const u = fresh();
      await register(u);
      const code = await c.otpFor(u.email);
      assert.equal((await verify(u.email, '12345')).status, 400);
      assert.equal((await verify(u.email, `${code.slice(0, 3)} ${code.slice(3)}`)).status, 200);
    });

    it('sai: OTP_INVALID kèm attemptsLeft giảm dần; sai 5 lần => OTP_LOCKED, mã bị hủy (kể cả đúng mã sau đó)', async () => {
      const u = fresh();
      await register(u);
      const code = await c.otpFor(u.email);
      for (let i = 1; i <= 4; i++) {
        const r = await verify(u.email, wrong(code));
        assert.equal(r.status, 400);
        assert.equal(r.body.error.code, 'OTP_INVALID');
        assert.equal(r.body.error.details.attemptsLeft, 5 - i);
      }
      const fifth = await verify(u.email, wrong(code));
      assert.equal(fifth.body.error.code, 'OTP_LOCKED');
      const after = await verify(u.email, code);
      assert.equal(after.status, 400);
      assert.equal(after.body.error.code, 'OTP_EXPIRED');
    });

    it('thử song song không vượt quá 5 lần (kể cả khi có mã đúng lẫn trong đó sau lượt thứ 5)', async () => {
      const u = fresh();
      await register(u);
      const code = await c.otpFor(u.email);
      const attempts = await Promise.all(Array.from({ length: 12 }, () => verify(u.email, wrong(code))));
      assert.ok(attempts.every((r) => r.status === 400));
      assert.equal((await verify(u.email, code)).status, 400);
    });

    it('hết hạn: OTP_EXPIRED', async () => {
      const u = fresh();
      await register(u);
      const code = await c.otpFor(u.email);
      await db.prisma.emailOtp.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) }, where: { user: { email: u.email } } });
      const r = await verify(u.email, code);
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'OTP_EXPIRED');
    });

    it('email lạ: cùng lỗi như mã sai (không lộ email nào đang chờ)', async () => {
      const r = await verify('khong-ton-tai@test.local', '123456');
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'OTP_INVALID');
    });

    it('ghi nhận người giới thiệu SAU khi xác thực, không phải lúc đăng ký', async () => {
      const ref = await c.registerUser('refo');
      const code = (await c.call('GET', '/me/referral?kind=member', { token: ref.token })).body.data.code as string;
      const u = fresh('friend');
      await register({ ...u, referralCode: code });
      const user = await db.prisma.user.findUniqueOrThrow({ where: { email: u.email } });
      assert.equal(await db.prisma.referral.count({ where: { referredUserId: user.id } }), 0);
      await verify(u.email, await c.otpFor(u.email), { referralCode: code });
      assert.equal((await db.prisma.referral.findUnique({ where: { referredUserId: user.id } }))?.referrerId, ref.id);
    });
  });

  describe('gửi lại', () => {
    it('cooldown 60 giây (429 OTP_RATE_LIMITED); sau đó mã mới vô hiệu mã cũ và reset số lần sai', async () => {
      const u = fresh();
      await register(u);
      const old = await c.otpFor(u.email);
      const tooSoon = await c.call('POST', '/auth/register/resend', { body: { email: u.email } });
      assert.equal(tooSoon.status, 429);
      assert.equal(tooSoon.body.error.code, 'OTP_RATE_LIMITED');
      assert.ok(tooSoon.body.error.details.retryAfterSec > 0);

      await verify(u.email, wrong(old)); // 1 lần sai
      await skipCooldown(u.email);
      const r = await c.call('POST', '/auth/register/resend', { body: { email: u.email } });
      assert.equal(r.status, 202);
      const fresher = await c.otpFor(u.email);
      const user = await db.prisma.user.findUniqueOrThrow({ where: { email: u.email } });
      assert.equal((await db.prisma.emailOtp.findFirstOrThrow({ where: { userId: user.id } })).attempts, 0);
      if (fresher !== old) assert.equal((await verify(u.email, old)).status, 400);
      assert.equal((await verify(u.email, fresher)).status, 200);
    });

    it('tối đa 5 lần gửi / giờ', async () => {
      const u = fresh();
      await register(u); // lần 1
      for (let i = 0; i < 4; i++) {
        await skipCooldown(u.email);
        assert.equal((await c.call('POST', '/auth/register/resend', { body: { email: u.email } })).status, 202);
      }
      await skipCooldown(u.email);
      const sixth = await c.call('POST', '/auth/register/resend', { body: { email: u.email } });
      assert.equal(sixth.status, 429);
      assert.equal(sixth.body.error.code, 'OTP_RATE_LIMITED');
    });

    it('email lạ / đã xác thực: 202 giống nhau, không gửi thư', async () => {
      const verified = await c.registerUser('rs');
      for (const email of ['khong-ton-tai@test.local', verified.email]) {
        const r = await c.call('POST', '/auth/register/resend', { body: { email } });
        assert.equal(r.status, 202);
        assert.equal(r.body.data.verificationRequired, true);
      }
      const { mailService } = await import('../src/modules/mail/mail.service.js');
      assert.equal(mailService.listOutbox(verified.email).length, 0);
      assert.equal(mailService.listOutbox('khong-ton-tai@test.local').length, 0);
    });

    it('đăng nhập khi chưa xác thực tự gửi lại OTP (nếu hết cooldown)', async () => {
      const u = fresh();
      await register(u);
      await skipCooldown(u.email);
      const { mailService } = await import('../src/modules/mail/mail.service.js');
      const before = mailService.listOutbox(u.email).length;
      const r = await c.call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      assert.equal(r.status, 403);
      assert.equal(mailService.listOutbox(u.email).length, before + 1);
      assert.equal((await verify(u.email, await c.otpFor(u.email))).status, 200);
    });
  });

  describe('đặt lại mật khẩu', () => {
    it('link đặt lại mật khẩu chứng minh sở hữu email => tài khoản chưa xác thực đăng nhập được (admin được mời)', async () => {
      const u = fresh('invited');
      await register(u);
      await c.call('POST', '/auth/forgot-password', { body: { email: u.email } });
      const { mailService } = await import('../src/modules/mail/mail.service.js');
      const token = mailService.listOutbox(u.email).filter((m) => m.text.includes('reset-password')).at(-1)!.text.match(/token=([^\s"]+)/)![1]!;
      assert.equal((await c.call('POST', '/auth/reset-password', { body: { token, password: 'Moi1!password' } })).status, 200);
      assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: 'Moi1!password' } })).status, 200);
    });
  });

  describe('đăng nhập mạng xã hội (loginWithSocial)', () => {
    const profile = (over: Partial<import('../src/modules/auth/oauth.js').SocialProfile> = {}) => ({
      provider: 'google' as const,
      id: `g-${Date.now()}-${n++}`,
      email: `social-${Date.now()}-${n++}@test.local`,
      emailVerified: true,
      firstName: 'Gu',
      lastName: 'Gồ',
      ...over,
    });
    const svc = async () => (await import('../src/modules/auth/auth.service.js')).authService;

    it('tài khoản mới: tạo user đã xác thực email, không có mật khẩu dùng được; lần sau cùng user', async () => {
      const p = profile();
      const s = await svc();
      const first = (await s.loginWithSocial(p, undefined)) as { user: { id: string; emailVerified: boolean }; accessToken: string };
      assert.equal(first.user.emailVerified, true);
      assert.ok(first.accessToken);
      const again = (await s.loginWithSocial(p, undefined)) as { user: { id: string } };
      assert.equal(again.user.id, first.user.id);
      assert.equal(await db.prisma.socialAccount.count({ where: { userId: first.user.id } }), 1);
      assert.equal((await c.call('POST', '/auth/login', { body: { email: p.email, password: '!oauth' } })).status, 401);
    });

    it('trùng email với tài khoản đã xác thực: liên kết vào tài khoản đó', async () => {
      const u = await c.registerUser('link');
      const p = profile({ email: u.email, provider: 'facebook' });
      const r = (await (await svc()).loginWithSocial(p, undefined)) as { user: { id: string } };
      assert.equal(r.user.id, u.id);
      // Mật khẩu cũ vẫn dùng được.
      assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 200);
    });

    it('trùng email với tài khoản CHƯA xác thực: xác thực + vô hiệu mật khẩu cũ (chống chiếm email)', async () => {
      const u = fresh('squat');
      await register(u);
      const r = (await (await svc()).loginWithSocial(profile({ email: u.email }), undefined)) as { user: { id: string; emailVerified: boolean } };
      assert.equal(r.user.emailVerified, true);
      assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
    });

    it('email chưa được nhà cung cấp xác minh / không có email: từ chối, không tạo user', async () => {
      const s = await svc();
      const p = profile({ emailVerified: false });
      await assert.rejects(s.loginWithSocial(p, undefined), { code: 'OAUTH_NO_EMAIL' });
      await assert.rejects(s.loginWithSocial(profile({ email: undefined }), undefined), { code: 'OAUTH_NO_EMAIL' });
      assert.equal(await db.prisma.user.count({ where: { email: p.email } }), 0);
    });

    it('ghi nhận người giới thiệu cho user mới', async () => {
      const ref = await c.registerUser('refs');
      const code = (await c.call('GET', '/me/referral?kind=member', { token: ref.token })).body.data.code as string;
      const r = (await (await svc()).loginWithSocial(profile(), code)) as { user: { id: string } };
      assert.equal((await db.prisma.referral.findUnique({ where: { referredUserId: r.user.id } }))?.referrerId, ref.id);
    });

    it('tài khoản bật 2FA: trả vé 2FA thay vì cấp phiên', async () => {
      const u = await c.registerUser('tf');
      await db.prisma.user.update({ where: { id: u.id }, data: { twoFactorEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' } });
      const r = await (await svc()).loginWithSocial(profile({ email: u.email }), undefined);
      assert.equal('twoFactorRequired' in r, true);
    });
  });

  describe('OAuth state + endpoint', () => {
    it('state hợp lệ khi đúng nhà cung cấp + nonce; sai nonce/nhà cung cấp/rác thì từ chối', async () => {
      const { createOAuthState, verifyOAuthState } = await import('../src/modules/auth/oauth.js');
      const { state, nonce } = createOAuthState('google', 'abc');
      assert.deepEqual(verifyOAuthState(state, nonce, 'google'), { referralCode: 'abc' });
      assert.equal(verifyOAuthState(state, 'nonce-khac', 'google'), null);
      assert.equal(verifyOAuthState(state, nonce, 'facebook'), null);
      assert.equal(verifyOAuthState(state, undefined, 'google'), null);
      assert.equal(verifyOAuthState('rac', nonce, 'google'), null);
    });

    it('chưa cấu hình nhà cung cấp: start/callback chuyển về FE với error=not_configured (không 500)', async () => {
      for (const path of ['/auth/oauth/google/start', '/auth/oauth/facebook/callback?code=x&state=y', '/auth/oauth/khong-co/start']) {
        const res = await fetch(server.baseUrl + path, { redirect: 'manual' });
        assert.equal(res.status, 302, path);
        assert.match(res.headers.get('location') ?? '', /\/oauth\/callback#error=not_configured/);
      }
    });
  });
});
