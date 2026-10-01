import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { CATEGORY_IDS, COURSE_SORTS, COURSE_STATUSES, LANGUAGES, PRICING_TYPES, VISIBILITIES } from './community.types.js';

export const listCommunitiesQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  pricing: z.enum(PRICING_TYPES).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  language: z.enum(LANGUAGES).optional(),
  sort: z.enum(COURSE_SORTS).default('trending'),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

export type ListCommunitiesQuery = z.infer<typeof listCommunitiesQuery>;
