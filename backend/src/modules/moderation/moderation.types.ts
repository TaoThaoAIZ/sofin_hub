export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other', 'hate_speech', 'scam', 'copyright', 'nsfw'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGET_TYPES = ['post', 'comment', 'member'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Hành động mà mod cộng đồng chọn qua PATCH /reports/:id (3 giá trị đầu); phần còn lại do Platform Admin đặt qua /admin/moderation. */
export const REPORT_ACTIONS = ['dismiss', 'hide_content', 'ban_member', 'warn_user', 'remove_content', 'restrict_user', 'suspend_user', 'ban_user', 'none'] as const;
export const MOD_REPORT_ACTIONS = ['dismiss', 'hide_content', 'ban_member'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export interface Report {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  targetType: ReportTargetType;
  /** postId | commentId | userId tùy targetType. */
  targetId: string;
  /** Chủ của nội dung / thành viên bị báo cáo. */
  targetUserId: string;
  /** Ảnh chụp nội dung lúc báo cáo (còn xem được kể cả khi nội dung bị xóa). */
  targetExcerpt?: string;
  reporterId: string;
  reason: ReportReason;
  detail?: string;
  status: ReportStatus;
  action?: ReportAction;
  note?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ReportView extends Report {
  reporterName: string;
  targetUserName: string;
}
