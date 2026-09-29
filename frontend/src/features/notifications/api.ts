import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api';
import type { AppNotification, EmailDigest, NotificationList, NotificationPreferences, NotificationType } from './types';

export const fetchNotifications = (params: { unread?: boolean; page?: number; limit?: number }, signal?: AbortSignal) =>
  apiGet<NotificationList>('/notifications', params, signal);

export const fetchUnreadCount = (signal?: AbortSignal) =>
  apiGet<{ data: { count: number } }>('/notifications/unread-count', undefined, signal).then((r) => r.data.count);

export const markNotificationRead = (id: string) =>
  apiPost<{ data: AppNotification }>(`/notifications/${id}/read`).then((r) => r.data);

export const markAllNotificationsRead = () =>
  apiPost<{ data: { updated: number } }>('/notifications/read-all').then((r) => r.data);

export const deleteNotification = (id: string) => apiDelete<{ data: { deleted: true } }>(`/notifications/${id}`);

export const fetchPreferences = (signal?: AbortSignal) =>
  apiGet<{ data: NotificationPreferences }>('/notifications/preferences', undefined, signal).then((r) => r.data);

export const updatePreferences = (body: { types?: Partial<Record<NotificationType, boolean>>; emailDigest?: EmailDigest }) =>
  apiPut<{ data: NotificationPreferences }>('/notifications/preferences', body).then((r) => r.data);
