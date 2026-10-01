/** `revoked` = điểm âm bù khi xóa bài/sự kiện đã sinh điểm (không bao giờ được `award` trực tiếp). */
export const POINT_REASONS = ['post', 'like_received', 'lesson_complete', 'event_rsvp', 'revoked'] as const;
export type PointReason = (typeof POINT_REASONS)[number];

/** Số điểm cho mỗi loại hoạt động (xem BRD mục 5 — hệ thống điểm). Giá trị tạm, có thể chỉnh sau. */
export const POINT_VALUES: Record<PointReason, number> = {
  post: 5,
  like_received: 2,
  lesson_complete: 3,
  event_rsvp: 1,
  revoked: 0,
};

/**
 * Khóa nghiệp vụ của 1 lần cộng điểm: cùng (user, reason, sourceType, sourceId) chỉ được ghi MỘT lần (unique trong DB) — chặn farm điểm bằng
 * đăng/xóa bài, RSVP/hủy... Quy ước: post → ('post', postId) · like_received → ('post_like', `${postId}:${likerId}`) ·
 * lesson_complete → ('lesson', lessonId) · event_rsvp → ('event', eventId).
 */
export interface PointSource {
  type: 'post' | 'post_like' | 'lesson' | 'event';
  id: string;
}

export interface PointEvent {
  id: string;
  userId: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  points: number;
  reason: PointReason;
  sourceType?: string;
  sourceId?: string;
  createdAt: string;
}

export const LEADERBOARD_WINDOWS = ['7d', '30d', 'all'] as const;
export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number];

export interface LeaderboardRow {
  userId: string;
  points: number;
  rank: number;
}
