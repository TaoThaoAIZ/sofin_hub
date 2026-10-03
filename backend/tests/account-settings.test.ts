import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

/** Cài đặt hồ sơ + bảo mật: handle, liên kết, tùy chọn, đổi email, 2FA (TOTP), thiết bị, chặn xóa tài khoản. */
describe('cài đặt hồ sơ & bảo mật', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];
  let registerUser: ReturnType<typeof makeClient>['registerUser'];

  before(async () => {
    server = await startTestServer();
    ({ call, registerUser } = makeClient(server.baseUrl));
  });
  after(() => server.close());

  const uniq = () => Math.random().toString(36).slice(2, 10);
  const cookieOf = (headers: Headers) => (headers.getSetCookie()[0] ?? '').split(';')[0];

  async function lastToken(to: string, path: string): Promise<string> {
    const r = await call('GET', `/dev/outbox?to=${encodeURIComponent(to)}`);
    const mails = (r.body.data as { text: string }[]).filter((m) => m.text.includes(path));
    assert.ok(mails.length > 0, `không có thư chứa ${path}`);
    return mails[mails.length - 1]!.text.match(/token=([^\s"]+)/)![1]!;
  }

  describe('unit: TOTP (RFC 6238) và parser User-Agent', () => {
    it('TOTP khớp vector kiểm thử RFC 6238 (SHA1, 6 số) và base32 round-trip', async () => {
      const { base32Encode, base32Decode, totpAt, verifyTotp } = await import('../src/modules/auth/totp.js');
      const secret = base32Encode(Buffer.from('12345678901234567890'));
      assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
      assert.equal(base32Decode(secret).toString(), '12345678901234567890');
      assert.equal(totpAt(secret, 59_000), '287082');
      assert.equal(totpAt(secret, 1_111_111_109_000), '081804');
      assert.equal(totpAt(secret, 1_234_567_890_000), '005924');
      assert.equal(verifyTotp(secret, '287082', 59_000), 1);
      assert.equal(verifyTotp(secret, '287082', 59_000 + 30_000), 1); // lệch +1 bước vẫn nhận
      assert.equal(verifyTotp(secret, '287082', 59_000 + 90_000), null);
      assert.equal(verifyTotp(secret, 'abc123', 59_000), null);
    });

    it('parseUserAgent: desktop/mobile/tablet, Edge không bị nhận nhầm là Chrome', async () => {
      const { parseUserAgent } = await import('../src/modules/auth/user-agent.js');
      const mac = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.107 Safari/537.36');
      assert.deepEqual([mac.browser, mac.browserVersion, mac.os, mac.kind], ['Chrome', '123.0.6312.107', 'macOS', 'desktop']);
      const edge = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91');
      assert.deepEqual([edge.browser, edge.os], ['Edge', 'Windows']);
      const iphone = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1');
      assert.deepEqual([iphone.browser, iphone.os, iphone.osVersion, iphone.kind], ['Safari', 'iOS', '17.2', 'mobile']);
      const ipad = parseUserAgent('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1');
      assert.equal(ipad.kind, 'tablet');
      const android = parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36');
      assert.deepEqual([android.browser, android.os, android.kind], ['Chrome', 'Android', 'mobile']);
      const ff = parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0');
      assert.deepEqual([ff.browser, ff.os], ['Firefox', 'Linux']);
      assert.equal(parseUserAgent(undefined).kind, 'unknown');
      assert.equal(parseUserAgent('TestAgent/2').kind, 'unknown');
    });
  });

  describe('hồ sơ: handle, liên kết, bio, vị trí', () => {
    it('đặt handle (tự hạ chữ thường), instagram/youtube/showOnMap; xóa bằng chuỗi rỗng', async () => {
      const u = await registerUser('hp');
      const h = `Minh.An_${uniq()}`;
      const r = await call('PATCH', '/auth/me', {
        token: u.token,
        body: { handle: h, instagram: '@minhan.gom', youtube: 'https://youtube.com/@minhan', showOnMap: false, bio: 'Thiết kế đồ họa' },
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.handle, h.toLowerCase());
      assert.equal(r.body.data.instagram, 'minhan.gom');
      assert.equal(r.body.data.youtube, 'https://youtube.com/@minhan');
      assert.equal(r.body.data.showOnMap, false);
      const me = await call('GET', '/auth/me', { token: u.token });
      assert.equal(me.body.data.handle, h.toLowerCase());
      // Mặc định cho user mới
      const fresh = await registerUser('hp0');
      const f = (await call('GET', '/auth/me', { token: fresh.token })).body.data;
      assert.deepEqual([f.showOnMap, f.language, f.timezone, f.theme, f.twoFactorEnabled], [true, 'vi', 'Asia/Ho_Chi_Minh', 'light', false]);
      assert.equal('totpSecret' in f, false);
      // Đặt lại đúng handle của mình: không 409
      assert.equal((await call('PATCH', '/auth/me', { token: u.token, body: { handle: h } })).status, 200);
      // Xóa
      const cleared = await call('PATCH', '/auth/me', { token: u.token, body: { handle: '', instagram: '', youtube: '' } });
      assert.equal(cleared.body.data.handle, undefined);
      assert.equal(cleared.body.data.instagram, undefined);
    });

    it('handle: 409 khi đã có người dùng (không phân biệt hoa thường) hoặc giữ chỗ; 400 khi sai định dạng', async () => {
      const a = await registerUser('ha');
      const b = await registerUser('hb');
      const h = `taken_${uniq()}`;
      assert.equal((await call('PATCH', '/auth/me', { token: a.token, body: { handle: h } })).status, 200);
      assert.equal((await call('PATCH', '/auth/me', { token: b.token, body: { handle: h.toUpperCase() } })).status, 409);
      for (const reserved of ['admin', 'SofinHub', 'support']) {
        assert.equal((await call('PATCH', '/auth/me', { token: b.token, body: { handle: reserved } })).status, 409, reserved);
      }
      for (const bad of ['ab', 'a'.repeat(25), 'có dấu', 'a b c', '.abc', 'abc.', 'a..bc', 'ab-cd']) {
        assert.equal((await call('PATCH', '/auth/me', { token: b.token, body: { handle: bad } })).status, 400, bad);
      }
      for (const body of [{ bio: 'x'.repeat(151) }, { instagram: 'có dấu' }, { youtube: 'khong-phai-url' }, { showOnMap: 'yes' }]) {
        assert.equal((await call('PATCH', '/auth/me', { token: b.token, body })).status, 400, JSON.stringify(body));
      }
      assert.equal((await call('PATCH', '/auth/me', { token: b.token, body: { bio: 'x'.repeat(150) } })).status, 200);
    });

    it('GET /users/handle-available: 401, trạng thái invalid/reserved/taken/available, bỏ qua handle của chính mình', async () => {
      const a = await registerUser('hav');
      const b = await registerUser('havb');
      assert.equal((await call('GET', '/users/handle-available?handle=abc')).status, 401);
      const h = `avail_${uniq()}`;
      assert.deepEqual((await call('GET', `/users/handle-available?handle=${h}`, { token: a.token })).body.data, { available: true });
      await call('PATCH', '/auth/me', { token: a.token, body: { handle: h } });
      assert.deepEqual((await call('GET', `/users/handle-available?handle=${h}`, { token: a.token })).body.data, { available: true });
      assert.deepEqual((await call('GET', `/users/handle-available?handle=${h.toUpperCase()}`, { token: b.token })).body.data, { available: false, reason: 'taken' });
      assert.deepEqual((await call('GET', '/users/handle-available?handle=admin', { token: b.token })).body.data, { available: false, reason: 'reserved' });
      assert.deepEqual((await call('GET', '/users/handle-available?handle=ab', { token: b.token })).body.data, { available: false, reason: 'invalid' });
      assert.equal((await call('GET', '/users/handle-available', { token: b.token })).status, 400);
    });

    it('hồ sơ công khai: tra theo handle (@ tùy chọn), có level/communityCount/liên kết; showOnMap=false ẩn vị trí với người khác', async () => {
      const t = await registerUser('pub');
      const v = await registerUser('pubv');
      const h = `pub_${uniq()}`;
      await call('PATCH', '/auth/me', {
        token: t.token,
        body: { handle: h, location: 'Đà Nẵng', instagram: 'pub.ig', youtube: 'https://youtube.com/@pub', showOnMap: false },
      });
      const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
      const { pointsService } = await import('../src/modules/points/points.service.js');
      await enrollmentService.grant(t.id, 'photo');
      for (let i = 0; i < 5; i++) await pointsService.award(t.id, 'photo', 'post'); // 25 điểm => cấp 2 (ngưỡng 20)

      const byHandle = await call('GET', `/users/@${h}`, { token: v.token });
      assert.equal(byHandle.status, 200);
      const d = byHandle.body.data;
      assert.equal(d.id, t.id);
      assert.equal(d.handle, h);
      assert.equal(d.location, null);
      assert.equal(d.instagram, 'pub.ig');
      assert.equal(d.youtube, 'https://youtube.com/@pub');
      assert.equal(d.level, 2);
      assert.equal(d.totalPoints, 25);
      assert.equal(d.communityCount, 1);
      assert.equal('email' in d, false);
      assert.equal((await call('GET', `/users/${h.toUpperCase()}`, { token: v.token })).body.data.id, t.id);
      // Chính chủ vẫn thấy vị trí của mình; bật showOnMap thì người khác thấy.
      assert.equal((await call('GET', `/users/${t.id}`, { token: t.token })).body.data.location, 'Đà Nẵng');
      await call('PATCH', '/auth/me', { token: t.token, body: { showOnMap: true } });
      assert.equal((await call('GET', `/users/${t.id}`, { token: v.token })).body.data.location, 'Đà Nẵng');
      assert.equal((await call('GET', '/users/@khong_ton_tai_xyz', { token: v.token })).status, 404);
    });
  });

  describe('PATCH /auth/me/preferences', () => {
    it('401; lưu ngôn ngữ/múi giờ/giao diện; 400 giá trị lạ hoặc rỗng', async () => {
      assert.equal((await call('PATCH', '/auth/me/preferences', { body: { theme: 'dark' } })).status, 401);
      const u = await registerUser('pref');
      const r = await call('PATCH', '/auth/me/preferences', { token: u.token, body: { language: 'en', timezone: 'Asia/Seoul', theme: 'system' } });
      assert.equal(r.status, 200);
      assert.deepEqual([r.body.data.language, r.body.data.timezone, r.body.data.theme], ['en', 'Asia/Seoul', 'system']);
      const part = await call('PATCH', '/auth/me/preferences', { token: u.token, body: { theme: 'dark' } });
      assert.deepEqual([part.body.data.language, part.body.data.theme], ['en', 'dark']); // trường không gửi giữ nguyên
      assert.equal((await call('GET', '/auth/me', { token: u.token })).body.data.timezone, 'Asia/Seoul');
      for (const body of [{}, { language: 'fr' }, { theme: 'neon' }, { timezone: 'Mars/Olympus' }]) {
        assert.equal((await call('PATCH', '/auth/me/preferences', { token: u.token, body })).status, 400, JSON.stringify(body));
      }
    });
  });

  describe('mật khẩu: passwordChangedAt', () => {
    it('đổi mật khẩu và reset mật khẩu đều ghi passwordChangedAt', async () => {
      const u = await registerUser('pwat');
      assert.equal((await call('GET', '/auth/me', { token: u.token })).body.data.passwordChangedAt, undefined);
      const before = Date.now();
      assert.equal((await call('POST', '/auth/change-password', { token: u.token, body: { currentPassword: u.password, newPassword: 'NewPassw0rd!' } })).status, 200);
      const at = (await call('GET', '/auth/me', { token: u.token })).body.data.passwordChangedAt;
      assert.ok(at && new Date(at).getTime() >= before - 1000);

      await call('POST', '/auth/forgot-password', { body: { email: u.email } });
      const token = await lastToken(u.email, 'reset-password');
      assert.equal((await call('POST', '/auth/reset-password', { body: { token, password: 'Another1!pass' } })).status, 200);
      const login = await call('POST', '/auth/login', { body: { email: u.email, password: 'Another1!pass' } });
      assert.ok(new Date(login.body.data.user.passwordChangedAt).getTime() >= new Date(at).getTime());
    });
  });

  describe('đổi email', () => {
    it('401; 400 sai mật khẩu/trùng email hiện tại/email sai; 409 email đã dùng', async () => {
      assert.equal((await call('POST', '/auth/change-email', { body: { newEmail: 'a@b.co', password: 'x' } })).status, 401);
      const u = await registerUser('ce1');
      const other = await registerUser('ce1o');
      const send = (body: unknown) => call('POST', '/auth/change-email', { token: u.token, body });
      assert.equal((await send({ newEmail: `n-${uniq()}@test.local`, password: 'Sai1!xxxx' })).status, 400);
      assert.equal((await send({ newEmail: u.email, password: u.password })).status, 400);
      assert.equal((await send({ newEmail: 'khong-phai-email', password: u.password })).status, 400);
      assert.equal((await send({ newEmail: other.email.toUpperCase(), password: u.password })).status, 409);
      assert.equal((await send({ newEmail: `n-${uniq()}@test.local` })).status, 400);
    });

    it('gửi link tới email MỚI, email chỉ đổi sau khi xác nhận; đăng nhập bằng email mới; token dùng 1 lần', async () => {
      const u = await registerUser('ce2');
      const newEmail = `moi-${uniq()}@test.local`;
      const r = await call('POST', '/auth/change-email', { token: u.token, body: { newEmail: newEmail.toUpperCase(), password: u.password } });
      assert.equal(r.status, 202, JSON.stringify(r.body));
      assert.equal(r.body.data.pendingEmail, newEmail);

      const me = (await call('GET', '/auth/me', { token: u.token })).body.data;
      assert.equal(me.email, u.email); // chưa đổi
      assert.equal(me.pendingEmail, newEmail);
      // Thư gửi tới email mới, không phải email cũ
      const oldBox = (await call('GET', `/dev/outbox?to=${encodeURIComponent(u.email)}`)).body.data as { text: string }[];
      assert.equal(oldBox.some((m) => m.text.includes('verify-email')), false);
      const token = await lastToken(newEmail, 'verify-email');

      const ok = await call('POST', '/auth/verify-email', { body: { token } });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.email, newEmail);
      assert.equal(ok.body.data.pendingEmail, undefined);
      assert.equal(ok.body.data.emailVerified, true);
      assert.equal((await call('POST', '/auth/verify-email', { body: { token } })).status, 400);
      assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
      assert.equal((await call('POST', '/auth/login', { body: { email: newEmail, password: u.password } })).status, 200);
      // Phiên hiện tại không bị thu hồi
      assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 200);
    });

    it('send-verification khi đang chờ email mới gửi lại tới email mới; ai chiếm email trước thì xác nhận trả 409', async () => {
      const u = await registerUser('ce3');
      const target = `cho-${uniq()}@test.local`;
      await call('POST', '/auth/change-email', { token: u.token, body: { newEmail: target, password: u.password } });
      const db = (await useTestDb()).prisma;
      const token = await lastToken(target, 'verify-email');
      // Người khác đăng ký đúng email đó trong lúc chờ
      const reg = await call('POST', '/auth/register', { body: { email: target, password: 'Passw0rd!x', firstName: 'Kẻ', lastName: 'Chen' } });
      assert.equal(reg.status, 200);
      assert.equal((await call('POST', '/auth/verify-email', { body: { token } })).status, 409);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email, u.email);

      // Cooldown 60s giữa 2 lần phát hành token
      const v = await registerUser('ce3b');
      await call('POST', '/auth/change-email', { token: v.token, body: { newEmail: `x-${uniq()}@test.local`, password: v.password } });
      const again = await call('POST', '/auth/change-email', { token: v.token, body: { newEmail: `y-${uniq()}@test.local`, password: v.password } });
      assert.equal(again.status, 429);
      assert.equal((await call('POST', '/auth/send-verification', { token: v.token })).status, 429);
    });
  });

  describe('xác minh 2 bước (TOTP)', () => {
    async function setup(prefix: string) {
      const u = await registerUser(prefix);
      const { totpAt } = await import('../src/modules/auth/totp.js');
      const s = await call('POST', '/auth/2fa/setup', { token: u.token });
      assert.equal(s.status, 200);
      return { u, secret: s.body.data.secret as string, otpauthUrl: s.body.data.otpauthUrl as string, totpAt };
    }

    it('401; setup trả secret + otpauth URI, chưa bật; /auth/me không lộ secret', async () => {
      assert.equal((await call('POST', '/auth/2fa/setup')).status, 401);
      assert.equal((await call('POST', '/auth/2fa/enable', { body: { code: '123456' } })).status, 401);
      assert.equal((await call('POST', '/auth/2fa/disable', { body: { code: '123456' } })).status, 401);
      const { u, secret, otpauthUrl } = await setup('tf0');
      assert.match(secret, /^[A-Z2-7]{32}$/);
      assert.ok(otpauthUrl.startsWith('otpauth://totp/SofinHub:'));
      assert.ok(otpauthUrl.includes(`secret=${secret}`));
      const me = await call('GET', '/auth/me', { token: u.token });
      assert.equal(me.body.data.twoFactorEnabled, false);
      assert.equal(JSON.stringify(me.body).includes(secret), false);
      // Chưa setup thì enable 400
      const v = await registerUser('tf0b');
      assert.equal((await call('POST', '/auth/2fa/enable', { token: v.token, body: { code: '123456' } })).status, 400);
      // Chưa bật thì disable 409
      assert.equal((await call('POST', '/auth/2fa/disable', { token: v.token, body: { code: '123456' } })).status, 409);
    });

    it('enable: mã sai 400, mã sai định dạng 400, đúng thì bật; setup lại khi đã bật 409; secret không bao giờ lộ', async () => {
      const { u, secret, totpAt } = await setup('tf1');
      assert.equal((await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: '000000' } })).status === 400, true);
      assert.equal((await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: '12ab' } })).status, 400);
      const ok = await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: totpAt(secret) } });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(ok.body.data.twoFactorEnabled, true);
      assert.equal(JSON.stringify(ok.body).includes(secret), false);
      assert.equal((await call('POST', '/auth/2fa/setup', { token: u.token })).status, 409);
      assert.equal((await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: totpAt(secret) } })).status, 409);
      assert.equal(JSON.stringify((await call('GET', '/auth/me', { token: u.token })).body).includes(secret), false);
    });

    it('đăng nhập khi bật 2FA: trả vé (không phiên/cookie), bước 2 đúng mã mới cấp phiên; sai mã/vé giả/vé là access token: 401; mã đã dùng không dùng lại được', async () => {
      const { u, secret, totpAt } = await setup('tf2');
      await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: totpAt(secret) } });

      const step1 = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      assert.equal(step1.status, 200);
      assert.equal(step1.body.data.twoFactorRequired, true);
      assert.equal(step1.body.data.accessToken, undefined);
      assert.equal(step1.headers.getSetCookie().length, 0);
      const ticket = step1.body.data.ticket as string;
      // Sai mật khẩu vẫn 401 như cũ (không lộ trạng thái 2FA)
      assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: 'Sai1!xxxx' } })).status, 401);

      assert.equal((await call('POST', '/auth/login/2fa', { body: { ticket, code: '000000' } })).status, 401);
      assert.equal((await call('POST', '/auth/login/2fa', { body: { ticket: 'rac', code: totpAt(secret, Date.now() + 30_000) } })).status, 401);
      assert.equal((await call('POST', '/auth/login/2fa', { body: { ticket: u.token, code: totpAt(secret, Date.now() + 30_000) } })).status, 401);
      assert.equal((await call('POST', '/auth/login/2fa', { body: { ticket } })).status, 400);

      // Mã của bước hiện tại đã dùng để bật 2FA => từ chối (chống replay); dùng mã bước kế tiếp.
      assert.equal((await call('POST', '/auth/login/2fa', { body: { ticket, code: totpAt(secret) } })).status, 401);
      const next = totpAt(secret, Date.now() + 30_000);
      const ok = await call('POST', '/auth/login/2fa', { body: { ticket, code: next } });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.ok(ok.body.data.accessToken);
      assert.equal(ok.body.data.user.twoFactorEnabled, true);
      assert.ok(cookieOf(ok.headers).startsWith('refresh_token='));
      assert.equal((await call('GET', '/auth/me', { token: ok.body.data.accessToken })).status, 200);
      // Dùng lại đúng mã đó => 401
      assert.equal((await call('POST', '/auth/login/2fa', { body: { ticket, code: next } })).status, 401);
    });

    it('disable: cần mã đúng (và mật khẩu nếu gửi); sau khi tắt đăng nhập lại 1 bước và có thể setup lại với secret mới', async () => {
      const { u, secret, totpAt } = await setup('tf3');
      await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: totpAt(secret) } });
      const prev = totpAt(secret, Date.now() - 30_000);
      assert.equal((await call('POST', '/auth/2fa/disable', { token: u.token, body: { code: '000000' } })).status, 400);
      assert.equal((await call('POST', '/auth/2fa/disable', { token: u.token, body: { code: prev, password: 'Sai1!xxxx' } })).status, 400);
      const off = await call('POST', '/auth/2fa/disable', { token: u.token, body: { code: prev } });
      assert.equal(off.status, 200, JSON.stringify(off.body));
      assert.equal(off.body.data.twoFactorEnabled, false);
      const login = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      assert.ok(login.body.data.accessToken);
      const again = await call('POST', '/auth/2fa/setup', { token: u.token });
      assert.equal(again.status, 200);
      assert.notEqual(again.body.data.secret, secret);
      assert.equal((await call('POST', '/auth/2fa/disable', { token: u.token, body: { code: '123456' } })).status, 409);
    });

    it('giới hạn thử mã: quá nhiều lần nhập sai => 429', async () => {
      const { u } = await setup('tf4');
      let last = 0;
      for (let i = 0; i < 10; i++) last = (await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: '000000' } })).status;
      assert.equal(last, 429);
    });
  });

  describe('thiết bị đăng nhập', () => {
    it('GET /auth/sessions kèm device đã phân tích; revoke-others giữ phiên hiện tại và thu hồi phiên khác', async () => {
      const u = await registerUser('dev');
      const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.107 Safari/537.36';
      const s2 = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, headers: { 'User-Agent': UA } });
      const s3 = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, headers: { 'User-Agent': 'TestAgent/3' } });
      const t2 = s2.body.data.accessToken as string;
      const t3 = s3.body.data.accessToken as string;

      const list = await call('GET', '/auth/sessions', { token: t2 });
      assert.equal(list.body.data.length, 3);
      const cur = list.body.data.find((s: any) => s.current);
      assert.equal(cur.device.browser, 'Chrome');
      assert.equal(cur.device.os, 'macOS');
      assert.equal(cur.device.kind, 'desktop');

      assert.equal((await call('POST', '/auth/sessions/revoke-others')).status, 401);
      assert.equal((await call('POST', '/auth/sessions/revoke-others', { token: t2 })).status, 204);
      assert.equal((await call('GET', '/auth/me', { token: t2 })).status, 200); // giữ phiên này
      assert.equal((await call('GET', '/auth/me', { token: t3 })).status, 401);
      assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 401);
      const after = await call('GET', '/auth/sessions', { token: t2 });
      assert.equal(after.body.data.length, 1);
      assert.equal(after.body.data[0].current, true);
    });
  });

  describe('xóa tài khoản: điều kiện chặn', () => {
    it('GET /auth/me/delete-blockers: 401; liệt kê cộng đồng sở hữu + gói đang hoạt động (không tính gói đã đặt hủy cuối kỳ)', async () => {
      assert.equal((await call('GET', '/auth/me/delete-blockers')).status, 401);
      const u = await registerUser('blk');
      const db = (await useTestDb()).prisma;
      assert.deepEqual((await call('GET', '/auth/me/delete-blockers', { token: u.token })).body.data, { ownedCommunities: [], activeSubscriptions: 0 });

      const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
      await enrollmentService.grant(u.id, 'photo', 'owner');
      const now = new Date();
      const base = { userId: u.id, priceCents: 1000, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 864e5) };
      const subs = await db.community.findMany({ select: { id: true }, take: 3, orderBy: { id: 'asc' } });
      await db.subscription.create({ data: { ...base, communityId: subs[1]!.id, status: 'active' } });
      await db.subscription.create({ data: { ...base, communityId: subs[2]!.id, status: 'active', cancelAtPeriodEnd: true } });

      const r = await call('GET', '/auth/me/delete-blockers', { token: u.token });
      assert.equal(r.body.data.activeSubscriptions, 1);
      assert.equal(r.body.data.ownedCommunities.length, 1);
      assert.equal(r.body.data.ownedCommunities[0].id, 'photo');
      assert.ok(r.body.data.ownedCommunities[0].title);
    });

    it('DELETE /auth/me: 409 ACCOUNT_DELETE_BLOCKED kèm details khi còn gói hoạt động; hủy gói + hết là chủ thì xóa được', async () => {
      const u = await registerUser('blk2');
      const db = (await useTestDb()).prisma;
      const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
      await enrollmentService.grant(u.id, 'photo', 'owner');
      const community = (await db.community.findMany({ select: { id: true }, orderBy: { id: 'asc' }, take: 2 }))[1]!.id;
      const now = new Date();
      const sub = await db.subscription.create({
        data: { userId: u.id, communityId: community, status: 'active', priceCents: 1000, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 864e5) },
      });
      // Sai mật khẩu vẫn 400 trước khi lộ điều kiện chặn
      assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: { password: 'Sai1!xxxx' } })).status, 400);
      const blocked = await call('DELETE', '/auth/me', { token: u.token, body: { password: u.password } });
      assert.equal(blocked.status, 409);
      assert.equal(blocked.body.error.code, 'ACCOUNT_DELETE_BLOCKED');
      assert.equal(blocked.body.error.details.activeSubscriptions, 1);
      assert.equal(blocked.body.error.details.ownedCommunities[0].id, 'photo');
      assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 200); // chưa bị xóa

      await db.subscription.update({ where: { id: sub.id }, data: { status: 'canceled' } });
      await enrollmentService.setRole(u.id, 'photo', 'member');
      assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: { password: u.password } })).status, 204);
    });

    it('ẩn danh hóa xóa luôn handle/liên kết/bí mật 2FA (giải phóng handle)', async () => {
      const u = await registerUser('anon2');
      const h = `anon_${uniq()}`;
      await call('PATCH', '/auth/me', { token: u.token, body: { handle: h, instagram: 'x.y' } });
      const { totpAt } = await import('../src/modules/auth/totp.js');
      const s = await call('POST', '/auth/2fa/setup', { token: u.token });
      await call('POST', '/auth/2fa/enable', { token: u.token, body: { code: totpAt(s.body.data.secret) } });
      assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: { password: u.password } })).status, 204);
      const db = (await useTestDb()).prisma;
      const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.deepEqual([row.handle, row.instagram, row.totpSecret, row.twoFactorEnabled], [null, null, null, false]);
      const other = await registerUser('anon2b');
      assert.equal((await call('PATCH', '/auth/me', { token: other.token, body: { handle: h } })).status, 200);
    });
  });
});
