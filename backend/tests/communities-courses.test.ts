import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

// env.ts parse lúc import app, nên phải đặt TRƯỚC startTestServer().
const ADMIN_EMAIL = 'platform-admin-cc@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

/**
 * Tách Community / Course (audit §2.1): 1 cộng đồng → NHIỀU khóa học. Contract: docs/api/communities-courses.md.
 * Các `it` chạy tuần tự và dùng chung một cộng đồng (`cid`) có hai khóa học.
 */
describe('cộng đồng ↔ khóa học', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  type U = { token: string; id: string };
  let owner: U, admin: U, mod: U, member: U, outsider: U, platform: U;
  let cid: string;
  let courseA: string; // khóa mặc định (tạo cùng cộng đồng)
  let courseB: string;
  let enrollmentService: typeof import('../src/modules/enrollments/enrollments.service.js').enrollmentService;

  const call = (method: string, path: string, u?: U, body?: unknown) => c.call(method, path, { ...(u ? { token: u.token } : {}), ...(body !== undefined ? { body } : {}) });
  const lesson = { title: 'Bài học', type: 'text', durationMin: 1, body: 'nội dung' };

  /** Tạo module + `n` bài trong khóa bằng route mới; trả về { moduleId, lessonIds }. */
  async function addModule(courseId: string, title: string, n = 1) {
    const m = await call('POST', `/communities/${cid}/courses/${courseId}/modules`, mod, { title, description: '' });
    assert.equal(m.status, 201, JSON.stringify(m.body));
    const lessonIds: string[] = [];
    for (let i = 0; i < n; i++) {
      const l = await call('POST', `/communities/${cid}/courses/${courseId}/modules/${m.body.data.id}/lessons`, mod, { ...lesson, title: `${title} / ${i + 1}` });
      assert.equal(l.status, 201, JSON.stringify(l.body));
      lessonIds.push(l.body.data.id as string);
    }
    return { moduleId: m.body.data.id as string, lessonIds, module: m.body.data };
  }
  const complete = (u: U, lessonId: string) => call('POST', `/communities/${cid}/lessons/${lessonId}/complete`, u);
  /** Hoàn thành mọi bài còn lại của khóa theo đúng thứ tự mở khóa (không bật/tắt lại bài đã xong). */
  async function finish(u: U, course: string) {
    for (let guard = 0; guard < 10; guard++) {
      const mods = (await call('GET', `/communities/${cid}/courses/${course}/modules`, u)).body.data as Array<{ id: string; lessonsCount: number; completedCount: number }>;
      const next = mods.find((m) => m.completedCount < m.lessonsCount);
      if (!next) return;
      const ls = (await call('GET', `/communities/${cid}/courses/${course}/modules/${next.id}/lessons`, u)).body.data as Array<{ id: string; completed: boolean }>;
      for (const l of ls) if (!l.completed) assert.equal((await complete(u, l.id)).status, 200);
    }
    assert.fail('không hoàn thành được khóa');
  }

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js'));
    [owner, admin, mod, member, outsider] = await Promise.all(['own', 'adm', 'mod', 'mem', 'out'].map((p) => c.registerUser(p)));
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    platform = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  it('POST /communities: tạo cộng đồng + owner + khóa học mặc định trong 1 transaction; detail có defaultCourseId/coursesCount', async () => {
    const created = await call('POST', '/communities', owner, {
      title: 'Học Nhiều Khóa', description: 'Cộng đồng thử nghiệm đa khóa học', category: 'tech', priceUsd: 0, visibility: 'public', language: 'vi',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    cid = created.body.data.id;
    assert.equal(cid, 'hoc-nhieu-khoa');
    assert.equal(created.body.data.communityId, cid);
    assert.equal(created.body.data.lessons, 0, 'chưa có bài học thật');

    const rows = await db.prisma.course.findMany({ where: { communityId: cid } });
    assert.equal(rows.length, 1);
    courseA = rows[0]!.id;
    assert.equal(created.body.data.defaultCourseId, courseA);
    assert.equal(rows[0]!.title, 'Học Nhiều Khóa');
    assert.equal(rows[0]!.publishStatus, 'published');
    assert.equal((await db.prisma.enrollment.findUnique({ where: { userId_communityId: { userId: owner.id, communityId: cid } } }))?.role, 'owner');

    // detail (route cũ và mới giống hệt)
    const d1 = await call('GET', `/courses/${cid}`, owner);
    const d2 = await call('GET', `/communities/${cid}`, owner);
    assert.deepEqual(d2.body, d1.body);
    assert.equal(d1.body.data.defaultCourseId, courseA);
    assert.equal(d1.body.data.coursesCount, 1);
    assert.equal(d1.body.data.communityId, cid);

    // tạo song song cùng tên: slug không đụng nhau (không 500)
    const [x, y] = await Promise.all([1, 2].map(() => call('POST', '/communities', owner, {
      title: 'Trùng Tên', description: 'Cộng đồng trùng tên', category: 'tech', priceUsd: 0, visibility: 'public', language: 'vi',
    })));
    assert.deepEqual([x.status, y.status], [201, 201]);
    assert.notEqual(x.body.data.id, y.body.data.id);

    for (const [u, role] of [[admin, 'admin'], [mod, 'mod'], [member, 'member']] as const) {
      assert.equal((await call('POST', `/communities/${cid}/enroll`, u)).status, 200); // route mới = route cũ
      if (role !== 'member') await enrollmentService.setRole(u.id, cid, role);
    }
  });

  it('GET /communities (danh sách) ≡ GET /courses; /communities/featured ≡ /courses/featured; query courseId ≡ communityId', async () => {
    const a = await call('GET', '/communities?limit=50&sort=newest');
    const b = await call('GET', '/courses?limit=50&sort=newest');
    assert.equal(a.status, 200);
    assert.deepEqual(a.body, b.body);
    assert.ok(a.body.data.some((x: { id: string }) => x.id === cid));
    assert.equal((await call('GET', '/communities/featured')).status, 200);
    assert.equal((await call('GET', '/communities/khong-co')).status, 404);
    // POST /communities (tạo) KHÔNG bị viết lại sang /courses
    assert.equal((await call('POST', '/communities', undefined, {})).status, 401);

    // tìm trong 1 cộng đồng: courseId (cũ) và communityId (mới) đều được nhận
    const s1 = await call('GET', `/search?q=nhieu&type=posts&courseId=${cid}`, owner);
    const s2 = await call('GET', `/search?q=nhieu&type=posts&communityId=${cid}`, owner);
    assert.equal(s1.status, 200, JSON.stringify(s1.body));
    assert.deepEqual(s1.body, s2.body);
    assert.equal((await call('GET', `/search?q=nhieu&communityId=${cid}`, outsider)).status, 403, 'không phải thành viên');
  });

  it('CRUD khóa học + quyền: member 403, mod tạo/sửa/sắp xếp/lưu trữ, admin xóa; nháp chỉ mod+ thấy', async () => {
    const base = `/communities/${cid}/courses`;
    assert.equal((await call('GET', base)).status, 401);
    assert.equal((await call('GET', base, outsider)).status, 403);
    // member: đọc được, không ghi được
    const list0 = await call('GET', base, member);
    assert.equal(list0.status, 200);
    assert.deepEqual(list0.body.data.map((x: { id: string; isDefault: boolean }) => [x.id, x.isDefault]), [[courseA, true]]);
    for (const r of [
      await call('POST', base, member, { title: 'x' }),
      await call('PATCH', `${base}/${courseA}`, member, { title: 'x' }),
      await call('PUT', `${base}/order`, member, { ids: [courseA] }),
      await call('POST', `${base}/${courseA}/archive`, member),
      await call('DELETE', `${base}/${courseA}`, member),
    ]) assert.equal(r.status, 403);

    // validate
    assert.equal((await call('POST', base, mod, { title: '' })).status, 400);
    assert.equal((await call('POST', base, mod, { title: 'x', thumbnailUrl: 'javascript:alert(1)' })).status, 400);
    assert.equal((await call('PATCH', `${base}/${courseA}`, mod, {})).status, 400);

    // mod tạo khóa B (published) và khóa nháp D
    const b = await call('POST', base, mod, { title: 'Khóa B', description: 'Mô tả B' });
    assert.equal(b.status, 201, JSON.stringify(b.body));
    courseB = b.body.data.id;
    assert.deepEqual(
      { communityId: b.body.data.communityId, position: b.body.data.position, publishStatus: b.body.data.publishStatus, isDefault: b.body.data.isDefault, modulesCount: b.body.data.modulesCount },
      { communityId: cid, position: 2, publishStatus: 'published', isDefault: false, modulesCount: 0 },
    );
    assert.equal(b.body.data.certificatesEnabled, null);
    assert.equal(b.body.data.certificatesEffective, false, 'kế thừa cài đặt cộng đồng (mặc định tắt)');
    const d = await call('POST', base, mod, { title: 'Khóa nháp', publishStatus: 'draft' });
    assert.equal(d.status, 201);
    const draftId = d.body.data.id as string;

    // nháp: member không thấy trong danh sách, 404 khi gọi trực tiếp; mod+ thấy
    assert.deepEqual((await call('GET', base, member)).body.data.map((x: { id: string }) => x.id), [courseA, courseB]);
    assert.equal((await call('GET', `${base}/${draftId}`, member)).status, 404);
    assert.equal((await call('GET', `${base}/${draftId}/modules`, member)).status, 404);
    assert.equal((await call('GET', `${base}/${draftId}`, mod)).status, 200);
    assert.deepEqual((await call('GET', base, mod)).body.data.map((x: { id: string }) => x.id), [courseA, courseB, draftId]);
    assert.deepEqual((await call('GET', `${base}?status=draft`, mod)).body.data.map((x: { id: string }) => x.id), [draftId]);
    assert.equal((await call('GET', `${base}?status=bogus`, mod)).status, 400);
    // khóa không thuộc cộng đồng / không tồn tại
    assert.equal((await call('GET', `${base}/khong-co`, mod)).status, 404);
    assert.equal((await call('GET', `/communities/photo/courses/${courseA}`, mod)).status, 403, 'mod không phải thành viên photo');

    // PATCH: mod đổi tên/mô tả/thumbnail; certificatesEnabled cần admin
    const p = await call('PATCH', `${base}/${courseB}`, mod, { title: 'Khóa B (đổi)', thumbnailUrl: 'https://example.com/b.png' });
    assert.equal(p.status, 200);
    assert.deepEqual([p.body.data.title, p.body.data.thumbnailUrl], ['Khóa B (đổi)', 'https://example.com/b.png']);
    assert.equal((await call('PATCH', `${base}/${courseB}`, mod, { thumbnailUrl: null })).body.data.thumbnailUrl, null);
    assert.equal((await call('PATCH', `${base}/${courseB}`, mod, { certificatesEnabled: true })).status, 403);
    assert.equal((await call('PATCH', `${base}/${courseB}`, admin, { certificatesEnabled: true })).body.data.certificatesEffective, true);
    assert.equal((await call('PATCH', `${base}/${courseB}`, admin, { certificatesEnabled: null })).body.data.certificatesEnabled, null);

    // sắp xếp: phải là hoán vị đủ; khóa mặc định đổi theo thứ tự (published đầu tiên)
    assert.equal((await call('PUT', `${base}/order`, mod, { ids: [courseA] })).status, 400);
    assert.equal((await call('PUT', `${base}/order`, mod, { ids: [courseA, courseA, courseB] })).status, 400);
    const ord = await call('PUT', `${base}/order`, mod, { ids: [draftId, courseB, courseA] });
    assert.equal(ord.status, 200);
    assert.deepEqual(ord.body.data.map((x: { id: string; position: number }) => [x.id, x.position]), [[draftId, 1], [courseB, 2], [courseA, 3]]);
    assert.equal(ord.body.data.find((x: { id: string }) => x.id === courseB).isDefault, true, 'published đầu tiên theo vị trí');
    assert.equal((await call('PUT', `${base}/order`, mod, { ids: [courseA, courseB, draftId] })).status, 200);
    assert.equal((await call('GET', `/courses/${cid}`, member)).body.data.defaultCourseId, courseA);

    // lưu trữ → thành viên không còn thấy; mod+ vẫn thấy
    const ar = await call('POST', `${base}/${draftId}/archive`, mod);
    assert.equal(ar.body.data.publishStatus, 'archived');
    assert.deepEqual((await call('GET', `${base}?status=archived`, mod)).body.data.map((x: { id: string }) => x.id), [draftId]);

    // xóa: mod 403 (cần admin); admin xóa được; khóa cuối cùng không xóa được
    assert.equal((await call('DELETE', `${base}/${draftId}`, mod)).status, 403);
    assert.equal((await call('DELETE', `${base}/${draftId}`, admin)).status, 200);
    assert.equal((await call('GET', `${base}/${draftId}`, mod)).status, 404);
    assert.equal((await call('DELETE', `${base}/${draftId}`, admin)).status, 404);
    assert.equal((await db.prisma.course.count({ where: { communityId: cid } })), 2);
    // position được đánh lại liên tục
    assert.deepEqual((await db.prisma.course.findMany({ where: { communityId: cid }, orderBy: { position: 'asc' } })).map((x) => x.position), [1, 2]);
  });

  it('khóa cuối cùng không xóa được; cộng đồng không có khóa nào vẫn tạo module qua route cũ (khóa mặc định được tạo)', async () => {
    const solo = (await call('POST', '/communities', owner, { title: 'Một Khóa', description: 'Cộng đồng một khóa', category: 'tech', priceUsd: 0, visibility: 'public', language: 'vi' })).body.data;
    const only = solo.defaultCourseId as string;
    assert.equal((await call('DELETE', `/communities/${solo.id}/courses/${only}`, owner)).status, 400);
    assert.equal((await db.prisma.course.count({ where: { communityId: solo.id } })), 1);

    // Cộng đồng tạo thẳng bằng DB (không qua service) — chưa có khóa nào
    await db.prisma.community.create({
      data: { id: 'legacy-no-course', title: 'Legacy', description: 'x', category: 'tech', thumbnail: 'x', instructorName: 'GV', instructorRole: 'M', ownerId: owner.id },
    });
    await db.prisma.enrollment.create({ data: { userId: owner.id, communityId: 'legacy-no-course', role: 'owner' } });
    assert.deepEqual((await call('GET', '/courses/legacy-no-course/modules', owner)).body.data, [], 'chưa có khóa → danh sách rỗng, không 500');
    const m = await call('POST', '/courses/legacy-no-course/modules', owner, { title: 'M', description: '' });
    assert.equal(m.status, 201, JSON.stringify(m.body));
    assert.equal((await db.prisma.course.count({ where: { communityId: 'legacy-no-course' } })), 1, 'khóa mặc định được tạo khi cần');
    assert.equal(m.body.data.learningCourseId, (await db.prisma.course.findFirstOrThrow({ where: { communityId: 'legacy-no-course' } })).id);
  });

  it('module/khóa tuần tự/tiến độ cô lập theo từng khóa học; route cũ = khóa mặc định; module nhận learningCourseId', async () => {
    const A = await Promise.all([addModule(courseA, 'A1'), addModule(courseA, 'A2')]);
    const B = await Promise.all([addModule(courseB, 'B1'), addModule(courseB, 'B2')]);
    // Promise.all tạo song song: index vẫn 1..2 theo từng khóa
    const idx = async (course: string) => (await db.prisma.classroomModule.findMany({ where: { learningCourseId: course }, orderBy: { index: 'asc' } })).map((m) => m.index);
    assert.deepEqual([await idx(courseA), await idx(courseB)], [[1, 2], [1, 2]]);
    const [a1, a2] = [...A].sort((x, y) => x.module.index - y.module.index);
    const [b1, b2] = [...B].sort((x, y) => x.module.index - y.module.index);
    assert.ok(a1 && a2 && b1 && b2);

    // DTO module: courseId (cũ, = cộng đồng) giữ nguyên, thêm communityId + learningCourseId
    assert.deepEqual([a1.module.courseId, a1.module.communityId, a1.module.learningCourseId], [cid, cid, courseA]);

    const modsA = await call('GET', `/communities/${cid}/courses/${courseA}/modules`, member);
    const modsB = await call('GET', `/communities/${cid}/courses/${courseB}/modules`, member);
    assert.deepEqual(modsA.body.data.map((m: any) => [m.id, m.locked, m.lockReason, m.learningCourseId]), [[a1.moduleId, false, null, courseA], [a2.moduleId, true, 'previous_module', courseA]]);
    assert.deepEqual(modsB.body.data.map((m: any) => [m.id, m.locked]), [[b1.moduleId, false], [b2.moduleId, true]]);

    // hoàn thành bài của A1 → mở A2; B không bị ảnh hưởng
    assert.equal((await complete(member, a1.lessonIds[0]!)).status, 200);
    const after = {
      A: (await call('GET', `/communities/${cid}/courses/${courseA}/modules`, member)).body.data.map((m: any) => m.locked),
      B: (await call('GET', `/communities/${cid}/courses/${courseB}/modules`, member)).body.data.map((m: any) => m.locked),
    };
    assert.deepEqual(after, { A: [false, false], B: [false, true] });
    // bài của B2 vẫn bị khóa (khóa tuần tự chỉ trong khóa B), không thể đánh dấu hoàn thành
    assert.equal((await complete(member, b2.lessonIds[0]!)).status, 403);
    assert.equal((await call('GET', `/communities/${cid}/courses/${courseB}/modules/${b2.moduleId}/lessons`, member)).status, 403);
    // module của khóa này không truy cập được qua :courseId của khóa kia
    assert.equal((await call('GET', `/communities/${cid}/courses/${courseA}/modules/${b1.moduleId}/lessons`, member)).status, 404);
    assert.equal((await call('POST', `/communities/${cid}/courses/${courseA}/modules/${b1.moduleId}/lessons`, mod, lesson)).status, 404);
    assert.equal((await call('PATCH', `/communities/${cid}/courses/${courseA}/modules/${b1.moduleId}`, mod, { title: 'x' })).status, 404);

    // tiến độ theo khóa
    const pA = (await call('GET', `/communities/${cid}/courses/${courseA}/progress`, member)).body.data;
    const pB = (await call('GET', `/communities/${cid}/courses/${courseB}/progress`, member)).body.data;
    assert.deepEqual([pA.learningCourseId, pA.percent, pA.completedLessons, pA.totalLessons, pA.completedModules], [courseA, 50, 1, 2, 1]);
    assert.deepEqual([pB.learningCourseId, pB.percent, pB.completedLessons, pB.totalLessons], [courseB, 0, 0, 2]);
    // khóa học trong danh sách mang tiến độ + số module/bài của người xem
    const lc = (await call('GET', `/communities/${cid}/courses`, member)).body.data;
    assert.deepEqual(lc.map((x: any) => [x.id, x.modulesCount, x.lessonsCount, x.progress.percent]), [[courseA, 2, 2, 50], [courseB, 2, 2, 0]]);

    // route cũ = khóa mặc định (A)
    const legacyMods = await call('GET', `/courses/${cid}/modules`, member);
    assert.deepEqual(legacyMods.body, (await call('GET', `/communities/${cid}/courses/${courseA}/modules`, member)).body);
    assert.deepEqual((await call('GET', `/courses/${cid}/progress`, member)).body, { data: pA });
    // route cũ chỉ ghi vào khóa mặc định; body.learningCourseId chọn khóa khác; /communities/:id/modules ≡ /courses/:id/modules
    const viaLegacy = await call('POST', `/courses/${cid}/modules`, mod, { title: 'A3 (route cũ)', description: '' });
    assert.equal(viaLegacy.body.data.learningCourseId, courseA);
    const viaCommunities = await call('POST', `/communities/${cid}/modules`, mod, { title: 'B3 (learningCourseId)', description: '', learningCourseId: courseB });
    assert.equal(viaCommunities.status, 201);
    assert.equal(viaCommunities.body.data.learningCourseId, courseB);
    assert.equal((await call('POST', `/communities/${cid}/modules`, mod, { title: 'x', description: '', learningCourseId: 'khong-co' })).status, 404);
    // sắp xếp module theo khóa: hoán vị phải đủ module CỦA KHÓA ĐÓ
    assert.equal((await call('PUT', `/communities/${cid}/courses/${courseA}/modules/order`, mod, { ids: [b1.moduleId, b2.moduleId] })).status, 400);
    const ord = await call('PUT', `/communities/${cid}/courses/${courseA}/modules/order`, mod, { ids: [viaLegacy.body.data.id, a2.moduleId, a1.moduleId] });
    assert.equal(ord.status, 200);
    assert.deepEqual(ord.body.data.map((m: any) => m.id), [viaLegacy.body.data.id, a2.moduleId, a1.moduleId]);
    // dọn module phụ + khôi phục thứ tự
    await call('DELETE', `/courses/${cid}/modules/${viaLegacy.body.data.id}`, mod);
    await call('DELETE', `/communities/${cid}/courses/${courseB}/modules/${viaCommunities.body.data.id}`, mod);
    await call('PUT', `/communities/${cid}/courses/${courseA}/modules/order`, mod, { ids: [a1.moduleId, a2.moduleId] });
    assert.deepEqual([await idx(courseA), await idx(courseB)], [[1, 2], [1, 2]]);
    // bài học: chi tiết ở route cộng đồng, có learningCourseId
    const det = await call('GET', `/communities/${cid}/lessons/${a1.lessonIds[0]}`, member);
    assert.deepEqual([det.status, det.body.data.learningCourseId, det.body.data.communityId], [200, courseA, cid]);
    assert.equal((await call('GET', `/courses/${cid}/lessons/${a1.lessonIds[0]}`, member)).status, 200);
  });

  it('chứng nhận theo khóa học: 1 / (user, khóa), hai khóa → hai chứng nhận; ghi đè certificatesEnabled > cài đặt cộng đồng', async () => {
    // member hoàn thành 100% khóa A và B (A1 đã xong ở test trước)
    await finish(member, courseA);
    await finish(member, courseB);
    const done = async (course: string, u: U = member) => (await call('GET', `/communities/${cid}/courses/${course}/progress`, u)).body.data.percent;
    assert.deepEqual([await done(courseA), await done(courseB)], [100, 100]);

    const certA = `/communities/${cid}/courses/${courseA}/certificate`;
    const certB = `/communities/${cid}/courses/${courseB}/certificate`;
    // mặc định cộng đồng tắt → cả hai 403
    assert.equal((await call('GET', certA, member)).status, 403);
    assert.equal((await call('GET', certB, member)).status, 403);
    assert.equal((await call('GET', `/courses/${cid}/certificate`, member)).status, 403, 'route cũ = khóa mặc định');
    // override khóa B = true (admin) → chỉ B cấp được, dù cộng đồng vẫn tắt
    assert.equal((await call('PATCH', `/communities/${cid}/courses/${courseB}`, admin, { certificatesEnabled: true })).status, 200);
    assert.equal((await call('GET', certA, member)).status, 403);
    const cb = await call('GET', certB, member);
    assert.equal(cb.status, 200, JSON.stringify(cb.body));
    assert.equal(cb.body.data.learningCourseId, courseB);
    assert.equal(cb.body.data.communityId, cid);
    assert.equal(cb.body.data.courseTitle, 'Khóa B (đổi)');
    assert.equal((await call('GET', certB, member)).body.data.code, cb.body.data.code, 'cấp 1 lần');
    // bật mặc định cộng đồng → A cũng cấp được: hai chứng nhận KHÁC mã
    assert.equal((await call('PATCH', `/courses/${cid}/classroom-settings`, admin, { certificatesEnabled: true })).status, 200);
    assert.equal((await call('PATCH', `/courses/${cid}/classroom-settings`, mod, { certificatesEnabled: true })).status, 403);
    const ca = await call('GET', certA, member);
    assert.equal(ca.status, 200);
    assert.notEqual(ca.body.data.code, cb.body.data.code);
    assert.equal(ca.body.data.courseTitle, 'Học Nhiều Khóa');
    assert.equal(ca.body.data.learningCourseId, courseA);
    assert.equal((await call('GET', `/courses/${cid}/certificate`, member)).body.data.code, ca.body.data.code, 'route cũ = chứng nhận khóa mặc định');
    assert.equal(await db.prisma.certificate.count({ where: { userId: member.id, communityId: cid } }), 2);
    // cấp đồng thời chỉ giữ 1 bản
    const racer = await c.registerUser('racer');
    await enrollmentService.grant(racer.id, cid);
    await finish(racer, courseB);
    assert.equal(await done(courseB, racer), 100);
    const rs = await Promise.all(Array.from({ length: 5 }, () => call('GET', certB, racer)));
    assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.status)));
    assert.equal(new Set(rs.map((r) => r.body.data.code)).size, 1);
    assert.equal(await db.prisma.certificate.count({ where: { userId: racer.id, learningCourseId: courseB } }), 1);
    // override false thắng cài đặt cộng đồng (true)
    assert.equal((await call('PATCH', `/communities/${cid}/courses/${courseB}`, admin, { certificatesEnabled: false })).body.data.certificatesEffective, false);
    assert.equal((await call('GET', `/communities/${cid}/courses`, member)).body.data.find((x: any) => x.id === courseB).certificatesEffective, false);
    assert.equal((await call('GET', certB, racer)).status, 403);
    assert.equal((await call('GET', `/certificates/${cb.body.data.code}`)).status, 200, 'mã đã cấp vẫn xác minh được');
    assert.deepEqual(Object.keys((await call('GET', `/certificates/${ca.body.data.code}`)).body.data).sort(), ['courseTitle', 'holderName', 'issuedAt', 'valid']);
    await call('PATCH', `/communities/${cid}/courses/${courseB}`, admin, { certificatesEnabled: null });
  });

  it('số bài học của cộng đồng (lessons) được TÍNH từ lớp học thật (cả danh sách lẫn detail), chỉ tính khóa published', async () => {
    const real = async () => db.prisma.classroomLesson.count({ where: { communityId: cid, hidden: false, removedAt: null, module: { publishStatus: 'published', removedAt: null, course: { publishStatus: 'published', removedAt: null } } } });
    const n = await real();
    assert.ok(n >= 4);
    const detail = (await call('GET', `/courses/${cid}`, member)).body.data;
    assert.equal(detail.lessons, n);
    assert.equal(detail.facts.find((f: any) => f.label === 'Bài học').value, String(n));
    const listed = (await call('GET', `/communities?limit=50&sort=newest`)).body.data.find((x: any) => x.id === cid);
    assert.equal(listed.lessons, n);
    // lưu trữ khóa B → số bài giảm đúng bằng số bài của B
    const bLessons = await db.prisma.classroomLesson.count({ where: { module: { learningCourseId: courseB } } });
    await call('POST', `/communities/${cid}/courses/${courseB}/archive`, mod);
    assert.equal((await call('GET', `/courses/${cid}`, member)).body.data.lessons, n - bLessons);
    assert.equal((await call('GET', `/communities/${cid}/courses/${courseB}`, member)).status, 404);
    await call('PATCH', `/communities/${cid}/courses/${courseB}`, mod, { publishStatus: 'published' });
    assert.equal((await call('GET', `/courses/${cid}`, member)).body.data.lessons, n);
    // /me/enrollments: tiến độ cộng dồn các khóa published
    const me = (await call('GET', '/me/enrollments', member)).body.data.find((x: any) => x.course.id === cid);
    assert.equal(me.progressPct, 100);
  });

  it('route cũ ≡ route /communities/:id cho mọi họ route cộng đồng (cùng handler, cùng JSON)', async () => {
    const same = async (sub: string, u: U | undefined = member) => {
      const a = await call('GET', `/courses/${cid}${sub}`, u);
      const b = await call('GET', `/communities/${cid}${sub}`, u);
      assert.equal(b.status, a.status, sub);
      assert.deepEqual(b.body, a.body, sub);
      return a;
    };
    for (const sub of ['', '/modules', '/progress', '/classroom-settings', '/posts', '/events', '/reviews', '/leaderboard']) {
      const r = await same(sub);
      assert.ok(r.status < 500, `${sub} -> ${r.status}`);
    }
    // ghi: bài viết tạo qua /communities được đọc qua /courses
    const post = await call('POST', `/communities/${cid}/posts`, member, { content: 'Xin chào đa khóa học' });
    assert.equal(post.status, 201, JSON.stringify(post.body));
    assert.equal(post.body.data.communityId, cid);
    assert.equal(post.body.data.courseId, cid, 'courseId cũ vẫn có (alias)');
    assert.ok((await call('GET', `/courses/${cid}/posts`, member)).body.data.some((p: any) => p.id === post.body.data.id));
    // mod không phải thành viên → vẫn 403 ở cả hai prefix
    assert.equal((await call('GET', `/communities/${cid}/modules`, outsider)).status, (await call('GET', `/courses/${cid}/modules`, outsider)).status);
    // khóa học (entity mới) chỉ ở /communities, KHÔNG có ở /courses
    assert.equal((await call('GET', `/courses/${cid}/courses`, member)).status, 404);
  });

  it('admin console: Content → Courses là entity Course (có module count), lọc theo cộng đồng, gỡ/khôi phục tác động tới thành viên', async () => {
    const A = (method: string, path: string, body?: unknown) => call(method, `/admin${path}`, platform, body);
    const l = await A('GET', `/content/courses?communityId=${cid}&sort=oldest`);
    assert.equal(l.status, 200, JSON.stringify(l.body));
    assert.equal(l.body.meta.total, 2);
    assert.deepEqual(l.body.data.map((x: any) => x.id), [courseA, courseB]);
    const itemA = l.body.data[0];
    assert.deepEqual([itemA.title, itemA.community.id, itemA.creator.id, itemA.modules, itemA.lessons, itemA.status], ['Học Nhiều Khóa', cid, owner.id, 2, 2, 'published']);
    assert.ok('thumbnail' in itemA && 'completionPct' in itemA && 'students' in itemA);
    // legacy `courseId` (= id cộng đồng) vẫn được nhận
    assert.equal((await A('GET', `/content/courses?courseId=${cid}`)).body.meta.total, 2);
    const det = await A('GET', `/content/courses/${courseB}`);
    assert.equal(det.body.data.moduleList.length, 2);
    assert.equal(det.body.data.lessonList.length, 2);
    assert.equal((await A('GET', `/content/lessons?learningCourseId=${courseB}`)).body.meta.total, 2);

    // unpublish khóa mặc định A → thành viên thấy khóa B làm mặc định; restore trả lại
    const un = await A('POST', `/content/courses/${courseA}/unpublish`, { reason: 'Kiểm duyệt' });
    assert.equal(un.status, 200, JSON.stringify(un.body));
    assert.equal(un.body.data.status, 'draft');
    assert.deepEqual((await call('GET', `/communities/${cid}/courses`, member)).body.data.map((x: any) => x.id), [courseB]);
    assert.equal((await call('GET', `/courses/${cid}`, member)).body.data.defaultCourseId, courseB);
    assert.deepEqual((await call('GET', `/courses/${cid}/modules`, member)).body.data.map((m: any) => m.learningCourseId), [courseB, courseB]);
    assert.equal((await A('POST', `/content/courses/${courseA}/unpublish`, { reason: 'x' })).status, 409);
    const rm = await A('POST', `/content/courses/${courseB}/remove`, { reason: 'Vi phạm' });
    assert.equal(rm.body.data.status, 'removed');
    assert.deepEqual((await call('GET', `/communities/${cid}/courses`, mod)).body.data.map((x: any) => x.id), [courseA], 'khóa bị gỡ biến mất khỏi mọi người dùng');
    assert.equal((await call('GET', `/communities/${cid}/courses/${courseB}/modules`, mod)).status, 404);
    assert.equal((await A('POST', `/content/courses/${courseB}/restore`, {})).body.data.status, 'published');
    assert.equal((await A('POST', `/content/courses/${courseA}/publish`, {})).body.data.status, 'published');
    assert.equal((await A('GET', '/content/courses/summary')).body.data.total >= 2, true);
    assert.equal((await A('POST', '/content/courses/khong-co/publish', {})).status, 404);
    assert.equal((await call('GET', '/admin/content/courses', member)).status, 403);
  });

  it('xóa khóa học: cascade module/bài/tiến độ/chứng nhận của khóa đó; khóa còn lại và dữ liệu cộng đồng giữ nguyên', async () => {
    const mods = await db.prisma.classroomModule.count({ where: { learningCourseId: courseB } });
    assert.ok(mods >= 2);
    const certsB = await db.prisma.certificate.count({ where: { learningCourseId: courseB } });
    assert.ok(certsB >= 1);
    const certsA = await db.prisma.certificate.count({ where: { learningCourseId: courseA } });
    assert.equal((await call('DELETE', `/communities/${cid}/courses/${courseB}`, admin)).status, 200);
    assert.equal(await db.prisma.classroomModule.count({ where: { learningCourseId: courseB } }), 0);
    assert.equal(await db.prisma.certificate.count({ where: { learningCourseId: courseB } }), 0);
    assert.equal(await db.prisma.certificate.count({ where: { learningCourseId: courseA } }), certsA);
    assert.equal(await db.prisma.classroomLesson.count({ where: { module: { learningCourseId: courseB } } }), 0);
    assert.equal(await db.prisma.enrollment.count({ where: { communityId: cid } }) >= 5, true);
    assert.deepEqual((await call('GET', `/communities/${cid}/courses`, member)).body.data.map((x: any) => x.id), [courseA]);
  });
});
