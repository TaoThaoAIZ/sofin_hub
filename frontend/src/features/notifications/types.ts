import i18n from '../../i18n';

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

/** Loại bắt buộc (BE luôn gửi, không tắt được) — khớp MANDATORY_TYPES ở backend. */
export const MANDATORY_TYPES: readonly NotificationType[] = [
  'payment_succeeded',
  'payment_failed',
  'role_changed',
  'removed_from_community',
  'report_resolved',
];

export const notificationTypeLabel = (type: NotificationType): string => i18n.t(`types.${type}`, { ns: 'notifications' });

export const NOTIFICATION_TYPE_ICON: Record<NotificationType, string> = {
  post_liked: 'favorite',
  post_commented: 'chat_bubble',
  event_created: 'event',
  event_reminder: 'alarm',
  member_joined: 'person_add',
  role_changed: 'shield_person',
  removed_from_community: 'person_remove',
  payment_succeeded: 'payments',
  payment_failed: 'error',
  report_resolved: 'flag',
  message_received: 'forum',
  system: 'campaign',
};

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  courseId?: string;
  readAt: string | null;
  createdAt: string;
}

export type EmailDigest = 'off' | 'instant' | 'daily' | 'weekly';

export interface NotificationPreferences {
  types: Record<NotificationType, boolean>;
  emailDigest: EmailDigest;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NotificationList {
  data: AppNotification[];
  meta: PageMeta;
}
