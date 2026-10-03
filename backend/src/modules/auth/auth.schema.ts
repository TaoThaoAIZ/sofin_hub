import { z } from 'zod';
import { referralCodeField } from '../referrals/referrals.schema.js';
import { checkHandleFormat } from './handle.js';

const emailField = z.string().trim().toLowerCase().email('Email không hợp lệ').max(180);

/** Quy tắc mật khẩu dùng chung: >= 8 ký tự, có chữ in hoa và ký tự đặc biệt. */
export const passwordRule = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
  .max(200)
  .regex(/[A-Z]/, 'Mật khẩu cần ít nhất 1 chữ in hoa')
  .regex(/[^A-Za-z0-9]/, 'Mật khẩu cần ít nhất 1 ký tự đặc biệt');

export const registerBody = z.object({
  firstName: z.string().trim().min(1, 'Vui lòng nhập tên').max(80),
  lastName: z.string().trim().min(1, 'Vui lòng nhập họ').max(80),
  email: emailField,
  password: passwordRule,
  /** Mã giới thiệu (?ref=) — tùy chọn; mã lạ bị bỏ qua êm. */
  referralCode: referralCodeField,
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
export type LoginBody = z.infer<typeof loginBody>;

export const forgotPasswordBody = z.object({ email: emailField });

export const resetPasswordBody = z.object({
  token: z.string().trim().min(1, 'Thiếu mã đặt lại mật khẩu').max(200),
  password: passwordRule,
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: passwordRule,
});

export const verifyEmailBody = z.object({ token: z.string().trim().min(1, 'Thiếu mã xác thực').max(200) });

export const deleteAccountBody = z.object({ password: z.string().min(1, 'Vui lòng nhập mật khẩu để xác nhận') });

const httpUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }, message);

/** Chuỗi rỗng / null = xóa trường. */
const clearable = <T extends z.ZodType<string>>(schema: T) =>
  z.union([z.literal('').transform(() => null), z.null(), schema]).optional();

/** Handle: chữ thường (tự hạ chữ hoa), chỉ kiểm định dạng ở đây; trùng/giữ chỗ do service kiểm. */
export const handleField = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => checkHandleFormat(v) !== 'invalid', 'Đường dẫn hồ sơ gồm 3-24 ký tự a-z, 0-9, dấu chấm hoặc gạch dưới');

/** Instagram: nhận "@tên" hoặc "tên" (chữ, số, ., _), lưu không kèm @. */
const instagramField = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ''))
  .refine((v) => /^[A-Za-z0-9._]{1,30}$/.test(v), 'Tên Instagram không hợp lệ');

export const updateProfileBody = z.object({
  handle: z.union([z.literal('').transform(() => null), z.null(), handleField]).optional(),
  instagram: z.union([z.literal('').transform(() => null), z.null(), instagramField]).optional(),
  youtube: clearable(httpUrl('Liên kết YouTube phải là URL http/https hợp lệ')),
  showOnMap: z.boolean().optional(),
  firstName: z.string().trim().min(1, 'Vui lòng nhập tên').max(80).optional(),
  lastName: z.string().trim().min(1, 'Vui lòng nhập họ').max(80).optional(),
  bio: clearable(z.string().trim().max(150, 'Giới thiệu tối đa 150 ký tự')),
  location: clearable(z.string().trim().max(120, 'Địa điểm tối đa 120 ký tự')),
  website: clearable(httpUrl('Website phải là URL http/https hợp lệ')),
  // Chấp nhận URL http/https hoặc đường dẫn nội bộ /files/... hoặc /api/files/... (ảnh do module upload phục vụ).
  avatarUrl: clearable(
    z
      .string()
      .trim()
      .max(500)
      .refine((v) => ((v.startsWith('/files/') || v.startsWith('/api/files/')) && !v.includes('..')) || httpUrl('x').safeParse(v).success, 'Ảnh đại diện phải là URL http/https hoặc đường dẫn /files/...'),
  ),
});
export type UpdateProfileBody = z.infer<typeof updateProfileBody>;


export const handleAvailableQuery = z.object({ handle: z.string().trim().toLowerCase().max(60) });

export const THEMES = ['light', 'dark', 'system'] as const;
export const LANGUAGES = ['vi', 'en'] as const;

const validTimezone = (v: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: v });
    return true;
  } catch {
    return false;
  }
};

/** Tùy chọn cá nhân — chỉ lưu (FE chưa có i18n/dark mode). */
export const preferencesBody = z
  .object({
    language: z.enum(LANGUAGES, { error: 'Ngôn ngữ không hợp lệ' }).optional(),
    timezone: z.string().trim().max(60).refine(validTimezone, 'Múi giờ không hợp lệ').optional(),
    theme: z.enum(THEMES, { error: 'Giao diện không hợp lệ' }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Không có gì để cập nhật');

export const changeEmailBody = z.object({
  newEmail: emailField,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
});

const totpCode = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ''))
  .refine((v) => /^\d{6}$/.test(v), 'Mã gồm 6 chữ số');

export const twoFactorCodeBody = z.object({ code: totpCode });
/** Tắt 2FA: mã 6 số là bắt buộc; mật khẩu tùy chọn (nếu gửi thì phải đúng). */
export const twoFactorDisableBody = z.object({ code: totpCode, password: z.string().min(1).optional() });
export const loginTwoFactorBody = z.object({ ticket: z.string().trim().min(1, 'Thiếu phiên xác minh').max(2000), code: totpCode });
