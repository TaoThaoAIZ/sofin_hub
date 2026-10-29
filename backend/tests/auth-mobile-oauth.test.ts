import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { startTestServer, type TestServer } from './helpers.js';

/**
 * Đăng nhập Google cho app mobile (oauth-mobile.ts): mã đổi một lần + PKCE, deep link `sofinhub://oauth`.
 * Phần gọi Google thật không test được tự động; test đây gồm logic mã đổi, state mang challenge và các nhánh lỗi của route.
 */
describe('auth mobile: Google qua trình duyệt hệ thống', () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer();
  });
  after(() => server.close());

  const verifier = 'v'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const session = { user: { id: 'u1' }, accessToken: 'a', refreshToken: 'r' } as never;

  it('isMobileChallenge chỉ nhận base64url 43 ký tự (sha256)', async () => {
    const { isMobileChallenge } = await import('../src/modules/auth/oauth-mobile.js');
    assert.equal(isMobileChallenge(challenge), true);
    for (const bad of ['', 'abc', challenge + 'x', challenge.slice(1) + '+', undefined, 42]) assert.equal(isMobileChallenge(bad), false);
  });

  it('mã đổi: đúng verifier lấy được phiên, chỉ dùng được 1 lần', async () => {
    const { putMobileSession, takeMobileSession } = await import('../src/modules/auth/oauth-mobile.js');
    const code = putMobileSession(session, challenge);
    assert.equal(takeMobileSession(code, verifier), session);
    assert.equal(takeMobileSession(code, verifier), null, 'mã dùng lại phải bị từ chối');
  });

  it('sai verifier: bị từ chối và mã bị hủy luôn (không cho thử lại)', async () => {
    const { putMobileSession, takeMobileSession } = await import('../src/modules/auth/oauth-mobile.js');
    const code = putMobileSession(session, challenge);
    assert.equal(takeMobileSession(code, 'x'.repeat(43)), null);
    assert.equal(takeMobileSession(code, verifier), null);
  });

  it('state mang challenge qua verifyOAuthState; state web không có', async () => {
    const { createOAuthState, verifyOAuthState } = await import('../src/modules/auth/oauth.js');
    const m = createOAuthState('google', undefined, challenge);
    assert.equal(verifyOAuthState(m.state, m.nonce, 'google')?.mobileChallenge, challenge);
    const w = createOAuthState('google');
    assert.equal(verifyOAuthState(w.state, w.nonce, 'google')?.mobileChallenge, undefined);
  });

  it('exchange: thiếu X-Client mobile -> 401; mã sai -> 401', async () => {
    const post = (headers: Record<string, string>) =>
      fetch(`${server.baseUrl}/auth/oauth/mobile/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ code: 'sai', verifier }) });
    assert.equal((await post({})).status, 401);
    assert.equal((await post({ 'X-Client': 'mobile' })).status, 401);
  });

  it('start mobile với challenge sai/thiếu: chuyển về deep link kèm lỗi (không về web)', async (t) => {
    const { env } = await import('../src/config/env.js');
    const res = await fetch(`${server.baseUrl}/auth/oauth/google/start?client=mobile&challenge=ngan`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const loc = res.headers.get('location') ?? '';
    if (env.GOOGLE_CLIENT_ID) assert.equal(loc, 'sofinhub://oauth#error=invalid_state');
    else assert.equal(loc, 'sofinhub://oauth#error=not_configured', 't.skip: chưa cấu hình Google');
    void t;
  });
});
