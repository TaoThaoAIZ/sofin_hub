import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

/** Bài viết mở rộng (sửa/xóa/ẩn/poll/thẻ/chia sẻ) + sự kiện mở rộng (CRUD/RSVP/iCal/nhắc lịch). */
describe('nội dung: bài viết và sự kiện', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let grantRole: (userId: string, role: 'mod' | 'admin') => Promise<void>;
  let notifications: () => Array<{ userId: string; type: string; link?: string; body: string }>;
  let runReminders: (now?: Date) => Promise<number>;
  const COURSE = 'photo';

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    // Cùng process với server nên dùng chung bộ nhớ; chưa có API cấp vai trò nên đặt trực tiếp.
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    grantRole = (userId, role) => enrollmentService.setRole(userId, COURSE, role);
    const { notificationStore } = await import('../src/modules/notifications/notifications.service.js');
    notifications = () => notificationStore.all() as any;
    ({ runEventRemindersOnce: runReminders } = await import('../src/modules/events/events.reminders.js'));
  });
  after(() => server.close());

  async function member(prefix: string, role?: 'mod' | 'admin') {
    const u = await c.registerUser(prefix);
    assert.equal((await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token })).status, 200);
    if (role) await grantRole(u.id, role);
    return u;
  }
  const newPost = async (token: string, extra: Record<string, unknown> = {}) => {
    const r = await c.call('POST', `/courses/${COURSE}/posts`, { token, body: { content: 'Nội dung thử', ...extra } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data;
  };

  describe('bài viết', () => {
    it('401 khi thiếu token và 404 khi bài không tồn tại', async () => {
      assert.equal((await c.call('GET', '/posts/x')).status, 401);
      assert.equal((await c.call('PATCH', '/posts/x', { body: {} })).status, 401);
      const u = await member('p404');
      assert.equal((await c.call('GET', '/posts/khong-co', { token: u.token })).status, 404);
      assert.equal((await c.call('DELETE', '/comments/khong-co', { token: u.token })).status, 404);
    });

    it('người chưa tham gia cộng đồng bị 403 khi xem bài', async () => {
      const a = await member('pa');
      const post = await newPost(a.token);
      const outsider = await c.registerUser('outsider');
      assert.equal((await c.call('GET', `/posts/${post.id}`, { token: outsider.token })).status, 403);
    });

    it('GET chi tiết trả shareUrl; /share trả url, title, excerpt', async () => {
      const u = await member('pshare');
      const post = await newPost(u.token, { content: 'A'.repeat(300) });
      const got = await c.call('GET', `/posts/${post.id}`, { token: u.token });
      assert.equal(got.status, 200);
      assert.equal(got.body.data.shareUrl, `/courses/${COURSE}/community?post=${post.id}`);
      const share = await c.call('GET', `/posts/${post.id}/share`, { token: u.token });
      assert.equal(share.status, 200);
      assert.equal(share.body.data.url, got.body.data.shareUrl);
      assert.ok(share.body.data.title);
      assert.ok(share.body.data.excerpt.length < 300);
    });

    it('sửa bài: tác giả và mod được, member khác bị 403; đặt editedAt; 400 khi rỗng', async () => {
      const author = await member('pedit');
      const other = await member('pother');
      const mod = await member('pmod', 'mod');
      const post = await newPost(author.token);

      assert.equal((await c.call('PATCH', `/posts/${post.id}`, { token: other.token, body: { content: 'hack' } })).status, 403);
      assert.equal((await c.call('PATCH', `/posts/${post.id}`, { token: author.token, body: {} })).status, 400);
      const ok = await c.call('PATCH', `/posts/${post.id}`, { token: author.token, body: { content: 'Đã sửa', tags: ['#moi'], category: 'Hỏi đáp' } });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.content, 'Đã sửa');
      assert.equal(ok.body.data.category, 'Hỏi đáp');
      assert.ok(ok.body.data.editedAt);
      assert.equal((await c.call('PATCH', `/posts/${post.id}`, { token: mod.token, body: { content: 'Mod sửa' } })).status, 200);
    });

    it('xóa bài: xóa luôn bình luận; member khác 403, tác giả/mod được', async () => {
      const author = await member('pdel');
      const other = await member('pdelo');
      const mod = await member('pdelmod', 'mod');
      const post = await newPost(author.token);
      const cm = await c.call('POST', `/posts/${post.id}/comments`, { token: other.token, body: { content: 'hi' } });
      assert.equal(cm.status, 201);

      assert.equal((await c.call('DELETE', `/posts/${post.id}`, { token: other.token })).status, 403);
      assert.equal((await c.call('DELETE', `/posts/${post.id}`, { token: author.token })).status, 200);
      assert.equal((await c.call('GET', `/posts/${post.id}`, { token: author.token })).status, 404);
      assert.equal((await c.call('PATCH', `/comments/${cm.body.data.id}`, { token: other.token, body: { content: 'x' } })).status, 404);

      const p2 = await newPost(author.token);
      assert.equal((await c.call('DELETE', `/posts/${p2.id}`, { token: mod.token })).status, 200);
    });

    it('bình luận: sửa/xóa đúng quyền và commentsCount cập nhật', async () => {
      const author = await member('cauthor');
      const other = await member('cother');
      const mod = await member('cmod', 'mod');
      const post = await newPost(author.token);
      const cm = (await c.call('POST', `/posts/${post.id}/comments`, { token: other.token, body: { content: 'gốc' } })).body.data;
      const count = async () => (await c.call('GET', `/posts/${post.id}`, { token: author.token })).body.data.commentsCount;
      assert.equal(await count(), 1);

      assert.equal((await c.call('PATCH', `/comments/${cm.id}`, { token: author.token, body: { content: 'x' } })).status, 403);
      assert.equal((await c.call('PATCH', `/comments/${cm.id}`, { token: other.token, body: { content: '' } })).status, 400);
      const edited = await c.call('PATCH', `/comments/${cm.id}`, { token: other.token, body: { content: 'đã sửa' } });
      assert.equal(edited.status, 200);
      assert.ok(edited.body.data.editedAt);

      assert.equal((await c.call('DELETE', `/comments/${cm.id}`, { token: author.token })).status, 403);
      assert.equal((await c.call('DELETE', `/comments/${cm.id}`, { token: mod.token })).status, 200);
      assert.equal(await count(), 0);
    });

    it('ẩn/hiện bài: chỉ mod; bài ẩn không hiện với member thường nhưng tác giả và mod vẫn thấy', async () => {
      const author = await member('hauthor');
      const viewer = await member('hviewer');
      const mod = await member('hmod', 'mod');
      const post = await newPost(author.token, { tags: ['#anbai'] });

      assert.equal((await c.call('POST', `/posts/${post.id}/hide`, { token: viewer.token })).status, 403);
      assert.equal((await c.call('POST', `/posts/${post.id}/hide`, { token: mod.token })).status, 200);

      const ids = async (t: string) => (await c.call('GET', `/courses/${COURSE}/posts?limit=50&tag=anbai`, { token: t })).body.data.map((p: any) => p.id);
      assert.ok(!(await ids(viewer.token)).includes(post.id));
      assert.ok((await ids(author.token)).includes(post.id));
      assert.ok((await ids(mod.token)).includes(post.id));
      assert.equal((await c.call('GET', `/posts/${post.id}`, { token: viewer.token })).status, 404);
      const seen = await c.call('GET', `/posts/${post.id}`, { token: author.token });
      assert.equal(seen.body.data.hidden, true);

      assert.equal((await c.call('POST', `/posts/${post.id}/unhide`, { token: mod.token })).status, 200);
      assert.ok((await ids(viewer.token)).includes(post.id));
    });

    it('poll: tạo, bình chọn, đổi lựa chọn, 1 lựa chọn khi multiple=false, đóng bình chọn', async () => {
      const author = await member('pollauthor');
      const voter = await member('pollvoter');
      const bad = await c.call('POST', `/courses/${COURSE}/posts`, { token: author.token, body: { content: 'x', poll: { options: ['chỉ một'] } } });
      assert.equal(bad.status, 400);
      const tooMany = await c.call('POST', `/courses/${COURSE}/posts`, { token: author.token, body: { content: 'x', poll: { options: ['1', '2', '3', '4', '5', '6', '7'] } } });
      assert.equal(tooMany.status, 400);

      const post = await newPost(author.token, { poll: { question: 'Chọn?', options: ['A', 'B', 'C'] } });
      assert.equal(post.poll.options.length, 3);
      assert.deepEqual(post.poll.viewerVotes, []);
      const [a, b] = post.poll.options as { id: string }[];

      assert.equal((await c.call('POST', `/posts/${post.id}/poll/vote`, { token: voter.token, body: { optionIds: [a!.id, b!.id] } })).status, 400);
      assert.equal((await c.call('POST', `/posts/${post.id}/poll/vote`, { token: voter.token, body: { optionIds: ['nope'] } })).status, 400);
      const v1 = await c.call('POST', `/posts/${post.id}/poll/vote`, { token: voter.token, body: { optionIds: [a!.id] } });
      assert.equal(v1.status, 200);
      assert.deepEqual(v1.body.data.poll.viewerVotes, [a!.id]);
      // Đổi lựa chọn: phiếu chuyển từ A sang B.
      const v2 = await c.call('POST', `/posts/${post.id}/poll/vote`, { token: voter.token, body: { optionIds: [b!.id] } });
      const counts = Object.fromEntries(v2.body.data.poll.options.map((o: any) => [o.id, o.count]));
      assert.equal(counts[a!.id], 0);
      assert.equal(counts[b!.id], 1);
      assert.equal(v2.body.data.poll.totalVoters, 1);
      // Người khác không thấy viewerVotes của voter.
      const asAuthor = await c.call('GET', `/posts/${post.id}`, { token: author.token });
      assert.deepEqual(asAuthor.body.data.poll.viewerVotes, []);

      const multi = await newPost(author.token, { poll: { options: ['X', 'Y'], multiple: true } });
      const [x, y] = multi.poll.options as { id: string }[];
      const mv = await c.call('POST', `/posts/${multi.id}/poll/vote`, { token: voter.token, body: { optionIds: [x!.id, y!.id] } });
      assert.equal(mv.status, 200);
      assert.equal(mv.body.data.poll.viewerVotes.length, 2);

      // Bài không có poll -> 400
      const plain = await newPost(author.token);
      assert.equal((await c.call('POST', `/posts/${plain.id}/poll/vote`, { token: voter.token, body: { optionIds: ['a'] } })).status, 400);

      // Đã đóng -> 409 (đóng sau ~1s)
      const closing = await newPost(author.token, { poll: { options: ['P', 'Q'], closesAt: new Date(Date.now() + 700).toISOString() } });
      await new Promise((r) => setTimeout(r, 900));
      const late = await c.call('POST', `/posts/${closing.id}/poll/vote`, { token: voter.token, body: { optionIds: [closing.poll.options[0].id] } });
      assert.equal(late.status, 409);
    });

    it('thẻ phổ biến và lọc theo ?tag=', async () => {
      const u = await member('tagger');
      await newPost(u.token, { tags: ['#TagHot', '#Rieng1'] });
      await newPost(u.token, { tags: ['#taghot'] });
      const tags = await c.call('GET', `/courses/${COURSE}/tags`, { token: u.token });
      assert.equal(tags.status, 200);
      assert.ok(tags.body.data.length <= 20);
      const hot = tags.body.data.find((t: any) => t.tag.toLowerCase() === '#taghot');
      assert.equal(hot.count, 2);
      assert.equal((await c.call('GET', `/courses/${COURSE}/tags`)).status, 401);

      const filtered = await c.call('GET', `/courses/${COURSE}/posts?tag=Rieng1`, { token: u.token });
      assert.equal(filtered.body.data.length, 1);
    });

    it('like: thông báo cho tác giả đúng 1 lần, không tự thông báo', async () => {
      const author = await member('lauthor');
      const liker = await member('lliker');
      const post = await newPost(author.token);
      const count = () => notifications().filter((n) => n.userId === author.id && n.type === 'post_liked').length;

      await c.call('POST', `/posts/${post.id}/like`, { token: author.token }); // tự like
      assert.equal(count(), 0);
      for (let i = 0; i < 4; i++) await c.call('POST', `/posts/${post.id}/like`, { token: liker.token }); // like/unlike liên tục
      assert.equal(count(), 1);
    });

    it('bình luận thông báo post_commented cho tác giả (không tự thông báo)', async () => {
      const author = await member('nauthor');
      const other = await member('nother');
      const post = await newPost(author.token);
      const count = () => notifications().filter((n) => n.userId === author.id && n.type === 'post_commented').length;
      await c.call('POST', `/posts/${post.id}/comments`, { token: author.token, body: { content: 'tự bình luận' } });
      assert.equal(count(), 0);
      await c.call('POST', `/posts/${post.id}/comments`, { token: other.token, body: { content: 'chào' } });
      assert.equal(count(), 1);
    });
  });

  describe('sự kiện', () => {
    const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
    const mkEvent = async (token: string, extra: Record<string, unknown> = {}) => {
      const r = await c.call('POST', `/courses/${COURSE}/events`, { token, body: { title: 'Sự kiện thử', startAt: inMinutes(60 * 24), ...extra } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body.data;
    };

    it('401 / 403 / 404 / 400', async () => {
      const mod = await member('emod', 'mod');
      const plain = await member('eplain');
      const ev = await mkEvent(mod.token);
      assert.equal((await c.call('GET', `/events/${ev.id}`)).status, 401);
      assert.equal((await c.call('PATCH', `/events/${ev.id}`, { token: plain.token, body: { title: 'x' } })).status, 403);
      assert.equal((await c.call('DELETE', `/events/${ev.id}`, { token: plain.token })).status, 403);
      assert.equal((await c.call('GET', '/events/khong-co', { token: plain.token })).status, 404);
      assert.equal((await c.call('DELETE', '/events/khong-co/rsvp', { token: plain.token })).status, 404);
      assert.equal((await c.call('PATCH', `/events/${ev.id}`, { token: mod.token, body: {} })).status, 400);
      assert.equal((await c.call('PATCH', `/events/${ev.id}`, { token: mod.token, body: { startAt: 'không phải ngày' } })).status, 400);
      const outsider = await c.registerUser('eout');
      assert.equal((await c.call('GET', `/events/${ev.id}`, { token: outsider.token })).status, 403);
    });

    it('xem, sửa và xóa sự kiện; xóa thì thông báo cho người đã RSVP', async () => {
      const mod = await member('ecrud', 'mod');
      const guest = await member('eguest');
      const ev = await mkEvent(mod.token);
      assert.equal((await c.call('GET', `/events/${ev.id}`, { token: guest.token })).body.data.title, 'Sự kiện thử');

      const patched = await c.call('PATCH', `/events/${ev.id}`, { token: mod.token, body: { title: 'Tên mới', capacity: 5, meetingLink: 'https://meet.example.com/x' } });
      assert.equal(patched.status, 200);
      assert.equal(patched.body.data.title, 'Tên mới');
      assert.equal(patched.body.data.capacity, 5);
      const cleared = await c.call('PATCH', `/events/${ev.id}`, { token: mod.token, body: { capacity: null, meetingLink: null } });
      assert.equal(cleared.body.data.capacity, undefined);

      assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: guest.token })).body.data.rsvped, true);
      assert.equal((await c.call('DELETE', `/events/${ev.id}`, { token: mod.token })).status, 200);
      assert.equal((await c.call('GET', `/events/${ev.id}`, { token: guest.token })).status, 404);
      assert.ok(notifications().some((n) => n.userId === guest.id && n.type === 'system' && n.body.includes('Tên mới')));
    });

    it('tạo sự kiện thông báo event_created cho thành viên, trừ người tạo', async () => {
      const mod = await member('enotifmod', 'mod');
      const guest = await member('enotifguest');
      const ev = await mkEvent(mod.token, { title: 'Thông báo sự kiện mới' });
      const got = (id: string) => notifications().filter((n) => n.userId === id && n.type === 'event_created' && n.body.includes(ev.title));
      assert.equal(got(guest.id).length, 1);
      assert.equal(got(mod.id).length, 0);
    });

    it('RSVP: hủy tường minh idempotent; đủ chỗ trả 409', async () => {
      const mod = await member('ersvpmod', 'mod');
      const a = await member('ersvpa');
      const b = await member('ersvpb');
      const ev = await mkEvent(mod.token, { capacity: 1 });

      assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: a.token })).status, 200);
      assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: b.token })).status, 409);
      // Không hạ sức chứa dưới số đã đăng ký (0 bị 400 vì phải dương; đặt = 1 vẫn ok).
      assert.equal((await c.call('DELETE', `/events/${ev.id}/rsvp`, { token: a.token })).body.data.rsvped, false);
      const again = await c.call('DELETE', `/events/${ev.id}/rsvp`, { token: a.token });
      assert.equal(again.status, 200);
      assert.equal(again.body.data.rsvpCount, 0);
      assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: b.token })).status, 200);
    });

    it('iCalendar: đúng định dạng RFC 5545 (CRLF, escape, UID, folding)', async () => {
      const mod = await member('eics', 'mod');
      const title = 'Buổi học; có dấu phẩy, và xuống dòng \\ và tiếng Việt rất dài để buộc phải gập dòng vì vượt quá bảy mươi lăm octet';
      const ev = await mkEvent(mod.token, { title, description: 'Dòng 1\nDòng 2' });

      const one = await fetch(`${server.baseUrl}/events/${ev.id}/ics`, { headers: { Authorization: `Bearer ${mod.token}` } });
      assert.equal(one.status, 200);
      assert.equal(one.headers.get('content-type'), 'text/calendar; charset=utf-8');
      const text = await one.text();
      assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n'));
      assert.ok(text.endsWith('END:VCALENDAR\r\n'));
      assert.ok(!/[^\r]\n/.test(text), 'mọi xuống dòng phải là CRLF');
      for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `dòng quá dài: ${line}`);
      const unfolded = text.replace(/\r\n /g, '');
      assert.ok(unfolded.includes(`UID:${ev.id}@sofinhub`));
      assert.ok(/DTSTAMP:\d{8}T\d{6}Z/.test(unfolded));
      assert.ok(/DTSTART:\d{8}T\d{6}Z/.test(unfolded));
      assert.ok(unfolded.includes('SUMMARY:Buổi học\\; có dấu phẩy\\, và xuống dòng \\\\ và'));
      assert.ok(unfolded.includes('Dòng 1\\nDòng 2'));

      const all = await fetch(`${server.baseUrl}/courses/${COURSE}/events.ics`, { headers: { Authorization: `Bearer ${mod.token}` } });
      assert.equal(all.status, 200);
      assert.match(all.headers.get('content-type') ?? '', /^text\/calendar/);
      assert.ok((await all.text()).replace(/\r\n /g, '').includes(`UID:${ev.id}@sofinhub`));

      assert.equal((await fetch(`${server.baseUrl}/events/${ev.id}/ics`)).status, 401);
      assert.equal((await c.call('GET', '/events/khong-co/ics', { token: mod.token })).status, 404);
    });

    it('nhắc lịch: chỉ gửi trong vòng 1 giờ trước giờ bắt đầu, mỗi (sự kiện, user) một lần', async () => {
      const mod = await member('eremmod', 'mod');
      const soon = await member('eremsoon');
      const later = await member('eremlater');
      const evSoon = await mkEvent(mod.token, { title: 'Sắp diễn ra', startAt: inMinutes(30) });
      const evLater = await mkEvent(mod.token, { title: 'Còn lâu', startAt: inMinutes(60 * 5) });
      await c.call('POST', `/events/${evSoon.id}/rsvp`, { token: soon.token });
      await c.call('POST', `/events/${evLater.id}/rsvp`, { token: later.token });

      const reminders = (id: string) => notifications().filter((n) => n.userId === id && n.type === 'event_reminder');
      await runReminders(new Date());
      assert.equal(reminders(soon.id).length, 1);
      assert.equal(reminders(later.id).length, 0);
      await runReminders(new Date());
      assert.equal(reminders(soon.id).length, 1, 'không nhắc lần 2');
      // Khi tới sát giờ của sự kiện còn lâu thì mới nhắc.
      await runReminders(new Date(Date.now() + 60 * 4.5 * 60_000));
      assert.equal(reminders(later.id).length, 1);
    });
  });
  describe('truy vấn DB phức tạp', () => {
    let db: Awaited<ReturnType<typeof useTestDb>>['prisma'];
    before(async () => {
      db = (await useTestDb()).prisma;
    });
    const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
    const mkEvent = async (token: string, extra: Record<string, unknown> = {}) => {
      const r = await c.call('POST', `/courses/${COURSE}/events`, { token, body: { title: 'Sự kiện DB', startAt: inMinutes(60 * 24), ...extra } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body.data;
    };
    const listIds = async (token: string, qs: string) => {
      const r = await c.call('GET', `/courses/${COURSE}/posts?${qs}`, { token });
      assert.equal(r.status, 200);
      return { ids: r.body.data.map((p: any) => p.id) as string[], meta: r.body.meta };
    };

    it('danh sách: lọc thẻ (không phân biệt hoa thường/#), lọc thể loại, ghim lên đầu, popular, phân trang và total', async () => {
      const mod = await member('qmod', 'mod');
      const u = await member('quser');
      const other = await member('qother');
      const tag = `zt${Date.now().toString(36)}`;
      const mk = async (extra: Record<string, unknown>) => newPost(u.token, { tags: [`#${tag.toUpperCase()}`], ...extra });
      const oldest = await mk({ category: 'Hỏi đáp' });
      const middle = await mk({});
      const newest = await mk({});
      const untagged = await newPost(u.token, { tags: ['#khac'] });
      // middle được thích nhiều nhất; oldest được ghim.
      await c.call('POST', `/posts/${middle.id}/like`, { token: other.token });
      await c.call('POST', `/posts/${middle.id}/like`, { token: mod.token });
      await c.call('POST', `/posts/${newest.id}/like`, { token: other.token });
      assert.equal((await c.call('POST', `/posts/${oldest.id}/pin`, { token: mod.token })).body.data.pinned, true);

      const latest = await listIds(u.token, `tag=${tag}&limit=50`);
      assert.deepEqual(latest.ids, [oldest.id, newest.id, middle.id], 'ghim trước, rồi mới nhất trước');
      assert.equal(latest.meta.total, 3);
      assert.ok(!latest.ids.includes(untagged.id));
      assert.deepEqual((await listIds(u.token, `tag=%23${tag.toUpperCase()}&limit=50&sort=popular`)).ids, [oldest.id, middle.id, newest.id]);
      assert.deepEqual((await listIds(u.token, `tag=${tag}&category=${encodeURIComponent('Hỏi đáp')}`)).ids, [oldest.id]);

      const p1 = await listIds(u.token, `tag=${tag}&limit=2&page=1`);
      const p2 = await listIds(u.token, `tag=${tag}&limit=2&page=2`);
      assert.deepEqual([...p1.ids, ...p2.ids], latest.ids);
      assert.equal(p1.meta.totalPages, 2);
      // Không lọc thẻ: cùng quy tắc sắp xếp (ghim đầu tiên), total đếm ở DB.
      const all = await listIds(u.token, 'limit=1');
      assert.equal(all.ids[0], oldest.id);
      assert.ok(all.meta.total >= 4);
    });

    it('bài ẩn: không tính vào total/thẻ phổ biến của member thường, tác giả và mod vẫn thấy', async () => {
      const author = await member('vauthor');
      const viewer = await member('vviewer');
      const mod = await member('vmod', 'mod');
      const tag = `ha${Date.now().toString(36)}`;
      const shown = await newPost(author.token, { tags: [`#${tag}`] });
      const gone = await newPost(author.token, { tags: [`#${tag}`, '#chiAnBai'] });
      assert.equal((await c.call('POST', `/posts/${gone.id}/hide`, { token: mod.token })).status, 200);

      const asViewer = await listIds(viewer.token, `tag=${tag}&limit=50`);
      assert.deepEqual(asViewer.ids, [shown.id]);
      assert.equal(asViewer.meta.total, 1);
      assert.deepEqual((await listIds(author.token, `tag=${tag}&limit=50`)).ids.sort(), [shown.id, gone.id].sort());
      assert.equal((await listIds(mod.token, `tag=${tag}&limit=50`)).meta.total, 2);

      const tags = (await c.call('GET', `/courses/${COURSE}/tags`, { token: viewer.token })).body.data as { tag: string; count: number }[];
      assert.equal(tags.find((t) => t.tag.replace('#', '').toLowerCase() === tag)?.count, 1);
      assert.ok(!tags.some((t) => t.tag.toLowerCase() === '#chianbai'));
    });

    it('thẻ phổ biến: mỗi bài chỉ tính 1 lần cho mỗi thẻ (kể cả lặp trong cùng bài), tối đa 20, sắp theo số bài', async () => {
      const u = await member('tcount');
      const key = `pop${Date.now().toString(36)}`;
      await newPost(u.token, { tags: [`#${key}`, `#${key.toUpperCase()}`] });
      await newPost(u.token, { tags: [`#${key}`] });
      const tags = (await c.call('GET', `/courses/${COURSE}/tags`, { token: u.token })).body.data as { tag: string; count: number }[];
      const hit = tags.find((t) => t.tag.replace('#', '').toLowerCase() === key)!;
      assert.equal(hit.count, 2);
      assert.ok(tags.length <= 20);
      for (let i = 1; i < tags.length; i++) assert.ok(tags[i - 1]!.count >= tags[i]!.count);
    });

    it('like: likesCount khớp số PostLike (kể cả like song song); điểm like_received và thông báo chỉ ở lần đầu mỗi (user, bài)', async () => {
      const { pointsService } = await import('../src/modules/points/points.service.js');
      const author = await member('lkauthor');
      const likers = await Promise.all([member('lk1'), member('lk2'), member('lk3'), member('lk4')]);
      const post = await newPost(author.token);
      const base = await pointsService.totalFor(COURSE, author.id, 'all');

      const rs = await Promise.all(likers.map((l) => c.call('POST', `/posts/${post.id}/like`, { token: l.token })));
      assert.ok(rs.every((r) => r.status === 200 && r.body.data.liked === true));
      assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).likesCount, 4);
      assert.equal(await db.postLike.count({ where: { postId: post.id } }), 4);
      assert.equal(await pointsService.totalFor(COURSE, author.id, 'all'), base + 4 * 2);

      // unlike -> like lại: điểm không cộng lần 2
      const l = likers[0]!;
      assert.equal((await c.call('POST', `/posts/${post.id}/like`, { token: l.token })).body.data.liked, false);
      const again = await c.call('POST', `/posts/${post.id}/like`, { token: l.token });
      assert.equal(again.body.data.liked, true);
      assert.equal(again.body.data.likesCount, 4);
      assert.equal(await pointsService.totalFor(COURSE, author.id, 'all'), base + 4 * 2);
      assert.equal(await db.postLikeNotice.count({ where: { postId: post.id } }), 4);
    });

    it('bài của thành viên minh họa (isDemo) vẫn nhận like nhưng không cộng điểm/thông báo; tên tác giả lấy từ User', async () => {
      const { pointsService } = await import('../src/modules/points/points.service.js');
      const demoId = `demo-${COURSE}-test-${Date.now().toString(36)}`;
      await db.user.create({ data: { id: demoId, email: `${demoId}@demo.sofinhub.invalid`, firstName: 'Khách', lastName: 'Minh Họa', passwordHash: '!x', isDemo: true } });
      await db.enrollment.create({ data: { userId: demoId, courseId: COURSE } });
      const post = await db.post.create({ data: { courseId: COURSE, authorId: demoId, content: 'Bài minh họa' } });
      const liker = await member('demolike');
      const before = notifications().length;
      const r = await c.call('POST', `/posts/${post.id}/like`, { token: liker.token });
      assert.equal(r.body.data.likesCount, 1);
      assert.equal(await pointsService.totalFor(COURSE, demoId, 'all'), 0);
      assert.equal(notifications().length, before);
      const view = await c.call('GET', `/posts/${post.id}`, { token: liker.token });
      assert.deepEqual(view.body.data.author, { id: demoId, name: 'Khách Minh Họa' });
    });

    it('xóa bình luận giữ commentsCount đúng và không âm', async () => {
      const author = await member('ccauthor');
      const other = await member('ccother');
      const post = await newPost(author.token);
      const cms = await Promise.all([1, 2, 3].map((i) => c.call('POST', `/posts/${post.id}/comments`, { token: other.token, body: { content: `c${i}` } })));
      assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).commentsCount, 3);
      await c.call('DELETE', `/comments/${cms[0]!.body.data.id}`, { token: other.token });
      await c.call('DELETE', `/comments/${cms[0]!.body.data.id}`, { token: other.token }); // lần 2: 404, không trừ thêm
      assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).commentsCount, 2);
      assert.equal(await db.postComment.count({ where: { postId: post.id } }), 2);
    });

    it('sức chứa an toàn đồng thời: 2 RSVP song song vào chỗ cuối -> đúng 1 người vào', async () => {
      const mod = await member('capmod', 'mod');
      const a = await member('capa');
      const b = await member('capb');
      const ev = await mkEvent(mod.token, { capacity: 1 });
      const rs = await Promise.all([a, b].map((u) => c.call('POST', `/events/${ev.id}/rsvp`, { token: u.token })));
      assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
      assert.equal(await db.eventRsvp.count({ where: { eventId: ev.id } }), 1);
    });

    it('sức chứa 3 với 8 người RSVP cùng lúc -> đúng 3 người vào', async () => {
      const mod = await member('cap3mod', 'mod');
      const users = await Promise.all(Array.from({ length: 8 }, (_, i) => member(`cap3u${i}`)));
      const ev = await mkEvent(mod.token, { capacity: 3 });
      const rs = await Promise.all(users.map((u) => c.call('POST', `/events/${ev.id}/rsvp`, { token: u.token })));
      assert.equal(rs.filter((r) => r.status === 200).length, 3);
      assert.equal(rs.filter((r) => r.status === 409).length, 5);
      assert.equal(await db.eventRsvp.count({ where: { eventId: ev.id } }), 3);
      const view = await c.call('GET', `/events/${ev.id}`, { token: users[0]!.token });
      assert.equal(view.body.data.rsvpCount, 3);
      // Một người đã vào hủy -> người khác vào được chỗ trống.
      const winner = users[rs.findIndex((r) => r.status === 200)]!;
      const loser = users[rs.findIndex((r) => r.status === 409)]!;
      assert.equal((await c.call('DELETE', `/events/${ev.id}/rsvp`, { token: winner.token })).status, 200);
      assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: loser.token })).status, 200);
    });

    it('danh sách sự kiện: rsvpCount/viewerRsvped/isPast đúng cho nhiều sự kiện một lượt', async () => {
      const mod = await member('lsmod', 'mod');
      const u = await member('lsuser');
      const e1 = await mkEvent(mod.token, { title: 'LS1' });
      const e2 = await mkEvent(mod.token, { title: 'LS2' });
      await c.call('POST', `/events/${e1.id}/rsvp`, { token: u.token });
      await c.call('POST', `/events/${e1.id}/rsvp`, { token: mod.token });
      const list = (await c.call('GET', `/courses/${COURSE}/events`, { token: u.token })).body.data as any[];
      const v1 = list.find((e) => e.id === e1.id);
      const v2 = list.find((e) => e.id === e2.id);
      assert.equal(v1.rsvpCount, 2);
      assert.equal(v1.viewerRsvped, true);
      assert.equal(v2.rsvpCount, 0);
      assert.equal(v2.viewerRsvped, false);
      assert.equal(v2.isPast, false);
      const starts = list.map((e) => new Date(e.startAt).getTime());
      assert.deepEqual(starts, [...starts].sort((x, y) => x - y), 'sắp theo giờ bắt đầu');
    });

    it('nhắc lịch không trùng: chạy song song nhiều "instance" chỉ gửi mỗi người 1 lần; remindedAt được ghi; đổi giờ thì nhắc lại', async () => {
      const mod = await member('rdmod', 'mod');
      const users = await Promise.all([member('rd1'), member('rd2'), member('rd3')]);
      const ev = await mkEvent(mod.token, { title: 'Nhắc lịch song song', startAt: inMinutes(20) });
      for (const u of users) await c.call('POST', `/events/${ev.id}/rsvp`, { token: u.token });
      const countFor = () => notifications().filter((n) => n.type === 'event_reminder' && n.body.includes('Nhắc lịch song song')).length;

      const sent = await Promise.all([runReminders(new Date()), runReminders(new Date()), runReminders(new Date())]);
      assert.equal(sent.reduce((x, y) => x + y, 0), 3);
      assert.equal(countFor(), 3);
      assert.equal(await db.eventRsvp.count({ where: { eventId: ev.id, remindedAt: { not: null } } }), 3);
      assert.equal(await runReminders(new Date()), 0);

      // Đổi giờ -> dấu đã nhắc bị xóa, nhắc lại theo giờ mới.
      const moved = await c.call('PATCH', `/events/${ev.id}`, { token: mod.token, body: { startAt: inMinutes(25) } });
      assert.equal(moved.status, 200);
      assert.equal(await db.eventRsvp.count({ where: { eventId: ev.id, remindedAt: { not: null } } }), 0);
      assert.equal(await runReminders(new Date()), 3);
      // Sự kiện đã bắt đầu không được nhắc.
      assert.equal(await runReminders(new Date(Date.now() + 2 * 60 * 60_000)), 0);
    });

    it('xóa sự kiện xóa luôn RSVP; xóa bài xóa luôn like/phiếu/bình luận (CASCADE)', async () => {
      const mod = await member('cascmod', 'mod');
      const u = await member('cascuser');
      const ev = await mkEvent(mod.token);
      await c.call('POST', `/events/${ev.id}/rsvp`, { token: u.token });
      await c.call('DELETE', `/events/${ev.id}`, { token: mod.token });
      assert.equal(await db.eventRsvp.count({ where: { eventId: ev.id } }), 0);

      const post = await newPost(mod.token, { poll: { options: ['a', 'b'] } });
      await c.call('POST', `/posts/${post.id}/like`, { token: u.token });
      await c.call('POST', `/posts/${post.id}/comments`, { token: u.token, body: { content: 'x' } });
      await c.call('POST', `/posts/${post.id}/poll/vote`, { token: u.token, body: { optionIds: [post.poll.options[0].id] } });
      await c.call('DELETE', `/posts/${post.id}`, { token: mod.token });
      const left = [
        await db.postLike.count({ where: { postId: post.id } }),
        await db.postComment.count({ where: { postId: post.id } }),
        await db.pollVote.count({ where: { postId: post.id } }),
        await db.postLikeNotice.count({ where: { postId: post.id } }),
      ];
      assert.deepEqual(left, [0, 0, 0, 0]);
    });
  });

  describe('seed vào DB (prisma/seed/posts.ts, events.ts)', () => {
    it('seed nội dung cho mọi cộng đồng + kịch bản photo; chạy lại không nhân đôi; API hiển thị đúng', async () => {
      const db = (await useTestDb()).prisma;
      const { seedAccounts, seedMemberships } = await import('../prisma/seed-base.js');
      const { seedDemoMembers } = await import('../prisma/seed/demo-members.js');
      const { seedPosts } = await import('../prisma/seed/posts.js');
      const { seedEvents } = await import('../prisma/seed/events.js');
      const { TEST_PASSWORD } = await import('../prisma/seed-accounts.js');
      const userIds = await seedAccounts(db);
      await seedMemberships(db, userIds);
      const ctx = { db, userIds };
      const run = async () => {
        await seedDemoMembers(ctx);
        await seedPosts(ctx);
        await seedEvents(ctx);
      };
      await run();
      const counts = async () => [
        await db.post.count(),
        await db.postComment.count(),
        await db.postLike.count(),
        await db.pollVote.count(),
        await db.report.count(),
        await db.communityEvent.count(),
        await db.eventRsvp.count(),
      ];
      const first = await counts();
      await run();
      assert.deepEqual(await counts(), first, 'idempotent');

      // Mọi cộng đồng có bài + sự kiện; likesCount/commentsCount khớp bản ghi.
      const courses = await db.course.count();
      assert.equal(await db.post.count({ where: { id: { startsWith: 'seed-post-' }, authorId: { startsWith: 'demo-' } } }), courses * 4);
      const mismatched = await db.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "Post" p WHERE p."likesCount" <> (SELECT count(*) FROM "PostLike" l WHERE l."postId" = p.id)
          OR p."commentsCount" <> (SELECT count(*) FROM "PostComment" c WHERE c."postId" = p.id)`;
      assert.equal(mismatched[0]!.n, 0);
      assert.ok((await db.communityEvent.count({ where: { courseId: 'yt' } })) >= 2);

      const login = async (key: string) => (await c.call('POST', '/auth/login', { body: { email: `${key}@sofinhub.test`, password: TEST_PASSWORD } })).body.data.accessToken as string;
      const [m1, m2, m3, mod] = await Promise.all([login('member1'), login('member2'), login('member3'), login('mod')]);
      const posts = async (t: string) => (await c.call('GET', `/courses/${COURSE}/posts?limit=50`, { token: t })).body.data as any[];

      const asM2 = await posts(m2);
      assert.ok(asM2[0].pinned, 'bài ghim ở đầu');
      assert.ok(asM2.some((p) => p.id === 'seed-post-photo-owner-pinned' && p.pinned));
      assert.ok(asM2.find((p) => p.id === 'seed-post-photo-m1-image').imageUrl);
      assert.ok(!asM2.some((p) => p.id === 'seed-post-photo-m1-hidden'), 'bài ẩn không hiện với member khác');
      assert.ok((await posts(m1)).some((p) => p.id === 'seed-post-photo-m1-hidden'), 'tác giả vẫn thấy');
      assert.ok((await posts(mod)).some((p) => p.id === 'seed-post-photo-m1-hidden'), 'mod vẫn thấy');
      const poll = asM2.find((p) => p.id === 'seed-post-photo-m1-poll').poll;
      assert.equal(poll.isClosed, false);
      assert.deepEqual(poll.viewerVotes, ['seed-photo-poll-o1']);
      const cms = (await c.call('GET', '/posts/seed-post-photo-m1-image/comments', { token: m1 })).body.data as any[];
      assert.ok(cms.some((x) => x.content.includes('Bố cục đẹp') && x.author.name === 'Mai Member2'));

      const open = (await c.call('GET', `/courses/${COURSE}/reports?status=open`, { token: mod })).body.data as any[];
      assert.ok(open.some((r) => r.id === 'seed-report-photo-open' && r.reporterName === 'Manh Member3'));
      const done = (await c.call('GET', `/courses/${COURSE}/reports?status=resolved`, { token: mod })).body.data as any[];
      assert.ok(done.some((r) => r.id === 'seed-report-photo-resolved' && r.action === 'hide_content'));
      assert.equal((await c.call('GET', `/courses/${COURSE}/reports`, { token: m3 })).status, 403);

      const events = (await c.call('GET', `/courses/${COURSE}/events`, { token: m2 })).body.data as any[];
      const limited = events.find((e) => e.id === 'seed-event-photo-limited');
      assert.equal(limited.capacity, 3);
      assert.equal(limited.viewerRsvped, true);
      assert.equal(limited.rsvpCount, 2);
      assert.equal(events.find((e) => e.id === 'seed-event-photo-past').isPast, true);
      const full = events.find((e) => e.id === 'seed-event-photo-full');
      assert.equal(full.rsvpCount, full.capacity);
      assert.equal((await c.call('POST', `/events/${full.id}/rsvp`, { token: m2 })).status, 409);
      assert.equal((await c.call('POST', `/events/${limited.id}/rsvp`, { token: m1 })).status, 200);
      assert.equal((await c.call('POST', `/events/${limited.id}/rsvp`, { token: m3 })).status, 409, 'chỗ cuối đã có người');
      assert.equal((await c.call('POST', '/events/seed-event-photo-past/rsvp', { token: m3 })).status, 400);
    });
  });
});
