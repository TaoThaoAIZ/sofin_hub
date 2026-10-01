import express, { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { authenticateAccessToken } from '../auth/tokens.js';
import { canReadPrivateFile, signFileUrl, verifyFileUrl } from './uploads.access.js';
import { FILE_URL_PREFIX, isPublicPurpose } from './uploads.types.js';
import { presignSchema } from './uploads.schema.js';
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

// Upload trực tiếp qua vé ký HMAC (không cần Bearer). Sau này với S3, FE PUT thẳng lên S3 và route này không còn dùng.
uploadsRouter.put('/uploads/:key', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  const len = req.headers['content-length'] ? Number(req.headers['content-length']) : undefined;
  const { ticket, record } = await uploadService.authorizePut(req.params.key as string, token, req.headers['content-type'], len);
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
  const f = await uploadService.open(key);
  if (!f) throw HttpError.notFound('Không tìm thấy file');
  res.setHeader('Content-Type', f.contentType);
  res.setHeader('Content-Length', String(f.size));
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
  res.json({ data: signFileUrl(key, req.userId!) });
});
