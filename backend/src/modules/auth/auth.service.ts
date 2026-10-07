import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { mailTemplates } from '../mail/mail-templates.service.js';
import { referralsService } from '../referrals/referrals.service.js';
import { prisma } from '../../db/prisma.js';
import { userRepository, type UserRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody, ResendOtpBody, UpdateProfileBody, VerifyRegistrationBody } from './auth.schema.js';
import { toAuthUser, type AuthUser, type User } from './auth.types.js';
import { assertCanSignIn, recordLogin } from './user-status.js';
import { accountService } from './account.service.js';
import { otpService } from './otp.service.js';
import type { SocialProfile } from './oauth.js';
import { checkTotpCode, signTwoFactorTicket, verifyTwoFactorTicket } from './two-factor.js';
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

/** Kết quả đăng ký: CHƯA có phiên. FE chuyển sang màn nhập OTP; `emailSent=false` nghĩa là nhà cung cấp mail lỗi (người dùng bấm "Gửi lại"). */
export interface RegistrationPending {
  verificationRequired: true;
  email: string;
  emailSent: boolean;
  /** Số giây tới lần gửi lại hợp lệ. */
  resendInSec: number;
}

/** Mật khẩu "không đăng nhập được" cho tài khoản chỉ dùng mạng xã hội (không phải hash bcrypt hợp lệ nên bcrypt.compare luôn false). */
const UNUSABLE_PASSWORD = '!oauth';

/** Đăng nhập đúng mật khẩu nhưng tài khoản bật 2FA: chưa cấp phiên, FE gửi tiếp mã 6 số kèm `ticket` tới /auth/login/2fa. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  ticket: string;
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

  const pending = (email: string, emailSent: boolean, resendInSec = 60): RegistrationPending => ({ verificationRequired: true, email, emailSent, resendInSec });

  /** Phát hành OTP đăng ký và gửi mail. Ném 429 khi vi phạm cooldown; trả false nếu mail lỗi (đã log, không ném để user bấm "Gửi lại"). */
  async function sendRegisterOtp(user: User): Promise<boolean> {
    const { code } = await otpService.issue(user.id, 'register');
    const minutes = '10';
    const ok = await mailTemplates.send('register_otp', user.email, { name: user.firstName, code, minutes }, {
      subject: `${code} là mã xác thực SofinHub của bạn`,
      text: `Xin chào ${user.firstName},\n\nMã xác thực email SofinHub của bạn là: ${code}\nMã có hiệu lực ${minutes} phút và chỉ dùng được một lần. Không chia sẻ mã này cho bất kỳ ai.\n\nNếu bạn không đăng ký tài khoản, hãy bỏ qua email này.`,
      html: `<p>Xin chào ${escapeHtml(user.firstName)},</p><p>Mã xác thực email SofinHub của bạn là:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã có hiệu lực ${minutes} phút và chỉ dùng được một lần. Không chia sẻ mã này cho bất kỳ ai.</p><p>Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.</p>`,
    });
    if (!ok) console.error(`[auth] không gửi được OTP đăng ký tới user ${user.id}`);
    return ok;
  }

  return {
    /**
     * Tạo tài khoản CHƯA xác thực + gửi OTP về email; không cấp phiên. Email của tài khoản chưa xác thực được đăng ký lại (ghi đè họ tên,
     * mật khẩu) để đăng ký dở không chiếm mất email; email của tài khoản đã xác thực vẫn 409.
     */
    async register({ firstName, lastName, email, password }: RegisterBody): Promise<RegistrationPending> {
      const existing = await repo.findByEmail(email);
      if (existing && (existing.emailVerified || existing.isDemo || existing.deletedAt)) throw HttpError.conflict('Email này đã được đăng ký');
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      let user: User;
      if (existing) {
        // Phát hành OTP trước (có thể 429 do cooldown) rồi mới ghi đè, để request bị từ chối không đổi gì.
        const sent = await sendRegisterOtp(existing);
        user = (await repo.update(existing.id, { firstName, lastName, passwordHash })) ?? existing;
        return pending(user.email, sent);
      }
      try {
        user = await repo.create({ firstName, lastName, email, passwordHash });
      } catch (e) {
        // Hai request đăng ký song song cùng email: unique index chặn ở DB.
        if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Email này đã được đăng ký');
        throw e;
      }
      return pending(user.email, await sendRegisterOtp(user));
    },

    /** Nhập đúng OTP => xác thực email, ghi nhận người giới thiệu và cấp phiên như đăng nhập. */
    async verifyRegistration({ email, code, referralCode }: VerifyRegistrationBody, meta?: SessionMeta): Promise<AuthSession> {
      const user = await repo.findByEmail(email);
      // Cùng một lỗi cho email lạ / đã xác thực: không cho dò email nào đang chờ xác thực.
      if (!user || user.emailVerified || user.isDemo || user.deletedAt) {
        throw HttpError.coded(400, 'OTP_INVALID', 'Mã không đúng hoặc đã hết hạn', {});
      }
      await otpService.verify(user.id, 'register', code);
      const verified = (await repo.update(user.id, { emailVerified: true })) ?? user;
      await assertCanSignIn(user.id);
      await recordLogin(user.id);
      await referralsService.attribute(user.id, referralCode); // sau xác thực để tránh referral ảo; không bao giờ làm hỏng xác thực
      return issueSession(verified, meta);
    },

    /** Gửi lại OTP. Luôn thành công với email lạ/đã xác thực (không lộ trạng thái); chỉ cooldown/giới hạn giờ mới báo 429. */
    async resendRegistrationOtp({ email }: ResendOtpBody): Promise<RegistrationPending> {
      const user = await repo.findByEmail(email);
      if (!user || user.emailVerified || user.isDemo || user.deletedAt) return pending(email, true, 60);
      return pending(user.email, await sendRegisterOtp(user));
    },

    async login({ email, password }: LoginBody, meta?: SessionMeta): Promise<AuthSession | TwoFactorChallenge> {
      const user = await repo.findByEmail(email);
      // Thành viên minh họa (isDemo) không bao giờ đăng nhập được.
      if (!user || user.isDemo || user.deletedAt || !(await bcrypt.compare(password, user.passwordHash))) {
        throw HttpError.unauthorized('Email hoặc mật khẩu không đúng');
      }
      // Sau khi mật khẩu đúng mới báo tình trạng tài khoản (không lộ trạng thái cho người đoán mật khẩu).
      if (!user.emailVerified) {
        // Chưa xác thực email: gửi lại OTP (nuốt lỗi cooldown — mã cũ vẫn dùng được) rồi để FE đưa sang màn nhập mã.
        await sendRegisterOtp(user).catch(() => undefined);
        throw HttpError.coded(403, 'EMAIL_NOT_VERIFIED', 'Vui lòng xác thực email bằng mã OTP đã gửi tới hộp thư của bạn', { email: user.email });
      }
      await assertCanSignIn(user.id);
      if (user.twoFactorEnabled && user.totpSecret) return { twoFactorRequired: true, ticket: signTwoFactorTicket(user.id) };
      await recordLogin(user.id);
      return issueSession(user, meta);
    },

    /** Bước 2 đăng nhập khi bật 2FA: vé từ bước 1 + mã TOTP (chặn thử sai quá nhiều, chặn dùng lại mã). */
    async loginTwoFactor(ticket: string, code: string, meta?: SessionMeta): Promise<AuthSession> {
      const userId = verifyTwoFactorTicket(ticket);
      const user = userId ? await repo.findById(userId) : undefined;
      if (!user || user.isDemo || user.deletedAt || !user.twoFactorEnabled || !user.totpSecret) {
        throw HttpError.unauthorized('Phiên xác minh đã hết hạn, vui lòng đăng nhập lại');
      }
      if (!(await checkTotpCode(user.id, user.totpSecret, code))) throw HttpError.unauthorized('Mã xác minh không đúng hoặc đã hết hạn');
      await assertCanSignIn(user.id);
      await recordLogin(user.id);
      return issueSession(user, meta);
    },

    /**
     * Đăng nhập / đăng ký bằng Google hoặc Facebook (profile đã được xác thực bởi nhà cung cấp, xem oauth.ts).
     * Thứ tự: đã liên kết => dùng tài khoản đó; trùng email => liên kết vào tài khoản có sẵn; chưa có => tạo mới (đã xác thực email).
     */
    async loginWithSocial(profile: SocialProfile, referralCode: string | undefined, meta?: SessionMeta): Promise<AuthSession | TwoFactorChallenge> {
      const email = profile.email?.trim().toLowerCase();
      let user: User | undefined;
      const link = await prisma.socialAccount.findUnique({ where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.id } } });
      if (link) {
        user = await repo.findById(link.userId);
      } else {
        // Chỉ tin email do nhà cung cấp xác nhận: nếu không, ai cũng có thể chiếm tài khoản của người khác bằng email giả.
        if (!email || !profile.emailVerified) throw HttpError.coded(400, 'OAUTH_NO_EMAIL', 'Tài khoản mạng xã hội chưa có email đã xác minh, vui lòng đăng ký bằng email.');
        const existing = await repo.findByEmail(email);
        if (existing) {
          if (existing.isDemo || existing.deletedAt) throw HttpError.conflict('Email này đã được đăng ký');
          user = existing;
          if (!existing.emailVerified) {
            // Tài khoản email+mật khẩu chưa xác thực: người giữ email thật vừa chứng minh quyền sở hữu qua nhà cung cấp => xác thực, và
            // vô hiệu mật khẩu cũ (có thể do kẻ khác đặt khi đăng ký trước bằng email của họ).
            await repo.update(existing.id, { emailVerified: true, passwordHash: UNUSABLE_PASSWORD });
            await otpService.purge(existing.id);
            user = { ...existing, emailVerified: true, passwordHash: UNUSABLE_PASSWORD };
          }
        } else {
          try {
            const created = await prisma.user.create({
              data: { email, firstName: profile.firstName || 'Thành viên', lastName: profile.lastName, passwordHash: UNUSABLE_PASSWORD, emailVerified: true, avatarUrl: profile.avatarUrl ?? null },
            });
            user = (await repo.findById(created.id)) ?? undefined;
          } catch (e) {
            if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Email này đã được đăng ký');
            throw e;
          }
          if (user) await referralsService.attribute(user.id, referralCode);
        }
        if (user) {
          await prisma.socialAccount
            .create({ data: { userId: user.id, provider: profile.provider, providerUserId: profile.id, email: email ?? null } })
            .catch((e: { code?: string }) => {
              if (e.code !== 'P2002') throw e; // song song đã liên kết: bỏ qua
            });
        }
      }
      if (!user || user.isDemo || user.deletedAt) throw HttpError.unauthorized('Không thể đăng nhập bằng tài khoản này');
      await assertCanSignIn(user.id);
      if (user.twoFactorEnabled && user.totpSecret) return { twoFactorRequired: true, ticket: signTwoFactorTicket(user.id) };
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
      const patch: Record<string, string | boolean | undefined> = {};
      for (const [key, value] of Object.entries(body)) {
        if (value === undefined) continue;
        patch[key] = value === null ? undefined : value;
      }
      if (typeof patch.handle === 'string') await accountService.assertHandleUsable(userId, patch.handle);
      let updated: User | undefined;
      try {
        updated = await repo.update(userId, patch);
      } catch (e) {
        // Hai người cùng giành 1 handle: unique index chặn ở DB.
        if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Đường dẫn hồ sơ này đã có người dùng');
        throw e;
      }
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
      await repo.update(user.id, { passwordHash: await bcrypt.hash(password, SALT_ROUNDS), passwordChangedAt: new Date().toISOString(), emailVerified: true }); // link trong email = đã chứng minh sở hữu email (cũng là đường vào cho admin được mời)
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
      await repo.update(userId, { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS), passwordChangedAt: new Date().toISOString() });
      // Giữ phiên hiện tại (response không đổi hình dạng nên không thể cấp lại token); các phiên khác bị thu hồi
      // => access token của chúng chết ngay. Không tăng tokenVersion vì sẽ giết luôn token của phiên hiện tại.
      await revokeOtherSessions(userId, keepSid);
    },

    async sendVerification(userId: string): Promise<void> {
      const user = await requireUser(userId);
      // Đang chờ xác nhận email mới: gửi lại link tới email MỚI (không coi là đã xác thực).
      if (user.emailVerified && !user.pendingEmail) throw HttpError.conflict('Email đã được xác thực');
      // Cooldown dựa vào thời điểm phát hành token verify hiện hành (bền vững qua restart / nhiều instance).
      const age = await oneTimeTokenAgeMs(userId, 'verify-email');
      if (age !== null && age < VERIFY_COOLDOWN_MS) {
        throw HttpError.tooMany('Vui lòng đợi 60 giây trước khi yêu cầu gửi lại email xác thực');
      }
      if (user.pendingEmail) return accountService.sendPendingEmailLink(user, user.pendingEmail);
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
      let updated: User | undefined;
      try {
        // Có pendingEmail => token này xác nhận email MỚI: hoán đổi email (kiểm lại unique ở DB).
        const cur = userId ? await repo.findById(userId) : undefined;
        updated = cur?.pendingEmail ? await repo.applyPendingEmail(cur.id) : userId ? await repo.update(userId, { emailVerified: true }) : undefined;
      } catch (e) {
        if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Email này đã được sử dụng bởi tài khoản khác');
        throw e;
      }
      if (!updated) throw HttpError.badRequest('Liên kết xác thực không hợp lệ hoặc đã hết hạn');
      return toAuthUser(updated);
    },

    async deleteAccount(userId: string, password: string): Promise<void> {
      const user = await requireUser(userId);
      if (!(await bcrypt.compare(password, user.passwordHash))) throw HttpError.badRequest('Mật khẩu không đúng');
      const blockers = await accountService.deleteBlockers(userId);
      if (blockers.ownedCommunities.length > 0 || blockers.activeSubscriptions > 0) {
        throw HttpError.coded(409, 'ACCOUNT_DELETE_BLOCKED', 'Hãy chuyển quyền sở hữu cộng đồng và hủy các gói thành viên đang hoạt động trước khi xóa tài khoản', blockers);
      }
      const memberships = await enrollmentService.listByUser(userId);
      for (const m of memberships) await enrollmentService.remove(userId, m.communityId);
      // Ẩn danh hóa (không xóa hàng User): bài viết, bình luận, điểm, thanh toán được giữ; bài cũ hiển thị "Thành viên đã xóa".
      // Thu hồi trước để access token chết ngay cả khi bước ẩn danh hóa thất bại giữa chừng.
      await repo.bumpTokenVersion(userId);
      await revokeAllSessions(userId);
      await purgeOneTimeTokens(userId);
      await repo.anonymize(userId);
    },

    /** Đăng xuất mọi thiết bị KHÁC, giữ phiên hiện tại (khác logoutAll thu hồi tất cả). */
    async logoutOthers(userId: string, keepSid: string): Promise<void> {
      await revokeOtherSessions(userId, keepSid);
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
