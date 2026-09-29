import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

/** Hồi quy các lỗi tìm thấy khi rà soát QA: URL nguy hiểm, avatar upload, link thông báo. */
describe('cứng hóa đầu vào & link', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const COURSE = 'photo';

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  it('bài viết từ chối imageUrl javascript:/data: (400) nhưng nhận https', async () => {
    const u = await c.registerUser('img');
    await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token });
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
      const r = await c.call('POST', `/courses/${COURSE}/posts`, { token: u.token, body: { content: 'x', imageUrl: bad } });
      assert.equal(r.status, 400, bad);
    }
    const ok = await c.call('POST', `/courses/${COURSE}/posts`, { token: u.token, body: { content: 'x', imageUrl: 'https://example.com/a.png' } });
    assert.equal(ok.status, 201);
  });

  it('sự kiện từ chối meetingLink javascript: (400)', async () => {
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    const u = await c.registerUser('evt');
    await enrollmentService.grant(u.id, COURSE, 'mod');
    const startAt = new Date(Date.now() + 86_400_000).toISOString();
    const bad = await c.call('POST', `/courses/${COURSE}/events`, { token: u.token, body: { title: 'E', startAt, meetingLink: 'javascript:alert(1)' } });
    assert.equal(bad.status, 400);
    const ok = await c.call('POST', `/courses/${COURSE}/events`, { token: u.token, body: { title: 'E', startAt, meetingLink: 'https://meet.example.com/x' } });
    assert.equal(ok.status, 201);
  });

  it('avatarUrl nhận đường dẫn /api/files/... do upload trả về, vẫn chặn ../ và javascript:', async () => {
    const u = await c.registerUser('ava');
    const ok = await c.call('PATCH', '/auth/me', { token: u.token, body: { avatarUrl: '/api/files/abc123.png' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    for (const bad of ['/api/files/../etc/passwd', 'javascript:alert(1)']) {
      const r = await c.call('PATCH', '/auth/me', { token: u.token, body: { avatarUrl: bad } });
      assert.equal(r.status, 400, bad);
    }
  });

  it('JSON sai cú pháp trả 400 (không phải 500) và /health báo ok khi DB sống', async () => {
    const res = await fetch(`${server.baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'BAD_REQUEST');
    const health = await fetch(server.baseUrl.replace('/api', '/health'));
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
  });

  it('giới hạn đăng nhập chỉ đếm lần THẤT BẠI: 12 lần đăng nhập đúng liên tiếp vẫn 200', async () => {
    const u = await c.registerUser('rl');
    for (let i = 0; i < 12; i++) {
      const r = await c.call('POST', '/auth/login', { body: { email: u.email, password: u.password } });
      assert.equal(r.status, 200, `lần ${i + 1}`);
    }
  });
});
