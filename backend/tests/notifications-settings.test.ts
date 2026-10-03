import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('giờ im lặng (hàm thuần)', () => {
  let isQuietNow: typeof import('../src/modules/notifications/notifications.quiet.js').isQuietNow;
  before(async () => {
    ({ isQuietNow } = await import('../src/modules/notifications/notifications.quiet.js'));
  });
  // 2026-01-01T16:00Z = 23:00 giờ VN (UTC+7) = 11:00 giờ New York (UTC-5).
  const at = (iso: string) => new Date(iso);
  const q = (from: string, to: string, enabled = true) => ({ enabled, from, to });

  it('tắt => không bao giờ im lặng', () => {
    assert.equal(isQuietNow(q('22:00', '07:00', false), 'Asia/Ho_Chi_Minh', at('2026-01-01T16:00:00Z')), false);
  });
  it('khoảng thường 13:00-15:00', () => {
    assert.equal(isQuietNow(q('13:00', '15:00'), 'UTC', at('2026-01-01T13:00:00Z')), true);
    assert.equal(isQuietNow(q('13:00', '15:00'), 'UTC', at('2026-01-01T14:59:00Z')), true);
    assert.equal(isQuietNow(q('13:00', '15:00'), 'UTC', at('2026-01-01T15:00:00Z')), false); // [from, to)
    assert.equal(isQuietNow(q('13:00', '15:00'), 'UTC', at('2026-01-01T12:59:00Z')), false);
  });
  it('qua nửa đêm 22:00-07:00', () => {
    for (const [iso, want] of [
      ['2026-01-01T22:00:00Z', true],
      ['2026-01-01T23:59:00Z', true],
      ['2026-01-02T00:00:00Z', true],
      ['2026-01-02T06:59:00Z', true],
      ['2026-01-02T07:00:00Z', false],
      ['2026-01-01T12:00:00Z', false],
      ['2026-01-01T21:59:00Z', false],
    ] as const) {
      assert.equal(isQuietNow(q('22:00', '07:00'), 'UTC', at(iso)), want, iso);
    }
  });
  it('tính theo múi giờ của user', () => {
    const now = at('2026-01-01T16:00:00Z');
    assert.equal(isQuietNow(q('22:00', '07:00'), 'Asia/Ho_Chi_Minh', now), true); // 23:00 ở VN
    assert.equal(isQuietNow(q('22:00', '07:00'), 'America/New_York', now), false); // 11:00 ở New York
  });
  it('from == to, giờ sai định dạng hoặc múi giờ lạ không làm sập', () => {
    assert.equal(isQuietNow(q('08:00', '08:00'), 'UTC', at('2026-01-01T08:00:00Z')), false);
    assert.equal(isQuietNow(q('abc', '07:00'), 'UTC', at('2026-01-01T03:00:00Z')), false);
    assert.equal(isQuietNow(q('22:00', '07:00'), 'Not/AZone', at('2026-01-01T16:00:00Z')), true); // rơi về giờ VN (23:00)
  });
});

describe('Cài đặt thông báo: giờ im lặng, email, theo cộng đồng, tin nhắn riêng', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let svc: typeof import('../src/modules/notifications/notifications.service.js');
  let mail: typeof import('../src/modules/mail/mail.service.js');
  let quietMod: typeof import('../src/modules/notifications/notifications.quiet.js');

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    svc = await import('../src/modules/notifications/notifications.service.js');
    mail = await import('../src/modules/mail/mail.service.js');
    quietMod = await import('../src/modules/notifications/notifications.quiet.js');
  });
  after(() => server.close());

  const prefs = (token: string, body?: unknown) =>
    body === undefined ? c.call('GET', '/notifications/preferences', { token }) : c.call('PUT', '/notifications/preferences', { token, body });
  const stored = async (u: { token: string }) => (await c.call('GET', '/notifications?limit=50', { token: u.token })).body.data as { title: string }[];
  const mailsWith = (email: string, subject: string) => mail.mailService.listOutbox(email).filter((m) => m.subject === subject);
  const hhmm = (min: number) => {
    const m = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  it('401 thiếu token; mặc định có đủ trường mới và danh sách cộng đồng', async () => {
    assert.equal((await c.call('GET', '/notifications/preferences')).status, 401);
    assert.equal((await c.call('PUT', '/notifications/preferences', { body: { dmAllowed: false } })).status, 401);
    const u = await c.registerUser('nsdef');
    await c.call('POST', '/courses/photo/enroll', { token: u.token });
    const r = await prefs(u.token);
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.equal(d.emailDigest, 'off');
    assert.deepEqual(d.quiet, { enabled: false, from: '22:00', to: '07:00' });
    assert.equal(d.dmAllowed, true);
    assert.equal(d.emailUnreadDm, true);
    assert.equal(d.notifyFollowedPosts, true);
    assert.deepEqual(d.communityPrefs, {});
    const row = d.communities.find((x: any) => x.id === 'photo');
    assert.equal(row.role, 'member');
    assert.deepEqual(row.prefs, { admin: true, event: true, featured: true, comment: true, joinRequest: true });
    assert.equal(row.applicable.joinRequest, false); // thành viên thường: ô "–"
    assert.equal(row.applicable.comment, true);
  });

  it('chủ cộng đồng: cột "Yêu cầu gia nhập" áp dụng được', async () => {
    const o = await c.registerUser('nsown');
    const made = await c.call('POST', '/communities', { token: o.token, body: { title: 'Nhóm cài đặt TB', description: 'm', category: 'tech', priceUsd: 0, visibility: 'public' } });
    assert.equal(made.status, 201);
    const row = (await prefs(o.token)).body.data.communities.find((x: any) => x.id === made.body.data.id);
    assert.equal(row.role, 'owner');
    assert.equal(row.applicable.joinRequest, true);
  });

  it('PUT: validate (400), lưu từng phần, trùng giờ im lặng bị từ chối, giữ tương thích types/emailDigest', async () => {
    const u = await c.registerUser('nsput');
    for (const body of [
      {},
      { quiet: { from: '25:00' } },
      { quiet: { from: '7:00' } },
      { emailDigest: 'hourly' },
      { dmAllowed: 'yes' },
      { communityPrefs: { photo: { admin: 'x' } } },
      { communityPrefs: { photo: { unknown: true } } },
      { unknownField: 1 },
    ]) {
      assert.equal((await prefs(u.token, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await prefs(u.token, { quiet: { enabled: true, from: '08:00', to: '08:00' } })).status, 400);

    const ok = await prefs(u.token, { emailDigest: 'instant', quiet: { enabled: true, from: '23:00', to: '06:30' }, dmAllowed: false, emailUnreadDm: false, notifyFollowedPosts: false });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.emailDigest, 'instant');
    assert.deepEqual(ok.body.data.quiet, { enabled: true, from: '23:00', to: '06:30' });
    // Cập nhật từng phần: không đụng các trường khác.
    const part = await prefs(u.token, { quiet: { enabled: false } });
    assert.deepEqual(part.body.data.quiet, { enabled: false, from: '23:00', to: '06:30' });
    assert.equal(part.body.data.dmAllowed, false);
    assert.equal(part.body.data.emailUnreadDm, false);
    assert.equal((await prefs(u.token)).body.data.notifyFollowedPosts, false);
    // Loại quan trọng vẫn không tắt được.
    assert.equal((await prefs(u.token, { types: { payment_failed: false } })).status, 400);
  });

  it('theo cộng đồng: lưu thay thế cả bảng, bỏ id lạ, "đặt lại" = {}', async () => {
    const u = await c.registerUser('nscom');
    await c.call('POST', '/courses/photo/enroll', { token: u.token });
    const r = await prefs(u.token, { communityPrefs: { photo: { comment: false, event: false }, 'khong-ton-tai': { admin: false } } });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body.data.communityPrefs), ['photo']);
    assert.deepEqual(r.body.data.communityPrefs.photo, { admin: true, event: false, featured: true, comment: false, joinRequest: true });
    const row = r.body.data.communities.find((x: any) => x.id === 'photo');
    assert.equal(row.prefs.comment, false);
    const reset = await prefs(u.token, { communityPrefs: {} });
    assert.deepEqual(reset.body.data.communityPrefs, {});
    assert.equal(reset.body.data.communities.find((x: any) => x.id === 'photo').prefs.comment, true);
  });

  it('theo cộng đồng: tắt cột thì notify tương ứng không được lưu; loại khác & quan trọng vẫn đến', async () => {
    const u = await c.registerUser('nsmute');
    await c.call('POST', '/courses/photo/enroll', { token: u.token });
    await prefs(u.token, { communityPrefs: { photo: { comment: false, event: false, admin: false } } });
    const base = { userId: u.id, body: 'b', communityId: 'photo' };
    svc.notify({ ...base, type: 'post_commented', title: 'cmt-photo' });
    svc.notify({ ...base, type: 'event_created', title: 'ev-photo' });
    svc.notify({ ...base, type: 'event_reminder', title: 'evr-photo' });
    svc.notify({ ...base, type: 'system', title: 'adm-photo', category: 'admin' });
    svc.notify({ ...base, type: 'system', title: 'sys-photo' }); // không nhãn => không bị cột nào chặn
    svc.notify({ ...base, type: 'post_liked', title: 'like-photo' });
    svc.notify({ ...base, type: 'role_changed', title: 'role-photo' }); // quan trọng
    svc.notify({ userId: u.id, type: 'post_commented', title: 'cmt-khac', body: 'b', communityId: 'cook' }); // cộng đồng khác
    svc.notify({ userId: u.id, type: 'post_commented', title: 'cmt-none', body: 'b' }); // không gắn cộng đồng
    await svc.flushNotifications();
    const titles = (await stored(u)).map((n) => n.title).sort();
    assert.deepEqual(titles, ['cmt-khac', 'cmt-none', 'like-photo', 'role-photo', 'sys-photo']);
  });

  it('email: instant gửi ngay khi có thông báo; off/daily không gửi', async () => {
    const u = await c.registerUser('nsmail');
    svc.notify({ userId: u.id, type: 'system', title: 'mail-off', body: 'x' });
    await prefs(u.token, { emailDigest: 'daily' });
    svc.notify({ userId: u.id, type: 'system', title: 'mail-daily', body: 'x' });
    await svc.flushNotifications();
    assert.equal(mailsWith(u.email, 'mail-off').length, 0);
    assert.equal(mailsWith(u.email, 'mail-daily').length, 0);

    await prefs(u.token, { emailDigest: 'instant' });
    svc.notify({ userId: u.id, type: 'system', title: 'mail-instant', body: 'Nội dung gửi', link: '/notifications' });
    await svc.flushNotifications();
    const sent = mailsWith(u.email, 'mail-instant');
    assert.equal(sent.length, 1);
    assert.match(sent[0]!.text, /Nội dung gửi/);
    assert.match(sent[0]!.text, /\/notifications/);
  });

  it('giờ im lặng: vẫn lưu thông báo nhưng không đẩy SSE và không gửi email; ngoài giờ thì có', async () => {
    const u = await c.registerUser('nsquiet');
    const now = quietMod.localMinutes(new Date(), 'Asia/Ho_Chi_Minh');
    const pushed: string[] = [];
    const off = svc.notificationsService.onNew((n) => {
      if (n.userId === u.id) pushed.push(n.title);
    });
    try {
      // Cửa sổ chứa "bây giờ" (tránh đúng giờ biên).
      await prefs(u.token, { emailDigest: 'instant', quiet: { enabled: true, from: hhmm(now - 120), to: hhmm(now + 120) } });
      svc.notify({ userId: u.id, type: 'system', title: 'q-in', body: 'x' });
      await svc.flushNotifications();
      await new Promise((r) => setTimeout(r, 50));
      assert.ok((await stored(u)).some((n) => n.title === 'q-in'), 'vẫn lưu trong chuông');
      assert.equal(mailsWith(u.email, 'q-in').length, 0);
      assert.ok(!pushed.includes('q-in'), 'không đẩy realtime');

      // Cửa sổ nằm ngoài "bây giờ".
      await prefs(u.token, { quiet: { enabled: true, from: hhmm(now + 120), to: hhmm(now + 240) } });
      svc.notify({ userId: u.id, type: 'system', title: 'q-out', body: 'x' });
      await svc.flushNotifications();
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(mailsWith(u.email, 'q-out').length, 1);
      assert.ok(pushed.includes('q-out'));
    } finally {
      off();
    }
  });

  it('tin nhắn riêng: dmAllowed=false chặn mở/gửi (403 DM_DISABLED), bật lại thì được', async () => {
    const a = await c.registerUser('dmA');
    const b = await c.registerUser('dmB');
    for (const u of [a, b]) await c.call('POST', '/courses/photo/enroll', { token: u.token });
    const open = (token: string, userId: string) => c.call('POST', '/conversations', { token, body: { userId } });

    const conv = await open(a.token, b.id);
    assert.equal(conv.status, 201);
    await prefs(b.token, { dmAllowed: false });
    const blocked = await open(a.token, b.id);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error?.code ?? blocked.body.code, 'DM_DISABLED');
    assert.match(JSON.stringify(blocked.body), /tắt nhận tin nhắn riêng/);
    const send = await c.call('POST', `/conversations/${conv.body.data.id}/messages`, { token: a.token, body: { content: 'hi' } });
    assert.equal(send.status, 403);
    // Người tắt vẫn tự nhắn đi được? Không: cặp này đã có hội thoại, b nhắn cho a (a cho phép).
    const reply = await c.call('POST', `/conversations/${conv.body.data.id}/messages`, { token: b.token, body: { content: 'hello' } });
    assert.equal(reply.status, 201);
    await prefs(b.token, { dmAllowed: true });
    assert.equal((await c.call('POST', `/conversations/${conv.body.data.id}/messages`, { token: a.token, body: { content: 'hi again' } })).status, 201);
  });

  it('email khi có tin nhắn chưa đọc: theo emailUnreadDm', async () => {
    const a = await c.registerUser('emA');
    const b = await c.registerUser('emB');
    const d = await c.registerUser('emC');
    for (const u of [a, b, d]) await c.call('POST', '/courses/photo/enroll', { token: u.token });
    const subject = 'Test emA đã gửi tin nhắn cho bạn';
    const conv1 = await c.call('POST', '/conversations', { token: a.token, body: { userId: b.id } });
    await c.call('POST', `/conversations/${conv1.body.data.id}/messages`, { token: a.token, body: { content: 'xin chào b' } });
    await svc.flushNotifications();
    assert.equal(mailsWith(b.email, subject).length, 1);

    await prefs(d.token, { emailUnreadDm: false });
    const conv2 = await c.call('POST', '/conversations', { token: a.token, body: { userId: d.id } });
    await c.call('POST', `/conversations/${conv2.body.data.id}/messages`, { token: a.token, body: { content: 'xin chào d' } });
    await svc.flushNotifications();
    assert.equal(mailsWith(d.email, subject).length, 0);
    assert.ok((await stored(d)).some((n) => n.title === subject), 'thông báo trong chuông vẫn có');
  });
});
