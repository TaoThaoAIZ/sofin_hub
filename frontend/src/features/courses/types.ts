export type CategoryId =
  | 'business'
  | 'content'
  | 'tech'
  | 'finance'
  | 'health'
  | 'self'
  | 'hobby'
  | 'relationships';

export type CourseTag = 'hot' | 'bestseller' | 'new';
export type Pricing = 'free' | 'paid' | 'trial';
export type Visibility = 'public' | 'private';
export type CourseStatus = 'open' | 'soon' | 'completed';
export type Language = 'vi' | 'en';
export type CourseSort = 'trending' | 'top' | 'newest';

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
  priceUsd: number;
  /** Giá năm (USD); null/vắng = không bán gói năm. */
  priceAnnualUsd?: number | null;
  annualSavingsPct?: number;
  memberTrialEnabled?: boolean;
  logoUrl?: string | null;
  brandColor?: string | null;
  pricing: Pricing;
  visibility: Visibility;
  status: CourseStatus;
  language: Language;
  createdAt: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  courseCount: number;
}

export interface PlatformStats {
  learners: number;
  courses: number;
  instructors: number;
  /** Trung bình đánh giá thật; null nếu chưa có đánh giá nào. */
  rating: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CourseFilters {
  q?: string;
  category?: CategoryId;
  pricing?: Pricing;
  visibility?: Visibility;
  status?: CourseStatus;
  language?: Language;
  sort?: CourseSort;
}

export type CourseQuery = CourseFilters & { page: number; limit: number };

export interface CourseHighlight {
  title: string;
  desc: string;
  icon: string;
}

export interface CourseFaq {
  question: string;
  answer: string;
}

export interface CourseReview {
  name: string;
  time: string;
  color: string;
  text: string;
  rating?: number;
}

export interface CourseFact {
  label: string;
  value: string;
  icon: string;
  bg: string;
  fg: string;
}

export interface CourseDetail extends Course {
  about: string;
  highlights: CourseHighlight[];
  gains: CourseHighlight[];
  priceNotes: string[];
  faqs: CourseFaq[];
  reviews: CourseReview[];
  facts: CourseFact[];
  stats: { members: number; online: number; admins: number };
  viewerEnrolled?: boolean;
  /** Yêu cầu tham gia đã được duyệt nhưng chưa vào (cộng đồng riêng tư có phí: còn phải thanh toán/dùng thử). */
  viewerApproved?: boolean;
  /** Câu hỏi gia nhập + nội quy (cộng đồng riêng tư): BE bắt buộc trả lời/đồng ý khi gửi yêu cầu. */
  joinQuestions?: string[];
  rules?: { title: string; body: string }[];
  requireRulesAgreement?: boolean;
  /** Vai trò hiệu lực của người xem trong cộng đồng (null nếu chưa tham gia). */
  viewerRole?: 'member' | 'mod' | 'admin' | 'owner' | 'platform_admin' | null;
  /** Cộng đồng đang bị Platform Admin khóa (BE trả kèm khi khóa). */
  locked?: boolean;
  /** Có ở cộng đồng do người dùng tạo; cộng đồng seed không có. */
  ownerId?: string;
}

// Khóa học marketplace trước đây thực chất là cộng đồng. Tên chuẩn mới: Community*. (`Course*` giữ lại làm alias tương thích;
// "Khóa học" đúng nghĩa — nằm trong cộng đồng — là `LearningCourse` ở features/community/types.ts.)
export type Community = Course;
export type CommunityDetail = CourseDetail;
