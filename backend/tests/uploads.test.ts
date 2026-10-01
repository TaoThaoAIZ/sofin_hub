import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Ghi file vào thư mục tạm, không đụng backend/data/uploads thật.
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'sofinhub-uploads-'));
process.env.UPLOAD_USER_QUOTA_MB = '1';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

describe('uploads', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let origin: string;

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    origin = server.baseUrl.replace(/\/api$/, '');
  });
  after(() => server.close());

  const presign = (token: string | undefined, over: Record<string, unknown> = {}) =>
    c.call('POST', '/uploads/presign', {
      token,
      body: { filename: 'a.png', contentType: 'image/png', size: PNG.length, purpose: 'post_image', ...over },
    });

  const put = (url: string, body: Buffer, contentType = 'image/png') =>
    fetch(origin + url, { method: 'PUT', headers: { 'Content-Type': contentType }, body });

  async function uploadPng(token: string) {
    const p = await presign(token);
    assert.equal(p.status, 201);
    const r = await put(p.body.data.uploadUrl, PNG);
    assert.equal(r.status, 200);
    return p.body.data as { key: string; fileUrl: string; uploadUrl: string };
  }

  it('presign yêu cầu đăng nhập (401) và validate body (400)', async () => {
    assert.equal((await presign(undefined)).status, 401);
    const u = await c.registerUser('up');
    assert.equal((await presign(u.token, { size: -1 })).status, 400);
    assert.equal((await presign(u.token, { purpose: 'nope' })).status, 400);
  });

  it('happy path: presign → PUT → GET /files với header an toàn', async () => {
    const u = await c.registerUser('up');
    const p = await presign(u.token, { filename: '../../evil name.png' });
    assert.equal(p.status, 201);
    const d = p.body.data;
    assert.equal(d.method, 'PUT');
    assert.match(d.key, /^[a-f0-9]{32}\.png$/); // khóa ngẫu nhiên, không chứa tên file người dùng
    assert.ok(!d.key.includes('evil'));
    assert.equal(d.fileUrl, `/api/files/${d.key}`);
    assert.ok(d.expiresAt);

    const r = await put(d.uploadUrl, PNG);
    assert.equal(r.status, 200);

    const f = await fetch(origin + d.fileUrl);
    assert.equal(f.status, 200);
    assert.equal(f.headers.get('content-type'), 'image/png');
    assert.equal(f.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(f.headers.get('content-disposition'), null); // ảnh hiển thị inline
    assert.deepEqual(Buffer.from(await f.arrayBuffer()), PNG);
  });

  it('file không phải ảnh được phục vụ dạng attachment', async () => {
    const u = await c.registerUser('up');
    const body = Buffer.from('%PDF-1.4 test');
    const p = await presign(u.token, { filename: 'tai lieu.pdf', contentType: 'application/pdf', size: body.length, purpose: 'post_file' });
    assert.equal(p.status, 201);
    assert.equal((await put(p.body.data.uploadUrl, body, 'application/pdf')).status, 200);
    // post_file là file riêng tư: ẩn danh bị chặn, chủ file (Bearer) tải được
    assert.equal((await fetch(origin + p.body.data.fileUrl)).status, 401);
    const f = await fetch(origin + p.body.data.fileUrl, { headers: { Authorization: `Bearer ${u.token}` } });
    assert.equal(f.status, 200);
    assert.equal(f.headers.get('content-type'), 'application/pdf');
    assert.match(f.headers.get('content-disposition') ?? '', /^attachment/);
  });

  it('từ chối SVG/HTML và loại không thuộc whitelist theo mục đích (400)', async () => {
    const u = await c.registerUser('up');
    assert.equal((await presign(u.token, { filename: 'x.svg', contentType: 'image/svg+xml' })).status, 400);
    assert.equal((await presign(u.token, { filename: 'x.html', contentType: 'text/html', purpose: 'post_file' })).status, 400);
    // ảnh đại diện không nhận PDF
    assert.equal((await presign(u.token, { contentType: 'application/pdf', purpose: 'avatar' })).status, 400);
  });

  it('vượt giới hạn dung lượng theo mục đích (400)', async () => {
    const u = await c.registerUser('up');
    assert.equal((await presign(u.token, { purpose: 'avatar', size: 4 * 1024 * 1024 })).status, 400);
  });

  it('vé: dùng lại bị từ chối, sai chữ ký, sai key, sai Content-Type', async () => {
    const u = await c.registerUser('up');
    const p = (await presign(u.token)).body.data;
    // sai Content-Type → 400 và vé CHƯA bị tiêu
    assert.equal((await put(p.uploadUrl, PNG, 'image/jpeg')).status, 400);
    assert.equal((await put(p.uploadUrl, PNG)).status, 200);
    assert.equal((await put(p.uploadUrl, PNG)).status, 401); // dùng lại

    const p2 = (await presign(u.token)).body.data;
    const tampered = p2.uploadUrl.replace(/token=[^.]+\./, 'token=e30.');
    assert.equal((await put(tampered, PNG)).status, 401);
    const noToken = p2.uploadUrl.split('?')[0];
    assert.equal((await put(noToken, PNG)).status, 401);

    // vé của key này không dùng được cho key khác
    const other = (await presign(u.token)).body.data;
    const swapped = `/api/uploads/${other.key}?${p2.uploadUrl.split('?')[1]}`;
    assert.equal((await put(swapped, PNG)).status, 403);
  });

  it('vé hết hạn bị từ chối', async () => {
    const u = await c.registerUser('up');
    const p = (await presign(u.token)).body.data;
    const { signUploadTicket } = await import('../src/modules/uploads/uploads.ticket.js');
    const expired = signUploadTicket({ key: p.key, contentType: 'image/png', maxSize: PNG.length, userId: u.id, ttlSec: -1 });
    const r = await put(`/api/uploads/${p.key}?token=${encodeURIComponent(expired.token)}`, PNG);
    assert.equal(r.status, 401);
    assert.match((await r.json()).error.message, /hết hạn/);
  });

  it('magic bytes không khớp contentType bị từ chối (400) và không lưu file', async () => {
    const u = await c.registerUser('up');
    const fake = Buffer.from('<html><script>alert(1)</script></html>');
    const p = (await presign(u.token, { size: fake.length })).body.data;
    assert.equal((await put(p.uploadUrl, fake)).status, 400);
    assert.equal((await fetch(origin + p.fileUrl)).status, 404);
  });

  it('body lớn hơn dung lượng đã khai báo bị 413', async () => {
    const u = await c.registerUser('up');
    const p = (await presign(u.token, { size: PNG.length })).body.data;
    const big = Buffer.concat([PNG, Buffer.alloc(4096, 2)]);
    assert.equal((await put(p.uploadUrl, big)).status, 413);
  });

  it('GET /files chặn path traversal và trả 404 khi không có', async () => {
    for (const k of ['..%2f..%2fpackage.json', '..%5c..%5cpackage.json', '%2e%2e%2fsecret.png', 'abc.png', 'x.svg']) {
      assert.equal((await fetch(`${origin}/api/files/${k}`)).status, 404, k);
    }
    assert.equal((await fetch(`${origin}/api/files/${'0'.repeat(32)}.png`)).status, 404);
    // GET /files/../ đã được HTTP client chuẩn hóa nhưng vẫn không lộ file
    assert.notEqual((await fetch(`${origin}/api/files/../../package.json`)).status, 200);
  });

  it('GET /me/uploads và DELETE: chỉ chủ sở hữu (403 với người khác, 404 khi không có)', async () => {
    const a = await c.registerUser('up');
    const b = await c.registerUser('up');
    assert.equal((await c.call('GET', '/me/uploads')).status, 401);
    const f = await uploadPng(a.token);

    const list = await c.call('GET', '/me/uploads', { token: a.token });
    assert.ok(list.body.data.some((x: any) => x.key === f.key));
    assert.equal((await c.call('GET', '/me/uploads', { token: b.token })).body.data.length, 0);

    assert.equal((await c.call('DELETE', `/uploads/${f.key}`, { token: b.token })).status, 403);
    assert.equal((await c.call('DELETE', `/uploads/${f.key}`)).status, 401);
    assert.equal((await c.call('DELETE', `/uploads/${f.key}`, { token: a.token })).status, 200);
    assert.equal((await fetch(origin + f.fileUrl)).status, 404);
    assert.equal((await c.call('DELETE', `/uploads/${f.key}`, { token: a.token })).status, 404);
  });

  it('lesson_attachment với courseId: member thường bị 403, khóa học không tồn tại 404', async () => {
    const u = await c.registerUser('up');
    await c.call('POST', '/courses/photo/enroll', { token: u.token });
    const over = { filename: 'a.pdf', contentType: 'application/pdf', purpose: 'lesson_attachment', size: 100 };
    assert.equal((await presign(u.token, { ...over, courseId: 'photo' })).status, 403);
    assert.equal((await presign(u.token, { ...over, courseId: 'khong-ton-tai' })).status, 404);
  });

  it('hạn mức lưu trữ mỗi user (413)', async () => {
    const u = await c.registerUser('up');
    assert.equal((await presign(u.token, { purpose: 'post_file', contentType: 'application/pdf', size: 900 * 1024 })).status, 201);
    const r = await presign(u.token, { purpose: 'post_file', contentType: 'application/pdf', size: 900 * 1024 });
    assert.equal(r.status, 413);
  });

  it('metadata lưu trong DB: pending -> uploaded với dung lượng thật; lỗi PUT thì xóa dòng', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const u = await c.registerUser('up');
    const p = await presign(u.token, { size: 10_000 });
    const key = p.body.data.key as string;
    let row = await prisma.upload.findUniqueOrThrow({ where: { key } });
    assert.equal(row.status, 'pending');
    assert.equal(row.ownerId, u.id);
    assert.equal(row.purpose, 'post_image');
    assert.equal(row.size, 10_000);
    assert.equal((await put(p.body.data.uploadUrl, PNG)).status, 200);
    row = await prisma.upload.findUniqueOrThrow({ where: { key } });
    assert.equal(row.status, 'uploaded');
    assert.equal(row.size, PNG.length); // ghi đè bằng dung lượng thật

    const bad = await presign(u.token);
    assert.equal((await put(bad.body.data.uploadUrl, Buffer.from('<html>'))).status, 400); // magic bytes sai
    assert.equal(await prisma.upload.findUnique({ where: { key: bad.body.data.key } }), null);
  });

  it('hạn mức tính bằng SUM trong DB: đã upload + pending còn hạn; pending quá hạn không tính; xóa file trả lại hạn mức', async () => {
    const { prisma } = await import('../src/db/prisma.js');
    const u = await c.registerUser('up');
    const KB = 1024;
    const mk = (n: number, size: number, status: 'pending' | 'uploaded', ageMs: number) =>
      prisma.upload.create({
        data: {
          key: `${n.toString(16).padStart(32, 'a')}.pdf`,
          ownerId: u.id,
          filename: 'x.pdf',
          contentType: 'application/pdf',
          size,
          purpose: 'post_file',
          status,
          createdAt: new Date(Date.now() - ageMs),
        },
      });
    await mk(1, 600 * KB, 'uploaded', 86_400_000); // tính
    await mk(2, 300 * KB, 'pending', 3_600_000); // pending quá hạn vé -> không tính
    const big = { purpose: 'post_file', contentType: 'application/pdf' };
    assert.equal((await presign(u.token, { ...big, size: 500 * KB })).status, 413); // 600 + 500 > 1024
    assert.equal((await presign(u.token, { ...big, size: 400 * KB })).status, 201); // 600 + 400 <= 1024 (pending quá hạn bị bỏ)
    assert.equal((await presign(u.token, { ...big, size: 100 * KB })).status, 413); // 600 + 400(pending mới) + 100 > 1024
    const agg = await prisma.upload.aggregate({ _sum: { size: true }, where: { ownerId: u.id, OR: [{ status: 'uploaded' }, { createdAt: { gt: new Date(Date.now() - 3_000_000) } }] } });
    assert.equal(agg._sum.size, 1000 * KB);

    // Quota theo từng user, không lẫn sang người khác
    const other = await c.registerUser('up');
    assert.equal((await presign(other.token, { ...big, size: 900 * KB })).status, 201);

    // Xóa file đã upload (chủ sở hữu) -> có chỗ lại
    assert.equal((await c.call('DELETE', `/uploads/${(1).toString(16).padStart(32, 'a')}.pdf`, { token: u.token })).status, 200);
    assert.equal((await presign(u.token, { ...big, size: 100 * KB })).status, 201);
  });
});
