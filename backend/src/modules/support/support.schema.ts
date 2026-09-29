import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Email không hợp lệ').max(180);

export const newsletterBody = z.object({ email });

export const contactBody = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên').max(120),
  email,
  subject: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200),
  message: z.string().trim().min(1, 'Vui lòng nhập nội dung').max(5000, 'Nội dung tối đa 5000 ký tự'),
});
export type ContactBody = z.infer<typeof contactBody>;
