import { z } from 'zod';
import { POST_CATEGORIES } from './posts.types.js';

export const listPostsQuery = z.object({
  category: z.enum(POST_CATEGORIES).optional(),
  tag: z.string().trim().min(1).max(30).optional(),
  sort: z.enum(['latest', 'popular']).default('latest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListPostsQuery = z.infer<typeof listPostsQuery>;

const tagsField = z.array(z.string().trim().min(1).max(30)).max(5);

export const createPollBody = z.object({
  question: z.string().trim().min(1).max(200).optional(),
  options: z.array(z.string().trim().min(1, 'Lựa chọn không được để trống').max(100)).min(2, 'Cần ít nhất 2 lựa chọn').max(6, 'Tối đa 6 lựa chọn'),
  multiple: z.boolean().default(false),
  closesAt: z.string().datetime({ message: 'Thời gian đóng bình chọn không hợp lệ (ISO 8601)' }).optional(),
});
export type CreatePollBody = z.infer<typeof createPollBody>;

export const createPostBody = z.object({
  content: z.string().trim().min(1, 'Nội dung không được để trống').max(4000),
  category: z.enum(POST_CATEGORIES).default('Thảo luận chung'),
  tags: tagsField.default([]),
  // Chỉ http/https: chặn javascript:/data: (URL này được FE dùng làm src/href).
  imageUrl: z.string().trim().url().refine((v) => /^https?:\/\//i.test(v), 'Liên kết ảnh phải là http/https').optional(),
  poll: createPollBody.optional(),
});
export type CreatePostBody = z.infer<typeof createPostBody>;

export const updatePostBody = z
  .object({
    content: z.string().trim().min(1, 'Nội dung không được để trống').max(4000).optional(),
    category: z.enum(POST_CATEGORIES).optional(),
    tags: tagsField.optional(),
  })
  .refine((v) => v.content !== undefined || v.category !== undefined || v.tags !== undefined, { message: 'Không có gì để cập nhật' });
export type UpdatePostBody = z.infer<typeof updatePostBody>;

export const createCommentBody = z.object({
  content: z.string().trim().min(1, 'Bình luận không được để trống').max(1000),
});
export type CreateCommentBody = z.infer<typeof createCommentBody>;

export const pollVoteBody = z.object({
  optionIds: z.array(z.string().min(1)).min(1, 'Hãy chọn ít nhất 1 lựa chọn').max(6),
});
export type PollVoteBody = z.infer<typeof pollVoteBody>;
