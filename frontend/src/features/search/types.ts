export interface Segment {
  text: string;
  match: boolean;
}

export type SearchType = 'all' | 'courses' | 'posts' | 'members';

export interface CourseResult {
  type: 'course';
  id: string;
  title: Segment[];
  snippet: Segment[];
  link: string;
}

export interface MemberResult {
  type: 'member';
  id: string;
  courseId: string;
  courseTitle: string;
  name: Segment[];
  handle: string;
  role: string;
  link: string;
}

export interface PostResult {
  type: 'post';
  id: string;
  courseId: string;
  courseTitle: string;
  author: string;
  snippet: Segment[];
  createdAt: string;
  link: string;
}

export type SearchResult = CourseResult | MemberResult | PostResult;

export interface SearchResponse {
  data: SearchResult[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  counts: { courses: number; members: number; posts: number };
}
