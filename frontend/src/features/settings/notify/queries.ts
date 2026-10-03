import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { notificationKeys } from '../../notifications/queries';
import * as api from './api';

export const notifySettingsKey = ['notifications', 'settings'] as const;

export const useNotifySettings = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: notifySettingsKey, queryFn: ({ signal }) => api.fetchNotifySettings(signal), enabled: status === 'authenticated' });
};

export const useSaveNotifySettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.saveNotifySettings,
    onSuccess: (data) => {
      qc.setQueryData(notifySettingsKey, data);
      void qc.invalidateQueries({ queryKey: notificationKeys.prefs }); // trang Thông báo cũ dùng chung endpoint
    },
  });
};
