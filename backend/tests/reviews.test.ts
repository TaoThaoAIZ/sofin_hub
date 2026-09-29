import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('đánh giá cộng đồng', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  async function setup() {
    const owner = await c.registerUser('o');
    const r = await c.call('POST', '/communities', {
      token: owner.token,
      body: { title: 'Nhóm đánh giá', description: 'Mô tả', category: 'hobby', priceUsd: 0, visibility: 'public' },
    });
    return { owner, id: r.body.data.id as string };
  }

  it('chỉ thành viên được đánh giá; 401/403/400; 1 review/user (gọi lại thì cập nhật)', async () => {
    const { owner, id } = await setup();
    const outsider = await c.registerUser('out');
    assert.equal((await c.call('POST', `/courses/${id}/reviews`, { body: { rating: 5 } })).status, 401);
    assert.equal((await c.call('POST', `/courses/${id}/reviews`, { token: outsider.token, body: { rating: 5 } })).status, 403);
    assert.equal((await c.call('POST', `/courses/${id}/reviews`, { token: owner.token, body: { rating: 6 } })).status, 400);
    assert.equal((await c.call('POST', `/courses/${id}/reviews`, { token: owner.token, body: { rating: 0 } })).status, 400);
    assert.equal((await c.call('POST', `/courses/${id}/reviews`, { token: owner.token, body: { rating: 4, text: 'a'.repeat(1001) } })).status, 400);
    assert.equal((await c.call('POST', `/courses/nope/reviews`, { token: owner.token, body: { rating: 4 } })).status, 404);

    const first = await c.call('POST', `/courses/${id}/reviews`, { token: owner.token, body: { rating: 4, text: 'Tốt' } });
    assert.equal(first.status, 201);
    const again = await c.call('POST', `/courses/${id}/reviews`, { token: owner.token, body: { rating: 2, text: 'Tạm' } });
    assert.equal(again.status, 200);
    const list = await c.call('GET', `/courses/${id}/reviews`); // công khai
    assert.equal(list.body.meta.total, 1);
    assert.equal(list.body.data[0].rating, 2);
    assert.equal(list.body.data[0].id, first.body.data.id);
  });

  it('cập nhật rating & ratingCount trung bình thật; xóa của mình thì tính lại', async () => {
    const { owner, id } = await setup();
    const u2 = await c.registerUser('u2');
    await c.call('POST', `/courses/${id}/enroll`, { token: u2.token });
    await c.call('POST', `/courses/${id}/reviews`, { token: owner.token, body: { rating: 5 } });
    await c.call('POST', `/courses/${id}/reviews`, { token: u2.token, body: { rating: 2, text: 'Ổn' } });
    let d = (await c.call('GET', `/courses/${id}`)).body.data;
    assert.equal(d.ratingCount, 2);
    assert.equal(d.rating, 3.5);

    assert.equal((await c.call('DELETE', `/courses/${id}/reviews/mine`, { token: u2.token })).status, 200);
    assert.equal((await c.call('DELETE', `/courses/${id}/reviews/mine`, { token: u2.token })).status, 404);
    d = (await c.call('GET', `/courses/${id}`)).body.data;
    assert.equal(d.ratingCount, 1);
    assert.equal(d.rating, 5);
  });

  it('chi tiết khóa học: review thật lên đầu, vẫn còn review minh họa', async () => {
    const { owner, id } = await setup();
    await c.call('POST', `/courses/${id}/reviews`, { token: owner.token, body: { rating: 5, text: 'Review thật của tôi' } });
    const d = (await c.call('GET', `/courses/${id}`)).body.data;
    assert.equal(d.reviews[0].text, 'Review thật của tôi');
    assert.equal(d.reviews[0].rating, 5);
    assert.ok(d.reviews.length > 1);
  });

  it('mod+ xóa được review người khác, member thường thì không', async () => {
    const { owner, id } = await setup();
    const m1 = await c.registerUser('m1');
    const m2 = await c.registerUser('m2');
    const mod = await c.registerUser('mod');
    for (const u of [m1, m2, mod]) await c.call('POST', `/courses/${id}/enroll`, { token: u.token });
    await c.call('PATCH', `/courses/${id}/members/${mod.id}/role`, { token: owner.token, body: { role: 'mod' } });

    const rv = await c.call('POST', `/courses/${id}/reviews`, { token: m1.token, body: { rating: 1, text: 'spam' } });
    const rid = rv.body.data.id as string;
    assert.equal((await c.call('DELETE', `/reviews/${rid}`)).status, 401);
    assert.equal((await c.call('DELETE', `/reviews/${rid}`, { token: m2.token })).status, 403);
    assert.equal((await c.call('DELETE', `/reviews/nope`, { token: mod.token })).status, 404);
    assert.equal((await c.call('DELETE', `/reviews/${rid}`, { token: mod.token })).status, 200);
    assert.equal((await c.call('GET', `/courses/${id}/reviews`)).body.meta.total, 0);
    assert.equal((await c.call('GET', `/courses/${id}`)).body.data.ratingCount, 0);
  });

  it('phân trang danh sách review', async () => {
    const { id } = await setup();
    for (let i = 0; i < 3; i++) {
      const u = await c.registerUser(`p${i}`);
      await c.call('POST', `/courses/${id}/enroll`, { token: u.token });
      await c.call('POST', `/courses/${id}/reviews`, { token: u.token, body: { rating: 3 } });
    }
    const p1 = await c.call('GET', `/courses/${id}/reviews?limit=2&page=1`);
    const p2 = await c.call('GET', `/courses/${id}/reviews?limit=2&page=2`);
    assert.equal(p1.body.data.length, 2);
    assert.equal(p2.body.data.length, 1);
    assert.equal(p1.body.meta.totalPages, 2);
    assert.equal((await c.call('GET', `/courses/${id}/reviews?limit=0`)).status, 400);
  });
});
