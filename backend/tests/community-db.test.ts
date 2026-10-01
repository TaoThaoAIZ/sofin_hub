import { makeClient, startTestServer, type TestServer } from './helpers.js'; // helpers PHẢI là import đầu tiên
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

/**
 * Thành viên minh họa (User.isDemo), điểm (PointEvent), danh sách thành viên / bảng xếp hạng / cấp độ và kịch bản seed cộng đồng
 * — tất cả trên Postgres thật (schema test tạm). Seed được nạp bằng chính các hàm seed của prisma/seed/*.
 */
describe('community trên DB: thành viên minh họa, điểm, xếp hạng, cấp độ', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let db: Awaited<ReturnType<typeof import('./helpers.js').useTestDb>>['prisma'];
  let ids: Record<string, string>;
  let tokens: Record<string, string>;
  let demoIds: typeof import('../prisma/seed/demo-ids.js');
  let profiles: typeof import('../prisma/seed/demo-members.js');
  let pointsSvc: typeof import('../src/modules/points/points.service.js').pointsService;
  let levelFor: typeof import('../src/modules/points/points.levels.js').levelFor;
  let ctx: import('../prisma/seed/context.js').SeedContext;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    ({ prisma: db } = await (await import('./helpers.js')).useTestDb());
    const base = await import('../prisma/seed-base.js');
    const { TEST_PASSWORD, SEED_ACCOUNT_LIST } = await import('../prisma/seed-accounts.js');
    demoIds = await import('../prisma/seed/demo-ids.js');
    profiles = await import('../prisma/seed/demo-members.js');
    pointsSvc = (await import('../src/modules/points/points.service.js')).pointsService;
    levelFor = (await import('../src/modules/points/points.levels.js')).levelFor;
    ids = await base.seedAccounts(db);
    await base.seedMemberships(db, ids as never);
    ctx = { db, userIds: ids as never };
    await profiles.seedDemoMembers(ctx);
    await (await import('../prisma/seed/points.js')).seedPoints(ctx);
    tokens = {};
    for (const a of SEED_ACCOUNT_LIST) {
      const r = await c.call('POST', '/auth/login', { body: { email: a.email, password: TEST_PASSWORD } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      tokens[a.key] = r.body.data.accessToken;
    }
  });
  after(() => server.close());

  const members = (q: string, who = 'member1', course = 'photo') => c.call('GET', `/courses/${course}/members${q}`, { token: tokens[who] });

  it('seed thành viên minh họa: User isDemo + Enrollment cho MỌI cộng đồng, idempotent', async () => {
    const courseCount = await db.community.count();
    const n = demoIds.DEMO_NAMES.length;
    assert.equal(await db.user.count({ where: { isDemo: true } }), courseCount * n);
    assert.equal(await db.enrollment.count({ where: { userId: { startsWith: 'demo-' } } }), courseCount * n);
    const admin = await db.enrollment.findUnique({ where: { userId_communityId: { userId: demoIds.demoUserId('photo', 0), communityId: 'photo' } } });
    assert.equal(admin?.role, 'admin');
    const u = await db.user.findUnique({ where: { id: demoIds.demoUserId('lead', 1) } });
    assert.equal(u?.email, demoIds.demoEmail('lead', 1));
    assert.equal(`${u?.firstName} ${u?.lastName}`, demoIds.DEMO_NAMES[1]);
    const login = await c.call('POST', '/auth/login', { body: { email: demoIds.demoEmail('lead', 1), password: 'Passw0rd!x' } });
    assert.ok(login.status >= 400);

    const before = [await db.user.count(), await db.enrollment.count(), await db.pointEvent.count()];
    await profiles.seedDemoMembers(ctx);
    await (await import('../prisma/seed/points.js')).seedPoints(ctx);
    assert.deepEqual([await db.user.count(), await db.enrollment.count(), await db.pointEvent.count()], before);
  });

  it('điểm 7d/30d/all của thành viên minh họa khớp hồ sơ (tổng hợp trong DB theo cửa sổ)', async () => {
    for (const i of [0, 5, 20, 57]) {
      const p = profiles.demoProfiles('photo').find((x) => x.index === i)!;
      for (const w of ['7d', '30d', 'all'] as const) {
        assert.equal(await pointsSvc.totalFor('photo', p.userId, w), p.points[w], `${i}/${w}`);
      }
    }
    // cửa sổ: sự kiện lùi ngày ghi thẳng vào DB
    const u = await c.registerUser('win');
    const day = 86_400_000;
    await db.pointEvent.createMany({
      data: [
        { userId: u.id, communityId: 'yt', points: 10, reason: 'post', createdAt: new Date(Date.now() - 2 * day) },
        { userId: u.id, communityId: 'yt', points: 7, reason: 'post', createdAt: new Date(Date.now() - 20 * day) },
        { userId: u.id, communityId: 'yt', points: 3, reason: 'post', createdAt: new Date(Date.now() - 90 * day) },
      ],
    });
    assert.equal(await pointsSvc.totalFor('yt', u.id, '7d'), 10);
    assert.equal(await pointsSvc.totalFor('yt', u.id, '30d'), 17);
    assert.equal(await pointsSvc.totalFor('yt', u.id, 'all'), 20);
    const sum = await pointsSvc.summaryForUser(u.id, 2);
    assert.equal(sum.total, 20);
    assert.deepEqual(sum.byCourse, [{ communityId: 'yt', courseId: 'yt', points: 20 }]); // courseId = alias cũ của communityId
    assert.deepEqual(sum.recent.map((e) => e.points), [10, 7]); // mới trước, cắt theo limit
  });

  it('danh sách thành viên: counts, phân trang, lọc, sắp xếp, tìm theo tên & handle', async () => {
    const total = demoIds.DEMO_NAMES.length + 6; // minh họa + owner, cadmin, mod, member1..3 (banned bị loại)
    const r = await members('?limit=10&page=1');
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.total, total);
    assert.equal(r.body.meta.totalPages, Math.ceil(total / 10));
    assert.equal(r.body.data.length, 10);
    assert.equal(r.body.counts.all, total);
    assert.equal(r.body.counts.admins, 4); // demo admin + owner + cadmin + mod
    assert.ok(r.body.counts.online >= 8); // 7 minh họa vừa hoạt động + người đang xem
    assert.ok(!r.body.data.some((m: any) => m.id === ids.banned));
    const last = await members('?limit=10&page=7');
    assert.equal(last.body.data.length, total - 60);
    assert.equal((await members('?limit=10&page=99')).body.data.length, 0);

    // sort active: giảm dần theo lastActiveAt
    const act = r.body.data.map((m: any) => new Date(m.lastActiveAt).getTime());
    assert.deepEqual(act, [...act].sort((a, b) => b - a));
    // sort joined: giảm dần theo enrolledAt
    const j = (await members('?sort=joined&limit=50')).body.data.map((m: any) => new Date(m.enrolledAt).getTime());
    assert.deepEqual(j, [...j].sort((a, b) => b - a));
    // online
    const on = await members('?filter=online&limit=50');
    assert.equal(on.body.meta.total, r.body.counts.online);
    assert.ok(on.body.data.every((m: any) => m.online === true));
    // admin: mod/admin/owner đều là quản trị
    const ad = await members('?filter=admin&limit=50');
    assert.equal(ad.body.meta.total, 4);
    assert.ok(ad.body.data.every((m: any) => m.role === 'admin'));
    assert.ok(ad.body.data.some((m: any) => m.roleDetail === 'owner'));
    // tìm theo tên (không dấu/hoa thường ở phần ASCII) và theo handle
    const byName = await members('?q=tom%20be');
    assert.equal(byName.body.data.length, 1);
    assert.equal(byName.body.data[0].id, demoIds.demoUserId('photo', 0));
    assert.match(byName.body.data[0].handle, /^tom-be-\d{4}$/);
    const byHandle = await members(`?q=${byName.body.data[0].handle}`);
    assert.equal(byHandle.body.data[0].id, demoIds.demoUserId('photo', 0));
    assert.equal((await members('?q=zzzkhongco')).body.meta.total, 0);
    assert.equal((await members('?q=mia')).body.data[0].id, ids.mod);
    // đầu vào sai + quyền
    assert.equal((await members('?limit=0')).status, 400);
    assert.equal((await members('', 'newbie')).status, 403);
  });

  it('bảng xếp hạng: top 10 giảm dần, đúng cửa sổ, chỉ thành viên không bị cấm, có tên tài khoản test', async () => {
    const board = async (w: string, who = 'member1') => (await c.call('GET', `/courses/photo/leaderboard?window=${w}`, { token: tokens[who] })).body.data;
    for (const w of ['7d', '30d', 'all']) {
      const rows = await board(w);
      assert.ok(rows.length <= 10);
      rows.forEach((r: any, i: number) => assert.equal(r.rank, i + 1));
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].points >= rows[i].points);
      assert.ok(rows.every((r: any) => r.points > 0 && r.name));
    }
    // tổng cửa sổ 7d của người đứng đầu = tổng đã seed (không phải tổng ảo)
    const p = profiles.demoProfiles('photo');
    const top7 = (await board('7d'))[0];
    assert.equal(top7.points, Math.max(...p.map((x) => x.points['7d']), 35));
    // member1 (110 điểm) nằm trong bảng "all" khi đủ top; kiểm tra bằng service không giới hạn
    const full = await pointsSvc.leaderboard('photo', 'all');
    const m1 = full.find((r) => r.userId === ids.member1)!;
    assert.equal(m1.points, 110);
    assert.equal(m1.rank, full.findIndex((r) => r.userId === ids.member1) + 1);
    // người bị cấm có điểm vẫn không xuất hiện
    await db.pointEvent.create({ data: { userId: ids.banned, communityId: 'photo', points: 9999, reason: 'post' } });
    assert.ok(!(await pointsSvc.leaderboard('photo', 'all')).some((r) => r.userId === ids.banned));
    assert.notEqual((await board('all'))[0].userId, ids.banned);
    // cộng đồng khác không lẫn điểm
    assert.equal(await pointsSvc.totalFor('yt', ids.member1, 'all'), 0);
    assert.equal((await c.call('GET', `/courses/photo/leaderboard?window=1y`, { token: tokens.member1 })).status, 400);
  });

  it('cấp độ: phân bố % theo DB khớp tính tay, me.rank/points/level đúng', async () => {
    const r = await c.call('GET', '/courses/photo/levels', { token: tokens.member1 });
    assert.equal(r.status, 200);
    const lv = r.body.data.levels as { level: number; memberPct: number }[];
    assert.equal(lv.length, 9);
    const expected = new Map<number, number>();
    const add = (pts: number) => expected.set(levelFor(pts).level, (expected.get(levelFor(pts).level) ?? 0) + 1);
    for (const p of profiles.demoProfiles('photo')) add(p.points.all);
    [110, 30, 6, 0, 0, 0].forEach(add); // member1, member2, member3, owner, cadmin, mod
    for (const l of lv) assert.equal(l.memberPct, Math.round(((expected.get(l.level) ?? 0) / (demoIds.DEMO_NAMES.length + 6)) * 100), `cấp ${l.level}`);
    assert.ok([1, 2, 3, 4, 5, 6].filter((n) => (expected.get(n) ?? 0) > 0).length >= 5);

    const me = r.body.data.me;
    assert.equal(me.points, 110);
    assert.equal(me.level, 3);
    assert.equal(me.pointsToNext, 10);
    const full = await pointsSvc.leaderboard('photo', 'all');
    assert.equal(me.rank, full.findIndex((x) => x.userId === ids.member1) + 1);
    // người chưa có điểm: rank null, cấp 1
    const zero = (await c.call('GET', '/courses/photo/levels', { token: tokens.mod })).body.data.me;
    assert.equal(zero.rank, null);
    assert.equal(zero.level, 1);
    assert.equal((await c.call('GET', '/courses/photo/levels', { token: tokens.newbie })).status, 403);
  });

  it('thành viên minh họa: xem chi tiết được; kick/ban/đổi vai trò → 404 (dựa User.isDemo)', async () => {
    const demo = demoIds.demoUserId('photo', 3);
    const d = await c.call('GET', `/courses/photo/members/${demo}`, { token: tokens.member1 });
    assert.equal(d.status, 200);
    assert.equal(d.body.data.name, demoIds.DEMO_NAMES[3]);
    assert.equal(d.body.data.role, 'member');
    const admin = await c.call('GET', `/courses/photo/members/${demoIds.demoUserId('photo', 0)}`, { token: tokens.member1 });
    assert.equal(admin.body.data.roleDetail, 'admin');

    assert.equal((await c.call('DELETE', `/courses/photo/members/${demo}`, { token: tokens.owner })).status, 404);
    assert.equal((await c.call('POST', `/courses/photo/members/${demo}/ban`, { token: tokens.owner, body: {} })).status, 404);
    assert.equal((await c.call('PATCH', `/courses/photo/members/${demo}/role`, { token: tokens.owner, body: { role: 'mod' } })).status, 404);
    // cadmin (admin) cũng nhận 404 chứ không phải 403 khi nhắm admin minh họa
    assert.equal((await c.call('DELETE', `/courses/photo/members/${demoIds.demoUserId('photo', 0)}`, { token: tokens.cadmin })).status, 404);
    assert.equal((await c.call('GET', `/courses/photo/members/${demoIds.demoUserId('yt', 2)}`, { token: tokens.member1 })).status, 404); // khác cộng đồng
    // vẫn kick được thành viên thật
    assert.equal((await c.call('DELETE', `/courses/photo/members/${ids.member3}`, { token: tokens.cadmin })).status, 200);
    // quản trị minh họa không nhận thông báo
    assert.equal(await db.notification.count({ where: { userId: { startsWith: 'demo-' } } }), 0);
  });

  it('kịch bản seed cộng đồng: yêu cầu chờ, lời mời, review photo, ban có sẵn', async () => {
    const pend = await c.call('GET', '/courses/private-demo/join-requests?status=pending', { token: tokens.owner });
    assert.equal(pend.status, 200);
    assert.equal(pend.body.data.length, 2);
    assert.deepEqual(pend.body.data.map((x: any) => x.userId).sort(), [ids.newbie, ids.member1].sort());
    // newbie không gửi thêm được (đã có pending) — 1 pending / (course,user)
    assert.equal((await c.call('POST', '/courses/private-demo/join-requests', { token: tokens.newbie, body: {} })).status, 409);

    assert.equal((await c.call('GET', '/invites/DEMO-VALID')).status, 200);
    assert.equal((await c.call('GET', '/invites/DEMO-EXPIRED')).body.error.code, 'INVITE_EXPIRED');
    assert.equal((await c.call('GET', '/invites/DEMO-REVOKED')).body.error.code, 'INVITE_REVOKED');
    assert.equal((await c.call('GET', '/invites/DEMO-USED')).body.error.code, 'INVITE_EXHAUSTED');
    assert.equal((await c.call('POST', '/invites/DEMO-PAID/accept', { token: tokens.newbie })).body.error.code, 'PAYMENT_REQUIRED');
    assert.equal((await c.call('POST', '/invites/DEMO-VALID/accept', { token: tokens.member2 })).status, 200);
    assert.equal((await db.invite.findUnique({ where: { code: 'DEMO-VALID' } }))?.usedCount, 1);
    // duyệt yêu cầu của newbie
    const req = pend.body.data.find((x: any) => x.userId === ids.newbie);
    assert.equal((await c.call('POST', `/join-requests/${req.id}/approve`, { token: tokens.owner })).body.data.status, 'approved');

    // 3 review thật của member1..3: điểm = (nền seed + review thật)
    const { seedCommunities: courses } = await import('../src/modules/catalog/catalog.seed.js');
    const photo = courses.find((x) => x.id === 'photo')!;
    const expected = Math.round(((photo.rating * photo.ratingCount + 12) / (photo.ratingCount + 3)) * 10) / 10;
    const d = (await c.call('GET', '/courses/photo')).body.data;
    assert.equal(d.ratingCount, photo.ratingCount + 3);
    assert.equal(d.rating, expected);
    // xóa review của mình -> tính lại từ nền + review còn lại (không trôi số)
    assert.equal((await c.call('DELETE', '/courses/photo/reviews/mine', { token: tokens.member3 })).status, 200);
    assert.equal((await c.call('GET', '/courses/photo')).body.data.ratingCount, photo.ratingCount + 2);

    assert.equal(await db.communityBan.count({ where: { communityId: 'photo', userId: ids.banned } }), 1);
    const bans = await c.call('GET', '/courses/photo/bans', { token: tokens.owner });
    assert.equal(bans.body.data.length, 1);
  });

  it('yêu cầu tham gia song song: chỉ 1 pending; lời mời lượt cuối chỉ 1 người nhận được', async () => {
    const u = await c.registerUser('race');
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => c.call('POST', '/courses/lead/join-requests', { token: u.token, body: {} })),
    );
    assert.equal(outcomes.filter((o) => o.status === 201).length, 1, JSON.stringify(outcomes.map((o) => o.status)));
    assert.equal(await db.joinRequest.count({ where: { communityId: 'lead', userId: u.id, status: 'pending' } }), 1);

    await db.invite.create({ data: { code: 'RACE-ONE', communityId: 'private-demo', createdById: ids.owner, maxUses: 1 } });
    const users = await Promise.all([c.registerUser('r1'), c.registerUser('r2'), c.registerUser('r3')]);
    const acc = await Promise.all(users.map((x) => c.call('POST', '/invites/RACE-ONE/accept', { token: x.token })));
    assert.equal(acc.filter((a) => a.status === 200).length, 1, JSON.stringify(acc.map((a) => a.status)));
    assert.equal((await db.invite.findUnique({ where: { code: 'RACE-ONE' } }))?.usedCount, 1);
  });

  it('đánh giá song song: rating/ratingCount đúng sau khi nhiều người đánh giá cùng lúc', async () => {
    const owner = await c.registerUser('rvo');
    const created = await c.call('POST', '/communities', {
      token: owner.token,
      body: { title: 'Nhóm review song song', description: 'x', category: 'tech', priceUsd: 0, visibility: 'public' },
    });
    const id = created.body.data.id as string;
    const users = await Promise.all(Array.from({ length: 6 }, (_, i) => c.registerUser(`rv${i}`)));
    for (const u of users) await c.call('POST', `/courses/${id}/enroll`, { token: u.token });
    await Promise.all(users.map((u, i) => c.call('POST', `/courses/${id}/reviews`, { token: u.token, body: { rating: (i % 5) + 1 } })));
    const d = (await c.call('GET', `/courses/${id}`)).body.data;
    assert.equal(d.ratingCount, 6);
    assert.equal(d.rating, Math.round(((1 + 2 + 3 + 4 + 5 + 1) / 6) * 10) / 10);
  });
});
