import { z } from 'zod';
import { toEmbedUrl } from '../classroom/classroom.schema.js';
import { CATEGORY_IDS, LANGUAGES, VISIBILITIES } from '../catalog/community.types.js';
import { intervalField, paymentMethodInput } from '../payments/payments.schema.js';

export const WIZARD_STEPS = ['basics', 'plan', 'identity', 'members'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
export const MAX_DRAFTS = 5;
export const MAX_BENEFITS = 6;
export const MAX_JOIN_QUESTIONS = 3;
export const MAX_RULES = 20;
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

export const slugField = z.string().trim().toLowerCase();

const title = z.string().trim().min(3, 'Tên cộng đồng tối thiểu 3 ký tự').max(80, 'Tên cộng đồng tối đa 80 ký tự');
const description = z.string().trim().min(1, 'Vui lòng nhập mô tả ngắn').max(150, 'Mô tả ngắn tối đa 150 ký tự');
const category = z.enum(CATEGORY_IDS, { error: 'Danh mục không hợp lệ' });

export const basicsCreate = z.strictObject({ title, slug: slugField.optional(), description, category });
export const basicsPatch = z
  .strictObject({ title: title.optional(), slug: slugField.optional(), description: description.optional(), category: category.optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật' });

export const planBody = z.strictObject({
  planKey: z.enum(['start', 'pro'], { error: 'Gói không hợp lệ (start | pro)' }),
  cycle: intervalField.default('monthly'),
  paymentMethod: paymentMethodInput.optional(),
});
export type PlanBody = z.infer<typeof planBody>;

const nullableUrl = z.string().trim().min(1).max(500).nullable();
export const identityBody = z
  .strictObject({
    logoUrl: nullableUrl.optional(),
    coverUrl: nullableUrl.optional(),
    brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Màu chủ đạo phải có dạng #rrggbb').nullable().optional(),
    promise: z.string().trim().max(100, 'Lời hứa tối đa 100 ký tự').nullable().optional(),
    benefits: z
      .array(z.string().trim().max(100, 'Mỗi lợi ích tối đa 100 ký tự'))
      .max(MAX_BENEFITS, `Tối đa ${MAX_BENEFITS} lợi ích`)
      .optional(),
    introVideoUrl: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .refine((v) => !v || toEmbedUrl(v) !== null, 'Chỉ chấp nhận link video YouTube hoặc Vimeo hợp lệ'),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật' });
export type IdentityBody = z.infer<typeof identityBody>;

const priceUsd = z.number({ error: 'Giá không hợp lệ' }).min(0, 'Giá không được âm').max(50_000_000, 'Giá tối đa 50.000.000đ');
export const ruleItem = z.strictObject({
  title: z.string().trim().min(1, 'Nội quy cần có tiêu đề').max(80, 'Tiêu đề nội quy tối đa 80 ký tự'),
  body: z.string().trim().max(500, 'Nội dung nội quy tối đa 500 ký tự').default(''),
});
export const joinQuestionsField = z
  .array(z.string().trim().min(3, 'Câu hỏi tối thiểu 3 ký tự').max(200, 'Câu hỏi tối đa 200 ký tự'))
  .max(MAX_JOIN_QUESTIONS, `Tối đa ${MAX_JOIN_QUESTIONS} câu hỏi`);

/** Các trường "Thành viên & giá" — dùng chung cho bước wizard `members` và `PATCH /communities/:id` (sửa sau khi publish). */
export const memberFields = {
  visibility: z.enum(VISIBILITIES, { error: 'Quyền riêng tư không hợp lệ' }).optional(),
  language: z.enum(LANGUAGES, { error: 'Ngôn ngữ không hợp lệ (vi | en)' }).optional(),
  priceUsd: priceUsd.optional(),
  priceAnnualUsd: priceUsd.nullable().optional(),
  memberTrialEnabled: z.boolean().optional(),
  joinQuestions: joinQuestionsField.optional(),
  rules: z.array(ruleItem).max(MAX_RULES, `Tối đa ${MAX_RULES} nội quy`).optional(),
  requireRulesAgreement: z.boolean().optional(),
  autoApprovePaid: z.boolean().optional(),
};
export const membersBody = z
  .strictObject(memberFields)
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật' });
export type MembersBody = z.infer<typeof membersBody>;

export const publishBody = z.strictObject({ acceptTerms: z.boolean({ error: 'Vui lòng đồng ý Điều khoản dành cho chủ cộng đồng' }) });

export const stepParam = z.enum(WIZARD_STEPS, { error: 'Bước không hợp lệ (basics | plan | identity | members)' });

export const slugQuery = z.object({ slug: z.string().max(100).default('') });

export const estimateQuery = z.object({
  price: z.coerce.number({ error: 'Giá không hợp lệ' }).min(0).max(50_000_000),
  interval: intervalField.default('monthly'),
  members: z.coerce.number().int().min(1).max(1_000_000).default(1),
});

export const payoutAccountBody = z.strictObject({
  bankName: z.string().trim().min(1, 'Vui lòng nhập tên ngân hàng').max(100),
  accountHolder: z.string().trim().min(1, 'Vui lòng nhập tên chủ tài khoản').max(100),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Số tài khoản phải gồm 6–20 chữ số'),
});

/** Giá tháng/năm hợp lệ cùng nhau: giá năm chỉ khi có giá tháng, > 0 và <= 12 x giá tháng. Trả thông báo lỗi hoặc null. */
export function priceError(monthly: number, annual: number | null | undefined): string | null {
  if (annual == null) return null;
  if (monthly <= 0) return 'Cộng đồng miễn phí không có giá năm';
  if (annual <= 0) return 'Giá năm phải lớn hơn 0';
  if (annual > 12 * monthly + 1e-9) return 'Giá năm không được vượt quá 12 lần giá tháng';
  return null;
}
