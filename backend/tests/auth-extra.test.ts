import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

describe('auth bổ sung: quên/đổi mật khẩu, hồ sơ, xác thực email, phiên, xóa tài khoản', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];
  let registerUser: ReturnType<typeof makeClient>['registerUser'];
  let registerVerified: ReturnType<typeof makeClient>['registerVerified'];

  before(async () => {
    server = await startTestServer();
    ({ call, registerUser, registerVerified } = makeClient(server.baseUrl));
  });
  after(() => server.close());

  async function lastLink(to: string, path: string): Promise<string> {
    const r = await call('GET', `/dev/outbox?to=${encodeURIComponent(to)}`);
    assert.equal(r.status, 200);
    const mails = (r.body.data as { text: string }[]).filter((m) => m.text.includes(path));
    assert.ok(mails.length > 0, `không có thư chứa ${path}`);
    return mails[mails.length - 1].text.match(/token=([^\s"]+)/)![1];
  }

  const cookieOf = (headers: Headers) => (headers.getSetCookie()[0] ?? '').split(';')[0];

  describe('forgot/reset password', () => {
    it('forgot-password luôn 200 cùng thông điệp, kể cả email không tồn tại', async () => {
      const u = await registerUser('forgot');
      const a = await call('POST', '/auth/forgot-password', { body: { email: u.email } });
      const b = await call('POST', '/auth/forgot-password', { body: { email: 'khong-ton-tai@test.local' } });
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.deepEqual(a.body, b.body);
      assert.equal(JSON.stringify(a.body).includes('token'), false);
      const none = await call('GET', '/dev/outbox?to=khong-ton-tai@test.local');
      assert.equal(none.body.data.length, 0);
    });

    it('forgot-password email sai định dạng: 400', async () => {
      const r = await call('POST', '/auth/forgot-password', { body: { email: 'abc' } });
      assert.equal(r.status, 400);
    });

    it('reset-password: đặt lại được, token dùng 1 lần, thu hồi refresh token, đăng nhập bằng mật khẩu mới', async () => {
      const u = await registerUser('reset');
      const login = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      const cookie = cookieOf(login.headers);
      await call('POST', '/auth/forgot-password', { body: { email: u.email } });
      const token = await lastLink(u.email, '/reset-password?token=');

      const weak = await call('POST', '/auth/reset-password', { body: { token, password: 'yeu' } });
      assert.equal(weak.status, 400);

      const ok = await call('POST', '/auth/reset-password', { body: { token, password: 'NewPass1!' } });
      assert.equal(ok.status, 200);

      const again = await call('POST', '/auth/reset-password', { body: { token, password: 'Another1!' } });
      assert.equal(again.status, 400);

      const oldLogin = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      assert.equal(oldLogin.status, 401);
      const newLogin = await call('POST', '/auth/login', { body: { email: u.email, password: 'NewPass1!' } });
      assert.equal(newLogin.status, 200);

      const refresh = await call('POST', '/auth/refresh', { headers: { Cookie: cookie } });
      assert.equal(refresh.status, 401);
    });

    it('token giả: 400', async () => {
      const r = await call('POST', '/auth/reset-password', { body: { token: 'fake', password: 'NewPass1!' } });
      assert.equal(r.status, 400);
    });
  });

  describe('change-password', () => {
    it('401 khi thiếu token', async () => {
      const r = await call('POST', '/auth/change-password', { body: { currentPassword: 'a', newPassword: 'NewPass1!' } });
      assert.equal(r.status, 401);
    });

    it('sai mật khẩu hiện tại / trùng mật khẩu cũ / mật khẩu yếu: 400', async () => {
      const u = await registerUser('chg');
      const wrong = await call('POST', '/auth/change-password', { token: u.token, body: { currentPassword: 'Sai1!xxx', newPassword: 'NewPass1!' } });
      assert.equal(wrong.status, 400);
      const same = await call('POST', '/auth/change-password', { token: u.token, body: { currentPassword: u.password, newPassword: u.password } });
      assert.equal(same.status, 400);
      const weak = await call('POST', '/auth/change-password', { token: u.token, body: { currentPassword: u.password, newPassword: 'weak' } });
      assert.equal(weak.status, 400);
    });

    it('đổi thành công, giữ phiên hiện tại và thu hồi phiên khác', async () => {
      const u = await registerUser('chg2');
      const s1 = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      const s2 = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      const c1 = cookieOf(s1.headers);
      const c2 = cookieOf(s2.headers);

      // "Phiên hiện tại" = phiên của access token đang gọi (s1).
      const r = await call('POST', '/auth/change-password', {
        token: s1.body.data.accessToken,
        headers: { Cookie: c1 },
        body: { currentPassword: u.password, newPassword: 'NewPass1!' },
      });
      assert.equal(r.status, 200);

      assert.equal((await call('POST', '/auth/refresh', { headers: { Cookie: c2 } })).status, 401);
      assert.equal((await call('POST', '/auth/refresh', { headers: { Cookie: c1 } })).status, 200);
      assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: 'NewPass1!' } })).status, 200);
    });
  });

  describe('PATCH /auth/me', () => {
    it('401 khi thiếu token', async () => {
      assert.equal((await call('PATCH', '/auth/me', { body: { bio: 'x' } })).status, 401);
    });

    it('cập nhật hồ sơ, GET /auth/me trả đủ trường + emailVerified=true (đã xác thực OTP khi đăng ký)', async () => {
      const u = await registerUser('prof');
      const r = await call('PATCH', '/auth/me', {
        token: u.token,
        body: { firstName: 'An', bio: 'Xin chào', location: 'Hà Nội', website: 'https://example.com', avatarUrl: '/files/avatars/a.png' },
      });
      assert.equal(r.status, 200);
      const me = await call('GET', '/auth/me', { token: u.token });
      assert.equal(me.body.data.firstName, 'An');
      assert.equal(me.body.data.bio, 'Xin chào');
      assert.equal(me.body.data.location, 'Hà Nội');
      assert.equal(me.body.data.website, 'https://example.com');
      assert.equal(me.body.data.avatarUrl, '/files/avatars/a.png');
      assert.equal(me.body.data.emailVerified, true);
      assert.equal('passwordHash' in me.body.data, false);

      const cleared = await call('PATCH', '/auth/me', { token: u.token, body: { bio: '' } });
      assert.equal(cleared.body.data.bio, undefined);
    });

    it('validate: bio > 500, website không hợp lệ, avatar javascript:, tên rỗng: 400', async () => {
      const u = await registerUser('prof2');
      const bad = [
        { bio: 'x'.repeat(501) },
        { website: 'ftp://example.com' },
        { website: 'khong-phai-url' },
        { avatarUrl: 'javascript:alert(1)' },
        { avatarUrl: '/files/../secret' },
        { firstName: '' },
      ];
      for (const body of bad) {
        const r = await call('PATCH', '/auth/me', { token: u.token, body });
        assert.equal(r.status, 400, JSON.stringify(body));
      }
    });
  });

  describe('xác thực email', () => {
    it('gửi thư, xác thực bằng token, dùng lại token: 400, đã xác thực: 409', async () => {
      const u = await registerUser('ver');
      // registerUser đã xác thực email qua OTP; luồng link này dành cho email chưa xác thực nên hạ cờ lại.
      await (await useTestDb()).prisma.user.update({ where: { id: u.id }, data: { emailVerified: false } });
      assert.equal((await call('POST', '/auth/send-verification')).status, 401);

      const sent = await call('POST', '/auth/send-verification', { token: u.token });
      assert.equal(sent.status, 202);
      assert.equal(JSON.stringify(sent.body).includes('token='), false);

      // giới hạn 1 lần / 60 giây
      assert.equal((await call('POST', '/auth/send-verification', { token: u.token })).status, 429);

      const token = await lastLink(u.email, '/verify-email?token=');
      const ok = await call('POST', '/auth/verify-email', { body: { token } });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.emailVerified, true);
      assert.equal((await call('GET', '/auth/me', { token: u.token })).body.data.emailVerified, true);

      assert.equal((await call('POST', '/auth/verify-email', { body: { token } })).status, 400);
      assert.equal((await call('POST', '/auth/send-verification', { token: u.token })).status, 409);
      assert.equal((await call('POST', '/auth/verify-email', { body: {} })).status, 400);
    });
  });

  describe('phiên đăng nhập', () => {
    it('liệt kê, đánh dấu phiên hiện tại, thu hồi 1 phiên, 404 khi id lạ, logout-all', async () => {
      const u = await registerUser('sess');
      assert.equal((await call('GET', '/auth/sessions')).status, 401);

      const s2 = await call('POST', '/auth/login', { body: { email: u.email, password: u.password }, headers: { 'User-Agent': 'TestAgent/2' } });
      const c2 = cookieOf(s2.headers);

      const t2 = s2.body.data.accessToken as string;
      const list = await call('GET', '/auth/sessions', { token: t2, headers: { Cookie: c2 } });
      assert.equal(list.status, 200);
      assert.equal(list.body.data.length, 2);
      const current = list.body.data.filter((s: any) => s.current);
      assert.equal(current.length, 1);
      assert.equal(current[0].userAgent, 'TestAgent/2');
      assert.equal(JSON.stringify(list.body).includes('jti'), false);

      const other = list.body.data.find((s: any) => !s.current);
      assert.equal((await call('DELETE', `/auth/sessions/${other.id}`, { token: t2 })).status, 204);
      assert.equal((await call('DELETE', `/auth/sessions/${other.id}`, { token: t2 })).status, 404);
      assert.equal((await call('GET', '/auth/sessions', { token: t2 })).body.data.length, 1);
      // Phiên bị thu hồi: access token của nó chết ngay
      assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 401);

      // Sau khi xoay refresh token, phiên vẫn giữ nguyên id
      const refreshed = await call('POST', '/auth/refresh', { headers: { Cookie: c2 } });
      assert.equal(refreshed.status, 200);
      const after = await call('GET', '/auth/sessions', { token: refreshed.body.data.accessToken, headers: { Cookie: cookieOf(refreshed.headers) } });
      assert.equal(after.body.data.length, 1);
      assert.equal(after.body.data[0].id, current[0].id);

      assert.equal((await call('POST', '/auth/logout-all')).status, 401);
      const t3 = refreshed.body.data.accessToken as string;
      assert.equal((await call('POST', '/auth/logout-all', { token: t3 })).status, 204);
      // Mọi access token đều chết ngay sau logout-all
      assert.equal((await call('GET', '/auth/sessions', { token: t3 })).status, 401);
    });
  });

  describe('DELETE /auth/me', () => {
    it('401 thiếu token, 400 thiếu/sai mật khẩu', async () => {
      const u = await registerUser('del0');
      assert.equal((await call('DELETE', '/auth/me', { body: { password: u.password } })).status, 401);
      assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: {} })).status, 400);
      assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: { password: 'Sai1!xxxx' } })).status, 400);
    });

    it('owner cộng đồng: 409; sau khi hết là owner thì xóa được, rút khỏi cộng đồng, bài viết hiện "Thành viên đã xóa"', async () => {
      const u = await registerUser('del1');
      const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
      const { userBriefView } = await import('../src/modules/auth/user-view.js');
      await enrollmentService.grant(u.id, 'photo', 'owner');
      assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: { password: u.password } })).status, 409);

      await enrollmentService.setRole(u.id, 'photo', 'member');
      const ok = await call('DELETE', '/auth/me', { token: u.token, body: { password: u.password } });
      assert.equal(ok.status, 204);

      assert.equal(await enrollmentService.isEnrolled(u.id, 'photo'), false);
      assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 401);
      assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
      assert.equal((await userBriefView(u.id)).name, 'Thành viên đã xóa');
    });
  });

  describe('xóa tài khoản = ẩn danh hóa', () => {
    it('giữ bài viết/bình luận/điểm/thanh toán, hiển thị "Thành viên đã xóa", chặn login/refresh, hồ sơ 404, giải phóng email', async () => {
      const db = (await useTestDb()).prisma;
      const u = await registerUser('anon');
      const viewer = await registerUser('anonview');
      await call('PATCH', '/auth/me', { token: u.token, body: { bio: 'tiểu sử', website: 'https://example.com' } });
      for (const t of [u.token, viewer.token]) await call('POST', '/courses/photo/enroll', { token: t });
      const post = (await call('POST', '/courses/photo/posts', { token: u.token, body: { content: 'Bài của người sẽ xóa' } })).body.data;
      const cm = (await call('POST', `/posts/${post.id}/comments`, { token: u.token, body: { content: 'bình luận cũ' } })).body.data;
      await db.pointEvent.create({ data: { userId: u.id, communityId: 'photo', points: 5, reason: 'post' } });
      await db.notification.create({ data: { userId: u.id, type: 'system', title: 't', body: 'b' } });
      const pointsBefore = await db.pointEvent.count({ where: { userId: u.id } });
      const login = await call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      const refreshCookie = (login.headers.getSetCookie()[0] ?? '').split(';')[0];

      assert.equal((await call('DELETE', '/auth/me', { token: u.token, body: { password: u.password } })).status, 204);

      const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.equal(row.email, `deleted-${u.id}@deleted.invalid`);
      assert.equal(row.firstName, 'Thành viên');
      assert.equal(row.lastName, 'đã xóa');
      assert.equal(row.bio, null);
      assert.equal(row.website, null);
      assert.ok(row.deletedAt);
      assert.equal(await db.enrollment.count({ where: { userId: u.id } }), 0);
      assert.equal(await db.notification.count({ where: { userId: u.id } }), 0);
      assert.equal(await db.session.count({ where: { userId: u.id, revokedAt: null } }), 0);
      // Nội dung + điểm được giữ; bài hiển thị tên "Thành viên đã xóa".
      assert.equal(await db.pointEvent.count({ where: { userId: u.id } }), pointsBefore);
      assert.ok(pointsBefore >= 1);
      const got = await call('GET', `/posts/${post.id}`, { token: viewer.token });
      assert.equal(got.body.data.author.name, 'Thành viên đã xóa');
      const comments = await call('GET', `/posts/${post.id}/comments`, { token: viewer.token });
      assert.equal(comments.body.data.find((x: any) => x.id === cm.id).author.name, 'Thành viên đã xóa');
      // Không vào lại được bằng bất kỳ đường nào; hồ sơ công khai 404.
      assert.equal((await call('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 401);
      assert.equal((await call('POST', '/auth/refresh', { headers: { Cookie: refreshCookie } })).status, 401);
      assert.equal((await call('GET', `/users/${u.id}`, { token: viewer.token })).status, 404);
      // Email cũ dùng đăng ký lại được (tài khoản mới, không dính dữ liệu cũ).
      const again = await registerVerified({ email: u.email, password: u.password, firstName: 'Mới', lastName: 'Toanh' });
      assert.ok(again.status < 300);
      assert.notEqual(again.body.data.user.id, u.id);
    });
  });

  it('GET /dev/outbox tồn tại khi không phải production', async () => {
    assert.equal((await call('GET', '/dev/outbox')).status, 200);
  });
});
