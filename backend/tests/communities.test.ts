import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

const ADMIN_EMAIL = 'root-communities@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

describe('cộng đồng: tạo, tham gia, vai trò, lời mời', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let pa: { token: string; id: string };

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Root', lastName: 'Admin' });
    pa = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  const body = (over: Record<string, unknown> = {}) => ({
    title: 'Cộng đồng thử nghiệm',
    description: 'Mô tả',
    category: 'tech',
    priceUsd: 0,
    visibility: 'public',
    ...over,
  });

  async function make(owner: { token: string }, over: Record<string, unknown> = {}) {
    const r = await c.call('POST', '/communities', { token: owner.token, body: body(over) });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data.id as string;
  }
  async function join(u: { token: string }, id: string) {
    const r = await c.call('POST', `/courses/${id}/enroll`, { token: u.token });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }

  it('tạo cộng đồng: 401, 400, owner tự thành viên, slug duy nhất, hiện trong danh sách và students đúng', async () => {
    assert.equal((await c.call('POST', '/communities', { body: body() })).status, 401);
    const owner = await c.registerUser('owner');
    assert.equal((await c.call('POST', '/communities', { token: owner.token, body: body({ priceUsd: -1 }) })).status, 400);
    assert.equal((await c.call('POST', '/communities', { token: owner.token, body: body({ visibility: 'x' }) })).status, 400);

    const id1 = await make(owner, { title: 'Nhóm Đầu Tư Vàng' });
    const id2 = await make(owner, { title: 'Nhóm Đầu Tư Vàng' });
    assert.equal(id1, 'nhom-dau-tu-vang');
    assert.notEqual(id1, id2);

    const d = await c.call('GET', `/courses/${id1}`, { token: owner.token });
    assert.equal(d.body.data.viewerRole, 'owner');
    assert.equal(d.body.data.status, 'open');
    assert.equal(d.body.data.students, 1);

    const m = await c.registerUser('m');
    await join(m, id1);
    const list = await c.call('GET', `/courses?q=${encodeURIComponent('Đầu Tư Vàng')}&sort=newest`);
    assert.equal(list.status, 200);
    const found = list.body.data.find((x: any) => x.id === id1);
    assert.equal(found.students, 2);
    assert.equal(list.body.meta.total >= 2, true);
    const members = await c.call('GET', `/courses/${id1}/members`, { token: m.token });
    const roles = members.body.data.map((x: any) => x.roleDetail);
    assert.ok(roles.includes('owner'));
  });

  it('công khai miễn phí: enroll toggle; có phí: 402 PAYMENT_REQUIRED; riêng tư: 403 JOIN_REQUEST_REQUIRED', async () => {
    const owner = await c.registerUser('o');
    const u = await c.registerUser('u');
    const free = await make(owner);
    await join(u, free);
    const leave = await c.call('POST', `/courses/${free}/enroll`, { token: u.token });
    assert.equal(leave.body.data.enrolled, false);
    // owner không rời được
    assert.equal((await c.call('POST', `/courses/${free}/enroll`, { token: owner.token })).status, 409);

    const paid = await make(owner, { title: 'Nhóm có phí', priceUsd: 9 });
    const r = await c.call('POST', `/courses/${paid}/enroll`, { token: u.token });
    assert.equal(r.status, 402);
    assert.equal(r.body.error.code, 'PAYMENT_REQUIRED');

    const priv = await make(owner, { title: 'Nhóm kín', visibility: 'private' });
    const r2 = await c.call('POST', `/courses/${priv}/enroll`, { token: u.token });
    assert.equal(r2.status, 403);
    assert.equal(r2.body.error.code, 'JOIN_REQUEST_REQUIRED');
  });

  it('công khai có phí: sau checkout/confirm thì vào được và rời được', async () => {
    const owner = await c.registerUser('o');
    const u = await c.registerUser('u');
    const paid = await make(owner, { title: 'Nhóm trả phí', priceUsd: 5 });
    const co = await c.call('POST', `/courses/${paid}/checkout`, { token: u.token, body: { method: 'stripe' } });
    if (co.status < 300) {
      const intentId = co.body.data.id ?? co.body.data.paymentIntentId;
      await c.call('POST', `/payments/${intentId}/confirm`, { token: u.token });
      const d = await c.call('GET', `/courses/${paid}`, { token: u.token });
      if (d.body.data.viewerEnrolled) {
        const leave = await c.call('POST', `/courses/${paid}/enroll`, { token: u.token });
        assert.equal(leave.body.data.enrolled, false);
      }
    }
  });

  it('riêng tư: yêu cầu tham gia -> duyệt/từ chối/hủy, không trùng, chỉ admin+ xử lý', async () => {
    const owner = await c.registerUser('o');
    const a = await c.registerUser('a');
    const b = await c.registerUser('b');
    const bystander = await c.registerUser('by');
    const id = await make(owner, { visibility: 'private' });

    assert.equal((await c.call('POST', `/courses/${id}/join-requests`, { body: {} })).status, 401);
    const r1 = await c.call('POST', `/courses/${id}/join-requests`, { token: a.token, body: { message: 'Cho tôi vào' } });
    assert.equal(r1.status, 201);
    assert.equal((await c.call('POST', `/courses/${id}/join-requests`, { token: a.token, body: {} })).status, 409);
    const r2 = await c.call('POST', `/courses/${id}/join-requests`, { token: b.token, body: {} });

    // người ngoài không xem/duyệt được
    assert.equal((await c.call('GET', `/courses/${id}/join-requests`, { token: bystander.token })).status, 403);
    assert.equal((await c.call('POST', `/join-requests/${r1.body.data.id}/approve`, { token: bystander.token })).status, 403);
    assert.equal((await c.call('POST', `/join-requests/nope/approve`, { token: owner.token })).status, 404);

    const list = await c.call('GET', `/courses/${id}/join-requests?status=pending`, { token: owner.token });
    assert.equal(list.body.data.length, 2);

    const ap = await c.call('POST', `/join-requests/${r1.body.data.id}/approve`, { token: owner.token });
    assert.equal(ap.body.data.status, 'approved');
    assert.equal((await c.call('GET', `/courses/${id}/members`, { token: a.token })).status, 200);
    assert.equal((await c.call('POST', `/join-requests/${r1.body.data.id}/approve`, { token: owner.token })).status, 409);

    const rj = await c.call('POST', `/join-requests/${r2.body.data.id}/reject`, { token: owner.token });
    assert.equal(rj.body.data.status, 'rejected');
    assert.equal((await c.call('GET', `/courses/${id}/members`, { token: b.token })).status, 403);

    // hủy yêu cầu của chính mình
    const r3 = await c.call('POST', `/courses/${id}/join-requests`, { token: b.token, body: {} });
    assert.equal((await c.call('DELETE', `/join-requests/${r3.body.data.id}`, { token: a.token })).status, 404);
    assert.equal((await c.call('DELETE', `/join-requests/${r3.body.data.id}`, { token: b.token })).status, 200);

    // cộng đồng công khai không cần yêu cầu
    const pub = await make(owner, { title: 'Công khai khác' });
    assert.equal((await c.call('POST', `/courses/${pub}/join-requests`, { token: a.token, body: {} })).status, 409);
  });

  it('thứ bậc vai trò: admin chỉ đặt mod, chỉ owner đặt admin, không đổi owner/chính mình', async () => {
    const owner = await c.registerUser('o');
    const adm = await c.registerUser('adm');
    const mod = await c.registerUser('mod');
    const mem = await c.registerUser('mem');
    const id = await make(owner);
    for (const u of [adm, mod, mem]) await join(u, id);

    const role = (actor: { token: string }, target: { id: string }, r: string) =>
      c.call('PATCH', `/courses/${id}/members/${target.id}/role`, { token: actor.token, body: { role: r } });

    assert.equal((await role(mem, mod, 'mod')).status, 403); // member không có quyền
    assert.equal((await role(owner, mod, 'root')).status, 400); // validate
    assert.equal((await role(owner, adm, 'admin')).status, 200);
    assert.equal((await role(adm, mod, 'mod')).status, 200); // admin đặt mod
    assert.equal((await role(adm, mem, 'admin')).status, 403); // admin không đặt admin
    assert.equal((await role(adm, adm, 'member')).status, 400); // không tự đổi
    assert.equal((await role(adm, owner, 'member')).status, 403); // không đổi owner
    assert.equal((await role(owner, { id: 'ghost' }, 'mod')).status, 404);

    const d = await c.call('GET', `/courses/${id}/members/${mod.id}`, { token: mem.token });
    assert.equal(d.body.data.roleDetail, 'mod');
    assert.equal(d.body.data.role, 'admin');
    assert.equal((await c.call('GET', `/courses/${id}/members/${mod.id}`)).status, 401);

    // admin không hạ được admin khác; owner hạ được
    const adm2 = await c.registerUser('adm2');
    await join(adm2, id);
    await role(owner, adm2, 'admin');
    assert.equal((await role(adm, adm2, 'member')).status, 403);
    assert.equal((await role(owner, adm2, 'member')).status, 200);
  });

  it('kick & ban: chỉ tác động lên bậc thấp hơn; ban chặn vào lại; unban; danh sách ban', async () => {
    const owner = await c.registerUser('o');
    const adm = await c.registerUser('adm');
    const mod = await c.registerUser('mod');
    const mem = await c.registerUser('mem');
    const id = await make(owner);
    for (const u of [adm, mod, mem]) await join(u, id);
    await c.call('PATCH', `/courses/${id}/members/${adm.id}/role`, { token: owner.token, body: { role: 'admin' } });
    await c.call('PATCH', `/courses/${id}/members/${mod.id}/role`, { token: owner.token, body: { role: 'mod' } });

    const del = (actor: { token: string }, t: { id: string }) => c.call('DELETE', `/courses/${id}/members/${t.id}`, { token: actor.token });
    assert.equal((await del(mod, mem)).status, 403); // mod không kick
    assert.equal((await del(adm, owner)).status, 403);
    assert.equal((await del(adm, adm)).status, 400);
    assert.equal((await del(mem, mod)).status, 403);
    assert.equal((await del(adm, mod)).status, 200);
    assert.equal((await c.call('GET', `/courses/${id}/members`, { token: mod.token })).status, 403);
    assert.equal((await del(adm, mod)).status, 404);

    // ban
    assert.equal((await c.call('POST', `/courses/${id}/members/${mem.id}/ban`, { token: mod.token, body: {} })).status, 403);
    assert.equal((await c.call('POST', `/courses/${id}/members/${owner.id}/ban`, { token: adm.token, body: {} })).status, 403);
    const ban = await c.call('POST', `/courses/${id}/members/${mem.id}/ban`, { token: adm.token, body: { reason: 'spam' } });
    assert.equal(ban.status, 200);
    assert.equal((await c.call('GET', `/courses/${id}/members`, { token: mem.token })).status, 403);
    assert.equal((await c.call('POST', `/courses/${id}/enroll`, { token: mem.token })).status, 403);
    const bans = await c.call('GET', `/courses/${id}/bans`, { token: adm.token });
    assert.equal(bans.body.data[0].reason, 'spam');
    assert.equal((await c.call('GET', `/courses/${id}/bans`, { token: mod.token })).status, 403);

    // ban bị chặn cả yêu cầu vào bằng lời mời
    const inv = await c.call('POST', `/courses/${id}/invites`, { token: owner.token, body: {} });
    assert.equal((await c.call('POST', `/invites/${inv.body.data.code}/accept`, { token: mem.token })).status, 403);

    assert.equal((await c.call('DELETE', `/courses/${id}/members/${mem.id}/ban`, { token: adm.token })).status, 200);
    assert.equal((await c.call('DELETE', `/courses/${id}/members/${mem.id}/ban`, { token: adm.token })).status, 404);
    await join(mem, id);
  });

  it('lời mời: tạo/liệt kê/xem trước/nhận, hết lượt, hết hạn, thu hồi, cộng đồng có phí', async () => {
    const owner = await c.registerUser('o');
    const mem = await c.registerUser('mem');
    const u1 = await c.registerUser('u1');
    const u2 = await c.registerUser('u2');
    const priv = await make(owner, { visibility: 'private' });

    assert.equal((await c.call('POST', `/courses/${priv}/invites`, { token: mem.token, body: {} })).status, 403);
    assert.equal((await c.call('POST', `/courses/${priv}/invites`, { token: owner.token, body: { maxUses: 0 } })).status, 400);
    assert.equal(
      (await c.call('POST', `/courses/${priv}/invites`, { token: owner.token, body: { expiresAt: '2001-01-01T00:00:00Z' } })).status,
      400,
    );

    const inv = await c.call('POST', `/courses/${priv}/invites`, { token: owner.token, body: { maxUses: 1 } });
    assert.equal(inv.status, 201);
    const code = inv.body.data.code as string;
    assert.ok(code.length >= 12);
    assert.equal((await c.call('GET', `/courses/${priv}/invites`, { token: owner.token })).body.data.length, 1);
    assert.equal((await c.call('GET', `/courses/${priv}/invites`, { token: mem.token })).status, 403);

    const pv = await c.call('GET', `/invites/${code}`); // công khai, không cần token
    assert.equal(pv.status, 200);
    assert.deepEqual(Object.keys(pv.body.data.course).sort(), ['id', 'members', 'priceUsd', 'thumbnail', 'title', 'visibility']);
    assert.equal((await c.call('GET', `/invites/khong-ton-tai`)).status, 404);

    assert.equal((await c.call('POST', `/invites/${code}/accept`)).status, 401);
    const acc = await c.call('POST', `/invites/${code}/accept`, { token: u1.token }); // bỏ qua duyệt của cộng đồng riêng tư
    assert.equal(acc.status, 200);
    assert.equal((await c.call('GET', `/courses/${priv}/members`, { token: u1.token })).status, 200);
    assert.equal((await c.call('POST', `/invites/${code}/accept`, { token: u2.token })).body.error.code, 'INVITE_EXHAUSTED');
    assert.equal((await c.call('GET', `/courses/${priv}/invites`, { token: owner.token })).body.data[0].usedCount, 1);

    // thu hồi
    const inv2 = await c.call('POST', `/courses/${priv}/invites`, { token: owner.token, body: {} });
    assert.equal((await c.call('DELETE', `/invites/${inv2.body.data.code}`, { token: mem.token })).status, 403);
    assert.equal((await c.call('DELETE', `/invites/${inv2.body.data.code}`, { token: owner.token })).status, 200);
    assert.equal((await c.call('POST', `/invites/${inv2.body.data.code}/accept`, { token: u2.token })).body.error.code, 'INVITE_REVOKED');

    // hết hạn: tạo hạn gần rồi chờ
    const soon = new Date(Date.now() + 300).toISOString();
    const inv3 = await c.call('POST', `/courses/${priv}/invites`, { token: owner.token, body: { expiresAt: soon } });
    await new Promise((r) => setTimeout(r, 450));
    const exp = await c.call('POST', `/invites/${inv3.body.data.code}/accept`, { token: u2.token });
    assert.equal(exp.status, 410);
    assert.equal(exp.body.error.code, 'INVITE_EXPIRED');

    // cộng đồng có phí: lời mời không bỏ qua thanh toán
    const paid = await make(owner, { title: 'Nhóm phí + mời', priceUsd: 3, visibility: 'private' });
    const inv4 = await c.call('POST', `/courses/${paid}/invites`, { token: owner.token, body: {} });
    const pay = await c.call('POST', `/invites/${inv4.body.data.code}/accept`, { token: u2.token });
    assert.equal(pay.status, 402);
    assert.equal(pay.body.error.code, 'PAYMENT_REQUIRED');
    assert.equal((await c.call('GET', `/invites/${inv4.body.data.code}`)).body.data.usedCount, undefined);
  });

  it('sửa/xóa cộng đồng: admin sửa thông tin, chỉ owner đổi giá/visibility, xóa mềm + notify, seed chỉ platform admin', async () => {
    const owner = await c.registerUser('o');
    const adm = await c.registerUser('adm');
    const mem = await c.registerUser('mem');
    const id = await make(owner);
    await join(adm, id);
    await join(mem, id);
    await c.call('PATCH', `/courses/${id}/members/${adm.id}/role`, { token: owner.token, body: { role: 'admin' } });

    const patch = (u: { token: string }, b: unknown) => c.call('PATCH', `/courses/${id}`, { token: u.token, body: b });
    assert.equal((await c.call('PATCH', `/courses/${id}`, { body: { title: 'xxx' } })).status, 401);
    assert.equal((await patch(mem, { title: 'Không được' })).status, 403);
    assert.equal((await patch(owner, {})).status, 400);
    assert.equal((await patch(adm, { title: 'Tên mới', description: 'Mô tả mới' })).body.data.title, 'Tên mới');
    assert.equal((await patch(adm, { priceUsd: 5 })).status, 403);
    assert.equal((await patch(adm, { visibility: 'private' })).status, 403);
    const pr = await patch(owner, { priceUsd: 5, visibility: 'private' });
    assert.equal(pr.body.data.priceUsd, 5);
    assert.equal(pr.body.data.pricing, 'paid');
    assert.equal((await patch(owner, { priceUsd: 0 })).body.data.pricing, 'free');
    assert.equal((await c.call('PATCH', `/courses/nope`, { token: owner.token, body: { title: 'abc' } })).status, 404);

    assert.equal((await c.call('DELETE', `/courses/${id}`, { token: adm.token })).status, 403);
    assert.equal((await c.call('DELETE', `/courses/${id}`, { token: owner.token })).status, 200);
    assert.equal((await c.call('GET', `/courses/${id}`)).status, 404);
    const list = await c.call('GET', `/courses?q=${encodeURIComponent('Tên mới')}`);
    assert.equal(list.body.data.some((x: any) => x.id === id), false);
    const notifs = await c.call('GET', '/notifications', { token: mem.token });
    if (notifs.status === 200) assert.ok(JSON.stringify(notifs.body).includes('Cộng đồng đã bị xóa'));

    // seed mẫu: người thường không xóa được; platform admin xóa được
    const stranger = await c.registerUser('str');
    assert.equal((await c.call('DELETE', `/courses/lead`, { token: stranger.token })).status, 403);
    assert.equal((await c.call('DELETE', `/courses/nope`, { token: pa.token })).status, 404);
  });

  it('khóa bởi Platform Admin: ẩn khỏi danh sách, COMMUNITY_LOCKED cho thành viên, mở khóa lại', async () => {
    const owner = await c.registerUser('o');
    const mem = await c.registerUser('mem');
    const id = await make(owner, { title: 'Nhóm sắp bị khóa' });
    await join(mem, id);

    assert.equal((await c.call('POST', `/admin/courses/${id}/lock`, { token: owner.token, body: { reason: 'x' } })).status, 403);
    assert.equal((await c.call('POST', `/admin/courses/${id}/lock`, { token: pa.token, body: {} })).status, 400);
    assert.equal((await c.call('POST', `/admin/courses/${id}/lock`, { body: { reason: 'x' } })).status, 401);
    assert.equal((await c.call('POST', `/admin/courses/${id}/lock`, { token: pa.token, body: { reason: 'Vi phạm' } })).status, 200);

    const list = await c.call('GET', `/courses?q=${encodeURIComponent('sắp bị khóa')}`);
    assert.equal(list.body.data.some((x: any) => x.id === id), false);
    const blocked = await c.call('GET', `/courses/${id}/members`, { token: mem.token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'COMMUNITY_LOCKED');
    const blockedOwner = await c.call('GET', `/courses/${id}/posts`, { token: owner.token });
    assert.equal(blockedOwner.body.error.code, 'COMMUNITY_LOCKED');
    const joinLocked = await c.call('POST', `/courses/${id}/enroll`, { token: (await c.registerUser('n')).token });
    assert.equal(joinLocked.body.error.code, 'COMMUNITY_LOCKED');

    assert.equal((await c.call('POST', `/admin/courses/${id}/unlock`, { token: owner.token })).status, 403);
    assert.equal((await c.call('POST', `/admin/courses/${id}/unlock`, { token: pa.token })).status, 200);
    assert.equal((await c.call('GET', `/courses/${id}/members`, { token: mem.token })).status, 200);
    const list2 = await c.call('GET', `/courses?q=${encodeURIComponent('sắp bị khóa')}`);
    assert.equal(list2.body.data.some((x: any) => x.id === id), true);
  });

  it('platform admin xóa được cộng đồng seed? (chỉ kiểm tra 403 với người thường, không xóa seed thật)', async () => {
    // Xóa seed sẽ ảnh hưởng test khác trong cùng tiến trình nên chỉ kiểm tra chặn.
    const u = await c.registerUser('x');
    assert.equal((await c.call('DELETE', `/courses/photo`, { token: u.token })).status, 403);
  });

  it('chuyển quyền chủ: chỉ owner, người nhận phải là thành viên, owner cũ thành admin', async () => {
    const owner = await c.registerUser('o');
    const mem = await c.registerUser('mem');
    const out = await c.registerUser('out');
    const id = await make(owner);
    await join(mem, id);

    const tr = (actor: { token: string }, userId: string) =>
      c.call('POST', `/courses/${id}/transfer-ownership`, { token: actor.token, body: { userId } });
    assert.equal((await tr(mem, mem.id)).status, 403);
    assert.equal((await tr(owner, out.id)).status, 400); // không phải thành viên
    assert.equal((await tr(owner, owner.id)).status, 400);
    assert.equal((await c.call('POST', `/courses/${id}/transfer-ownership`, { token: owner.token, body: {} })).status, 400);
    assert.equal((await tr(owner, mem.id)).status, 200);

    assert.equal((await c.call('GET', `/courses/${id}`, { token: mem.token })).body.data.viewerRole, 'owner');
    assert.equal((await c.call('GET', `/courses/${id}`, { token: owner.token })).body.data.viewerRole, 'admin');
    assert.equal((await tr(owner, mem.id)).status, 403); // chủ cũ hết quyền
    // chủ mới rời không được, chủ cũ (admin) rời được
    assert.equal((await c.call('POST', `/courses/${id}/enroll`, { token: owner.token })).body.data.enrolled, false);
  });
});
