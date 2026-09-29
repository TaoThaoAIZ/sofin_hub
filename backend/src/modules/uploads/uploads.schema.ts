import { z } from 'zod';
import { UPLOAD_PURPOSES } from './uploads.types.js';

export const presignSchema = z.object({
  filename: z.string().trim().min(1, 'Thiếu tên file').max(200, 'Tên file quá dài'),
  contentType: z.string().trim().min(1, 'Thiếu loại file').max(150),
  size: z.number().int('Dung lượng không hợp lệ').positive('Dung lượng phải lớn hơn 0'),
  purpose: z.enum(UPLOAD_PURPOSES, { error: 'Mục đích upload không hợp lệ' }),
  courseId: z.string().trim().min(1).max(100).optional(),
});
export type PresignInput = z.infer<typeof presignSchema>;
