export type LessonType = 'video' | 'text' | 'file';

export interface LessonAttachment {
  name: string;
  url: string;
  size?: number;
}

export interface ClassroomLesson {
  id: string;
  moduleId: string;
  courseId: string;
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
  courseId: string;
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

export interface ClassroomLessonView extends Omit<ClassroomLesson, 'moduleId' | 'courseId'> {
  completed: boolean;
}

export interface ClassroomLessonDetail extends ClassroomLessonView {
  moduleId: string;
  moduleTitle: string;
  moduleIndex: number;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

export interface ClassroomProgress {
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
  courseId: string;
  holderName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
}

/** Dạng trả về cho chủ chứng nhận (không có userId/courseId). */
export type CertificateView = Pick<Certificate, 'code' | 'holderName' | 'courseTitle' | 'completedAt' | 'issuedAt'>;

/** Dạng công khai khi xác minh: KHÔNG lộ userId/email. */
export type PublicCertificateView = Pick<Certificate, 'holderName' | 'courseTitle' | 'issuedAt'> & { valid: true };
