import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mainCourseId, makeClient, startTestServer, type TestServer } from './helpers.js';

/** Lớp học: quản lý nội dung (mod+), khóa module, player, tiến độ, chứng nhận. Các `it` chạy tuần tự và dùng chung trạng thái. */
describe('lớp học', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const COURSE = 'photo';
  const base = `/courses/${COURSE}`;
  let mod: { token: string; id: string };
  let admin: { token: string; id: string };
  let learner: { token: string; id: string };
  let m1: string, m2: string, m3: string;
  let l1a: string, l1b: string, l2a: string, l3a: string;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    mod = await c.registerUser('cmod');
    admin = await c.registerUser('cadmin');
    learner = await c.registerUser('learner');
    for (const u of [mod, admin, learner]) await enrollmentService.grant(u.id, COURSE);
    await enrollmentService.setRole(mod.id, COURSE, 'mod');
    await enrollmentService.setRole(admin.id, COURSE, 'admin');
  });
  after(() => server.close());

  const seedUsers: Record<string, { token: string; id: string }> = {};
  const finCode = 'FIN-DEMO-CERT-001';
  const countRows = async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const [m, l, p, cert] = await Promise.all([
      prisma.classroomModule.count(),
      prisma.classroomLesson.count(),
      prisma.lessonProgress.count(),
      prisma.certificate.count(),
    ]);
    return { m, l, p, cert };
  };

  it('seed lớp học: cấu trúc, kịch bản tài khoản test, idempotent', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    for (const k of ['member1', 'member2', 'member3']) seedUsers[k] = await c.registerUser(k);
    for (const u of Object.values(seedUsers)) for (const cid of ['photo', 'yt', 'fin']) await enrollmentService.grant(u.id, cid);
    const { seedClassroom } = await import('../prisma/seed/classroom.js');
    const ctx = { db: prisma, userIds: { member1: seedUsers.member1!.id, member2: seedUsers.member2!.id, member3: seedUsers.member3!.id } } as any;
    await seedClassroom(ctx);
    const first = await countRows();
    await seedClassroom(ctx);
    assert.deepEqual(await countRows(), first, 'chạy lại seed không nhân đôi');
    assert.ok(first.m >= 21 * 2 && first.cert === 2); // 2 chứng nhận: fin (khóa mặc định) + photo "Chỉnh sửa ảnh nâng cao"

    const { member1, member2, member3 } = seedUsers as Record<string, { token: string; id: string }>;
    const photo1 = await c.call('GET', '/courses/photo/modules', { token: member1!.token });
    assert.deepEqual(photo1.body.data.map((m: any) => [m.id, m.lessonsCount, m.completedCount, m.locked]), [['mod-photo-1', 6, 6, false], ['mod-photo-2', 6, 0, false]]);
    assert.equal(photo1.body.data[0].thumbnail, undefined);
    const p2 = await c.call('GET', '/courses/photo/modules', { token: member2!.token });
    assert.deepEqual(p2.body.data.map((m: any) => [m.completedCount, m.locked]), [[2, false], [0, true]]);
    const p3 = await c.call('GET', '/courses/photo/progress', { token: member3!.token });
    assert.equal(p3.body.data.percent, 0);
    assert.equal(p3.body.data.nextLesson.id, 'les-photo-1-1');
    const pr = await c.call('GET', '/courses/photo/progress', { token: member1!.token });
    assert.deepEqual([pr.body.data.percent, pr.body.data.completedModules, pr.body.data.nextLesson.id], [50, 1, 'les-photo-2-1']);

    // module 2 của yt yêu cầu cấp 2: member1 xong module 1 nhưng bị khóa theo cấp độ
    const yt = await c.call('GET', '/courses/yt/modules', { token: member1!.token });
    assert.deepEqual([yt.body.data[1].locked, yt.body.data[1].lockReason, yt.body.data[1].requiredLevel], [true, 'level', 2]);

    // chứng nhận cố định ở fin
    assert.equal((await c.call('GET', '/courses/fin/certificate', { token: member1!.token })).body.data.code, finCode);
    assert.equal((await c.call('GET', `/certificates/${finCode}`)).status, 200);
    assert.equal((await c.call('GET', '/courses/fin/certificate', { token: member2!.token })).status, 403);
  });

  const post = (path: string, token: string | undefined, body?: unknown) => c.call('POST', base + path, { token, body });

  it('401 khi thiếu token, 403 khi member quản lý nội dung', async () => {
    assert.equal((await c.call('GET', `${base}/modules`)).status, 401);
    assert.equal((await post('/modules', undefined, { title: 'x', description: '' })).status, 401);
    assert.equal((await post('/modules', learner.token, { title: 'x', description: '' })).status, 403);
    assert.equal((await c.call('DELETE', `${base}/modules/abc`, { token: learner.token })).status, 403);
    assert.equal((await c.call('PUT', `${base}/modules/order`, { token: learner.token, body: { ids: [] } })).status, 403);
  });

  it('module seed vẫn giữ hình dạng cũ và có thêm lockReason', async () => {
    const r = await c.call('GET', `${base}/modules`, { token: learner.token });
    assert.equal(r.status, 200);
    const first = r.body.data[0];
    for (const k of ['id', 'index', 'title', 'description', 'lessonsCount', 'completedCount', 'pct', 'locked', 'lockReason']) assert.ok(k in first, k);
    assert.equal(first.locked, false);
    assert.equal(r.body.data[1].lockReason, 'previous_module');
  });

  it('mod dọn nội dung seed và tạo module mới; validate 400/404', async () => {
    const seed = await c.call('GET', `${base}/modules`, { token: mod.token });
    for (const m of seed.body.data) assert.equal((await c.call('DELETE', `${base}/modules/${m.id}`, { token: mod.token })).status, 200);
    assert.deepEqual((await c.call('GET', `${base}/modules`, { token: mod.token })).body.data, []);

    assert.equal((await post('/modules', mod.token, { title: '', description: 'a' })).status, 400);
    assert.equal((await post('/modules', mod.token, { title: 'A', description: 'a', requiredLevel: 10 })).status, 400);
    assert.equal((await post('/modules', mod.token, { title: 'A', description: 'a', thumbnail: 'javascript:alert(1)' })).status, 400);

    const a = await post('/modules', mod.token, { title: 'Module 1', description: 'd1', thumbnail: 'https://img.test/a.png' });
    const b = await post('/modules', mod.token, { title: 'Module 2', description: 'd2', requiredLevel: 2 });
    const cc = await post('/modules', mod.token, { title: 'Module 3', description: 'd3' });
    assert.equal(a.status, 201);
    [m1, m2, m3] = [a.body.data.id, b.body.data.id, cc.body.data.id];

    assert.equal((await c.call('PATCH', `${base}/modules/nope`, { token: mod.token, body: { title: 'x' } })).status, 404);
    assert.equal((await c.call('PATCH', `${base}/modules/${m1}`, { token: mod.token, body: {} })).status, 400);
    const p = await c.call('PATCH', `${base}/modules/${m3}`, { token: mod.token, body: { title: 'Module 3 (sửa)' } });
    assert.equal(p.body.data.title, 'Module 3 (sửa)');
  });

  it('sắp xếp lại module, index tự đánh lại; danh sách sai bị 400', async () => {
    assert.equal((await c.call('PUT', `${base}/modules/order`, { token: mod.token, body: { ids: [m1, m2] } })).status, 400);
    assert.equal((await c.call('PUT', `${base}/modules/order`, { token: mod.token, body: { ids: [m1, m1, m2] } })).status, 400);
    const swapped = await c.call('PUT', `${base}/modules/order`, { token: mod.token, body: { ids: [m1, m3, m2] } });
    assert.equal(swapped.status, 200);
    assert.deepEqual(swapped.body.data.map((m: any) => [m.id, m.index]), [[m1, 1], [m3, 2], [m2, 3]]);
    await c.call('PUT', `${base}/modules/order`, { token: mod.token, body: { ids: [m1, m2, m3] } });
    const r = await c.call('GET', `${base}/modules`, { token: mod.token });
    assert.deepEqual(r.body.data.map((m: any) => m.index), [1, 2, 3]);
    assert.equal(r.body.data[0].thumbnail, 'https://img.test/a.png');
    assert.equal(r.body.data[1].requiredLevel, 2);
  });

  it('tạo bài học: whitelist videoUrl (chặn javascript:, host lạ) và chuẩn hóa embedUrl', async () => {
    const lessonBody = (extra: object) => ({ title: 'Bài', type: 'video', durationMin: 5, body: 'nd', ...extra });
    const path = `/modules/${m1}/lessons`;
    for (const bad of [
      'javascript:alert(1)',
      'https://evil.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'data:text/html,<script>1</script>',
    ]) {
      assert.equal((await post(path, mod.token, lessonBody({ videoUrl: bad }))).status, 400, bad);
    }
    assert.equal((await post(path, mod.token, lessonBody({ type: 'zip' }))).status, 400);
    assert.equal((await post(path, mod.token, lessonBody({ attachments: [{ name: 'f', url: 'javascript:1' }] }))).status, 400);

    const yt = await post(path, mod.token, lessonBody({ title: 'YT', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }));
    assert.equal(yt.status, 201);
    assert.equal(yt.body.data.embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
    l1a = yt.body.data.id;
    const vm = await post(path, mod.token, lessonBody({ title: 'Vimeo', videoUrl: 'https://vimeo.com/123456789', attachments: [{ name: 'Tài liệu', url: 'https://f.test/a.pdf', size: 10 }] }));
    assert.equal(vm.body.data.embedUrl, 'https://player.vimeo.com/video/123456789');
    assert.equal(vm.body.data.attachments.length, 1);
    l1b = vm.body.data.id;
    l2a = (await post(`/modules/${m2}/lessons`, mod.token, lessonBody({ type: 'file', title: 'M2' }))).body.data.id;
    l3a = (await post(`/modules/${m3}/lessons`, mod.token, lessonBody({ type: 'text', title: 'M3' }))).body.data.id;
    assert.equal((await post(`/modules/nope/lessons`, mod.token, lessonBody({}))).status, 404);
    assert.equal((await post(path, learner.token, lessonBody({}))).status, 403);
  });

  it('sửa, sắp xếp và xóa bài học', async () => {
    const p = await c.call('PATCH', `${base}/lessons/${l1a}`, { token: mod.token, body: { title: 'YT (sửa)', videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' } });
    assert.equal(p.body.data.embedUrl, 'https://www.youtube.com/embed/abcdefghijk');
    const bad = await c.call('PATCH', `${base}/lessons/${l1a}`, { token: mod.token, body: { videoUrl: 'https://evil.com/x' } });
    assert.equal(bad.status, 400);
    const cleared = await c.call('PATCH', `${base}/lessons/${l1a}`, { token: mod.token, body: { videoUrl: null } });
    assert.equal(cleared.body.data.embedUrl, undefined);
    assert.equal((await c.call('PATCH', `${base}/lessons/${l1a}`, { token: learner.token, body: { title: 'x' } })).status, 403);
    assert.equal((await c.call('PATCH', `${base}/lessons/nope`, { token: mod.token, body: { title: 'x' } })).status, 404);

    const ord = await c.call('PUT', `${base}/modules/${m1}/lessons/order`, { token: mod.token, body: { ids: [l1b, l1a] } });
    assert.equal(ord.status, 200);
    assert.deepEqual(ord.body.data.map((l: any) => l.index), [1, 2]);
    assert.equal(ord.body.data[0].id, l1b);
    assert.equal((await c.call('PUT', `${base}/modules/${m1}/lessons/order`, { token: mod.token, body: { ids: [l1b] } })).status, 400);

    const extra = (await post(`/modules/${m3}/lessons`, mod.token, { title: 'tạm', type: 'text', durationMin: 1, body: '' })).body.data.id;
    assert.equal((await c.call('DELETE', `${base}/lessons/${extra}`, { token: mod.token })).status, 200);
    assert.equal((await c.call('DELETE', `${base}/lessons/${extra}`, { token: mod.token })).status, 404);
  });

  it('khóa module: theo thứ tự (previous_module) và server chặn xem/hoàn thành', async () => {
    const r = await c.call('GET', `${base}/modules`, { token: learner.token });
    assert.deepEqual(r.body.data.map((m: any) => [m.locked, m.lockReason]), [[false, null], [true, 'previous_module'], [true, 'previous_module']]);

    const d = await c.call('GET', `${base}/lessons/${l2a}`, { token: learner.token });
    assert.equal(d.status, 403);
    assert.equal(d.body.error?.code ?? d.body.code, 'MODULE_LOCKED');
    assert.equal((await post(`/lessons/${l2a}/complete`, learner.token)).status, 403);
    assert.equal((await c.call('GET', `${base}/modules/${m2}/lessons`, { token: learner.token })).status, 403);

    // mod+ luôn xem được để duyệt nội dung
    assert.equal((await c.call('GET', `${base}/lessons/${l2a}`, { token: mod.token })).status, 200);
    const mr = await c.call('GET', `${base}/modules`, { token: mod.token });
    assert.ok(mr.body.data.every((m: any) => m.locked === false));
  });

  it('chi tiết bài học, prev/next, và người ngoài cộng đồng bị 403', async () => {
    const d = await c.call('GET', `${base}/lessons/${l1b}`, { token: learner.token });
    assert.equal(d.status, 200);
    assert.equal(d.body.data.prevLessonId, null);
    assert.equal(d.body.data.nextLessonId, l1a);
    assert.equal(d.body.data.moduleId, m1);
    assert.equal(d.body.data.completed, false);
    assert.equal(d.body.data.embedUrl, 'https://player.vimeo.com/video/123456789');
    assert.equal((await c.call('GET', `${base}/lessons/nope`, { token: learner.token })).status, 404);
    const outsider = await c.registerUser('outsider');
    assert.equal((await c.call('GET', `${base}/lessons/${l1b}`, { token: outsider.token })).status, 403);
    assert.equal((await c.call('GET', `${base}/progress`, { token: outsider.token })).status, 403);
  });

  it('hoàn thành bài: toggle giữ nguyên, điểm chỉ cộng 1 lần, module kế bị khóa theo cấp độ', async () => {
    const { pointsService } = await import('../src/modules/points/points.service.js');
    const t1 = await post(`/lessons/${l1a}/complete`, learner.token);
    assert.equal(t1.body.data.completed, true);
    assert.equal((await post(`/lessons/${l1a}/complete`, learner.token)).body.data.completed, false);
    assert.equal((await post(`/lessons/${l1a}/complete`, learner.token)).body.data.completed, true);
    assert.equal(await pointsService.totalFor(COURSE, learner.id, 'all'), 3);
    await post(`/lessons/${l1b}/complete`, learner.token);
    assert.equal(await pointsService.totalFor(COURSE, learner.id, 'all'), 6);

    // Module 1 xong nhưng Module 2 yêu cầu cấp 2 (>= 20 điểm) -> khóa vì cấp độ
    const r = await c.call('GET', `${base}/modules`, { token: learner.token });
    assert.deepEqual([r.body.data[1].locked, r.body.data[1].lockReason], [true, 'level']);
    assert.equal((await post(`/lessons/${l2a}/complete`, learner.token)).status, 403);

    for (let i = 0; i < 4; i++) await pointsService.award(learner.id, COURSE, 'post');
    const r2 = await c.call('GET', `${base}/modules`, { token: learner.token });
    assert.equal(r2.body.data[1].locked, false);
  });

  it('tiến độ', async () => {
    const p0 = await c.call('GET', `${base}/progress`, { token: learner.token });
    assert.equal(p0.status, 200);
    assert.deepEqual(
      { ...p0.body.data, lastLessonId: undefined },
      { learningCourseId: mainCourseId(COURSE), percent: 50, completedLessons: 2, totalLessons: 4, completedModules: 1, lastLessonId: undefined, nextLesson: { id: l2a, title: 'M2', moduleId: m2 } },
    );
    assert.equal(p0.body.data.lastLessonId, l1b);
    assert.equal((await c.call('GET', `${base}/progress`)).status, 401);
  });

  it('chứng nhận: mặc định tắt; member không đổi được cài đặt; chỉ cấp khi hoàn thành 100%', async () => {
    assert.equal((await c.call('GET', `${base}/classroom-settings`, { token: learner.token })).body.data.certificatesEnabled, true); // seed
    await c.call('PATCH', `${base}/classroom-settings`, { token: admin.token, body: { certificatesEnabled: false } });
    assert.equal((await c.call('GET', `${base}/classroom-settings`, { token: learner.token })).body.data.certificatesEnabled, false);
    assert.equal((await c.call('GET', `${base}/certificate`, { token: learner.token })).status, 403);
    assert.equal((await c.call('PATCH', `${base}/classroom-settings`, { token: mod.token, body: { certificatesEnabled: true } })).status, 403);
    assert.equal((await c.call('PATCH', `${base}/classroom-settings`, { token: admin.token, body: { certificatesEnabled: 'yes' } })).status, 400);
    const on = await c.call('PATCH', `${base}/classroom-settings`, { token: admin.token, body: { certificatesEnabled: true } });
    assert.equal(on.body.data.certificatesEnabled, true);

    const early = await c.call('GET', `${base}/certificate`, { token: learner.token });
    assert.equal(early.status, 403); // chưa 100%

    await post(`/lessons/${l2a}/complete`, learner.token);
    await post(`/lessons/${l3a}/complete`, learner.token);
    const done = await c.call('GET', `${base}/progress`, { token: learner.token });
    assert.equal(done.body.data.percent, 100);
    assert.equal(done.body.data.nextLesson, null);

    const cert = await c.call('GET', `${base}/certificate`, { token: learner.token });
    assert.equal(cert.status, 200);
    const { code, holderName, courseTitle, completedAt, issuedAt } = cert.body.data;
    assert.ok(code.length >= 16 && holderName && courseTitle && completedAt && issuedAt);
    assert.equal((await c.call('GET', `${base}/certificate`, { token: learner.token })).body.data.code, code); // cấp 1 lần

    const { notificationStore } = await import('../src/modules/notifications/notifications.service.js');
    assert.ok(notificationStore.all().some((n) => n.userId === learner.id && n.type === 'system' && n.courseId === COURSE));

    // Xác minh CÔNG KHAI: không token, không lộ userId/email
    const pub = await c.call('GET', `/certificates/${code}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.body.data.holderName, holderName);
    const raw = JSON.stringify(pub.body);
    assert.ok(!raw.includes(learner.id) && !raw.includes(learner.email) && !raw.includes('userId'));
    assert.equal((await c.call('GET', `/certificates/khong-ton-tai`)).status, 404);
  });

  it('xóa module xóa cả bài học và tiến độ liên quan', async () => {
    assert.equal((await c.call('DELETE', `${base}/modules/${m3}`, { token: mod.token })).status, 200);
    assert.equal((await c.call('GET', `${base}/lessons/${l3a}`, { token: mod.token })).status, 404);
    const p = await c.call('GET', `${base}/progress`, { token: learner.token });
    assert.equal(p.body.data.totalLessons, 3);
    assert.equal(p.body.data.completedLessons, 3);
    assert.equal((await c.call('DELETE', `${base}/modules/${m3}`, { token: mod.token })).status, 404);
    // chứng nhận đã cấp vẫn xác minh được sau khi nội dung đổi
    const cert = await c.call('GET', `${base}/certificate`, { token: learner.token });
    assert.equal(cert.status, 200);
  });

  it('hoàn thành song song: điểm chỉ cộng 1 lần, chỉ 1 dòng tiến độ', async () => {
    const { pointsService } = await import('../src/modules/points/points.service.js');
    const { prisma } = await import('../src/db/prisma.js');
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    const racer = await c.registerUser('racer');
    await enrollmentService.grant(racer.id, COURSE);
    const rs = await Promise.all(Array.from({ length: 8 }, () => post(`/lessons/${l1a}/complete`, racer.token)));
    assert.ok(rs.every((r) => r.status === 200));
    assert.equal(await pointsService.totalFor(COURSE, racer.id, 'all'), 3);
    assert.equal(await prisma.lessonProgress.count({ where: { userId: racer.id, lessonId: l1a } }), 1);
  });

  it('cấp chứng nhận đồng thời chỉ tạo 1 bản (unique user,course); mã cũ vẫn xác minh được khi tắt', async () => {
    const { pointsService } = await import('../src/modules/points/points.service.js');
    const { prisma } = await import('../src/db/prisma.js');
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    const u = await c.registerUser('certrace');
    await enrollmentService.grant(u.id, COURSE);
    await post(`/lessons/${l1a}/complete`, u.token);
    await post(`/lessons/${l1b}/complete`, u.token);
    for (let i = 0; i < 4; i++) await pointsService.award(u.id, COURSE, 'post');
    await post(`/lessons/${l2a}/complete`, u.token);
    assert.equal((await c.call('GET', `${base}/progress`, { token: u.token })).body.data.percent, 100);
    await c.call('PATCH', `${base}/classroom-settings`, { token: admin.token, body: { certificatesEnabled: true } });
    const rs = await Promise.all(Array.from({ length: 6 }, () => c.call('GET', `${base}/certificate`, { token: u.token })));
    assert.ok(rs.every((r) => r.status === 200));
    assert.equal(new Set(rs.map((r) => r.body.data.code)).size, 1);
    assert.equal(await prisma.certificate.count({ where: { userId: u.id, communityId: COURSE } }), 1);
    await c.call('PATCH', `${base}/classroom-settings`, { token: admin.token, body: { certificatesEnabled: false } });
    assert.equal((await c.call('GET', `${base}/certificate`, { token: u.token })).status, 403);
    assert.equal((await c.call('GET', `/certificates/${rs[0]!.body.data.code}`)).status, 200);
  });

  it('tạo bài/module đồng thời: index liên tục không trùng; xóa/sắp xếp nhất quán', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const body = (t: string) => ({ title: t, type: 'text', durationMin: 1, body: '' });
    const created = await Promise.all(Array.from({ length: 8 }, (_, i) => post(`/modules/${m2}/lessons`, mod.token, body(`P${i}`))));
    assert.ok(created.every((r) => r.status === 201));
    const idx = (await prisma.classroomLesson.findMany({ where: { moduleId: m2 }, orderBy: { index: 'asc' } })).map((l) => l.index);
    assert.deepEqual(idx, Array.from({ length: 9 }, (_, i) => i + 1));

    const mods = await Promise.all(Array.from({ length: 4 }, (_, i) => post('/modules', mod.token, { title: `Đồng thời ${i}`, description: '' })));
    const extra = mods.map((r) => r.body.data.id as string);
    const seq = async () => (await prisma.classroomModule.findMany({ where: { learningCourseId: mainCourseId(COURSE) }, orderBy: { index: 'asc' } })).map((m) => m.index); // thứ tự theo TỪNG khóa học (seed thêm khóa 2 cho photo)
    const all = await seq();
    assert.deepEqual(all, all.map((_, i) => i + 1));

    const lessonInExtra = (await post(`/modules/${extra[1]}/lessons`, mod.token, body('X'))).body.data.id as string;
    await prisma.lessonProgress.create({ data: { userId: learner.id, lessonId: lessonInExtra, completedAt: new Date() } });
    assert.equal((await c.call('DELETE', `${base}/modules/${extra[1]}`, { token: mod.token })).status, 200);
    assert.equal(await prisma.lessonProgress.count({ where: { lessonId: lessonInExtra } }), 0);
    assert.equal(await prisma.classroomLesson.count({ where: { id: lessonInExtra } }), 0);
    const afterDel = await seq();
    assert.deepEqual(afterDel, afterDel.map((_, i) => i + 1));

    const cur = (await c.call('GET', `${base}/modules`, { token: mod.token })).body.data.map((m: any) => m.id as string);
    const rev = [...cur].reverse();
    assert.equal((await c.call('PUT', `${base}/modules/order`, { token: mod.token, body: { ids: [...cur, 'lạ'] } })).status, 400);
    const ok = await c.call('PUT', `${base}/modules/order`, { token: mod.token, body: { ids: rev } });
    assert.deepEqual(ok.body.data.map((m: any) => m.id), rev);
  });

  it('hiệu năng: khóa 400 bài vẫn phản hồi nhanh (không N+1)', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    await prisma.classroomModule.create({ data: { id: 'perf-mod', communityId: 'yt', learningCourseId: mainCourseId('yt'), index: 99, title: 'Perf', description: '' } });
    await prisma.classroomLesson.createMany({
      data: Array.from({ length: 400 }, (_, i) => ({ id: `perf-l-${i}`, moduleId: 'perf-mod', communityId: 'yt', index: i + 1, title: `L${i}` })),
    });
    const u = seedUsers.member1!;
    const t0 = Date.now();
    const [a, b] = await Promise.all([
      c.call('GET', '/courses/yt/progress', { token: u.token }),
      c.call('GET', '/courses/yt/modules', { token: u.token }),
    ]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.equal(a.body.data.totalLessons, 24 + 400);
    assert.ok(Date.now() - t0 < 3000, `quá chậm: ${Date.now() - t0}ms`);
  });
});
