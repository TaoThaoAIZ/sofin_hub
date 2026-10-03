import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('Cài đặt > Cộng đồng của tôi', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  const make = async (owner: { token: string }, title: string, over: Record<string, unknown> = {}) => {
    const r = await c.call('POST', '/communities', { token: owner.token, body: { title, description: 'm', category: 'tech', priceUsd: 0, visibility: 'public', ...over } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data.id as string;
  };
  const join = (u: { token: string }, id: string) => c.call('POST', `/courses/${id}/enroll`, { token: u.token });
  const list = async (u: { token: string }) => (await c.call('GET', '/me/communities', { token: u.token })).body.data as any[];

  it('401 thiếu token ở mọi endpoint', async () => {
    for (const [m, p] of [
      ['GET', '/me/communities'],
      ['PUT', '/me/communities/order'],
      ['PATCH', '/me/communities/photo'],
      ['DELETE', '/me/communities/photo'],
      ['GET', '/me/join-requests'],
    ] as const) {
      assert.equal((await c.call(m, p)).status, 401, `${m} ${p}`);
    }
  });

  it('liệt kê: vai trò, số thành viên, cấp độ, mặc định hiện thanh bên, owner có dòng hosting', async () => {
    const o = await c.registerUser('mcown');
    const m = await c.registerUser('mcmem');
    const id = await make(o, 'Nhóm Của Tôi A', { visibility: 'private' });
    assert.equal((await c.call('POST', `/courses/${id}/join-requests`, { token: m.token, body: { message: 'xin vào' } })).status, 201);
    const mine = await list(o);
    const row = mine.find((x) => x.id === id);
    assert.equal(row.role, 'owner');
    assert.equal(row.memberCount, 1);
    assert.equal(row.visibility, 'private');
    assert.equal(row.free, true);
    assert.equal(row.sidebarVisible, true);
    assert.equal(row.pinned, false);
    assert.equal(row.sortOrder, null);
    assert.ok(row.level >= 1);
    assert.ok('subscription' in row && 'hosting' in row);
    assert.ok(row.enrolledAt);
  });

  it('PATCH: ẩn thanh bên + ghim; 404 khi chưa tham gia; 400 body rỗng/lạ', async () => {
    const u = await c.registerUser('mcpatch');
    await join(u, 'photo');
    assert.equal((await c.call('PATCH', '/me/communities/photo', { token: u.token, body: {} })).status, 400);
    assert.equal((await c.call('PATCH', '/me/communities/photo', { token: u.token, body: { pinned: 'x' } })).status, 400);
    assert.equal((await c.call('PATCH', '/me/communities/photo', { token: u.token, body: { role: 'owner' } })).status, 400);
    assert.equal((await c.call('PATCH', '/me/communities/cooking', { token: u.token, body: { pinned: true } })).status, 404);
    const r = await c.call('PATCH', '/me/communities/photo', { token: u.token, body: { sidebarVisible: false, pinned: true } });
    assert.equal(r.status, 200);
    const row = (await list(u)).find((x) => x.id === 'photo');
    assert.equal(row.sidebarVisible, false);
    assert.equal(row.pinned, true);
    // Không ảnh hưởng người khác.
    const other = await c.registerUser('mcother');
    await join(other, 'photo');
    assert.equal((await list(other)).find((x) => x.id === 'photo').pinned, false);
  });

  it('order: lưu thứ tự kéo thả, ghim luôn đứng đầu, 400 khi id lạ/trùng/rỗng', async () => {
    const u = await c.registerUser('mcorder');
    const o = await c.registerUser('mcordero');
    const g1 = await make(o, 'Nhóm Thứ Tự Gamma');
    const g2 = await make(o, 'Nhóm Thứ Tự Delta');
    const ids = ['photo', g1, g2];
    for (const id of ids) {
      const r = await join(u, id);
      if (r.status !== 200) return assert.fail(`không tham gia được ${id}: ${JSON.stringify(r.body)}`);
    }
    assert.equal((await c.call('PUT', '/me/communities/order', { token: u.token, body: { ids: [] } })).status, 400);
    assert.equal((await c.call('PUT', '/me/communities/order', { token: u.token, body: { ids: ['photo', 'photo'] } })).status, 400);
    assert.equal((await c.call('PUT', '/me/communities/order', { token: u.token, body: { ids: ['photo', 'khong-co'] } })).status, 400);

    const r = await c.call('PUT', '/me/communities/order', { token: u.token, body: { ids: [g2, 'photo', g1] } });
    assert.equal(r.status, 200);
    assert.deepEqual((await list(u)).map((x) => x.id), [g2, 'photo', g1]);
    // Chỉ gửi một phần: phần còn lại xếp sau, giữ thứ tự cũ.
    await c.call('PUT', '/me/communities/order', { token: u.token, body: { ids: [g1] } });
    assert.deepEqual((await list(u)).map((x) => x.id), [g1, g2, 'photo']);
    // Ghim lên đầu bất kể sortOrder.
    await c.call('PATCH', '/me/communities/photo', { token: u.token, body: { pinned: true } });
    assert.deepEqual((await list(u)).map((x) => x.id), ['photo', g1, g2]);
    await c.call('PATCH', '/me/communities/photo', { token: u.token, body: { pinned: false } });
    assert.deepEqual((await list(u)).map((x) => x.id), [g1, g2, 'photo']);
  });

  it('rời cộng đồng: thành viên rời được (404 lần 2), owner bị chặn 409', async () => {
    const o = await c.registerUser('mcleaveo');
    const id = await make(o, 'Nhóm Rời Thử');
    const m = await c.registerUser('mcleavem');
    await join(m, id);
    assert.equal((await list(m)).some((x) => x.id === id), true);
    const left = await c.call('DELETE', `/me/communities/${id}`, { token: m.token });
    assert.equal(left.status, 200);
    assert.equal(left.body.data.left, true);
    assert.equal((await list(m)).some((x) => x.id === id), false);
    assert.equal((await c.call('DELETE', `/me/communities/${id}`, { token: m.token })).status, 404);
    assert.equal((await c.call('DELETE', `/me/communities/${id}`, { token: o.token })).status, 409);
    assert.equal((await list(o)).some((x) => x.id === id), true);
  });

  it('đang chờ: yêu cầu gia nhập do mình gửi, hủy qua DELETE /join-requests/:id; người khác không thấy', async () => {
    const o = await c.registerUser('mcpendo');
    const id = await make(o, 'Nhóm Riêng Chờ', { visibility: 'private' });
    const u = await c.registerUser('mcpendu');
    const other = await c.registerUser('mcpendx');
    assert.deepEqual((await c.call('GET', '/me/join-requests', { token: u.token })).body.data, { requests: [], invites: [] });
    const created = await c.call('POST', `/courses/${id}/join-requests`, { token: u.token, body: { message: 'cho em vào' } });
    assert.equal(created.status, 201);

    const pend = (await c.call('GET', '/me/join-requests', { token: u.token })).body.data;
    assert.equal(pend.requests.length, 1);
    assert.equal(pend.requests[0].communityId, id);
    assert.equal(pend.requests[0].title, 'Nhóm Riêng Chờ');
    assert.equal(pend.requests[0].id, created.body.data.id);
    assert.deepEqual((await c.call('GET', '/me/join-requests', { token: other.token })).body.data.requests, []);

    assert.equal((await c.call('DELETE', `/join-requests/${pend.requests[0].id}`, { token: other.token })).status, 404);
    assert.equal((await c.call('DELETE', `/join-requests/${pend.requests[0].id}`, { token: u.token })).status, 200);
    assert.deepEqual((await c.call('GET', '/me/join-requests', { token: u.token })).body.data.requests, []);
  });

  it('người bị cấm không còn thấy / sửa được cộng đồng đó', async () => {
    const o = await c.registerUser('mcbano');
    const id = await make(o, 'Nhóm Cấm Thử');
    const m = await c.registerUser('mcbanm');
    await join(m, id);
    assert.equal((await c.call('POST', `/courses/${id}/members/${m.id}/ban`, { token: o.token, body: { reason: 'thử' } })).status, 200);
    assert.equal((await list(m)).some((x) => x.id === id), false);
    assert.equal((await c.call('PATCH', `/me/communities/${id}`, { token: m.token, body: { pinned: true } })).status, 404);
  });
});
