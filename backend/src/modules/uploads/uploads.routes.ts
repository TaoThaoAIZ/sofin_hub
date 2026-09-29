import express, { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
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

// Công khai: URL chứa khóa ngẫu nhiên 128-bit nên không đoán được (cần cho <img> không gửi được header Authorization).
uploadsRouter.get('/files/:key', async (req, res) => {
  const f = await uploadService.open(req.params.key as string);
  if (!f) throw HttpError.notFound('Không tìm thấy file');
  res.setHeader('Content-Type', f.contentType);
  res.setHeader('Content-Length', String(f.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  // helmet mặc định đặt CORP same-origin, sẽ chặn FE khác origin nhúng ảnh.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // Khóa không đổi nội dung nên ảnh cache được lâu; file khác chỉ cache riêng tư.
  res.setHeader('Cache-Control', f.isImage ? 'public, max-age=31536000, immutable' : 'private, max-age=3600');
  if (!f.isImage) {
    res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(f.filename)}`);
  }
  f.stream.on('error', () => res.destroy());
  f.stream.pipe(res);
});
