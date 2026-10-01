import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';
import { createMemoryShared } from '../src/infra/shared-state.js';
import {
  createNotificationsService,
  notificationWriteRetry,
  defaultPreferences,
  type Notification,
} from '../src/modules/notifications/notifications.service.js';
import type { NotificationsRepository } from '../src/modules/notifications/notifications.repository.js';
import type { NotificationPreferences } from '../src/modules/notifications/notifications.types.js';

/** Repo giả trong RAM, có thể bắt "lỗi N lần đầu" để kiểm retry / thất bại hẳn. */
function fakeRepo(opts: { failFirst?: number } = {}) {
  const rows: Notification[] = [];
  const prefs = new Map<string, NotificationPreferences>();
  let failLeft = opts.failFirst ?? 0;
  let addCalls = 0;
  const repo: NotificationsRepository = {
    async add(n) {
      addCalls++;
      if (failLeft > 0) {
        failLeft--;
        throw new Error('DB tạm thời lỗi');
      }
      rows.push(n);
    },
    async list() {
      return { items: [...rows], total: rows.length };
    },
    async unreadCount() {
      return rows.length;
    },
    async markRead() {
      return undefined;
    },
    async remove() {
      return false;
    },
    async markAllRead() {
      return 0;
    },
    async all() {
      return [...rows];
    },
    async getPrefs(userId) {
      return prefs.get(userId);
    },
    async setPrefs(userId, p) {
      prefs.set(userId, p);
    },
  };
  return { repo, rows, prefs, addCalls: () => addCalls, failAlways: () => (failLeft = Infinity) };
}

const own = () => {
  const st = createMemoryShared();
  return { shared: () => st };
};

const input = (userId: string, title = 'x') => ({ userId, type: 'system' as const, title, body: 'b' });

describe('thông báo: độ bền ghi nền (AUDIT §6.3)', () => {
  const saved = { ...notificationWriteRetry };
  before(() => {
    notificationWriteRetry.baseMs = 1;
    notificationWriteRetry.attempts = 3;
  });
  after(() => Object.assign(notificationWriteRetry, saved));

  it('lỗi tạm thời được retry và cuối cùng ghi được (không mất thông báo)', async () => {
    const f = fakeRepo({ failFirst: 2 });
    const svc = createNotificationsService(f.repo, own());
    svc.notify(input('u1'));
    await svc.flush();
    assert.equal(f.rows.length, 1);
    assert.equal(f.addCalls(), 3);
    assert.equal(svc.deadLetters().length, 0);
  });

  it('thất bại hẳn: không nuốt im lặng — vào thư chết + gọi onWriteFailed (để nhả cờ chống-trùng)', async () => {
    const f = fakeRepo({ failFirst: 99 });
    const svc = createNotificationsService(f.repo, own());
    const failed: string[] = [];
    const origErr = console.error;
    console.error = () => undefined;
    try {
      const n = svc.notify(input('u1'), { onWriteFailed: (x) => void failed.push(x.id) });
      await svc.flush();
      assert.deepEqual(failed, [n.id]);
      assert.equal(svc.deadLetters().length, 1);
      assert.equal(f.rows.length, 0);
    } finally {
      console.error = origErr;
    }
  });

  it('KHÔNG có thông báo ma: SSE chỉ phát SAU khi hàng đã commit; ghi hỏng thì không phát', async () => {
    const f = fakeRepo();
    const svc = createNotificationsService(f.repo, own());
    const seenAtEmit: boolean[] = [];
    svc.onNew((n) => seenAtEmit.push(f.rows.some((r) => r.id === n.id)));
    svc.notify(input('u1', 'ok'));
    assert.equal(seenAtEmit.length, 0, 'chưa commit thì chưa phát');
    await svc.flush();
    assert.deepEqual(seenAtEmit, [true], 'phát khi hàng đã nằm trong DB');

    const bad = fakeRepo({ failFirst: 99 });
    const svc2 = createNotificationsService(bad.repo, own());
    let emitted = 0;
    svc2.onNew(() => emitted++);
    const origErr = console.error;
    console.error = () => undefined;
    try {
      svc2.notify(input('u1'));
      await svc2.flush();
    } finally {
      console.error = origErr;
    }
    assert.equal(emitted, 0, 'ghi hỏng => không có thông báo ma');
  });

  it('thông báo bị tắt theo preference thì không ghi, không phát', async () => {
    const f = fakeRepo();
    const svc = createNotificationsService(f.repo, own());
    const prefs = defaultPreferences();
    prefs.types.post_liked = false;
    f.prefs.set('u1', prefs);
    let emitted = 0;
    svc.onNew(() => emitted++);
    svc.notify({ userId: 'u1', type: 'post_liked', title: 't', body: 'b' });
    await svc.flush();
    assert.equal(f.rows.length, 0);
    assert.equal(emitted, 0);
  });
});

describe('thông báo: nhiều instance dùng state chia sẻ', () => {
  it('A tạo thông báo => listener SSE ở B nhận (fan-out qua pub/sub); thông báo chỉ ghi 1 lần', async () => {
    const st = createMemoryShared();
    const f = fakeRepo();
    const a = createNotificationsService(f.repo, { shared: () => st });
    const b = createNotificationsService(f.repo, { shared: () => st });
    const gotB: Notification[] = [];
    b.onNew((n) => gotB.push(n));
    a.notify(input('u1', 'từ A'));
    await a.flush();
    assert.equal(gotB.length, 1);
    assert.equal(gotB[0]!.title, 'từ A');
    assert.equal(f.rows.length, 1);
  });

  it('đổi preference ở A => cache preference ở B bị vô hiệu ngay (không chờ TTL)', async () => {
    const st = createMemoryShared();
    const f = fakeRepo();
    const a = createNotificationsService(f.repo, { shared: () => st });
    const b = createNotificationsService(f.repo, { shared: () => st });
    // B nạp cache preference (mặc định: bật).
    b.notify({ userId: 'u9', type: 'post_liked', title: '1', body: 'b' });
    await b.flush();
    assert.equal(f.rows.length, 1);
    // A tắt post_liked.
    await a.updatePreferences('u9', { types: { post_liked: false } } as never);
    b.notify({ userId: 'u9', type: 'post_liked', title: '2', body: 'b' });
    await b.flush();
    assert.equal(f.rows.length, 1, 'B phải thấy preference mới ngay, không ghi thêm');
  });

  it('vé SSE mint ở A redeem được ở B, đúng một lần', async () => {
    const st = createMemoryShared();
    const a = createNotificationsService(fakeRepo().repo, { shared: () => st });
    const b = createNotificationsService(fakeRepo().repo, { shared: () => st });
    const { ticket } = await a.issueStreamTicket('u-1');
    assert.equal(await b.consumeStreamTicket(ticket), 'u-1');
    assert.equal(await a.consumeStreamTicket(ticket), undefined);
  });
});

describe('thông báo + cờ chống-trùng (DB thật)', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const COURSE = 'photo';
  const saved = { ...notificationWriteRetry };
  let repoObj: typeof import('../src/modules/notifications/notifications.repository.js').prismaNotificationsRepository;
  let realAdd: NotificationsRepository['add'];
  let flushNotifications: () => Promise<void>;
  let db: Awaited<ReturnType<typeof import('./helpers.js').useTestDb>>['prisma'];

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    notificationWriteRetry.baseMs = 1;
    notificationWriteRetry.attempts = 2;
    ({ prismaNotificationsRepository: repoObj } = await import('../src/modules/notifications/notifications.repository.js'));
    ({ flushNotifications } = await import('../src/modules/notifications/notifications.service.js'));
    db = (await (await import('./helpers.js')).useTestDb()).prisma;
    realAdd = repoObj.add;
  });
  after(async () => {
    repoObj.add = realAdd;
    Object.assign(notificationWriteRetry, saved);
    await server.close();
  });

  async function member(prefix: string, role?: 'mod') {
    const u = await c.registerUser(prefix);
    assert.equal((await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token })).status, 200);
    if (role) await (await import('../src/modules/enrollments/enrollments.service.js')).enrollmentService.setRole(u.id, COURSE, role);
    return u;
  }
  const breakWrites = () => {
    repoObj.add = async () => {
      throw new Error('DB sập');
    };
  };
  const fixWrites = () => {
    repoObj.add = realAdd;
  };
  const quiet = async <T>(fn: () => Promise<T>) => {
    const o = console.error;
    console.error = () => undefined;
    try {
      return await fn();
    } finally {
      console.error = o;
    }
  };

  it('nhắc lịch: ghi thông báo hỏng hẳn => cờ remindedAt được nhả, lượt sau nhắc lại (không mất nhắc lịch)', async () => {
    const { runEventRemindersOnce } = await import('../src/modules/events/events.reminders.js');
    const mod = await member('durmod', 'mod');
    const guest = await member('durguest');
    const ev = (
      await c.call('POST', `/courses/${COURSE}/events`, { token: mod.token, body: { title: 'Nhắc bền', startAt: new Date(Date.now() + 30 * 60_000).toISOString() } })
    ).body.data;
    assert.equal((await c.call('POST', `/events/${ev.id}/rsvp`, { token: guest.token })).status, 200);

    breakWrites();
    await quiet(async () => {
      await runEventRemindersOnce(new Date());
      await flushNotifications();
    });
    const rsvp = await db.eventRsvp.findFirst({ where: { eventId: ev.id, userId: guest.id } });
    assert.equal(rsvp?.remindedAt, null, 'cờ phải được nhả để không mất nhắc lịch');
    assert.equal(await db.notification.count({ where: { userId: guest.id, type: 'event_reminder' } }), 0);

    fixWrites();
    await runEventRemindersOnce(new Date());
    await flushNotifications();
    assert.equal(await db.notification.count({ where: { userId: guest.id, type: 'event_reminder' } }), 1, 'lượt sau nhắc được');
    await runEventRemindersOnce(new Date());
    await flushNotifications();
    assert.equal(await db.notification.count({ where: { userId: guest.id, type: 'event_reminder' } }), 1, 'vẫn chỉ một lần');
  });

  it('like: ghi thông báo hỏng hẳn => PostLikeNotice được nhả, like lại thì tác giả vẫn được báo', async () => {
    const author = await member('duraut');
    const liker = await member('durlik');
    const post = (await c.call('POST', `/courses/${COURSE}/posts`, { token: author.token, body: { content: 'Bài bền' } })).body.data;

    breakWrites();
    await quiet(async () => {
      assert.equal((await c.call('POST', `/posts/${post.id}/like`, { token: liker.token })).status, 200); // like
      await flushNotifications();
    });
    assert.equal(await db.postLikeNotice.count({ where: { postId: post.id, userId: liker.id } }), 0, 'cờ chống-trùng phải được nhả');
    assert.equal(await db.notification.count({ where: { userId: author.id, type: 'post_liked' } }), 0);

    fixWrites();
    await c.call('POST', `/posts/${post.id}/like`, { token: liker.token }); // unlike
    await c.call('POST', `/posts/${post.id}/like`, { token: liker.token }); // like lại
    await flushNotifications();
    assert.equal(await db.notification.count({ where: { userId: author.id, type: 'post_liked' } }), 1);
  });
});
