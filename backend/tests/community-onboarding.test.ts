import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

/** "Bắt đầu hành trình của bạn": video giới thiệu (có khi cộng đồng có video) + bình luận (tính từ dữ liệu thật) + tải app. */
describe('cộng đồng: thẻ onboarding "Bắt đầu hành trình của bạn"', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let a: { token: string; id: string };
  let stranger: { token: string; id: string };

  const get = async (token: string, id = 'photo') => c.call('GET', `/communities/${id}/onboarding`, { token });
  const mark = (token: string, step: string, id = 'photo') => c.call('POST', `/communities/${id}/onboarding/${step}`, { token });

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    a = await c.registerUser('onba');
    stranger = await c.registerUser('onbs');
    await enrollmentService.grant(a.id, 'photo');
    await db.prisma.community.update({ where: { id: 'photo' }, data: { introVideoUrl: null } });
  });
  after(() => server.close());

  it('chỉ thành viên xem được; không có video giới thiệu thì chỉ còn 2 bước (comment, app)', async () => {
    assert.equal((await get(stranger.token)).status, 403);
    assert.equal((await c.call('GET', '/communities/photo/onboarding')).status, 401);
    const r = await get(a.token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.data.steps, [{ key: 'comment', done: false }, { key: 'app', done: false }]);
    assert.equal(r.body.data.total, 2);
    assert.equal(r.body.data.done, 0);
    assert.equal(r.body.data.completed, false);
    // Bước video không đánh dấu được khi cộng đồng không có video.
    assert.equal((await mark(a.token, 'video')).status, 400);
  });

  it('bước app đánh dấu tay (idempotent); bước comment KHÔNG đánh dấu tay được, chỉ tính từ bình luận thật', async () => {
    assert.equal((await mark(a.token, 'comment')).status, 400);
    assert.equal((await mark(a.token, 'khac')).status, 400);
    assert.equal((await mark(stranger.token, 'app')).status, 403);
    const m1 = await mark(a.token, 'app');
    assert.equal(m1.status, 200, JSON.stringify(m1.body));
    assert.deepEqual(m1.body.data.steps.find((s: { key: string }) => s.key === 'app'), { key: 'app', done: true });
    const first = (await db.prisma.communityOnboarding.findUniqueOrThrow({ where: { userId_communityId: { userId: a.id, communityId: 'photo' } } })).appAt;
    assert.equal((await mark(a.token, 'app')).status, 200);
    assert.deepEqual((await db.prisma.communityOnboarding.findUniqueOrThrow({ where: { userId_communityId: { userId: a.id, communityId: 'photo' } } })).appAt, first);

    // Bình luận thật vào một bài của cộng đồng ⇒ bước comment xong ⇒ hoàn tất.
    const post = await c.call('POST', '/communities/photo/posts', { token: a.token, body: { content: 'bài đầu tiên của mình', category: 'Thảo luận chung' } });
    assert.equal(post.status, 201, JSON.stringify(post.body));
    assert.equal((await get(a.token)).body.data.done, 1);
    const cm = await c.call('POST', `/posts/${post.body.data.id}/comments`, { token: a.token, body: { content: 'xin chào' } });
    assert.ok(cm.status < 300, JSON.stringify(cm.body));
    const done = (await get(a.token)).body.data;
    assert.equal(done.done, 2);
    assert.equal(done.completed, true);
  });

  it('cộng đồng có video giới thiệu: thêm bước video (3 bước), đánh dấu xong; tiến độ riêng từng người', async () => {
    await db.prisma.community.update({ where: { id: 'photo' }, data: { introVideoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' } });
    const before1 = (await get(a.token)).body.data;
    assert.equal(before1.total, 3);
    assert.deepEqual(before1.steps.map((s: { key: string }) => s.key), ['video', 'comment', 'app']);
    assert.equal(before1.videoUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
    assert.equal(before1.completed, false); // video chưa xem
    const m = await mark(a.token, 'video');
    assert.equal(m.status, 200, JSON.stringify(m.body));
    assert.equal(m.body.data.completed, true);
    assert.equal(m.body.data.done, 3);

    // Người khác trong cùng cộng đồng bắt đầu từ 0.
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    const b = await c.registerUser('onbb');
    await enrollmentService.grant(b.id, 'photo');
    const rb = (await get(b.token)).body.data;
    assert.equal(rb.done, 0);
    assert.equal(rb.total, 3);
  });
});
