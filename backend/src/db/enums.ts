import type { OneTimeTokenPurpose, PostCategory as DbPostCategory } from '../generated/prisma/enums.js';
import type { PostCategory } from '../modules/posts/posts.types.js';
import type { OneTimePurpose } from '../modules/auth/one-time-tokens.js';

/**
 * Đổi qua lại giữa enum Prisma (mã ASCII) và giá trị domain hiện có. Hầu hết enum trùng tên với domain nên KHÔNG cần map;
 * chỉ 2 enum khác dạng: PostCategory (domain là chuỗi tiếng Việt) và OneTimeTokenPurpose (domain có gạch ngang).
 */
const POST_CATEGORY_TO_DOMAIN: Record<DbPostCategory, PostCategory> = {
  general: 'Thảo luận chung',
  qa: 'Hỏi đáp',
  case_study: 'Case study',
  announcement: 'Thông báo',
};
const POST_CATEGORY_FROM_DOMAIN = Object.fromEntries(
  Object.entries(POST_CATEGORY_TO_DOMAIN).map(([db, domain]) => [domain, db]),
) as Record<PostCategory, DbPostCategory>;

export const postCategoryToDomain = (c: DbPostCategory): PostCategory => POST_CATEGORY_TO_DOMAIN[c];
export const postCategoryFromDomain = (c: PostCategory): DbPostCategory => POST_CATEGORY_FROM_DOMAIN[c];

export const oneTimePurposeToDomain = (p: OneTimeTokenPurpose): OneTimePurpose => (p === 'reset_password' ? 'reset-password' : 'verify-email');
export const oneTimePurposeFromDomain = (p: OneTimePurpose): OneTimeTokenPurpose => (p === 'reset-password' ? 'reset_password' : 'verify_email');

/**
 * Tiền: toàn hệ thống là VND, số nguyên, 1 đơn vị = 1đ (VND không có đơn vị nhỏ hơn).
 * Tên cũ (`priceUsd`, `amountUsd`, `*Cents`) được GIỮ để không phá API/FE — nay chúng đều là ĐỒNG, không còn nhân/chia 100.
 */
export const usdToCents = (vnd: number): number => Math.round(vnd);
export const centsToUsd = (vnd: number): number => vnd;
/** Chỉ cho dữ liệu mẫu (seed): quy giá USD trong mockup/seed cũ sang VND, làm tròn nghìn đồng (1 USD ≈ 25.000đ). */
export const seedVnd = (usd: number): number => Math.round((usd * 25_000) / 1000) * 1000;
