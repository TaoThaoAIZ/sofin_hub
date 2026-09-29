export const POINT_REASONS = ['post', 'like_received', 'lesson_complete', 'event_rsvp'] as const;
export type PointReason = (typeof POINT_REASONS)[number];

/** Số điểm cho mỗi loại hoạt động (xem BRD mục 5 — hệ thống điểm). Giá trị tạm, có thể chỉnh sau. */
export const POINT_VALUES: Record<PointReason, number> = {
  post: 5,
  like_received: 2,
  lesson_complete: 3,
  event_rsvp: 1,
};

export interface PointEvent {
  id: string;
  userId: string;
  courseId: string;
  points: number;
  reason: PointReason;
  createdAt: string;
}

export const LEADERBOARD_WINDOWS = ['7d', '30d', 'all'] as const;
export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number];

export interface LeaderboardRow {
  userId: string;
  points: number;
  rank: number;
}
