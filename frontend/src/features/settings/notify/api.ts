import { apiGet, apiPut } from '../../../lib/api';
import type { EmailDigest } from '../../notifications/types';
import type { MemberRole } from '../../account/types';

export const COMMUNITY_COLUMNS = [
  { key: 'admin', label: 'Thông báo từ quản trị' },
  { key: 'event', label: 'Nhắc sự kiện' },
  { key: 'featured', label: 'Bài nổi bật' },
  { key: 'comment', label: 'Bình luận bài tôi theo dõi' },
  { key: 'joinRequest', label: 'Yêu cầu gia nhập' },
] as const;
export type CommunityPrefKey = (typeof COMMUNITY_COLUMNS)[number]['key'];
export type CommunityPref = Record<CommunityPrefKey, boolean>;

export interface QuietHours {
  enabled: boolean;
  from: string;
  to: string;
}

export interface NotifyCommunityRow {
  id: string;
  title: string;
  logoUrl: string | null;
  role: MemberRole;
  prefs: CommunityPref;
  /** false = ô "–" (loại thông báo vô nghĩa với vai trò này). */
  applicable: CommunityPref;
}

export interface NotifySettings {
  emailDigest: EmailDigest;
  quiet: QuietHours;
  dmAllowed: boolean;
  emailUnreadDm: boolean;
  notifyFollowedPosts: boolean;
  communities: NotifyCommunityRow[];
}

export interface NotifySettingsInput {
  emailDigest: EmailDigest;
  quiet: QuietHours;
  dmAllowed: boolean;
  emailUnreadDm: boolean;
  notifyFollowedPosts: boolean;
  /** Thay thế cả bảng; chỉ gửi các cộng đồng khác mặc định (rỗng = đặt lại). */
  communityPrefs: Record<string, CommunityPref>;
}

export const fetchNotifySettings = (signal?: AbortSignal) =>
  apiGet<{ data: NotifySettings }>('/notifications/preferences', undefined, signal).then((r) => r.data);

export const saveNotifySettings = (body: NotifySettingsInput) =>
  apiPut<{ data: NotifySettings }>('/notifications/preferences', body).then((r) => r.data);
