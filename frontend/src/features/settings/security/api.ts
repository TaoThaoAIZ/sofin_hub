import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import type { AuthUser } from '../../auth/types';

export interface Preferences {
  language?: 'vi' | 'en';
  timezone?: string;
  theme?: 'light' | 'dark' | 'system';
}

/** Chỉ LƯU tùy chọn: ứng dụng chưa có đa ngôn ngữ / giao diện tối (xem docs/features/settings-profile-security.md). */
export const updatePreferences = (p: Preferences) => apiPatch<{ data: AuthUser }>('/auth/me/preferences', p).then((r) => r.data);

export const changeEmail = (newEmail: string, password: string) =>
  apiPost<{ data: { pendingEmail: string } }>('/auth/change-email', { newEmail, password }).then((r) => r.data);

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
}
export const setupTwoFactor = () => apiPost<{ data: TwoFactorSetup }>('/auth/2fa/setup').then((r) => r.data);
export const enableTwoFactor = (code: string) => apiPost<{ data: AuthUser }>('/auth/2fa/enable', { code }).then((r) => r.data);
export const disableTwoFactor = (code: string) => apiPost<{ data: AuthUser }>('/auth/2fa/disable', { code }).then((r) => r.data);

/** Đăng xuất mọi thiết bị khác, giữ thiết bị này. */
export const revokeOtherSessions = () => apiPost<void>('/auth/sessions/revoke-others');

export interface DeleteBlockers {
  ownedCommunities: { id: string; title: string }[];
  activeSubscriptions: number;
}
export const fetchDeleteBlockers = (signal?: AbortSignal) =>
  apiGet<{ data: DeleteBlockers }>('/auth/me/delete-blockers', undefined, signal).then((r) => r.data);
