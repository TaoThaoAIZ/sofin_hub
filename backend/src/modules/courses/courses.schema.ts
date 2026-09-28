import { z } from 'zod';
import { CATEGORY_IDS, COURSE_SORTS, COURSE_STATUSES, LANGUAGES, PRICING_TYPES, VISIBILITIES } from './course.types.js';

export const listCoursesQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  pricing: z.enum(PRICING_TYPES).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  language: z.enum(LANGUAGES).optional(),
  sort: z.enum(COURSE_SORTS).default('trending'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuery>;
