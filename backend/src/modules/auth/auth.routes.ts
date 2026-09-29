import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middlewares/auth.js';
import { isProd } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import {
  changePasswordBody,
  deleteAccountBody,
  forgotPasswordBody,
  loginBody,
  registerBody,
  resetPasswordBody,
  updateProfileBody,
  verifyEmailBody,
} from './auth.schema.js';
import { authService, FORGOT_PASSWORD_MESSAGE, type AuthSession } from './auth.service.js';
import { peekSessionId, REFRESH_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_NAME, type SessionMeta } from './tokens.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // chỉ đếm lần đăng nhập THẤT BẠI (khớp thông báo "đăng nhập sai")
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

// Chống dò email / spam hộp thư theo IP. Test chạy hàng loạt từ 1 IP nên nới rất lớn.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 100_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(HttpError.tooMany('Bạn yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút')),
});

const metaOf = (req: Request): SessionMeta => ({ ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 200) });

authRouter.post('/register', async (req, res) => {
  const body = registerBody.parse(req.body);
  sendSession(res, await authService.register(body, metaOf(req)));
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const body = loginBody.parse(req.body);
  sendSession(res, await authService.login(body, metaOf(req)));
});

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw HttpError.unauthorized('Chưa đăng nhập');
  sendSession(res, await authService.refresh(token, metaOf(req)));
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await authService.logout(req.userId!);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.status(204).end();
});

// Đăng xuất mọi thiết bị (logout hiện tại cũng thu hồi toàn bộ; endpoint này để FE gọi tên rõ ràng).
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await authService.logoutAll(req.userId!);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ data: await authService.me(req.userId!) });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = updateProfileBody.parse(req.body);
  res.json({ data: await authService.updateProfile(req.userId!, body) });
});

authRouter.delete('/me', requireAuth, async (req, res) => {
  const { password } = deleteAccountBody.parse(req.body ?? {});
  await authService.deleteAccount(req.userId!, password);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.status(204).end();
});

authRouter.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = forgotPasswordBody.parse(req.body);
  await authService.forgotPassword(email);
  res.json({ data: { message: FORGOT_PASSWORD_MESSAGE } });
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = resetPasswordBody.parse(req.body);
  await authService.resetPassword(token, password);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.json({ data: { message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại' } });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordBody.parse(req.body);
  // Phiên hiện tại = sid trong access token (không phụ thuộc cookie); cookie chỉ là dự phòng.
  const keepSid = req.sessionId ?? (await peekSessionId(req.cookies?.[REFRESH_COOKIE_NAME]));
  await authService.changePassword(req.userId!, currentPassword, newPassword, keepSid);
  res.json({ data: { message: 'Đổi mật khẩu thành công' } });
});

authRouter.post('/send-verification', requireAuth, async (req, res) => {
  await authService.sendVerification(req.userId!);
  res.status(202).json({ data: { message: 'Đã gửi email xác thực' } });
});

authRouter.post('/verify-email', async (req, res) => {
  const { token } = verifyEmailBody.parse(req.body);
  res.json({ data: await authService.verifyEmail(token) });
});

authRouter.get('/sessions', requireAuth, async (req, res) => {
  const currentSid = req.sessionId ?? (await peekSessionId(req.cookies?.[REFRESH_COOKIE_NAME]));
  res.json({ data: (await authService.listSessions(req.userId!)).map((s) => ({ ...s, current: s.id === currentSid })) });
});

authRouter.delete('/sessions/:id', requireAuth, async (req, res) => {
  await authService.revokeSession(req.userId!, String(req.params.id));
  res.status(204).end();
});
