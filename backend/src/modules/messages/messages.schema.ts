import { z } from 'zod';

export const openConversationSchema = z.object({
  userId: z.string().trim().min(1, 'Thiếu người nhận').max(100),
});

// Chỉ nhận file do chính hệ thống lưu (đường dẫn /api/files/<khóa>), không nhận URL ngoài.
const attachmentSchema = z.object({
  url: z.string().max(200).regex(/^\/api\/files\/[a-f0-9]{32}\.[a-z0-9]{2,5}$/, 'Tệp đính kèm không hợp lệ'),
  name: z.string().trim().min(1).max(200),
  contentType: z.string().max(150),
  size: z.number().int().nonnegative(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Nội dung không được để trống').max(2000, 'Nội dung tối đa 2000 ký tự'),
  attachments: z.array(attachmentSchema).max(5, 'Tối đa 5 tệp đính kèm').optional(),
});

export const messagesQuerySchema = z.object({
  before: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const conversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(300).optional(),
});
