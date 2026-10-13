import { z } from 'zod';

export const createEventBody = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên sự kiện').max(160),
  description: z.string().trim().max(2000).default(''),
  startAt: z.string().datetime({ message: 'Thời gian không hợp lệ (ISO 8601)' }),
  timezone: z.string().trim().default('Asia/Ho_Chi_Minh'),
  meetingLink: z.string().trim().url('Liên kết không hợp lệ').refine((v) => /^https?:\/\//i.test(v), 'Liên kết phải là http/https').optional(),
  capacity: z.coerce.number().int().positive().optional(),
  /** Thành viên được mời trực tiếp (nhận thông báo "được mời"); phải đang là thành viên cộng đồng. */
  inviteeIds: z.array(z.string().trim().min(1)).max(200, 'Tối đa 200 người được mời').default([]),
});
export type CreateEventBody = z.infer<typeof createEventBody>;

export const updateEventBody = z
  .object({
    title: z.string().trim().min(1, 'Vui lòng nhập tên sự kiện').max(160),
    description: z.string().trim().max(2000),
    startAt: z.string().datetime({ message: 'Thời gian không hợp lệ (ISO 8601)' }),
    timezone: z.string().trim().min(1),
    meetingLink: z.string().trim().url('Liên kết không hợp lệ').refine((v) => /^https?:\/\//i.test(v), 'Liên kết phải là http/https').nullable(),
    capacity: z.coerce.number().int().positive().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có gì để cập nhật' });
export type UpdateEventBody = z.infer<typeof updateEventBody>;

export const listEventsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListEventsQuery = z.infer<typeof listEventsQuery>;
