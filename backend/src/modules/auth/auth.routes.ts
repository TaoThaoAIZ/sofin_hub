import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middlewares/auth.js';
import { isDev, isProd } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import {
  changeEmailBody,
  changePasswordBody,
  deleteAccountBody,
  forgotPasswordBody,
  loginBody,
  loginTwoFactorBody,
  preferencesBody,
  registerBody,
  resetPasswordBody,
  twoFactorCodeBody,
  twoFactorDisableBody,
  updateProfileBody,
  verifyEmailBody,
} from './auth.schema.js';
import { accountService } from './account.service.js';
import { authService, FORGOT_PASSWORD_MESSAGE, type AuthSession } from './auth.service.js';
import { parseUserAgent } from './user-agent.js';
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
    // Secure ở mọi môi trường trừ development (localhost http); SameSite=None chỉ ở production.
    secure: !isDev,
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
  const result = await authService.login(body, metaOf(req));
  // Bật 2FA: chưa có phiên/cookie, FE gọi tiếp /login/2fa với vé này.
  if ('twoFactorRequired' in result) {
    res.json({ data: result });
    return;
  }
  sendSession(res, result);
});

authRouter.post('/login/2fa', async (req, res) => {
  const { ticket, code } = loginTwoFactorBody.parse(req.body);
  sendSession(res, await authService.loginTwoFactor(ticket, code, metaOf(req)));
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

// Điều kiện đang chặn xóa tài khoản (FE hiện ở thẻ "Xóa tài khoản"); cùng dữ liệu với `details` của 409 ACCOUNT_DELETE_BLOCKED.
authRouter.get('/me/delete-blockers', requireAuth, async (req, res) => {
  res.json({ data: await accountService.deleteBlockers(req.userId!) });
});

authRouter.patch('/me/preferences', requireAuth, async (req, res) => {
  res.json({ data: await accountService.updatePreferences(req.userId!, preferencesBody.parse(req.body)) });
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

// Đổi email: lưu email chờ + gửi link xác nhận tới email mới (xác nhận qua /verify-email). Rate limit như quên mật khẩu.
authRouter.post('/change-email', requireAuth, forgotLimiter, async (req, res) => {
  const { newEmail, password } = changeEmailBody.parse(req.body);
  res.status(202).json({ data: await accountService.changeEmail(req.userId!, newEmail, password) });
});

authRouter.post('/2fa/setup', requireAuth, async (req, res) => {
  res.json({ data: await accountService.setupTwoFactor(req.userId!) });
});

authRouter.post('/2fa/enable', requireAuth, async (req, res) => {
  const { code } = twoFactorCodeBody.parse(req.body);
  res.json({ data: await accountService.enableTwoFactor(req.userId!, code) });
});

authRouter.post('/2fa/disable', requireAuth, async (req, res) => {
  const { code, password } = twoFactorDisableBody.parse(req.body);
  res.json({ data: await accountService.disableTwoFactor(req.userId!, code, password) });
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
  res.json({ data: (await authService.listSessions(req.userId!)).map((s) => ({ ...s, current: s.id === currentSid, device: parseUserAgent(s.userAgent) })) });
});

// Đăng xuất mọi thiết bị KHÁC, giữ thiết bị đang dùng (khác /logout-all thu hồi tất cả).
authRouter.post('/sessions/revoke-others', requireAuth, async (req, res) => {
  const keepSid = req.sessionId ?? (await peekSessionId(req.cookies?.[REFRESH_COOKIE_NAME]));
  if (!keepSid) throw HttpError.badRequest('Không xác định được phiên hiện tại');
  await authService.logoutOthers(req.userId!, keepSid);
  res.status(204).end();
});

authRouter.delete('/sessions/:id', requireAuth, async (req, res) => {
  await authService.revokeSession(req.userId!, String(req.params.id));
  res.status(204).end();
});
