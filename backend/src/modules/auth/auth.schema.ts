import { z } from 'zod';

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

export const updateProfileBody = z.object({
  firstName: z.string().trim().min(1, 'Vui lòng nhập tên').max(80).optional(),
  lastName: z.string().trim().min(1, 'Vui lòng nhập họ').max(80).optional(),
  bio: clearable(z.string().trim().max(500, 'Giới thiệu tối đa 500 ký tự')),
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
