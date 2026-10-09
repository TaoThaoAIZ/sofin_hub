import { z } from 'zod';
import { MAX_PAGE } from '../../utils/pagination.js';
import { CATEGORY_IDS, LANGUAGES, VISIBILITIES } from '../catalog/community.types.js';
import { toEmbedUrl } from '../classroom/classroom.schema.js';
import { memberFields, priceError } from '../community-wizard/wizard.schema.js';

const title = z.string().trim().min(3, 'Tên cộng đồng tối thiểu 3 ký tự').max(80, 'Tên cộng đồng tối đa 80 ký tự');
const description = z.string().trim().min(1, 'Vui lòng nhập mô tả').max(2000, 'Mô tả tối đa 2000 ký tự');
const thumbnail = z.string().trim().min(1).max(500);
const priceUsd = z.number({ error: 'Giá không hợp lệ' }).min(0, 'Giá không được âm').max(50_000_000, 'Giá tối đa 50.000.000đ');

export const createCommunityBody = z.object({
  title,
  description,
  category: z.enum(CATEGORY_IDS),
  priceUsd,
  visibility: z.enum(VISIBILITIES),
  language: z.enum(LANGUAGES).default('vi'),
  thumbnail: thumbnail.optional(),
  // Tùy chọn mới (wizard): tạo một phát vẫn tương thích ngược khi không gửi.
  priceAnnualUsd: memberFields.priceAnnualUsd,
  memberTrialEnabled: memberFields.memberTrialEnabled,
  joinQuestions: memberFields.joinQuestions,
  rules: memberFields.rules,
  requireRulesAgreement: memberFields.requireRulesAgreement,
  autoApprovePaid: memberFields.autoApprovePaid,
}).refine((v) => priceError(v.priceUsd, v.priceAnnualUsd) === null, {
  message: 'Giá năm không hợp lệ (phải > 0 và không vượt quá 12 lần giá tháng)',
  path: ['priceAnnualUsd'],
});
export type CreateCommunityBody = z.infer<typeof createCommunityBody>;

export const updateCommunityBody = z
  .object({
    title: title.optional(),
    description: description.optional(),
    thumbnail: thumbnail.optional(),
    category: z.enum(CATEGORY_IDS).optional(),
    language: z.enum(LANGUAGES).optional(),
    priceUsd: priceUsd.optional(),
    visibility: z.enum(VISIBILITIES).optional(),
    // Sửa sau khi ra mắt (Cài đặt cộng đồng): nhận diện & giới thiệu + giá năm + câu hỏi/nội quy.
    priceAnnualUsd: memberFields.priceAnnualUsd,
    memberTrialEnabled: memberFields.memberTrialEnabled,
    joinQuestions: memberFields.joinQuestions,
    rules: memberFields.rules,
    requireRulesAgreement: memberFields.requireRulesAgreement,
    autoApprovePaid: memberFields.autoApprovePaid,
    brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Màu chủ đạo phải có dạng #rrggbb').nullable().optional(),
    promise: z.string().trim().max(100, 'Lời hứa tối đa 100 ký tự').nullable().optional(),
    benefits: z.array(z.string().trim().max(100, 'Mỗi lợi ích tối đa 100 ký tự')).max(6, 'Tối đa 6 lợi ích').optional(),
    introVideoUrl: z.string().trim().max(500).nullable().optional().refine((v) => !v || toEmbedUrl(v) !== null, 'Chỉ chấp nhận link video YouTube hoặc Vimeo hợp lệ'),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật' });
export type UpdateCommunityBody = z.infer<typeof updateCommunityBody>;

export const lockBody = z.object({ reason: z.string().trim().min(1, 'Vui lòng nhập lý do').max(500) });

export const joinRequestBody = z.object({
  message: z.string().trim().max(500).default(''),
  /** Trả lời các câu hỏi gia nhập (theo thứ tự `joinQuestions` của cộng đồng). */
  answers: z.array(z.string().trim().max(500, 'Câu trả lời tối đa 500 ký tự')).max(10).optional(),
  acceptRules: z.boolean().optional(),
});
export const joinRequestsQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const createInviteBody = z.object({
  maxUses: z.number({ error: 'Số lượt tối đa phải là số nguyên từ 1 đến 100000' }).int('Số lượt tối đa phải là số nguyên').min(1, 'Số lượt tối đa tối thiểu là 1').max(100000, 'Số lượt tối đa không quá 100000').optional(),
  expiresAt: z
    .iso.datetime({ offset: true, error: 'Hạn dùng không hợp lệ' })
    .refine((v) => new Date(v).getTime() > Date.now(), { message: 'Hạn dùng phải ở tương lai' })
    .optional(),
});

export const roleBody = z.object({ role: z.enum(['member', 'mod', 'admin']) });
export const banBody = z.object({ reason: z.string().trim().max(500).default('') });
export const transferBody = z.object({ userId: z.string().min(1) });

export const reviewBody = z.object({
  rating: z.number().int('Điểm đánh giá phải là số nguyên').min(1, 'Điểm tối thiểu là 1').max(5, 'Điểm tối đa là 5'),
  text: z.string().trim().max(1000, 'Nội dung tối đa 1000 ký tự').default(''),
});
export const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
