import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

/**
 * Thu hồi access token có hiệu lực NGAY (không chờ 15 phút): token mang `sid` + `tv`, requireAuth kiểm tra DB.
 */
describe('thu hồi access token tức thì', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];
  let registerUser: ReturnType<typeof makeClient>['registerUser'];
  let prisma: Awaited<ReturnType<typeof useTestDb>>['prisma'];
  let jwt: typeof import('jsonwebtoken').default;
  let env: typeof import('../src/config/env.js').env;

  before(async () => {
    server = await startTestServer();
    ({ call, registerUser } = makeClient(server.baseUrl));
    prisma = (await useTestDb()).prisma;
    jwt = (await import('jsonwebtoken')).default;
    env = (await import('../src/config/env.js')).env;
  });
  after(() => server.close());

  const me = (token: string) => call('GET', '/auth/me', { token });
  const cookieOf = (headers: Headers) => (headers.getSetCookie()[0] ?? '').split(';')[0];

  /** Đăng nhập thêm 1 phiên cho user đã đăng ký; trả access token + cookie refresh của phiên đó. */
  async function loginAgain(u: { email: string; password: string }) {
    const r = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
    assert.equal(r.status, 200);
    return { token: r.body.data.accessToken as string, cookie: cookieOf(r.headers) };
  }

  it('đổi mật khẩu: token của phiên khác chết ngay, phiên hiện tại vẫn dùng được', async () => {
    const u = await registerUser('rv-chg');
    const s2 = await loginAgain(u);
    assert.equal((await me(u.token)).status, 200);
    const r = await call('POST', '/auth/change-password', {
      token: s2.token,
      body: { currentPassword: u.password, newPassword: 'NewPass1!' },
    });
    assert.equal(r.status, 200);
    assert.equal((await me(u.token)).status, 401, 'phiên khác phải chết ngay');
    assert.equal((await me(s2.token)).status, 200, 'phiên hiện tại được giữ');
    assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: 'NewPass1!' } })).status, 200);
  });

  it('reset mật khẩu: mọi access token cũ và refresh token cũ chết ngay', async () => {
    const u = await registerUser('rv-reset');
    const s2 = await loginAgain(u);
    await call('POST', '/auth/forgot-password', { body: { email: u.email } });
    const outbox = await call('GET', `/dev/outbox?to=${encodeURIComponent(u.email)}`);
    const mail = (outbox.body.data as { text: string }[]).filter((m) => m.text.includes('/reset-password?token=')).at(-1)!;
    const token = mail.text.match(/token=([^\s"]+)/)![1];
    assert.equal((await call('POST', '/auth/reset-password', { body: { token, password: 'Reset1234!' } })).status, 200);
    assert.equal((await me(u.token)).status, 401);
    assert.equal((await me(s2.token)).status, 401);
    assert.equal((await call('POST', '/auth/refresh', { headers: { Cookie: s2.cookie } })).status, 401);
    const fresh = await call('POST', '/auth/login', { body: { email: u.email, password: 'Reset1234!' } });
    assert.equal(fresh.status, 200);
    assert.equal((await me(fresh.body.data.accessToken)).status, 200);
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    assert.equal(row?.tokenVersion, 1);
  });

  it('xóa tài khoản: token chết ngay, không đăng nhập lại được', async () => {
    const u = await registerUser('rv-del');
    const s2 = await loginAgain(u);
    assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: { password: u.password } })).status, 204);
    assert.equal((await me(u.token)).status, 401);
    assert.equal((await me(s2.token)).status, 401);
    assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
  });

  it('logout: access token và refresh token chết ngay', async () => {
    const u = await registerUser('rv-out');
    const s2 = await loginAgain(u);
    assert.equal((await call('POST', '/auth/logout', { token: u.token })).status, 204);
    assert.equal((await me(u.token)).status, 401);
    assert.equal((await me(s2.token)).status, 401, 'logout thu hồi mọi phiên (hành vi vốn có)');
    assert.equal((await call('POST', '/auth/refresh', { headers: { Cookie: s2.cookie } })).status, 401);
  });

  it('thu hồi 1 phiên khác: chỉ token của đúng phiên đó chết ngay', async () => {
    const u = await registerUser('rv-one');
    const s2 = await loginAgain(u);
    const list = await call('GET', '/auth/sessions', { token: s2.token });
    assert.equal(list.body.data.length, 2);
    const target = list.body.data.find((s: any) => !s.current);
    assert.equal((await call('DELETE', `/auth/sessions/${target.id}`, { token: s2.token })).status, 204);
    assert.equal((await me(u.token)).status, 401, 'phiên bị thu hồi');
    assert.equal((await me(s2.token)).status, 200, 'phiên còn lại không ảnh hưởng');
  });

  it('logout-all: mọi access token chết ngay và tokenVersion tăng', async () => {
    const u = await registerUser('rv-all');
    const s2 = await loginAgain(u);
    assert.equal((await call('POST', '/auth/logout-all', { token: s2.token })).status, 204);
    assert.equal((await me(u.token)).status, 401);
    assert.equal((await me(s2.token)).status, 401);
    assert.equal((await prisma.user.findUnique({ where: { id: u.id } }))?.tokenVersion, 1);
    assert.equal((await call('POST', '/auth/refresh', { headers: { Cookie: s2.cookie } })).status, 401);
  });

  it('token giả / sai tv / sai sid / kiểu cũ (chỉ sub) đều 401', async () => {
    const u = await registerUser('rv-forge');
    const { sub, sid, tv } = jwt.decode(u.token) as { sub: string; sid: string; tv: number };
    const payload = { sub, sid, tv };
    const sign = (p: object, secret = env.JWT_ACCESS_SECRET) => jwt.sign(p, secret, { expiresIn: 60 });

    assert.equal((await me(sign({ ...payload }))).status, 200, 'token hợp lệ tự ký lại vẫn qua (đối chứng)');
    assert.equal((await me(sign({ ...payload }, 'sai-bi-mat'))).status, 401, 'sai chữ ký');
    assert.equal((await me(sign({ sub: payload.sub, sid: payload.sid, tv: payload.tv + 1 }))).status, 401, 'sai tv');
    assert.equal((await me(sign({ sub: payload.sub, sid: '00000000-0000-0000-0000-000000000000', tv: payload.tv }))).status, 401, 'sid lạ');
    assert.equal((await me(sign({ sub: payload.sub }))).status, 401, 'token kiểu cũ không có sid/tv');

    // sid của người khác nhưng sub của mình
    const other = await registerUser('rv-forge2');
    const otherPayload = jwt.decode(other.token) as { sid: string; tv: number };
    assert.equal((await me(sign({ sub: payload.sub, sid: otherPayload.sid, tv: otherPayload.tv }))).status, 401, 'sid không thuộc sub');

    const expired = jwt.sign({ ...payload }, env.JWT_ACCESS_SECRET, { expiresIn: -10 });
    assert.equal((await me(expired)).status, 401, 'hết hạn');
    assert.equal((await me('khong.phai.jwt')).status, 401);
  });

  it('user bị xóa trực tiếp trong DB / phiên hết hạn / tokenVersion đổi: 401 ngay', async () => {
    const a = await registerUser('rv-db-a');
    assert.equal((await me(a.token)).status, 200);
    await prisma.user.delete({ where: { id: a.id } });
    assert.equal((await me(a.token)).status, 401);

    const b = await registerUser('rv-db-b');
    const sid = (jwt.decode(b.token) as { sid: string }).sid;
    await prisma.session.update({ where: { id: sid }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await me(b.token)).status, 401);

    const c = await registerUser('rv-db-c');
    await prisma.user.update({ where: { id: c.id }, data: { tokenVersion: { increment: 1 } } });
    assert.equal((await me(c.token)).status, 401);
  });

  it('optionalAuth: token bị thu hồi coi như chưa đăng nhập', async () => {
    const u = await registerUser('rv-opt');
    const withToken = await call('GET', '/courses/photo', { token: u.token });
    assert.equal(withToken.body.data.viewerEnrolled, false);
    await call('POST', '/auth/logout', { token: u.token });
    const after = await call('GET', '/courses/photo', { token: u.token });
    assert.equal(after.status, 200);
    assert.equal(after.body.data.viewerEnrolled, undefined);
  });

  it('SSE: vé (ticket) vẫn hoạt động; Bearer / access_token đã thu hồi bị 401', async () => {
    const u = await registerUser('rv-sse');
    const t = await call('POST', '/notifications/stream-ticket', { token: u.token });
    assert.ok(t.status < 300);
    const ac = new AbortController();
    const res = await fetch(`${server.baseUrl}/notifications/stream?ticket=${t.body.data.ticket}`, { signal: ac.signal });
    assert.equal(res.status, 200);
    ac.abort();

    const mt = await call('POST', '/messages/stream-ticket', { token: u.token });
    assert.ok(mt.status < 300);
    const ac2 = new AbortController();
    const res2 = await fetch(`${server.baseUrl}/messages/stream?ticket=${mt.body.data.ticket}`, { signal: ac2.signal });
    assert.equal(res2.status, 200);
    ac2.abort();

    const ac3 = new AbortController();
    const live = await fetch(`${server.baseUrl}/notifications/stream?access_token=${u.token}`, { signal: ac3.signal });
    assert.equal(live.status, 200);
    ac3.abort();

    await call('POST', '/auth/logout', { token: u.token });
    assert.equal((await call('GET', `/notifications/stream?access_token=${u.token}`)).status, 401);
    assert.equal((await call('GET', '/notifications/stream', { token: u.token })).status, 401);
    assert.equal((await call('GET', '/messages/stream', { token: u.token })).status, 401);
    assert.equal((await call('POST', '/notifications/stream-ticket', { token: u.token })).status, 401);
  });

  it('thành viên minh họa (isDemo) không đăng nhập được dù biết mật khẩu', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    await prisma.user.create({
      data: { email: 'seed-x-1@demo.sofinhub.invalid', firstName: 'D', lastName: 'M', passwordHash: await bcrypt.hash('Passw0rd!x', 4), isDemo: true },
    });
    const r = await call('POST', '/auth/login', { body: { email: 'seed-x-1@demo.sofinhub.invalid', password: 'Passw0rd!x' } });
    assert.equal(r.status, 401);
  });
});
