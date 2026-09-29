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
}

export interface PublicProfile {
  id: string;
  name: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  communities: { course: CourseBrief; role: MemberRole; joinedAt: string }[];
  totalPoints: number;
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

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
}
