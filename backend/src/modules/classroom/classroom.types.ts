export type LessonType = 'video' | 'text' | 'file';

export interface LessonAttachment {
  name: string;
  url: string;
  size?: number;
}

export interface ClassroomLesson {
  id: string;
  moduleId: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ; `courseId` ở DTO cũ = id cộng đồng). Repository luôn điền. */
  courseId?: string;
  index: number;
  title: string;
  type: LessonType;
  durationMin: number;
  /** Nội dung bài học (văn bản). Bài seed dùng nội dung minh họa; mod+ có thể sửa. */
  body: string;
  /** Chỉ YouTube/Vimeo (đã whitelist host). */
  videoUrl?: string;
  /** URL nhúng đã chuẩn hóa từ videoUrl — FE chỉ cần đưa vào iframe. */
  embedUrl?: string;
  attachments: LessonAttachment[];
}

export interface ClassroomModule {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ). Repository luôn điền. */
  courseId?: string;
  /** Khóa học (entity Course) chứa module. */
  learningCourseId: string;
  index: number;
  title: string;
  description: string;
  thumbnail?: string;
  /** Cấp độ tối thiểu (1..9) để mở khóa module; không đặt = không yêu cầu. */
  requiredLevel?: number;
  lessonIds: string[];
}

export type LockReason = 'previous_module' | 'level' | null;

export interface ClassroomModuleView {
  id: string;
  learningCourseId: string;
  communityId: string;
  index: number;
  title: string;
  description: string;
  lessonsCount: number;
  completedCount: number;
  pct: number;
  locked: boolean;
  thumbnail?: string;
  requiredLevel?: number;
  lockReason: LockReason;
}

export interface ClassroomLessonView extends Omit<ClassroomLesson, 'moduleId' | 'courseId' | 'communityId'> {
  completed: boolean;
}

export interface ClassroomLessonDetail extends ClassroomLessonView {
  learningCourseId: string;
  communityId: string;
  moduleId: string;
  moduleTitle: string;
  moduleIndex: number;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

export interface ClassroomProgress {
  learningCourseId: string | null;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  completedModules: number;
  lastLessonId: string | null;
  nextLesson: { id: string; title: string; moduleId: string } | null;
}

export interface ClassroomSettings {
  certificatesEnabled: boolean;
}

export interface Certificate {
  code: string;
  userId: string;
  communityId: string;
  /** @deprecated alias của communityId. */
  courseId?: string;
  learningCourseId: string;
  holderName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
}

/** Dạng trả về cho chủ chứng nhận (không có userId/courseId). */
export type CertificateView = Pick<Certificate, 'code' | 'holderName' | 'courseTitle' | 'completedAt' | 'issuedAt' | 'learningCourseId' | 'communityId'>;

/** Dạng công khai khi xác minh: KHÔNG lộ userId/email. */
export type PublicCertificateView = Pick<Certificate, 'holderName' | 'courseTitle' | 'issuedAt'> & { valid: true };

export type CoursePublishStatus = 'published' | 'draft' | 'archived';

/** Khóa học (entity mới) — bản ghi thuần, chưa gắn số liệu người xem. */
export interface LearningCourseRecord {
  id: string;
  communityId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  position: number;
  publishStatus: CoursePublishStatus;
  certificatesEnabled: boolean | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO trả về FE (docs/api/communities-courses.md). */
export interface LearningCourseView {
  id: string;
  communityId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  position: number;
  publishStatus: CoursePublishStatus;
  certificatesEnabled: boolean | null;
  certificatesEffective: boolean;
  isDefault: boolean;
  modulesCount: number;
  lessonsCount: number;
  progress: { percent: number; completedLessons: number; totalLessons: number };
  createdAt: string;
  updatedAt: string;
}
