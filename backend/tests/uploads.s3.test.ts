import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';
import { S3Storage } from '../src/modules/uploads/uploads.storage.js';

const KEY = 'a'.repeat(32) + '.png';

/** Client S3 giả: ghi lại lệnh đã gửi, trả/ném theo kịch bản. */
function fakeClient(reply: (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => unknown) {
  const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
  return {
    sent,
    client: {
      send: async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
        sent.push({ name: cmd.constructor.name, input: cmd.input });
        return reply(cmd);
      },
    },
  };
}

describe('S3Storage', () => {
  it('createUploadTarget: vẫn trỏ về backend bằng vé HMAC (không lộ URL S3)', () => {
    const { client } = fakeClient(() => ({}));
    const s = new S3Storage('bkt', client as never);
    const t = s.createUploadTarget({ key: KEY, contentType: 'image/png', maxSize: 10, userId: 'u1' });
    assert.equal(t.method, 'PUT');
    assert.ok(t.uploadUrl.startsWith(`/api/uploads/${KEY}?token=`));
    assert.equal(s.publicUrl(KEY), `/api/files/${KEY}`);
  });

  it('put / delete gửi đúng Bucket, Key, ContentType', async () => {
    const { client, sent } = fakeClient(() => ({}));
    const s = new S3Storage('bkt', client as never);
    await s.put(KEY, Buffer.from('x'), { contentType: 'image/png' });
    await s.delete(KEY);
    assert.deepEqual(sent.map((c) => c.name), ['PutObjectCommand', 'DeleteObjectCommand']);
    assert.equal(sent[0]!.input.Bucket, 'bkt');
    assert.equal(sent[0]!.input.Key, KEY);
    assert.equal(sent[0]!.input.ContentType, 'image/png');
  });

  it('putStream: hứng xuống đĩa tạm rồi mới gửi S3 (đủ ContentLength); luồng lỗi thì không chạm S3', async () => {
    const { client, sent } = fakeClient(async (cmd) => {
      // Body phải đọc được trọn vẹn từ đĩa (không phải luồng gốc của người dùng).
      const chunks: Buffer[] = [];
      for await (const c of cmd.input.Body as Readable) chunks.push(c as Buffer);
      return { body: Buffer.concat(chunks).toString() };
    });
    const s = new S3Storage('bkt', client as never);
    await s.putStream(KEY, Readable.from([Buffer.from('ab'), Buffer.from('cd')]), { contentType: 'image/png', size: 4 });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.input.ContentLength, 4);

    const bad = Readable.from((async function* () {
      yield Buffer.from('ab');
      throw new Error('client aborted');
    })());
    await assert.rejects(() => s.putStream(KEY, bad, { contentType: 'image/png', size: 4 }), /client aborted/);
    assert.equal(sent.length, 1, 'lỗi giữa chừng thì không gửi gì lên S3');
  });

  it('getStream: trả stream + size; NoSuchKey -> null; lỗi khác (vd. AccessDenied) -> ném lên', async () => {
    const ok = fakeClient(() => ({ Body: Readable.from(['abc']), ContentLength: 3 }));
    const got = await new S3Storage('bkt', ok.client as never).getStream(KEY);
    assert.equal(got?.size, 3);

    const missing = fakeClient(() => {
      throw Object.assign(new Error('nope'), { name: 'NoSuchKey' });
    });
    assert.equal(await new S3Storage('bkt', missing.client as never).getStream(KEY), null);

    const denied = fakeClient(() => {
      throw Object.assign(new Error('denied'), { name: 'AccessDenied' });
    });
    await assert.rejects(() => new S3Storage('bkt', denied.client as never).getStream(KEY), /denied/);
  });

  it('chặn khóa sai định dạng (path traversal) trước khi gọi S3', async () => {
    const { client, sent } = fakeClient(() => ({}));
    const s = new S3Storage('bkt', client as never);
    assert.equal(await s.getStream('../etc/passwd'), null);
    await assert.rejects(() => s.put('../x.png', Buffer.from('x'), { contentType: 'image/png' }));
    await assert.rejects(() => s.delete('../x.png'));
    assert.equal(sent.length, 0);
  });

  it('direct.plan: file nhỏ = 1 presigned PUT; file lớn = multipart đủ số phần, mỗi phần một URL', async () => {
    const { client, sent } = fakeClient((cmd) => (cmd.constructor.name === 'CreateMultipartUploadCommand' ? { UploadId: 'up1' } : {}));
    const signed: string[] = [];
    const s = new S3Storage('bkt', client as never, async (cmd) => {
      const n = (cmd as { constructor: { name: string }; input: { PartNumber?: number } });
      const url = `https://s3/x?${n.constructor.name}&p=${n.input.PartNumber ?? 0}`;
      signed.push(url);
      return url;
    });
    const small = await s.direct.plan({ key: KEY, contentType: 'image/png', size: 1024 });
    assert.ok(small.uploadUrl?.includes('PutObjectCommand'));
    assert.equal(small.multipart, undefined);
    assert.equal(sent.length, 0);

    const big = await s.direct.plan({ key: KEY, contentType: 'video/mp4', size: 40 * 1024 * 1024 });
    assert.equal(big.multipart?.uploadId, 'up1');
    assert.equal(big.multipart?.partUrls.length, 3); // 40MB / 16MB
    assert.equal(sent[0]!.name, 'CreateMultipartUploadCommand');
  });

  it('direct.completeMultipart: sắp xếp phần theo số thứ tự; head null khi NotFound; readHead dùng Range', async () => {
    const { client, sent } = fakeClient((cmd) => {
      if (cmd.constructor.name === 'HeadObjectCommand') throw Object.assign(new Error('x'), { name: 'NotFound' });
      if (cmd.constructor.name === 'GetObjectCommand') return { Body: Readable.from([Buffer.from([1, 2, 3])]) };
      return {};
    });
    const s = new S3Storage('bkt', client as never);
    await s.direct.completeMultipart(KEY, 'up1', [{ partNumber: 2, etag: 'b' }, { partNumber: 1, etag: 'a' }]);
    assert.deepEqual((sent[0]!.input.MultipartUpload as { Parts: { PartNumber: number }[] }).Parts.map((p) => p.PartNumber), [1, 2]);
    assert.equal(await s.direct.head(KEY), null);
    assert.deepEqual([...(await s.direct.readHead(KEY, 64))], [1, 2, 3]);
    assert.equal(sent.at(-1)!.input.Range, 'bytes=0-63');
  });

  it('signedReadUrl: ký GetObject có ResponseContentType (trình duyệt tải thẳng từ S3, hỗ trợ Range)', async () => {
    const { client } = fakeClient(() => ({}));
    let seen: { constructor: { name: string }; input: Record<string, unknown> } | undefined;
    const s = new S3Storage('bkt', client as never, async (cmd) => {
      seen = cmd as never;
      return 'https://s3/x';
    });
    assert.equal(await s.signedReadUrl(KEY, { ttlSec: 60, contentType: 'video/mp4' }), 'https://s3/x');
    assert.equal(seen!.constructor.name, 'GetObjectCommand');
    assert.equal(seen!.input.ResponseContentType, 'video/mp4');
    assert.equal(seen!.input.Key, KEY);
  });
});
