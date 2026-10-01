import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { LEADERBOARD_WINDOWS } from '../points/points.types.js';

export const listMembersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.enum(['all', 'online', 'admin']).default('all'),
  sort: z.enum(['active', 'joined']).default('active'),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListMembersQuery = z.infer<typeof listMembersQuery>;

export const leaderboardQuery = z.object({
  window: z.enum(LEADERBOARD_WINDOWS).default('all'),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuery>;
