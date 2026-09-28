import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middlewares/auth.js';
import { isProd } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { loginBody, registerBody } from './auth.schema.js';
import { authService, type AuthSession } from './auth.service.js';
import { REFRESH_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_NAME } from './tokens.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(HttpError.tooMany('Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút')),
});

function setRefreshCookie(res: import('express').Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    // Production: FE và BE gần như luôn ở khác domain (vd. FE Vercel, BE Render) → cookie phải
    // SameSite=None (bắt buộc kèm Secure) mới được trình duyệt gửi kèm request cross-site.
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  });
}

function sendSession(res: import('express').Response, session: AuthSession) {
  setRefreshCookie(res, session.refreshToken);
  res.json({ data: { user: session.user, accessToken: session.accessToken } });
}

authRouter.post('/register', async (req, res) => {
  const body = registerBody.parse(req.body);
  sendSession(res, await authService.register(body));
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const body = loginBody.parse(req.body);
  sendSession(res, await authService.login(body));
});

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw HttpError.unauthorized('Chưa đăng nhập');
  sendSession(res, await authService.refresh(token));
});

authRouter.post('/logout', requireAuth, (req, res) => {
  authService.logout(req.userId!);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ data: await authService.me(req.userId!) });
});
