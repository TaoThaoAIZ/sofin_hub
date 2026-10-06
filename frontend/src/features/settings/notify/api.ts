import i18n from '../../../i18n';
import { apiGet, apiPut } from '../../../lib/api';
import type { EmailDigest } from '../../notifications/types';
import type { MemberRole } from '../../account/types';

export const COMMUNITY_COLUMNS = [
  { key: 'admin', get label() { return i18n.t('notifyCols.admin', { ns: 'settings' }); } },
  { key: 'event', get label() { return i18n.t('notifyCols.event', { ns: 'settings' }); } },
  { key: 'featured', get label() { return i18n.t('notifyCols.featured', { ns: 'settings' }); } },
  { key: 'comment', get label() { return i18n.t('notifyCols.comment', { ns: 'settings' }); } },
  { key: 'joinRequest', get label() { return i18n.t('notifyCols.joinRequest', { ns: 'settings' }); } },
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
