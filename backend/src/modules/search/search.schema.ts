import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';

const q = z.string().trim().min(2, 'Từ khóa tối thiểu 2 ký tự').max(100, 'Từ khóa tối đa 100 ký tự');

export const searchQuery = z.object({
  q,
  type: z.enum(['all', 'posts', 'members', 'courses']).default('all'),
  communityId: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const suggestQuery = z.object({ q });
