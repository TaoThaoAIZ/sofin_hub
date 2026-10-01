import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import { isDev } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Không tìm thấy ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Tham số không hợp lệ', details: z.flattenError(err) },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Lỗi đọc body của express.json: JSON sai cú pháp -> 400, quá 1MB -> 413 (trước đây rơi xuống 500).
  const bodyErr = err as { type?: string; status?: number };
  if (bodyErr?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Nội dung gửi lên không phải JSON hợp lệ' } });
    return;
  }
  if (bodyErr?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Nội dung gửi lên quá lớn' } });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      // Chỉ lộ err.message khi NODE_ENV=development tường minh (test/production luôn trả thông điệp chung).
      message: isDev && err instanceof Error ? err.message : 'Lỗi hệ thống',
    },
  });
};
