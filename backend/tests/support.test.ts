import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('support: newsletter + liên hệ', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];

  before(async () => {
    server = await startTestServer();
    ({ call } = makeClient(server.baseUrl));
  });
  after(() => server.close());

  const outbox = async (to: string) => (await call('GET', `/dev/outbox?to=${encodeURIComponent(to)}`)).body.data as any[];

  it('newsletter: đăng ký, idempotent (chỉ 1 thư chào), 400 khi email sai', async () => {
    const email = `news-${Date.now()}@test.local`;
    const a = await call('POST', '/newsletter', { body: { email } });
    const b = await call('POST', '/newsletter', { body: { email: email.toUpperCase() } });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(a.body, b.body);
    assert.equal((await outbox(email)).length, 1);
    assert.equal((await call('POST', '/newsletter', { body: { email: 'khong-hop-le' } })).status, 400);
  });

  it('newsletter/unsubscribe: hủy rồi đăng ký lại thì nhận thư chào lần nữa; hủy email lạ vẫn 200', async () => {
    const email = `unsub-${Date.now()}@test.local`;
    await call('POST', '/newsletter', { body: { email } });
    const u = await call('POST', '/newsletter/unsubscribe', { body: { email } });
    assert.equal(u.status, 200);
    assert.equal((await call('POST', '/newsletter/unsubscribe', { body: { email } })).status, 200);
    await call('POST', '/newsletter', { body: { email } });
    assert.equal((await outbox(email)).length, 2);
    assert.equal((await call('POST', '/newsletter/unsubscribe', { body: { email: 'x' } })).status, 400);
  });

  it('contact: 202 và thư tới SUPPORT_EMAIL; 400 khi thiếu trường', async () => {
    const r = await call('POST', '/contact', { body: { name: 'Lan', email: 'lan@test.local', subject: 'Hỏi giá', message: 'Xin chào, cho mình hỏi...' } });
    assert.equal(r.status, 202);
    const { env } = await import('../src/config/env.js');
    const mails = await outbox(env.SUPPORT_EMAIL);
    const mail = mails.find((m) => m.subject === '[Liên hệ] Hỏi giá');
    assert.ok(mail);
    assert.ok(mail.text.includes('lan@test.local'));

    assert.equal((await call('POST', '/contact', { body: { name: 'Lan', email: 'lan@test.local' } })).status, 400);
    assert.equal((await call('POST', '/contact', { body: { name: 'Lan', email: 'sai', subject: 's', message: 'm' } })).status, 400);
    assert.equal((await call('POST', '/contact', { body: { name: 'L', email: 'l@test.local', subject: 's', message: 'x'.repeat(5001) } })).status, 400);
  });

  it('newsletter bền vững trong DB: email chữ thường, unsubscribe đặt unsubscribedAt, đăng ký lại xóa nó; song song chỉ 1 thư chào', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const email = `Persist-${Date.now()}@Test.Local`;
    const lower = email.toLowerCase();
    await Promise.all(Array.from({ length: 5 }, () => call('POST', '/newsletter', { body: { email } })));
    assert.equal(await prisma.newsletterSubscriber.count({ where: { email: lower } }), 1);
    assert.equal((await outbox(lower)).length, 1);

    await call('POST', '/newsletter/unsubscribe', { body: { email } });
    assert.ok((await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: lower } })).unsubscribedAt);
    await call('POST', '/newsletter', { body: { email } });
    assert.equal((await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: lower } })).unsubscribedAt, null);
    assert.equal(await prisma.newsletterSubscriber.count({ where: { email: lower } }), 1);
    assert.equal((await outbox(lower)).length, 2);
  });
});
