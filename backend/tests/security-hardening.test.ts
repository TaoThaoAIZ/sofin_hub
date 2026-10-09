import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Ghi file vào thư mục tạm, không đụng backend/data/uploads thật.
const UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'sofinhub-sec-uploads-'));
process.env.UPLOAD_DIR = UPLOAD_DIR;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);
const PDF = Buffer.from('%PDF-1.4 secret');

/** Chạy đoạn mã trong tiến trình con với đúng env cho trước (không kế thừa env của test, không đọc .env). */
function runInChild(snippet: string, env: Record<string, string>) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', snippet], {
    cwd: join(import.meta.dirname, '..'),
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', DOTENV_CONFIG_PATH: 'does-not-exist.env', ...env },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}
const loadEnv = (env: Record<string, string>) => runInChild("await import('./src/config/env.ts'); console.log('LOADED');", env);

const PROD_OK: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db.example.com:5432/sofinhub',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  UPLOAD_SIGNING_SECRET: 'd'.repeat(48),
  OTP_PEPPER: 'e'.repeat(48),
};

describe('4.1 NODE_ENV bắt buộc + hộp thư dev opt-in', () => {
  it('thiếu NODE_ENV -> app từ chối khởi động (không rơi về development)', () => {
    const r = loadEnv({});
    assert.notEqual(r.code, 0);
    assert.match(r.err, /NODE_ENV/);
  });

  it('NODE_ENV không hợp lệ bị từ chối; development/test/production hợp lệ thì nạp được', () => {
    assert.notEqual(loadEnv({ NODE_ENV: 'staging' }).code, 0);
    assert.equal(loadEnv({ NODE_ENV: 'development' }).out, 'LOADED');
    assert.equal(loadEnv({ NODE_ENV: 'test' }).out, 'LOADED');
    assert.equal(loadEnv(PROD_OK).out, 'LOADED');
  });

  const outboxRoutes = (env: Record<string, string>) =>
    runInChild("const m = await import('./src/modules/mail/mail.routes.ts'); console.log('ROUTES=' + m.mailRouter.stack.length);", env);

  it('/dev/outbox KHÔNG được mount nếu không có ENABLE_DEV_OUTBOX=1, kể cả khi NODE_ENV=development', () => {
    assert.match(outboxRoutes({ NODE_ENV: 'development' }).out, /ROUTES=0/);
    assert.match(outboxRoutes({ NODE_ENV: 'development', ENABLE_DEV_OUTBOX: '0' }).out, /ROUTES=0/);
    assert.match(outboxRoutes({ NODE_ENV: 'development', ENABLE_DEV_OUTBOX: '1' }).out, /ROUTES=1/);
  });

  it('production + ENABLE_DEV_OUTBOX=1 -> từ chối khởi động', () => {
    const r = loadEnv({ ...PROD_OK, ENABLE_DEV_OUTBOX: '1' });
    assert.notEqual(r.code, 0);
    assert.match(r.err, /ENABLE_DEV_OUTBOX/);
  });

  it('error handler không trả err.message thô khi NODE_ENV != development', async () => {
    const { errorHandler } = await import('../src/middlewares/error-handler.js');
    const origError = console.error;
    console.error = () => {};
    let status = 0;
    let payload: any;
    const res = { status: (s: number) => ((status = s), res), json: (p: unknown) => ((payload = p), res) };
    errorHandler(new Error('SELECT secret FROM users - postgres://x'), {} as never, res as never, (() => {}) as never);
    console.error = origError;
    assert.equal(status, 500);
    assert.equal(payload.error.message, 'Lỗi hệ thống');
  });

  it('cookie refresh có cờ Secure khi không phải development', async () => {
    const server = await startTestServer();
    try {
      const email = `cookie-${Date.now()}@test.local`;
      const post = (path: string, body: unknown) =>
        fetch(`${server.baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.ok((await post('/auth/register', { email, password: 'Passw0rd!x', firstName: 'C', lastName: 'K' })).status < 300);
      const { makeClient } = await import('./helpers.js');
      const code = await makeClient(server.baseUrl).otpFor(email);
      const res = await post('/auth/register/verify', { email, code });
      assert.ok(res.status < 300);
      assert.match(res.headers.get('set-cookie') ?? '', /;\s*Secure/i);
    } finally {
      await server.close();
    }
  });
});

describe('4.2 guard secret production', () => {
  it('hàm kiểm tra bắt từng secret dev-*, thiếu DATABASE_URL và outbox', async () => {
    const { productionEnvProblems } = await import('../src/config/env-guard.js');
    assert.deepEqual(productionEnvProblems(PROD_OK), []);
    assert.deepEqual(productionEnvProblems({ NODE_ENV: 'development', JWT_ACCESS_SECRET: 'dev-x' }), []);
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'UPLOAD_SIGNING_SECRET']) {
      const p = productionEnvProblems({ ...PROD_OK, [key]: 'dev-default-change-me' });
      assert.equal(p.length, 1, key);
      assert.match(p[0]!, new RegExp(key));
    }
    assert.match(productionEnvProblems({ ...PROD_OK, DATABASE_URL: '' }).join(), /DATABASE_URL/);
  });

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'UPLOAD_SIGNING_SECRET']) {
    it(`production + ${key}=dev-... -> thoát mã != 0`, () => {
      const r = loadEnv({ ...PROD_OK, [key]: 'dev-whatever-change-me' });
      assert.notEqual(r.code, 0);
      assert.match(r.err, new RegExp(key));
    });
  }

  it('production không đặt secret nào (rơi về default dev-*) -> từ chối', () => {
    const r = loadEnv({ NODE_ENV: 'production', DATABASE_URL: PROD_OK.DATABASE_URL! });
    assert.notEqual(r.code, 0);
    assert.match(r.err, /JWT_ACCESS_SECRET/);
    assert.match(r.err, /UPLOAD_SIGNING_SECRET/);
  });

  it('production không có DATABASE_URL -> từ chối', () => {
    const noDb = { ...PROD_OK };
    delete noDb.DATABASE_URL;
    const r = loadEnv(noDb);
    assert.notEqual(r.code, 0);
    assert.match(r.err, /DATABASE_URL/);
  });
});

describe('4.4 SSE không nhận access_token trên query + log không lộ token', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  it('?access_token=<JWT hợp lệ> bị 401 ở cả notifications và messages; Bearer + ticket vẫn chạy', async () => {
    const u = await c.registerUser('sse-sec');
    assert.equal((await c.call('GET', `/notifications/stream?access_token=${u.token}`)).status, 401);
    assert.equal((await c.call('GET', `/messages/stream?access_token=${u.token}`)).status, 401);
    const t = await c.call('POST', '/notifications/stream-ticket', { token: u.token });
    const ac = new AbortController();
    const ok = await fetch(`${server.baseUrl}/notifications/stream?ticket=${t.body.data.ticket}`, { signal: ac.signal });
    assert.equal(ok.status, 200);
    ac.abort();
    const ac2 = new AbortController();
    const bearer = await fetch(`${server.baseUrl}/notifications/stream`, { headers: { Authorization: `Bearer ${u.token}` }, signal: ac2.signal });
    assert.equal(bearer.status, 200);
    ac2.abort();
  });

  it('redactUrl che access_token/token/ticket/sig nhưng giữ tham số thường', async () => {
    const { redactUrl } = await import('../src/middlewares/request-logger.js');
    assert.equal(redactUrl('/api/x?access_token=abc.def&page=2'), '/api/x?access_token=[redacted]&page=2');
    assert.equal(redactUrl('/api/notifications/stream?ticket=SECRET'), '/api/notifications/stream?ticket=[redacted]');
    assert.equal(redactUrl('/api/uploads/k.png?token=aaa.bbb'), '/api/uploads/k.png?token=[redacted]');
    assert.equal(redactUrl('/api/files/k.pdf?u=1&exp=2&sig=XYZ'), '/api/files/k.pdf?u=1&exp=2&sig=[redacted]');
    assert.equal(redactUrl('/api/courses?q=photo'), '/api/courses?q=photo');
  });

  it('morgan thực sự không ghi token ra dòng log (URL và Referer)', async () => {
    const express = (await import('express')).default;
    const { requestLogger } = await import('../src/middlewares/request-logger.js');
    const lines: string[] = [];
    for (const prod of [true, false]) {
      const app = express();
      app.use(requestLogger(prod, { write: (l) => void lines.push(l) }));
      app.get('/x', (_req, res) => void res.json({}));
      const srv = app.listen(0);
      const port = (srv.address() as { port: number }).port;
      await fetch(`http://127.0.0.1:${port}/x?access_token=LEAKME123&ticket=LEAKTICKET`, {
        headers: { Referer: 'http://a.test/p?access_token=LEAKREF' },
      });
      await new Promise((r) => setTimeout(r, 50));
      srv.close();
    }
    assert.ok(lines.length >= 2);
    for (const l of lines) assert.doesNotMatch(l, /LEAKME123|LEAKTICKET|LEAKREF/);
    assert.match(lines.join(''), /access_token=\[redacted\]/);
  });
});

describe('4.3 GET /api/files/:key - tách ảnh công khai và file riêng tư', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let origin: string;
  const COURSE = 'photo';

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    origin = server.baseUrl.replace(/\/api$/, '');
  });
  after(() => server.close());

  async function upload(token: string, purpose: string, over: { body?: Buffer; type?: string; name?: string; courseId?: string } = {}) {
    const isImg = purpose === 'message_attachment' || purpose.endsWith('image') || purpose === 'avatar' || purpose === 'cover';
    const body = over.body ?? (isImg ? PNG : PDF);
    const type = over.type ?? (body === PNG ? 'image/png' : 'application/pdf');
    const p = await c.call('POST', '/uploads/presign', {
      token,
      body: { filename: over.name ?? 'f.bin', contentType: type, size: body.length, purpose, ...(over.courseId ? { courseId: over.courseId } : {}) },
    });
    assert.equal(p.status, 201, JSON.stringify(p.body));
    const r = await fetch(origin + p.body.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': type }, body });
    assert.equal(r.status, 200);
    return { key: p.body.data.key as string, url: p.body.data.fileUrl as string };
  }
  const get = (path: string, token?: string) => fetch(origin + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  async function pair() {
    const a = await c.registerUser('fa');
    const b = await c.registerUser('fb');
    for (const u of [a, b]) await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token });
    const conv = await c.call('POST', '/conversations', { token: a.token, body: { userId: b.id } });
    assert.ok(conv.status < 300, JSON.stringify(conv.body));
    return { a, b, convId: conv.body.data.id as string };
  }
  const sendWith = (token: string, convId: string, f: { url: string }) =>
    c.call('POST', `/conversations/${convId}/messages`, {
      token,
      body: { content: 'ảnh riêng', attachments: [{ url: f.url, name: 'p.png', contentType: 'image/png', size: PNG.length }] },
    });

  it('ảnh công khai (avatar/cover/post_image) vẫn xem được không cần đăng nhập, cache công khai', async () => {
    const u = await c.registerUser('pub');
    for (const purpose of ['avatar', 'cover', 'post_image']) {
      const f = await upload(u.token, purpose);
      const r = await get(f.url);
      assert.equal(r.status, 200, purpose);
      assert.match(r.headers.get('cache-control') ?? '', /public, max-age=31536000, immutable/);
    }
  });

  it('message_attachment: ẩn danh 401, người ngoài 403, 2 người trong cuộc xem được với private/no-store', async () => {
    const { a, b, convId } = await pair();
    const stranger = await c.registerUser('fs');
    const f = await upload(a.token, 'message_attachment');
    assert.equal((await sendWith(a.token, convId, f)).status, 201);

    assert.equal((await get(f.url)).status, 401);
    assert.equal((await get(f.url, stranger.token)).status, 403);
    for (const u of [a, b]) {
      const r = await get(f.url, u.token);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
      assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG);
    }
    assert.equal((await c.call('POST', `/files/${f.key}/url`, { token: stranger.token })).status, 403);
    assert.equal((await c.call('POST', `/files/${f.key}/url`)).status, 401);
  });

  it('URL ký dùng được cho <img>/<a> không cần header; sai chữ ký / hết hạn / đổi file đều bị từ chối', async () => {
    const { a, b, convId } = await pair();
    const f = await upload(a.token, 'message_attachment');
    await sendWith(a.token, convId, f);
    const s = await c.call('POST', `/files/${f.key}/url`, { token: b.token });
    assert.equal(s.status, 200);
    assert.ok(s.body.data.expiresAt);
    const ok = await get(s.body.data.url);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'private, no-store');

    const url = new URL(origin + s.body.data.url);
    const bad = new URL(url);
    bad.searchParams.set('sig', 'x'.repeat(43));
    assert.equal((await fetch(bad)).status, 401);
    const expired = new URL(url);
    expired.searchParams.set('exp', String(Math.floor(Date.now() / 1000) - 10));
    assert.equal((await fetch(expired)).status, 401);
    // chữ ký của file A không dùng cho file khác
    const f2 = await upload(a.token, 'message_attachment');
    await sendWith(a.token, convId, f2);
    const other = new URL(url);
    other.pathname = `/api/files/${f2.key}`;
    assert.equal((await fetch(other)).status, 401);
  });

  it('thu hồi tin nhắn -> file ngừng được phục vụ (kể cả URL ký còn hạn và với chính người gửi)', async () => {
    const { a, b, convId } = await pair();
    const f = await upload(a.token, 'message_attachment');
    const sent = await sendWith(a.token, convId, f);
    const signed = (await c.call('POST', `/files/${f.key}/url`, { token: b.token })).body.data.url as string;
    assert.equal((await get(signed)).status, 200);

    const del = await c.call('DELETE', `/messages/${sent.body.data.id}`, { token: a.token });
    assert.ok(del.status < 300);
    assert.equal((await get(signed)).status, 404);
    assert.equal((await get(f.url, b.token)).status, 404);
    assert.equal((await get(f.url, a.token)).status, 404);
    assert.equal(existsSync(join(UPLOAD_DIR, f.key)), false);
  });

  it('lesson_attachment: chỉ thành viên khóa học (hoặc chủ file) xem được', async () => {
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    const mod = await c.registerUser('lmod');
    await enrollmentService.grant(mod.id, COURSE, 'mod');
    const member = await c.registerUser('lmem');
    await c.call('POST', `/courses/${COURSE}/enroll`, { token: member.token });
    const outsider = await c.registerUser('lout');
    const f = await upload(mod.token, 'lesson_attachment', { courseId: COURSE, name: 'bai.pdf' });

    assert.equal((await get(f.url)).status, 401);
    assert.equal((await get(f.url, outsider.token)).status, 403);
    assert.equal((await get(f.url, mod.token)).status, 200);
    const r = await get(f.url, member.token);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.match(r.headers.get('content-disposition') ?? '', /^attachment/);
    assert.equal((await c.call('POST', `/files/${f.key}/url`, { token: outsider.token })).status, 403);
    assert.equal((await c.call('POST', `/files/${f.key}/url`, { token: member.token })).status, 200);
  });

  it('post_file: người không chung cộng đồng nào với chủ file bị chặn', async () => {
    const owner = await c.registerUser('pfo');
    await c.call('POST', `/courses/${COURSE}/enroll`, { token: owner.token });
    const mate = await c.registerUser('pfm');
    await c.call('POST', `/courses/${COURSE}/enroll`, { token: mate.token });
    const outsider = await c.registerUser('pfx');
    const f = await upload(owner.token, 'post_file');
    assert.equal((await get(f.url)).status, 401);
    assert.equal((await get(f.url, outsider.token)).status, 403);
    assert.equal((await get(f.url, mate.token)).status, 200);
  });

  it('không có bản ghi Upload, hoặc status != uploaded -> 404 (kể cả file công khai có trên đĩa)', async () => {
    const u = await c.registerUser('nrec');
    // 1) file nằm trên đĩa nhưng không có bản ghi Upload
    const orphan = `${'a1'.repeat(16)}.png`;
    writeFileSync(join(UPLOAD_DIR, orphan), PNG);
    assert.equal((await get(`/api/files/${orphan}`)).status, 404);
    assert.equal((await get(`/api/files/${orphan}`, u.token)).status, 404);
    // 2) đã presign nhưng chưa PUT (pending)
    const p = await c.call('POST', '/uploads/presign', {
      token: u.token,
      body: { filename: 'a.png', contentType: 'image/png', size: PNG.length, purpose: 'avatar' },
    });
    assert.equal(p.status, 201);
    writeFileSync(join(UPLOAD_DIR, p.body.data.key), PNG);
    assert.equal((await get(p.body.data.fileUrl)).status, 404);
    assert.equal((await c.call('POST', `/files/${p.body.data.key}/url`, { token: u.token })).status, 404);
  });

  it('POST /files/:key/url với ảnh công khai trả URL thường, không có hạn', async () => {
    const u = await c.registerUser('purl');
    const f = await upload(u.token, 'avatar');
    const r = await c.call('POST', `/files/${f.key}/url`, { token: u.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.url, f.url);
    assert.equal(r.body.data.expiresAt, null);
  });
});
