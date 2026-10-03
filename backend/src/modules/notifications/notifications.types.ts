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

/** `instant` = gửi email ngay khi có thông báo; `daily`/`weekly` chỉ lưu lựa chọn (chưa có job gom email, xem docs). */
export const EMAIL_DIGESTS = ['off', 'instant', 'daily', 'weekly'] as const;
export type EmailDigest = (typeof EMAIL_DIGESTS)[number];

/** 5 cột của bảng "Theo từng cộng đồng". */
export const COMMUNITY_PREF_KEYS = ['admin', 'event', 'featured', 'comment', 'joinRequest'] as const;
export type CommunityPrefKey = (typeof COMMUNITY_PREF_KEYS)[number];
export type CommunityPref = Record<CommunityPrefKey, boolean>;

/** Loại thông báo -> cột cộng đồng. Loại không có trong bảng (like, thanh toán, hệ thống...) không bị cột nào chặn. */
export const TYPE_COMMUNITY_KEY: Partial<Record<NotificationType, CommunityPrefKey>> = {
  event_created: 'event',
  event_reminder: 'event',
  post_commented: 'comment',
};

export interface QuietHours {
  enabled: boolean;
  /** HH:mm theo múi giờ của user. */
  from: string;
  to: string;
}

export interface NotificationPreferences {
  types: Record<NotificationType, boolean>;
  emailDigest: EmailDigest;
  quiet: QuietHours;
  dmAllowed: boolean;
  emailUnreadDm: boolean;
  notifyFollowedPosts: boolean;
  /** Thiếu cộng đồng/cột = bật. */
  communityPrefs: Record<string, CommunityPref>;
}
