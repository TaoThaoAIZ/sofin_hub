import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

// Ghi file vào thư mục tạm, không đụng backend/data/uploads thật.
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'sofinhub-lessonmedia-'));

/** mp4 giả: 4 byte kích thước + "ftyp" + dữ liệu có thể đối chiếu từng byte (để kiểm Range). */
const fakeMp4 = (size: number) => {
  const b = Buffer.alloc(size);
  b.writeUInt32BE(24, 0);
  b.write('ftypisom', 4, 'latin1');
  for (let i = 12; i < size; i++) b[i] = i % 251;
  return b;
};
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 7)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 9)]);
const OLE = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64, 3)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 5)]);

/** Video dài (stream, tua được) + slide + nhiều loại tài liệu hơn cho bài học. */
describe('bài học: tải video dài (stream), slide, tài liệu', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let origin: string;
  let mod: { token: string; id: string };
  let member: { token: string; id: string };
  let stranger: { token: string; id: string };

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    origin = server.baseUrl.replace(/\/api$/, '');
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    mod = await c.registerUser('lmmod');
    member = await c.registerUser('lmmem');
    stranger = await c.registerUser('lmstr');
    for (const u of [mod, member]) await enrollmentService.grant(u.id, 'photo');
    await enrollmentService.setRole(mod.id, 'photo', 'mod');
  });
  after(() => server.close());

  const presign = (token: string, body: Record<string, unknown>) => c.call('POST', '/uploads/presign', { token, body });
  const put = (url: string, body: Buffer | ReadableStream, contentType: string, extra: RequestInit = {}) =>
    fetch(origin + url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: body as never, ...extra });
  /** Tệp đính kèm của bài học lưu URL tuyệt đối (FE gửi absoluteUrl). */
  const abs = (url: string) => `http://localhost${url}`;
  const get = (url: string, token?: string, headers: Record<string, string> = {}) =>
    fetch(origin + url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });

  async function upload(token: string, purpose: string, filename: string, contentType: string, data: Buffer) {
    const p = await presign(token, { filename, contentType, size: data.length, purpose, communityId: 'photo' });
    assert.equal(p.status, 201, JSON.stringify(p.body));
    const r = await put(p.body.data.uploadUrl, data, contentType);
    assert.equal(r.status, 200, await r.text());
    return p.body.data as { key: string; fileUrl: string };
  }

  it('lesson_video: chỉ mod+, bắt buộc gắn cộng đồng; nhận mp4/webm/mov, từ chối avi; trần 2GB', async () => {
    const base = { filename: 'bai1.mp4', contentType: 'video/mp4', size: 1000, purpose: 'lesson_video' };
    assert.equal((await presign(mod.token, base)).status, 400); // thiếu communityId
    assert.equal((await presign(member.token, { ...base, communityId: 'photo' })).status, 403);
    assert.equal((await presign(stranger.token, { ...base, communityId: 'photo' })).status, 403);
    assert.equal((await presign(mod.token, { ...base, communityId: 'photo' })).status, 201);
    assert.equal((await presign(mod.token, { ...base, communityId: 'photo', contentType: 'video/webm', filename: 'a.webm' })).status, 201);
    assert.equal((await presign(mod.token, { ...base, communityId: 'photo', contentType: 'video/quicktime', filename: 'a.mov' })).status, 201);
    assert.equal((await presign(mod.token, { ...base, communityId: 'photo', contentType: 'video/x-msvideo', filename: 'a.avi' })).status, 400);
    // Hơn 2GB bị từ chối; 1GB được nhận (vượt xa giới hạn 25MB cũ).
    assert.equal((await presign(mod.token, { ...base, communityId: 'photo', size: 2049 * 1024 * 1024 })).status, 400);
    assert.equal((await presign(mod.token, { ...base, communityId: 'photo', size: 1024 * 1024 * 1024 })).status, 201);
  });

  it('upload dạng stream nhiều MB: ghi đủ, GET trọn vẹn + Range (206) để tua video; Range sai = 416', async () => {
    const data = fakeMp4(3 * 1024 * 1024 + 123);
    const up = await upload(mod.token, 'lesson_video', 'dai.mp4', 'video/mp4', data);
    assert.match(up.key, /^[a-f0-9]{32}\.mp4$/);

    const full = await get(up.fileUrl, member.token);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('accept-ranges'), 'bytes');
    assert.equal(full.headers.get('content-type'), 'video/mp4');
    assert.equal(Number(full.headers.get('content-length')), data.length);
    assert.ok(Buffer.from(await full.arrayBuffer()).equals(data));

    const mid = await get(up.fileUrl, member.token, { Range: 'bytes=1000-1999' });
    assert.equal(mid.status, 206);
    assert.equal(mid.headers.get('content-range'), `bytes 1000-1999/${data.length}`);
    assert.equal(mid.headers.get('content-length'), '1000');
    assert.ok(Buffer.from(await mid.arrayBuffer()).equals(data.subarray(1000, 2000)));

    const tail = await get(up.fileUrl, member.token, { Range: 'bytes=-500' }); // 500 byte cuối
    assert.equal(tail.status, 206);
    assert.ok(Buffer.from(await tail.arrayBuffer()).equals(data.subarray(data.length - 500)));
    const open = await get(up.fileUrl, member.token, { Range: `bytes=${data.length - 10}-` });
    assert.equal(open.status, 206);
    assert.equal((await open.arrayBuffer()).byteLength, 10);

    const bad = await get(up.fileUrl, member.token, { Range: `bytes=${data.length + 5}-` });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers.get('content-range'), `bytes */${data.length}`);
    // Header Range lạ → bỏ qua, trả toàn bộ.
    assert.equal((await get(up.fileUrl, member.token, { Range: 'items=1-2' })).status, 200);
  });

  it('quyền xem: thành viên xem được (kể cả URL ký, TTL dài cho video), người ngoài cộng đồng và ẩn danh bị chặn', async () => {
    const up = await upload(mod.token, 'lesson_video', 'q.mp4', 'video/mp4', fakeMp4(4096));
    assert.equal((await get(up.fileUrl)).status, 401);
    assert.equal((await get(up.fileUrl, stranger.token)).status, 403);
    const signed = await c.call('POST', `/files/${up.key}/url`, { token: member.token });
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    const ttlMs = new Date(signed.body.data.expiresAt).getTime() - Date.now();
    assert.ok(ttlMs > 3 * 3600 * 1000, `TTL video phải dài (>3h), nhận ${ttlMs}ms`);
    assert.equal((await get(signed.body.data.url)).status, 200);
    assert.equal((await c.call('POST', `/files/${up.key}/url`, { token: stranger.token })).status, 403);
  });

  it('stream bị hủy khi: sai magic bytes, vượt dung lượng khai báo, thiếu Content-Length; không để lại file', async () => {
    // Nội dung không phải mp4 (khai báo video/mp4).
    const p1 = await presign(mod.token, { filename: 'gia.mp4', contentType: 'video/mp4', size: 5000, purpose: 'lesson_video', communityId: 'photo' });
    const r1 = await put(p1.body.data.uploadUrl, Buffer.from('<html>' + 'x'.repeat(4000) + '</html>'), 'video/mp4');
    assert.equal(r1.status, 400);
    assert.equal((await get(p1.body.data.fileUrl, mod.token)).status, 404);

    // Gửi nhiều hơn khai báo → 413 ngay từ Content-Length.
    const p2 = await presign(mod.token, { filename: 'nho.mp4', contentType: 'video/mp4', size: 1000, purpose: 'lesson_video', communityId: 'photo' });
    assert.equal((await put(p2.body.data.uploadUrl, fakeMp4(2000), 'video/mp4')).status, 413);

    // Không có Content-Length (chunked) → 411.
    const p3 = await presign(mod.token, { filename: 'chunk.mp4', contentType: 'video/mp4', size: 5000, purpose: 'lesson_video', communityId: 'photo' });
    const data = fakeMp4(2048);
    const rs = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(data);
        ctrl.close();
      },
    });
    const r3 = await put(p3.body.data.uploadUrl, rs, 'video/mp4', { duplex: 'half' } as RequestInit);
    assert.equal(r3.status, 411);
    // Vé dùng một lần: PUT lại cùng vé bị từ chối.
    assert.equal((await put(p3.body.data.uploadUrl, data, 'video/mp4')).status, 401);
  });

  it('slide: nhận pdf/pptx/ppt/ppsx (tới 2GB), từ chối loại khác; tài liệu nhận thêm doc/ppt/xls/csv/ppsx', async () => {
    const s = (contentType: string, filename: string) => presign(mod.token, { filename, contentType, size: 100, purpose: 'lesson_slide', communityId: 'photo' });
    assert.equal((await s('application/pdf', 'a.pdf')).status, 201);
    assert.equal((await s('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'a.pptx')).status, 201);
    assert.equal((await s('application/vnd.ms-powerpoint', 'a.ppt')).status, 201);
    assert.equal((await s('application/vnd.openxmlformats-officedocument.presentationml.slideshow', 'a.ppsx')).status, 201);
    assert.equal((await s('application/zip', 'a.zip')).status, 400);
    assert.equal((await presign(mod.token, { filename: 'a.pdf', contentType: 'application/pdf', size: 2049 * 1024 * 1024, purpose: 'lesson_slide', communityId: 'photo' })).status, 400);
    assert.equal((await presign(member.token, { filename: 'a.pdf', contentType: 'application/pdf', size: 100, purpose: 'lesson_slide', communityId: 'photo' })).status, 403);

    const pdf = await upload(mod.token, 'lesson_slide', 'slide.pdf', 'application/pdf', PDF);
    const got = await get(pdf.fileUrl, member.token);
    assert.equal(got.status, 200);
    assert.match(got.headers.get('content-disposition') ?? '', /^attachment/); // slide luôn là tải xuống, không render inline
    const ppt = await upload(mod.token, 'lesson_slide', 'slide.ppt', 'application/vnd.ms-powerpoint', OLE);
    assert.equal((await get(ppt.fileUrl, member.token)).status, 200);
    // Slide giả (nội dung không phải PDF) bị từ chối.
    const bad = await presign(mod.token, { filename: 'gia.pdf', contentType: 'application/pdf', size: 20, purpose: 'lesson_slide', communityId: 'photo' });
    assert.equal((await put(bad.body.data.uploadUrl, Buffer.from('not a pdf at all!!'), 'application/pdf')).status, 400);

    // Tài liệu đính kèm (đường buffer cũ): thêm Office bản cũ, csv, ppsx.
    const doc = (contentType: string, filename: string, data: Buffer) => upload(mod.token, 'lesson_attachment', filename, contentType, data);
    await doc('application/msword', 'a.doc', OLE);
    await doc('application/vnd.ms-excel', 'a.xls', OLE);
    await doc('text/csv', 'a.csv', Buffer.from('a,b\n1,2\n'));
    await doc('application/vnd.openxmlformats-officedocument.presentationml.slideshow', 'a.ppsx', ZIP);
    const fakeDoc = Buffer.from('%PDF-1.7 not ole container at all');
    const wrong = await presign(mod.token, { filename: 'a.doc', contentType: 'application/msword', size: fakeDoc.length, purpose: 'lesson_attachment', communityId: 'photo' });
    assert.equal((await put(wrong.body.data.uploadUrl, fakeDoc, 'application/msword')).status, 400);
  });

  it('bài học lưu video webm tải lên + slide (kind=slide) cùng tệp đính kèm; thành viên thấy đủ', async () => {
    const mods = await c.call('GET', '/courses/photo/modules', { token: mod.token });
    for (const m of mods.body.data) await c.call('DELETE', `/courses/photo/modules/${m.id}`, { token: mod.token });
    const m = await c.call('POST', '/courses/photo/modules', { token: mod.token, body: { title: 'M', description: 'd' } });
    assert.equal(m.status, 201, JSON.stringify(m.body));
    const video = await upload(mod.token, 'lesson_video', 'v.webm', 'video/webm', WEBM);
    const slide = await upload(mod.token, 'lesson_slide', 's.pdf', 'application/pdf', PDF);
    const created = await c.call('POST', `/courses/photo/modules/${m.body.data.id}/lessons`, {
      token: mod.token,
      body: {
        title: 'Bài có video + slide',
        type: 'video',
        durationMin: 90,
        body: 'ghi chú',
        videoUrl: video.fileUrl,
        attachments: [
          { name: 's.pdf', url: abs(slide.fileUrl), size: PDF.length, kind: 'slide' },
          { name: 'tai-lieu.csv', url: abs('/api/files/' + 'a'.repeat(32) + '.csv'), size: 10 },
        ],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const detail = (await c.call('GET', `/courses/photo/lessons/${created.body.data.id}`, { token: member.token })).body.data;
    assert.equal(detail.videoUrl, video.fileUrl);
    assert.deepEqual(detail.attachments.map((a: { kind?: string }) => a.kind ?? null), ['slide', null]);
    // Video/slide ngoài whitelist đuôi bị từ chối.
    const badVideo = await c.call('POST', `/courses/photo/modules/${m.body.data.id}/lessons`, { token: mod.token, body: { title: 'x', type: 'video', durationMin: 1, body: '', videoUrl: '/api/files/' + 'b'.repeat(32) + '.avi' } });
    assert.equal(badVideo.status, 400);
    const badKind = await c.call('POST', `/courses/photo/modules/${m.body.data.id}/lessons`, { token: mod.token, body: { title: 'x', type: 'text', durationMin: 1, body: 'y'.repeat(40), attachments: [{ name: 'a', url: abs(slide.fileUrl), kind: 'evil' }] } });
    assert.equal(badKind.status, 400);
  });

  it('nhiều video: video bổ sung (kind=video) nhận link YouTube/Vimeo + video tải lên, BE dựng embedUrl; link lạ và quá 10 video bị từ chối', async () => {
    const mods = await c.call('GET', '/courses/photo/modules', { token: mod.token });
    const mid = mods.body.data[0].id as string;
    const up = await upload(mod.token, 'lesson_video', 'v2.webm', 'video/webm', WEBM);
    const post = (attachments: unknown[]) =>
      c.call('POST', `/courses/photo/modules/${mid}/lessons`, { token: mod.token, body: { title: 'Nhiều video', type: 'video', durationMin: 5, body: '', videoUrl: up.fileUrl, attachments } });
    const ok = await post([
      { name: 'Phần 2', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'video', embedUrl: 'https://evil.example/x' },
      { name: 'Phần 3', url: abs(up.fileUrl), kind: 'video' },
      { name: 'slide.pdf', url: abs('/api/files/' + 'c'.repeat(32) + '.pdf'), kind: 'slide' },
    ]);
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const detail = (await c.call('GET', `/courses/photo/lessons/${ok.body.data.id}`, { token: member.token })).body.data;
    const [yt, uploaded] = detail.attachments;
    assert.equal(yt.kind, 'video');
    assert.match(yt.embedUrl, /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/dQw4w9WgXcQ/); // embedUrl do BE dựng, bỏ qua giá trị client gửi
    assert.equal(uploaded.url, up.fileUrl);
    assert.equal(uploaded.embedUrl, undefined);
    // Sửa bài: gửi lại đúng attachments vừa nhận (video tải lên đã chuẩn hóa thành đường dẫn nội bộ) phải lưu được.
    const resave = await c.call('PATCH', `/courses/photo/lessons/${ok.body.data.id}`, { token: mod.token, body: { attachments: detail.attachments } });
    assert.equal(resave.status, 200, JSON.stringify(resave.body));
    assert.equal((await post([{ name: 'x', url: 'https://example.com/video.mp4', kind: 'video' }])).status, 400);
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `v${i}`, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'video' }));
    assert.equal((await post(many)).status, 400);
  });

  it('phải xem hết TẤT CẢ video (chính + bổ sung) mới hoàn thành được bài; khóa video lạ bị từ chối', async () => {
    const mods = await c.call('GET', '/courses/photo/modules', { token: mod.token });
    const mid = mods.body.data[0].id as string;
    const up = await upload(mod.token, 'lesson_video', 'v3.webm', 'video/webm', WEBM);
    const created = await c.call('POST', `/courses/photo/modules/${mid}/lessons`, {
      token: mod.token,
      body: {
        title: 'Xem hết mọi video', type: 'video', durationMin: 5, body: '', videoUrl: up.fileUrl,
        attachments: [
          { name: 'P2', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'video' },
          { name: 'P3', url: 'https://vimeo.com/123456789', kind: 'video' },
        ],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data.id as string;
    const detail = async () => (await c.call('GET', `/courses/photo/lessons/${id}`, { token: member.token })).body.data.video as { required: boolean; watched: boolean; items: { key: string; watched: boolean }[] };
    const complete = () => c.call('POST', `/courses/photo/lessons/${id}/complete`, { token: member.token });
    const watch = (videoKey?: string) => c.call('POST', `/courses/photo/lessons/${id}/watched`, { token: member.token, body: videoKey ? { videoKey } : {} });

    let v = await detail();
    assert.equal(v.required, true);
    assert.equal(v.items.length, 3);
    assert.equal(v.items[0]!.key, 'main');
    assert.equal(v.watched, false);

    // Chỉ xem video chính: chưa được hoàn thành.
    assert.equal((await watch()).status, 200);
    assert.equal((await complete()).status, 409);
    assert.equal((await watch('khong-ton-tai')).status, 400);
    // Xem thêm 1 video bổ sung: vẫn thiếu 1.
    assert.equal((await watch(v.items[1]!.key)).status, 200);
    v = await detail();
    assert.deepEqual(v.items.map((i) => i.watched), [true, true, false]);
    assert.equal(v.watched, false);
    const blocked = await complete();
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error?.code ?? blocked.body.code, 'VIDEO_REQUIRED');
    // Xem nốt video cuối: hoàn thành được.
    assert.equal((await watch(v.items[2]!.key)).status, 200);
    assert.equal((await detail()).watched, true);
    assert.equal((await complete()).status, 200);
  });
});
