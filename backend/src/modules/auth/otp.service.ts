import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';

/**
 * OTP 6 số gửi qua email (bảng EmailOtp). 6 số rất dễ dò nên bảo vệ chính là GIỚI HẠN SỐ LẦN THỬ (không phải việc băm):
 * mỗi lần kiểm tra đều tăng `attempts` NGUYÊN TỬ trước khi so khớp, nên các request song song cũng không vượt hạn mức.
 */
export type OtpPurpose = 'register';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

const hashCode = (userId: string, purpose: OtpPurpose, code: string) =>
  createHmac('sha256', env.OTP_PEPPER).update(`${userId}:${purpose}:${code}`).digest('hex');

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface IssuedOtp {
  code: string;
  expiresAt: Date;
  /** Thời điểm sớm nhất được gửi lại. */
  resendAt: Date;
}

export const otpService = {
  /**
   * Sinh mã mới (vô hiệu mã cũ, reset số lần sai). Áp cooldown 60 giây và tối đa 5 lần gửi / giờ / tài khoản; vi phạm => 429 OTP_RATE_LIMITED
   * kèm `details.retryAfterSec`. Trả mã thô CHỈ để đưa vào email — không log, không lưu.
   */
  async issue(userId: string, purpose: OtpPurpose, now = new Date()): Promise<IssuedOtp> {
    const existing = await prisma.emailOtp.findUnique({ where: { userId_purpose: { userId, purpose } } });
    let sendCount = 1;
    let sendWindowStart = now;
    if (existing) {
      const sinceLast = now.getTime() - existing.lastSentAt.getTime();
      if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLast) / 1000);
        throw HttpError.coded(429, 'OTP_RATE_LIMITED', `Vui lòng đợi ${retryAfterSec} giây trước khi gửi lại mã`, { retryAfterSec });
      }
      if (now.getTime() - existing.sendWindowStart.getTime() < HOUR_MS) {
        if (existing.sendCount >= OTP_MAX_SENDS_PER_HOUR) {
          const retryAfterSec = Math.ceil((existing.sendWindowStart.getTime() + HOUR_MS - now.getTime()) / 1000);
          throw HttpError.coded(429, 'OTP_RATE_LIMITED', 'Bạn đã yêu cầu gửi mã quá nhiều lần, vui lòng thử lại sau', { retryAfterSec });
        }
        sendCount = existing.sendCount + 1;
        sendWindowStart = existing.sendWindowStart;
      }
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const data = { codeHash: hashCode(userId, purpose, code), expiresAt, attempts: 0, lastSentAt: now, sendCount, sendWindowStart };
    await prisma.emailOtp.upsert({
      where: { userId_purpose: { userId, purpose } },
      create: { userId, purpose, ...data },
      update: data,
    });
    return { code, expiresAt, resendAt: new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS) };
  },

  /**
   * Kiểm tra mã; đúng thì xóa bản ghi (dùng 1 lần). Lỗi: 400 OTP_INVALID (kèm `attemptsLeft`), OTP_EXPIRED (hết hạn / chưa có mã),
   * OTP_LOCKED (sai quá 5 lần => mã bị hủy, phải gửi lại).
   */
  async verify(userId: string, purpose: OtpPurpose, code: string, now = new Date()): Promise<void> {
    const expired = () => HttpError.coded(400, 'OTP_EXPIRED', 'Mã xác thực đã hết hạn hoặc chưa được gửi, vui lòng gửi lại mã mới', {});
    // Tăng số lần thử TRƯỚC khi so khớp, chỉ khi mã còn hạn và chưa hết lượt (điều kiện nằm trong cùng câu UPDATE => atomic).
    const claimed = await prisma.emailOtp.updateMany({
      where: { userId, purpose, expiresAt: { gt: now }, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      const row = await prisma.emailOtp.findUnique({ where: { userId_purpose: { userId, purpose } } });
      if (row && row.expiresAt > now) {
        await prisma.emailOtp.deleteMany({ where: { id: row.id } });
        throw HttpError.coded(400, 'OTP_LOCKED', 'Bạn đã nhập sai quá nhiều lần, vui lòng gửi lại mã mới', {});
      }
      throw expired();
    }
    const row = await prisma.emailOtp.findUnique({ where: { userId_purpose: { userId, purpose } } });
    if (!row) throw expired();
    if (!safeEqualHex(row.codeHash, hashCode(userId, purpose, code))) {
      const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - row.attempts);
      if (attemptsLeft === 0) {
        await prisma.emailOtp.deleteMany({ where: { id: row.id } });
        throw HttpError.coded(400, 'OTP_LOCKED', 'Bạn đã nhập sai quá nhiều lần, vui lòng gửi lại mã mới', {});
      }
      throw HttpError.coded(400, 'OTP_INVALID', `Mã không đúng, bạn còn ${attemptsLeft} lần thử`, { attemptsLeft });
    }
    // Xóa là điều kiện để thành công: 2 request song song cùng mã đúng chỉ 1 request thắng.
    const consumed = await prisma.emailOtp.deleteMany({ where: { id: row.id, codeHash: row.codeHash } });
    if (consumed.count === 0) throw expired();
  },

  async purge(userId: string, purpose?: OtpPurpose): Promise<void> {
    await prisma.emailOtp.deleteMany({ where: { userId, ...(purpose ? { purpose } : {}) } });
  },

  /** Số giây còn lại tới lần gửi lại hợp lệ (0 = gửi được ngay) — để FE khởi tạo đồng hồ đếm ngược. */
  async resendInSec(userId: string, purpose: OtpPurpose, now = new Date()): Promise<number> {
    const row = await prisma.emailOtp.findUnique({ where: { userId_purpose: { userId, purpose } }, select: { lastSentAt: true } });
    if (!row) return 0;
    return Math.max(0, Math.ceil((row.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS - now.getTime()) / 1000));
  },
};
