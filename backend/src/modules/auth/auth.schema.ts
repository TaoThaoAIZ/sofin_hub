import { z } from 'zod';

export const registerBody = z.object({
  firstName: z.string().trim().min(1, 'Vui lòng nhập tên').max(80),
  lastName: z.string().trim().min(1, 'Vui lòng nhập họ').max(80),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(180),
  password: z
    .string()
    .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
    .max(200)
    .regex(/[A-Z]/, 'Mật khẩu cần ít nhất 1 chữ in hoa')
    .regex(/[^A-Za-z0-9]/, 'Mật khẩu cần ít nhất 1 ký tự đặc biệt'),
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
export type LoginBody = z.infer<typeof loginBody>;
