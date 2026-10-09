import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

const ADMIN_EMAIL = 'padmin-points@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

const DAY = 86_400_000;

/** Thông báo được ghi nền (hàng đợi ghi) nên đợi tới khi điều kiện đúng (tối đa ~4s). */
async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  let v = await fn();
  for (let i = 0; i < 40 && !ok(v); i++) {
    await new Promise((r) => setTimeout(r, 100));
    v = await fn();
  }
  return v;
}

/** Audit §5.1/5.2 (farm điểm) + §6.1/6.2 (phân quyền ở ranh giới trạng thái) + rate limit/page cap. */
describe('điểm thưởng không farm được + chính sách quyền ở ranh giới trạng thái', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let admin: { token: string; id: string };
  let prisma: typeof import('../src/db/prisma.js').prisma;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;
  let pointsService: typeof import('../src/modules/points/points.service.js').pointsService;
  let rl: typeof import('../src/middlewares/rate-limit.js');

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ prisma } = await import('../src/db/prisma.js'));
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    ({ pointsService } = await import('../src/modules/points/points.service.js'));
    rl = await import('../src/middlewares/rate-limit.js');
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  const total = (userId: string, courseId = 'photo') => pointsService.totalFor(courseId, userId, 'all');
  async function member(prefix: string, courseId = 'photo') {
    const u = await c.registerUser(prefix);
    await enrollmentService.grant(u.id, courseId);
    return u;
  }
  const newPost = async (u: { token: string }, courseId = 'photo') => {
    const r = await c.call('POST', `/courses/${courseId}/posts`, { token: u.token, body: { content: 'bài thử điểm', category: 'Thảo luận chung', tags: [] } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data.id as string;
  };

  // ------------------------------------------------------------------------------------------------ 5.1
  describe('5.1 farm điểm: đăng bài rồi xóa', () => {
    it('đăng + xóa ×5: điểm ròng = 0 (điểm âm bù cùng transaction với xóa)', async () => {
      const a = await member('farm-a');
      for (let i = 0; i < 5; i++) {
        const id = await newPost(a);
        assert.equal(await total(a.id), 5, 'đăng bài được +5');
        assert.equal((await c.call('DELETE', `/posts/${id}`, { token: a.token })).status, 200);
        assert.equal(await total(a.id), 0, `vòng ${i}: xóa bài phải hoàn điểm`);
      }
      assert.equal((await prisma.pointEvent.aggregate({ where: { userId: a.id }, _sum: { points: true } }))._sum.points, 0);
    });

    it('biến thể cộng tác: A đăng (+5), B like (+2 cho A), A xóa bài ⇒ vòng lặp có net 0 (không còn 7 điểm/vòng)', async () => {
      const a = await member('collab-a');
      const b = await member('collab-b');
      for (let i = 0; i < 4; i++) {
        const id = await newPost(a);
        assert.equal((await c.call('POST', `/posts/${id}/like`, { token: b.token })).status, 200);
        assert.equal(await total(a.id), 7);
        await c.call('DELETE', `/posts/${id}`, { token: a.token });
        assert.equal(await total(a.id), 0, `vòng ${i}`);
      }
    });

    it('khóa nghiệp vụ: like/unlike/like cùng bài chỉ cộng 1 lần; award trùng khóa trả undefined; tự like bài của mình không có điểm', async () => {
      const a = await member('key-a');
      const b = await member('key-b');
      const id = await newPost(a);
      for (let i = 0; i < 3; i++) await c.call('POST', `/posts/${id}/like`, { token: b.token });
      assert.equal(await total(a.id), 5 + 2);
      await c.call('POST', `/posts/${id}/like`, { token: a.token }); // tự like
      assert.equal(await total(a.id), 5 + 2, 'tự like không được điểm');
      assert.equal(await pointsService.award(a.id, 'photo', 'post', { type: 'post', id }), undefined);
      assert.equal(await total(a.id), 7);
      assert.equal(await prisma.pointEvent.count({ where: { userId: a.id, reason: 'like_received' } }), 1);
      // DB chặn cứng
      await assert.rejects(prisma.pointEvent.create({ data: { userId: a.id, communityId: 'photo', points: 5, reason: 'post', sourceType: 'post', sourceId: id } }), (e: any) => e.code === 'P2002');
    });

    it('xóa bài có nhiều like: bù đủ điểm đăng bài + mọi like_received của bài đó (không đụng điểm của bài khác)', async () => {
      const a = await member('multi-a');
      const keep = await newPost(a);
      const drop = await newPost(a);
      for (let i = 0; i < 3; i++) {
        const l = await member(`multi-l${i}`);
        await c.call('POST', `/posts/${drop}/like`, { token: l.token });
        await c.call('POST', `/posts/${keep}/like`, { token: l.token });
      }
      assert.equal(await total(a.id), 5 + 5 + 6 + 6);
      await c.call('DELETE', `/posts/${drop}`, { token: a.token });
      assert.equal(await total(a.id), 5 + 6, 'chỉ bài `keep` còn điểm');
    });
  });

  // ------------------------------------------------------------------------------------------------ 5.2
  describe('5.2 farm điểm: RSVP → hủy → RSVP', () => {
    async function makeEvent(courseId = 'photo') {
      const host = await c.registerUser('host');
      await enrollmentService.grant(host.id, courseId, 'mod');
      const r = await c.call('POST', `/courses/${courseId}/events`, { token: host.token, body: { title: 'Workshop', startAt: new Date(Date.now() + 5 * DAY).toISOString() } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return { host, id: r.body.data.id as string };
    }

    it('RSVP/hủy/RSVP lại ×N chỉ cộng +1; xóa sự kiện thu hồi điểm RSVP', async () => {
      const ev = await makeEvent();
      const u = await member('rsvp');
      for (let i = 0; i < 4; i++) {
        assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: u.token })).body.data.rsvped, true);
        assert.equal((await c.call('DELETE', `/events/${ev.id}/rsvp`, { token: u.token })).body.data.rsvped, false);
      }
      await c.call('POST', `/events/${ev.id}/rsvp`, { token: u.token });
      assert.equal(await total(u.id), 1, 'điểm RSVP chỉ 1 lần');
      assert.equal(await prisma.pointEvent.count({ where: { userId: u.id, reason: 'event_rsvp' } }), 1);

      assert.equal((await c.call('DELETE', `/events/${ev.id}`, { token: ev.host.token })).status < 300, true);
      assert.equal(await total(u.id), 0, 'xóa sự kiện thu hồi điểm RSVP');
    });
  });

  // ------------------------------------------------------------------------------------------------ 6.2 locked
  describe('6.2 cộng đồng bị khóa: owner/admin/mod không còn quyền quản trị', () => {
    it('locked chặn update/delete/chuyển quyền/mời/lớp học/doanh thu/payout với owner & mod; Platform Admin vẫn làm được', async () => {
      const owner = await c.registerUser('lk-owner');
      const created = await c.call('POST', '/communities', { token: owner.token, body: { title: 'Nhóm sẽ bị khóa', description: 'mô tả', category: 'tech', priceUsd: 5, visibility: 'public' } });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.data.id as string;
      const mod = await c.registerUser('lk-mod');
      await enrollmentService.grant(mod.id, id, 'mod');
      const other = await member('lk-other', id);

      // Trước khi khóa: owner làm được.
      assert.equal((await c.call('PATCH', `/courses/${id}`, { token: owner.token, body: { description: 'đổi mô tả' } })).status, 200);
      assert.equal((await c.call('GET', `/courses/${id}/revenue`, { token: owner.token })).status, 200);

      assert.equal((await c.call('POST', `/admin/courses/${id}/lock`, { token: admin.token, body: { reason: 'lừa đảo' } })).status, 200);

      const bank = { type: 'bank', bankName: 'VCB', accountNumber: '0123456789', accountHolder: 'A' };
      const attempts: Array<[string, string, string, unknown?]> = [
        ['PATCH', `/courses/${id}`, owner.token, { description: 'xóa dấu vết' }],
        ['POST', `/courses/${id}/transfer-ownership`, owner.token, { userId: other.id }],
        ['POST', `/courses/${id}/invites`, owner.token, {}],
        ['GET', `/courses/${id}/revenue`, owner.token],
        ['GET', `/courses/${id}/payouts`, owner.token],
        ['POST', `/courses/${id}/payouts`, owner.token, { amountCents: 1000, method: bank }],
        ['POST', `/courses/${id}/modules`, mod.token, { title: 'Module' }],
        ['DELETE', `/courses/${id}`, owner.token],
        ['DELETE', `/courses/${id}/members/${other.id}`, owner.token],
      ];
      for (const [method, path, token, body] of attempts) {
        const r = await c.call(method, path, { token, ...(body !== undefined ? { body } : {}) });
        assert.equal(r.status, 403, `${method} ${path} phải 403 khi bị khóa, nhận ${r.status}`);
      }
      assert.equal(await prisma.community.count({ where: { id, deletedAt: null } }), 1, 'owner không xóa được cộng đồng bị khóa');

      // Platform Admin vẫn xử lý được.
      assert.equal((await c.call('PATCH', `/courses/${id}`, { token: admin.token, body: { description: 'admin sửa' } })).status, 200);
      assert.equal((await c.call('POST', `/admin/courses/${id}/unlock`, { token: admin.token })).status, 200);
      assert.equal((await c.call('PATCH', `/courses/${id}`, { token: owner.token, body: { description: 'đã mở khóa' } })).status, 200);
    });
  });

  // ------------------------------------------------------------------------------------------------ 6.1 ban
  describe('6.1 ban(): không phải oracle dò userId; ghi lệnh cấm trước khi gỡ ghi danh', () => {
    it('ban uuid lạ / người chưa là thành viên → 404, không tạo CommunityBan, không gửi thông báo', async () => {
      const owner = await c.registerUser('ban-owner');
      await enrollmentService.grant(owner.id, 'photo', 'owner');
      const outsider = await c.registerUser('ban-outsider');
      const real = await c.call('POST', `/courses/photo/members/${outsider.id}/ban`, { token: owner.token, body: { reason: 'dò' } });
      const fake = await c.call('POST', `/courses/photo/members/00000000-0000-4000-8000-000000000000/ban`, { token: owner.token, body: { reason: 'dò' } });
      assert.equal(real.status, 404);
      assert.equal(fake.status, 404);
      assert.equal(await prisma.communityBan.count({ where: { userId: outsider.id } }), 0);
      await new Promise((r) => setTimeout(r, 300)); // thông báo ghi nền: đợi để kiểm "không có" có ý nghĩa
      assert.equal(await prisma.notification.count({ where: { userId: outsider.id } }), 0, 'không được gửi "bạn bị cấm" cho người chưa từng ở nhóm');

      const m = await member('ban-member');
      assert.equal((await c.call('POST', `/courses/photo/members/${m.id}/ban`, { token: owner.token, body: { reason: 'spam' } })).status, 200);
      assert.equal(await prisma.communityBan.count({ where: { userId: m.id } }), 1);
      assert.equal(await prisma.enrollment.count({ where: { userId: m.id, communityId: 'photo' } }), 0);
      assert.equal(await eventually(() => prisma.notification.count({ where: { userId: m.id, type: 'removed_from_community' } }), (n) => n === 1), 1);
    });
  });

  // ------------------------------------------------------------------------------------------------ 6.1/6.2 join requests
  describe('join request: duyệt nguyên tử; cộng đồng riêng tư CÓ PHÍ không được cấp quyền miễn phí', () => {
    it('approve ∥ reject song song: Enrollment tồn tại khi và chỉ khi yêu cầu được chốt `approved`', async () => {
      const owner = await c.registerUser('jr-owner');
      const created = await c.call('POST', '/communities', { token: owner.token, body: { title: 'Nhóm riêng tư miễn phí', description: 'd', category: 'tech', priceUsd: 0, visibility: 'private' } });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.data.id as string;
      const admin2 = await c.registerUser('jr-admin');
      await enrollmentService.grant(admin2.id, id, 'admin');
      for (let i = 0; i < 6; i++) {
        const u = await c.registerUser(`jr-u${i}`);
        const req = await c.call('POST', `/courses/${id}/join-requests`, { token: u.token, body: {} });
        assert.equal(req.status, 201, JSON.stringify(req.body));
        const rid = req.body.data.id as string;
        await Promise.all([
          c.call('POST', `/join-requests/${rid}/approve`, { token: owner.token }),
          c.call('POST', `/join-requests/${rid}/reject`, { token: admin2.token }),
        ]);
        const row = (await prisma.joinRequest.findUnique({ where: { id: rid } }))!;
        const enrolled = (await prisma.enrollment.count({ where: { userId: u.id, communityId: id } })) > 0;
        assert.equal(enrolled, row.status === 'approved', `vòng ${i}: status=${row.status}, enrolled=${enrolled}`);
      }
    });

    it('cộng đồng riêng tư có phí: duyệt chỉ cho phép thanh toán (không enroll); checkout không có duyệt → 403 (đường /trial đã bỏ → 404); lời mời cũng vậy', async () => {
      const owner = await c.registerUser('pp-owner');
      await enrollmentService.grant(owner.id, 'lead', 'owner'); // 'lead': riêng tư, $10
      const u = await c.registerUser('pp-user');
      // Chưa được duyệt: checkout bị chặn; /trial không còn tồn tại.
      const r1 = await c.call('POST', '/courses/lead/checkout', { token: u.token, body: { method: 'stripe' } });
      assert.equal(r1.status, 403);
      assert.equal(r1.body.error?.code ?? r1.body.code, 'JOIN_REQUEST_REQUIRED');
      assert.equal((await c.call('POST', '/courses/fin/checkout', { token: u.token, body: { method: 'stripe' } })).status, 403); // 'fin': riêng tư, $5
      assert.equal((await c.call('POST', '/courses/fin/trial', { token: u.token })).status, 404);

      const req = await c.call('POST', '/courses/lead/join-requests', { token: u.token, body: {} });
      assert.equal(req.status, 201);
      const ap = await c.call('POST', `/join-requests/${req.body.data.id}/approve`, { token: owner.token });
      assert.equal(ap.status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'lead'), false, 'duyệt KHÔNG được cấp quyền miễn phí cho cộng đồng có phí');
      // Giờ mới thanh toán được.
      const co = await c.call('POST', '/courses/lead/checkout', { token: u.token, body: { method: 'stripe' } });
      assert.equal(co.status, 201);
      assert.equal((await c.payIntent(co.body.data.id, u.token)).status, 200);
      assert.equal(await enrollmentService.isEnrolled(u.id, 'lead'), true);

      // Lời mời vào cộng đồng riêng tư có phí: 402 (phải trả tiền) nhưng được phép thanh toán.
      const inv = await c.call('POST', '/courses/lead/invites', { token: owner.token, body: {} });
      assert.equal(inv.status, 201, JSON.stringify(inv.body));
      const v = await c.registerUser('pp-invitee');
      assert.equal((await c.call('POST', '/courses/lead/checkout', { token: v.token, body: { method: 'stripe' } })).status, 403);
      assert.equal((await c.call('POST', `/invites/${inv.body.data.code}/accept`, { token: v.token })).status, 402);
      assert.equal(await enrollmentService.isEnrolled(v.id, 'lead'), false);
      assert.equal((await c.call('POST', '/courses/lead/checkout', { token: v.token, body: { method: 'stripe' } })).status, 201);
    });
  });

  // ------------------------------------------------------------------------------------------------ 6.1 moderation
  describe('moderation: chốt ticket trước khi thi hành; có thông báo cho người bị ẩn/cấm', () => {
    it('dismiss ∥ hide_content song song: trạng thái bài luôn khớp hành động được ghi trong hồ sơ', async () => {
      const author = await member('mod-author');
      const reporter = await member('mod-reporter');
      const mod1 = await c.registerUser('mod-1');
      const mod2 = await c.registerUser('mod-2');
      await enrollmentService.grant(mod1.id, 'photo', 'mod');
      await enrollmentService.grant(mod2.id, 'photo', 'mod');
      for (let i = 0; i < 6; i++) {
        const postId = await newPost(author);
        const rep = await c.call('POST', `/posts/${postId}/report`, { token: reporter.token, body: { reason: 'spam' } });
        assert.equal(rep.status, 201, JSON.stringify(rep.body));
        const rid = rep.body.data.id as string;
        const rs = await Promise.all([
          c.call('PATCH', `/reports/${rid}`, { token: mod1.token, body: { action: 'dismiss' } }),
          c.call('PATCH', `/reports/${rid}`, { token: mod2.token, body: { action: 'hide_content' } }),
        ]);
        assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
        const report = (await prisma.report.findUnique({ where: { id: rid } }))!;
        const post = (await prisma.post.findUnique({ where: { id: postId } }))!;
        assert.equal(post.hidden, report.action === 'hide_content', `vòng ${i}: action=${report.action} hidden=${post.hidden}`);
      }
    });

    it('hide_content báo cho tác giả; ban_member báo cho người bị cấm; hành động không hợp lệ không làm kẹt ticket', async () => {
      const author = await member('modn-author');
      const reporter = await member('modn-reporter');
      const mod = await c.registerUser('modn-mod');
      await enrollmentService.grant(mod.id, 'photo', 'mod');
      const postId = await newPost(author);
      const rep = await c.call('POST', `/posts/${postId}/report`, { token: reporter.token, body: { reason: 'spam' } });
      const rid = rep.body.data.id as string;
      assert.equal((await c.call('PATCH', `/reports/${rid}`, { token: mod.token, body: { action: 'hide_content' } })).status, 200);
      assert.equal(await eventually(() => prisma.notification.count({ where: { userId: author.id, title: 'Nội dung của bạn đã bị ẩn' } }), (n) => n === 1), 1);

      // ban qua báo cáo thành viên
      const bad = await member('modn-bad');
      const rep2 = await c.call('POST', `/courses/photo/members/${bad.id}/report`, { token: reporter.token, body: { reason: 'harassment' } });
      assert.equal(rep2.status, 201, JSON.stringify(rep2.body));
      // hide_content trên báo cáo thành viên: 400 và ticket vẫn mở
      assert.equal((await c.call('PATCH', `/reports/${rep2.body.data.id}`, { token: mod.token, body: { action: 'hide_content' } })).status, 400);
      assert.equal((await prisma.report.findUnique({ where: { id: rep2.body.data.id } }))!.status, 'open');
      assert.equal((await c.call('PATCH', `/reports/${rep2.body.data.id}`, { token: mod.token, body: { action: 'ban_member' } })).status, 200);
      assert.equal(await prisma.communityBan.count({ where: { userId: bad.id, communityId: 'photo' } }), 1);
      assert.equal(await prisma.enrollment.count({ where: { userId: bad.id, communityId: 'photo' } }), 0);
      assert.equal(await eventually(() => prisma.notification.count({ where: { userId: bad.id, type: 'removed_from_community' } }), (n) => n === 1), 1);
    });
  });

  // ------------------------------------------------------------------------------------------------ rate limit + page cap
  describe('rate limit toàn cục / theo nhóm ghi + trần số trang', () => {
    it('?page vượt trần → 400 (không để ?page=1000000 quét DB); trong trần vẫn 200', async () => {
      const u = await member('page');
      assert.equal((await c.call('GET', '/courses/photo/posts?page=1000000', { token: u.token })).status, 400);
      assert.equal((await c.call('GET', '/courses/photo/posts?page=1000', { token: u.token })).status, 200);
      assert.equal((await c.call('GET', '/courses?page=1001')).status, 400);
    });

    it('mặc định TẮT khi test; bật thì giới hạn theo nhóm (posts) và toàn cục (429 + Retry-After), reset được', async () => {
      const u = await member('rl');
      assert.equal(rl.rateLimitSettings.enabled, false, 'test không bị rate limit trừ khi chủ động bật');
      try {
        rl.resetRateLimitsForTests();
        rl.rateLimitSettings.enabled = true;
        rl.rateLimitSettings.bucketMax.posts = 2;
        const rs = [];
        for (let i = 0; i < 3; i++) rs.push(await c.call('POST', '/courses/photo/posts', { token: u.token, body: { content: `rl ${i}`, category: 'Thảo luận chung', tags: [] } }));
        assert.deepEqual(rs.map((r) => r.status), [201, 201, 429]);
        assert.ok(rs[2]!.headers.get('retry-after'));
        // nhóm khác không bị ảnh hưởng
        assert.equal((await c.call('GET', '/courses/photo/posts', { token: u.token })).status, 200);

        rl.resetRateLimitsForTests();
        rl.rateLimitSettings.globalMax = 3;
        const g = [];
        for (let i = 0; i < 5; i++) g.push((await c.call('GET', '/courses')).status);
        assert.deepEqual(g.slice(0, 3), [200, 200, 200]);
        assert.equal(g[3], 429);
      } finally {
        rl.rateLimitSettings.enabled = false;
        rl.rateLimitSettings.globalMax = 1200;
        delete rl.rateLimitSettings.bucketMax.posts;
        rl.resetRateLimitsForTests();
      }
      assert.equal((await c.call('GET', '/courses')).status, 200);
    });
  });
});
