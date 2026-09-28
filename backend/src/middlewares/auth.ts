import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { HttpError } from '../utils/http-error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function extractUserId(authHeader: string | undefined): string | undefined {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  return token ? (verifyAccessToken(token)?.sub ?? undefined) : undefined;
}

/** Bắt buộc đăng nhập: 401 nếu thiếu/hết hạn access token. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const userId = extractUserId(req.headers.authorization);
  if (!userId) return next(HttpError.unauthorized());
  req.userId = userId;
  next();
};

/** Gắn req.userId nếu có access token hợp lệ, nhưng không bắt buộc phải đăng nhập. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  req.userId = extractUserId(req.headers.authorization);
  next();
};
