import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { COMMUNITY_PREF_KEYS, EMAIL_DIGESTS, NOTIFICATION_TYPES } from './notifications.types.js';

export const listNotificationsQuery = z.object({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm');
const communityPref = z.object(Object.fromEntries(COMMUNITY_PREF_KEYS.map((k) => [k, z.boolean()])) as Record<(typeof COMMUNITY_PREF_KEYS)[number], z.ZodBoolean>).strict();

/** Chỉ nhận các khóa đã biết; chấp nhận cập nhật từng phần. `communityPrefs` THAY THẾ cả bảng (gửi `{}` = đặt lại mặc định). */
export const updatePreferencesBody = z
  .object({
    types: z.partialRecord(z.enum(NOTIFICATION_TYPES), z.boolean()).optional(),
    emailDigest: z.enum(EMAIL_DIGESTS).optional(),
    quiet: z.object({ enabled: z.boolean().optional(), from: hhmm.optional(), to: hhmm.optional() }).strict().optional(),
    dmAllowed: z.boolean().optional(),
    emailUnreadDm: z.boolean().optional(),
    notifyFollowedPosts: z.boolean().optional(),
    communityPrefs: z.record(z.string().min(1).max(100), communityPref.partial()).refine((r) => Object.keys(r).length <= 500, 'Quá nhiều cộng đồng').optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Không có gì để cập nhật' });
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBody>;

export const streamQuery = z.object({
  ticket: z.string().min(1).optional(),
});
