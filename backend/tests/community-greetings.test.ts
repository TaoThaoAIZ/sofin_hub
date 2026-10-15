import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

type U = { token: string; id: string; email: string };

/** Lời chào thành viên mới + thông báo popup của chủ cộng đồng (docs/features/community-greetings.md). */
describe('lời chào + thông báo cộng đồng', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let seq = 0;
  let owner: U;
  let admin: U;

  const api = (u: U, method: string, id: string, path: string, body?: unknown) => c.call(method, `/communities/${id}/greetings${path}`, { token: u.token, body });
  const pending = async (u: U, id: string) => {
    const r = await api(u, 'GET', id, '/pending');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data as { welcome: { message: string; sender: { id: string | null; name: string } } | null; announcement: { id: string; title: string } | null };
  };
  const join = async (u: U, id: string) => assert.equal((await c.call('POST', `/courses/${id}/enroll`, { token: u.token })).status < 300, true);
  const leave = async (u: U, id: string) => assert.equal((await c.call('DELETE', `/me/communities/${id}`, { token: u.token })).status, 200);

  async function community() {
    const id = `gr-${Date.now().toString(36)}${seq++}`;
    await db.prisma.community.create({
      data: { id, title: `Cộng đồng ${id}`, description: 'x', category: 'tech' as never, thumbnail: '/x.webp', instructorName: 'Thầy A', instructorRole: 'GV', priceCents: 0, pricing: 'free', ownerId: owner.id },
    });
    await db.prisma.enrollment.create({ data: { userId: owner.id, communityId: id, role: 'owner' } });
    await db.prisma.enrollment.create({ data: { userId: admin.id, communityId: id, role: 'admin' } });
    return id;
  }

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    owner = await c.registerUser('growner');
    admin = await c.registerUser('gradmin');
  });
  after(() => server.close());

  it('lời chào: chỉ thành viên tham gia SAU khi bật thấy, đúng 1 lần; rời rồi tham gia lại không hiện nữa; biến {ten}/{cong_dong}', async () => {
    const id = await community();
    const old = await c.registerUser('grold');
    await join(old, id); // tham gia trước khi bật => không phải "thành viên mới"

    assert.equal((await api(owner, 'PUT', id, '/welcome', { enabled: true, message: '' })).status, 400, 'bật mà chưa có nội dung');
    const r = await api(owner, 'PUT', id, '/welcome', { enabled: true, message: 'Chào {ten}, mừng bạn tới {cong_dong}!' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await pending(old, id)).welcome, null, 'thành viên cũ không thấy');

    const u = await c.registerUser('grnew');
    await join(u, id);
    const p1 = await pending(u, id);
    const me = await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    assert.equal(p1.welcome?.message, `Chào ${me.firstName}, mừng bạn tới Cộng đồng ${id}!`);
    assert.equal(p1.welcome?.sender.id, owner.id, 'gửi dưới tên chủ cộng đồng');
    assert.equal((await api(u, 'POST', id, '/welcome/seen')).status, 200);
    assert.equal((await pending(u, id)).welcome, null, 'đã hiện 1 lần => không hiện nữa');

    await leave(u, id);
    await join(u, id);
    assert.equal((await pending(u, id)).welcome, null, 'rời rồi tham gia lại => không hiện');

    // Chủ/admin không thấy lời chào của chính cộng đồng mình; người ngoài không có gì.
    assert.equal((await pending(owner, id)).welcome, null);
    const outsider = await c.registerUser('grout');
    assert.deepEqual(await pending(outsider, id), { welcome: null, announcement: null });
    assert.equal((await api(outsider, 'POST', id, '/welcome/seen')).status, 403);
  });

  it('tắt rồi bật lại => chỉ người tham gia sau lần bật mới thấy', async () => {
    const id = await community();
    await api(owner, 'PUT', id, '/welcome', { enabled: true, message: 'Xin chào' });
    await api(owner, 'PUT', id, '/welcome', { enabled: false, message: 'Xin chào' });
    const mid = await c.registerUser('grmid');
    await join(mid, id);
    assert.equal((await pending(mid, id)).welcome, null, 'tham gia lúc đang tắt');
    await new Promise((r) => setTimeout(r, 5));
    await api(owner, 'PUT', id, '/welcome', { enabled: true, message: 'Xin chào' });
    assert.equal((await pending(mid, id)).welcome, null, 'bật lại không hiện cho người đã tham gia từ trước');
  });

  it('thông báo: chỉ bản mới nhất, mỗi người 1 lần, chỉ trong cộng đồng đó; gỡ => không hiện; chỉ admin trở lên đăng được', async () => {
    const id = await community();
    const other = await community();
    const m = await c.registerUser('grann');
    await join(m, id);
    await join(m, other);

    assert.equal((await api(m, 'POST', id, '/announcements', { title: 'x', body: 'y' })).status, 403, 'thành viên thường không đăng được');
    assert.equal((await api(admin, 'POST', id, '/announcements', { title: 'Lịch live', body: 'Tối nay 20:00', link: 'javascript:alert(1)' })).status, 400);
    assert.equal((await api(admin, 'POST', id, '/announcements', { title: 'Cũ', body: 'cũ' })).status, 201);
    const r = await api(owner, 'POST', id, '/announcements', { title: 'Lịch live', body: 'Tối nay 20:00', link: '/communities/x/community/lich' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const list = r.body.data.announcements as { id: string; title: string; active: boolean }[];
    assert.deepEqual(list.map((a) => [a.title, a.active]), [['Lịch live', true], ['Cũ', false]], 'đăng mới => bản cũ thôi hiện');

    const p = await pending(m, id);
    assert.equal(p.announcement?.title, 'Lịch live');
    assert.equal((await pending(m, other)).announcement, null, 'không hiện ở cộng đồng khác');
    assert.equal((await pending(owner, id)).announcement, null, 'người đăng không thấy popup của chính mình');
    assert.equal((await api(m, 'POST', other, `/announcements/${p.announcement!.id}/seen`)).status, 404, 'id thuộc cộng đồng khác');
    assert.equal((await api(m, 'POST', id, `/announcements/${p.announcement!.id}/seen`)).status, 200);
    assert.equal((await pending(m, id)).announcement, null, 'đã xem => không hiện lại');

    const m2 = await c.registerUser('grann2');
    await join(m2, id);
    assert.equal((await pending(m2, id)).announcement?.title, 'Lịch live', 'thành viên mới vẫn thấy thông báo đang hiện');
    const off = await api(owner, 'PATCH', id, `/announcements/${p.announcement!.id}`, { active: false });
    assert.equal(off.status, 200);
    assert.equal((await pending(m2, id)).announcement, null, 'gỡ => không hiện');
    const s = await api(admin, 'GET', id, '/settings');
    assert.equal(s.body.data.announcements[0].seenCount, 1);
  });
});
