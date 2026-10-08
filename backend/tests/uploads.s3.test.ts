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
});
