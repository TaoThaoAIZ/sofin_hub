import express, { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { authenticateAccessToken } from '../auth/tokens.js';
import { FILE_URL_TTL_SEC, canReadPrivateFile, signFileUrl, verifyFileUrl } from './uploads.access.js';

/** URL ký cho video bài học sống lâu hơn (video dài: tua/đệm tiếp sau vài phút vẫn phải còn hiệu lực). */
const VIDEO_URL_TTL_SEC = 4 * 3600;

/** `Range: bytes=a-b | a- | -n` (một đoạn) → khoảng byte hợp lệ trong file `size`; null = không có/không hỗ trợ Range; 'invalid' = không thỏa. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n <= 0) return 'invalid';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) return 'invalid';
  return { start, end };
}
import { FILE_URL_PREFIX, isPublicPurpose, isStreamedPurpose } from './uploads.types.js';
import { abortSchema, completeSchema, presignSchema } from './uploads.schema.js';
import { uploadService } from './uploads.service.js';

export const uploadsRouter = Router();

/** Đọc body thô bằng express.raw với giới hạn riêng theo vé; vượt giới hạn → 413 (chưa ghi gì xuống đĩa). */
function readRawBody(req: Request, res: Response, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    express.raw({ limit, type: () => true })(req, res, (err?: unknown) => {
      if (!err) return resolve(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
      const e = err as { type?: string };
      reject(e.type === 'entity.too.large' ? new HttpError(413, 'PAYLOAD_TOO_LARGE', 'File vượt quá dung lượng đã khai báo') : err);
    });
  });
}

uploadsRouter.post('/uploads/presign', requireAuth, async (req, res) => {
  const input = presignSchema.parse(req.body);
  res.status(201).json({ data: await uploadService.presign(req.userId!, input) });
});

// Upload thẳng lên S3 xong -> backend ghép multipart, kiểm dung lượng + magic bytes rồi mới coi file là hợp lệ.
uploadsRouter.post('/uploads/:key/complete', requireAuth, async (req, res) => {
  res.json({ data: await uploadService.completeDirect(req.userId!, req.params.key as string, completeSchema.parse(req.body ?? {})) });
});

uploadsRouter.post('/uploads/:key/abort', requireAuth, async (req, res) => {
  await uploadService.abortDirect(req.userId!, req.params.key as string, abortSchema.parse(req.body ?? {}).uploadId);
  res.json({ data: { aborted: true } });
});

// Upload trực tiếp qua vé ký HMAC (không cần Bearer). Sau này với S3, FE PUT thẳng lên S3 và route này không còn dùng.
uploadsRouter.put('/uploads/:key', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  const len = req.headers['content-length'] ? Number(req.headers['content-length']) : undefined;
  const { ticket, record } = await uploadService.authorizePut(req.params.key as string, token, req.headers['content-type'], len);
  if (isStreamedPurpose(record.purpose)) {
    // Video dài / slide lớn: ghi thẳng xuống kho dạng stream (không nạp vào RAM); bắt buộc có Content-Length để biết đủ/thiếu.
    if (!len || len <= 0) throw new HttpError(411, 'LENGTH_REQUIRED', 'Thiếu Content-Length cho file tải lên');
    res.json({ data: await uploadService.completeStream(ticket, record, req, len) });
    return;
  }
  const body = await readRawBody(req, res, ticket.ms);
  res.json({ data: await uploadService.completePut(ticket, record, body) });
});

uploadsRouter.get('/me/uploads', requireAuth, async (req, res) => {
  res.json({ data: await uploadService.listMine(req.userId!) });
});

uploadsRouter.delete('/uploads/:key', requireAuth, async (req, res) => {
  await uploadService.remove(req.userId!, req.params.key as string);
  res.json({ data: { deleted: true } });
});

// Ảnh công khai (avatar/cover/post_image): ai có URL cũng xem được, cache dài (cần cho <img> không gửi được header Authorization).
// File riêng tư (message_attachment/lesson_attachment/post_file): cần Bearer HOẶC URL ký hạn ngắn lấy từ POST /files/:key/url,
// và quyền được kiểm lại ở MỖI lần GET (thu hồi tin nhắn / bị kick thì hết xem được). Không bao giờ cache.
uploadsRouter.get('/files/:key', async (req, res) => {
  const key = req.params.key as string;
  const rec = await uploadService.getServable(key);
  if (!rec) throw HttpError.notFound('Không tìm thấy file');
  const isPublic = isPublicPurpose(rec.purpose);
  if (!isPublic) {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? (await authenticateAccessToken(header.slice(7)))?.userId : undefined;
    const userId = bearer ?? verifyFileUrl(key, req.query);
    if (!userId) throw HttpError.unauthorized('Cần đăng nhập hoặc URL ký còn hạn để xem file này');
    if (!(await canReadPrivateFile(userId, rec))) throw HttpError.forbidden('Bạn không có quyền xem file này');
  }
  const range = parseRange(req.headers.range, rec.size);
  if (range === 'invalid') {
    res.status(416).setHeader('Content-Range', `bytes */${rec.size}`).end();
    return;
  }
  const f = await uploadService.open(key, range ? { range } : {});
  if (!f) throw HttpError.notFound('Không tìm thấy file');
  res.setHeader('Content-Type', f.contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${f.size}`);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
  } else {
    res.setHeader('Content-Length', String(f.size));
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  // helmet mặc định đặt CORP same-origin, sẽ chặn FE khác origin nhúng ảnh.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store');
  if (!f.isImage) {
    res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(f.filename)}`);
  }
  f.stream.on('error', () => res.destroy());
  f.stream.pipe(res);
});

// Xin URL dùng được cho <img>/<a href>: file công khai trả URL thường, file riêng tư trả URL ký hạn ngắn (sau khi kiểm quyền).
uploadsRouter.post('/files/:key/url', requireAuth, async (req, res) => {
  const key = req.params.key as string;
  const rec = await uploadService.getServable(key);
  if (!rec) throw HttpError.notFound('Không tìm thấy file');
  if (isPublicPurpose(rec.purpose)) {
    res.json({ data: { url: `${FILE_URL_PREFIX}${key}`, expiresAt: null } });
    return;
  }
  if (!(await canReadPrivateFile(req.userId!, rec))) throw HttpError.forbidden('Bạn không có quyền xem file này');
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ data: signFileUrl(key, req.userId!, rec.purpose === 'lesson_video' ? VIDEO_URL_TTL_SEC : FILE_URL_TTL_SEC) });
});
