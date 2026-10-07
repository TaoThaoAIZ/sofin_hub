import type { RequestHandler } from 'express';
import { authenticateAccessToken } from '../modules/auth/tokens.js';
import { prisma } from '../db/prisma.js';
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

/**
 * Dùng SAU requireAuth cho thao tác cần email đã xác thực (đăng bài/bình luận, thanh toán...).
 * 403 EMAIL_NOT_VERIFIED kèm hướng dẫn; FE bắt mã này để mời người dùng xác thực email.
 */
export const requireVerifiedEmail: RequestHandler = async (req, _res, next) => {
  try {
    const u = req.userId ? await prisma.user.findUnique({ where: { id: req.userId }, select: { emailVerified: true } }) : null;
    if (!u) return next(HttpError.unauthorized());
    if (!u.emailVerified) {
      return next(HttpError.coded(403, 'EMAIL_NOT_VERIFIED', 'Vui lòng xác thực email trước khi thực hiện thao tác này (Cài đặt > Bảo mật > Gửi email xác thực)'));
    }
    next();
  } catch (e) {
    next(e);
  }
};
