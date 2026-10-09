export const CATEGORY_IDS = [
  'business',
  'content',
  'tech',
  'finance',
  'health',
  'self',
  'hobby',
  'relationships',
  // Admin đợt 2: chỉ dùng được sau khi admin thêm trong Discovery > Categories.
  'marketing',
  'design',
  // Wizard tạo cộng đồng (mockup): danh mục thêm.
  'music',
  'sports',
  'spirituality',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CommunityRule {
  title: string;
  body: string;
}

/** Tiết kiệm (%) của gói năm so với 12 tháng gói tháng; 0 nếu không có gói năm. */
export function annualSavingsPct(priceUsd: number, priceAnnualUsd: number | null | undefined): number {
  if (!priceAnnualUsd || priceUsd <= 0) return 0;
  return Math.max(0, Math.round((1 - priceAnnualUsd / (12 * priceUsd)) * 100));
}

export const COURSE_TAGS = ['hot', 'bestseller', 'new'] as const;
export type CourseTag = (typeof COURSE_TAGS)[number];

export const PRICING_TYPES = ['free', 'paid', 'trial'] as const;
export type Pricing = (typeof PRICING_TYPES)[number];

export const VISIBILITIES = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const COURSE_STATUSES = ['open', 'soon', 'completed'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const COURSE_SORTS = ['trending', 'top', 'newest', 'ranked'] as const;
export type CourseSort = (typeof COURSE_SORTS)[number];

export interface Community {
  id: string;
  title: string;
  description: string;
  category: CategoryId;
  tag: CourseTag | null;
  thumbnail: string;
  instructor: { name: string; role: string };
  lessons: number;
  durationMinutes: number;
  students: number;
  rating: number;
  ratingCount: number;
  /** Giá theo tháng (VND). 0 = miễn phí. */
  priceUsd: number;
  /** Giá theo năm (VND) — null = không bán gói năm. Luôn <= 12 x priceUsd. */
  priceAnnualUsd: number | null;
  /** % tiết kiệm của gói năm (server tính), 0 nếu không có. */
  annualSavingsPct: number;
  /** Cho thành viên mới dùng thử (số ngày = Global Settings payments.trialDays). */
  memberTrialEnabled: boolean;
  /** Nhận diện & giới thiệu (wizard). */
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string | null;
  promise: string | null;
  benefits: string[];
  introVideoUrl: string | null;
  rules: CommunityRule[];
  joinQuestions: string[];
  requireRulesAgreement: boolean;
  autoApprovePaid: boolean;
  pricing: Pricing;
  visibility: Visibility;
  status: CourseStatus;
  language: Language;
  createdAt: string;
  /** Chủ cộng đồng do người dùng tạo; vắng mặt = cộng đồng seed mẫu. */
  ownerId?: string;
  /** Bị Platform Admin khóa: ẩn khỏi danh sách công khai, chặn nội dung. */
  locked?: boolean;
  /** Chỉ có khi admin đặt khác `searchable` (Discovery > Search Visibility). */
  searchVisibility?: 'reduced' | 'hidden';
  /** Xóa mềm: ẩn hoàn toàn (findById trả undefined). */
  deletedAt?: string;
}

/** Các trường wizard — tùy chọn khi TẠO (có mặc định), luôn có mặt khi ĐỌC. */
type WizardKeys =
  | 'priceAnnualUsd' | 'annualSavingsPct' | 'memberTrialEnabled' | 'logoUrl' | 'coverUrl' | 'brandColor' | 'promise' | 'benefits'
  | 'introVideoUrl' | 'rules' | 'joinQuestions' | 'requireRulesAgreement' | 'autoApprovePaid';
export type NewCommunity = Omit<Community, WizardKeys> & Partial<Pick<Community, WizardKeys>>;

/** Patch cho catalogService.update: mọi trường của Community + `lockReason` (không nằm trong Community để không lộ ra API). */
export type CommunityPatch = Partial<Community> & { lockReason?: string | null };

export interface Category {
  id: CategoryId;
  name: string;
}
