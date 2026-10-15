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
    return r.body.data as { welcome: { message: string; sender: { id: string | null; name: string } } | null; announcements: { id: string; title: string; link: string | null }[] };
  };
  const titles = async (u: U, id: string) => (await pending(u, id)).announcements.map((a) => a.title);
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
    assert.deepEqual(await pending(outsider, id), { welcome: null, announcements: [] });
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

  it('thông báo = bài "Thông báo" đang ghim: nhiều thông báo => slide cũ -> mới; mỗi thông báo 1 lần; chỉ thông báo sau khi tham gia; chỉ trong cộng đồng đó', async () => {
    const id = await community();
    const other = await community();
    const m = await c.registerUser('grann');
    await join(m, id);
    await join(m, other);

    assert.equal((await api(m, 'POST', id, '/announcements', { title: 'x', body: 'y' })).status, 403, 'thành viên thường không đăng được');
    assert.equal((await api(admin, 'POST', id, '/announcements', { title: 'Lịch live', body: 'Tối nay 20:00', link: 'javascript:alert(1)' })).status, 400);
    assert.equal((await api(admin, 'POST', id, '/announcements', { title: 'Cũ', body: 'cũ' })).status, 201);
    const r = await api(owner, 'POST', id, '/announcements', { title: 'Lịch live', body: 'Tối nay 20:00' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const list = r.body.data.announcements as { id: string; title: string; active: boolean; postLink: string }[];
    assert.deepEqual(list.map((a) => [a.title, a.active]), [['Lịch live', true], ['Cũ', true]], 'nhiều thông báo cùng hiện');

    // Đăng thông báo = bài mục "Thông báo" đã ghim trên Bảng tin.
    const posts = await db.prisma.post.findMany({ where: { communityId: id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(posts.map((p) => [p.content, p.category, p.pinned]), [['Cũ\n\ncũ', 'announcement', true], ['Lịch live\n\nTối nay 20:00', 'announcement', true]]);

    const p = await pending(m, id);
    assert.deepEqual(p.announcements.map((a) => a.title), ['Cũ', 'Lịch live'], 'slide từ cũ tới mới');
    assert.equal(p.announcements[1]!.link, `/communities/${id}/community?post=${posts[1]!.id}`, 'không có link riêng => mở bài trên Bảng tin');
    assert.deepEqual(await titles(m, other), [], 'không hiện ở cộng đồng khác');
    assert.deepEqual(await titles(owner, id), ['Cũ'], 'người đăng không thấy popup của chính mình');
    assert.equal((await api(m, 'POST', other, `/announcements/${p.announcements[0]!.id}/seen`)).status, 404, 'id thuộc cộng đồng khác');
    assert.equal((await api(m, 'POST', id, `/announcements/${p.announcements[0]!.id}/seen`)).status, 200);
    assert.deepEqual(await titles(m, id), ['Lịch live'], 'xem slide nào thì slide đó không hiện lại');

    // Thành viên mới: không bị dồn thông báo cũ; chỉ thấy thông báo đăng/ghim SAU khi tham gia.
    const m2 = await c.registerUser('grann2');
    await join(m2, id);
    assert.deepEqual(await titles(m2, id), []);
    await new Promise((res) => setTimeout(res, 5));
    // Ghim bài "Thông báo" ngay trên Bảng tin cũng thành popup; bỏ ghim => thôi hiện.
    const feedPost = await db.prisma.post.create({ data: { communityId: id, authorId: admin.id, content: 'Đổi giờ học\nTừ tuần sau học lúc 21:00', category: 'announcement' } });
    assert.equal((await c.call('POST', `/posts/${feedPost.id}/pin`, { token: owner.token })).status, 200);
    assert.deepEqual(await titles(m2, id), ['Đổi giờ học']);
    assert.deepEqual(await titles(m, id), ['Lịch live', 'Đổi giờ học']);
    assert.equal((await c.call('POST', `/posts/${feedPost.id}/pin`, { token: owner.token })).status, 200);
    assert.deepEqual(await titles(m2, id), [], 'bỏ ghim => thôi hiện');
    // Ghim bài thường (không phải mục Thông báo) => không popup.
    const normal = await db.prisma.post.create({ data: { communityId: id, authorId: admin.id, content: 'Thảo luận', category: 'general' } });
    await c.call('POST', `/posts/${normal.id}/pin`, { token: owner.token });
    assert.deepEqual(await titles(m2, id), []);

    // Gỡ trong Cài đặt = bỏ ghim bài trên Bảng tin.
    const live = p.announcements[1]!;
    const off = await api(owner, 'PATCH', id, `/announcements/${live.id}`, { active: false });
    assert.equal(off.status, 200);
    assert.equal((await db.prisma.post.findUniqueOrThrow({ where: { id: posts[1]!.id } })).pinned, false);
    assert.deepEqual(await titles(m, id), [], 'gỡ => không hiện');
    const s = await api(admin, 'GET', id, '/settings');
    assert.equal(s.body.data.announcements.find((a: { title: string }) => a.title === 'Cũ').seenCount, 1);
  });

  it('tối đa 5 bài ghim / cộng đồng: ghim thứ 6 hoặc đăng thông báo khi đã đủ => 409 PIN_LIMIT; bỏ ghim bớt rồi ghim được; Quản lý ghim (mod trở lên)', async () => {
    const id = await community();
    const m = await c.registerUser('grpin');
    await join(m, id);
    const mk = (content: string, category: 'general' | 'announcement' = 'general') => db.prisma.post.create({ data: { communityId: id, authorId: owner.id, content, category } });
    const pin = (postId: string) => c.call('POST', `/posts/${postId}/pin`, { token: owner.token });
    const posts = [];
    for (let i = 1; i <= 6; i++) posts.push(await mk(`Bài ${i}`, i === 1 ? 'announcement' : 'general'));
    for (const p of posts.slice(0, 5)) assert.equal((await pin(p.id)).status, 200);

    const sixth = await pin(posts[5]!.id);
    assert.equal(sixth.status, 409);
    assert.equal(sixth.body.error.code, 'PIN_LIMIT');
    assert.equal(sixth.body.error.details.limit, 5);
    assert.equal((await db.prisma.post.findUniqueOrThrow({ where: { id: posts[5]!.id } })).pinned, false);

    const before = await db.prisma.post.count({ where: { communityId: id } });
    const ann = await api(owner, 'POST', id, '/announcements', { title: 'Mới', body: 'x' });
    assert.equal(ann.status, 409);
    assert.equal(ann.body.error.code, 'PIN_LIMIT');
    assert.equal(await db.prisma.post.count({ where: { communityId: id } }), before, 'không để lại bài lẻ');

    const list = await c.call('GET', `/communities/${id}/pins`, { token: owner.token });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.limit, 5);
    assert.deepEqual(list.body.data.pins.map((p: { title: string; popup: boolean }) => [p.title, p.popup]).sort(), [['Bài 1', true], ['Bài 2', false], ['Bài 3', false], ['Bài 4', false], ['Bài 5', false]]);
    assert.equal((await c.call('GET', `/communities/${id}/pins`, { token: m.token })).status, 403, 'thành viên thường không quản lý ghim');

    // Bỏ ghim 1 bài (toggle) => ghim bài mới / đăng thông báo được.
    assert.equal((await pin(posts[1]!.id)).status, 200);
    assert.equal((await pin(posts[5]!.id)).status, 200);
    assert.equal((await pin(posts[2]!.id)).status, 200);
    assert.equal((await api(owner, 'POST', id, '/announcements', { title: 'Mới', body: 'x' })).status, 201);
    assert.equal(await db.prisma.post.count({ where: { communityId: id, pinned: true } }), 5);

    // Ghim lại thông báo trong Cài đặt cũng tính giới hạn.
    const first = (await api(owner, 'GET', id, '/settings')).body.data.announcements.find((a: { title: string }) => a.title === 'Bài 1');
    assert.equal((await pin(posts[0]!.id)).status, 200, 'bỏ ghim Bài 1 => còn 4');
    assert.equal((await api(owner, 'PATCH', id, `/announcements/${first.id}`, { active: true })).status, 200, 'ghim lại => 5');
    const again = await pin(posts[1]!.id);
    assert.equal(again.body.error?.code, 'PIN_LIMIT', 'đủ 5 => không ghim thêm');
  });
});
