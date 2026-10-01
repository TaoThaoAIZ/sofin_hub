import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('thông báo', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let notify: typeof import('../src/modules/notifications/notifications.service.js').notify;
  let flushNotifications: typeof import('../src/modules/notifications/notifications.service.js').flushNotifications;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ notify, flushNotifications } = await import('../src/modules/notifications/notifications.service.js'));
  });
  after(() => server.close());

  const push = (userId: string, type: any = 'system', title = 'Xin chào') => notify({ userId, type, title, body: 'nội dung' });

  it('401 khi thiếu token', async () => {
    assert.equal((await c.call('GET', '/notifications')).status, 401);
    assert.equal((await c.call('GET', '/notifications/unread-count')).status, 401);
    assert.equal((await c.call('GET', '/notifications/stream')).status, 401);
    assert.equal((await c.call('POST', '/notifications/stream-ticket')).status, 401);
  });

  it('liệt kê mới nhất trước, phân trang, lọc unread, đếm chưa đọc', async () => {
    const u = await c.registerUser('n1');
    for (let i = 1; i <= 5; i++) push(u.id, 'system', `T${i}`);
    const r = await c.call('GET', '/notifications?limit=2', { token: u.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.map((n: any) => n.title), ['T5', 'T4']);
    assert.equal(r.body.meta.total, 5);
    assert.equal(r.body.meta.totalPages, 3);

    const id = r.body.data[0].id;
    const read = await c.call('POST', `/notifications/${id}/read`, { token: u.token });
    assert.equal(read.status, 200);
    assert.ok(read.body.data.readAt);

    assert.equal((await c.call('GET', '/notifications/unread-count', { token: u.token })).body.data.count, 4);
    const unread = await c.call('GET', '/notifications?unread=true', { token: u.token });
    assert.equal(unread.body.meta.total, 4);

    const all = await c.call('POST', '/notifications/read-all', { token: u.token });
    assert.equal(all.body.data.updated, 4);
    assert.equal((await c.call('GET', '/notifications/unread-count', { token: u.token })).body.data.count, 0);
  });

  it('400 khi query sai', async () => {
    const u = await c.registerUser('n2');
    assert.equal((await c.call('GET', '/notifications?limit=999', { token: u.token })).status, 400);
    assert.equal((await c.call('GET', '/notifications?unread=maybe', { token: u.token })).status, 400);
  });

  it('người khác không đọc/xóa được thông báo của mình (404, không lộ tồn tại)', async () => {
    const a = await c.registerUser('owner');
    const b = await c.registerUser('other');
    const n = push(a.id);
    assert.equal((await c.call('POST', `/notifications/${n.id}/read`, { token: b.token })).status, 404);
    assert.equal((await c.call('DELETE', `/notifications/${n.id}`, { token: b.token })).status, 404);
    assert.equal((await c.call('GET', '/notifications', { token: b.token })).body.meta.total, 0);
    assert.equal((await c.call('DELETE', `/notifications/${n.id}`, { token: a.token })).status, 200);
    assert.equal((await c.call('DELETE', `/notifications/${n.id}`, { token: a.token })).status, 404);
  });

  it('preferences: mặc định bật hết, tắt loại thì notify không lưu, loại quan trọng luôn gửi', async () => {
    const u = await c.registerUser('pref');
    const def = await c.call('GET', '/notifications/preferences', { token: u.token });
    assert.equal(def.body.data.types.post_liked, true);
    assert.equal(def.body.data.emailDigest, 'off');

    const put = await c.call('PUT', '/notifications/preferences', { token: u.token, body: { types: { post_liked: false }, emailDigest: 'weekly' } });
    assert.equal(put.status, 200);
    assert.equal(put.body.data.types.post_liked, false);
    assert.equal(put.body.data.types.post_commented, true);

    push(u.id, 'post_liked');
    push(u.id, 'post_commented');
    const list = await c.call('GET', '/notifications', { token: u.token });
    assert.deepEqual(list.body.data.map((n: any) => n.type), ['post_commented']);

    assert.equal((await c.call('PUT', '/notifications/preferences', { token: u.token, body: { types: { payment_failed: false } } })).status, 400);
    assert.equal((await c.call('PUT', '/notifications/preferences', { token: u.token, body: { types: { bogus: true } } })).status, 400);
    assert.equal((await c.call('PUT', '/notifications/preferences', { token: u.token, body: { emailDigest: 'hourly' } })).status, 400);
    assert.equal((await c.call('PUT', '/notifications/preferences', { token: u.token, body: {} })).status, 400);
    push(u.id, 'payment_succeeded');
    assert.equal((await c.call('GET', '/notifications?limit=50', { token: u.token })).body.meta.total, 2);
  });

  it('giới hạn 200 thông báo mỗi user (xóa cũ nhất)', async () => {
    const u = await c.registerUser('cap');
    for (let i = 1; i <= 205; i++) push(u.id, 'system', `T${i}`);
    const r = await c.call('GET', '/notifications?limit=50', { token: u.token });
    assert.equal(r.body.meta.total, 200);
    assert.equal(r.body.data[0].title, 'T205');
    const last = await c.call('GET', '/notifications?limit=50&page=4', { token: u.token });
    assert.equal(last.body.data.at(-1).title, 'T6');
  });

  it('dọn thông báo đã đọc quá 30 ngày (xóa bằng truy vấn khi có thông báo mới; list không trả cái quá hạn)', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const u = await c.registerUser('ttl');
    const old = new Date(Date.now() - 31 * 86_400_000);
    const mk = (title: string, readAt: Date | null) => ({ userId: u.id, type: 'system' as const, title, body: '', readAt, createdAt: old });
    await prisma.notification.createMany({ data: [mk('old-read', old), mk('old-unread', null)] });
    // Chưa dọn vật lý nhưng list đã loại cái quá hạn
    const before = await c.call('GET', '/notifications', { token: u.token });
    assert.deepEqual(before.body.data.map((n: any) => n.title), ['old-unread']);
    push(u.id, 'system', 'moi');
    await flushNotifications();
    const rows = await prisma.notification.findMany({ where: { userId: u.id }, orderBy: { title: 'asc' } });
    assert.deepEqual(rows.map((r) => r.title), ['moi', 'old-unread']);
  });

  it('bền vững: thông báo và preference nằm trong DB thật; notify() trả ngay và ghi nền', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const u = await c.registerUser('persist');
    const n = push(u.id, 'post_commented', 'Bền vững');
    assert.ok(n.id && n.readAt === null); // trả ngay, id sinh ở app
    await flushNotifications();
    const row = await prisma.notification.findUnique({ where: { id: n.id } });
    assert.equal(row?.title, 'Bền vững');
    assert.equal(row?.userId, u.id);
    assert.equal(row?.readAt, null);
    assert.equal(row?.createdAt.toISOString(), n.createdAt);

    await c.call('POST', `/notifications/${n.id}/read`, { token: u.token });
    assert.ok((await prisma.notification.findUnique({ where: { id: n.id } }))?.readAt);

    await c.call('PUT', '/notifications/preferences', { token: u.token, body: { types: { event_created: false }, emailDigest: 'daily' } });
    const pref = await prisma.notificationPreference.findUnique({ where: { userId: u.id } });
    assert.equal(pref?.emailDigest, 'daily');
    assert.equal((pref?.types as any).event_created, false);

    // tắt loại => không ghi DB
    const off = push(u.id, 'event_created', 'Không lưu');
    await flushNotifications();
    assert.equal(await prisma.notification.findUnique({ where: { id: off.id } }), null);
  });

  it('notify cho user không tồn tại không làm sập tiến trình (lỗi ghi nền được bắt)', async () => {
    const orig = console.error;
    console.error = () => undefined;
    try {
      push('khong-co-user-nay');
      await flushNotifications();
    } finally {
      console.error = orig;
    }
  });

  it('giới hạn 200/user được thực thi ở DB (đếm hàng thật)', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const u = await c.registerUser('cap2');
    for (let i = 1; i <= 203; i++) push(u.id, 'system', `X${i}`);
    await flushNotifications();
    assert.equal(await prisma.notification.count({ where: { userId: u.id } }), 200);
    const oldest = await prisma.notification.findFirst({ where: { userId: u.id }, orderBy: { createdAt: 'asc' } });
    assert.equal(oldest?.title, 'X4');
  });

  it('SSE: xác thực bằng ticket một lần / Bearer (access_token trong query bị từ chối), nhận event notification', async () => {
    const u = await c.registerUser('sse');
    assert.equal((await c.call('GET', '/notifications/stream?access_token=bad')).status, 401);
    assert.equal((await c.call('GET', '/notifications/stream?ticket=bad')).status, 401);

    const t = await c.call('POST', '/notifications/stream-ticket', { token: u.token });
    assert.equal(t.status, 201);
    const ticket = t.body.data.ticket as string;

    const ac = new AbortController();
    const res = await fetch(`${server.baseUrl}/notifications/stream?ticket=${ticket}`, { signal: ac.signal });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
    assert.match(res.headers.get('cache-control') ?? '', /no-cache/);
    assert.equal(res.headers.get('x-accel-buffering'), 'no');

    // Vé đã dùng rồi -> không dùng lại được
    assert.equal((await c.call('GET', `/notifications/stream?ticket=${ticket}`)).status, 401);

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    push(u.id, 'system', 'Realtime!');
    let buf = '';
    while (!buf.includes('event: notification')) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
    }
    assert.match(buf, /event: notification\ndata: .*Realtime!/);
    ac.abort();

    // access_token trên query KHÔNG còn được chấp nhận (lọt vào log/Referer)
    assert.equal((await c.call('GET', `/notifications/stream?access_token=${u.token}`)).status, 401);
  });
});
