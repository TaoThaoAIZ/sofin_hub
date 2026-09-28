import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import { isProd } from '../config/env.js';
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

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Lỗi hệ thống' : err instanceof Error ? err.message : 'Lỗi hệ thống',
    },
  });
};
