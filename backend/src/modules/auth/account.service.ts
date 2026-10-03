import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { mailTemplates } from '../mail/mail-templates.service.js';
import { userRepository, type UserRepository } from './auth.repository.js';
import { toAuthUser, type AuthUser, type User } from './auth.types.js';
import { checkHandleFormat } from './handle.js';
import { issueOneTimeToken, oneTimeTokenAgeMs } from './one-time-tokens.js';
import { generateTotpSecret, otpauthUrl } from './totp.js';
import { checkTotpCode } from './two-factor.js';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFY_COOLDOWN_MS = 60 * 1000;

export interface DeleteBlockers {
  ownedCommunities: { id: string; title: string }[];
  /** Gói thành viên đang dùng thử/hoạt động mà chưa đặt hủy cuối kỳ. */
  activeSubscriptions: number;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function createAccountService(repo: UserRepository = userRepository) {
  async function requireUser(userId: string): Promise<User> {
    const user = await repo.findById(userId);
    if (!user || user.deletedAt) throw HttpError.unauthorized();
    return user;
  }

  async function requirePassword(user: User, password: string) {
    // 400 (không phải 401) để FE không tưởng phiên hết hạn rồi tự đăng xuất.
    if (!(await bcrypt.compare(password, user.passwordHash))) throw HttpError.badRequest('Mật khẩu không đúng');
  }

  async function handleAvailability(userId: string, raw: string): Promise<{ available: boolean; reason?: 'invalid' | 'reserved' | 'taken' }> {
    const handle = raw.replace(/^@/, '');
    const fmt = checkHandleFormat(handle);
    if (fmt !== 'ok') return { available: false, reason: fmt };
    const owner = await repo.findByHandle(handle);
    if (owner && owner.id !== userId) return { available: false, reason: 'taken' };
    return { available: true };
  }

  async function sendPendingEmailLink(user: User, to: string): Promise<void> {
    const token = await issueOneTimeToken(user.id, 'verify-email', VERIFY_TTL_MS);
    const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await mailTemplates.send('verify_email', to, { name: user.firstName, link }, {
      subject: 'Xác nhận email mới trên SofinHub',
      text: `Xin chào ${user.firstName},\n\nBấm vào liên kết sau để xác nhận email mới cho tài khoản SofinHub (hiệu lực 24 giờ):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `<p>Xin chào ${escapeHtml(user.firstName)},</p><p><a href="${link}">Xác nhận email mới</a> (hiệu lực 24 giờ).</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    });
  }

  return {
    /** Kiểm tra handle cho ô "Đường dẫn hồ sơ": bỏ qua handle của chính user. */
    handleAvailability,

    /** Gọi từ updateProfile khi body có handle (đã chuẩn hóa): ném 409 nếu giữ chỗ hoặc đã có người dùng. */
    async assertHandleUsable(userId: string, handle: string): Promise<void> {
      const a = await handleAvailability(userId, handle);
      if (a.available) return;
      if (a.reason === 'reserved') throw HttpError.conflict('Đường dẫn này được hệ thống giữ chỗ, hãy chọn tên khác');
      if (a.reason === 'taken') throw HttpError.conflict('Đường dẫn hồ sơ này đã có người dùng');
      throw HttpError.badRequest('Đường dẫn hồ sơ không hợp lệ');
    },

    sendPendingEmailLink,

    async updatePreferences(userId: string, patch: { language?: string; timezone?: string; theme?: string }): Promise<AuthUser> {
      await requireUser(userId);
      const updated = await repo.update(userId, patch);
      if (!updated) throw HttpError.unauthorized();
      return toAuthUser(updated);
    },

    /** Đổi email: lưu pendingEmail rồi gửi link xác minh tới địa chỉ MỚI. Email chỉ đổi khi bấm link (verify-email). */
    async changeEmail(userId: string, newEmail: string, password: string): Promise<{ pendingEmail: string }> {
      const user = await requireUser(userId);
      await requirePassword(user, password);
      if (newEmail === user.email) throw HttpError.badRequest('Email mới phải khác email hiện tại');
      if (await repo.findByEmail(newEmail)) throw HttpError.conflict('Email này đã được sử dụng');
      const age = await oneTimeTokenAgeMs(userId, 'verify-email');
      if (age !== null && age < VERIFY_COOLDOWN_MS) {
        throw HttpError.tooMany('Vui lòng đợi 60 giây trước khi yêu cầu đổi email lần nữa');
      }
      await repo.update(userId, { pendingEmail: newEmail });
      await sendPendingEmailLink(user, newEmail);
      return { pendingEmail: newEmail };
    },

    /** Bước 1 bật 2FA: sinh bí mật mới (ghi đè nếu thiết lập dở), CHƯA bật. Chỉ trả bí mật ở đây. */
    async setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
      const user = await requireUser(userId);
      if (user.twoFactorEnabled) throw HttpError.conflict('Xác minh 2 bước đã được bật');
      const secret = generateTotpSecret();
      await repo.update(userId, { totpSecret: secret });
      return { secret, otpauthUrl: otpauthUrl(user.email, secret) };
    },

    async enableTwoFactor(userId: string, code: string): Promise<AuthUser> {
      const user = await requireUser(userId);
      if (user.twoFactorEnabled) throw HttpError.conflict('Xác minh 2 bước đã được bật');
      if (!user.totpSecret) throw HttpError.badRequest('Hãy bắt đầu thiết lập xác minh 2 bước trước');
      if (!(await checkTotpCode(userId, user.totpSecret, code))) throw HttpError.badRequest('Mã xác minh không đúng hoặc đã hết hạn');
      const updated = await repo.update(userId, { twoFactorEnabled: true });
      return toAuthUser(updated!);
    },

    async disableTwoFactor(userId: string, code: string, password?: string): Promise<AuthUser> {
      const user = await requireUser(userId);
      if (!user.twoFactorEnabled || !user.totpSecret) throw HttpError.conflict('Xác minh 2 bước đang tắt');
      if (password !== undefined) await requirePassword(user, password);
      if (!(await checkTotpCode(userId, user.totpSecret, code))) throw HttpError.badRequest('Mã xác minh không đúng hoặc đã hết hạn');
      const updated = await repo.update(userId, { twoFactorEnabled: false, totpSecret: undefined });
      return toAuthUser(updated!);
    },

    /** Điều kiện chặn xóa tài khoản: đang là chủ cộng đồng hoặc còn gói thành viên hoạt động. */
    async deleteBlockers(userId: string): Promise<DeleteBlockers> {
      const memberships = await enrollmentService.listByUser(userId);
      const ownedIds = memberships.filter((m) => m.role === 'owner').map((m) => m.communityId);
      const briefs = ownedIds.length ? await catalogService.briefsByIds(ownedIds) : new Map<string, { title: string }>();
      const activeSubscriptions = await prisma.subscription.count({
        where: { userId, status: { in: ['trialing', 'active'] }, cancelAtPeriodEnd: false },
      });
      return { ownedCommunities: ownedIds.map((id) => ({ id, title: briefs.get(id)?.title ?? id })), activeSubscriptions };
    },
  };
}

export const accountService = createAccountService();
