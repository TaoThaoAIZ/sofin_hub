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
  rating: number;
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

export interface CourseModule {
  index: number;
  title: string;
  meta: string;
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
  modules: CourseModule[];
  faqs: CourseFaq[];
  reviews: CourseReview[];
  facts: CourseFact[];
  stats: { members: number; online: number; admins: number };
  viewerEnrolled?: boolean;
}
