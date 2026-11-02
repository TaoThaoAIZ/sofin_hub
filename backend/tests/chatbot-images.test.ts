import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

const ADMIN_EMAIL = 'pa-chatbot-img@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
process.env.CHATBOT_FAKE_MODEL = '1';
process.env.CHATBOT_TRACE_CONTEXT = '1';
process.env.CHATBOT_CODEX_HOME = join(tmpdir(), `sofinhub-codex-img-test-${process.pid}`);
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'sofinhub-chatbot-img-'));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
type U = { token: string; id: string; email: string };

/** Khách gửi ảnh cho Tào (chatbot.images.ts): model đọc ảnh => mô tả ghép vào tin rồi đi luồng chữ. */
describe('chatbot: gửi ảnh', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let origin: string;
  let admin: U;
  let fake: typeof import('../src/modules/chatbot/chatbot.fake-model.js');
  let prisma: typeof import('../src/db/prisma.js').prisma;
  const ADM = (method: string, path: string, body?: unknown) => c.call(method, `/admin/support/chatbot${path}`, { token: admin.token, body });

  const start = async (u: U) => (await c.call('POST', '/chatbot/conversations', { token: u.token })).body.data.conversation.id as string;
  const send = (u: U, conv: string, body: Record<string, unknown>) => c.call('POST', `/chatbot/conversations/${conv}/messages`, { token: u.token, body });
  async function uploadPng(u: U, purpose = 'chatbot_image') {
    const p = await c.call('POST', '/uploads/presign', { token: u.token, body: { filename: 'loi.png', contentType: 'image/png', size: PNG.length, purpose } });
    assert.equal(p.status, 201, JSON.stringify(p.body));
    const r = await fetch(origin + p.body.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: PNG });
    assert.equal(r.status, 200);
    return p.body.data.fileUrl as string;
  }
  const traceOf = async (id: string) => {
    const m = await prisma.chatbotMessage.findUniqueOrThrow({ where: { id } });
    return ((m.toolCalls ?? []) as { name: string; prompt?: string }[]).find((x) => x.name === '_trace')?.prompt ?? '';
  };

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    origin = server.baseUrl.replace(/\/api$/, '');
    fake = await import('../src/modules/chatbot/chatbot.fake-model.js');
    ({ prisma } = await import('../src/db/prisma.js'));
    const r = await c.registerVerified({ email: ADMIN_EMAIL, password: 'Passw0rd!x', firstName: 'Plat', lastName: 'Admin' });
    admin = { token: r.body.data.accessToken, id: r.body.data.user.id, email: ADMIN_EMAIL };
    const { seedChatbot } = await import('../prisma/seed/chatbot.js');
    await seedChatbot({ db: prisma, userIds: {} as never });
  });
  after(() => server.close());
  beforeEach(() => fake.resetFake());

  it('ảnh kèm chú thích: model đọc ảnh, mô tả vào prompt + lịch sử, không trả thẳng câu mẫu, tin không dùng để học', async () => {
    const u = await c.registerUser('cbimg');
    assert.equal((await c.call('GET', '/chatbot/status', { token: u.token })).body.data.imagesEnabled, true);
    const conv = await start(u);
    const url = await uploadPng(u);
    const r = await send(u, conv, { text: 'lỗi này là sao', image: { url } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(fake.fakeCalls.map((x) => x.kind), ['describe', 'answer']);
    assert.equal(r.body.data.message.answerSource, 'agent');
    const prompt = await traceOf(r.body.data.message.id);
    assert.match(prompt, /<customer_message>\nlỗi này là sao \[Khách gửi ảnh: Ảnh chụp màn hình báo lỗi "unusual activity"/);
    // Tin của khách: lưu ảnh + mô tả, redacted (không học).
    const userMsg = await prisma.chatbotMessage.findFirstOrThrow({ where: { conversationId: conv, role: 'user' } });
    assert.equal(userMsg.content, 'lỗi này là sao');
    assert.equal(userMsg.redacted, true);
    assert.deepEqual(userMsg.attachments, [{ url, contentType: 'image/png', description: 'Ảnh chụp màn hình báo lỗi "unusual activity" khi dùng tool' }]);
    // Widget nhận lại ảnh (không lộ mô tả nội bộ).
    const cur = await c.call('GET', '/chatbot/conversations/current', { token: u.token });
    assert.deepEqual(cur.body.data.messages[0].attachments, [{ url, contentType: 'image/png' }]);
    // Lượt sau: lịch sử vẫn biết ảnh có gì.
    const r2 = await send(u, conv, { text: 'vậy phải làm sao' });
    assert.match(await traceOf(r2.body.data.message.id), /Khách: lỗi này là sao \[Khách gửi ảnh: Ảnh chụp màn hình báo lỗi/);
    // File tạm đã xóa.
    const dir = join(tmpdir(), 'sofinhub-chatbot-images');
    assert.ok(!existsSync(dir) || readdirSync(dir).length === 0, 'không để lại ảnh tạm');
  });

  it('chỉ gửi ảnh (không chữ) được; ảnh không đọc được và không có chữ => xin mô tả bằng chữ, không gọi bước trả lời', async () => {
    const u = await c.registerUser('cbimg2');
    const conv = await start(u);
    const ok = await send(u, conv, { image: { url: await uploadPng(u) } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    fake.resetFake();
    fake.setFakeDescribe(new Error('model không đọc được ảnh'));
    const bad = await send(u, conv, { text: '', image: { url: await uploadPng(u) } });
    assert.equal(bad.status, 200);
    assert.match(bad.body.data.message.content, /chưa đọc được ảnh/);
    assert.deepEqual(fake.fakeCalls.map((x) => x.kind), ['describe']);
    // Có chữ kèm theo => vẫn trả lời, prompt ghi là chưa đọc được ảnh.
    const withText = await send(u, conv, { text: 'tool báo lỗi', image: { url: await uploadPng(u) } });
    assert.match(await traceOf(withText.body.data.message.id), /\[Khách gửi 1 ảnh, Tào chưa đọc được\]/);
  });

  it('ảnh có nội dung bị cấm => từ chối, không gọi bước trả lời', async () => {
    const u = await c.registerUser('cbimg3');
    fake.setFakeDescribe({ description: 'ảnh có nội dung không phù hợp', prohibited: true });
    const r = await send(u, await start(u), { image: { url: await uploadPng(u) } });
    assert.equal(r.body.data.message.answerSource, 'refusal');
    assert.match(r.body.data.message.content, /không phù hợp/);
    assert.deepEqual(fake.fakeCalls.map((x) => x.kind), ['describe']);
  });

  it('ảnh phải của chính khách, đúng purpose chatbot_image; ảnh riêng tư (người khác không xem được)', async () => {
    const u = await c.registerUser('cbimg4');
    const other = await c.registerUser('cbimg5');
    const conv = await start(u);
    const theirs = await uploadPng(other);
    const r1 = await send(u, conv, { text: 'xem ảnh', image: { url: theirs } });
    assert.equal(r1.status, 400);
    assert.equal(r1.body.error.code, 'CHATBOT_IMAGE_INVALID');
    const postImg = await uploadPng(u, 'post_image');
    assert.equal((await send(u, conv, { image: { url: postImg } })).body.error.code, 'CHATBOT_IMAGE_INVALID');
    assert.equal((await send(u, conv, { image: { url: '/api/files/../../etc/passwd' } })).status, 400);
    assert.equal((await send(u, conv, { text: '' })).status, 400, 'không chữ, không ảnh => 400');
    // gif không nhận cho chatbot_image.
    const gif = await c.call('POST', '/uploads/presign', { token: u.token, body: { filename: 'a.gif', contentType: 'image/gif', size: 10, purpose: 'chatbot_image' } });
    assert.equal(gif.status, 400);
    // Ảnh riêng tư: người khác không đọc được.
    const mine = await uploadPng(u);
    const key = mine.split('/').pop()!;
    const signed = await c.call('POST', `/files/${key}/url`, { token: other.token });
    assert.notEqual(signed.status, 200);
  });

  it('tắt nhận ảnh / vượt hạn mức ảnh mỗi ngày', async () => {
    const u = await c.registerUser('cbimg6');
    const conv = await start(u);
    assert.equal((await ADM('PATCH', '/settings', { imagesEnabled: false })).status, 200);
    try {
      assert.equal((await c.call('GET', '/chatbot/status', { token: u.token })).body.data.imagesEnabled, false);
      const r = await send(u, conv, { text: 'xem', image: { url: await uploadPng(u) } });
      assert.equal(r.body.error.code, 'CHATBOT_IMAGES_DISABLED');
    } finally {
      await ADM('PATCH', '/settings', { imagesEnabled: true });
    }
    assert.equal((await ADM('PATCH', '/settings', { dailyImagesPerUser: 1 })).status, 200);
    try {
      assert.equal((await send(u, conv, { image: { url: await uploadPng(u) } })).status, 200);
      const r = await send(u, conv, { image: { url: await uploadPng(u) } });
      assert.equal(r.status, 429);
      assert.equal(r.body.error.code, 'CHATBOT_IMAGE_LIMIT');
      assert.equal((await send(u, conv, { text: 'chữ thì vẫn hỏi được' })).status, 200);
    } finally {
      await ADM('PATCH', '/settings', { dailyImagesPerUser: 20 });
    }
  });
});
