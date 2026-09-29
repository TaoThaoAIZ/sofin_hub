import type { RequestHandler } from 'express';
import { authenticateAccessToken } from '../modules/auth/tokens.js';
import { HttpError } from '../utils/http-error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      /** Id phiên đăng nhập (`sid` trong access token). */
      sessionId?: string;
    }
  }
}

async function authenticate(authHeader: string | undefined) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  return token ? authenticateAccessToken(token) : null;
}

/** Bắt buộc đăng nhập: 401 nếu thiếu/hết hạn/bị thu hồi access token (kiểm tra cả phiên và tokenVersion trong DB). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const auth = await authenticate(req.headers.authorization);
    if (!auth) return next(HttpError.unauthorized());
    req.userId = auth.userId;
    req.sessionId = auth.sid;
    next();
  } catch (e) {
    next(e);
  }
};

/** Gắn req.userId nếu có access token hợp lệ, nhưng không bắt buộc phải đăng nhập. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const auth = await authenticate(req.headers.authorization);
    req.userId = auth?.userId;
    req.sessionId = auth?.sid;
    next();
  } catch (e) {
    next(e);
  }
};
