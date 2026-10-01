import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { CATEGORY_IDS, LANGUAGES, VISIBILITIES } from '../catalog/community.types.js';

const title = z.string().trim().min(3, 'Tên cộng đồng tối thiểu 3 ký tự').max(80, 'Tên cộng đồng tối đa 80 ký tự');
const description = z.string().trim().min(1, 'Vui lòng nhập mô tả').max(2000, 'Mô tả tối đa 2000 ký tự');
const thumbnail = z.string().trim().min(1).max(500);
const priceUsd = z.number({ error: 'Giá không hợp lệ' }).min(0, 'Giá không được âm').max(10000);

export const createCommunityBody = z.object({
  title,
  description,
  category: z.enum(CATEGORY_IDS),
  priceUsd,
  visibility: z.enum(VISIBILITIES),
  language: z.enum(LANGUAGES).default('vi'),
  thumbnail: thumbnail.optional(),
});
export type CreateCommunityBody = z.infer<typeof createCommunityBody>;

export const updateCommunityBody = z
  .object({
    title: title.optional(),
    description: description.optional(),
    thumbnail: thumbnail.optional(),
    category: z.enum(CATEGORY_IDS).optional(),
    language: z.enum(LANGUAGES).optional(),
    priceUsd: priceUsd.optional(),
    visibility: z.enum(VISIBILITIES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật' });
export type UpdateCommunityBody = z.infer<typeof updateCommunityBody>;

export const lockBody = z.object({ reason: z.string().trim().min(1, 'Vui lòng nhập lý do').max(500) });

export const joinRequestBody = z.object({ message: z.string().trim().max(500).default('') });
export const joinRequestsQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const createInviteBody = z.object({
  maxUses: z.number().int().min(1).max(100000).optional(),
  expiresAt: z
    .iso.datetime({ offset: true, error: 'Hạn dùng không hợp lệ' })
    .refine((v) => new Date(v).getTime() > Date.now(), { message: 'Hạn dùng phải ở tương lai' })
    .optional(),
});

export const roleBody = z.object({ role: z.enum(['member', 'mod', 'admin']) });
export const banBody = z.object({ reason: z.string().trim().max(500).default('') });
export const transferBody = z.object({ userId: z.string().min(1) });

export const reviewBody = z.object({
  rating: z.number().int('Điểm đánh giá phải là số nguyên').min(1, 'Điểm tối thiểu là 1').max(5, 'Điểm tối đa là 5'),
  text: z.string().trim().max(1000, 'Nội dung tối đa 1000 ký tự').default(''),
});
export const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
