export const NOTIFICATION_TYPES = [
  'post_liked',
  'post_commented',
  'event_created',
  'event_reminder',
  'member_joined',
  'role_changed',
  'removed_from_community',
  'payment_succeeded',
  'payment_failed',
  'report_resolved',
  'message_received',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Các loại quan trọng (tiền, quyền, kiểm duyệt): luôn gửi, người dùng không tắt được. */
export const MANDATORY_TYPES: readonly NotificationType[] = [
  'payment_succeeded',
  'payment_failed',
  'role_changed',
  'removed_from_community',
  'report_resolved',
];

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Đường dẫn FE để mở khi bấm vào thông báo, vd. `/courses/photo/community`. */
  link?: string;
  communityId?: string;
  /** @deprecated alias của communityId. */
  courseId?: string;
  readAt: string | null;
  createdAt: string;
}

export const EMAIL_DIGESTS = ['off', 'daily', 'weekly'] as const;
export type EmailDigest = (typeof EMAIL_DIGESTS)[number];

export interface NotificationPreferences {
  types: Record<NotificationType, boolean>;
  emailDigest: EmailDigest;
}
