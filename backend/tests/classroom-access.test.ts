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

  const call = (method: string, path: string, token: string, body?: unknown) => c.call(method, base + path, { token, body });
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
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'paid', priceCents: 100000 * 100 + 1 })).status, 400);
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'level' })).status, 400);
    assert.equal((await call('POST', '/modules', mod.token, { title: 'x', description: '', accessMode: 'bogus' })).status, 400);
    const id = await newModule({ accessMode: 'all' });
    assert.equal((await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'paid' })).status, 400);
    assert.equal((await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'level' })).status, 400);
    const ok = await call('PATCH', `/modules/${id}`, mod.token, { accessMode: 'paid', priceCents: 4900 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.priceCents, 4900);
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

    const paid = await newModule({ accessMode: 'paid', priceCents: 1500 });
    const pv = await view(b.token, paid);
    assert.deepEqual([pv.locked, pv.lockReason, pv.priceCents], [true, 'paid', 1500]);
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
    // đã published rồi: PATCH lại không gửi nữa
    const before = ((await list(b.token)).body.data as any[]).length;
    await call('PATCH', `/modules/${id}`, mod.token, { title: 'Đổi tên', notifyMembers: true });
    await flush();
    assert.equal(((await list(b.token)).body.data as any[]).length, before);
    await call('DELETE', `/modules/${id}`, mod.token);
  });
});
