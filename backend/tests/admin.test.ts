import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

// env.ts parse lúc import app, nên phải đặt TRƯỚC startTestServer().
const ADMIN_EMAIL = 'platform-admin-batch1@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

/** Admin đợt 1: phân quyền, dashboard, communities, users, moderation, audit. */
describe('admin đợt 1', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let admin: { token: string; id: string };
  let flush: () => Promise<void>;
  let notifs: () => Array<{ userId: string; type: string; title: string; body: string }>;
  const PW = 'Passw0rd!x';
  const A = (method: string, path: string, body?: unknown) => c.call(method, `/admin${path}`, { token: admin.token, body });
  let seq = 0;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    const svc = await import('../src/modules/notifications/notifications.service.js');
    flush = svc.flushNotifications;
    notifs = () => svc.notificationStore.all() as any;
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: PW, firstName: 'Plat', lastName: 'Admin' });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  /** Tạo cộng đồng ở trạng thái kiểm duyệt cho trước (không đi qua luồng tạo thường, giữ nguyên hành vi hiện có). */
  async function makeCommunity(opts: { status?: 'pending_review' | 'active'; owner?: string; price?: number; title?: string } = {}) {
    const id = `adm-${Date.now().toString(36)}-${seq++}`;
    await db.prisma.community.create({
      data: {
        id, title: opts.title ?? `Cộng đồng ${id}`, description: 'Mô tả cộng đồng thử nghiệm đủ dài.', category: 'tech', thumbnail: '/x.webp',
        instructorName: 'Ai đó', instructorRole: 'Chủ', priceCents: (opts.price ?? 0) * 100, pricing: opts.price ? 'paid' : 'free',
        moderationStatus: opts.status ?? 'pending_review', ownerId: opts.owner ?? null,
      },
    });
    return id;
  }
  /** Có hiện ở danh sách công khai không (tìm theo id vì tiêu đề chứa id). */
  const listed = async (id: string) => (await c.call('GET', `/courses?q=${encodeURIComponent(id)}&limit=50`)).body.data.some((x: any) => x.id === id) as boolean;
  const status = async (id: string) => (await A('GET', `/communities/${id}`)).body.data.status;
  const auditActions = async (targetId: string) => (await A('GET', `/audit-logs?targetId=${encodeURIComponent(targetId)}&limit=100`)).body.data.map((a: any) => a.action) as string[];

  /* ------------------------------------------------------------------ phân quyền */
  it('mọi route admin: 401 khi thiếu token, 403 khi không phải Platform Admin', async () => {
    const user = await c.registerUser('plain');
    const routes: [string, string][] = [
      ['GET', '/admin/me'], ['GET', '/admin/dashboard'], ['GET', '/admin/communities'], ['GET', '/admin/communities/summary'],
      ['GET', '/admin/communities/review-queue'], ['GET', '/admin/communities/trash'], ['GET', '/admin/communities/photo'],
      ['POST', '/admin/communities/photo/approve'], ['POST', '/admin/communities/photo/suspend'], ['POST', '/admin/communities/photo/delete'],
      ['GET', '/admin/users'], ['GET', '/admin/users/summary'], ['GET', `/admin/users/${user.id}`], ['POST', `/admin/users/${user.id}/ban`],
      ['POST', `/admin/users/${user.id}/restrict`], ['POST', `/admin/users/${user.id}/suspend`], ['POST', `/admin/users/${user.id}/reinstate`],
      ['GET', '/admin/moderation/summary'], ['GET', '/admin/moderation/cases'], ['GET', '/admin/moderation/cases/x'], ['POST', '/admin/moderation/cases/x/warn'],
      ['GET', '/admin/moderation/decisions'], ['GET', '/admin/audit-logs'],
    ];
    for (const [m, p] of routes) {
      assert.equal((await c.call(m, p, { body: m === 'POST' ? {} : undefined })).status, 401, `${m} ${p} thiếu token`);
      assert.equal((await c.call(m, p, { token: user.token, body: m === 'POST' ? {} : undefined })).status, 403, `${m} ${p} không phải admin`);
    }
    assert.equal((await A('GET', '/me')).body.data.role, 'platform_admin');
  });

  /* ------------------------------------------------------------------ dashboard */
  it('dashboard: KPI + 4 chuỗi đủ số điểm theo range; range sai -> 400', async () => {
    await c.registerUser('dashu');
    const r = await A('GET', '/dashboard?range=7');
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.equal(d.range, 7);
    for (const k of ['userGrowth', 'communityGrowth', 'revenue', 'engagement']) assert.equal(d.series[k].length, 7, k);
    assert.ok(d.kpis.totalUsers.value >= 2);
    assert.equal(d.kpis.openSupportTickets.value, null);
    assert.ok('pendingReports' in d.kpis && 'critical' in d.kpis.pendingReports);
    assert.ok(Array.isArray(d.recentActivity));
    assert.equal((await A('GET', '/dashboard?range=90')).body.data.series.revenue.length, 90);
    assert.equal((await A('GET', '/dashboard')).body.data.range, 30);
    assert.equal((await A('GET', '/dashboard?range=5')).status, 400);
    // đăng ký hôm nay phải hiện ở điểm cuối của chuỗi người dùng mới
    assert.ok(d.series.userGrowth.at(-1).newUsers >= 1);
  });

  /* ------------------------------------------------------------------ communities */
  it('review: approve / request-changes / reject + ràng buộc trạng thái + audit + thông báo chủ', async () => {
    const owner = await c.registerUser('comowner');
    const id1 = await makeCommunity({ owner: owner.id });
    const id2 = await makeCommunity({ owner: owner.id });
    const id3 = await makeCommunity({ owner: owner.id });

    const q = await A('GET', '/communities/review-queue?limit=100');
    assert.equal(q.status, 200);
    const item = q.body.data.find((x: any) => x.id === id1);
    assert.ok(item);
    assert.equal(item.status, 'pending_review');
    assert.ok(typeof item.waitingHours === 'number' && item.signals && 'ownerAccountAgeDays' in item.signals);
    // chưa duyệt thì không hiện ở danh sách công khai
    assert.equal(await listed(id1), false);

    // validate
    assert.equal((await A('POST', `/communities/${id1}/request-changes`, {})).status, 400);
    assert.equal((await A('POST', `/communities/${id1}/reject`, {})).status, 400);
    assert.equal((await A('POST', '/communities/khong-co/approve', {})).status, 404);

    const ok = await A('POST', `/communities/${id1}/approve`, { note: 'Tốt' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.status, 'active');
    assert.equal(await listed(id1), true, 'đã duyệt thì hiện công khai');
    assert.equal((await A('POST', `/communities/${id1}/approve`, {})).status, 409);
    assert.equal((await A('POST', `/communities/${id1}/reject`, { reason: 'x' })).status, 409);

    const ch = await A('POST', `/communities/${id2}/request-changes`, { note: 'Bổ sung mô tả' });
    assert.equal(ch.body.data.status, 'changes_requested');
    assert.equal(ch.body.data.statusNote, 'Bổ sung mô tả');
    assert.equal((await A('POST', `/communities/${id2}/request-changes`, { note: 'lại' })).status, 409);
    assert.ok((await A('GET', '/communities/review-queue?limit=100')).body.data.some((x: any) => x.id === id2), 'changes_requested vẫn ở hàng chờ');

    const rj = await A('POST', `/communities/${id3}/reject`, { reason: 'Misleading claims' });
    assert.equal(rj.body.data.status, 'rejected');
    assert.equal(rj.body.data.statusReason, 'Misleading claims');

    await flush();
    const mine = notifs().filter((n) => n.userId === owner.id).map((n) => n.title);
    assert.ok(mine.includes('Cộng đồng đã được duyệt') && mine.includes('Cộng đồng cần chỉnh sửa') && mine.includes('Cộng đồng bị từ chối'));
    assert.deepEqual((await auditActions(id1)).sort(), ['community.approve']);
    assert.deepEqual(await auditActions(id3), ['community.reject']);
    const log = (await A('GET', `/audit-logs?targetId=${id3}`)).body.data[0];
    assert.equal(log.actor.id, admin.id);
    assert.equal(log.reason, 'Misleading claims');
    assert.equal(log.targetType, 'community');
  });

  it('suspend / restore / delete / undelete + thùng rác 30 ngày', async () => {
    const id = await makeCommunity({ status: 'active', price: 10 });
    assert.equal(await listed(id), true);

    assert.equal((await A('POST', `/communities/${id}/suspend`, {})).status, 400);
    assert.equal((await A('POST', `/communities/${id}/restore`, {})).status, 409, 'chưa bị đình chỉ');
    const s = await A('POST', `/communities/${id}/suspend`, { reason: 'Payment risk', duration: '7d' });
    assert.equal(s.body.data.status, 'suspended');
    assert.ok(s.body.data.statusUntil);
    assert.equal(await listed(id), false, 'đình chỉ thì ẩn khỏi danh sách công khai');
    assert.equal((await A('POST', `/communities/${id}/suspend`, { reason: 'lại' })).status, 409);

    assert.equal((await A('POST', `/communities/${id}/restore`, {})).body.data.status, 'active');
    assert.equal(await listed(id), true);

    const del = await A('POST', `/communities/${id}/delete`, { reason: 'Fraud', note: 'ghi chú' });
    assert.equal(del.body.data.status, 'deleted');
    assert.ok(del.body.data.deletedAt);
    assert.equal((await c.call('GET', `/courses/${id}`)).status, 404, 'đã xóa thì công khai 404');
    assert.equal((await A('POST', `/communities/${id}/delete`, { reason: 'lại' })).status, 409);
    assert.equal((await A('POST', `/communities/${id}/suspend`, { reason: 'x' })).status, 409);

    const trash = (await A('GET', '/communities/trash?limit=100')).body.data.find((x: any) => x.id === id);
    assert.ok(trash);
    assert.equal(trash.reason, 'Fraud');
    assert.equal(trash.deletedBy.id, admin.id);
    assert.equal(trash.deletedByOwner, false);
    assert.ok(trash.daysLeft >= 29 && trash.daysLeft <= 30);
    assert.ok(!(await A('GET', '/communities?limit=100')).body.data.some((x: any) => x.id === id), 'mặc định danh sách bỏ qua đã xóa');
    assert.ok((await A('GET', '/communities?status=deleted&limit=100')).body.data.some((x: any) => x.id === id));

    const un = await A('POST', `/communities/${id}/undelete`, {});
    assert.equal(un.body.data.status, 'active');
    assert.equal((await c.call('GET', `/courses/${id}`)).status, 200);
    assert.equal((await A('POST', `/communities/${id}/undelete`, {})).status, 409, 'chưa bị xóa');

    // quá hạn lưu giữ -> không khôi phục được
    await A('POST', `/communities/${id}/delete`, { reason: 'Spam' });
    await db.prisma.community.update({ where: { id }, data: { deletedAt: new Date(Date.now() - 40 * 86_400_000) } });
    const late = await A('POST', `/communities/${id}/undelete`, {});
    assert.equal(late.status, 409);
    assert.equal(late.body.error.code, 'RETENTION_EXPIRED');

    const actions = await auditActions(id);
    for (const a of ['community.suspend', 'community.restore', 'community.delete', 'community.undelete']) assert.ok(actions.includes(a), a);
  });

  it('khóa/mở khóa kiểu cũ vẫn chạy và cũng ghi audit; summary/list/detail/members/reports', async () => {
    const owner = await c.registerUser('lockowner');
    const id = await makeCommunity({ status: 'active', owner: owner.id, title: 'Zebra Unique Title' });
    await db.prisma.enrollment.create({ data: { userId: owner.id, communityId: id, role: 'owner' } });
    const lock = await c.call('POST', `/admin/courses/${id}/lock`, { token: admin.token, body: { reason: 'Vi phạm' } });
    assert.equal(lock.status, 200);
    assert.equal(await status(id), 'suspended', 'locked cũ hiển thị là suspended');
    const unlock = await c.call('POST', `/admin/courses/${id}/unlock`, { token: admin.token });
    assert.equal(unlock.status, 200);
    assert.equal(await status(id), 'active');
    const acts = await auditActions(id);
    assert.ok(acts.includes('community.lock') && acts.includes('community.unlock'));

    const sum = (await A('GET', '/communities/summary')).body.data;
    for (const k of ['total', 'active', 'pendingReview', 'changesRequested', 'rejected', 'paid', 'suspended', 'deleted']) assert.equal(typeof sum[k], 'number', k);

    const byName = await A('GET', '/communities?q=zebra unique');
    assert.equal(byName.body.data.length, 1);
    assert.equal(byName.body.data[0].owner.id, owner.id);
    assert.equal((await A('GET', `/communities?q=${encodeURIComponent(owner.email.split('@')[0]!)}`)).body.data[0].id, id);
    assert.equal((await A('GET', '/communities?status=bogus')).status, 400);
    assert.equal((await A('GET', '/communities?sort=members&limit=2')).body.meta.limit, 2);

    const detail = (await A('GET', `/communities/${id}`)).body.data;
    assert.equal(detail.owner.email, owner.email);
    assert.equal(detail.stats.members, 1);
    assert.ok(Array.isArray(detail.recentReports) && Array.isArray(detail.history));
    const members = await A('GET', `/communities/${id}/members`);
    assert.equal(members.body.data[0].role, 'owner');
    assert.equal((await A('GET', `/communities/${id}/reports`)).status, 200);
    assert.equal((await A('GET', '/communities/khong-co')).status, 404);
  });

  /* ------------------------------------------------------------------ users */
  async function loginRaw(email: string) {
    return c.call('POST', '/auth/login', { body: { email, password: PW } });
  }

  it('restrict: vẫn đọc được nhưng không đăng bài/bình luận/tạo cộng đồng; reinstate trả lại quyền', async () => {
    const u = await c.registerUser('restricted');
    const author = await c.registerUser('postauthor');
    await c.call('POST', '/courses/photo/enroll', { token: u.token });
    await c.call('POST', '/courses/photo/enroll', { token: author.token });
    const post = (await c.call('POST', '/courses/photo/posts', { token: author.token, body: { content: 'Bài của người khác' } })).body.data;

    assert.equal((await A('POST', `/users/${u.id}/restrict`, {})).status, 400, 'thiếu lý do');
    const r = await A('POST', `/users/${u.id}/restrict`, { reason: 'Spam', duration: '7d' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'restricted');
    assert.deepEqual(r.body.data.restrictions.sort(), ['comment', 'create_community', 'post']);
    assert.ok(r.body.data.statusUntil);

    assert.equal((await c.call('GET', '/courses/photo/posts', { token: u.token })).status, 200, 'vẫn đọc được');
    const blockedPost = await c.call('POST', '/courses/photo/posts', { token: u.token, body: { content: 'không được đăng' } });
    assert.equal(blockedPost.status, 403);
    assert.equal(blockedPost.body.error.code, 'ACCOUNT_RESTRICTED');
    assert.equal((await c.call('POST', `/posts/${post.id}/comments`, { token: u.token, body: { content: 'bình luận' } })).status, 403);
    const mk = await c.call('POST', '/communities', { token: u.token, body: { title: 'Nhóm của tôi', description: 'Mô tả đủ dài để qua validate nhé', category: 'tech', priceUsd: 0, visibility: 'public' } });
    assert.equal(mk.status, 403);
    assert.equal(mk.body.error.code, 'ACCOUNT_RESTRICTED');
    assert.equal((await loginRaw(u.email)).status, 200, 'restricted vẫn đăng nhập được');

    // hạn chế hẹp hơn: chỉ chặn nhắn tin -> đăng bài lại được
    await A('POST', `/users/${u.id}/restrict`, { reason: 'DM spam', restrictions: ['dm'] });
    assert.equal((await c.call('POST', '/courses/photo/posts', { token: u.token, body: { content: 'đăng được rồi' } })).status, 201);

    const re = await A('POST', `/users/${u.id}/reinstate`, { note: 'Hết hạn' });
    assert.equal(re.body.data.status, 'active');
    assert.equal((await A('POST', `/users/${u.id}/reinstate`, {})).status, 409);
    assert.equal((await c.call('POST', '/courses/photo/posts', { token: u.token, body: { content: 'bình thường' } })).status, 201);
    const acts = await auditActions(u.id);
    assert.ok(acts.includes('user.restrict') && acts.includes('user.reinstate'));
  });

  it('suspend: thu hồi phiên, chặn đăng nhập/refresh; hết hạn tự gỡ; reinstate', async () => {
    const u = await c.registerUser('suspended');
    const login = await loginRaw(u.email);
    const cookie = (login.headers.getSetCookie()[0] ?? '').split(';')[0]!;
    assert.equal((await c.call('GET', '/auth/me', { token: u.token })).status, 200);

    const s = await A('POST', `/users/${u.id}/suspend`, { reason: 'Harassment', duration: '24h' });
    assert.equal(s.body.data.status, 'suspended');
    assert.equal((await c.call('GET', '/auth/me', { token: u.token })).status, 401, 'token cũ chết ngay');
    assert.equal((await c.call('GET', '/auth/me', { token: login.body.data.accessToken })).status, 401);
    const blocked = await loginRaw(u.email);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'ACCOUNT_SUSPENDED');
    assert.equal(blocked.body.error.details.reason, 'Harassment');
    assert.equal((await c.call('POST', '/auth/refresh', { headers: { Cookie: cookie } })).status, 401);
    // sai mật khẩu vẫn là 401 (không lộ trạng thái)
    assert.equal((await c.call('POST', '/auth/login', { body: { email: u.email, password: 'SaiMatKhau1!' } })).status, 401);
    assert.equal((await A('POST', `/users/${u.id}/suspend`, { reason: 'lại' })).status, 409);

    // hết hạn -> tự đăng nhập lại được
    await db.prisma.user.update({ where: { id: u.id }, data: { statusUntil: new Date(Date.now() - 1000) } });
    assert.equal((await loginRaw(u.email)).status, 200);
    assert.equal((await A('GET', `/users/${u.id}`)).body.data.status, 'active');

    await A('POST', `/users/${u.id}/suspend`, { reason: 'Spam' });
    assert.equal((await loginRaw(u.email)).status, 403);
    await A('POST', `/users/${u.id}/reinstate`, {});
    assert.equal((await loginRaw(u.email)).status, 200);
  });

  it('ban: không đăng nhập được; gỡ ban khôi phục; không tác động admin/chính mình/user lạ', async () => {
    const u = await c.registerUser('banned');
    const b = await A('POST', `/users/${u.id}/ban`, { reason: 'Scam', evidence: 'link' });
    assert.equal(b.body.data.status, 'banned');
    assert.equal((await c.call('GET', '/auth/me', { token: u.token })).status, 401);
    const l = await loginRaw(u.email);
    assert.equal(l.status, 403);
    assert.equal(l.body.error.code, 'ACCOUNT_BANNED');
    assert.equal((await A('POST', `/users/${u.id}/ban`, { reason: 'lại' })).status, 409);
    assert.equal((await A('POST', `/users/${u.id}/restrict`, { reason: 'x' })).status, 409);
    const log = (await A('GET', `/audit-logs?action=user.ban&targetId=${u.id}`)).body.data[0];
    assert.equal(log.evidence, 'link');
    assert.equal(log.metadata.to, 'banned');
    await A('POST', `/users/${u.id}/reinstate`, {});
    assert.equal((await loginRaw(u.email)).status, 200);

    assert.equal((await A('POST', `/users/${admin.id}/ban`, { reason: 'x' })).status, 403, 'không tự cấm mình');
    assert.equal((await A('POST', '/users/khong-co/ban', { reason: 'x' })).status, 404);
    const demo = await db.prisma.user.create({ data: { email: 'demo-x@demo.invalid', firstName: 'D', lastName: 'M', passwordHash: '!', isDemo: true } });
    assert.equal((await A('POST', `/users/${demo.id}/ban`, { reason: 'x' })).status, 400);
  });

  it('users: list/lọc/tìm/detail/sub-resources/warn/revoke session', async () => {
    const u = await c.registerUser('listme');
    await c.call('POST', '/courses/photo/enroll', { token: u.token });
    await c.call('POST', '/courses/photo/posts', { token: u.token, body: { content: 'Bài để có hoạt động' } });
    await A('POST', `/users/${u.id}/restrict`, { reason: 'Test' });

    const sum = (await A('GET', '/users/summary')).body.data;
    assert.ok(sum.total >= 3 && sum.restricted >= 1);
    const list = await A('GET', `/users?q=${encodeURIComponent(u.email)}`);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].status, 'restricted');
    assert.equal(list.body.data[0].communities, 1);
    assert.equal((await A('GET', '/users?status=restricted&limit=100')).body.data.every((x: any) => x.status === 'restricted'), true);
    assert.equal((await A('GET', '/users?status=restricted,banned&role=member')).status, 200);
    assert.equal((await A('GET', '/users?status=nope')).status, 400);
    assert.equal((await A('GET', '/users?sort=revenue&plan=free')).status, 200);

    const d = (await A('GET', `/users/${u.id}`)).body.data;
    assert.equal(d.email, u.email);
    assert.equal(d.stats.posts, 1);
    assert.equal(d.stats.communities, 1);
    assert.ok(d.security.activeSessions.length >= 1);
    assert.ok(Array.isArray(d.recentActivity));
    assert.equal((await A('GET', `/users/${u.id}/communities`)).body.data[0].id, 'photo');
    assert.ok((await A('GET', `/users/${u.id}/activity?type=content`)).body.data.length >= 1);
    assert.equal((await A('GET', `/users/${u.id}/activity?type=bogus`)).status, 400);
    assert.equal((await A('GET', `/users/${u.id}/purchases`)).body.summary.lifetimeSpendCents, 0);
    assert.equal((await A('GET', `/users/${u.id}/reports`)).body.meta.summary.received, 0);
    assert.equal((await A('GET', '/users/khong-co')).status, 404);

    // warn: thông báo cho user + audit
    assert.equal((await A('POST', `/users/${u.id}/warn`, { reason: 'Spam' })).status, 400);
    assert.equal((await A('POST', `/users/${u.id}/warn`, { reason: 'Spam', message: 'Đừng spam nữa nhé' })).status, 200);
    await flush();
    assert.ok(notifs().some((n) => n.userId === u.id && n.body.includes('Đừng spam nữa nhé')));
    assert.ok((await auditActions(u.id)).includes('user.warn'));

    // thu hồi 1 phiên
    const sid = d.security.activeSessions[0].id;
    assert.equal((await A('DELETE', `/users/${u.id}/sessions/${sid}`)).body.data.revoked, true);
    assert.equal((await A('DELETE', `/users/${u.id}/sessions/${sid}`)).status, 404);
  });

  /* ------------------------------------------------------------------ moderation */
  async function setupCase(reason = 'spam') {
    const author = await c.registerUser('mauthor');
    const reporter = await c.registerUser('mreporter');
    for (const u of [author, reporter]) await c.call('POST', '/courses/photo/enroll', { token: u.token });
    const post = (await c.call('POST', '/courses/photo/posts', { token: author.token, body: { content: 'Nội dung vi phạm để kiểm duyệt' } })).body.data;
    const rep = await c.call('POST', `/posts/${post.id}/report`, { token: reporter.token, body: { reason, detail: 'chi tiết' } });
    assert.equal(rep.status, 201);
    return { author, reporter, post, caseId: rep.body.data.id as string };
  }

  it('cases: list/lọc/detail + summary + assignees', async () => {
    const { author, post, caseId } = await setupCase('scam');
    const list = await A('GET', '/moderation/cases?status=open&limit=100');
    const item = list.body.data.find((x: any) => x.id === caseId);
    assert.ok(item);
    assert.match(item.caseCode, /^CASE-\d{5}$/);
    assert.equal(item.risk, 'high', 'scam tự được chấm risk cao');
    assert.equal(item.assignee, null);
    assert.equal(item.reportedUser.id, author.id);
    assert.equal(item.content.community.id, 'photo');
    assert.ok((await A('GET', '/moderation/cases?assignee=unassigned&risk=high&reason=scam&limit=100')).body.data.some((x: any) => x.id === caseId));
    assert.ok((await A('GET', `/moderation/cases?q=${item.caseCode}`)).body.data.some((x: any) => x.id === caseId));
    assert.ok((await A('GET', '/moderation/cases?q=' + encodeURIComponent(author.email.split('@')[0]!.slice(0, 6)))).status === 200);
    assert.equal((await A('GET', '/moderation/cases?status=zzz')).status, 400);
    assert.equal((await A('GET', '/moderation/cases?sort=risk')).status, 200);

    const d = (await A('GET', `/moderation/cases/${caseId}`)).body.data;
    assert.equal(d.reportedContent.exists, true);
    assert.equal(d.reportedContent.body, 'Nội dung vi phạm để kiểm duyệt');
    assert.equal(d.reportedContent.id, post.id);
    assert.equal(d.reportedUserInfo.id, author.id);
    assert.ok(d.reporterInfo.email);
    assert.ok(Array.isArray(d.history) && Array.isArray(d.similarCases) && Array.isArray(d.relatedReports));
    assert.equal((await A('GET', '/moderation/cases/khong-co')).status, 404);

    const s = (await A('GET', '/moderation/summary')).body.data;
    assert.ok(s.open >= 1);
    for (const k of ['critical', 'underReview', 'resolvedToday', 'warnings', 'removedContent', 'suspendedUsers']) assert.equal(typeof s[k], 'number', k);
    const assignees = (await A('GET', '/moderation/assignees')).body.data;
    assert.ok(assignees.some((a: any) => a.id === admin.id));
  });

  it('assign + warn: case resolved, user nhận Notification, audit + lịch sử', async () => {
    const { author, caseId } = await setupCase();
    const asg = await A('POST', `/moderation/cases/${caseId}/assign`, {});
    assert.equal(asg.body.data.assignee.id, admin.id);
    assert.equal(asg.body.data.status, 'under_review');
    const other = await c.registerUser('notadmin');
    assert.equal((await A('POST', `/moderation/cases/${caseId}/assign`, { adminId: other.id })).status, 400, 'chỉ giao cho đội admin');

    assert.equal((await A('POST', `/moderation/cases/${caseId}/warn`, {})).status, 400);
    const w = await A('POST', `/moderation/cases/${caseId}/warn`, { message: 'Vui lòng tuân thủ nội quy' });
    assert.equal(w.status, 200);
    assert.equal(w.body.data.status, 'resolved');
    assert.equal(w.body.data.action, 'warn_user');
    await flush();
    const n = notifs().find((x) => x.userId === author.id && x.body.includes('Vui lòng tuân thủ nội quy'));
    assert.ok(n, 'user bị cảnh cáo nhận thông báo');
    const detail = (await A('GET', `/moderation/cases/${caseId}`)).body.data;
    assert.deepEqual(detail.history.map((h: any) => h.type).sort(), ['assign', 'warn']);
    assert.ok((await auditActions(caseId)).includes('case.assign'));
    const dec = (await A('GET', '/moderation/decisions?type=warning&limit=100')).body.data;
    assert.ok(dec.some((x: any) => x.case?.id === caseId && x.decision === 'case.warn'));
    // đã xử lý -> không xử lý lại
    assert.equal((await A('POST', `/moderation/cases/${caseId}/dismiss`, {})).status, 409);
    assert.equal((await A('POST', `/moderation/cases/${caseId}/assign`, {})).status, 409);
  });

  it('remove-content: ẩn bài, closeCase=false giữ under_review để làm tiếp, rồi suspend-user', async () => {
    const { author, post, caseId } = await setupCase('harassment');
    assert.equal((await A('POST', `/moderation/cases/${caseId}/remove-content`, {})).status, 400);
    const rm = await A('POST', `/moderation/cases/${caseId}/remove-content`, { reason: 'Harassment', closeCase: false });
    assert.equal(rm.body.data.status, 'under_review');
    assert.equal((await db.prisma.post.findUnique({ where: { id: post.id } }))!.hidden, true);
    await flush();
    assert.ok(notifs().some((x) => x.userId === author.id && x.title === 'Nội dung của bạn đã bị gỡ'));

    const sus = await A('POST', `/moderation/cases/${caseId}/suspend-user`, { reason: 'Harassment', duration: '7d' });
    assert.equal(sus.body.data.status, 'resolved');
    assert.equal(sus.body.data.action, 'suspend_user');
    assert.equal((await loginRaw(author.email)).status, 403);
    const acts = await auditActions(author.id);
    assert.ok(acts.includes('case.suspend_user'));
    assert.ok((await auditActions(post.id)).includes('case.remove_content'));
    assert.ok((await A('GET', '/moderation/decisions?type=suspension&q=' + encodeURIComponent(`${author.email.split('@')[0]}`))).status === 200);
    assert.ok((await A('GET', '/moderation/decisions?type=removal')).body.data.some((x: any) => x.case?.id === caseId));
  });

  it('ban-user / restrict-user / dismiss / escalate / resolve + báo cáo trùng đóng cùng nhau', async () => {
    // ban
    const a = await setupCase();
    const ban = await A('POST', `/moderation/cases/${a.caseId}/ban-user`, { reason: 'Scam' });
    assert.equal(ban.body.data.status, 'resolved');
    assert.equal((await loginRaw(a.author.email)).body.error.code, 'ACCOUNT_BANNED');

    // restrict
    const b = await setupCase();
    const rs = await A('POST', `/moderation/cases/${b.caseId}/restrict-user`, { reason: 'Spam', restrictions: ['post'] });
    assert.equal(rs.body.data.action, 'restrict_user');
    assert.equal((await c.call('POST', '/courses/photo/posts', { token: b.author.token, body: { content: 'x' } })).status, 403);

    // dismiss
    const d = await setupCase();
    const dm = await A('POST', `/moderation/cases/${d.caseId}/dismiss`, { note: 'No violation' });
    assert.equal(dm.body.data.status, 'dismissed');
    assert.equal(dm.body.data.note, 'No violation');

    // escalate: tăng 1 bậc (low -> medium), under_review; resolve không kèm hành động
    const e = await setupCase('other');
    const before = (await A('GET', `/moderation/cases/${e.caseId}`)).body.data.risk;
    const es = await A('POST', `/moderation/cases/${e.caseId}/escalate`, { note: 'Cần xem lại' });
    assert.equal(es.body.data.status, 'under_review');
    assert.notEqual(es.body.data.risk, before);
    const rv = await A('POST', `/moderation/cases/${e.caseId}/resolve`, { note: 'Đã xử lý ngoài hệ thống' });
    assert.equal(rv.body.data.status, 'resolved');
    assert.equal(rv.body.data.action, 'none');

    // báo cáo trùng: thêm người báo cáo thứ 2 trên cùng bài -> hàng đợi chỉ hiện 1, xử lý 1 thì đóng cả 2
    const f = await setupCase();
    const second = await c.registerUser('mreporter2');
    await c.call('POST', '/courses/photo/enroll', { token: second.token });
    const r2 = await c.call('POST', `/posts/${f.post.id}/report`, { token: second.token, body: { reason: 'spam' } });
    const shown = (await A('GET', '/moderation/cases?status=open&limit=100')).body.data.filter((x: any) => x.content.id === f.post.id);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].reportCount, 2);
    assert.equal((await A('GET', '/moderation/cases?status=open&includeDuplicates=true&limit=100')).body.data.filter((x: any) => x.content.id === f.post.id).length, 2);
    await A('POST', `/moderation/cases/${f.caseId}/dismiss`, {});
    assert.equal((await A('GET', `/moderation/cases/${r2.body.data.id}`)).body.data.status, 'dismissed');
  });

  it('báo cáo cũ (/admin/reports, PATCH /reports) vẫn chạy với trạng thái mới', async () => {
    const { caseId } = await setupCase();
    const all = await c.call('GET', '/admin/reports?status=open&limit=50', { token: admin.token });
    assert.equal(all.status, 200);
    assert.ok(all.body.data.some((x: any) => x.id === caseId));
    await A('POST', `/moderation/cases/${caseId}/assign`, {});
    const patched = await c.call('PATCH', `/reports/${caseId}`, { token: admin.token, body: { action: 'dismiss', note: 'ok' } });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    assert.equal(patched.body.data.status, 'dismissed');
    assert.ok((await auditActions(caseId)).includes('report.resolve'), 'Platform Admin xử lý qua API cũ cũng vào audit');
  });

  /* ------------------------------------------------------------------ audit */
  it('audit-logs: lọc theo actor/action/targetType/thời gian + phân trang; mọi dòng có actor', async () => {
    const all = await A('GET', '/audit-logs?limit=5');
    assert.equal(all.status, 200);
    assert.equal(all.body.meta.limit, 5);
    assert.ok(all.body.meta.total > 5);
    assert.ok(all.body.data.every((a: any) => a.actor.id === admin.id && a.action && a.targetType && a.createdAt));
    const dates = all.body.data.map((a: any) => a.createdAt);
    assert.deepEqual([...dates].sort().reverse(), dates, 'mới nhất trước');
    assert.ok((await A('GET', '/audit-logs?action=user.&limit=100')).body.data.every((a: any) => a.action.startsWith('user.')), 'khớp tiền tố');
    assert.ok((await A('GET', '/audit-logs?targetType=community&limit=100')).body.data.every((a: any) => a.targetType === 'community'));
    assert.equal((await A('GET', `/audit-logs?actor=${admin.id}&limit=1`)).body.data.length, 1);
    assert.equal((await A('GET', '/audit-logs?actor=00000000-0000-0000-0000-000000000000')).body.data.length, 0);
    assert.equal((await A('GET', `/audit-logs?from=${encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString())}`)).body.data.length, 0);
    assert.equal((await A('GET', '/audit-logs?from=khong-phai-ngay')).status, 400);
  });
});
