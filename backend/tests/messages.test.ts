import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'sofinhub-msg-uploads-'));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);

describe('tin nhắn 1-1', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let origin: string;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    origin = server.baseUrl.replace(/\/api$/, '');
  });
  after(() => server.close());

  /** Tạo 2 user cùng tham gia cộng đồng `photo`. */
  async function pair() {
    const a = await c.registerUser('msgA');
    const b = await c.registerUser('msgB');
    for (const u of [a, b]) await c.call('POST', '/courses/photo/enroll', { token: u.token });
    return { a, b };
  }
  async function unreadOf(prisma: any, convId: string, userId: string) {
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: convId } });
    const readSeq = conv.userAId === userId ? conv.readSeqA : conv.readSeqB;
    return prisma.message.count({ where: { conversationId: convId, senderId: { not: userId }, seq: { gt: readSeq }, deletedAt: null } });
  }
  const open = (token: string, userId: string) => c.call('POST', '/conversations', { token, body: { userId } });
  const send = (token: string, convId: string, content: string, attachments?: unknown[]) =>
    c.call('POST', `/conversations/${convId}/messages`, { token, body: { content, attachments } });

  it('401 khi thiếu token ở mọi endpoint chính', async () => {
    for (const [m, p] of [
      ['POST', '/conversations'],
      ['GET', '/conversations'],
      ['GET', '/conversations/x/messages'],
      ['POST', '/conversations/x/messages'],
      ['POST', '/conversations/x/read'],
      ['DELETE', '/messages/x'],
      ['GET', '/messages/unread-count'],
      ['POST', '/messages/stream-ticket'],
      ['GET', '/messages/stream'],
      ['POST', '/users/x/block'],
      ['DELETE', '/users/x/block'],
      ['GET', '/me/blocks'],
    ] as const) {
      assert.equal((await c.call(m, p)).status, 401, `${m} ${p}`);
    }
  });

  it('mở cuộc trò chuyện: idempotent, không nhắn chính mình, người lạ, không chung cộng đồng', async () => {
    const { a, b } = await pair();
    assert.equal((await open(a.token, a.id)).status, 400);
    assert.equal((await open(a.token, 'khong-co-user')).status, 404);
    assert.equal((await c.call('POST', '/conversations', { token: a.token, body: {} })).status, 400);

    const r1 = await open(a.token, b.id);
    assert.equal(r1.status, 201);
    assert.equal(r1.body.data.other.id, b.id);
    const r2 = await open(b.token, a.id); // chiều ngược lại vẫn ra cùng cuộc trò chuyện
    assert.equal(r2.status, 200);
    assert.equal(r2.body.data.id, r1.body.data.id);

    const stranger = await c.registerUser('msgS'); // chưa tham gia cộng đồng nào
    assert.equal((await open(a.token, stranger.id)).status, 403);
  });

  it('gửi, danh sách, chưa đọc, đánh dấu đã đọc, phân trang cursor', async () => {
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const r = await send(a.token, conv, `tin ${i}`);
      assert.equal(r.status, 201);
      ids.push(r.body.data.id);
    }

    assert.equal((await c.call('GET', '/messages/unread-count', { token: b.token })).body.data.unreadCount, 5);
    assert.equal((await c.call('GET', '/messages/unread-count', { token: a.token })).body.data.unreadCount, 0);

    const list = await c.call('GET', '/conversations', { token: b.token });
    const item = list.body.data.find((x: any) => x.id === conv);
    assert.equal(item.unreadCount, 5);
    assert.equal(item.lastMessage.content, 'tin 5');
    assert.equal(item.other.id, a.id);

    const p1 = await c.call('GET', `/conversations/${conv}/messages?limit=2`, { token: b.token });
    assert.deepEqual(p1.body.data.map((m: any) => m.content), ['tin 4', 'tin 5']);
    assert.equal(p1.body.meta.hasMore, true);
    const p2 = await c.call('GET', `/conversations/${conv}/messages?limit=2&before=${p1.body.data[0].id}`, { token: b.token });
    assert.deepEqual(p2.body.data.map((m: any) => m.content), ['tin 2', 'tin 3']);
    const p3 = await c.call('GET', `/conversations/${conv}/messages?limit=10&before=${p2.body.data[0].id}`, { token: b.token });
    assert.deepEqual(p3.body.data.map((m: any) => m.content), ['tin 1']);
    assert.equal(p3.body.meta.hasMore, false);
    assert.equal((await c.call('GET', `/conversations/${conv}/messages?before=khong-co`, { token: b.token })).status, 400);

    assert.equal((await c.call('POST', `/conversations/${conv}/read`, { token: b.token })).status, 200);
    assert.equal((await c.call('GET', '/messages/unread-count', { token: b.token })).body.data.unreadCount, 0);
  });

  it('sắp xếp danh sách cuộc trò chuyện theo hoạt động gần nhất', async () => {
    const { a, b } = await pair();
    const d = await c.registerUser('msgC');
    await c.call('POST', '/courses/photo/enroll', { token: d.token });
    const c1 = (await open(a.token, b.id)).body.data.id;
    const c2 = (await open(a.token, d.id)).body.data.id;
    await send(a.token, c1, 'cũ');
    await new Promise((r) => setTimeout(r, 5));
    await send(a.token, c2, 'mới');
    const list = (await c.call('GET', '/conversations', { token: a.token })).body.data.map((x: any) => x.id);
    assert.deepEqual(list.slice(0, 2), [c2, c1]);
  });

  it('người thứ ba không truy cập được cuộc trò chuyện (404)', async () => {
    const { a, b } = await pair();
    const t = await c.registerUser('msgT');
    const conv = (await open(a.token, b.id)).body.data.id as string;
    const m = (await send(a.token, conv, 'riêng tư')).body.data.id as string;
    assert.equal((await c.call('GET', `/conversations/${conv}/messages`, { token: t.token })).status, 404);
    assert.equal((await send(t.token, conv, 'chen ngang')).status, 404);
    assert.equal((await c.call('POST', `/conversations/${conv}/read`, { token: t.token })).status, 404);
    assert.equal((await c.call('DELETE', `/messages/${m}`, { token: t.token })).status, 404);
    assert.equal((await c.call('GET', '/conversations', { token: t.token })).body.data.length, 0);
    assert.equal((await c.call('GET', `/conversations/khong-co/messages`, { token: a.token })).status, 404);
  });

  it('validate nội dung: rỗng, quá 2000 ký tự, HTML, tệp đính kèm URL ngoài (400)', async () => {
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    assert.equal((await send(a.token, conv, '   ')).status, 400);
    assert.equal((await send(a.token, conv, 'x'.repeat(2001))).status, 400);
    assert.equal((await send(a.token, conv, '<script>alert(1)</script>')).status, 400);
    assert.equal((await send(a.token, conv, 'a < b và c > d')).status, 201); // dấu so sánh thường vẫn hợp lệ
    const ext = [{ url: 'https://evil.example/x.png', name: 'x.png', contentType: 'image/png', size: 1 }];
    assert.equal((await send(a.token, conv, 'hi', ext)).status, 400);
    const fake = [{ url: `/api/files/${'a'.repeat(32)}.png`, name: 'x.png', contentType: 'image/png', size: 1 }];
    assert.equal((await send(a.token, conv, 'hi', fake)).status, 400); // key không tồn tại
  });

  it('đính kèm file đã upload của chính mình; file của người khác bị từ chối', async () => {
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    const upload = async (token: string) => {
      const p = await c.call('POST', '/uploads/presign', {
        token,
        body: { filename: 'a.png', contentType: 'image/png', size: PNG.length, purpose: 'message_attachment' },
      });
      const put = await fetch(origin + p.body.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: PNG });
      assert.equal(put.status, 200);
      return p.body.data.fileUrl as string;
    };
    const mine = await upload(a.token);
    const theirs = await upload(b.token);
    const att = (url: string) => [{ url, name: 'anh.png', contentType: 'x', size: 1 }];
    const ok = await send(a.token, conv, 'xem ảnh', att(mine));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.attachments[0].contentType, 'image/png'); // lấy từ server, không tin client
    assert.equal(ok.body.data.attachments[0].size, PNG.length);
    assert.equal((await send(a.token, conv, 'ăn cắp', att(theirs))).status, 400);
  });

  it('thu hồi tin nhắn: chỉ người gửi; nội dung thành "Tin nhắn đã bị thu hồi"', async () => {
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    const m = (await send(a.token, conv, 'bí mật')).body.data.id as string;
    assert.equal((await c.call('DELETE', `/messages/${m}`, { token: b.token })).status, 403);
    assert.equal((await c.call('DELETE', `/messages/${m}`, { token: a.token })).status, 200);
    assert.equal((await c.call('DELETE', `/messages/khong-co`, { token: a.token })).status, 404);
    const msgs = (await c.call('GET', `/conversations/${conv}/messages`, { token: b.token })).body.data;
    assert.equal(msgs[0].content, 'Tin nhắn đã bị thu hồi');
    assert.equal(msgs[0].deleted, true);
    assert.equal((await c.call('GET', '/messages/unread-count', { token: b.token })).body.data.unreadCount, 0);
  });

  it('chặn người dùng: hai chiều đều không nhắn được; bỏ chặn thì nhắn lại được', async () => {
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    assert.equal((await c.call('POST', `/users/${a.id}/block`, { token: a.token })).status, 400);
    assert.equal((await c.call('POST', `/users/khong-co/block`, { token: a.token })).status, 404);
    assert.equal((await c.call('POST', `/users/${b.id}/block`, { token: a.token })).status, 200);
    assert.equal((await c.call('POST', `/users/${b.id}/block`, { token: a.token })).status, 200); // idempotent

    const blocks = await c.call('GET', '/me/blocks', { token: a.token });
    assert.deepEqual(blocks.body.data.map((x: any) => x.id), [b.id]);

    assert.equal((await send(a.token, conv, 'chiều đi')).status, 403);
    assert.equal((await send(b.token, conv, 'chiều về')).status, 403);
    assert.equal((await open(b.token, a.id)).status, 403);

    assert.equal((await c.call('DELETE', `/users/${b.id}/block`, { token: a.token })).status, 200);
    assert.equal((await c.call('GET', '/me/blocks', { token: a.token })).body.data.length, 0);
    assert.equal((await send(b.token, conv, 'hòa giải')).status, 201);
  });

  it('thông báo message_received được gộp: 1 / cuộc trò chuyện / 5 phút cho người offline', async () => {
    const { notificationStore } = await import('../src/modules/notifications/notifications.service.js');
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    for (const t of ['một', 'hai', 'ba']) await send(a.token, conv, t);
    const mine = notificationStore.all().filter((n) => n.userId === b.id && n.type === 'message_received');
    assert.equal(mine.length, 1);
    assert.equal(notificationStore.all().filter((n) => n.userId === a.id && n.type === 'message_received').length, 0);
  });

  it('bền vững: hội thoại/tin nhắn/chặn nằm trong DB thật, cặp userAId < userBId', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const { a, b } = await pair();
    const conv = (await open(b.token, a.id)).body.data.id as string; // mở từ phía "lớn" hay "nhỏ" đều ra 1 dòng
    const row = await prisma.conversation.findUniqueOrThrow({ where: { id: conv } });
    const [lo, hi] = await prisma.$queryRaw<{ lt: boolean }[]>`SELECT (${row.userAId}::text < ${row.userBId}::text) AS lt`;
    assert.ok(lo!.lt);
    assert.deepEqual([row.userAId, row.userBId].sort(), [a.id, b.id].sort());
    assert.equal(hi, undefined);
    const m = (await send(a.token, conv, 'lưu DB')).body.data.id as string;
    assert.equal((await prisma.message.findUniqueOrThrow({ where: { id: m } })).content, 'lưu DB');
    await c.call('DELETE', `/messages/${m}`, { token: a.token });
    const gone = await prisma.message.findUniqueOrThrow({ where: { id: m } });
    assert.equal(gone.content, '');
    assert.ok(gone.deletedAt);
    await c.call('POST', `/users/${b.id}/block`, { token: a.token });
    assert.equal(await prisma.userBlock.count({ where: { blockerId: a.id, targetId: b.id } }), 1);
  });

  it('race: gửi song song không trùng seq, không mất tin, chưa đọc đúng, phân trang cursor theo seq đủ và đúng thứ tự', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    const N = 24;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => send(i % 2 === 0 ? a.token : b.token, conv, `song song ${i}`)),
    );
    assert.ok(results.every((r) => r.status === 201));
    const rows = await prisma.message.findMany({ where: { conversationId: conv }, orderBy: { seq: 'asc' } });
    assert.equal(rows.length, N);
    assert.equal(new Set(rows.map((r) => r.seq)).size, N); // seq duy nhất

    // Duyệt ngược bằng cursor: gộp lại phải đủ N tin, không lặp, seq tăng dần.
    const seen: string[] = [];
    let before: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const r = await c.call('GET', `/conversations/${conv}/messages?limit=5${before ? `&before=${before}` : ''}`, { token: a.token });
      seen.unshift(...r.body.data.map((m: any) => m.id));
      if (!r.body.meta.hasMore) break;
      before = r.body.meta.nextBefore;
    }
    assert.deepEqual(seen, rows.map((r) => r.id));

    // Chưa đọc trả về khớp truy vấn độc lập; sau markRead = 0.
    for (const u of [a, b]) {
      const api = (await c.call('GET', '/messages/unread-count', { token: u.token })).body.data.unreadCount;
      assert.equal(api, await unreadOf(prisma, conv, u.id));
    }
    assert.ok((await unreadOf(prisma, conv, b.id)) > 0 || (await unreadOf(prisma, conv, a.id)) > 0);
    await c.call('POST', `/conversations/${conv}/read`, { token: a.token });
    assert.equal((await c.call('GET', '/messages/unread-count', { token: a.token })).body.data.unreadCount, 0);
  });

  it('rate limit gửi tin (429) khi được bật', async () => {
    const { messageRateLimit } = await import('../src/modules/messages/messages.service.js');
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;
    const old = messageRateLimit.max;
    messageRateLimit.max = 2;
    try {
      assert.equal((await send(a.token, conv, '1')).status, 201);
      assert.equal((await send(a.token, conv, '2')).status, 201);
      assert.equal((await send(a.token, conv, '3')).status, 429);
    } finally {
      messageRateLimit.max = old;
    }
  });

  it('SSE: vé dùng 1 lần, nhận event message realtime, người online không bị tạo thông báo', async () => {
    const { notificationStore } = await import('../src/modules/notifications/notifications.service.js');
    const { a, b } = await pair();
    const conv = (await open(a.token, b.id)).body.data.id as string;

    const t = (await c.call('POST', '/messages/stream-ticket', { token: b.token })).body.data.ticket as string;
    const ac = new AbortController();
    const res = await fetch(`${origin}/api/messages/stream?ticket=${t}`, { signal: ac.signal });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);

    // vé đã dùng → 401; vé bậy → 401
    assert.equal((await fetch(`${origin}/api/messages/stream?ticket=${t}`)).status, 401);
    assert.equal((await fetch(`${origin}/api/messages/stream?ticket=bay`)).status, 401);

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const readUntil = async (needle: string) => {
      while (!buf.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
      }
      return buf.includes(needle);
    };
    assert.ok(await readUntil('event: ready'));

    await send(a.token, conv, 'realtime nhé');
    assert.ok(await readUntil('event: message'));
    assert.ok(buf.includes('realtime nhé'));
    assert.equal(notificationStore.all().filter((n) => n.userId === b.id && n.type === 'message_received').length, 0);

    // Bearer trực tiếp cũng được
    const ac2 = new AbortController();
    const res2 = await fetch(`${origin}/api/messages/stream`, { headers: { Authorization: `Bearer ${a.token}` }, signal: ac2.signal });
    assert.equal(res2.status, 200);
    ac2.abort();
    ac.abort();
  });
});
