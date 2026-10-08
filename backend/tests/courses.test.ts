import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

/** Khóa học + ghi danh trên Postgres thật: danh sách/lọc/sắp xếp/tìm kiếm, ẩn locked/deleted, students, ban, vai trò. */
describe('courses + enrollments (Prisma)', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];
  let registerUser: ReturnType<typeof makeClient>['registerUser'];
  let prisma: Awaited<ReturnType<typeof useTestDb>>['prisma'];

  before(async () => {
    server = await startTestServer();
    ({ call, registerUser } = makeClient(server.baseUrl));
    prisma = (await useTestDb()).prisma;
  });
  after(() => server.close());

  const list = (qs = '') => call('GET', `/courses${qs}`);

  describe('GET /courses', () => {
    it('phân trang + meta, sort trending theo thứ hạng seed', async () => {
      const r = await list('?limit=5&page=1');
      assert.equal(r.status, 200);
      assert.equal(r.body.data.length, 5);
      assert.equal(r.body.meta.total, 21);
      assert.equal(r.body.meta.totalPages, 5);
      const ranks = await prisma.community.findMany({ orderBy: { trendingRank: 'asc' }, take: 5, select: { id: true } });
      assert.deepEqual(r.body.data.map((c: any) => c.id), ranks.map((c) => c.id));
      const p5 = await list('?limit=5&page=5');
      assert.equal(p5.body.data.length, 1);
    });

    it('hình dạng course: instructor, priceUsd, không lộ ownerId/locked/deletedAt của seed', async () => {
      const c = (await list('?limit=1')).body.data[0];
      assert.equal(typeof c.priceUsd, 'number');
      assert.ok(c.instructor.name);
      assert.ok(typeof c.createdAt === 'string' && !Number.isNaN(Date.parse(c.createdAt)));
      for (const k of ['ownerId', 'locked', 'deletedAt', 'trendingRank', 'instructorName']) assert.equal(k in c, false, k);
    });

    it('lọc theo category/pricing/language và validate 400', async () => {
      const r = await list('?category=finance&limit=50');
      assert.ok(r.body.data.length > 0);
      assert.ok(r.body.data.every((c: any) => c.category === 'finance'));
      assert.equal((await list('?category=khong-co')).status, 400);
      assert.equal((await list('?limit=0')).status, 400);
    });

    it('tìm kiếm tiếng Việt không dấu', async () => {
      const first = await prisma.community.findFirstOrThrow({ where: { title: { contains: 'ảnh', mode: 'insensitive' } } }).catch(() => null);
      if (first) {
        const r = await list(`?q=${encodeURIComponent('anh')}&limit=50`);
        assert.ok(r.body.data.some((c: any) => c.id === first.id));
      }
      const none = await list('?q=zzzkhongcotuongung');
      assert.equal(none.body.meta.total, 0);
    });

    it('sort top: theo rating*ln(1+count) giảm dần; newest: mới nhất trước', async () => {
      const top = (await list('?sort=top&limit=50')).body.data;
      const score = (c: any) => c.rating * Math.log1p(c.ratingCount);
      for (let i = 1; i < top.length; i++) assert.ok(score(top[i - 1]) >= score(top[i]) - 1e-9);
      const newest = (await list('?sort=newest&limit=50')).body.data;
      for (let i = 1; i < newest.length; i++) assert.ok(newest[i - 1].createdAt >= newest[i].createdAt);
    });

    it('cộng đồng bị khóa hoặc xóa mềm bị ẩn khỏi danh sách; xóa mềm 404', async () => {
      const ids = (await list('?limit=50')).body.data.map((c: any) => c.id) as string[];
      assert.ok(ids.includes('yt') && ids.includes('fin'));
      await prisma.community.update({ where: { id: 'yt' }, data: { locked: true, lockReason: 'vi phạm' } });
      await prisma.community.update({ where: { id: 'fin' }, data: { deletedAt: new Date() } });
      const after = (await list('?limit=50')).body;
      assert.equal(after.meta.total, 19);
      assert.equal(after.data.some((c: any) => c.id === 'yt' || c.id === 'fin'), false);
      assert.equal((await call('GET', '/courses/fin')).status, 404);
      const yt = await call('GET', '/courses/yt');
      assert.equal(yt.status, 200);
      assert.equal(yt.body.data.locked, true);
      const cats = await call('GET', '/categories');
      assert.equal(cats.body.data.reduce((s: number, c: any) => s + c.courseCount, 0), 19);
      await prisma.community.update({ where: { id: 'yt' }, data: { locked: false, lockReason: null } });
      await prisma.community.update({ where: { id: 'fin' }, data: { deletedAt: null } });
    });
  });

  describe('GET /courses/:id (detail)', () => {
    it('404 khi không tồn tại; có stats, không có nội dung/đánh giá/module bịa', async () => {
      assert.equal((await call('GET', '/courses/khong-co')).status, 404);
      const d = (await call('GET', '/courses/photo')).body.data;
      assert.deepEqual([d.highlights, d.gains, d.faqs, d.reviews], [[], [], [], []], 'không có review/highlight demo');
      assert.equal('modules' in d, false, 'modules thật nằm ở /courses/:id/modules');
      const realLessons = await prisma.classroomLesson.count({ where: { communityId: 'photo', hidden: false, removedAt: null, module: { publishStatus: 'published', removedAt: null } } });
      assert.equal(d.facts.find((f: any) => f.label === 'Bài học').value, String(realLessons), 'số bài học lấy từ lớp học thật');
      const trial = (await import('../src/modules/settings/settings.service.js')).cfg().payments.trialDays;
      const paid = (await call('GET', `/courses/${(await prisma.community.findFirstOrThrow({ where: { priceCents: { gt: 0 }, deletedAt: null } })).id}`)).body.data;
      assert.ok(paid.priceNotes.includes(`Miễn phí dùng thử ${trial} ngày`), 'ngày dùng thử từ cấu hình thật');
      const free = (await call('GET', `/courses/${(await prisma.community.findFirstOrThrow({ where: { priceCents: 0, deletedAt: null } })).id}`)).body.data;
      assert.deepEqual(free.priceNotes, [], 'cộng đồng miễn phí không quảng cáo dùng thử');
      assert.ok(d.stats.members >= 1 && d.stats.admins >= 1 && d.stats.online >= 0);
      assert.equal(d.viewerRole, null);
    });

    it('students = số nền seed + thành viên thật (không bị hạ về vài người); ban bị loại; thành viên demo không tính', async () => {
      const base = (await prisma.community.findUniqueOrThrow({ where: { id: 'photo' } })).students;
      assert.ok(base > 1000);
      const a = await registerUser('cs-a');
      const b = await registerUser('cs-b');
      assert.equal((await call('POST', '/courses/photo/enroll', { token: a.token })).status, 200);
      await call('POST', '/courses/photo/enroll', { token: b.token });
      assert.equal((await call('GET', '/courses/photo')).body.data.students, base + 2);

      const demo = await prisma.user.create({ data: { email: 'seed-photo-1@demo.sofinhub.invalid', firstName: 'D', lastName: 'M', passwordHash: 'x', isDemo: true } });
      await prisma.enrollment.create({ data: { userId: demo.id, communityId: 'photo' } });
      assert.equal((await call('GET', '/courses/photo')).body.data.students, base + 2, 'demo không cộng thêm');

      await prisma.communityBan.create({ data: { communityId: 'photo', userId: b.id } });
      const d = (await call('GET', '/courses/photo', { token: b.token })).body.data;
      assert.equal(d.students, base + 1, 'người bị ban không tính');
      assert.equal(d.viewerEnrolled, false);
      assert.equal(d.viewerRole, null);
      const listed = (await list('?limit=50')).body.data.find((c: any) => c.id === 'photo');
      assert.equal(listed.students, base + 1);
    });

    it('admins/owner thật được đếm; owner thật hiển thị viewerRole', async () => {
      const o = await registerUser('cs-o');
      await prisma.enrollment.create({ data: { userId: o.id, communityId: 'yt', role: 'owner' } });
      const d = (await call('GET', '/courses/yt', { token: o.token })).body.data;
      assert.equal(d.stats.admins, 1);
      assert.equal(d.viewerRole, 'owner');
      assert.equal(d.facts.find((f: any) => f.label === 'Quản trị viên').value, '1');
    });
  });

  describe('GET /stats', () => {
    it('tính từ DB: learners/courses/instructors thật, rating = TB có trọng số điểm các cộng đồng (null nếu chưa ai đánh giá)', async () => {
      // Điểm nền (Community.rating × ratingCount) + đánh giá thật; test này kiểm 2 đầu: không ai đánh giá -> null, có -> trung bình có trọng số.
      // DB test dùng chung với các file test chạy song song (đánh giá/rating đổi liên tục) -> không khẳng định số tuyệt đối;
      // so với giá trị tính lại từ DB ngay trước/sau lời gọi (khớp 1 trong 2 là đủ).
      const listedWhere = { deletedAt: null, locked: false, moderationStatus: 'active', discoveryStatus: 'listed' } as const;
      const expectedRating = async () => {
        const rows = await prisma.community.findMany({ where: { ...listedWhere, ratingCount: { gt: 0 } }, select: { rating: true, ratingCount: true } });
        const votes = rows.reduce((n, c) => n + c.ratingCount, 0);
        return votes > 0 ? Math.round((rows.reduce((n, c) => n + c.rating * c.ratingCount, 0) / votes) * 10) / 10 : null;
      };
      const stats = async () => {
        const pre = await expectedRating();
        const st = (await call('GET', '/stats')).body.data;
        const post = await expectedRating();
        assert.ok(st.rating === pre || st.rating === post, `rating ${st.rating} không khớp DB (${pre} / ${post})`);
        return st;
      };
      let st = await stats();
      const listed = await prisma.community.count({ where: listedWhere });
      assert.ok(Math.abs(st.courses - listed) <= 2, 'courses = số cộng đồng đang liệt kê');
      assert.notEqual(st.learners, 100000);
      assert.notEqual(st.courses, 1000);
      const before = st.learners;
      const u = await registerUser('st-a');
      await call('POST', '/courses/photo/enroll', { token: u.token });
      assert.ok((await call('GET', '/stats')).body.data.learners >= before + 1);
      await prisma.community.update({ where: { id: 'photo' }, data: { rating: 3, ratingCount: 2 } });
      await prisma.community.update({ where: { id: 'yt' }, data: { rating: 4, ratingCount: 2 } });
      st = await stats();
      assert.ok(st.rating !== null);
    });
  });

  describe('POST /courses/:id/enroll (toggle)', () => {
    it('401 thiếu token, 404 khóa lạ, 403 riêng tư, 402 có phí, 200 vào/rời', async () => {
      const u = await registerUser('cs-en');
      assert.equal((await call('POST', '/courses/photo/enroll')).status, 401);
      assert.equal((await call('POST', '/courses/khong-co/enroll', { token: u.token })).status, 404);

      const free = await prisma.community.findFirstOrThrow({ where: { priceCents: 0, visibility: 'public', deletedAt: null } });
      const on = await call('POST', `/courses/${free.id}/enroll`, { token: u.token });
      assert.deepEqual(on.body.data, { enrolled: true });
      assert.deepEqual((await call('POST', `/courses/${free.id}/enroll`, { token: u.token })).body.data, { enrolled: false });

      const paid = await prisma.community.findFirstOrThrow({ where: { priceCents: { gt: 0 }, visibility: 'public' } });
      const pay = await call('POST', `/courses/${paid.id}/enroll`, { token: u.token });
      assert.equal(pay.status, 402);
      assert.equal(pay.body.error.code, 'PAYMENT_REQUIRED');

      await prisma.community.update({ where: { id: free.id }, data: { visibility: 'private' } });
      const priv = await call('POST', `/courses/${free.id}/enroll`, { token: u.token });
      assert.equal(priv.status, 403);
      assert.equal(priv.body.error.code, 'JOIN_REQUEST_REQUIRED');
      await prisma.community.update({ where: { id: free.id }, data: { visibility: 'public' } });
    });

    it('bị ban: 403 khi tham gia; owner không thể rời (409)', async () => {
      const u = await registerUser('cs-ban');
      const free = await prisma.community.findFirstOrThrow({ where: { priceCents: 0, visibility: 'public', deletedAt: null } });
      await prisma.communityBan.create({ data: { communityId: free.id, userId: u.id } });
      assert.equal((await call('POST', `/courses/${free.id}/enroll`, { token: u.token })).status, 403);

      const o = await registerUser('cs-own');
      await prisma.enrollment.create({ data: { userId: o.id, communityId: free.id, role: 'owner' } });
      assert.equal((await call('POST', `/courses/${free.id}/enroll`, { token: o.token })).status, 409);
    });
  });

  describe('enrollmentService (repository)', () => {
    it('grant/getMember/setRole/listMembers/listByUser/setBanned/isBanned/remove', async () => {
      const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
      const u = await registerUser('cs-svc');
      const v = await registerUser('cs-svc2');
      await enrollmentService.grant(u.id, 'photo');
      await enrollmentService.grant(u.id, 'photo', 'admin'); // đã là thành viên: giữ vai trò cũ
      assert.equal((await enrollmentService.getMember(u.id, 'photo'))?.role, 'member');
      await enrollmentService.setRole(u.id, 'photo', 'mod');
      assert.equal((await enrollmentService.getMember(u.id, 'photo'))?.role, 'mod');
      await enrollmentService.grant(v.id, 'photo');
      assert.ok((await enrollmentService.listMembers('photo')).some((m) => m.userId === u.id));
      assert.ok((await enrollmentService.listByUser(u.id)).some((m) => m.communityId === 'photo'));

      await enrollmentService.setBanned(u.id, 'photo', true, { reason: 'spam' });
      assert.equal(await enrollmentService.isBanned(u.id, 'photo'), true);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'photo'), false);
      assert.equal((await enrollmentService.listMembers('photo')).some((m) => m.userId === u.id), false);
      assert.equal((await enrollmentService.listByUser(u.id)).length, 0);
      assert.ok(await enrollmentService.getMember(u.id, 'photo'), 'getMember vẫn trả về dòng (như bản cũ)');
      await assert.rejects(() => enrollmentService.grant(u.id, 'photo'), /cấm/);
      assert.equal((await prisma.communityBan.findFirstOrThrow({ where: { userId: u.id } })).reason, 'spam');

      await enrollmentService.setBanned(u.id, 'photo', false);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'photo'), true);
      await enrollmentService.remove(u.id, 'photo');
      assert.equal(await enrollmentService.isEnrolled(u.id, 'photo'), false);
      assert.equal(await enrollmentService.getMember(u.id, 'photo'), undefined);
    });

    it('requireMembership: 403 khi chưa tham gia, cập nhật lastActiveAt, khóa cộng đồng chặn thành viên thường', async () => {
      const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
      const u = await registerUser('cs-mem');
      await assert.rejects(() => enrollmentService.requireMembership(u.id, 'photo'), /tham gia/);
      await enrollmentService.grant(u.id, 'photo');
      const before = (await enrollmentService.getMember(u.id, 'photo'))!.lastActiveAt;
      await new Promise((r) => setTimeout(r, 15));
      await enrollmentService.requireMembership(u.id, 'photo');
      assert.ok((await enrollmentService.getMember(u.id, 'photo'))!.lastActiveAt > before);
      await prisma.community.update({ where: { id: 'photo' }, data: { locked: true } });
      await assert.rejects(() => enrollmentService.requireMembership(u.id, 'photo'), /khóa/);
      await prisma.community.update({ where: { id: 'photo' }, data: { locked: false } });
    });
  });

  describe('catalogService (repository)', () => {
    it('create/update/idExists/getLockReason; cộng đồng do người dùng tạo chỉ tính thành viên thật', async () => {
      const { catalogService } = await import('../src/modules/catalog/catalog.service.js');
      const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
      const owner = await registerUser('cs-mk');
      assert.equal(await catalogService.idExists('cong-dong-moi'), false);
      const created = await catalogService.create({
        id: 'cong-dong-moi', title: 'Cộng đồng mới', description: 'Mô tả', category: 'hobby', tag: 'new', thumbnail: '/t.webp',
        instructor: { name: 'Chủ', role: 'Chủ cộng đồng' }, lessons: 0, durationMinutes: 0, students: 0, rating: 0, ratingCount: 0,
        priceUsd: 9.99, pricing: 'paid', visibility: 'public', status: 'open', language: 'vi', createdAt: new Date().toISOString(), ownerId: owner.id,
      });
      assert.equal(created.priceUsd, 9.99);
      assert.equal(created.students, 0);
      assert.equal(created.ownerId, owner.id);
      assert.equal(await catalogService.idExists('cong-dong-moi'), true);
      await enrollmentService.grant(owner.id, 'cong-dong-moi', 'owner');
      assert.equal((await catalogService.getById('cong-dong-moi')).students, 1);

      const upd = await catalogService.update('cong-dong-moi', { title: 'Tên mới', locked: true, lockReason: 'kiểm tra', ratingCount: 3, rating: 4.5 });
      assert.equal(upd.title, 'Tên mới');
      assert.equal(upd.locked, true);
      assert.equal(await catalogService.getLockReason('cong-dong-moi'), 'kiểm tra');
      assert.equal('lockReason' in upd, false);
      await catalogService.update('cong-dong-moi', { locked: false, lockReason: null });
      assert.equal(await catalogService.getLockReason('cong-dong-moi'), undefined);

      await catalogService.update('cong-dong-moi', { deletedAt: new Date().toISOString() });
      await assert.rejects(() => catalogService.getById('cong-dong-moi'), /Không tìm thấy/);
      assert.equal(await catalogService.idExists('cong-dong-moi'), true, 'slug đã xóa mềm vẫn bị chiếm');
      await assert.rejects(() => catalogService.update('khong-co', { title: 'x' }), /Không tìm thấy/);
    });
  });
});
