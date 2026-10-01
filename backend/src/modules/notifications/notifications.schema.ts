import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { EMAIL_DIGESTS, NOTIFICATION_TYPES } from './notifications.types.js';

export const listNotificationsQuery = z.object({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;

/** Chỉ nhận các khóa loại thông báo đã biết; chấp nhận cập nhật từng phần. */
export const updatePreferencesBody = z
  .object({
    types: z.partialRecord(z.enum(NOTIFICATION_TYPES), z.boolean()).optional(),
    emailDigest: z.enum(EMAIL_DIGESTS).optional(),
  })
  .strict()
  .refine((v) => v.types !== undefined || v.emailDigest !== undefined, { message: 'Không có gì để cập nhật' });
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBody>;

export const streamQuery = z.object({
  ticket: z.string().min(1).optional(),
});
