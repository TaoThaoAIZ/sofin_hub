export const CATEGORY_IDS = [
  'business',
  'content',
  'tech',
  'finance',
  'health',
  'self',
  'hobby',
  'relationships',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

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

export const COURSE_SORTS = ['trending', 'top', 'newest'] as const;
export type CourseSort = (typeof COURSE_SORTS)[number];

export interface Course {
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
  /** Giá theo tháng (USD). 0 = miễn phí. */
  priceUsd: number;
  pricing: Pricing;
  visibility: Visibility;
  status: CourseStatus;
  language: Language;
  createdAt: string;
  /** Chủ cộng đồng do người dùng tạo; vắng mặt = cộng đồng seed mẫu. */
  ownerId?: string;
  /** Bị Platform Admin khóa: ẩn khỏi danh sách công khai, chặn nội dung. */
  locked?: boolean;
  /** Xóa mềm: ẩn hoàn toàn (findById trả undefined). */
  deletedAt?: string;
}

/** Patch cho courseService.update: mọi trường của Course + `lockReason` (không nằm trong Course để không lộ ra API). */
export type CoursePatch = Partial<Course> & { lockReason?: string | null };

export interface Category {
  id: CategoryId;
  name: string;
}
