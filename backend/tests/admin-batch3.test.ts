import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

// env.ts parse lúc import app, nên phải đặt TRƯỚC startTestServer().
const ADMIN_EMAIL = 'platform-admin-batch3@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;

/** Admin đợt 3: Analytics · Support · System + phân quyền nhân viên trên toàn bộ /admin/*. */
describe('admin đợt 3', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let admin: { token: string; id: string };
  let flush: () => Promise<void>;
  let notifs: () => Array<{ userId: string; type: string; title: string; body: string }>;
  const PW = 'Passw0rd!x';
  const A = (method: string, path: string, body?: unknown, token = admin.token) => c.call(method, `/admin${path}`, { token, body });
  const GET = (path: string, token = admin.token) => A('GET', path, undefined, token);
  const outbox = async (to: string) => (await c.call('GET', `/dev/outbox?to=${encodeURIComponent(to)}`)).body.data as Array<{ subject: string; text: string; html?: string }>;
  type U = { token: string; id: string; email: string };

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    const svc = await import('../src/modules/notifications/notifications.service.js');
    flush = svc.flushNotifications;
    notifs = () => svc.notificationStore.all() as never;
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: PW, firstName: 'Plat', lastName: 'Admin' });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id };
  });
  after(() => server.close());

  /** Đăng ký user thường rồi (tuỳ chọn) cấp vai trò nhân viên qua API. */
  async function user(prefix: string, role?: string): Promise<U> {
    const u = await c.registerUser(prefix);
    if (role) {
      const r = await A('POST', '/system/admins', { email: u.email, roleKey: role });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    return u;
  }
  const actions = async (targetId: string) => ((await GET(`/audit-logs?targetId=${encodeURIComponent(targetId)}&limit=100`)).body.data as Array<{ action: string }>).map((a) => a.action);

  /* ================================================================== PHÂN QUYỀN */
  describe('ma trận quyền theo vai trò', () => {
    let staff: Record<'moderator' | 'support' | 'finance', U>;
    let plain: U;
    before(async () => {
      staff = { moderator: await user('mod3', 'moderator'), support: await user('sup3', 'support'), finance: await user('fin3', 'finance') };
      plain = await user('plain3');
    });

    // [method, path, vai trò được phép]
    const MATRIX: Array<[string, string, Array<'super' | 'moderator' | 'support' | 'finance'>]> = [
      ['GET', '/me', ['super', 'moderator', 'support', 'finance']],
      ['GET', '/dashboard', ['super', 'moderator', 'support', 'finance']],
      ['GET', '/users', ['super', 'moderator', 'support']],
      ['POST', '/users/none/ban', ['super', 'moderator']],
      ['GET', '/moderation/summary', ['super', 'moderator', 'support']],
      ['GET', '/communities', ['super', 'moderator']],
      ['GET', '/content/posts', ['super', 'moderator']],
      ['GET', '/discovery/categories', ['super', 'moderator']],
      ['GET', '/payments/transactions', ['super', 'support', 'finance']],
      ['POST', '/payments/refunds/none/approve', ['super', 'support', 'finance']],
      ['POST', '/payments/subscriptions/none/pause', ['super', 'finance']],
      ['GET', '/refunds', ['super', 'support', 'finance']],
      ['GET', '/analytics/users', ['super', 'moderator', 'finance']],
      ['GET', '/support/tickets', ['super', 'support']],
      ['GET', '/audit-logs', ['super']],
      ['GET', '/audit-logs/export', ['super']],
      ['GET', '/system/flags', ['super']],
      ['GET', '/system/settings', ['super']],
      ['GET', '/system/admins', ['super']],
      ['GET', '/system/roles', ['super']],
      ['GET', '/system/integrations', ['super']],
      ['GET', '/system/email-templates', ['super']],
      ['GET', '/system/notifications/settings', ['super']],
      ['GET', '/system/categories', ['super', 'moderator']],
    ];

    it('Super Admin (env) qua mọi route; mỗi vai trò chỉ đúng các route được phép (403 ngoài ra)', async () => {
      const tokens = { super: admin.token, moderator: staff.moderator.token, support: staff.support.token, finance: staff.finance.token };
      for (const [method, path, allowed] of MATRIX) {
        for (const [role, token] of Object.entries(tokens)) {
          const r = await A(method, path, method === 'POST' ? {} : undefined, token);
          const ok = (allowed as string[]).includes(role);
          if (ok) assert.notEqual(r.status, 403, `${role} ${method} ${path} phải được phép, nhận ${r.status} ${JSON.stringify(r.body)}`);
          else assert.equal(r.status, 403, `${role} ${method} ${path} phải bị 403, nhận ${r.status}`);
          assert.notEqual(r.status, 401);
        }
      }
    });

    it('401 khi thiếu token; user thường (không phải nhân viên) bị 403 ở mọi nhóm', async () => {
      for (const path of ['/me', '/dashboard', '/analytics/users', '/support/tickets', '/system/flags', '/system/admins', '/users']) {
        assert.equal((await c.call('GET', `/admin${path}`)).status, 401, path);
        assert.equal((await GET(path, plain.token)).status, 403, path);
      }
    });

    it('/admin/me trả vai trò + quyền; Super Admin có đủ khoá', async () => {
      const m = (await GET('/me', staff.support.token)).body.data;
      assert.equal(m.role, 'platform_admin');
      assert.deepEqual(m.adminRole, { key: 'support', name: 'Support' });
      assert.ok(m.permissions.includes('support.manage') && !m.permissions.includes('system.flags'));
      assert.equal(m.source, 'staff');
      const sa = (await GET('/me')).body.data;
      assert.equal(sa.adminRole.key, 'super_admin');
      assert.equal(sa.source, 'env');
      assert.ok(sa.permissions.includes('admin.manage') && sa.permissions.length >= 16);
    });

    it('nhân viên không thể ban/suspend một nhân viên khác (quản lý ở Admin Accounts)', async () => {
      const r = await A('POST', `/users/${staff.support.id}/suspend`, { reason: 'x', duration: '24h' }, staff.moderator.token);
      assert.equal(r.status, 403);
    });

    it('thay đổi ma trận có hiệu lực ngay: bật users.view cho Finance rồi tắt lại', async () => {
      assert.equal((await GET('/users', staff.finance.token)).status, 403);
      assert.equal((await A('PATCH', '/system/roles/finance', { permission: 'users.view', granted: true })).status, 200);
      assert.equal((await GET('/users', staff.finance.token)).status, 200);
      assert.equal((await A('PATCH', '/system/roles/finance', { permission: 'users.view', granted: false })).status, 200);
      assert.equal((await GET('/users', staff.finance.token)).status, 403);
    });

    it('hoạt động đúng với API hoàn tiền cũ: Moderator 403, Finance qua guard', async () => {
      assert.equal((await A('PATCH', '/refunds/none', { action: 'reject' }, staff.moderator.token)).status, 403);
      assert.notEqual((await A('PATCH', '/refunds/none', { action: 'reject' }, staff.finance.token)).status, 403);
    });
  });

  /* ================================================================== ADMIN ACCOUNTS */
  describe('Admin Accounts', () => {
    it('tạo từ user có sẵn -> 201, 409 khi đã là nhân viên, 400 vai trò lạ / body sai, audit', async () => {
      const u = await c.registerUser('acc');
      const r = await A('POST', '/system/admins', { email: u.email, roleKey: 'support', twoFactorEnabled: true });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.data.role.key, 'support');
      assert.equal(r.body.data.twoFactorEnabled, true);
      assert.equal(r.body.data.status, 'active');
      assert.equal(r.body.data.source, 'staff');
      assert.equal((await A('POST', '/system/admins', { email: u.email, roleKey: 'support' })).status, 409);
      assert.equal((await A('POST', '/system/admins', { email: ADMIN_EMAIL, roleKey: 'support' })).status, 409);
      assert.equal((await A('POST', '/system/admins', { email: (await c.registerUser('acc2')).email, roleKey: 'khong_co' })).status, 400);
      assert.equal((await A('POST', '/system/admins', { email: 'sai', roleKey: 'support' })).status, 400);
      assert.ok((await actions(u.id)).includes('admin.create'));
    });

    it('mời email chưa có tài khoản: cần firstName, tạo user + gửi email đặt mật khẩu', async () => {
      const email = `invited-${Date.now()}@test.local`;
      assert.equal((await A('POST', '/system/admins', { email, roleKey: 'finance' })).status, 400);
      const r = await A('POST', '/system/admins', { email, roleKey: 'finance', firstName: 'Mời' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const mails = await outbox(email);
      assert.ok(mails.some((m) => /mật khẩu/i.test(m.subject)), 'phải có thư đặt lại mật khẩu');
    });

    it('danh sách: có Super Admin env (locked) + lọc theo role/status/q', async () => {
      const u = await user('listacc', 'moderator');
      const all = (await GET('/system/admins?limit=100')).body;
      const envRow = all.data.find((a: any) => a.email === ADMIN_EMAIL);
      assert.equal(envRow.source, 'env');
      assert.equal(envRow.locked, true);
      assert.equal(envRow.role.key, 'super_admin');
      assert.ok(all.data.some((a: any) => a.userId === u.id));
      assert.equal(all.meta.page, 1);
      const mods = (await GET('/system/admins?role=moderator&limit=100')).body.data;
      assert.ok(mods.length >= 1 && mods.every((a: any) => a.role.key === 'moderator'));
      assert.equal((await GET(`/system/admins?q=${encodeURIComponent(u.email)}`)).body.data.length, 1);
      assert.equal((await GET('/system/admins?status=suspended&limit=100')).body.data.every((a: any) => a.status === 'suspended'), true);
      assert.equal((await GET('/system/admins?status=zzz')).status, 400);
    });

    it('đổi vai trò / 2FA; tạm khóa -> không vào được /admin; bật lại; reset 2FA; xóa -> mất quyền', async () => {
      const u = await user('life', 'moderator');
      assert.equal((await GET('/users', u.token)).status, 200);
      let r = await A('PATCH', `/system/admins/${u.id}`, { roleKey: 'finance', twoFactorEnabled: true });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.role.key, 'finance');
      assert.equal((await GET('/users', u.token)).status, 403, 'finance không xem users');
      assert.equal((await GET('/payments/transactions', u.token)).status, 200);
      assert.equal((await A('PATCH', `/system/admins/${u.id}`, { roleKey: 'khong_co' })).status, 400);
      assert.equal((await A('PATCH', `/system/admins/${u.id}`, {})).status, 400);

      r = await A('POST', `/system/admins/${u.id}/suspend`, { reason: 'Nghỉ phép' });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.status, 'suspended');
      assert.equal((await GET('/payments/transactions', u.token)).status, 403);
      assert.equal((await A('POST', `/system/admins/${u.id}/suspend`, {})).status, 409);
      assert.equal((await A('POST', `/system/admins/${u.id}/enable`)).status, 200);
      assert.equal((await A('POST', `/system/admins/${u.id}/enable`)).status, 409);
      assert.equal((await GET('/payments/transactions', u.token)).status, 200);

      r = await A('POST', `/system/admins/${u.id}/reset-2fa`);
      assert.equal(r.body.data.twoFactorEnabled, false);
      assert.ok((await outbox(u.email)).some((m) => /2 bước/.test(m.subject)));

      assert.equal((await A('DELETE', `/system/admins/${u.id}`)).status, 200);
      assert.equal((await GET('/payments/transactions', u.token)).status, 403);
      assert.equal((await A('DELETE', `/system/admins/${u.id}`)).status, 404);
      const acts = await actions(u.id);
      for (const a of ['admin.update', 'admin.suspend', 'admin.enable', 'admin.reset_2fa', 'admin.remove']) assert.ok(acts.includes(a), a);
    });

    it('Super Admin env và chính mình không bị sửa/xóa (409); 404 id lạ; chỉ có quyền admin.manage mới được gọi', async () => {
      assert.equal((await A('PATCH', `/system/admins/${admin.id}`, { roleKey: 'support' })).status, 409);
      assert.equal((await A('POST', `/system/admins/${admin.id}/suspend`, {})).status, 409);
      assert.equal((await A('DELETE', `/system/admins/${admin.id}`)).status, 409);
      assert.equal((await A('DELETE', '/system/admins/khong-co')).status, 404);
      const sup = await user('supx', 'support');
      assert.equal((await A('DELETE', `/system/admins/${admin.id}`, undefined, sup.token)).status, 403);
      // Super Admin được gán bằng vai trò (không phải env) vẫn không tự xóa được chính mình.
      const sa2 = await user('sa2', 'super_admin');
      assert.equal((await A('DELETE', `/system/admins/${sa2.id}`, undefined, sa2.token)).status, 409);
      assert.equal((await A('DELETE', `/system/admins/${sa2.id}`)).status, 200);
    });
  });

  /* ================================================================== ROLES */
  describe('Roles & Permissions', () => {
    it('GET: danh sách quyền + 4 vai trò hệ thống đúng ma trận mockup', async () => {
      const d = (await GET('/system/roles')).body.data;
      assert.ok(d.permissions.some((p: any) => p.key === 'payout.approve' && p.label));
      const by = Object.fromEntries(d.roles.map((r: any) => [r.key, r]));
      assert.deepEqual(['super_admin', 'moderator', 'support', 'finance'], d.roles.slice(0, 4).map((r: any) => r.key));
      assert.equal(by.super_admin.locked, true);
      assert.equal(by.super_admin.permissions.length, d.permissions.length);
      assert.ok(by.super_admin.memberCount >= 1, 'đếm cả Super Admin env');
      const has = (role: string, k: string) => by[role].permissions.includes(k);
      assert.ok(has('moderator', 'user.ban') && !has('support', 'user.ban') && !has('finance', 'user.ban'));
      assert.ok(has('support', 'payment.refund') && has('finance', 'payment.refund') && !has('moderator', 'payment.refund'));
      assert.ok(has('finance', 'payout.approve') && !has('support', 'payout.approve'));
      assert.ok(has('support', 'report.resolve') && !has('finance', 'report.resolve'));
      assert.ok(!has('moderator', 'system.flags') && !has('moderator', 'admin.manage'));
    });

    it('tạo vai trò tuỳ chỉnh, gán cho nhân viên, bật/tắt từng ô, xóa (409 khi đang dùng)', async () => {
      const name = `Auditor ${Date.now().toString(36)}`;
      const r = await A('POST', '/system/roles', { name, description: 'Chỉ xem', permissions: ['dashboard.view', 'users.view'] });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const key = r.body.data.key as string;
      assert.match(key, /^auditor_/);
      assert.equal(r.body.data.isSystem, false);
      assert.equal((await A('POST', '/system/roles', { name, permissions: [] })).status, 409);

      const u = await user('custom', key);
      assert.equal((await GET('/users', u.token)).status, 200);
      assert.equal((await GET('/support/tickets', u.token)).status, 403);
      const p = await A('PATCH', `/system/roles/${key}`, { permission: 'support.manage', granted: true });
      assert.equal(p.status, 200);
      assert.ok(p.body.data.permissions.includes('support.manage'));
      assert.equal((await GET('/support/tickets', u.token)).status, 200, 'hiệu lực ngay');
      const p2 = await A('PATCH', `/system/roles/${key}`, { permissions: ['dashboard.view'], name: 'Auditor đổi tên' });
      assert.deepEqual(p2.body.data.permissions, ['dashboard.view']);
      assert.equal(p2.body.data.name, 'Auditor đổi tên');
      assert.equal((await GET('/users', u.token)).status, 403);

      assert.equal((await A('DELETE', `/system/roles/${key}`)).status, 409, 'đang có người dùng');
      await A('DELETE', `/system/admins/${u.id}`);
      assert.equal((await A('DELETE', `/system/roles/${key}`)).status, 200);
      assert.equal((await A('DELETE', `/system/roles/${key}`)).status, 404);
      assert.ok((await actions(key)).includes('role.delete'));
    });

    it('400/409: khoá quyền lạ, admin.manage cho vai trò khác, thiếu cặp permission/granted; không sửa super_admin; không xóa vai trò hệ thống', async () => {
      assert.equal((await A('POST', '/system/roles', { name: 'Bad Role', permissions: ['khong.co'] })).status, 400);
      assert.equal((await A('POST', '/system/roles', { name: 'Escalate Role', permissions: ['admin.manage'] })).status, 400);
      assert.equal((await A('PATCH', '/system/roles/support', { permission: 'admin.manage', granted: true })).status, 400);
      assert.equal((await A('PATCH', '/system/roles/support', { permission: 'user.ban' })).status, 400);
      assert.equal((await A('PATCH', '/system/roles/super_admin', { permission: 'user.ban', granted: false })).status, 409);
      assert.equal((await A('PATCH', '/system/roles/khong_co', { name: 'xx' })).status, 404);
      assert.equal((await A('DELETE', '/system/roles/moderator')).status, 409);
      assert.equal((await A('POST', '/system/roles', { name: 'x', permissions: [] })).status, 400);
    });
  });

  /* ================================================================== SUPPORT */
  describe('Support tickets', () => {
    let sup: U;
    let mod: U;
    before(async () => {
      sup = await user('supagent', 'support');
      mod = await user('modagent', 'moderator');
    });

    async function mkTicket(requester: U, over: Record<string, unknown> = {}) {
      const r = await c.call('POST', '/support/tickets', { token: requester.token, body: { subject: 'Không đăng nhập được', message: 'Tôi quên mật khẩu', category: 'user', ...over } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body.data as { id: string; code: string };
    }

    it('form liên hệ công khai tạo ticket (liên kết user theo email) và vẫn gửi thư tới hộp hỗ trợ', async () => {
      const u = await c.registerUser('contact');
      const r = await c.call('POST', '/contact', { body: { name: 'Lan', email: u.email, subject: `Hỏi giá ${u.email}`, message: 'Cho mình hỏi về gói trả phí', category: 'payment' } });
      assert.equal(r.status, 202);
      const list = (await GET(`/support/tickets?q=${encodeURIComponent(u.email)}`)).body.data;
      assert.equal(list.length, 1);
      assert.equal(list[0].source, 'contact_form');
      assert.equal(list[0].category, 'payment');
      assert.equal(list[0].status, 'new');
      assert.equal(list[0].requester.id, u.id, 'liên kết user theo email');
      // email lạ -> khách không có tài khoản
      const g = `guest-${Date.now()}@test.local`;
      await c.call('POST', '/contact', { body: { name: 'Khách', email: g, subject: 'Hỏi nhanh', message: 'Xin chào' } });
      const gl = (await GET(`/support/tickets?q=${encodeURIComponent(g)}`)).body.data;
      assert.equal(gl[0].requester.id, null);
      assert.equal(gl[0].category, 'user');
      assert.equal((await c.call('POST', '/contact', { body: { name: 'a', email: g, subject: 'x', message: 'y', category: 'sai' } })).status, 400);
    });

    it('người dùng: tạo / liệt kê / xem / trả lời ticket của mình; không thấy của người khác; 401/400/404', async () => {
      const u1 = await c.registerUser('own1');
      const u2 = await c.registerUser('own2');
      assert.equal((await c.call('POST', '/support/tickets', { body: { subject: 'a', message: 'b' } })).status, 401);
      assert.equal((await c.call('POST', '/support/tickets', { token: u1.token, body: { subject: '', message: 'b' } })).status, 400);
      const t = await mkTicket(u1);
      assert.match(t.code, /^T-\d+$/);
      assert.equal((await c.call('GET', '/support/tickets', { token: u1.token })).body.data.length, 1);
      assert.equal((await c.call('GET', '/support/tickets', { token: u2.token })).body.data.length, 0);
      assert.equal((await c.call('GET', `/support/tickets/${t.id}`, { token: u2.token })).status, 404);
      assert.equal((await c.call('POST', `/support/tickets/${t.id}/reply`, { token: u2.token, body: { body: 'x' } })).status, 404);
      assert.equal((await c.call('GET', '/support/tickets/khong-co', { token: u1.token })).status, 404);
      const d = (await c.call('GET', `/support/tickets/${t.code}`, { token: u1.token })).body.data;
      assert.equal(d.messages.length, 1);
      assert.equal(d.messages[0].kind, 'customer');
      assert.equal(d.assignee, undefined, 'không lộ người xử lý');
    });

    it('admin: lọc theo category/status/priority/assignee/q, phân trang, mở bằng uuid hoặc mã T-xxxx, 400 giá trị lạ', async () => {
      const u = await c.registerUser('filt');
      const t = await mkTicket(u, { category: 'creator', subject: `Creator ${u.email}` });
      const base = `q=${encodeURIComponent(u.email)}`;
      assert.equal((await GET(`/support/tickets?${base}&category=creator`, sup.token)).body.data.length, 1);
      assert.equal((await GET(`/support/tickets?${base}&category=payment`, sup.token)).body.data.length, 0);
      assert.equal((await GET(`/support/tickets?${base}&status=new&priority=medium&assignee=unassigned`, sup.token)).body.data.length, 1);
      assert.equal((await GET(`/support/tickets?${base}&assignee=me`, sup.token)).body.data.length, 0);
      assert.equal((await GET(`/support/tickets?q=${t.code}`, sup.token)).body.data.length, 1, 'tìm theo mã');
      assert.equal((await GET('/support/tickets?status=lạ', sup.token)).status, 400);
      assert.equal((await GET('/support/tickets?sort=lạ', sup.token)).status, 400);
      const page = (await GET('/support/tickets?limit=1&page=1', sup.token)).body;
      assert.equal(page.data.length, 1);
      assert.ok(page.meta.total >= 1 && page.meta.totalPages >= 1);
      assert.equal((await GET(`/support/tickets/${t.id}`, sup.token)).body.data.code, t.code);
      assert.equal((await GET(`/support/tickets/${t.code}`, sup.token)).body.data.id, t.id);
      assert.equal((await GET('/support/tickets/T-9999999', sup.token)).status, 404);
      assert.equal((await GET('/support/tickets/khong-co', sup.token)).status, 404);
    });

    it('assign: về mình / người khác / bỏ giao; new -> open; người nhận không có quyền support -> 400', async () => {
      const t = await mkTicket(await c.registerUser('asg'));
      let r = await A('POST', `/support/tickets/${t.id}/assign`, { assigneeId: 'me' }, sup.token);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.assignee.id, sup.id);
      assert.equal(r.body.data.status, 'open');
      assert.equal((await A('POST', `/support/tickets/${t.id}/assign`, { assigneeId: mod.id }, sup.token)).status, 400);
      assert.equal((await A('POST', `/support/tickets/${t.id}/assign`, { assigneeId: admin.id })).status, 200, 'Super Admin env nhận được');
      r = await A('POST', `/support/tickets/${t.id}/assign`, { assigneeId: null }, sup.token);
      assert.equal(r.body.data.assignee, null);
      assert.equal((await A('POST', `/support/tickets/${t.id}/assign`, {}, sup.token)).status, 400);
      const asg = (await GET('/support/assignees', sup.token)).body.data;
      assert.ok(asg.some((a: any) => a.id === sup.id) && !asg.some((a: any) => a.id === mod.id));
      assert.ok((await actions(t.id)).includes('support.ticket.assign'));
    });

    it('reply: gửi email + thông báo trong app, status awaiting_reply, ghi firstResponseAt; user trả lời -> mở lại; closed -> 409', async () => {
      const u = await c.registerUser('rep');
      const t = await mkTicket(u);
      assert.equal((await A('POST', `/support/tickets/${t.id}/reply`, { body: '' }, sup.token)).status, 400);
      const r = await A('POST', `/support/tickets/${t.id}/reply`, { body: 'Bạn thử đặt lại mật khẩu nhé.' }, sup.token);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.status, 'awaiting_reply');
      assert.ok(r.body.data.firstResponseAt);
      assert.equal(r.body.data.assignee.id, sup.id, 'tự nhận khi trả lời');
      assert.equal(r.body.data.messages.at(-1).kind, 'staff');
      const mails = await outbox(u.email);
      assert.ok(mails.some((m) => m.subject.includes(t.code) && m.text.includes('đặt lại mật khẩu')));
      await flush();
      assert.ok(notifs().some((n) => n.userId === u.id && n.type === 'system' && n.title.includes(t.code)));
      const first = r.body.data.firstResponseAt;
      await A('POST', `/support/tickets/${t.id}/reply`, { body: 'Cập nhật thêm', status: 'open' }, sup.token);
      assert.equal((await GET(`/support/tickets/${t.id}`, sup.token)).body.data.firstResponseAt, first, 'firstResponseAt không đổi');

      const back = await c.call('POST', `/support/tickets/${t.id}/reply`, { token: u.token, body: { body: 'Đã được, cảm ơn' } });
      assert.equal(back.status, 200);
      assert.equal(back.body.data.status, 'open');
      assert.equal(back.body.data.messages.length, 4);

      await A('POST', `/support/tickets/${t.id}/close`, {}, sup.token);
      assert.equal((await A('POST', `/support/tickets/${t.id}/reply`, { body: 'x' }, sup.token)).status, 409);
      assert.equal((await c.call('POST', `/support/tickets/${t.id}/reply`, { token: u.token, body: { body: 'x' } })).status, 409);
      assert.ok((await actions(t.id)).includes('support.ticket.reply'));
    });

    it('ghi chú nội bộ: admin thấy, người dùng không thấy; escalate 1 lần (409 lần 2), nâng ưu tiên', async () => {
      const u = await c.registerUser('note');
      const t = await mkTicket(u);
      const n = await A('POST', `/support/tickets/${t.id}/note`, { body: 'Khách này đã khiếu nại trước đó' }, sup.token);
      assert.equal(n.status, 200);
      assert.ok(n.body.data.messages.some((m: any) => m.kind === 'internal_note'));
      const mine = (await c.call('GET', `/support/tickets/${t.id}`, { token: u.token })).body.data;
      assert.ok(mine.messages.every((m: any) => m.kind === 'customer' || m.kind === 'staff'));
      assert.equal(mine.messages.length, 1);
      assert.equal((await A('POST', `/support/tickets/${t.id}/note`, { body: ' ' }, sup.token)).status, 400);

      assert.equal((await A('POST', `/support/tickets/${t.id}/escalate`, {}, sup.token)).status, 400, 'cần lý do');
      const e = await A('POST', `/support/tickets/${t.id}/escalate`, { reason: 'Cần đội thanh toán xem' }, sup.token);
      assert.equal(e.status, 200, JSON.stringify(e.body));
      assert.equal(e.body.data.escalated, true);
      assert.equal(e.body.data.priority, 'urgent');
      assert.equal(e.body.data.status, 'open');
      assert.equal((await A('POST', `/support/tickets/${t.id}/escalate`, { reason: 'lần 2' }, sup.token)).status, 409);
      assert.equal((await GET('/support/tickets?escalated=true&q=' + encodeURIComponent(u.email), sup.token)).body.data.length, 1);
    });

    it('chuyển trạng thái: resolve / close / reopen đúng luồng, sai trạng thái -> 409; PATCH đổi ưu tiên/nhóm', async () => {
      const t = await mkTicket(await c.registerUser('flow'));
      const S = (action: string, body: unknown = {}) => A('POST', `/support/tickets/${t.id}/${action}`, body, sup.token);
      assert.equal((await S('reopen')).status, 409, 'đang mở');
      const r = await S('resolve', { note: 'Đã xử lý' });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.status, 'resolved');
      assert.ok(r.body.data.resolvedAt);
      assert.equal((await S('resolve')).status, 409);
      assert.equal((await S('escalate', { reason: 'x' })).status, 409);
      const ro = await S('reopen');
      assert.equal(ro.body.data.status, 'open');
      assert.equal(ro.body.data.resolvedAt, null);
      assert.equal((await S('close')).body.data.status, 'closed');
      assert.equal((await S('close')).status, 409);
      assert.equal((await S('resolve')).status, 409);
      assert.equal((await S('reopen')).body.data.status, 'open');
      const p = await A('PATCH', `/support/tickets/${t.id}`, { priority: 'low', category: 'payment' }, sup.token);
      assert.equal(p.body.data.priority, 'low');
      assert.equal(p.body.data.category, 'payment');
      assert.equal((await A('PATCH', `/support/tickets/${t.id}`, { priority: 'x' }, sup.token)).status, 400);
      assert.equal((await A('PATCH', `/support/tickets/${t.id}`, {}, sup.token)).status, 400);
      assert.equal((await A('POST', '/support/tickets/T-9999999/resolve', {}, sup.token)).status, 404);
      const acts = await actions(t.id);
      for (const a of ['support.ticket.resolve', 'support.ticket.close', 'support.ticket.reopen', 'support.ticket.update']) assert.ok(acts.includes(a), a);
    });

    it('admin tạo hộ khách: 201 (liên kết user theo email), 400 thiếu trường; summary đếm đúng', async () => {
      const u = await c.registerUser('byadmin');
      const r = await A('POST', '/support/tickets', { subject: 'Gọi điện cần hỗ trợ', message: 'Khách gọi điện', category: 'payment', priority: 'high', requesterEmail: u.email }, sup.token);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.data.source, 'admin');
      assert.equal(r.body.data.requester.id, u.id);
      assert.equal((await A('POST', '/support/tickets', { subject: 'x' }, sup.token)).status, 400);
      const s = (await GET('/support/summary', sup.token)).body.data;
      for (const k of ['open', 'newToday', 'unassigned', 'escalated', 'resolved7d']) assert.ok(Number.isInteger(s[k]), k);
      assert.ok(s.open >= 1 && s.newToday >= 1);
      assert.equal(s.byCategory.user + s.byCategory.creator + s.byCategory.payment, s.open);
      assert.ok(s.avgFirstResponseMin === null || s.avgFirstResponseMin >= 0);
    });
  });

  /* ================================================================== ANALYTICS */
  describe('Analytics', () => {
    const PAGES = ['users', 'communities', 'engagement', 'retention', 'revenue', 'conversion'];
    it('mỗi trang: đúng khung (range/from/to/kpis/series đủ ngày), kpi có value/previous/changePct; range 7|30|90, sai -> 400', async () => {
      for (const page of PAGES) {
        for (const range of [7, 30, 90]) {
          const r = await GET(`/analytics/${page}?range=${range}`);
          assert.equal(r.status, 200, `${page} ${range} ${JSON.stringify(r.body).slice(0, 300)}`);
          const d = r.body.data;
          assert.equal(d.range, range);
          assert.ok(d.from && d.to && d.from < d.to);
          for (const [k, v] of Object.entries(d.kpis as Record<string, any>)) {
            assert.ok('value' in v && 'previous' in v && 'changePct' in v, `${page}.${k}`);
            assert.equal(typeof v.value, 'number', `${page}.${k}`);
          }
          const series = d.series ?? d.returning;
          if (series) {
            assert.equal(series.length, range, `${page} series`);
            assert.ok(series[0].date < series[series.length - 1].date);
          }
        }
        assert.equal((await GET(`/analytics/${page}?range=45`)).status, 400, page);
      }
      assert.equal((await GET('/analytics/users')).body.data.range, 30, 'mặc định 30');
    });

    it('users/engagement/communities phản ánh dữ liệu thật vừa tạo (so sánh trước/sau)', async () => {
      const before = {
        users: (await GET('/analytics/users?range=7')).body.data,
        eng: (await GET('/analytics/engagement?range=7')).body.data,
        com: (await GET('/analytics/communities?range=7')).body.data,
      };
      const u = await c.registerUser('anl');
      const com = await db.prisma.community.create({
        data: { id: `anl-${Date.now()}`, title: 'Analytics community', description: 'Mô tả đủ dài cho cộng đồng thử nghiệm analytics.', category: 'tech', thumbnail: '/x.webp', instructorName: 'A', instructorRole: 'B', priceCents: 1000, pricing: 'paid' },
      });
      await db.prisma.enrollment.create({ data: { userId: u.id, communityId: com.id, role: 'member' } });
      const post = await db.prisma.post.create({ data: { communityId: com.id, authorId: u.id, content: 'hello analytics' } });
      await db.prisma.postComment.create({ data: { postId: post.id, authorId: u.id, content: 'cmt' } });
      await db.prisma.postLike.create({ data: { postId: post.id, userId: u.id } });
      const after = {
        users: (await GET('/analytics/users?range=7')).body.data,
        eng: (await GET('/analytics/engagement?range=7')).body.data,
        com: (await GET('/analytics/communities?range=7')).body.data,
      };
      assert.equal(after.users.kpis.newUsers.value, before.users.kpis.newUsers.value + 1);
      assert.equal(after.users.kpis.totalUsers.value, before.users.kpis.totalUsers.value + 1);
      assert.ok(after.users.kpis.dau.value >= 1, 'user vừa đăng ký + đăng bài hôm nay là active');
      const today = new Date().toISOString().slice(0, 10);
      const todayRow = after.users.series.find((s: any) => s.date === today);
      assert.ok(todayRow.newUsers >= 1 && todayRow.activeUsers >= 1);
      assert.equal(after.eng.kpis.posts.value, before.eng.kpis.posts.value + 1);
      assert.equal(after.eng.kpis.comments.value, before.eng.kpis.comments.value + 1);
      assert.equal(after.eng.kpis.likes.value, before.eng.kpis.likes.value + 1);
      assert.equal(after.eng.series.reduce((s: number, d: any) => s + d.posts, 0), after.eng.kpis.posts.value);
      assert.equal(after.com.kpis.created.value, before.com.kpis.created.value + 1);
      assert.equal(after.com.kpis.paid.value, before.com.kpis.paid.value + 1);
      assert.ok(after.com.byCategory.some((b: any) => b.key === 'tech' && b.count >= 1));
      assert.ok(after.com.top.some((t: any) => t.id === com.id && t.members === 1 && t.newMembers === 1));
      const seg = after.users.segments.reduce((s: number, x: any) => s + x.count, 0);
      assert.equal(seg, after.users.kpis.totalUsers.value, 'phân khúc cộng lại = tổng user');
    });

    it('revenue/conversion tính từ Payment + Subscription thật: gross, refunds, byCommunity, byPlan, phễu', async () => {
      const b = (await GET('/analytics/revenue?range=7')).body.data;
      const bc = (await GET('/analytics/conversion?range=7')).body.data;
      const u = await c.registerUser('rev');
      const com = await db.prisma.community.create({
        data: { id: `rev-${Date.now()}`, title: 'Revenue community', description: 'Mô tả đủ dài cho cộng đồng thử nghiệm doanh thu.', category: 'finance', thumbnail: '/x.webp', instructorName: 'A', instructorRole: 'B', priceCents: 2000, pricing: 'paid' },
      });
      await db.prisma.enrollment.create({ data: { userId: u.id, communityId: com.id, role: 'member' } });
      const now = new Date();
      const sub = await db.prisma.subscription.create({
        data: { userId: u.id, communityId: com.id, status: 'active', priceCents: 2000, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000), trialEndsAt: new Date(now.getTime() - 1000) },
      });
      const pay = await db.prisma.payment.create({
        data: { communityId: com.id, userId: u.id, method: 'stripe', amountCents: 2000, status: 'succeeded', kind: 'initial', subscriptionId: sub.id, confirmedAt: now },
      });
      await db.prisma.payment.create({ data: { communityId: com.id, userId: u.id, method: 'stripe', amountCents: 2000, status: 'succeeded', kind: 'renewal', subscriptionId: sub.id, confirmedAt: now } });
      await db.prisma.refundRequest.create({ data: { paymentId: pay.id, communityId: com.id, userId: u.id, amountCents: 500, status: 'approved', resolvedAt: now } });
      const a = (await GET('/analytics/revenue?range=7')).body.data;
      assert.equal(a.kpis.grossCents.value, b.kpis.grossCents.value + 4000);
      assert.equal(a.kpis.refundsCents.value, b.kpis.refundsCents.value + 500);
      assert.equal(a.kpis.mrrCents.value, b.kpis.mrrCents.value + 2000);
      assert.equal(a.kpis.platformFeesCents.value, Math.round((a.kpis.grossCents.value * 10) / 100), 'hoa hồng 10% mặc định');
      assert.ok(a.byCommunity.some((x: any) => x.id === com.id && x.grossCents === 4000));
      assert.equal(a.byPlan.find((x: any) => x.key === 'renewal').grossCents >= 2000, true);
      assert.equal(a.series.reduce((s: number, d: any) => s + d.grossCents, 0), a.kpis.grossCents.value);
      assert.equal(a.series.reduce((s: number, d: any) => s + d.refundsCents, 0), a.kpis.refundsCents.value);
      const ac = (await GET('/analytics/conversion?range=7')).body.data;
      const step = (d: any, k: string) => d.funnel.find((f: any) => f.key === k).count;
      assert.equal(step(ac, 'signup'), step(bc, 'signup') + 1);
      assert.equal(step(ac, 'joined'), step(bc, 'joined') + 1);
      assert.equal(step(ac, 'trial'), step(bc, 'trial') + 1);
      assert.equal(step(ac, 'paid'), step(bc, 'paid') + 1);
      assert.equal(ac.funnel[0].pctOfFirst, 100);
      assert.ok(ac.funnel.every((f: any, i: number, arr: any[]) => i === 0 || f.count <= arr[0].count));
    });

    it('retention: 6 cohort theo tháng, tuần chưa đủ thời gian = null, user mới đăng ký nằm trong cohort tháng hiện tại', async () => {
      const r = (await GET('/analytics/retention?range=30')).body.data;
      assert.equal(r.cohorts.length, 6);
      const cur = r.cohorts.at(-1);
      assert.equal(cur.cohort, new Date().toISOString().slice(0, 7));
      assert.ok(cur.users >= 1);
      assert.equal(cur.weeks.w12, null, 'tháng hiện tại chưa đủ 12 tuần');
      for (const co of r.cohorts) for (const w of ['w1', 'w2', 'w4', 'w8', 'w12']) assert.ok(co.weeks[w] === null || (co.weeks[w] >= 0 && co.weeks[w] <= 100));
      // user đăng ký 40 ngày trước, có phiên ở tuần 2 -> w2 của cohort đó > 0
      const old = await c.registerUser('old');
      const signup = new Date(Date.now() - 40 * 86_400_000);
      await db.prisma.user.update({ where: { id: old.id }, data: { createdAt: signup } });
      await db.prisma.session.deleteMany({ where: { userId: old.id } });
      await db.prisma.session.create({ data: { userId: old.id, createdAt: signup, lastUsedAt: new Date(signup.getTime() + 10 * 86_400_000), revokedAt: new Date(), expiresAt: new Date() } });
      const r2 = (await GET('/analytics/retention?range=30')).body.data;
      const co = r2.cohorts.find((x: any) => x.cohort === signup.toISOString().slice(0, 7));
      assert.ok(co.users >= 1);
      assert.ok(co.weeks.w2 > 0, 'có hoạt động ở tuần 2');
      assert.ok(co.weeks.w1 !== null);
    });
  });

  /* ================================================================== FEATURE FLAGS */
  describe('Feature flags', () => {
    it('CRUD đầy đủ + toggle + validate + 404/409 + audit', async () => {
      const key = `flag_${Date.now().toString(36)}`;
      const r = await A('POST', '/system/flags', { key, name: 'Cờ thử', description: 'mô tả', stage: 'beta', enabled: false, rolloutPercent: 25 });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.data.stage, 'beta');
      assert.equal(r.body.data.rolloutPercent, 25);
      assert.equal(r.body.data.updatedBy.id, admin.id);
      assert.equal((await A('POST', '/system/flags', { key, name: 'x' })).status, 409);
      assert.equal((await A('POST', '/system/flags', { key: 'Bad Key', name: 'x' })).status, 400);
      assert.equal((await A('POST', '/system/flags', { key: 'ok_key', name: 'x', rolloutPercent: 101 })).status, 400);
      assert.equal((await A('POST', '/system/flags', { key: 'ok_key', name: 'x', stage: 'lạ' })).status, 400);
      const t = await A('POST', `/system/flags/${key}/toggle`, {});
      assert.equal(t.body.data.enabled, true);
      assert.equal((await A('POST', `/system/flags/${key}/toggle`, { enabled: true })).body.data.enabled, true, 'đặt tường minh');
      assert.equal((await A('POST', `/system/flags/${key}/toggle`, {})).body.data.enabled, false);
      const p = await A('PATCH', `/system/flags/${key}`, { stage: 'active', rolloutPercent: 100, name: 'Cờ đổi tên' });
      assert.equal(p.body.data.stage, 'active');
      assert.equal(p.body.data.name, 'Cờ đổi tên');
      assert.equal((await A('PATCH', `/system/flags/${key}`, {})).status, 400);
      assert.equal((await A('PATCH', '/system/flags/khong_co', { name: 'x' })).status, 404);
      assert.equal((await A('POST', '/system/flags/khong_co/toggle', {})).status, 404);
      assert.ok((await GET(`/system/flags?q=${key}`)).body.data.length === 1);
      assert.equal((await GET('/system/flags?stage=lạ')).status, 400);
      assert.equal((await A('DELETE', `/system/flags/${key}`)).status, 200);
      assert.equal((await A('DELETE', `/system/flags/${key}`)).status, 404);
      const acts = await actions(key);
      for (const a of ['flag.create', 'flag.enable', 'flag.disable', 'flag.update', 'flag.delete']) assert.ok(acts.includes(a), a);
    });

    it('GET /api/feature-flags công khai: chỉ cờ bật; rollout theo % ổn định cho từng user; khách chỉ nhận cờ 100%', async () => {
      const on = `pub_on_${Date.now().toString(36)}`;
      const off = `pub_off_${Date.now().toString(36)}`;
      const half = `pub_half_${Date.now().toString(36)}`;
      const none = `pub_none_${Date.now().toString(36)}`;
      await A('POST', '/system/flags', { key: on, name: 'on', enabled: true });
      await A('POST', '/system/flags', { key: off, name: 'off', enabled: false });
      await A('POST', '/system/flags', { key: half, name: 'half', enabled: true, rolloutPercent: 50 });
      await A('POST', '/system/flags', { key: none, name: 'none', enabled: true, rolloutPercent: 0 });
      const anon = await c.call('GET', '/feature-flags');
      assert.equal(anon.status, 200);
      assert.equal(anon.body.data.flags[on], true);
      assert.equal(anon.body.data.flags[off], false);
      assert.equal(anon.body.data.flags[half], false, 'khách ẩn danh không nhận cờ rollout một phần');
      assert.equal(anon.body.data.flags[none], false);
      assert.equal(anon.body.data.maintenance, false);
      assert.ok(anon.body.data.platform.name);
      // rollout 50%: ~nửa số user; mỗi user kết quả ổn định giữa các lần gọi
      let inCount = 0;
      const N = 24;
      for (let i = 0; i < N; i++) {
        const u = await c.registerUser(`ro${i}`);
        const a = (await c.call('GET', '/feature-flags', { token: u.token })).body.data.flags[half];
        const b = (await c.call('GET', '/feature-flags', { token: u.token })).body.data.flags[half];
        assert.equal(a, b);
        assert.equal((await c.call('GET', '/feature-flags', { token: u.token })).body.data.flags[on], true);
        assert.equal((await c.call('GET', '/feature-flags', { token: u.token })).body.data.flags[none], false);
        if (a) inCount++;
      }
      assert.ok(inCount > 0 && inCount < N, `rollout 50% phải có cả vào và ra, nhận ${inCount}/${N}`);
    });
  });

  /* ================================================================== INTEGRATIONS */
  describe('Integrations', () => {
    before(async () => {
      await db.prisma.integration.createMany({
        data: [
          { key: 'stripe', name: 'Stripe', initials: 'ST', color: '#635bff', category: 'payments', connected: true, config: { accountId: 'acct_1' }, secretMask: '••••aaaa' },
          { key: 'slack', name: 'Slack', initials: 'SL', color: '#4a154b', category: 'chat', connected: false },
        ],
        skipDuplicates: true,
      });
    });
    it('list/get/lọc category, connect/disconnect/patch/test, 409 trạng thái, 404, không lưu khóa thật', async () => {
      const list = (await GET('/system/integrations')).body.data;
      assert.ok(list.length >= 2);
      assert.equal((await GET('/system/integrations?category=chat')).body.data.every((i: any) => i.category === 'chat'), true);
      assert.equal((await GET('/system/integrations/stripe')).body.data.config.accountId, 'acct_1');
      assert.equal((await GET('/system/integrations/khong_co')).status, 404);

      assert.equal((await A('POST', '/system/integrations/slack/test')).body.data.ok, false);
      const conn = await A('POST', '/system/integrations/slack/connect', { config: { channel: '#mod' }, apiKey: 'xoxb-SECRET-VALUE-1234' });
      assert.equal(conn.status, 200, JSON.stringify(conn.body));
      assert.equal(conn.body.data.connected, true);
      assert.equal(conn.body.data.secretMask, '••••1234');
      assert.equal(JSON.stringify(conn.body).includes('SECRET'), false, 'không trả lại khóa thật');
      const raw = await db.prisma.integration.findUniqueOrThrow({ where: { key: 'slack' } });
      assert.equal(JSON.stringify(raw).includes('SECRET'), false, 'không lưu khóa thật');
      assert.equal((await A('POST', '/system/integrations/slack/connect', {})).status, 409);
      assert.equal((await A('POST', '/system/integrations/slack/test')).body.data.ok, true);
      const pt = await A('PATCH', '/system/integrations/slack', { apiKey: 'another-key-9999' });
      assert.equal(pt.body.data.secretMask, '••••9999');
      assert.equal((await A('PATCH', '/system/integrations/slack', {})).status, 400);
      const dis = await A('POST', '/system/integrations/slack/disconnect');
      assert.equal(dis.body.data.connected, false);
      assert.equal(dis.body.data.secretMask, null);
      assert.equal((await A('POST', '/system/integrations/slack/disconnect')).status, 409);
      assert.equal((await A('POST', '/system/integrations/khong_co/connect', {})).status, 404);
      const acts = await actions('slack');
      for (const a of ['integration.connect', 'integration.update', 'integration.disconnect']) assert.ok(acts.includes(a), a);
      const audit = JSON.stringify((await GET('/audit-logs?targetId=slack')).body);
      assert.equal(audit.includes('another-key') || audit.includes('SECRET'), false, 'audit không chứa khóa');
    });
  });

  /* ================================================================== NOTIFICATIONS */
  describe('Notifications', () => {
    it('cấu hình cảnh báo admin: mặc định, PUT từng phần, validate', async () => {
      const d = (await GET('/system/notifications/settings')).body.data;
      assert.equal(typeof d.moderation.criticalReports, 'boolean');
      assert.equal(typeof d.reports.sendTo, 'string');
      const p = await A('PUT', '/system/notifications/settings', { payments: { refundOver500: false }, reports: { sendTo: 'boss@sofinhub.com' } });
      assert.equal(p.status, 200);
      assert.equal(p.body.data.payments.refundOver500, false);
      assert.equal(p.body.data.payments.newChargeback, d.payments.newChargeback, 'trường không gửi giữ nguyên');
      assert.equal((await GET('/system/notifications/settings')).body.data.reports.sendTo, 'boss@sofinhub.com');
      assert.equal((await A('PUT', '/system/notifications/settings', { reports: { sendTo: 'khong-phai-email' } })).status, 400);
      assert.equal((await A('PUT', '/system/notifications/settings', { payments: { khongCo: true } })).status, 400);
    });

    it('broadcast: preview đếm đúng, gửi tới user cụ thể / cộng đồng, ghi lịch sử, email tuỳ chọn, 400/404', async () => {
      const u1 = await c.registerUser('bc1');
      const u2 = await c.registerUser('bc2');
      const u3 = await c.registerUser('bc3');
      const com = await db.prisma.community.create({
        data: { id: `bc-${Date.now()}`, title: 'Broadcast community', description: 'Mô tả đủ dài cho cộng đồng thử nghiệm broadcast.', category: 'tech', thumbnail: '/x.webp', instructorName: 'A', instructorRole: 'B' },
      });
      await db.prisma.enrollment.createMany({ data: [{ userId: u1.id, communityId: com.id }, { userId: u2.id, communityId: com.id }] });

      assert.equal((await A('POST', '/system/notifications/preview', { audience: { type: 'community', courseId: com.id } })).body.data.recipientCount, 2);
      assert.equal((await A('POST', '/system/notifications/preview', { audience: { type: 'users', userIds: [u1.id, u3.id, 'khong-co'] } })).body.data.recipientCount, 2);
      assert.equal((await A('POST', '/system/notifications/preview', { audience: { type: 'community', courseId: 'khong-co' } })).status, 404);
      assert.equal((await A('POST', '/system/notifications/preview', { audience: { type: 'lạ' } })).status, 400);

      const r = await A('POST', '/system/notifications/broadcast', { title: 'Cập nhật nền tảng', body: 'Có tính năng mới!', link: '/courses', audience: { type: 'community', courseId: com.id }, sendEmail: true });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.data.recipientCount, 2);
      assert.equal(r.body.data.emailCount, 2);
      assert.equal(r.body.data.sentBy.id, admin.id);
      await flush();
      for (const u of [u1, u2]) {
        const n = notifs().filter((x) => x.userId === u.id && x.title === 'Cập nhật nền tảng');
        assert.equal(n.length, 1);
        assert.equal(n[0]!.type, 'system');
        assert.ok((await outbox(u.email)).some((m) => m.subject === 'Cập nhật nền tảng'));
      }
      assert.equal(notifs().filter((x) => x.userId === u3.id && x.title === 'Cập nhật nền tảng').length, 0, 'ngoài đối tượng không nhận');
      const hist = await GET('/system/notifications/broadcasts');
      assert.ok(hist.body.data.some((h: any) => h.id === r.body.data.id));
      assert.ok(hist.body.meta.total >= 1);

      assert.equal((await A('POST', '/system/notifications/broadcast', { title: '', body: 'x', audience: { type: 'all' } })).status, 400);
      assert.equal((await A('POST', '/system/notifications/broadcast', { title: 'x', body: 'y', link: 'http://evil.com', audience: { type: 'all' } })).status, 400);
      assert.equal((await A('POST', '/system/notifications/broadcast', { title: 'x', body: 'y', audience: { type: 'users', userIds: ['khong-co'] } })).status, 400, 'không có người nhận');
      assert.ok((await actions(r.body.data.id)).includes('notification.broadcast'));
      const all = await A('POST', '/system/notifications/preview', { audience: { type: 'all' } });
      assert.ok(all.body.data.recipientCount >= 3);
    });
  });

  /* ================================================================== EMAIL TEMPLATES */
  describe('Email templates', () => {
    it('CRUD, biến tự suy ra, preview (thiếu biến), test-send vào outbox, trạng thái, xóa; validate/404/409', async () => {
      const key = `tpl_${Date.now().toString(36)}`;
      const r = await A('POST', '/system/email-templates', { key, name: 'Mẫu thử', subject: { en: 'Hello {{name}}', vi: 'Xin chào {{name}}' }, body: { en: 'Hi {{name}}, your code is {{code}}\n\nBye', vi: 'Chào {{name}}, mã của bạn là {{code}}' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.data.status, 'draft');
      assert.deepEqual([...r.body.data.variables].sort(), ['code', 'name']);
      assert.deepEqual(r.body.data.languages, ['en', 'vi']);
      assert.equal(r.body.data.isSystem, false);
      assert.equal((await A('POST', '/system/email-templates', { key, name: 'x', subject: { en: 'a' }, body: { en: 'b' } })).status, 409);
      assert.equal((await A('POST', '/system/email-templates', { key: 'Bad Key', name: 'x', subject: { en: 'a' }, body: { en: 'b' } })).status, 400);
      assert.equal((await A('POST', '/system/email-templates', { key: 'no_en', name: 'x', subject: { vi: 'a' }, body: { vi: 'b' } })).status, 400);

      const list = (await GET(`/system/email-templates?q=${key}`)).body.data;
      assert.equal(list.length, 1);
      assert.equal(list[0].body, undefined, 'danh sách không kèm body');
      assert.equal((await GET(`/system/email-templates/${key}`)).body.data.body.en.includes('{{code}}'), true);
      assert.equal((await GET('/system/email-templates/khong_co')).status, 404);
      assert.equal((await GET('/system/email-templates?status=lạ')).status, 400);

      const pv = (await A('POST', `/system/email-templates/${key}/preview`, { language: 'vi', variables: { name: '<b>Lan</b>' } })).body.data;
      assert.equal(pv.subject, 'Xin chào <b>Lan</b>');
      assert.deepEqual(pv.missingVariables, ['code']);
      assert.ok(pv.text.includes('{{code}}'));
      assert.ok(pv.html.includes('&lt;b&gt;Lan&lt;/b&gt;'), 'html escape giá trị biến');
      const pe = (await A('POST', `/system/email-templates/${key}/preview`, { variables: { name: 'A', code: '123' } })).body.data;
      assert.deepEqual(pe.missingVariables, []);
      assert.ok(pe.html.includes('<br>') || pe.html.includes('</p><p>'));

      const to = `tpl-${Date.now()}@test.local`;
      const ts = await A('POST', `/system/email-templates/${key}/test-send`, { to, variables: { name: 'Lan', code: '999' } });
      assert.equal(ts.body.data.sent, true);
      const sent = (await outbox(to))[0]!;
      assert.equal(sent.subject, '[TEST] Hello Lan');
      assert.ok(sent.text.includes('999'));
      const own = await A('POST', `/system/email-templates/${key}/test-send`, {});
      assert.equal(own.body.data.to, ADMIN_EMAIL, 'mặc định gửi về email admin');
      assert.equal((await A('POST', `/system/email-templates/${key}/test-send`, { to: 'sai' })).status, 400);

      const pt = await A('PATCH', `/system/email-templates/${key}`, { status: 'active', subject: { en: 'Updated {{name}} {{extra}}' } });
      assert.equal(pt.body.data.status, 'active');
      assert.equal(pt.body.data.subject.vi, 'Xin chào {{name}}', 'ngôn ngữ không gửi được giữ nguyên');
      assert.ok(pt.body.data.variables.includes('extra'));
      assert.equal((await A('PATCH', `/system/email-templates/${key}`, { status: 'disabled' })).body.data.status, 'disabled');
      assert.equal((await A('PATCH', `/system/email-templates/${key}`, {})).status, 400);
      assert.equal((await A('PATCH', '/system/email-templates/khong_co', { name: 'x' })).status, 404);
      assert.equal((await A('DELETE', `/system/email-templates/${key}`)).status, 200);
      assert.equal((await A('DELETE', `/system/email-templates/${key}`)).status, 404);
      const acts = await actions(key);
      for (const a of ['email_template.create', 'email_template.test_send', 'email_template.enable', 'email_template.disable', 'email_template.delete']) assert.ok(acts.includes(a), a);
    });

    it('mẫu hệ thống không xóa được (409); mẫu reset_password active được dùng thật khi quên mật khẩu, disabled thì dùng nội dung mặc định', async () => {
      await db.prisma.emailTemplate.upsert({
        where: { key: 'reset_password' },
        create: { key: 'reset_password', name: 'Reset password', status: 'active', isSystem: true, variables: ['name', 'link'], subject: { en: 'Custom reset subject', vi: 'Tiêu đề đặt lại tuỳ chỉnh' }, body: { en: 'Hello {{name}} reset here: {{link}}', vi: 'Chào {{name}} đặt lại tại: {{link}}' } },
        update: { status: 'active', subject: { en: 'Custom reset subject', vi: 'Tiêu đề đặt lại tuỳ chỉnh' }, body: { en: 'Hello {{name}} reset here: {{link}}', vi: 'Chào {{name}} đặt lại tại: {{link}}' } },
      });
      assert.equal((await A('DELETE', '/system/email-templates/reset_password')).status, 409);
      const u = await c.registerUser('fgt');
      await c.call('POST', '/auth/forgot-password', { body: { email: u.email } });
      const m1 = (await outbox(u.email)).at(-1)!;
      assert.equal(m1.subject, 'Tiêu đề đặt lại tuỳ chỉnh', 'ngôn ngữ mặc định nền tảng = vi');
      assert.match(m1.text, /đặt lại tại: http/);
      assert.ok(m1.html?.includes('<a href='));

      await A('PATCH', '/system/email-templates/reset_password', { status: 'disabled' });
      await c.call('POST', '/auth/forgot-password', { body: { email: u.email } });
      const m2 = (await outbox(u.email)).at(-1)!;
      assert.equal(m2.subject, 'Đặt lại mật khẩu SofinHub', 'về nội dung mặc định trong code');
    });
  });

  /* ================================================================== GLOBAL SETTINGS */
  describe('Global settings', () => {
    it('GET: mặc định lấy từ env; PATCH ghi đè có hiệu lực thật (hoa hồng hiện ở API doanh thu); reset về env; audit', async () => {
      const g = (await GET('/system/settings')).body.data;
      assert.equal(g.payments.commissionPct, 10);
      assert.equal(g.payments.refundWindowDays, 7);
      assert.equal(g.payments.payoutMinUsd, 1_000_000)
      assert.equal(g.payments.currency, 'VND');
      assert.equal(g.payments.trialDays, 7);
      assert.equal(g.platform.defaultLanguage, 'vi');
      assert.equal(g.security.maintenanceMode, false);
      assert.deepEqual(g.overrides, {});

      const p = await A('PATCH', '/system/settings', { payments: { commissionPct: 12.5, refundWindowDays: 14, payoutMinUsd: 750_000 }, platform: { name: 'SofinHub QA' } });
      assert.equal(p.status, 200, JSON.stringify(p.body));
      assert.equal(p.body.data.payments.commissionPct, 12.5);
      assert.equal(p.body.data.platform.name, 'SofinHub QA');
      assert.deepEqual(p.body.data.overrides['payments.commissionPct'], { default: 10, overridden: true });
      assert.ok(p.body.data.updatedAt);
      const rev = await c.call('GET', '/courses/photo/revenue', { token: admin.token });
      assert.equal(rev.body.data.assumptions.platformCommissionPct, 12.5, 'dịch vụ thanh toán dùng giá trị mới');
      assert.equal((await c.call('GET', '/feature-flags')).body.data.platform.name, 'SofinHub QA');
      const { cfg } = await import('../src/modules/settings/settings.service.js');
      assert.equal(cfg().payments.refundWindowDays, 14);
      assert.equal(cfg().payments.payoutMinUsd, 750_000);

      const r = await A('POST', '/system/settings/reset', { keys: ['payments.commissionPct'] });
      assert.equal(r.body.data.payments.commissionPct, 10);
      assert.equal(r.body.data.payments.refundWindowDays, 14, 'khóa khác giữ nguyên');
      const all = await A('POST', '/system/settings/reset', {});
      assert.deepEqual(all.body.data.overrides, {});
      assert.equal(all.body.data.payments.refundWindowDays, 7);
      assert.equal(all.body.data.platform.name, 'SofinHub');
      const acts = await actions('global');
      assert.ok(acts.includes('settings.update') && acts.includes('settings.reset'));
      const log = (await GET('/audit-logs?action=settings.update&targetId=global')).body.data[0];
      assert.equal(log.metadata.changes['payments.commissionPct'].to, 12.5);
    });

    it('validate: ngoài khoảng/sai kiểu/khoá lạ/rỗng -> 400; reset khoá lạ -> 400', async () => {
      for (const body of [
        { payments: { commissionPct: 101 } },
        { payments: { commissionPct: -1 } },
        { payments: { refundWindowDays: 1.5 } },
        { payments: { trialDays: 0 } },
        { payments: { currency: 'GBP' } },
        { security: { sessionTimeoutMin: 20 } },
        { security: { maintenanceMode: 'yes' } },
        { platform: { supportEmail: 'khong-hop-le' } },
        { platform: { khongCo: 1 } },
        { khongCo: { a: 1 } },
        {},
        { payments: {} },
      ]) {
        assert.equal((await A('PATCH', '/system/settings', body)).status, 400, JSON.stringify(body));
      }
      assert.equal((await A('POST', '/system/settings/reset', { keys: ['khong.co'] })).status, 400);
    });

    it('chế độ bảo trì: API công khai 503 MAINTENANCE, admin/auth/feature-flags vẫn chạy; tắt lại -> bình thường', async () => {
      await A('PATCH', '/system/settings', { security: { maintenanceMode: true } });
      try {
        const pub = await c.call('GET', '/courses');
        assert.equal(pub.status, 503);
        assert.equal(pub.body.error.code, 'MAINTENANCE');
        assert.equal((await GET('/dashboard')).status, 200);
        assert.equal((await c.call('GET', '/feature-flags')).body.data.maintenance, true);
        assert.equal((await c.call('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: PW } })).status, 200);
      } finally {
        await A('PATCH', '/system/settings', { security: { maintenanceMode: false } });
      }
      assert.equal((await c.call('GET', '/courses')).status, 200);
      await A('POST', '/system/settings/reset', {});
    });

    it('tiền thanh toán dùng cấu hình mới: refundWindowDays/trialDays/commission đọc từ cấu hình (không còn cứng ở env)', async () => {
      const { cfg } = await import('../src/modules/settings/settings.service.js');
      await A('PATCH', '/system/settings', { payments: { trialDays: 3, subscriptionPeriodDays: 10, gatewayFeePct: 1.5, gatewayFeeFixedCents: 10 } });
      try {
        assert.equal(cfg().payments.trialDays, 3);
        assert.equal(cfg().payments.subscriptionPeriodDays, 10);
        const rev = await c.call('GET', '/courses/photo/revenue', { token: admin.token });
        assert.equal(rev.body.data.assumptions.gatewayFeePct, 1.5);
        assert.equal(rev.body.data.assumptions.gatewayFeeFixedCents, 10);
      } finally {
        await A('POST', '/system/settings/reset', {});
      }
    });
  });

  /* ================================================================== CATEGORIES + AUDIT */
  describe('Categories & Audit logs', () => {
    it('categories (System) dùng cùng dữ liệu với Discovery: list/patch/move/reorder', async () => {
      await db.prisma.discoveryCategory.createMany({
        data: [
          { key: 'tech', name: 'Công nghệ', position: 1 },
          { key: 'finance', name: 'Tài chính', position: 2 },
        ],
        skipDuplicates: true,
      });
      const list = (await GET('/system/categories')).body.data;
      assert.ok(list.length >= 2);
      assert.deepEqual(list.map((x: any) => x.key), (await GET('/discovery/categories')).body.data.map((x: any) => x.key));
      assert.ok(list.every((x: any) => typeof x.communities === 'number' && x.slug));
      const first = list[0].key;
      assert.equal((await A('PATCH', `/system/categories/${first}`, { status: 'disabled' })).body.data.status, 'disabled');
      assert.equal((await GET('/discovery/categories')).body.data.find((x: any) => x.key === first).status, 'disabled', 'cùng nguồn dữ liệu');
      await A('PATCH', `/system/categories/${first}`, { status: 'active' });
      const mv = await A('POST', `/system/categories/${first}/move`, { direction: 'down' });
      assert.equal(mv.status, 200);
      assert.notEqual(mv.body.data[0].key, first);
      assert.equal((await A('POST', '/system/categories/reorder', { keys: mv.body.data.map((x: any) => x.key).reverse() })).status, 200);
      assert.equal((await A('PATCH', '/system/categories/khong-co', { name: 'x' })).status, 404);
      assert.equal((await A('POST', '/system/categories', { key: 'khong-co', name: 'x' })).status, 400);
      assert.equal((await A('POST', '/system/categories/reorder', { keys: ['tech'] })).status, 400);
      assert.equal((await A('PATCH', `/system/categories/${first}`, { status: 'lạ' }, (await user('catmod', 'moderator')).token)).status, 400, 'Moderator có quyền, body sai -> 400');
    });

    it('audit: có ip + vai trò actor, bộ lọc (actor/action/q/khoảng ngày), /filters, /export CSV đúng định dạng & chống formula', async () => {
      const sup = await user('audsup', 'support');
      const t = await c.registerUser('audt');
      const tk = (await c.call('POST', '/support/tickets', { token: t.token, body: { subject: '=HYPERLINK("http://x")', message: 'hi, "quoted"' } })).body.data;
      await A('POST', `/support/tickets/${tk.id}/note`, { body: 'ghi chú' }, sup.token);
      const list = await GET(`/audit-logs?targetId=${tk.id}`);
      assert.equal(list.status, 200);
      const row = list.body.data[0];
      assert.equal(row.action, 'support.ticket.note');
      assert.equal(row.actor.id, sup.id);
      assert.deepEqual(row.actor.role, { key: 'support', name: 'Support' });
      assert.ok(row.ip, 'ghi IP của admin');
      const sa = (await GET('/audit-logs?action=system.&limit=5')).body.data;
      assert.ok(Array.isArray(sa));
      const byActor = (await GET(`/audit-logs?actor=${sup.id}`)).body;
      assert.ok(byActor.data.length >= 1 && byActor.data.every((r: any) => r.actor.id === sup.id));
      assert.ok((await GET('/audit-logs?action=support.ticket.')).body.data.every((r: any) => r.action.startsWith('support.ticket.')));
      assert.equal((await GET('/audit-logs?from=2999-01-01T00:00:00Z')).body.data.length, 0);
      const adminRow = (await GET('/audit-logs?action=admin.create&limit=1')).body.data[0];
      assert.deepEqual(adminRow.actor.role, { key: 'super_admin', name: 'Super Admin' });

      const f = (await GET('/audit-logs/filters')).body.data;
      assert.ok(f.actors.some((a: any) => a.id === sup.id));
      assert.ok(f.actions.includes('support.ticket.note') && f.targetTypes.includes('ticket'));

      const ex = await fetch(`${server.baseUrl}/admin/audit-logs/export?targetId=${tk.id}`, { headers: { Authorization: `Bearer ${admin.token}` } });
      assert.equal(ex.status, 200);
      assert.match(ex.headers.get('content-type') ?? '', /text\/csv/);
      assert.match(ex.headers.get('content-disposition') ?? '', /attachment; filename="audit-logs-\d{4}-\d{2}-\d{2}\.csv"/);
      const csv = await ex.text();
      const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
      assert.equal(lines[0], 'time,admin,action,targetType,targetId,target,case,reason,ip');
      assert.ok(lines.length >= 2 && lines[1]!.includes('support.ticket.note'));
      assert.ok(lines[1]!.includes(tk.id));
      assert.ok(lines.slice(1).every((l) => !/^=/.test(l)));
      // nhãn target chứa dấu "=" ở đầu được chặn công thức và có dấu nháy kép đúng chuẩn CSV
      const ex2 = await (await fetch(`${server.baseUrl}/admin/audit-logs/export?targetId=${tk.id}&action=support.ticket.note`, { headers: { Authorization: `Bearer ${admin.token}` } })).text();
      assert.ok(ex2.includes("'=HYPERLINK") || !ex2.includes(',=HYPERLINK'), 'chặn formula injection');
      assert.equal((await fetch(`${server.baseUrl}/admin/audit-logs/export`, { headers: { Authorization: `Bearer ${sup.token}` } })).status, 403);
      assert.equal((await fetch(`${server.baseUrl}/admin/audit-logs/export`)).status, 401);
    });
  });
});
