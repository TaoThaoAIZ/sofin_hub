export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type PostCategory = 'Thảo luận chung' | 'Hỏi đáp' | 'Case study' | 'Thông báo';
export const POST_CATEGORIES: PostCategory[] = ['Thảo luận chung', 'Hỏi đáp', 'Case study', 'Thông báo'];

export interface PostAuthor {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  courseId: string;
  authorId: string;
  content: string;
  category: PostCategory;
  imageUrl?: string;
  tags: string[];
  pinned: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  author: PostAuthor;
  viewerLiked: boolean;
  editedAt?: string;
  /** Bị mod ẩn — chỉ tác giả và mod+ còn thấy. */
  hidden?: boolean;
  shareUrl?: string;
  poll?: PostPoll;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
  editedAt?: string;
  hidden?: boolean;
}

export interface ClassroomModule {
  id: string;
  index: number;
  title: string;
  description: string;
  lessonsCount: number;
  completedCount: number;
  pct: number;
  locked: boolean;
  thumbnail?: string;
  requiredLevel?: number;
  lockReason?: 'previous_module' | 'level' | null;
}

export interface ClassroomLesson {
  id: string;
  index: number;
  title: string;
  type: 'video' | 'text' | 'file';
  durationMin: number;
  body: string;
  completed: boolean;
  videoUrl?: string;
  embedUrl?: string;
  attachments?: LessonAttachment[];
}

export interface CommunityEvent {
  id: string;
  courseId: string;
  hostId: string;
  title: string;
  description: string;
  startAt: string;
  timezone: string;
  meetingLink?: string;
  capacity?: number;
  createdAt: string;
  rsvpCount: number;
  viewerRsvped: boolean;
  isPast: boolean;
}

export type MemberFilter = 'all' | 'online' | 'admin';

export interface CommunityMember {
  id: string;
  name: string;
  handle: string;
  role: 'admin' | 'member';
  /** Vai trò thật (member | mod | admin | owner); `role` ở trên chỉ phân biệt admin/member. */
  roleDetail?: 'member' | 'mod' | 'admin' | 'owner';
  enrolledAt: string;
  lastActiveAt: string;
  online: boolean;
}

export type LeaderboardWindow = '7d' | '30d' | 'all';

export interface MemberList extends Paginated<CommunityMember> {
  counts: { all: number; online: number; admins: number };
}

export interface LevelInfo {
  level: number;
  name: string;
  minPoints: number;
  memberPct: number;
}

export interface LevelsResponse {
  levels: LevelInfo[];
  me: {
    userId: string;
    name: string;
    points: number;
    rank: number | null;
    level: number;
    levelName: string;
    pointsToNext: number;
    journeyPct: number;
  };
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  points: number;
  rank: number;
}

// ---- Bảng tin mở rộng ----
export interface PostPollOption {
  id: string;
  text: string;
  count: number;
}

export interface PostPoll {
  question?: string;
  multiple: boolean;
  closesAt?: string;
  isClosed: boolean;
  totalVoters: number;
  viewerVotes: string[];
  options: PostPollOption[];
}

export interface CreatePostInput {
  content: string;
  category: PostCategory;
  tags?: string[];
  imageUrl?: string;
  poll?: { question?: string; options: string[]; multiple?: boolean; closesAt?: string };
}

export interface UpdatePostInput {
  content?: string;
  category?: PostCategory;
  tags?: string[];
}

export interface PostQuery {
  category?: PostCategory;
  sort?: 'latest' | 'popular';
  tag?: string;
  page?: number;
  limit?: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface PostShare {
  url: string;
  title: string;
  excerpt: string;
}

export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam / quảng cáo' },
  { key: 'harassment', label: 'Quấy rối / công kích' },
  { key: 'inappropriate', label: 'Nội dung không phù hợp' },
  { key: 'misinformation', label: 'Thông tin sai lệch' },
  { key: 'other', label: 'Lý do khác' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportAction = 'dismiss' | 'hide_content' | 'ban_member';

export interface Report {
  id: string;
  courseId?: string;
  courseTitle?: string;
  status: ReportStatus;
  targetType: 'post' | 'comment' | 'member';
  targetId: string;
  targetExcerpt?: string;
  targetUserName?: string;
  reporterName?: string;
  reason: ReportReason;
  detail?: string;
  action?: ReportAction;
  note?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

// ---- Sự kiện mở rộng ----
export interface UpdateEventInput {
  title?: string;
  description?: string;
  startAt?: string;
  timezone?: string;
  meetingLink?: string | null;
  capacity?: number | null;
}

// ---- Lớp học mở rộng ----
export interface LessonAttachment {
  name: string;
  url: string;
  size?: number;
}

export interface LessonDetail extends ClassroomLesson {
  moduleId: string;
  moduleTitle: string;
  moduleIndex: number;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

export interface CourseProgress {
  percent: number;
  completedLessons: number;
  totalLessons: number;
  completedModules: number;
  lastLessonId: string | null;
  nextLesson: { id: string; title: string; moduleId: string } | null;
}

export interface Certificate {
  code: string;
  holderName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
}

export interface CertificateVerification {
  valid: boolean;
  holderName: string;
  courseTitle: string;
  issuedAt: string;
}

export interface ModuleInput {
  title: string;
  description: string;
  thumbnail?: string | null;
  requiredLevel?: number | null;
}

export interface LessonInput {
  title: string;
  type: 'video' | 'text' | 'file';
  durationMin: number;
  body: string;
  videoUrl?: string | null;
  attachments?: LessonAttachment[];
}
