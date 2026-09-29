import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('users: hồ sơ công khai, /me/enrollments, /me/points', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];
  let registerUser: ReturnType<typeof makeClient>['registerUser'];

  before(async () => {
    server = await startTestServer();
    ({ call, registerUser } = makeClient(server.baseUrl));
  });
  after(() => server.close());

  it('401 khi thiếu token', async () => {
    assert.equal((await call('GET', '/users/abc')).status, 401);
    assert.equal((await call('GET', '/me/enrollments')).status, 401);
    assert.equal((await call('GET', '/me/points')).status, 401);
  });

  it('GET /users/:id: 404 khi không tồn tại', async () => {
    const u = await registerUser('viewer');
    assert.equal((await call('GET', '/users/khong-co', { token: u.token })).status, 404);
  });

  it('hồ sơ công khai không lộ email, có cộng đồng công khai và điểm', async () => {
    const target = await registerUser('target');
    const viewer = await registerUser('viewer2');
    await call('PATCH', '/auth/me', { token: target.token, body: { bio: 'Yêu nhiếp ảnh', website: 'https://example.com' } });
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    const { pointsService } = await import('../src/modules/points/points.service.js');
    await enrollmentService.grant(target.id, 'photo');
    await pointsService.award(target.id, 'photo', 'post');

    const r = await call('GET', `/users/${target.id}`, { token: viewer.token });
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.equal(d.id, target.id);
    assert.equal(d.name, 'Test target');
    assert.equal(d.bio, 'Yêu nhiếp ảnh');
    assert.equal(d.website, 'https://example.com');
    assert.ok(d.joinedAt);
    assert.equal(d.totalPoints, 5);
    assert.equal(JSON.stringify(d).includes(target.email), false);
    assert.equal('email' in d, false);
    const c = d.communities.find((x: any) => x.course.id === 'photo');
    assert.ok(c, 'phải có cộng đồng photo');
    assert.equal(c.role, 'member');
  });

  it('/me/enrollments trả cộng đồng của tôi kèm progressPct', async () => {
    const u = await registerUser('enr');
    assert.deepEqual((await call('GET', '/me/enrollments', { token: u.token })).body.data, []);
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    await enrollmentService.grant(u.id, 'photo');
    const r = await call('GET', '/me/enrollments', { token: u.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 1);
    const item = r.body.data[0];
    assert.equal(item.course.id, 'photo');
    assert.equal(item.role, 'member');
    assert.ok(item.enrolledAt);
    assert.equal(item.progressPct, 0);
  });

  it('/me/points: theo cộng đồng + tổng + sự kiện gần nhất (tối đa 20)', async () => {
    const u = await registerUser('pts');
    const empty = await call('GET', '/me/points', { token: u.token });
    assert.deepEqual(empty.body.data, { total: 0, byCourse: [], recent: [] });

    const { pointsService } = await import('../src/modules/points/points.service.js');
    for (let i = 0; i < 22; i++) await pointsService.award(u.id, 'photo', 'post');
    await pointsService.award(u.id, 'photo', 'lesson_complete');

    const r = await call('GET', '/me/points', { token: u.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 22 * 5 + 3);
    assert.equal(r.body.data.byCourse.length, 1);
    assert.equal(r.body.data.byCourse[0].course.id, 'photo');
    assert.equal(r.body.data.byCourse[0].points, 22 * 5 + 3);
    assert.equal(r.body.data.recent.length, 20);
    assert.equal(r.body.data.recent[0].reason, 'lesson_complete');
  });
});
