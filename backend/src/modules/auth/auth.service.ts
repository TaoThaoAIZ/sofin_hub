import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { mailTemplates } from '../mail/mail-templates.service.js';
import { userRepository, type UserRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody, UpdateProfileBody } from './auth.schema.js';
import { toAuthUser, type AuthUser, type User } from './auth.types.js';
import { assertCanSignIn, recordLogin } from './user-status.js';
import { consumeOneTimeToken, issueOneTimeToken, oneTimeTokenAgeMs, purgeOneTimeTokens } from './one-time-tokens.js';
import {
  consumeRefreshToken,
  issueRefreshToken,
  listSessions,
  revokeAllSessions,
  revokeOtherSessions,
  revokeSession,
  signAccessToken,
  type SessionInfo,
  type SessionMeta,
} from './tokens.js';

const SALT_ROUNDS = 10;
const RESET_TTL_MS = 30 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFY_COOLDOWN_MS = 60 * 1000;

export const FORGOT_PASSWORD_MESSAGE = 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.';

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export function createAuthService(repo: UserRepository = userRepository) {
  /** Cấp phiên: tạo/xoay Session rồi ký access token mang `sid` + `tv` (để thu hồi tức thì). */
  async function issueSession(user: User, meta?: SessionMeta, sid?: string): Promise<AuthSession> {
    const refresh = await issueRefreshToken(user.id, meta, sid);
    if (!refresh) throw HttpError.unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    return {
      user: toAuthUser(user),
      accessToken: signAccessToken(user.id, refresh.sid, user.tokenVersion ?? 0),
      refreshToken: refresh.token,
    };
  }

  async function requireUser(userId: string) {
    const user = await repo.findById(userId);
    if (!user || user.deletedAt) throw HttpError.unauthorized();
    return user;
  }

  return {
    async register({ firstName, lastName, email, password }: RegisterBody, meta?: SessionMeta): Promise<AuthSession> {
      if (await repo.findByEmail(email)) throw HttpError.conflict('Email này đã được đăng ký');
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      let user: User;
      try {
        user = await repo.create({ firstName, lastName, email, passwordHash });
      } catch (e) {
        // Hai request đăng ký song song cùng email: unique index chặn ở DB.
        if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Email này đã được đăng ký');
        throw e;
      }
      return issueSession(user, meta);
    },

    async login({ email, password }: LoginBody, meta?: SessionMeta): Promise<AuthSession> {
      const user = await repo.findByEmail(email);
      // Thành viên minh họa (isDemo) không bao giờ đăng nhập được.
      if (!user || user.isDemo || user.deletedAt || !(await bcrypt.compare(password, user.passwordHash))) {
        throw HttpError.unauthorized('Email hoặc mật khẩu không đúng');
      }
      // Sau khi mật khẩu đúng mới báo tình trạng tài khoản (không lộ trạng thái cho người đoán mật khẩu).
      await assertCanSignIn(user.id);
      await recordLogin(user.id);
      return issueSession(user, meta);
    },

    async refresh(refreshToken: string, meta?: SessionMeta): Promise<AuthSession> {
      const payload = await consumeRefreshToken(refreshToken);
      if (!payload) throw HttpError.unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
      const user = await repo.findById(payload.sub);
      if (!user || user.deletedAt) throw HttpError.unauthorized('Tài khoản không tồn tại');
      await assertCanSignIn(user.id);
      return issueSession(user, meta, payload.sid);
    },

    /** Hành vi vốn có: đăng xuất thu hồi MỌI phiên của user (access token của chúng chết ngay). */
    async logout(userId: string): Promise<void> {
      await revokeAllSessions(userId);
    },

    /** Như logout, thêm tăng tokenVersion để chắc chắn mọi access token cũ vô hiệu. */
    async logoutAll(userId: string): Promise<void> {
      await repo.bumpTokenVersion(userId);
      await revokeAllSessions(userId);
    },

    async me(userId: string): Promise<AuthUser> {
      return toAuthUser(await requireUser(userId));
    },

    async updateProfile(userId: string, body: UpdateProfileBody): Promise<AuthUser> {
      await requireUser(userId);
      // null (từ chuỗi rỗng) = xóa trường; undefined = giữ nguyên.
      const patch: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(body)) {
        if (value === undefined) continue;
        patch[key] = value === null ? undefined : value;
      }
      const updated = await repo.update(userId, patch);
      if (!updated) throw HttpError.unauthorized();
      return toAuthUser(updated);
    },

    /** Luôn thành công với cùng một thông điệp, không lộ email có tồn tại hay không. */
    async forgotPassword(email: string): Promise<void> {
      const user = await repo.findByEmail(email);
      if (!user) return;
      const token = await issueOneTimeToken(user.id, 'reset-password', RESET_TTL_MS);
      const link = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await mailTemplates.send('reset_password', user.email, { name: user.firstName, link }, {
        subject: 'Đặt lại mật khẩu SofinHub',
        text: `Xin chào ${user.firstName},\n\nBấm vào liên kết sau để đặt lại mật khẩu (hiệu lực 30 phút):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
        html: `<p>Xin chào ${escapeHtml(user.firstName)},</p><p><a href="${link}">Đặt lại mật khẩu</a> (hiệu lực 30 phút).</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
      });
    },

    async resetPassword(token: string, password: string): Promise<void> {
      const userId = await consumeOneTimeToken(token, 'reset-password');
      const user = userId ? await repo.findById(userId) : undefined;
      if (!user) throw HttpError.badRequest('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
      await repo.update(user.id, { passwordHash: await bcrypt.hash(password, SALT_ROUNDS) });
      // Tăng tokenVersion + thu hồi mọi phiên: mọi access/refresh token cũ chết ngay.
      await repo.bumpTokenVersion(user.id);
      await revokeAllSessions(user.id);
    },

    /** keepSid: phiên hiện tại (nếu biết) được giữ lại, mọi phiên khác bị thu hồi. */
    async changePassword(userId: string, currentPassword: string, newPassword: string, keepSid?: string): Promise<void> {
      const user = await requireUser(userId);
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        // 400 (không phải 401) để FE không tưởng phiên hết hạn rồi tự đăng xuất.
        throw HttpError.badRequest('Mật khẩu hiện tại không đúng');
      }
      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        throw HttpError.badRequest('Mật khẩu mới không được trùng mật khẩu hiện tại');
      }
      await repo.update(userId, { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS) });
      // Giữ phiên hiện tại (response không đổi hình dạng nên không thể cấp lại token); các phiên khác bị thu hồi
      // => access token của chúng chết ngay. Không tăng tokenVersion vì sẽ giết luôn token của phiên hiện tại.
      await revokeOtherSessions(userId, keepSid);
    },

    async sendVerification(userId: string): Promise<void> {
      const user = await requireUser(userId);
      if (user.emailVerified) throw HttpError.conflict('Email đã được xác thực');
      // Cooldown dựa vào thời điểm phát hành token verify hiện hành (bền vững qua restart / nhiều instance).
      const age = await oneTimeTokenAgeMs(userId, 'verify-email');
      if (age !== null && age < VERIFY_COOLDOWN_MS) {
        throw HttpError.tooMany('Vui lòng đợi 60 giây trước khi yêu cầu gửi lại email xác thực');
      }
      const token = await issueOneTimeToken(userId, 'verify-email', VERIFY_TTL_MS);
      const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
      await mailTemplates.send('verify_email', user.email, { name: user.firstName, link }, {
        subject: 'Xác thực email SofinHub',
        text: `Xin chào ${user.firstName},\n\nBấm vào liên kết sau để xác thực email (hiệu lực 24 giờ):\n${link}`,
        html: `<p>Xin chào ${escapeHtml(user.firstName)},</p><p><a href="${link}">Xác thực email</a> (hiệu lực 24 giờ).</p>`,
      });
    },

    async verifyEmail(token: string): Promise<AuthUser> {
      const userId = await consumeOneTimeToken(token, 'verify-email');
      const updated = userId ? await repo.update(userId, { emailVerified: true }) : undefined;
      if (!updated) throw HttpError.badRequest('Liên kết xác thực không hợp lệ hoặc đã hết hạn');
      return toAuthUser(updated);
    },

    async deleteAccount(userId: string, password: string): Promise<void> {
      const user = await requireUser(userId);
      if (!(await bcrypt.compare(password, user.passwordHash))) throw HttpError.badRequest('Mật khẩu không đúng');
      const memberships = await enrollmentService.listByUser(userId);
      if (memberships.some((m) => m.role === 'owner')) {
        throw HttpError.conflict('Bạn đang là chủ của một cộng đồng, hãy chuyển quyền sở hữu trước khi xóa tài khoản');
      }
      for (const m of memberships) await enrollmentService.remove(userId, m.courseId);
      // Ẩn danh hóa (không xóa hàng User): bài viết, bình luận, điểm, thanh toán được giữ; bài cũ hiển thị "Thành viên đã xóa".
      // Thu hồi trước để access token chết ngay cả khi bước ẩn danh hóa thất bại giữa chừng.
      await repo.bumpTokenVersion(userId);
      await revokeAllSessions(userId);
      await purgeOneTimeTokens(userId);
      await repo.anonymize(userId);
    },

    listSessions(userId: string): Promise<SessionInfo[]> {
      return listSessions(userId);
    },

    async revokeSession(userId: string, sid: string): Promise<void> {
      if (!(await revokeSession(userId, sid))) throw HttpError.notFound('Không tìm thấy phiên đăng nhập');
    },
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const authService = createAuthService();
