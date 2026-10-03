import { z } from 'zod';

export const patchMyCommunityBody = z
  .object({ sidebarVisible: z.boolean().optional(), pinned: z.boolean().optional() })
  .strict()
  .refine((v) => v.sidebarVisible !== undefined || v.pinned !== undefined, { message: 'Không có gì để cập nhật' });
export type PatchMyCommunityBody = z.infer<typeof patchMyCommunityBody>;

export const reorderBody = z
  .object({ ids: z.array(z.string().min(1).max(100)).min(1).max(500) })
  .strict()
  .refine((v) => new Set(v.ids).size === v.ids.length, { message: 'Danh sách cộng đồng bị trùng' });
