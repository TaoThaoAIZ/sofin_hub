export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGET_TYPES = ['post', 'comment', 'member'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_ACTIONS = ['dismiss', 'hide_content', 'ban_member'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export interface Report {
  id: string;
  courseId: string;
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
