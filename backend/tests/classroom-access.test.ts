import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

/** Lớp học: chế độ truy cập module (all/level/paid/selected), nháp, bài xem thử, học tuần tự, thông báo khi xuất bản. */
describe('lớp học: truy cập module', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const base = '/courses/photo';
  let mod: { token: string; id: string };
  let stranger: { token: string; id: string };
  let a: { token: string; id: string };
  let b: { token: string; id: string };
  let flush: () => Promise<void>;

  const call = async (method: string, path: string, token: string, body?: unknown) => {
    // Hoàn thành bài đòi xem hết video (nếu có): các test không bàn về video thì báo "đã xem" trước.
    if (method === 'POST' && /\/lessons\/[^/]+\/complete$/.test(path)) await c.call('POST', base + path.replace(/\/complete$/, '/watched'), { token });
    return c.call(method, base + path, { token, body });
  };
  const newModule = async (body: Record<string, unknown>) => (await call('POST', '/modules', mod.token, { title: 'M', description: 'd', ...body })).body.data.id as string;
  const newLesson = async (moduleId: string, body: Record<string, unknown> = {}) =>
    (await call('POST', `/modules/${moduleId}/lessons`, mod.token, { title: 'L', type: 'text', durationMin: 1, body: 'noi dung', ...body })).body.data.id as string;
  const view = async (token: string, moduleId: string) => (await call('GET', '/modules', token)).body.data.find((m: any) => m.id === moduleId);

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    ({ flushNotifications: flush } = await import('../src/modules/notifications/notifications.service.js'));
    mod = await c.registerUser('acmod');
    a = await c.registerUser('aca');
    b = await c.registerUser('acb');
    stranger = await c.registerUser('acstranger');
    for (const u of [mod, a, b]) await enrollmentService.grant(u.id, 'photo');
    await enrollmentService.setRole(mod.id, 'photo', 'mod');
    // dọn nội dung seed để thứ tự module không ảnh hưởng
    for (const m of (await call('GET', '/modules', mod.token)).body.data) await call('DELETE', `/modules/${m.id}`, mod.token);
  });
  after(() => server.close());

  it('validate accessMode: paid cần giá, level cần cấp độ', async () => {
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'paid' })).status, 400);
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'paid', priceCents: 0 })).status, 400);
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'paid', priceCents: 50_000_000 + 1 })).status, 400);
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'level' })).status, 400);
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'bogus' })).status, 400);
    const id = await newModule({ accessMode: 'all' });
    assert.equal((await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'paid' })).status, 400);
    assert.equal((await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'level' })).status, 400);
    const ok = await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'paid', priceCents: 125_000 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.priceCents, 125_000);
    // đổi sang level: giá bị xóa, requiredLevel được lưu; đổi về all: requiredLevel bị xóa
    const lv = await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'level', requiredLevel: 3 });
    assert.equal(lv.body.data.accessMode, 'level');
    assert.equal(lv.body.data.requiredLevel, 3);
    assert.equal(lv.body.data.priceCents, undefined);
    const all = await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'all' });
    assert.equal(all.body.data.requiredLevel, undefined);
    const v = await view(a.token, id);
    assert.equal(v.accessMode, 'all');
    assert.equal(v.sequential, false);
    assert.equal(v.publishStatus, 'published');
    assert.equal(v.hasPreview, false);
    assert.equal(v.requiredLevel, undefined);
    await call('DELETE', `/modules/${id}`, mod.token);
  });

  it('tương thích cũ: chỉ gửi requiredLevel = chế độ level', async () => {
    const id = await newModule({ requiredLevel: 5 });
    const v = await view(a.token, id);
    assert.equal(v.accessMode, 'level');
    assert.equal(v.requiredLevel, 5);
    assert.equal(v.locked, true);
    assert.equal(v.lockReason, 'level');
    assert.equal((await call('PATCH', `/modules/${id}`, mod.token, { requiredLevel: null })).body.data.accessMode, 'all');
    await call('DELETE', `/modules/${id}`, mod.token);
  });

  it('module nháp: thành viên không thấy (list/lessons/lesson/progress), mod+ thấy; xuất bản thì hiện', async () => {
    const id = await newModule({ publishStatus: 'draft' });
    const lesson = await newLesson(id);
    assert.equal((await view(a.token, id)), undefined);
    assert.equal((await view(mod.token, id)).publishStatus, 'draft');
    assert.equal((await call('GET', `/modules/${id}/lessons`, a.token)).status, 404);
    assert.equal((await call('GET', `/lessons/${lesson}`, a.token)).status, 404);
    assert.equal((await call('POST', `/lessons/${lesson}/complete`, a.token)).status, 404);
    assert.equal((await call('GET', `/modules/${id}/lessons`, mod.token)).status, 200);
    assert.equal((await call('GET', `/lessons/${lesson}`, mod.token)).status, 200);
    assert.equal((await call('GET', '/progress', a.token)).body.data.totalLessons, 0);
    const pub = await call('PATCH', `/modules/${id}`, mod.token, { publishStatus: 'published' });
    assert.equal(pub.body.data.publishStatus, 'published');
    assert.ok(await view(a.token, id));
    await call('DELETE', `/modules/${id}`, mod.token);
  });

  it('selected/paid: khóa, cấp quyền qua PUT access rồi mở khóa; xem thử mở được khi module khóa', async () => {
    const id = await newModule({ accessMode: 'selected' });
    const l1 = await newLesson(id, { title: 'Bài thường', body: 'BI MAT' });
    const l2 = await newLesson(id, { title: 'Xem thử', isPreview: true, body: 'cong khai' });
    const v = await view(a.token, id);
    assert.equal(v.locked, true);
    assert.equal(v.lockReason, 'selected');
    assert.equal(v.hasPreview, true);
    assert.equal((await view(mod.token, id)).locked, false);

    const list = await call('GET', `/modules/${id}/lessons`, a.token);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data.map((l: any) => [l.id, l.locked, l.isPreview]), [[l1, true, false], [l2, false, true]]);
    assert.equal(list.body.data[0].body, '', 'nội dung bài khóa không bị lộ');
    assert.equal(list.body.data[1].body, 'cong khai');
    const locked = await call('GET', `/lessons/${l1}`, a.token);
    assert.equal(locked.status, 403);
    assert.equal(locked.body.error?.code ?? locked.body.code, 'MODULE_LOCKED');
    assert.equal((await call('POST', `/lessons/${l1}/complete`, a.token)).status, 403);
    assert.equal((await call('GET', `/lessons/${l2}`, a.token)).status, 200);

    // quyền quản lý access: member 403, không phải thành viên 400
    assert.equal((await call('GET', `/modules/${id}/access`, a.token)).status, 403);
    assert.equal((await call('PUT', `/modules/${id}/access`, a.token, { userIds: [a.id] })).status, 403);
    assert.equal((await call('PUT', `/modules/${id}/access`, mod.token, { userIds: [stranger.id] })).status, 400);
    assert.equal((await call('PUT', `/modules/${id}/access`, mod.token, { userIds: 'x' })).status, 400);
    const put = await call('PUT', `/modules/${id}/access`, mod.token, { userIds: [a.id, a.id] });
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.data.map((u: any) => u.id), [a.id]);
    assert.ok(put.body.data[0].name);
    assert.equal((await call('GET', `/modules/${id}/access`, mod.token)).body.data.length, 1);

    assert.equal((await view(a.token, id)).locked, false);
    assert.equal((await call('GET', `/lessons/${l1}`, a.token)).status, 200);
    assert.equal((await view(b.token, id)).locked, true);
    // thu hồi
    await call('PUT', `/modules/${id}/access`, mod.token, { userIds: [] });
    assert.equal((await view(a.token, id)).locked, true);
    await call('DELETE', `/modules/${id}`, mod.token);

    const paid = await newModule({ accessMode: 'paid', priceCents: 37_500 });
    const pv = await view(b.token, paid);
    assert.deepEqual([pv.locked, pv.lockReason, pv.priceCents], [true, 'paid', 37_500]);
    await call('PUT', `/modules/${paid}/access`, mod.token, { userIds: [b.id] });
    assert.equal((await view(b.token, paid)).locked, false);
    await call('DELETE', `/modules/${paid}`, mod.token);
  });

  it('module khóa theo thứ tự: bài xem thử KHÔNG vượt được khóa', async () => {
    const first = await newModule({});
    await newLesson(first);
    const second = await newModule({ accessMode: 'selected' });
    const prev = await newLesson(second, { isPreview: true });
    assert.equal((await view(b.token, second)).lockReason, 'previous_module');
    assert.equal((await call('GET', `/modules/${second}/lessons`, b.token)).status, 403);
    assert.equal((await call('GET', `/lessons/${prev}`, b.token)).status, 403);
    await call('DELETE', `/modules/${first}`, mod.token);
    await call('DELETE', `/modules/${second}`, mod.token);
  });

  it('sequential: bài sau khóa tới khi hoàn thành bài trước; tiến độ bỏ qua bài khóa', async () => {
    const id = await newModule({ sequential: true });
    const [l1, l2, l3] = [await newLesson(id), await newLesson(id), await newLesson(id)] as [string, string, string];
    assert.equal((await view(a.token, id)).sequential, true);
    const list = await call('GET', `/modules/${id}/lessons`, a.token);
    assert.deepEqual(list.body.data.map((l: any) => l.locked), [false, true, true]);
    const err = await call('GET', `/lessons/${l2}`, a.token);
    assert.equal(err.status, 403);
    assert.equal(err.body.error?.code ?? err.body.code, 'LESSON_LOCKED');
    const err2 = await call('POST', `/lessons/${l3}/complete`, a.token);
    assert.equal(err2.status, 403);
    assert.equal((await call('GET', '/progress', a.token)).body.data.nextLesson.id, l1);
    assert.equal((await call('POST', `/lessons/${l1}/complete`, a.token)).status, 200);
    assert.deepEqual((await call('GET', `/modules/${id}/lessons`, a.token)).body.data.map((l: any) => l.locked), [false, false, true]);
    assert.equal((await call('GET', '/progress', a.token)).body.data.nextLesson.id, l2);
    assert.equal((await call('GET', `/lessons/${l2}`, a.token)).status, 200);
    // mod+ không bị khóa
    assert.deepEqual((await call('GET', `/modules/${id}/lessons`, mod.token)).body.data.map((l: any) => l.locked), [false, false, false]);
    await call('DELETE', `/modules/${id}`, mod.token);
  });

  it('xuất bản draft → published với notifyMembers gửi thông báo (trừ người thao tác); không lưu cờ', async () => {
    const id = await newModule({ publishStatus: 'draft', title: 'Module thông báo' });
    const r = await call('PATCH', `/modules/${id}`, mod.token, { publishStatus: 'published', notifyMembers: true, announce: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.notifyMembers, undefined);
    await flush();
    const list = (token: string) => c.call('GET', '/notifications', { token });
    const mine = (await list(a.token)).body.data as any[];
    assert.ok(mine.some((n) => n.body?.includes('Module thông báo') && n.link === '/communities/photo/community/lop-hoc'));
    assert.ok(!((await list(mod.token)).body.data as any[]).some((n) => n.body?.includes('Module thông báo')));
    // Bài thông báo trên bảng tin có link ĐẦY ĐỦ (origin + đường dẫn) tới khóa học chứa module, không chỉ là đường dẫn trần.
    const feed = (await c.call('GET', '/courses/photo/posts', { token: a.token })).body;
    const announcement = ((feed.data ?? feed) as any[]).find((p) => String(p.content ?? '').includes('Module mới: Module thông báo'));
    assert.ok(announcement, 'không thấy bài thông báo module mới');
    assert.match(announcement.content, /Xem tại Lớp học: https?:\/\/[^\s]+\/communities\/photo\/community\/lop-hoc\?khoa=/);
    // đã published rồi: PATCH lại không gửi nữa
    const before = ((await list(b.token)).body.data as any[]).length;
    await call('PATCH', `/modules/${id}`, mod.token, { title: 'Đổi tên', notifyMembers: true });
    await flush();
    assert.equal(((await list(b.token)).body.data as any[]).length, before);
    await call('DELETE', `/modules/${id}`, mod.token);
  });
  it('bài trả phí: hoàn thành bài trước vẫn khóa bài sau (xem + đánh dấu bị chặn), nút sau báo khóa; mua xong thì mở', async () => {
    const free = await newModule({});
    const paid = await newModule({ accessMode: 'paid', priceCents: 99_000 });
    const l1 = await newLesson(free);
    const l2 = await newLesson(paid);
    assert.equal((await call('POST', `/lessons/${l1}/complete`, a.token)).status, 200);
    const d1 = await call('GET', `/lessons/${l1}`, a.token);
    assert.equal(d1.body.data.nextLessonId, l2);
    assert.equal(d1.body.data.nextLessonLocked, true);
    const d2 = await call('GET', `/lessons/${l2}`, a.token);
    assert.ok(d2.status === 403 || d2.status === 402 || d2.status === 423, `status ${d2.status}`);
    assert.notEqual((await call('POST', `/lessons/${l2}/complete`, a.token)).status, 200);
    // Khóa vì chưa xong module trước nhưng module còn bán riêng: lý do khóa vẫn là previous_module và kèm giá + cờ needsPurchase để FE hiện cả hai.
    const free2 = await newModule({});
    const paid2 = await newModule({ accessMode: 'paid', priceCents: 99_000 });
    await newLesson(free2);
    await newLesson(paid2);
    const mods = (await call('GET', '/modules', a.token)).body.data as any[];
    const m2 = mods.find((m) => m.id === paid2);
    assert.equal(m2.lockReason, 'previous_module');
    assert.equal(m2.needsPurchase, true);
    assert.equal(m2.priceCents, 99_000);
    assert.equal(mods.find((m) => m.id === free2).needsPurchase, undefined);
    assert.equal(((await call('GET', '/modules', mod.token)).body.data as any[]).find((m) => m.id === paid2).needsPurchase, undefined); // mod+ không cần mua
    const list = (await call('GET', `/modules/${paid}/lessons`, a.token)).body.data;
    assert.equal(list[0].locked, true);
    assert.equal(list[0].body, '');
    // owner/mod không bị khóa
    assert.equal((await call('GET', `/lessons/${l2}`, mod.token)).status, 200);
    const { prisma } = await import('../src/db/prisma.js');
    await prisma.moduleAccess.create({ data: { moduleId: paid, userId: a.id, source: 'purchase' } });
    assert.equal((await call('GET', `/lessons/${l2}`, a.token)).status, 200);
    assert.equal((await call('GET', `/lessons/${l1}`, a.token)).body.data.nextLessonLocked, false);
  });
  it('module trả phí chưa mua mà chỉ có bài học thử: học xong bài thử KHÔNG mở module sau (phải trả phí rồi mới tới); bài thử báo module còn khóa', async () => {
    for (const m of (await call('GET', '/modules', mod.token)).body.data) await call('DELETE', `/modules/${m.id}`, mod.token);
    const free1 = await newModule({});
    const paid = await newModule({ accessMode: 'paid', priceCents: 99_000 });
    const free2 = await newModule({});
    const a1 = await newLesson(free1);
    const b1 = await newLesson(paid, { isPreview: true });
    const c1 = await newLesson(free2);

    assert.equal((await call('POST', `/lessons/${a1}/complete`, a.token)).status, 200);
    // Bài học thử của module trả phí mở được (đúng thiết kế) và báo module còn khóa để FE nhắc mua.
    const d = await call('GET', `/lessons/${b1}`, a.token);
    assert.equal(d.status, 200);
    assert.equal(d.body.data.moduleLocked, true);
    assert.equal(d.body.data.isPreview, true);
    assert.equal((await call('POST', `/lessons/${b1}/complete`, a.token)).status, 200);

    // Xong bài thử nhưng CHƯA mua: module kế tiếp vẫn khóa theo thứ tự, không học được bài sau.
    const after = await view(a.token, free2);
    assert.equal(after.locked, true);
    assert.equal(after.lockReason, 'previous_module');
    assert.ok([403, 402, 423].includes((await call('GET', `/lessons/${c1}`, a.token)).status));
    assert.equal((await call('GET', `/lessons/${b1}`, a.token)).body.data.nextLessonLocked, true);

    // Mua module (cấp quyền) → module trả phí mở và tính là đã xong → module kế tiếp mở.
    const { prisma } = await import('../src/db/prisma.js');
    await prisma.moduleAccess.create({ data: { moduleId: paid, userId: a.id, source: 'purchase' } });
    assert.equal((await view(a.token, free2)).locked, false);
    assert.equal((await call('GET', `/lessons/${c1}`, a.token)).status, 200);
    assert.equal((await call('GET', `/lessons/${b1}`, a.token)).body.data.moduleLocked, false);
    // mod+ không bị ảnh hưởng.
    assert.equal((await view(mod.token, free2)).locked, false);
  });
});
