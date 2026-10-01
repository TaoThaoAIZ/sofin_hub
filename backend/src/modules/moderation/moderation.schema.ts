import { z } from 'zod';
import { MOD_REPORT_ACTIONS, REPORT_REASONS, REPORT_STATUSES } from './moderation.types.js';

export const createReportBody = z.object({
  reason: z.enum(REPORT_REASONS, { message: 'Lý do báo cáo không hợp lệ' }),
  detail: z.string().trim().max(1000).optional(),
});
export type CreateReportBody = z.infer<typeof createReportBody>;

export const resolveReportBody = z.object({
  action: z.enum(MOD_REPORT_ACTIONS, { message: 'Hành động không hợp lệ' }),
  note: z.string().trim().max(500).optional(),
});
export type ResolveReportBody = z.infer<typeof resolveReportBody>;

export const listReportsQuery = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListReportsQuery = z.infer<typeof listReportsQuery>;
