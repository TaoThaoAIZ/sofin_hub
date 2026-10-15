import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

process.env.PLATFORM_ADMIN_EMAILS = 'pa-chatbot-load@test.local';
process.env.CHATBOT_FAKE_MODEL = '1';
process.env.CHATBOT_CODEX_HOME = (await import('node:path')).join((await import('node:os')).tmpdir(), `sofinhub-codex-load-${process.pid}`);

type U = { token: string; id: string; email: string };

/**
 * Nhiều người dùng chatbot CÙNG LÚC (10-50 người — chatbot.md). Model giả có độ trễ (mô phỏng Codex), hàng đợi giới hạn song song
 * chung (chatbot.limiter.ts) thu nhỏ thời gian để test nhanh. Kiểm tra: không vượt số lượt song song, mọi người đều nhận phản hồi
 * (trả lời hoặc câu "đang bận" — không lỗi 5xx, không mất tin), vị trí hàng đợi được báo qua SSE, câu mẫu không bị kẹt hàng.
 */
describe('chatbot — nhiều người dùng cùng lúc', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let fake: typeof import('../src/modules/chatbot/chatbot.fake-model.js');
  let limiter: typeof import('../src/modules/chatbot/chatbot.model.js').llmLimiter;
  let users: U[] = [];
  let seq = 0;

  const start = async (u: U, base = '/chatbot') => {
    const r = await c.call('POST', `${base}/conversations`, { token: u.token });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data.conversation.id as string;
  };
  const ask = (u: U, conv: string, text: string, base = '/chatbot') => c.call('POST', `${base}/conversations/${conv}/messages`, { token: u.token, body: { text } });
  const time = async <T>(fn: () => Promise<T>) => {
    const t0 = Date.now();
    const r = await fn();
    return { r, ms: Date.now() - t0 };
  };

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    fake = await import('../src/modules/chatbot/chatbot.fake-model.js');
    ({ llmLimiter: limiter } = await import('../src/modules/chatbot/chatbot.model.js'));
    const { seedChatbot } = await import('../prisma/seed/chatbot.js');
    await seedChatbot({ db: db.prisma, userIds: {} as never });
    users = await Promise.all(Array.from({ length: 50 }, (_, i) => c.registerUser(`load${i}`)));
  });
  after(() => server.close());
  beforeEach(() => {
    fake.resetFake();
    limiter.configure({ max: 3, waitMs: 60_000 });
  });

  it('50 người hỏi cùng lúc: ai cũng được trả lời, không bao giờ quá 3 lượt AI song song, mỗi hội thoại đúng 1 hỏi + 1 đáp', async () => {
    fake.setFakeDelay(150);
    const convs = await Promise.all(users.map((u) => start(u)));
    const { r: results, ms } = await time(() => Promise.all(users.map((u, i) => ask(u, convs[i]!, 'tool grok làm được gì'))));
    assert.deepEqual([...new Set(results.map((x) => x.status))], [200]);
    assert.ok(results.every((x) => x.body.data.message.answerSource === 'agent'), 'không ai bị trả lời "đang bận" khi hàng chờ đủ dài');
    const st = limiter.stats();
    assert.ok(st.maxActiveSeen <= 3, `song song tối đa ${st.maxActiveSeen}`);
    assert.equal(st.busyRejected, 0);
    // 50 lượt / 3 song song * 150ms ≈ 2.5s (cộng chi phí HTTP/DB) — không chạy tuần tự (50 * 150ms = 7.5s).
    assert.ok(ms < 7_500, `mất ${ms}ms`);
    const counts = await db.prisma.chatbotMessage.groupBy({ by: ['conversationId', 'role'], where: { conversationId: { in: convs } }, _count: true });
    assert.equal(counts.length, 100);
    assert.ok(counts.every((x) => x._count === 1));
  });

  it('quá tải (chờ quá hạn): người đến sau nhận câu "đang bận" (200, không 5xx), không mất tin; người đến trước vẫn được trả lời', async () => {
    fake.setFakeDelay(400);
    limiter.configure({ max: 2, waitMs: 500 });
    const group = users.slice(0, 12);
    const convs = await Promise.all(group.map((u) => start(u)));
    const results = await Promise.all(group.map((u, i) => ask(u, convs[i]!, 'tool veo làm được gì')));
    assert.deepEqual([...new Set(results.map((x) => x.status))], [200], 'không có lỗi 5xx / 409');
    const sources = results.map((x) => x.body.data.message.answerSource as string);
    const answered = sources.filter((s) => s === 'agent').length;
    const busy = sources.filter((s) => s === 'error').length;
    assert.equal(answered + busy, 12);
    assert.ok(answered >= 2 && busy >= 1, `trả lời ${answered}, bận ${busy}`);
    assert.ok(results.filter((x) => x.body.data.message.answerSource === 'error').every((x) => /nhiều bạn hỏi cùng lúc/.test(x.body.data.message.content)));
    assert.equal(limiter.stats().busyRejected, busy);
    assert.ok(limiter.stats().maxActiveSeen <= 2);
  });

  it('SSE báo vị trí hàng đợi (event queued) cho người phải chờ', async () => {
    fake.setFakeDelay(300);
    limiter.configure({ max: 1, waitMs: 10_000 });
    const [a, b, d] = users.slice(20, 23) as [U, U, U];
    const [ca, cb, cd] = await Promise.all([start(a), start(b), start(d)]);
    const sse = (u: U, conv: string) => c.call('POST', `/chatbot/conversations/${conv}/messages`, { token: u.token, body: { text: 'tool grok làm được gì' }, headers: { Accept: 'text/event-stream' } });
    const [ra, rb, rd] = await Promise.all([sse(a, ca), sse(b, cb), sse(d, cd)]);
    const events = (r: { body: string }) => [...String(r.body).matchAll(/event: (\w+)\ndata: (.*)\n/g)].map((m) => ({ event: m[1], data: JSON.parse(m[2]!) }));
    const all = [ra, rb, rd].map(events);
    assert.ok(all.every((ev) => ev.at(-1)?.event === 'done'), 'ai cũng nhận được done');
    const queued = all.flatMap((ev) => ev.filter((e) => e.event === 'queued').map((e) => e.data.ahead as number));
    assert.ok(queued.includes(0), `có người được báo "đứng đầu hàng": ${JSON.stringify(queued)}`);
    assert.ok(queued.includes(1), 'có người được báo còn 1 người phía trước');
  });

  it('câu khớp câu mẫu không xếp hàng: vẫn trả lời ngay khi hàng đợi AI đang đầy', async () => {
    fake.setFakeDelay(1_500);
    limiter.configure({ max: 1, waitMs: 20_000 });
    const busyUsers = users.slice(30, 34);
    const convs = await Promise.all(busyUsers.map((u) => start(u)));
    const pending = Promise.all(busyUsers.map((u, i) => ask(u, convs[i]!, 'tool grok làm được gì')));
    await new Promise((r) => setTimeout(r, 200));
    const q = users[40]!;
    const { r, ms } = await time(async () => ask(q, await start(q), 'quên mật khẩu thì làm sao'));
    assert.equal(r.body.data.message.answerSource, 'qa_direct');
    assert.ok(ms < 1_000, `câu mẫu mất ${ms}ms trong lúc hàng đợi đầy`);
    await pending;
  });

  it('bot cộng đồng + bot Tào dùng CHUNG hàng đợi: 25 thành viên + 15 người hỏi Tào cùng lúc, không vượt giới hạn, ai cũng được trả lời', async () => {
    fake.setFakeDelay(120);
    limiter.configure({ max: 3, waitMs: 60_000 });
    const owner = users[49]!;
    const id = `load-${Date.now().toString(36)}${seq++}`;
    await db.prisma.community.create({
      data: {
        id, title: 'Cộng đồng tải', description: 'Học Python', category: 'tech' as never, thumbnail: '/x.webp', instructorName: 'A', instructorRole: 'B', priceCents: 0, pricing: 'free', ownerId: owner.id,
        rules: [{ title: 'Không quảng cáo', body: 'Không đăng quảng cáo' }],
      },
    });
    await db.prisma.enrollment.create({ data: { userId: owner.id, communityId: id, role: 'owner' } });
    await db.prisma.hostingPlan.create({ data: { communityId: id, ownerId: owner.id, planKey: 'pro', priceAmount: 1, currency: 'VND', status: 'active' } });
    await db.prisma.communityBot.create({ data: { communityId: id, enabled: true, freeDailyMessages: 5 } });
    const members = users.slice(0, 25);
    await db.prisma.enrollment.createMany({ data: members.map((u) => ({ userId: u.id, communityId: id })) });
    const tao = users.slice(25, 40);
    const base = `/communities/${id}/bot`;
    const [mc, tc] = await Promise.all([Promise.all(members.map((u) => start(u, base))), Promise.all(tao.map((u) => start(u)))]);
    const results = await Promise.all([
      ...members.map((u, i) => ask(u, mc[i]!, 'nội quy cộng đồng là gì', base)),
      ...tao.map((u, i) => ask(u, tc[i]!, 'tool veo làm được gì')),
    ]);
    assert.deepEqual([...new Set(results.map((x) => x.status))], [200]);
    assert.ok(results.every((x) => x.body.data.message.answerSource === 'agent'));
    assert.ok(limiter.stats().maxActiveSeen <= 3);
    // Giới hạn tin/ngày tính đúng cho từng thành viên dù gửi đồng thời.
    assert.ok(results.slice(0, 25).every((x) => x.body.data.quota.remaining === 4));
  });
});
