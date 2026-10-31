import { z } from 'zod';
import { UPLOAD_PURPOSES } from './uploads.types.js';

export const presignSchema = z.object({
  filename: z.string().trim().min(1, 'Thiếu tên file').max(200, 'Tên file quá dài'),
  contentType: z.string().trim().min(1, 'Thiếu loại file').max(150),
  size: z.number().int('Dung lượng không hợp lệ').positive('Dung lượng phải lớn hơn 0'),
  purpose: z.enum(UPLOAD_PURPOSES, { error: 'Mục đích upload không hợp lệ' }),
  communityId: z.string().trim().min(1).max(100).optional(),
});
export type PresignInput = z.infer<typeof presignSchema>;

/** Báo upload trực tiếp lên S3 đã xong. Multipart: kèm uploadId + ETag từng phần. */
export const completeSchema = z.object({
  uploadId: z.string().trim().min(1).max(2000).optional(),
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().trim().min(1).max(200) }))
    .max(10_000)
    .optional(),
});
export type CompleteInput = z.infer<typeof completeSchema>;
export const abortSchema = z.object({ uploadId: z.string().trim().min(1).max(2000).optional() });
