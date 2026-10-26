import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

/**
 * Refresh token qua body cho app mobile (header `X-Client: mobile`). Web (không header) giữ nguyên: token chỉ ở cookie httpOnly.
 */
describe('auth mobile: refresh token qua body', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];
  let registerUser: ReturnType<typeof makeClient>['registerUser'];

  before(async () => {
    server = await startTestServer();
    ({ call, registerUser } = makeClient(server.baseUrl));
  });
  after(() => server.close());

  const mobile = { 'X-Client': 'mobile' };

  it('login: có X-Client mobile thì body có refreshToken; web thì không', async () => {
    const u = await registerUser('mob-login');
    const web = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
    assert.equal(web.status, 200);
    assert.equal(web.body.data.refreshToken, undefined, 'web không được nhận refresh token trong body');
    assert.ok(web.headers.getSetCookie().length > 0, 'web vẫn nhận cookie refresh');

    const app = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, headers: mobile });
    assert.equal(app.status, 200);
    assert.equal(typeof app.body.data.refreshToken, 'string');
    assert.ok(app.body.data.refreshToken.length > 20);
  });

  it('refresh bằng body: cấp phiên mới + token xoay vòng (token cũ dùng lại bị từ chối)', async () => {
    const u = await registerUser('mob-refresh');
    const login = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, headers: mobile });
    const first = login.body.data.refreshToken as string;

    const r = await call('POST', '/auth/refresh', { body: { refreshToken: first }, headers: mobile });
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.data.accessToken, 'string');
    const second = r.body.data.refreshToken as string;
    assert.notEqual(second, first, 'refresh token phải xoay vòng');

    const reuse = await call('POST', '/auth/refresh', { body: { refreshToken: first }, headers: mobile });
    assert.equal(reuse.status, 401, 'token đã dùng không được dùng lại');
  });

  it('không có X-Client mobile thì body refreshToken bị bỏ qua (chỉ nhận cookie)', async () => {
    const u = await registerUser('mob-noheader');
    const login = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, headers: mobile });
    const r = await call('POST', '/auth/refresh', { body: { refreshToken: login.body.data.refreshToken } });
    assert.equal(r.status, 401);
  });

  it('refresh không có token nào -> 401', async () => {
    const r = await call('POST', '/auth/refresh', { body: {}, headers: mobile });
    assert.equal(r.status, 401);
  });
});
