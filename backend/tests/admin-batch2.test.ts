import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ensureMainCourse, makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

// env.ts parse lúc import app, nên phải đặt TRƯỚC startTestServer().
const ADMIN_EMAIL = 'platform-admin-batch2@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'sofinhub-admin2-uploads-'));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

/** Admin đợt 2: Content · Payments · Discovery (tác động lên API công khai được kiểm tra bằng token của thành viên thường). */
describe('admin đợt 2', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let admin: { token: string; id: string };
  let flush: () => Promise<void>;
  let notifs: () => Array<{ userId: string; type: string; title: string; body: string }>;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let mockGateway: typeof import('../src/modules/payments/payments.gateway.js').mockGateway;
  let origin: string;
  const PW = 'Passw0rd!x';
  const A = (method: string, path: string, body?: unknown) => c.call(method, `/admin${path}`, { token: admin.token, body });
  const GET = (path: string) => A('GET', path);
  let seq = 0;
  const uniq = (p: string) => `${p}${Date.now().toString(36)}${seq++}`;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    origin = server.baseUrl.replace(/\/api$/, '');
    const svc = await import('../src/modules/notifications/notifications.service.js');
    flush = svc.flushNotifications;
    notifs = () => svc.notificationStore.all() as never;
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ mockGateway } = await import('../src/modules/payments/payments.gateway.js'));
    const r = await c.call('POST', '/auth/register', { body: { email: ADMIN_EMAIL, password: PW, firstName: 'Plat', lastName: 'Admin' } });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  /* ------------------------------------------------------------------ dựng dữ liệu */
  type U = { token: string; id: string };
  async function com(opts: { owner?: U; price?: number; title?: string; rating?: number; category?: string; discovery?: 'listed' | 'hidden' | 'unlisted'; search?: 'searchable' | 'reduced' | 'hidden' } = {}) {
    const id = uniq('b2-');
    await db.prisma.community.create({
      data: {
        id, title: opts.title ?? `Cộng đồng ${id}`, description: 'Mô tả cộng đồng thử nghiệm đủ dài để qua ngưỡng chất lượng của bảng xếp hạng.', category: (opts.category ?? 'tech') as never,
        thumbnail: '/x.webp', instructorName: 'Ai đó', instructorRole: 'Chủ', priceCents: (opts.price ?? 0) * 100, pricing: opts.price ? 'paid' : 'free', rating: opts.rating ?? 0,
        ratingCount: opts.rating ? 10 : 0, ownerId: opts.owner?.id ?? null, discoveryStatus: opts.discovery ?? 'listed', searchVisibility: opts.search ?? 'searchable',
      },
    });
    if (opts.owner) await db.prisma.enrollment.create({ data: { userId: opts.owner.id, communityId: id, role: 'owner' } });
    return id;
  }
  const join_ = (u: U, communityId: string) => db.prisma.enrollment.upsert({ where: { userId_communityId: { userId: u.id, communityId } }, create: { userId: u.id, communityId, role: 'member' }, update: {} });
  const mkPost = (communityId: string, authorId: string, content = `Bài viết ${uniq('p')}`) => db.prisma.post.create({ data: { communityId, authorId, content } });
  const actions = async (targetId: string) => ((await GET(`/audit-logs?targetId=${encodeURIComponent(targetId)}&limit=100`)).body.data as Array<{ action: string }>).map((a) => a.action);
  const notifFor = async (userId: string) => {
    await flush();
    return notifs().filter((n) => n.userId === userId);
  };
  /** Tạo cộng đồng có phí + thành viên đã thanh toán thành công qua luồng thật (checkout + confirm). */
  async function payFlow(price = 20) {
    const owner = await c.registerUser('own');
    const buyer = await c.registerUser('buy');
    const courseId = await com({ owner, price });
    const co = await c.call('POST', `/courses/${courseId}/checkout`, { token: buyer.token, body: { method: 'stripe' } });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: buyer.token });
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return { owner, buyer, courseId, paymentId: co.body.data.id as string };
  }

  /* ------------------------------------------------------------------ phân quyền */
  it('mọi route đợt 2: 401 khi thiếu token, 403 khi không phải Platform Admin', async () => {
    const u = await c.registerUser('plain');
    const routes: [string, string][] = [
      ['GET', '/admin/content/posts/summary'], ['GET', '/admin/content/posts'], ['GET', '/admin/content/posts/x'], ['POST', '/admin/content/posts/x/hide'], ['POST', '/admin/content/posts/bulk'],
      ['GET', '/admin/content/comments'], ['POST', '/admin/content/comments/x/remove'], ['GET', '/admin/content/courses'], ['POST', '/admin/content/courses/x/publish'],
      ['GET', '/admin/content/lessons'], ['POST', '/admin/content/lessons/x/hide'], ['GET', '/admin/content/events'], ['PATCH', '/admin/content/events/x'], ['POST', '/admin/content/events/x/cancel'],
      ['GET', '/admin/content/media'], ['GET', '/admin/content/media/x/download'], ['POST', '/admin/content/media/x/remove'],
      ['GET', '/admin/payments/transactions'], ['GET', '/admin/payments/transactions/summary'], ['POST', '/admin/payments/transactions/x/refund'], ['POST', '/admin/payments/transactions/x/retry'],
      ['GET', '/admin/payments/subscriptions'], ['POST', '/admin/payments/subscriptions/x/pause'], ['GET', '/admin/payments/refunds'], ['POST', '/admin/payments/refunds/x/approve'],
      ['GET', '/admin/payments/chargebacks'], ['POST', '/admin/payments/chargebacks'], ['POST', '/admin/payments/chargebacks/x/accept'], ['GET', '/admin/payments/creators'],
      ['GET', '/admin/payments/creators/x'], ['GET', '/admin/payments/payouts'], ['POST', '/admin/payments/payouts/x/hold'],
      ['GET', '/admin/discovery/communities'], ['POST', '/admin/discovery/communities/x/status'], ['GET', '/admin/discovery/categories'], ['POST', '/admin/discovery/categories'],
      ['GET', '/admin/discovery/featured'], ['POST', '/admin/discovery/featured'], ['GET', '/admin/discovery/rankings'], ['PUT', '/admin/discovery/rankings'],
      ['GET', '/admin/discovery/search-visibility'], ['POST', '/admin/discovery/communities/x/search-visibility'],
    ];
    for (const [m, p] of routes) {
      const withBody = m === 'POST' || m === 'PUT' || m === 'PATCH';
      assert.equal((await c.call(m, p, { body: withBody ? {} : undefined })).status, 401, `${m} ${p} thiếu token`);
      assert.equal((await c.call(m, p, { token: u.token, body: withBody ? {} : undefined })).status, 403, `${m} ${p} không phải admin`);
    }
  });

  /* ================================================================== CONTENT */
  describe('content: posts & comments', () => {
    it('hide/remove/restore bài viết: đổi hiển thị ở API công khai, audit, thông báo tác giả, 409/404/400', async () => {
      const owner = await c.registerUser('o');
      const author = await c.registerUser('author');
      const viewer = await c.registerUser('viewer');
      const courseId = await com({ owner });
      await join_(author, courseId);
      await join_(viewer, courseId);
      const p = await mkPost(courseId, author.id);
      const list = async (u: U) => ((await c.call('GET', `/courses/${courseId}/posts?limit=50`, { token: u.token })).body.data as Array<{ id: string }>).map((x) => x.id);
      assert.ok((await list(viewer)).includes(p.id));

      assert.equal((await A('POST', `/content/posts/${p.id}/hide`, {})).status, 400); // thiếu lý do
      const h = await A('POST', `/content/posts/${p.id}/hide`, { reason: 'Spam' });
      assert.equal(h.status, 200, JSON.stringify(h.body));
      assert.equal(h.body.data.status, 'hidden');
      assert.equal(h.body.data.moderationReason, 'Spam');
      assert.ok(!(await list(viewer)).includes(p.id), 'thành viên thường không còn thấy bài bị ẩn');
      assert.ok((await list(author)).includes(p.id), 'tác giả vẫn thấy bài bị ẩn (như mod hide)');
      assert.equal((await A('POST', `/content/posts/${p.id}/hide`, { reason: 'x' })).status, 409);
      assert.ok((await notifFor(author.id)).some((n) => n.title.includes('bị ẩn')));

      const r = await A('POST', `/content/posts/${p.id}/remove`, { reason: 'Scam', notifyAuthor: false });
      assert.equal(r.body.data.status, 'removed');
      assert.ok(!(await list(author)).includes(p.id), 'bài bị gỡ: tác giả cũng không thấy');
      assert.equal((await c.call('GET', `/posts/${p.id}`, { token: author.token })).status, 404);
      assert.equal((await A('POST', `/content/posts/${p.id}/remove`, { reason: 'x' })).status, 409);

      const rs = await A('POST', `/content/posts/${p.id}/restore`, {});
      assert.equal(rs.body.data.status, 'published');
      assert.ok((await list(viewer)).includes(p.id));
      assert.equal((await A('POST', `/content/posts/${p.id}/restore`, {})).status, 409);
      assert.equal((await A('POST', `/content/posts/nope/hide`, { reason: 'x' })).status, 404);
      assert.deepEqual((await actions(p.id)).sort(), ['post.hide', 'post.remove', 'post.restore']);
    });

    it('list/summary/detail: lọc theo status, under_review, courseId, q, sort=reports; phân trang', async () => {
      const owner = await c.registerUser('o');
      const author = await c.registerUser('author');
      const reporter = await c.registerUser('rep');
      const courseId = await com({ owner });
      const needle = uniq('needle');
      const [a, b, d] = await Promise.all([mkPost(courseId, author.id, `${needle} một`), mkPost(courseId, author.id, `${needle} hai`), mkPost(courseId, author.id, `${needle} ba`)]);
      await db.prisma.report.create({ data: { communityId: courseId, targetType: 'post', targetId: b.id, targetUserId: author.id, reporterId: reporter.id, reason: 'spam', targetExcerpt: 'x' } });
      await A('POST', `/content/posts/${d.id}/hide`, { reason: 'x' });
      const sum0 = (await GET('/content/posts/summary')).body.data;
      assert.ok(sum0.total >= 3 && sum0.hidden >= 1 && sum0.reported >= 1);

      const all = await GET(`/content/posts?courseId=${courseId}&limit=2&page=1`);
      assert.equal(all.body.meta.total, 3);
      assert.equal(all.body.data.length, 2);
      const rev = await GET(`/content/posts?courseId=${courseId}&status=under_review`);
      assert.deepEqual(rev.body.data.map((x: any) => x.id), [b.id]);
      assert.equal(rev.body.data[0].underReview, true);
      assert.equal(rev.body.data[0].reports, 1);
      assert.deepEqual((await GET(`/content/posts?courseId=${courseId}&status=hidden`)).body.data.map((x: any) => x.id), [d.id]);
      assert.equal((await GET(`/content/posts?q=${needle}`)).body.meta.total, 3);
      assert.equal((await GET(`/content/posts?q=${a.id.slice(0, 8)}`)).body.data[0].id, a.id, 'tìm theo mã POST-xxxx');
      assert.equal((await GET(`/content/posts?courseId=${courseId}&sort=reports`)).body.data[0].id, b.id);
      assert.equal((await GET('/content/posts?status=bogus')).status, 400);
      assert.equal((await GET('/content/posts?sort=bogus')).status, 400);
      const det = (await GET(`/content/posts/${b.id}`)).body.data;
      assert.equal(det.reportList.length, 1);
      assert.match(det.reportList[0].caseCode, /^CASE-\d{5}$/);
      assert.equal(det.content, `${needle} hai`);
    });

    it('bulk: hide nhiều bài, bỏ qua bài không hợp lệ; validate', async () => {
      const author = await c.registerUser('author');
      const courseId = await com();
      const p1 = await mkPost(courseId, author.id);
      const p2 = await mkPost(courseId, author.id);
      assert.equal((await A('POST', '/content/posts/bulk', { action: 'hide', ids: [p1.id] })).status, 400); // thiếu lý do
      assert.equal((await A('POST', '/content/posts/bulk', { action: 'hide', ids: [] , reason: 'x'})).status, 400);
      await A('POST', `/content/posts/${p2.id}/hide`, { reason: 'x' });
      const r = await A('POST', '/content/posts/bulk', { action: 'hide', ids: [p1.id, p2.id, 'missing'], reason: 'Spam' });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.updated, 1);
      assert.equal(r.body.data.skipped.length, 2);
      const r2 = await A('POST', '/content/posts/bulk', { action: 'restore', ids: [p1.id, p2.id] });
      assert.equal(r2.body.data.updated, 2);
    });

    it('comments: remove giảm commentsCount và ẩn khỏi API công khai; restore đưa lại', async () => {
      const author = await c.registerUser('author');
      const courseId = await com();
      await join_(author, courseId);
      const post = await mkPost(courseId, author.id);
      const cr = await c.call('POST', `/posts/${post.id}/comments`, { token: author.token, body: { content: 'bình luận thử' } });
      assert.equal(cr.status, 201, JSON.stringify(cr.body));
      const cid = cr.body.data.id as string;
      const count = async () => (await db.prisma.post.findUniqueOrThrow({ where: { id: post.id } })).commentsCount;
      assert.equal(await count(), 1);
      const rm = await A('POST', `/content/comments/${cid}/remove`, { reason: 'Harassment' });
      assert.equal(rm.body.data.status, 'removed');
      assert.equal(await count(), 0);
      const pub = await c.call('GET', `/posts/${post.id}/comments`, { token: author.token });
      assert.equal(pub.body.data.length, 0);
      assert.equal((await A('POST', `/content/comments/${cid}/remove`, { reason: 'x' })).status, 409);
      await A('POST', `/content/comments/${cid}/restore`, {});
      assert.equal(await count(), 1);
      assert.equal((await c.call('GET', `/posts/${post.id}/comments`, { token: author.token })).body.data.length, 1);
      const h = await A('POST', `/content/comments/${cid}/hide`, { reason: 'Spam' });
      assert.equal(h.body.data.status, 'hidden');
      assert.equal((await GET(`/content/comments?postId=${post.id}&status=hidden`)).body.meta.total, 1);
      assert.equal((await GET(`/content/comments/${cid}`)).body.data.post.id, post.id);
      assert.ok((await GET('/content/comments/summary')).body.data.hidden >= 1);
      assert.equal((await A('POST', '/content/comments/bulk', { action: 'remove', ids: [cid], reason: 'x' })).body.data.updated, 1);
    });
  });

  describe('content: courses, lessons, events, media', () => {
    async function classroom() {
      const owner = await c.registerUser('o');
      const member = await c.registerUser('m');
      const courseId = await com({ owner });
      await join_(member, courseId);
      // POST /communities đã tạo khóa học mặc định; "khóa học" của admin = entity Course.
      await ensureMainCourse(db.prisma, courseId);
      const course = await db.prisma.course.findFirstOrThrow({ where: { communityId: courseId } });
      const mod = await db.prisma.classroomModule.create({ data: { communityId: courseId, learningCourseId: course.id, index: 1, title: uniq('Module ') } });
      const lesson = await db.prisma.classroomLesson.create({ data: { moduleId: mod.id, communityId: courseId, index: 1, title: uniq('Bài '), type: 'text', body: 'nội dung' } });
      const lesson2 = await db.prisma.classroomLesson.create({ data: { moduleId: mod.id, communityId: courseId, index: 2, title: uniq('Bài '), type: 'video', body: 'nội dung' } });
      return { owner, member, courseId, course, mod, lesson, lesson2 };
    }
    const modules = async (m: U, courseId: string) => (await c.call('GET', `/courses/${courseId}/modules`, { token: m.token })).body.data as Array<{ id: string; lessonsCount?: number }>;

    it('courses: unpublish/archive/publish/remove/restore điều khiển việc thành viên thấy khóa học; 409; audit', async () => {
      const { owner, member, courseId, course, mod } = await classroom();
      assert.ok((await modules(member, courseId)).some((m) => m.id === mod.id));
      assert.equal((await A('POST', `/content/courses/${course.id}/publish`, {})).status, 409);
      assert.equal((await A('POST', `/content/courses/${course.id}/unpublish`, {})).status, 400);
      const u = await A('POST', `/content/courses/${course.id}/unpublish`, { reason: 'Quality' });
      assert.equal(u.body.data.status, 'draft');
      assert.ok(!(await modules(member, courseId)).some((m) => m.id === mod.id));
      assert.ok((await notifFor(owner.id)).some((n) => n.title.includes('hủy xuất bản')));
      assert.equal((await A('POST', `/content/courses/${course.id}/unpublish`, { reason: 'x' })).status, 409);
      assert.equal((await A('POST', `/content/courses/${course.id}/publish`, {})).body.data.status, 'published');
      assert.ok((await modules(member, courseId)).some((m) => m.id === mod.id));
      assert.equal((await A('POST', `/content/courses/${course.id}/archive`, {})).body.data.status, 'archived');
      assert.ok(!(await modules(member, courseId)).some((m) => m.id === mod.id));
      const rm = await A('POST', `/content/courses/${course.id}/remove`, { reason: 'Policy' });
      assert.equal(rm.body.data.status, 'removed');
      assert.equal((await A('POST', `/content/courses/${course.id}/remove`, { reason: 'x' })).status, 409);
      assert.equal((await A('POST', `/content/courses/${course.id}/restore`, {})).body.data.status, 'archived'); // giữ trạng thái xuất bản trước đó
      assert.equal((await A('POST', `/content/courses/${course.id}/restore`, {})).status, 409);
      assert.equal((await A('POST', '/content/courses/nope/publish', {})).status, 404);
      const l = await GET(`/content/courses?courseId=${courseId}&status=archived`);
      assert.equal(l.body.meta.total, 1);
      assert.equal(l.body.data[0].lessons, 2);
      assert.equal(l.body.data[0].creator.id, owner.id);
      assert.equal((await GET(`/content/courses/${course.id}`)).body.data.lessonList.length, 2);
      assert.ok((await actions(course.id)).includes('course.unpublish'));
      assert.ok((await GET('/content/courses/summary')).body.data.archived >= 1);
      assert.equal((await GET('/content/courses?status=nope')).status, 400);
    });

    it('lessons: hide/remove ẩn bài khỏi thành viên (danh sách + chi tiết), restore trả lại', async () => {
      const { member, courseId, mod, lesson, lesson2 } = await classroom();
      const lessons = async () => (await c.call('GET', `/courses/${courseId}/modules/${mod.id}/lessons`, { token: member.token })).body.data.map((l: any) => l.id) as string[];
      assert.deepEqual((await lessons()).sort(), [lesson.id, lesson2.id].sort());
      const h = await A('POST', `/content/lessons/${lesson.id}/hide`, { reason: 'Outdated' });
      assert.equal(h.body.data.status, 'hidden');
      assert.deepEqual(await lessons(), [lesson2.id]);
      assert.equal((await c.call('GET', `/courses/${courseId}/lessons/${lesson.id}`, { token: member.token })).status, 404);
      assert.equal((await A('POST', `/content/lessons/${lesson.id}/hide`, { reason: 'x' })).status, 409);
      assert.equal((await A('POST', `/content/lessons/${lesson2.id}/remove`, { reason: 'Policy' })).body.data.status, 'removed');
      assert.deepEqual(await lessons(), []);
      await A('POST', `/content/lessons/${lesson.id}/restore`, {});
      await A('POST', `/content/lessons/${lesson2.id}/restore`, {});
      assert.equal((await lessons()).length, 2);
      const l = await GET(`/content/lessons?moduleId=${mod.id}&type=video`);
      assert.equal(l.body.meta.total, 1);
      assert.equal(l.body.data[0].id, lesson2.id);
      assert.match(l.body.data[0].code, /^LSN-/);
      assert.equal((await GET(`/content/lessons/${lesson.id}`)).body.data.body, 'nội dung');
      assert.equal((await GET('/content/lessons/nope')).status, 404);
      assert.ok((await GET('/content/lessons/summary')).body.data.total >= 2);
    });

    it('events: cancel chặn RSVP + thông báo người đã RSVP; remove ẩn khỏi API công khai; patch/capacity; restore; 409', async () => {
      const owner = await c.registerUser('o');
      const m1 = await c.registerUser('m1');
      const m2 = await c.registerUser('m2');
      const courseId = await com({ owner });
      await join_(m1, courseId);
      await join_(m2, courseId);
      const ev = await db.prisma.communityEvent.create({ data: { communityId: courseId, hostId: owner.id, title: uniq('Sự kiện '), startAt: new Date(Date.now() + 3 * 86_400_000), timezone: 'UTC', meetingLink: 'https://meet.example.com/x' } });
      assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: m1.token })).status, 200);
      const one = (await GET(`/content/events/${ev.id}`)).body.data;
      assert.equal(one.status, 'upcoming');
      assert.equal(one.attendees, 1);

      assert.equal((await A('PATCH', `/content/events/${ev.id}`, {})).status, 400);
      assert.equal((await A('PATCH', `/content/events/${ev.id}`, { capacity: 1 })).status, 200);
      assert.equal((await A('PATCH', `/content/events/${ev.id}`, { capacity: 1, title: 'Tên mới' })).body.data.title, 'Tên mới');

      assert.equal((await A('POST', `/content/events/${ev.id}/cancel`, {})).status, 400);
      const cx = await A('POST', `/content/events/${ev.id}/cancel`, { reason: 'Host unavailable' });
      assert.equal(cx.body.data.status, 'cancelled');
      assert.equal(cx.body.data.cancelReason, 'Host unavailable');
      assert.ok((await notifFor(m1.id)).some((n) => n.title.includes('hủy')), 'người đã RSVP được báo');
      assert.ok(!(await notifFor(m2.id)).some((n) => n.title.includes('hủy')), 'người chưa RSVP không bị báo');
      const rs = await c.call('POST', `/events/${ev.id}/rsvp`, { token: m2.token });
      assert.equal(rs.status, 409, 'sự kiện bị hủy không RSVP được');
      const pubList = (await c.call('GET', `/courses/${courseId}/events`, { token: m2.token })).body.data as Array<{ id: string; cancelledAt?: string }>;
      assert.ok(pubList.find((e) => e.id === ev.id)?.cancelledAt, 'API công khai báo cancelledAt');
      assert.equal((await A('POST', `/content/events/${ev.id}/cancel`, { reason: 'x' })).status, 409);

      assert.equal((await A('POST', `/content/events/${ev.id}/remove`, { reason: 'Policy', notifyAttendees: false })).body.data.status, 'removed');
      assert.equal((await c.call('GET', `/events/${ev.id}`, { token: m2.token })).status, 404);
      assert.ok(!((await c.call('GET', `/courses/${courseId}/events`, { token: m2.token })).body.data as Array<{ id: string }>).some((e) => e.id === ev.id));
      const back = await A('POST', `/content/events/${ev.id}/restore`, {});
      assert.equal(back.body.data.status, 'upcoming');
      assert.equal((await A('POST', `/content/events/${ev.id}/restore`, {})).status, 409);
      assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: m2.token })).status, 409); // capacity 1 đã đầy
      const l = await GET(`/content/events?courseId=${courseId}&status=upcoming`);
      assert.equal(l.body.meta.total, 1);
      assert.equal((await GET('/content/events/summary')).body.data.upcoming >= 1, true);
      assert.equal((await A('POST', '/content/events/nope/cancel', { reason: 'x' })).status, 404);
      assert.deepEqual([...new Set((await actions(ev.id)).sort())], ['event.cancel', 'event.remove', 'event.restore', 'event.update']);
    });

    it('events: live/completed phân loại theo giờ bắt đầu', async () => {
      const courseId = await com();
      const host = await c.registerUser('h');
      const mk = (offsetMs: number) => db.prisma.communityEvent.create({ data: { communityId: courseId, hostId: host.id, title: uniq('E'), startAt: new Date(Date.now() + offsetMs), timezone: 'UTC' } });
      const [live, done] = await Promise.all([mk(-30 * 60_000), mk(-5 * 3_600_000)]);
      assert.equal((await GET(`/content/events/${live.id}`)).body.data.status, 'live');
      assert.equal((await GET(`/content/events/${done.id}`)).body.data.status, 'completed');
      assert.deepEqual((await GET(`/content/events?courseId=${courseId}&status=live`)).body.data.map((e: any) => e.id), [live.id]);
      assert.equal((await A('POST', `/content/events/${done.id}/cancel`, { reason: 'x' })).status, 409, 'sự kiện đã kết thúc không hủy được');
    });

    it('media: flag/unflag/remove/restore; file bị gỡ không còn tải công khai nhưng admin tải được', async () => {
      const owner = await c.registerUser('mediaowner');
      const pre = await c.call('POST', '/uploads/presign', { token: owner.token, body: { filename: 'a.png', contentType: 'image/png', size: PNG.length, purpose: 'post_image' } });
      assert.equal(pre.status, 201, JSON.stringify(pre.body));
      const put = await fetch(origin + pre.body.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: PNG });
      assert.equal(put.status, 200);
      const key = pre.body.data.key as string;
      const pub = () => fetch(`${origin}/api/files/${key}`);
      assert.equal((await pub()).status, 200);

      const d = (await GET(`/content/media/${key}`)).body.data;
      assert.equal(d.kind, 'image');
      assert.equal(d.status, 'active');
      assert.equal(d.url, `/api/files/${key}`);
      assert.equal((await A('POST', `/content/media/${key}/unflag`, {})).status, 409);
      const f = await A('POST', `/content/media/${key}/flag`, { reason: 'Inappropriate' });
      assert.equal(f.body.data.status, 'flagged');
      assert.equal(f.body.data.reports, 1);
      assert.equal((await A('POST', `/content/media/${key}/flag`, { reason: 'x' })).status, 409);
      assert.equal((await GET(`/content/media?status=flagged&ownerId=${owner.id}`)).body.meta.total, 1);
      assert.equal((await A('POST', `/content/media/${key}/unflag`, {})).body.data.status, 'active');

      const rm = await A('POST', `/content/media/${key}/remove`, { reason: 'Malware' });
      assert.equal(rm.body.data.status, 'removed');
      assert.equal(rm.body.data.url, null);
      assert.equal((await pub()).status, 404, 'file đã gỡ: URL công khai 404');
      assert.ok((await c.call('GET', '/me/uploads', { token: owner.token })).body.data.every((u: any) => u.key !== key));
      const dl = await fetch(`${origin}/api/admin/content/media/${key}/download`, { headers: { Authorization: `Bearer ${admin.token}` } });
      assert.equal(dl.status, 200, 'admin vẫn tải được file đã gỡ');
      assert.equal((await dl.arrayBuffer()).byteLength, PNG.length);
      assert.equal((await fetch(`${origin}/api/admin/content/media/${key}/download`)).status, 401);
      assert.ok((await notifFor(owner.id)).some((n) => n.title.includes('đã bị gỡ')));
      assert.equal((await A('POST', `/content/media/${key}/remove`, { reason: 'x' })).status, 409);
      assert.equal((await A('POST', `/content/media/${key}/restore`, {})).body.data.status, 'active');
      assert.equal((await pub()).status, 200, 'khôi phục: phục vụ lại');
      assert.equal((await GET('/content/media/ffffffffffffffffffffffffffffffff.png')).status, 404);
      assert.equal((await GET('/content/media?kind=video&ownerId=' + owner.id)).body.meta.total, 0);
      assert.equal((await GET('/content/media?kind=image&ownerId=' + owner.id)).body.meta.total, 1);
      const s = (await GET('/content/media/summary')).body.data;
      assert.ok(s.total >= 1 && s.byKind.image >= 1 && s.totalSizeBytes > 0);
      assert.deepEqual((await actions(key)).sort(), ['media.flag', 'media.remove', 'media.restore', 'media.unflag']);
    });
  });

  /* ================================================================== PAYMENTS */
  describe('payments: transactions & subscriptions', () => {
    it('transactions: list/detail với phí theo PLATFORM_COMMISSION_PCT, lọc, summary', async () => {
      const { owner, buyer, courseId, paymentId } = await payFlow(20);
      const l = await GET(`/payments/transactions?courseId=${courseId}`);
      assert.equal(l.status, 200);
      assert.equal(l.body.meta.total, 1);
      const t = l.body.data[0];
      assert.equal(t.id, paymentId);
      assert.match(t.code, /^TXN-[0-9A-F]{8}$/);
      assert.equal(t.status, 'succeeded');
      assert.equal(t.amountCents, 2000);
      assert.equal(t.platformFeeCents, 200, '10% hoa hồng mặc định');
      assert.equal(t.gatewayFeeCents, 88, '2.9% + 30 cent');
      assert.equal(t.creatorEarningsCents, 2000 - 200 - 88);
      assert.equal(t.customer.id, buyer.id);
      assert.equal(t.community.ownerName.length > 0, true);
      assert.match(t.invoiceNumber, /^INV-/);
      assert.equal(t.product.label, 'Membership · Monthly');

      const d = (await GET(`/payments/transactions/${paymentId}`)).body.data;
      assert.equal(d.creator.id, owner.id);
      assert.equal(d.subscription.status, 'active');
      assert.ok(d.timeline.some((e: any) => e.type === 'payment_captured'));
      assert.equal(d.gateway, 'Stripe (mock)');
      assert.equal((await GET(`/payments/transactions?q=${t.invoiceNumber}`)).body.data[0].id, paymentId);
      assert.equal((await GET(`/payments/transactions?q=${t.code}`)).body.data[0].id, paymentId);
      assert.equal((await GET(`/payments/transactions?ownerId=${owner.id}&status=failed`)).body.meta.total, 0);
      assert.equal((await GET(`/payments/transactions?userId=${buyer.id}&method=stripe&kind=initial`)).body.meta.total, 1);
      assert.equal((await GET('/payments/transactions?status=bogus')).status, 400);
      assert.equal((await GET('/payments/transactions?from=not-a-date')).status, 400);
      assert.equal((await GET('/payments/transactions/nope')).status, 404);
      const s = (await GET('/payments/transactions/summary')).body.data;
      assert.ok(s.grossVolumeCents >= 2000 && s.netRevenueCents >= 200 && s.transactions >= 1);
      const future = (await GET('/payments/transactions/summary?from=2999-01-01')).body.data;
      assert.equal(future.transactions, 0);
      assert.equal(future.failedRatePct, 0);
    });

    it('refund trực tiếp 1 phần/toàn phần: trạng thái, thu hồi quyền, 409/400, audit', async () => {
      const { buyer, courseId, paymentId } = await payFlow(50);
      assert.equal((await A('POST', `/payments/transactions/${paymentId}/refund`, {})).status, 400);
      assert.equal((await A('POST', `/payments/transactions/${paymentId}/refund`, { reason: 'x', amountCents: 999999 })).status, 400);
      const r = await A('POST', `/payments/transactions/${paymentId}/refund`, { reason: 'Goodwill', amountCents: 1000 });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.transaction.status, 'refunded');
      assert.equal(r.body.data.transaction.refundedCents, 1000);
      assert.equal(r.body.data.refund.status, 'approved');
      assert.equal(r.body.data.refund.amountCents, 1000);
      assert.equal(await enrollmentService.isEnrolled(buyer.id, courseId), true, 'hoàn một phần: giữ quyền truy cập');
      assert.equal((await A('POST', `/payments/transactions/${paymentId}/refund`, { reason: 'again' })).status, 409);

      const second = await payFlow(50);
      const full = await A('POST', `/payments/transactions/${second.paymentId}/refund`, { reason: 'Duplicate charge' });
      assert.equal(full.body.data.transaction.refundedCents, 5000);
      assert.equal(await enrollmentService.isEnrolled(second.buyer.id, second.courseId), false, 'hoàn toàn bộ: thu hồi quyền');
      assert.ok((await notifFor(second.buyer.id)).some((n) => n.title.includes('Hoàn tiền')));
      assert.deepEqual(await actions(second.paymentId), ['payment.refund']);
      assert.equal((await A('POST', '/payments/transactions/nope/refund', { reason: 'x' })).status, 404);
    });

    it('failed + retry: thất bại ghi failureReason; retry thành công kích hoạt gói; 409 cho giao dịch không phải failed', async () => {
      const owner = await c.registerUser('o');
      const buyer = await c.registerUser('buy');
      const courseId = await com({ owner, price: 15 });
      mockGateway.failFor(buyer.id, true);
      const co = await c.call('POST', `/courses/${courseId}/checkout`, { token: buyer.token, body: { method: 'momo' } });
      const cf = await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: buyer.token });
      assert.equal(cf.status, 402);
      const id = co.body.data.id as string;
      const t = (await GET(`/payments/transactions/${id}`)).body.data;
      assert.equal(t.status, 'failed');
      assert.equal(t.failureReason, 'card_declined');
      assert.equal(t.creatorEarningsCents, 0);
      assert.ok(t.timeline.some((e: any) => e.type === 'payment_failed'));
      // cổng vẫn từ chối -> vẫn failed
      assert.equal((await A('POST', `/payments/transactions/${id}/retry`, {})).body.data.status, 'failed');
      mockGateway.failFor(buyer.id, false);
      const ok = await A('POST', `/payments/transactions/${id}/retry`, { note: 'Khách đã đổi thẻ' });
      assert.equal(ok.body.data.status, 'succeeded');
      assert.equal(await enrollmentService.isEnrolled(buyer.id, courseId), true);
      assert.equal((await A('POST', `/payments/transactions/${id}/retry`, {})).status, 409);
      assert.equal((await GET(`/payments/transactions?status=failed&courseId=${courseId}`)).body.meta.total, 0);
    });

    it('subscriptions: pause thu hồi quyền, resume cấp lại, cancel cuối kỳ / tức thì; 409; audit; thông báo', async () => {
      const { buyer, courseId, paymentId } = await payFlow(30);
      const sub = (await GET(`/payments/transactions/${paymentId}`)).body.data.subscription;
      const sid = sub.id as string;
      const s = (await GET(`/payments/subscriptions?courseId=${courseId}`)).body;
      assert.equal(s.meta.total, 1);
      assert.equal(s.data[0].status, 'active');
      assert.equal(s.data[0].amountCents, 3000);
      assert.ok(s.data[0].nextBillingAt);

      assert.equal((await A('POST', `/payments/subscriptions/${sid}/pause`, {})).status, 400);
      const p = await A('POST', `/payments/subscriptions/${sid}/pause`, { reason: 'Payment risk' });
      assert.equal(p.body.data.status, 'paused');
      assert.equal(p.body.data.nextBillingAt, null);
      assert.equal(await enrollmentService.isEnrolled(buyer.id, courseId), false);
      assert.ok((await notifFor(buyer.id)).some((n) => n.title.includes('tạm dừng')));
      assert.equal((await A('POST', `/payments/subscriptions/${sid}/pause`, { reason: 'x' })).status, 409);
      const r = await A('POST', `/payments/subscriptions/${sid}/resume`, {});
      assert.equal(r.body.data.status, 'active');
      assert.equal(await enrollmentService.isEnrolled(buyer.id, courseId), true);
      assert.equal((await A('POST', `/payments/subscriptions/${sid}/resume`, {})).status, 409);

      const end = await A('POST', `/payments/subscriptions/${sid}/cancel`, { reason: 'Customer asked', atPeriodEnd: true });
      assert.equal(end.body.data.status, 'active');
      assert.equal(end.body.data.cancelAtPeriodEnd, true);
      assert.equal(end.body.data.nextBillingAt, null);
      assert.equal(await enrollmentService.isEnrolled(buyer.id, courseId), true);
      assert.equal((await A('POST', `/payments/subscriptions/${sid}/cancel`, { reason: 'x', atPeriodEnd: true })).status, 409);
      const now = await A('POST', `/payments/subscriptions/${sid}/cancel`, { reason: 'Fraud' });
      assert.equal(now.body.data.status, 'canceled');
      assert.equal(await enrollmentService.isEnrolled(buyer.id, courseId), false);
      assert.equal((await A('POST', `/payments/subscriptions/${sid}/cancel`, { reason: 'x' })).status, 409);
      assert.equal((await A('POST', '/payments/subscriptions/nope/cancel', { reason: 'x' })).status, 404);
      assert.equal((await GET(`/payments/subscriptions/${sid}`)).body.data.payments.length, 1);
      assert.deepEqual([...new Set(await actions(sid))].sort(), ['subscription.cancel', 'subscription.cancel_at_period_end', 'subscription.pause', 'subscription.resume']);
      const sum = (await GET('/payments/subscriptions/summary')).body.data;
      assert.ok(['active', 'new30d', 'mrrCents', 'churnPct', 'pastDue', 'paused'].every((k) => k in sum));
      assert.equal((await GET('/payments/subscriptions?status=past_due,paused')).status, 200);
      assert.equal((await GET('/payments/subscriptions?status=bogus')).status, 400);
    });
  });

  describe('payments: refunds, chargebacks', () => {
    async function pendingRefund(price = 40) {
      const f = await payFlow(price);
      const r = await db.prisma.refundRequest.create({ data: { paymentId: f.paymentId, communityId: f.courseId, userId: f.buyer.id, amountCents: price * 100, reason: 'Charged twice', status: 'pending' } });
      return { ...f, refundId: r.id };
    }

    it('refunds: list/detail giàu dữ liệu; approve hoàn một phần; reject; 409/400/404; endpoint cũ vẫn hoạt động', async () => {
      const a = await pendingRefund(40);
      const b = await pendingRefund(60);
      const l = await GET(`/payments/refunds?status=pending&courseId=${a.courseId}`);
      assert.equal(l.body.meta.total, 1);
      assert.match(l.body.data[0].code, /^RF-/);
      assert.equal(l.body.data[0].customer.id, a.buyer.id);
      assert.equal(l.body.data[0].creator.id, a.owner.id);
      assert.equal(l.body.data[0].paymentAmountCents, 4000);
      const d = (await GET(`/payments/refunds/${a.refundId}`)).body.data;
      assert.equal(d.payment.id, a.paymentId);
      assert.equal(d.paymentHistory.length, 1);
      assert.equal(d.creatorResponse, null);
      assert.ok(d.customerHistory.memberSince);
      assert.ok((await GET('/payments/refunds/summary')).body.data.pending >= 2);

      assert.equal((await A('POST', `/payments/refunds/${a.refundId}/approve`, { amountCents: 999999 })).status, 400);
      const ap = await A('POST', `/payments/refunds/${a.refundId}/approve`, { amountCents: 1500, note: 'Partial' });
      assert.equal(ap.status, 200, JSON.stringify(ap.body));
      assert.equal(ap.body.data.status, 'approved');
      assert.equal(ap.body.data.amountCents, 1500);
      assert.equal((await db.prisma.payment.findUniqueOrThrow({ where: { id: a.paymentId } })).refundedCents, 1500);
      assert.equal(await enrollmentService.isEnrolled(a.buyer.id, a.courseId), true, 'hoàn một phần giữ quyền');
      assert.equal((await A('POST', `/payments/refunds/${a.refundId}/approve`, {})).status, 409);
      assert.equal((await A('POST', `/payments/refunds/${a.refundId}/reject`, { reason: 'x' })).status, 409);

      assert.equal((await A('POST', `/payments/refunds/${b.refundId}/reject`, {})).status, 400);
      const rj = await A('POST', `/payments/refunds/${b.refundId}/reject`, { reason: 'Outside window', note: 'Đã dùng nhiều' });
      assert.equal(rj.body.data.status, 'rejected');
      assert.ok((await notifFor(b.buyer.id)).some((n) => n.title.includes('từ chối')));
      assert.equal((await GET(`/payments/refunds?status=rejected&courseId=${b.courseId}`)).body.meta.total, 1);
      assert.equal((await A('POST', '/payments/refunds/nope/approve', {})).status, 404);
      assert.deepEqual(await actions(a.refundId), ['refund.approve']);

      // endpoint cũ giữ nguyên
      const c2 = await pendingRefund(25);
      assert.equal((await c.call('GET', '/admin/refunds?status=pending', { token: admin.token })).status, 200);
      const legacy = await c.call('PATCH', `/admin/refunds/${c2.refundId}`, { token: admin.token, body: { action: 'approve' } });
      assert.equal(legacy.status, 200, JSON.stringify(legacy.body));
      assert.equal((await db.prisma.refundRequest.findUniqueOrThrow({ where: { id: c2.refundId } })).status, 'approved');
    });

    it('chargebacks (mô phỏng): tạo, nộp bằng chứng, thắng/thua, accept hoàn tiền + thu hồi quyền; ràng buộc trạng thái', async () => {
      const f = await payFlow(35);
      assert.equal((await A('POST', '/payments/chargebacks', {})).status, 400);
      assert.equal((await A('POST', '/payments/chargebacks', { paymentId: 'nope', reason: 'fraudulent' })).status, 404);
      assert.equal((await A('POST', '/payments/chargebacks', { paymentId: f.paymentId, reason: 'bogus' })).status, 400);
      assert.equal((await A('POST', '/payments/chargebacks', { paymentId: f.paymentId, reason: 'fraudulent', amountCents: 999999 })).status, 400);
      const cr = await A('POST', '/payments/chargebacks', { paymentId: f.paymentId, reason: 'fraudulent', deadlineDays: 5 });
      assert.equal(cr.status, 201, JSON.stringify(cr.body));
      const cb = cr.body.data;
      assert.match(cb.code, /^CB-\d{5}$/);
      assert.equal(cb.status, 'open');
      assert.equal(cb.evidence, 'missing');
      assert.equal(cb.amountCents, 3500);
      assert.ok(cb.daysLeft >= 4 && cb.daysLeft <= 5);
      assert.match(cb.gatewayDisputeId, /^mock_dp_/);
      assert.equal((await A('POST', '/payments/chargebacks', { paymentId: f.paymentId, reason: 'duplicate' })).status, 409, 'đã có chargeback đang xử lý');
      assert.ok((await notifFor(f.owner.id)).some((n) => n.title.includes('tranh chấp')));

      assert.equal((await A('POST', `/payments/chargebacks/${cb.id}/mark-won`, {})).status, 409, 'chỉ chốt khi đang xem xét');
      assert.equal((await A('POST', `/payments/chargebacks/${cb.id}/submit-evidence`, {})).status, 400);
      const ev = await A('POST', `/payments/chargebacks/${cb.id}/submit-evidence`, { note: 'Access logs attached', evidenceUrls: ['https://x.test/e.pdf'] });
      assert.equal(ev.body.data.status, 'under_review');
      assert.equal(ev.body.data.evidence, 'submitted');
      assert.deepEqual(ev.body.data.evidenceUrls, ['https://x.test/e.pdf']);
      const won = await A('POST', `/payments/chargebacks/${cb.id}/mark-won`, { note: 'Issuer accepted' });
      assert.equal(won.body.data.status, 'won');
      assert.equal(won.body.data.daysLeft, null);
      assert.equal((await db.prisma.payment.findUniqueOrThrow({ where: { id: f.paymentId } })).status, 'succeeded', 'thắng: giao dịch giữ nguyên');
      assert.equal((await A('POST', `/payments/chargebacks/${cb.id}/accept`, {})).status, 409);
      assert.equal((await A('POST', `/payments/chargebacks/${cb.id}/submit-evidence`, { note: 'x' })).status, 409);

      // thua: accept => payment refunded + thu hồi quyền
      assert.equal(await enrollmentService.isEnrolled(f.buyer.id, f.courseId), true);
      const cb2 = (await A('POST', '/payments/chargebacks', { paymentId: f.paymentId, reason: 'unrecognized' })).body.data;
      const acc = await A('POST', `/payments/chargebacks/${cb2.id}/accept`, { note: 'No evidence' });
      assert.equal(acc.body.data.status, 'lost');
      const pay = await db.prisma.payment.findUniqueOrThrow({ where: { id: f.paymentId } });
      assert.equal(pay.status, 'refunded');
      assert.equal(pay.refundedCents, 3500);
      assert.equal(await enrollmentService.isEnrolled(f.buyer.id, f.courseId), false);
      assert.equal((await A('POST', '/payments/chargebacks', { paymentId: f.paymentId, reason: 'duplicate' })).status, 409, 'giao dịch đã hoàn không mở chargeback được');

      const d = (await GET(`/payments/chargebacks/${cb.id}`)).body.data;
      assert.equal(d.payment.id, f.paymentId);
      assert.equal((await GET(`/payments/chargebacks?courseId=${f.courseId}&status=won,lost`)).body.meta.total, 2);
      assert.equal((await GET(`/payments/chargebacks?q=${cb.code}`)).body.data[0].id, cb.id);
      assert.equal((await GET('/payments/chargebacks?status=bogus')).status, 400);
      assert.equal((await GET('/payments/chargebacks/nope')).status, 404);
      const s = (await GET('/payments/chargebacks/summary')).body.data;
      assert.ok(s.won >= 1 && s.lost >= 1);
      assert.ok((await actions(cb.id)).includes('chargeback.mark_won'));
      // mark-lost từ under_review
      const f2 = await payFlow(10);
      const c3 = (await A('POST', '/payments/chargebacks', { paymentId: f2.paymentId, reason: 'duplicate' })).body.data;
      await A('POST', `/payments/chargebacks/${c3.id}/submit-evidence`, { note: 'n' });
      assert.equal((await A('POST', `/payments/chargebacks/${c3.id}/mark-lost`, {})).body.data.status, 'lost');
      assert.equal((await db.prisma.payment.findUniqueOrThrow({ where: { id: f2.paymentId } })).status, 'refunded');
    });
  });

  describe('payments: creator revenue & payouts', () => {
    it('creator revenue: tổng hợp theo chủ cộng đồng khớp /courses/:id/revenue; detail có series; 404', async () => {
      const f1 = await payFlow(100);
      const buyer2 = await c.registerUser('buy2');
      const co = await c.call('POST', `/courses/${f1.courseId}/checkout`, { token: buyer2.token, body: { method: 'stripe' } });
      await c.call('POST', `/payments/${co.body.data.id}/confirm`, { token: buyer2.token });
      await A('POST', `/payments/transactions/${co.body.data.id}/refund`, { reason: 'x', amountCents: 2500 });

      const l = await GET(`/payments/creators?q=${encodeURIComponent(f1.owner.id)}`);
      assert.equal(l.status, 200);
      const mine = (await GET('/payments/creators?limit=100')).body.data.find((x: any) => x.creator.id === f1.owner.id);
      assert.ok(mine);
      assert.equal(mine.grossCents, 20000);
      assert.equal(mine.refundsCents, 2500);
      assert.equal(mine.platformFeeCents, 1000 + 750, '10% của phần chưa hoàn: 10000 + 7500');
      assert.equal(mine.communities, 1);
      const rev = (await c.call('GET', `/courses/${f1.courseId}/revenue`, { token: f1.owner.token })).body.data;
      assert.equal(mine.netCents, rev.netCents, 'khớp công thức doanh thu của chủ cộng đồng');
      assert.equal(mine.pendingBalanceCents, rev.totalBalanceCents); // số dư chưa rút toàn thời gian (availableBalanceCents nay = phần rút được sau holding period)

      const d = (await GET(`/payments/creators/${f1.owner.id}`)).body.data;
      assert.equal(d.creator.id, f1.owner.id);
      assert.equal(d.kpis.grossCents, 20000);
      assert.equal(d.series.length, 30);
      assert.equal(d.series.reduce((a: number, x: any) => a + x.grossCents, 0), 20000);
      assert.equal(d.communities[0].id, f1.courseId);
      assert.equal(d.transactions.length, 2);
      const day = (await GET(`/payments/creators/${f1.owner.id}?from=2020-01-01&to=2020-01-05`)).body.data;
      assert.equal(day.series.length, 5);
      assert.equal(day.kpis.grossCents, 0);
      assert.equal(day.kpis.pendingBalanceCents, mine.pendingBalanceCents, 'số dư chờ luôn toàn thời gian');
      assert.equal((await GET('/payments/creators/nope')).status, 404);
      const sum = (await GET('/payments/creators/summary')).body.data;
      assert.ok(sum.creators >= 1 && sum.grossCents >= 20000);
      assert.equal((await GET('/payments/creators?sort=bogus')).status, 400);
    });

    it('payouts: chuỗi trạng thái approve → failed → retry → hold → release → paid; reject; 409; balance; endpoint cũ', async () => {
      const f = await payFlow(200);
      const mk = (amountCents: number, status: 'requested' | 'approved' = 'requested') =>
        db.prisma.payout.create({ data: { communityId: f.courseId, ownerId: f.owner.id, amountCents, bankName: 'Chase', accountHolder: 'Own Er', accountLast4: '1203', status } });
      const p = await mk(5000);
      const d0 = (await GET(`/payments/payouts/${p.id}`)).body.data;
      assert.equal(d0.status, 'requested');
      assert.equal(d0.method.label, 'Bank · Chase •• 1203');
      assert.equal(d0.method.accountMasked, '****1203');
      assert.match(d0.code, /^PO-/);
      assert.ok(['01', '16'].includes(d0.scheduledFor.slice(8, 10)));
      assert.equal(d0.creatorBalance.requestedCents, 5000);
      assert.equal(d0.creatorBalance.availableCents, d0.creatorBalance.netCents - 5000);

      assert.equal((await A('POST', `/payments/payouts/${p.id}/mark-failed`, { reason: 'x' })).status, 409, 'chỉ approved mới fail được');
      assert.equal((await A('POST', `/payments/payouts/${p.id}/retry`, {})).status, 409);
      assert.equal((await A('POST', `/payments/payouts/${p.id}/release`, {})).status, 409);
      assert.equal((await A('POST', `/payments/payouts/${p.id}/approve`, {})).body.data.status, 'approved');
      assert.equal((await A('POST', `/payments/payouts/${p.id}/approve`, {})).status, 409);
      assert.equal((await A('POST', `/payments/payouts/${p.id}/mark-failed`, {})).status, 400);
      const failed = await A('POST', `/payments/payouts/${p.id}/mark-failed`, { reason: 'Bank account closed' });
      assert.equal(failed.body.data.status, 'failed');
      assert.equal(failed.body.data.failureReason, 'Bank account closed');
      assert.ok((await notifFor(f.owner.id)).some((n) => n.title.includes('thất bại')));
      assert.equal((await A('POST', `/payments/payouts/${p.id}/retry`, {})).body.data.status, 'approved');
      assert.equal((await GET(`/payments/payouts/${p.id}`)).body.data.failureReason, null);
      const held = await A('POST', `/payments/payouts/${p.id}/hold`, { reason: 'KYC review' });
      assert.equal(held.body.data.status, 'on_hold');
      assert.equal(held.body.data.heldFromStatus, 'approved');
      assert.equal((await A('POST', `/payments/payouts/${p.id}/hold`, { reason: 'x' })).status, 409);
      assert.equal((await A('POST', `/payments/payouts/${p.id}/approve`, {})).status, 409, 'đang giữ: không duyệt được');
      const rel = await A('POST', `/payments/payouts/${p.id}/release`, {});
      assert.equal(rel.body.data.status, 'approved', 'release trả về trạng thái trước khi giữ');
      const paid = await A('POST', `/payments/payouts/${p.id}/mark-paid`, { note: 'Ref 123' });
      assert.equal(paid.body.data.status, 'paid');
      assert.ok(paid.body.data.paidAt);
      assert.equal((await A('POST', `/payments/payouts/${p.id}/reject`, { reason: 'x' })).status, 409, 'đã chi: không từ chối được');

      const q = await mk(3000);
      assert.equal((await A('POST', `/payments/payouts/${q.id}/reject`, {})).status, 400);
      assert.equal((await A('POST', `/payments/payouts/${q.id}/reject`, { reason: 'Name mismatch' })).body.data.status, 'rejected');
      const after = (await GET(`/payments/payouts/${q.id}`)).body.data;
      assert.equal(after.creatorBalance.requestedCents, 5000, 'payout bị từ chối được trả lại số dư');
      assert.equal(after.note, 'Name mismatch');
      assert.equal((await A('POST', '/payments/payouts/nope/hold', { reason: 'x' })).status, 404);

      const sum = (await GET('/payments/payouts/summary')).body.data;
      assert.ok(sum.paidCents >= 5000 && sum.counts.rejected >= 1);
      assert.equal((await GET(`/payments/payouts?ownerId=${f.owner.id}&status=paid,rejected`)).body.meta.total, 2);
      assert.equal((await GET('/payments/payouts?status=bogus')).status, 400);
      assert.ok((await actions(p.id)).includes('payout.mark_failed'));

      // endpoint cũ vẫn dùng được với payout mới
      const legacy = await mk(2000);
      assert.equal((await c.call('PATCH', `/admin/payouts/${legacy.id}`, { token: admin.token, body: { action: 'approve' } })).status, 200);
      assert.equal((await GET(`/payments/payouts/${legacy.id}`)).body.data.status, 'approved');
      assert.equal((await c.call('GET', '/admin/payouts?status=approved', { token: admin.token })).status, 200);
    });
  });

  /* ================================================================== DISCOVERY */
  describe('discovery', () => {
    const publicIds = async (token: string, qs = '') => ((await c.call('GET', `/courses?limit=50${qs}`, { token })).body.data as Array<{ id: string }>).map((x) => x.id);

    it('discoveryStatus: hidden/unlisted loại khỏi danh sách công khai nhưng mở trực tiếp được; listed trả lại; thông báo chủ', async () => {
      const owner = await c.registerUser('o');
      const viewer = await c.registerUser('v');
      const word = uniq('disc');
      const id = await com({ owner, title: `Zeta ${word}` });
      assert.ok((await publicIds(viewer.token, `&q=${word}`)).includes(id));
      assert.equal((await A('POST', `/discovery/communities/${id}/status`, { status: 'bogus' })).status, 400);
      assert.equal((await A('POST', `/discovery/communities/${id}/status`, { status: 'listed' })).status, 409);
      const r = await A('POST', `/discovery/communities/${id}/status`, { status: 'unlisted', reason: 'Low quality' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.discoveryStatus, 'unlisted');
      assert.equal(r.body.data.discoveryReason, 'Low quality');
      assert.ok(!(await publicIds(viewer.token, `&q=${word}`)).includes(id), 'không còn ở danh sách công khai');
      assert.ok(!(await publicIds(viewer.token)).includes(id));
      assert.equal((await c.call('GET', `/courses/${id}`, { token: viewer.token })).status, 200, 'vẫn mở bằng link trực tiếp');
      assert.ok((await notifFor(owner.id)).some((n) => n.title.includes('Discovery')));
      // trang Communities của đợt 1 phản ánh trạng thái discovery mới
      assert.equal((await GET(`/communities/${id}`)).body.data.discovery, 'unlisted');
      assert.equal((await A('POST', `/discovery/communities/${id}/status`, { status: 'hidden' })).body.data.discoveryStatus, 'hidden');
      assert.equal((await A('POST', `/discovery/communities/${id}/status`, { status: 'listed' })).body.data.discoveryStatus, 'listed');
      assert.ok((await publicIds(viewer.token, `&q=${word}`)).includes(id));
      assert.equal((await A('POST', '/discovery/communities/nope/status', { status: 'hidden' })).status, 404);
      assert.deepEqual((await actions(id)).filter((a) => a === 'discovery.status').length, 3);
    });

    it('list/summary cộng đồng: lọc status/category/q, sort, phân trang, trường tính toán', async () => {
      const owner = await c.registerUser('o');
      const word = uniq('lst');
      const a = await com({ owner, title: `Alpha ${word}`, category: 'finance' });
      const b = await com({ title: `Beta ${word}`, category: 'finance', discovery: 'hidden' });
      await db.prisma.community.update({ where: { id: a }, data: { rating: 4.5, ratingCount: 3 } });
      const l = await GET(`/discovery/communities?q=${word}&category=finance&sort=name`);
      assert.deepEqual(l.body.data.map((x: any) => x.id), [a, b]);
      assert.equal(l.body.data[0].discoveryStatus, 'listed');
      assert.equal(l.body.data[1].discoveryStatus, 'hidden');
      assert.equal(l.body.data[0].categoryLabel, 'Tài chính');
      assert.equal(l.body.data[0].members, 1);
      assert.equal(l.body.data[0].rating, 4.5);
      assert.ok('growthPct' in l.body.data[0] && 'engagementPct' in l.body.data[0]);
      assert.deepEqual((await GET(`/discovery/communities?q=${word}&status=hidden`)).body.data.map((x: any) => x.id), [b]);
      assert.equal((await GET(`/discovery/communities?q=${word}&limit=1&page=2`)).body.data.length, 1);
      assert.equal((await GET('/discovery/communities?status=bogus')).status, 400);
      assert.equal((await GET('/discovery/communities?category=bogus')).status, 400);
      const s = (await GET('/discovery/communities/summary')).body.data;
      assert.equal(s.total, s.listed + s.featured + s.hidden + s.unlisted);
      assert.ok(s.hidden >= 1);
    });

    it('featured: thêm/sắp xếp/xóa; API công khai /courses/featured theo thứ tự, bỏ mục hết hạn và cộng đồng không còn listed', async () => {
      const viewer = await c.registerUser('v');
      const [x, y, z] = [await com({}), await com({}), await com({})];
      const add = (courseId: string, extra: object = {}) => A('POST', '/discovery/featured', { section: 'editors_picks', courseId, ...extra });
      const ex = await add(x);
      assert.equal(ex.status, 201, JSON.stringify(ex.body));
      assert.equal(ex.body.data.position, 1);
      const ey = (await add(y)).body.data;
      const ez = (await add(z, { startsAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), endsAt: new Date(Date.now() - 86_400_000).toISOString() })).body.data;
      assert.equal((await add(x)).status, 409);
      assert.equal((await add('nope')).status, 404);
      assert.equal((await A('POST', '/discovery/featured', { section: 'bogus', courseId: x })).status, 400);
      assert.equal((await add(x, { startsAt: '2030-01-02T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' })).status, 400);

      const pub = async () => ((await c.call('GET', '/courses/featured?section=editors_picks', { token: viewer.token })).body.data as Array<{ id: string }>).map((i) => i.id).filter((id) => [x, y, z].includes(id));
      assert.deepEqual(await pub(), [x, y], 'mục hết hạn không hiện');
      const sec = (await GET('/discovery/featured')).body.data.sections;
      assert.equal(sec.length, 4);
      assert.deepEqual(sec.map((s: any) => s.key), ['featured', 'trending', 'editors_picks', 'new_noteworthy']);
      const items = sec.find((s: any) => s.key === 'editors_picks').items.filter((i: any) => [x, y, z].includes(i.community.id));
      assert.equal(items.find((i: any) => i.community.id === z).active, false);

      const all = sec.find((s: any) => s.key === 'editors_picks').items.map((i: any) => i.id) as string[];
      assert.equal((await A('POST', '/discovery/featured/editors_picks/reorder', { entryIds: all.slice(1) })).status, 400, 'phải là hoán vị đủ');
      const rev = await A('POST', '/discovery/featured/editors_picks/reorder', { entryIds: [...all].reverse() });
      assert.equal(rev.status, 200);
      assert.deepEqual((await pub()), [y, x], 'đổi thứ tự có hiệu lực ở API công khai');
      assert.equal((await A('POST', '/discovery/featured/nope/reorder', { entryIds: [] })).status, 404);

      assert.equal((await A('PATCH', `/discovery/featured/${ez.id}`, { endsAt: new Date(Date.now() + 86_400_000).toISOString() })).status, 200);
      assert.equal((await pub()).length, 3);
      // cộng đồng chuyển sang unlisted -> biến mất khỏi API công khai dù mục ghim vẫn còn
      await A('POST', `/discovery/communities/${y}/status`, { status: 'unlisted' });
      assert.ok(!(await pub()).includes(y));
      assert.equal((await A('POST', `/discovery/featured`, { section: 'featured', courseId: y })).status, 400, 'không ghim được cộng đồng không listed');
      const rm = await A('DELETE', `/discovery/featured/${ey.id}`);
      assert.deepEqual(rm.body.data, { removed: true });
      assert.equal((await A('DELETE', `/discovery/featured/${ey.id}`)).status, 404);
      // feature/unfeature qua community + trạng thái 'featured'
      const f = await A('POST', `/discovery/communities/${x}/feature`, {});
      assert.equal(f.status, 200, JSON.stringify(f.body));
      assert.equal(f.body.data.discoveryStatus, 'featured');
      assert.ok(f.body.data.featuredSections.includes('featured'));
      assert.ok((await c.call('GET', '/courses/featured', { token: viewer.token })).body.data.some((i: any) => i.id === x));
      const uf = await A('POST', `/discovery/communities/${x}/unfeature`, { section: 'featured' });
      assert.equal(uf.body.data.discoveryStatus, 'listed');
      assert.equal((await A('POST', `/discovery/communities/${x}/unfeature`, { section: 'featured' })).status, 409);
      assert.equal((await c.call('GET', '/courses/featured?section=bogus', { token: viewer.token })).status, 400);
    });

    it('categories: tắt khỏi /categories công khai, thêm danh mục mới, sắp xếp, move, validate', async () => {
      const before = (await c.call('GET', '/categories')).body.data as Array<{ id: string }>;
      assert.ok(before.length >= 8);
      assert.ok(before.some((x) => x.id === 'finance'));
      const list = (await GET('/discovery/categories')).body.data;
      assert.equal(list[0].position, 1);
      assert.ok(list.every((x: any) => x.slug === x.key));
      assert.equal((await A('PATCH', '/discovery/categories/finance', {})).status, 400);
      assert.equal((await A('PATCH', '/discovery/categories/nope', { name: 'x' })).status, 404);
      const dis = await A('PATCH', '/discovery/categories/finance', { status: 'disabled' });
      assert.equal(dis.body.data.status, 'disabled');
      assert.ok(!((await c.call('GET', '/categories')).body.data as Array<{ id: string }>).some((x) => x.id === 'finance'), 'danh mục tắt biến mất khỏi API công khai');
      const ren = await A('PATCH', '/discovery/categories/finance', { name: 'Tài chính & Đầu tư', status: 'active', description: 'Mô tả' });
      assert.equal(ren.body.data.name, 'Tài chính & Đầu tư');
      assert.equal(((await c.call('GET', '/categories')).body.data as Array<{ id: string; name: string }>).find((x) => x.id === 'finance')?.name, 'Tài chính & Đầu tư');

      assert.equal((await A('POST', '/discovery/categories', { key: 'finance', name: 'Dup' })).status, 409);
      assert.equal((await A('POST', '/discovery/categories', { key: 'bogus', name: 'x' })).status, 400);
      const add = await A('POST', '/discovery/categories', { key: 'marketing', name: 'Marketing' });
      assert.equal(add.status, 201, JSON.stringify(add.body));
      assert.equal(add.body.data.position, 9);
      assert.ok(((await c.call('GET', '/categories')).body.data as Array<{ id: string }>).some((x) => x.id === 'marketing'));
      // khóa học dùng danh mục mới lọc được ở API công khai
      const mid = await com({ category: 'marketing' });
      assert.ok((await publicIds_((await c.registerUser('v')).token, '&category=marketing')).includes(mid));

      const keys = (await GET('/discovery/categories')).body.data.map((x: any) => x.key) as string[];
      assert.equal((await A('POST', '/discovery/categories/reorder', { keys: keys.slice(1) })).status, 400);
      assert.equal((await A('POST', '/discovery/categories/reorder', { keys: [...keys.slice(1), 'bogus'] })).status, 400);
      const rev = await A('POST', '/discovery/categories/reorder', { keys: [...keys].reverse() });
      assert.equal(rev.body.data[0].key, keys.at(-1));
      assert.equal((await A('POST', `/discovery/categories/${keys.at(-1)}/move`, { direction: 'up' })).status, 409, 'đang đứng đầu');
      const mv = await A('POST', `/discovery/categories/${keys.at(-1)}/move`, { direction: 'down' });
      assert.equal(mv.body.data[1].key, keys.at(-1));
      assert.equal((await A('POST', '/discovery/categories/finance/move', { direction: 'sideways' })).status, 400);
      assert.ok((await actions('finance')).includes('category.disable'));
    });
    const publicIds_ = async (token: string, qs = '') => ((await c.call('GET', `/courses?limit=50${qs}`, { token })).body.data as Array<{ id: string }>).map((x) => x.id);

    it('search visibility: hidden loại khỏi /search và /courses?q, reduced xếp sau; audit; 409/400', async () => {
      const viewer = await c.registerUser('v');
      const word = uniq('srch');
      const a = await com({ title: `${word} bình thường` });
      const b = await com({ title: `${word} bị giảm` });
      const d = await com({ title: `${word} bị ẩn` });
      const searchIds = async () => ((await c.call('GET', `/search?q=${word}&type=courses&limit=50`, { token: viewer.token })).body.data as Array<{ id: string }>).map((x) => x.id);
      assert.deepEqual((await searchIds()).sort(), [a, b, d].sort());

      assert.equal((await A('POST', `/discovery/communities/${b}/search-visibility`, { visibility: 'bogus' })).status, 400);
      assert.equal((await A('POST', `/discovery/communities/${a}/search-visibility`, { visibility: 'searchable' })).status, 409);
      const red = await A('POST', `/discovery/communities/${b}/search-visibility`, { visibility: 'reduced', reason: 'Low quality' });
      assert.equal(red.status, 200, JSON.stringify(red.body));
      assert.equal(red.body.data.searchVisibility, 'reduced');
      assert.ok(red.body.data.qualityScore >= 0 && red.body.data.qualityScore <= 100);
      await A('POST', `/discovery/communities/${d}/search-visibility`, { visibility: 'hidden' });
      const res = await searchIds();
      assert.deepEqual(res, [a, b], 'hidden bị loại, reduced đứng sau searchable');
      // trước khi reduced, thứ tự theo "newest" đặt d,b,a — nên [a,b] chứng minh reduced bị đẩy xuống cuối
      const lst = await publicIds_(viewer.token, `&q=${word}`);
      assert.deepEqual(lst, [a, b]);
      assert.ok(!lst.includes(d));
      assert.equal((await A('POST', '/discovery/communities/nope/search-visibility', { visibility: 'hidden' })).status, 404);

      const list = await GET(`/discovery/search-visibility?q=${word}&searchStatus=hidden`);
      assert.deepEqual(list.body.data.map((x: any) => x.id), [d]);
      assert.ok('qualityScore' in list.body.data[0] && 'violations' in list.body.data[0]);
      assert.equal((await GET('/discovery/search-visibility?searchStatus=bogus')).status, 400);
      const s = (await GET('/discovery/search-visibility/summary')).body.data;
      assert.ok(s.hidden >= 1 && s.reduced >= 1 && s.total >= s.searchable + s.reduced + s.hidden - 1);
      assert.deepEqual((await actions(d)).filter((x) => x === 'discovery.search_visibility').length, 1);
      // đưa lại bình thường
      await A('POST', `/discovery/communities/${d}/search-visibility`, { visibility: 'searchable' });
      assert.ok((await searchIds()).includes(d));
    });

    it('rankings: preview không lưu, publish đổi thứ tự sort=ranked công khai, reset; validate; audit', async () => {
      const viewer = await c.registerUser('v');
      const good = await com({ rating: 5, title: uniq('Top ') });
      const bad = await com({ rating: 1, title: uniq('Low ') });
      const get = async () => (await GET('/discovery/rankings')).body.data;
      const g0 = await get();
      assert.deepEqual(g0.weights, g0.defaults);
      assert.equal(g0.defaults.memberGrowth, 25);
      assert.ok(g0.preview.length >= 2);
      assert.deepEqual(g0.preview.map((r: any) => r.rank), g0.preview.map((_: any, i: number) => i + 1));

      const onlyRating = { memberGrowth: 0, engagement: 0, retention: 0, rating: 100, revenue: 0, reportPenalty: 0 };
      assert.equal((await A('POST', '/discovery/rankings/preview', { weights: { rating: 10 } })).status, 400);
      assert.equal((await A('POST', '/discovery/rankings/preview', { weights: { ...onlyRating, rating: 101 } })).status, 400);
      const pv = await A('POST', '/discovery/rankings/preview', { weights: onlyRating });
      assert.equal(pv.status, 200);
      const rank = (rows: any[], id: string) => rows.find((r) => r.id === id).rank as number;
      assert.ok(rank(pv.body.data.preview, good) < rank(pv.body.data.preview, bad));
      assert.equal(pv.body.data.preview.find((r: any) => r.id === good).score, 100, 'rating 5/5 × trọng số 100');
      assert.deepEqual((await get()).weights, g0.defaults, 'preview không lưu');

      const pub = await A('PUT', '/discovery/rankings', { weights: onlyRating, note: 'Rating only' });
      assert.equal(pub.status, 200, JSON.stringify(pub.body));
      assert.deepEqual(pub.body.data.weights, onlyRating);
      assert.ok(pub.body.data.updatedBy?.id === admin.id && pub.body.data.updatedAt);
      const ranked = await c.call('GET', '/courses?sort=ranked&limit=50&page=1', { token: viewer.token });
      assert.equal(ranked.status, 200);
      const ids = (ranked.body.data as Array<{ id: string }>).map((x) => x.id);
      // lấy đủ các trang để chắc chắn tìm thấy cả hai
      let all = ids;
      for (let p = 2; p <= ranked.body.meta.totalPages; p++) all = all.concat(((await c.call('GET', `/courses?sort=ranked&limit=50&page=${p}`, { token: viewer.token })).body.data as Array<{ id: string }>).map((x) => x.id));
      assert.ok(all.indexOf(good) >= 0 && all.indexOf(bad) >= 0);
      assert.ok(all.indexOf(good) < all.indexOf(bad), 'sort=ranked dùng trọng số đã publish');

      const rs = await A('POST', '/discovery/rankings/reset', {});
      assert.deepEqual(rs.body.data.weights, g0.defaults);
      assert.deepEqual((await actions('rankings')).sort(), ['discovery.ranking_publish', 'discovery.ranking_reset']);
      assert.equal((await c.call('GET', '/courses?sort=bogus', { token: viewer.token })).status, 400);
    });
  });
});
