import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

/** Hồi quy lỗi phân quyền: ghim bài / tạo sự kiện phải chỉ dành cho mod trở lên (PLAN.md Phase 2, policy.ts). */
describe('phân quyền cộng đồng', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const COURSE = 'photo';

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  it('member thường KHÔNG được ghim bài và KHÔNG được tạo sự kiện (403)', async () => {
    const u = await c.registerUser('member');
    assert.equal((await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token })).status, 200);

    // DB test không còn bài viết minh họa sinh lười: tự tạo bài để có cái mà ghim.
    const created = await c.call('POST', `/courses/${COURSE}/posts`, { token: u.token, body: { content: 'Bài để thử ghim' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const postId = created.body.data.id as string;

    const pin = await c.call('POST', `/posts/${postId}/pin`, { token: u.token });
    assert.equal(pin.status, 403);

    const ev = await c.call('POST', `/courses/${COURSE}/events`, {
      token: u.token,
      body: { title: 'Sự kiện thử', startAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    assert.equal(ev.status, 403);
  });

  it('khách chưa đăng nhập bị 401', async () => {
    assert.equal((await c.call('POST', `/posts/x/pin`)).status, 401);
  });

  it('chi tiết khóa học trả viewerRole cho người đã tham gia', async () => {
    const u = await c.registerUser('role');
    await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token });
    const d = await c.call('GET', `/courses/${COURSE}`, { token: u.token });
    assert.equal(d.body.data.viewerRole, 'member');
    const guest = await c.call('GET', `/courses/${COURSE}`);
    assert.equal(guest.body.data.viewerRole, null);
  });
});
