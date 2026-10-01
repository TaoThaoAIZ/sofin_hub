import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

// env.ts parse lúc import app, nên phải đặt TRƯỚC startTestServer().
const ADMIN_EMAIL = 'platform-admin-moderation@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

/** Báo cáo vi phạm + xử lý (bỏ qua / ẩn nội dung / cấm thành viên). */
describe('kiểm duyệt', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let setRole: (userId: string, role: 'mod' | 'admin' | 'owner') => Promise<void>;
  let notifications: () => Array<{ userId: string; type: string }>;
  let admin: { token: string; id: string };
  const COURSE = 'photo';

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    setRole = (userId, role) => enrollmentService.setRole(userId, COURSE, role);
    const { notificationStore } = await import('../src/modules/notifications/notifications.service.js');
    notifications = () => notificationStore.all() as any;

    const r = await c.call('POST', '/auth/register', { body: { email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' } });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  async function member(prefix: string, role?: 'mod' | 'admin' | 'owner') {
    const u = await c.registerUser(prefix);
    assert.equal((await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token })).status, 200);
    if (role) await setRole(u.id, role);
    return u;
  }
  const newPost = async (token: string) => (await c.call('POST', `/courses/${COURSE}/posts`, { token, body: { content: 'Bài cần kiểm duyệt' } })).body.data;
  const reportPost = (token: string, postId: string, reason = 'spam') => c.call('POST', `/posts/${postId}/report`, { token, body: { reason, detail: 'chi tiết' } });

  it('tạo báo cáo: 401, 400 (reason sai), 404, 403 (không phải thành viên)', async () => {
    const author = await member('rauthor');
    const reporter = await member('rreporter');
    const post = await newPost(author.token);

    assert.equal((await c.call('POST', `/posts/${post.id}/report`, { body: { reason: 'spam' } })).status, 401);
    assert.equal((await c.call('POST', `/posts/${post.id}/report`, { token: reporter.token, body: { reason: 'xyz' } })).status, 400);
    assert.equal((await c.call('POST', `/posts/${post.id}/report`, { token: reporter.token, body: {} })).status, 400);
    assert.equal((await reportPost(reporter.token, 'khong-co')).status, 404);
    assert.equal((await c.call('POST', '/comments/khong-co/report', { token: reporter.token, body: { reason: 'spam' } })).status, 404);
    const outsider = await c.registerUser('routsider');
    assert.equal((await reportPost(outsider.token, post.id)).status, 403);

    const ok = await reportPost(reporter.token, post.id, 'harassment');
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.status, 'open');
    assert.equal(ok.body.data.reason, 'harassment');
  });

  it('không báo cáo chính mình (400) và chỉ báo cáo 1 lần / đối tượng (409)', async () => {
    const author = await member('rself');
    const reporter = await member('rdup');
    const post = await newPost(author.token);
    assert.equal((await reportPost(author.token, post.id)).status, 400);
    assert.equal((await c.call('POST', `/courses/${COURSE}/members/${author.id}/report`, { token: author.token, body: { reason: 'spam' } })).status, 400);

    assert.equal((await reportPost(reporter.token, post.id)).status, 201);
    assert.equal((await reportPost(reporter.token, post.id)).status, 409);

    const cm = (await c.call('POST', `/posts/${post.id}/comments`, { token: author.token, body: { content: 'bình luận' } })).body.data;
    assert.equal((await c.call('POST', `/comments/${cm.id}/report`, { token: author.token, body: { reason: 'spam' } })).status, 400);
    assert.equal((await c.call('POST', `/comments/${cm.id}/report`, { token: reporter.token, body: { reason: 'spam' } })).status, 201);
    assert.equal((await c.call('POST', `/comments/${cm.id}/report`, { token: reporter.token, body: { reason: 'spam' } })).status, 409);
  });

  it('báo cáo thành viên: 404 nếu người đó không ở trong cộng đồng', async () => {
    const reporter = await member('rmrep');
    const target = await member('rmtarget');
    const stranger = await c.registerUser('rmstranger');
    assert.equal((await c.call('POST', `/courses/${COURSE}/members/${stranger.id}/report`, { token: reporter.token, body: { reason: 'spam' } })).status, 404);
    assert.equal((await c.call('POST', `/courses/khong-co/members/${target.id}/report`, { token: reporter.token, body: { reason: 'spam' } })).status, 404);
    assert.equal((await c.call('POST', `/courses/${COURSE}/members/${target.id}/report`, { token: reporter.token, body: { reason: 'other' } })).status, 201);
  });

  it('danh sách báo cáo của cộng đồng: member 403, mod xem được, lọc status và phân trang', async () => {
    const author = await member('lauthor');
    const reporter = await member('lreporter');
    const mod = await member('lmod', 'mod');
    const p1 = await newPost(author.token);
    const p2 = await newPost(author.token);
    const r1 = (await reportPost(reporter.token, p1.id)).body.data;
    await reportPost(reporter.token, p2.id);

    assert.equal((await c.call('GET', `/courses/${COURSE}/reports`)).status, 401);
    assert.equal((await c.call('GET', `/courses/${COURSE}/reports`, { token: reporter.token })).status, 403);
    assert.equal((await c.call('GET', `/courses/khong-co/reports`, { token: mod.token })).status, 404);
    assert.equal((await c.call('GET', `/courses/${COURSE}/reports?status=bad`, { token: mod.token })).status, 400);

    assert.equal((await c.call('PATCH', `/reports/${r1.id}`, { token: mod.token, body: { action: 'dismiss' } })).status, 200);
    const open = await c.call('GET', `/courses/${COURSE}/reports?status=open&limit=1`, { token: mod.token });
    assert.equal(open.status, 200);
    assert.equal(open.body.data.length, 1);
    assert.ok(open.body.meta.total >= 1);
    assert.ok(open.body.data.every((r: any) => r.status === 'open'));
    const dismissed = await c.call('GET', `/courses/${COURSE}/reports?status=dismissed`, { token: mod.token });
    assert.ok(dismissed.body.data.some((r: any) => r.id === r1.id));
  });

  it('PATCH /reports/:id: 401/403/404/400, bỏ qua, và chỉ xử lý một lần (409); người báo cáo nhận report_resolved', async () => {
    const author = await member('xauthor');
    const reporter = await member('xreporter');
    const mod = await member('xmod', 'mod');
    const post = await newPost(author.token);
    const rep = (await reportPost(reporter.token, post.id)).body.data;

    assert.equal((await c.call('PATCH', `/reports/${rep.id}`, { body: { action: 'dismiss' } })).status, 401);
    assert.equal((await c.call('PATCH', `/reports/${rep.id}`, { token: reporter.token, body: { action: 'dismiss' } })).status, 403);
    assert.equal((await c.call('PATCH', `/reports/khong-co`, { token: mod.token, body: { action: 'dismiss' } })).status, 404);
    assert.equal((await c.call('PATCH', `/reports/${rep.id}`, { token: mod.token, body: { action: 'nuke' } })).status, 400);

    const done = await c.call('PATCH', `/reports/${rep.id}`, { token: mod.token, body: { action: 'dismiss', note: 'không vi phạm' } });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.status, 'dismissed');
    assert.equal(done.body.data.resolvedBy, mod.id);
    assert.equal(notifications().filter((n) => n.userId === reporter.id && n.type === 'report_resolved').length, 1);
    assert.equal((await c.call('PATCH', `/reports/${rep.id}`, { token: mod.token, body: { action: 'dismiss' } })).status, 409);
    // Bài vẫn hiện sau khi bỏ qua
    assert.equal((await c.call('GET', `/posts/${post.id}`, { token: reporter.token })).status, 200);
  });

  it('hide_content ẩn bài / bình luận khỏi member thường', async () => {
    const author = await member('hauthor');
    const reporter = await member('hreporter');
    const mod = await member('hmod', 'mod');
    const post = await newPost(author.token);
    const cm = (await c.call('POST', `/posts/${post.id}/comments`, { token: author.token, body: { content: 'bình luận xấu' } })).body.data;
    const rPost = (await reportPost(reporter.token, post.id)).body.data;
    const rCm = (await c.call('POST', `/comments/${cm.id}/report`, { token: reporter.token, body: { reason: 'inappropriate' } })).body.data;

    const hiddenComment = await c.call('PATCH', `/reports/${rCm.id}`, { token: mod.token, body: { action: 'hide_content' } });
    assert.equal(hiddenComment.body.data.status, 'resolved');
    const comments = await c.call('GET', `/posts/${post.id}/comments`, { token: reporter.token });
    assert.ok(!comments.body.data.some((x: any) => x.id === cm.id));
    const asAuthor = await c.call('GET', `/posts/${post.id}/comments`, { token: author.token });
    assert.equal(asAuthor.body.data.find((x: any) => x.id === cm.id).hidden, true);

    assert.equal((await c.call('PATCH', `/reports/${rPost.id}`, { token: mod.token, body: { action: 'hide_content' } })).status, 200);
    assert.equal((await c.call('GET', `/posts/${post.id}`, { token: reporter.token })).status, 404);

    // Báo cáo về thành viên không có "nội dung" để ẩn
    const target = await member('hmember');
    const rm = (await c.call('POST', `/courses/${COURSE}/members/${target.id}/report`, { token: reporter.token, body: { reason: 'spam' } })).body.data;
    assert.equal((await c.call('PATCH', `/reports/${rm.id}`, { token: mod.token, body: { action: 'hide_content' } })).status, 400);
  });

  it('ban_member: cấm và xóa khỏi cộng đồng; mod không cấm được mod/admin/owner', async () => {
    const reporter = await member('bre');
    const bad = await member('bbad');
    const mod = await member('bmod', 'mod');
    const mod2 = await member('bmod2', 'mod');
    const adm = await member('badm', 'admin');
    const owner = await member('bowner', 'owner');

    const rBad = (await c.call('POST', `/courses/${COURSE}/members/${bad.id}/report`, { token: reporter.token, body: { reason: 'harassment' } })).body.data;
    const banned = await c.call('PATCH', `/reports/${rBad.id}`, { token: mod.token, body: { action: 'ban_member' } });
    assert.equal(banned.status, 200);
    assert.equal(banned.body.data.status, 'resolved');
    assert.equal((await c.call('GET', `/courses/${COURSE}/posts`, { token: bad.token })).status, 403);
    assert.equal((await c.call('POST', `/courses/${COURSE}/enroll`, { token: bad.token })).status, 403);

    // mod báo cáo mod khác -> mod không được cấm (vai trò ngang nhau)
    const rMod = (await c.call('POST', `/courses/${COURSE}/members/${mod2.id}/report`, { token: reporter.token, body: { reason: 'other' } })).body.data;
    assert.equal((await c.call('PATCH', `/reports/${rMod.id}`, { token: mod.token, body: { action: 'ban_member' } })).status, 403);
    // admin cấm được mod
    assert.equal((await c.call('PATCH', `/reports/${rMod.id}`, { token: adm.token, body: { action: 'ban_member' } })).status, 200);

    // không ai cấm được owner, kể cả admin
    const rOwner = (await c.call('POST', `/courses/${COURSE}/members/${owner.id}/report`, { token: reporter.token, body: { reason: 'other' } })).body.data;
    assert.equal((await c.call('PATCH', `/reports/${rOwner.id}`, { token: adm.token, body: { action: 'ban_member' } })).status, 403);
    // báo cáo vẫn mở sau khi bị từ chối
    const still = await c.call('GET', `/courses/${COURSE}/reports?status=open`, { token: adm.token });
    assert.ok(still.body.data.some((r: any) => r.id === rOwner.id));
  });

  it('Platform Admin: xem /admin/reports mọi cộng đồng và xử lý được; mod thường bị 403', async () => {
    const author = await member('padauthor');
    const reporter = await member('padreporter');
    const mod = await member('padmod', 'mod');
    const post = await newPost(author.token);
    const rep = (await reportPost(reporter.token, post.id)).body.data;

    assert.equal((await c.call('GET', '/admin/reports')).status, 401);
    assert.equal((await c.call('GET', '/admin/reports', { token: mod.token })).status, 403);
    const list = await c.call('GET', '/admin/reports?status=open', { token: admin.token });
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((r: any) => r.id === rep.id));
    assert.ok(list.body.meta.total >= 1);

    // Platform Admin không cần ghi danh vẫn xử lý được
    const done = await c.call('PATCH', `/reports/${rep.id}`, { token: admin.token, body: { action: 'hide_content' } });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.resolvedBy, admin.id);
    const resolved = await c.call('GET', '/admin/reports?status=resolved', { token: admin.token });
    assert.ok(resolved.body.data.some((r: any) => r.id === rep.id));
  });
  it('đồng thời: báo cáo trùng song song chỉ 1 cái được tạo; xử lý song song chỉ 1 người thành công; ban ghi lý do + người cấm', async () => {
    const db = (await useTestDb()).prisma;
    const author = await member('cauthor');
    const reporter = await member('creporter');
    const mod = await member('cmod', 'mod');
    const mod2 = await member('cmod2', 'mod');
    const post = await newPost(author.token);

    const dup = await Promise.all([1, 2, 3].map(() => reportPost(reporter.token, post.id)));
    assert.deepEqual(dup.map((r) => r.status).sort(), [201, 409, 409]);
    assert.equal(await db.report.count({ where: { reporterId: reporter.id, targetId: post.id } }), 1);
    const rep = dup.find((r) => r.status === 201)!.body.data;

    const rs = await Promise.all([mod, mod2].map((m) => c.call('PATCH', `/reports/${rep.id}`, { token: m.token, body: { action: 'ban_member' } })));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    const row = await db.report.findUniqueOrThrow({ where: { id: rep.id } });
    assert.equal(row.status, 'resolved');
    assert.equal(row.action, 'ban_member');
    const ban = await db.communityBan.findUniqueOrThrow({ where: { communityId_userId: { communityId: COURSE, userId: author.id } } });
    assert.ok(ban.bannedById === mod.id || ban.bannedById === mod2.id);
    assert.ok(ban.reason && ban.reason.includes('spam'));
  });

  it('thành viên minh họa (isDemo) bị báo cáo: hiện tên thật của họ và không cấm được (400)', async () => {
    const db = (await useTestDb()).prisma;
    const reporter = await member('dreporter');
    const mod = await member('dmod', 'mod');
    const demoId = `demo-${COURSE}-mod-${Date.now().toString(36)}`;
    await db.user.create({ data: { id: demoId, email: `${demoId}@demo.sofinhub.invalid`, firstName: 'Khách', lastName: 'Demo', passwordHash: '!x', isDemo: true } });
    await db.enrollment.create({ data: { userId: demoId, communityId: COURSE } });
    const post = await db.post.create({ data: { communityId: COURSE, authorId: demoId, content: 'bài demo' } });
    const rep = (await reportPost(reporter.token, post.id)).body.data;
    assert.equal(rep.targetUserName, 'Khách Demo');
    assert.equal((await c.call('PATCH', `/reports/${rep.id}`, { token: mod.token, body: { action: 'ban_member' } })).status, 400);
    assert.equal((await db.report.findUniqueOrThrow({ where: { id: rep.id } })).status, 'open');
  });

  it('phân trang ở DB: total/totalPages đúng, mới nhất trước, trang không chồng lấn', async () => {
    const author = await member('pgauthor');
    const reporter = await member('pgreporter');
    const mod = await member('pgmod', 'mod');
    for (let i = 0; i < 5; i++) await reportPost(reporter.token, (await newPost(author.token)).id);
    const total = (await c.call('GET', `/courses/${COURSE}/reports?limit=50`, { token: mod.token })).body.meta.total;
    const p1 = await c.call('GET', `/courses/${COURSE}/reports?limit=2&page=1`, { token: mod.token });
    const p2 = await c.call('GET', `/courses/${COURSE}/reports?limit=2&page=2`, { token: mod.token });
    assert.equal(p1.body.meta.total, total);
    assert.equal(p1.body.meta.totalPages, Math.ceil(total / 2));
    assert.equal(p1.body.data.length, 2);
    assert.ok(p1.body.data.every((r: any) => !p2.body.data.some((x: any) => x.id === r.id)));
    assert.ok(p1.body.data[0].createdAt >= p1.body.data[1].createdAt);
    assert.ok(p1.body.data[1].createdAt >= p2.body.data[0].createdAt);
  });
});
