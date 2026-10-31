export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

import i18n from '../../i18n';

export type PostCategory = 'Thảo luận chung' | 'Hỏi đáp' | 'Case study' | 'Thông báo';
export const POST_CATEGORIES: PostCategory[] = ['Thảo luận chung', 'Hỏi đáp', 'Case study', 'Thông báo'];

const CATEGORY_KEY: Record<PostCategory, string> = {
  'Thảo luận chung': 'general',
  'Hỏi đáp': 'qa',
  'Case study': 'caseStudy',
  'Thông báo': 'announcement',
};
/** Nhãn hiển thị của chuyên mục (giá trị API vẫn là tiếng Việt). */
export const categoryLabel = (c: PostCategory) => i18n.t(`categories.${CATEGORY_KEY[c]}`, { ns: 'community', defaultValue: c });

export interface PostAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
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
  lockReason?: 'previous_module' | 'level' | 'paid' | 'selected' | null;
  /** Module bán riêng mà người xem chưa mua (kể cả khi đang khóa vì chưa xong module trước). */
  needsPurchase?: boolean;
  learningCourseId?: string;
  accessMode?: ModuleAccessMode;
  /** Chỉ có khi accessMode = 'paid'. */
  priceCents?: number;
  /** Bài trong module phải học tuần tự. */
  sequential?: boolean;
  publishStatus?: 'published' | 'draft' | 'archived';
  /** Có ít nhất 1 bài xem thử miễn phí. */
  hasPreview?: boolean;
}

export type ModuleAccessMode = 'all' | 'level' | 'paid' | 'selected';

export interface ClassroomLesson {
  id: string;
  index: number;
  /** Bài xem thử miễn phí: người chưa mở khóa module vẫn xem được. */
  isPreview?: boolean;
  /** Người xem hiện chưa mở được bài này (khóa module / học tuần tự). */
  locked?: boolean;
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
  /** Thời điểm admin hủy sự kiện (null/undefined = còn hiệu lực). */
  cancelledAt?: string | null;
}

export type MemberFilter = 'all' | 'online' | 'admin';

export interface CommunityMember {
  id: string;
  name: string;
  avatarUrl?: string;
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
  avatarUrl?: string;
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
  { key: 'spam' },
  { key: 'harassment' },
  { key: 'inappropriate' },
  { key: 'misinformation' },
  { key: 'other' },
] as const;

export const reportReasonLabel = (key: string) => i18n.t(`reportReasons.${key}`, { ns: 'community', defaultValue: key });
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
  targetRole?: 'member' | 'mod' | 'admin' | 'owner' | null;
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
  /** 'slide' = slide bài giảng; 'video' = video bổ sung (ngoài video chính); bỏ trống = tệp đính kèm thường. */
  kind?: 'slide' | 'video';
  /** Chỉ video bổ sung dạng link YouTube/Vimeo: URL nhúng do BE dựng. */
  embedUrl?: string;
}

export interface LessonDetail extends ClassroomLesson {
  /** Module chứa bài còn khóa với người xem: bài đang mở được là bài học thử miễn phí. */
  moduleLocked?: boolean;
  moduleId: string;
  moduleTitle: string;
  moduleIndex: number;
  learningCourseId?: string;
  prevLessonId: string | null;
  nextLessonId: string | null;
  prevLessonLocked: boolean;
  nextLessonLocked: boolean;
  /** Trắc nghiệm của bài (null = không có). required = phải đạt điểm mới hoàn thành bài (mod+ không bị bắt buộc). */
  quiz: { questionCount: number; passPercent: number; passed: boolean; required: boolean } | null;
  surveyBlocks?: boolean;
  hasSurvey?: boolean;
  surveyAnswered?: boolean;
  surveyRequired?: boolean;
  /** Bài có trò chơi cuối bài (một hoặc nhiều); gamePlayed = người xem đã chơi ít nhất một ván. */
  hasGame?: boolean;
  gamePlayed?: boolean;
  /** required = phải xem hết video mới làm được trắc nghiệm (mod+ không bị bắt buộc); watched = đã xem hết. */
  video?: { required: boolean; watched: boolean; /** Từng video theo thứ tự hiển thị (video chính trước); `watched` ở trên = đã xem hết mọi video. */ items?: { key: string; watched: boolean }[] };
}

/** Trò chơi cuối bài: lật thẻ / nối cặp / đúng-sai / xếp từ (xếp từ: term = từ cần xếp, definition = gợi ý). */
export type GameKind = 'memory' | 'match' | 'swipe' | 'scramble';
export interface GamePair {
  id: string;
  term: string;
  definition: string;
}
export interface GameBest {
  stars: number;
  moves: number;
  seconds: number;
  plays: number;
}
export interface GameItem {
  id: string;
  kind: GameKind;
  pairs: GamePair[];
  pointsPerStar: number;
  best: GameBest | null;
}
export interface GamesView {
  canEdit: boolean;
  games: GameItem[];
}
export interface GamesInput {
  games: { id?: string; kind: GameKind; pairs: { id?: string; term: string; definition: string }[] }[];
}
export interface GameResult {
  stars: number;
  points: number;
  best: GameBest;
  firstPlay: boolean;
}

export type OnboardingStepKey = 'video' | 'comment' | 'app';
export interface Onboarding {
  steps: Array<{ key: OnboardingStepKey; done: boolean }>;
  done: number;
  total: number;
  completed: boolean;
  videoUrl: string | null;
}

export interface QuizQuestionView {
  id: string;
  text: string;
  options: string[];
  /** Chỉ có khi người xem là mod+ (để chỉnh sửa). */
  correctIndex?: number;
}
export interface QuizView {
  canEdit: boolean;
  quiz: null | {
    id: string;
    passPercent: number;
    questionCount: number;
    questions: QuizQuestionView[];
    attempts: number;
    bestPercent: number | null;
    passed: boolean;
  };
}
export interface QuizAttemptResult {
  scorePercent: number;
  correctCount: number;
  total: number;
  passPercent: number;
  passed: boolean;
  /** correctIndex chỉ có khi học viên đã đạt. */
  results: Array<{ questionId: string; correct: boolean; correctIndex?: number }>;
}
export interface QuizCheckResult {
  questionId: string;
  correct: boolean;
}
export interface QuizInput {
  passPercent: number;
  questions: Array<{ text: string; options: string[]; correctIndex: number }>;
}

export type SurveyQuestionType = 'single' | 'multiple' | 'text';
export interface SurveyQuestion {
  id: string;
  text: string;
  type: SurveyQuestionType;
  options: string[];
  required: boolean;
  allowText?: boolean;
}
export interface SurveyAnswer {
  questionId: string;
  choices: string[];
  text?: string;
}
export interface SurveyView {
  canEdit: boolean;
  survey: null | { id: string; questions: SurveyQuestion[]; myAnswers: SurveyAnswer[] | null; answeredAt: string | null };
}
export interface SurveyInput {
  questions: Array<{ id?: string; text: string; type: SurveyQuestionType; options: string[]; required: boolean; allowText: boolean }>;
}
export interface SurveyUser {
  id: string;
  name: string;
  avatarUrl?: string;
}
export interface SurveyListItem {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  questionCount: number;
  responseCount: number;
  lastAnsweredAt: string | null;
  /** Học viên đang thấy được khảo sát (bài không ẩn/gỡ, module đã xuất bản). */
  active: boolean;
}
export interface SurveyList {
  memberCount: number;
  surveys: SurveyListItem[];
}
export interface SurveyOverview {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  responseCount: number;
  memberCount: number;
  questions: Array<{ id: string; text: string; type: SurveyQuestionType; required: boolean; allowText: boolean; answered: number; options: Array<{ text: string; count: number }> }>;
}
export interface SurveyPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface SurveyTexts {
  data: Array<{ user: SurveyUser; text: string; answeredAt: string }>;
  meta: SurveyPageMeta;
}
export interface SurveyResponses {
  data: Array<{ user: SurveyUser; answeredAt: string; answers: SurveyAnswer[] }>;
  meta: SurveyPageMeta;
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
  learningCourseId?: string;
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
  accessMode?: ModuleAccessMode;
  priceCents?: number | null;
  sequential?: boolean;
  publishStatus?: 'published' | 'draft' | 'archived';
  /** Chỉ gửi khi chuyển nháp → xuất bản (hành động một lần, không lưu). */
  notifyMembers?: boolean;
  announce?: boolean;
}

export interface ModuleAccessMember {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface LessonInput {
  title: string;
  type: 'video' | 'text' | 'file';
  durationMin: number;
  body: string;
  videoUrl?: string | null;
  attachments?: LessonAttachment[];
  isPreview?: boolean;
}

// ---- Khóa học (Course) nằm trong cộng đồng ----
export type CoursePublishStatus = 'published' | 'draft' | 'archived';

export interface LearningCourse {
  id: string;
  communityId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  position: number;
  publishStatus: CoursePublishStatus;
  /** Override theo khóa; null = kế thừa cài đặt mặc định của cộng đồng. */
  certificatesEnabled: boolean | null;
  certificatesEffective: boolean;
  isDefault: boolean;
  modulesCount: number;
  lessonsCount: number;
  progress: { percent: number; completedLessons: number; totalLessons: number };
  createdAt: string;
  updatedAt: string;
}

export interface CourseInput {
  title: string;
  description?: string;
  thumbnailUrl?: string | null;
  publishStatus?: 'published' | 'draft';
}
