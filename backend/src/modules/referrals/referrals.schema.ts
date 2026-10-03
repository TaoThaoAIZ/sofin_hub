import { z } from 'zod';

export const REFERRAL_KINDS = ['creator', 'member'] as const;
export type ReferralKindName = (typeof REFERRAL_KINDS)[number];

export const referralKindQuery = z.object({
  kind: z.enum(REFERRAL_KINDS, { error: 'kind phải là creator hoặc member' }).default('creator'),
});

export const referralUsersQuery = referralKindQuery.extend({
  /** true = trả toàn bộ (tối đa MAX_ROWS), mặc định chỉ vài dòng đầu như bảng thu gọn. */
  all: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

/** Mã giới thiệu đi kèm lúc đăng ký (đã chuẩn hoá chữ thường). Mã lạ bị bỏ qua êm ở service, không báo lỗi. */
export const referralCodeField = z
  .string()
  .trim()
  .toLowerCase()
  .max(64)
  .optional();
