import { z } from 'zod';

export const REFERRAL_KINDS = ['creator', 'member'] as const;
export type ReferralKindName = (typeof REFERRAL_KINDS)[number];

export const referralKindQuery = z.object({
  kind: z.enum(REFERRAL_KINDS, { error: 'kind phải là creator hoặc member' }).default('creator'),
});

/** Chi tiết hoa hồng của 1 người: trang trong cộng đồng gửi thêm communityId để thấy cả hoa hồng chương trình giới thiệu của cộng đồng. */
export const referralCommissionsQuery = referralKindQuery.extend({ communityId: z.string().trim().max(64).optional() });

export const referralUsersQuery = referralKindQuery.extend({
  /** true = trả toàn bộ (tối đa MAX_ROWS), mặc định chỉ vài dòng đầu như bảng thu gọn. */
  all: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /** Trang trong một cộng đồng: tab member gộp thêm người được mời VÀO CỘNG ĐỒNG đó qua link (bảng CommunityReferral), không chỉ người đăng ký tài khoản. */
  communityId: z.string().trim().max(64).optional(),
});

/** Mã giới thiệu đi kèm lúc đăng ký (đã chuẩn hoá chữ thường). Mã lạ bị bỏ qua êm ở service, không báo lỗi. */
export const referralCodeField = z
  .string()
  .trim()
  .toLowerCase()
  .max(64)
  .optional();
