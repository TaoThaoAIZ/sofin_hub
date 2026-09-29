import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';
import type { EmailDigest, NotificationType } from './types';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params: object) => ['notifications', 'list', params] as const,
  unread: ['notifications', 'unread-count'] as const,
  prefs: ['notifications', 'preferences'] as const,
};

export const useUnreadNotificationCount = () => {
  const { status } = useAuth();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => api.fetchUnreadCount(signal),
    enabled: status === 'authenticated',
  });
};

export const useNotifications = (params: { unread?: boolean; page?: number; limit?: number }, enabled = true) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: ({ signal }) => api.fetchNotifications(params, signal),
    enabled: enabled && status === 'authenticated',
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useNotificationPreferences = () => {
  const { status } = useAuth();
  return useQuery({
    queryKey: notificationKeys.prefs,
    queryFn: ({ signal }) => api.fetchPreferences(signal),
    enabled: status === 'authenticated',
  });
};

export const useUpdatePreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { types?: Partial<Record<NotificationType, boolean>>; emailDigest?: EmailDigest }) => api.updatePreferences(body),
    onSuccess: (data) => qc.setQueryData(notificationKeys.prefs, data),
  });
};
