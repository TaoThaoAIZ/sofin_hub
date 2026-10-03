export interface CourseBrief {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
  visibility: string;
}

export type MemberRole = 'member' | 'mod' | 'admin' | 'owner';

export interface AuthSessionInfo {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
  /** BE phân tích sẵn từ User-Agent. */
  device: { browser: string; browserVersion?: string; os: string; osVersion?: string; kind: 'desktop' | 'mobile' | 'tablet' | 'unknown' };
}

export interface PublicProfile {
  id: string;
  name: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  handle: string | null;
  instagram: string | null;
  youtube: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  communities: { course: CourseBrief; role: MemberRole; joinedAt: string }[];
  /** Số cộng đồng (chính chủ xem: gồm cả cộng đồng riêng tư). */
  communityCount: number;
  totalPoints: number;
  /** Cấp độ theo tổng điểm. */
  level: number;
}

export interface MyEnrollment {
  course: CourseBrief;
  role: MemberRole;
  enrolledAt: string;
  progressPct: number;
}

export type PointReason = 'post' | 'like_received' | 'lesson_complete' | 'event_rsvp';

export interface PointEvent {
  id: string;
  userId: string;
  courseId: string;
  points: number;
  reason: PointReason;
  createdAt: string;
}

export interface MyPoints {
  total: number;
  byCourse: { course: CourseBrief | { id: string }; points: number }[];
  recent: PointEvent[];
}

/** PATCH /auth/me: chuỗi rỗng = xóa trường (trừ firstName/lastName). */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  handle?: string;
  instagram?: string;
  youtube?: string;
  showOnMap?: boolean;
}
