import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';

const keys = {
  sessions: ['account', 'sessions'] as const,
  profile: (id: string) => ['account', 'profile', id] as const,
  enrollments: ['account', 'enrollments'] as const,
  points: ['account', 'points'] as const,
};

export const useSessions = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: keys.sessions, queryFn: ({ signal }) => api.fetchSessions(signal), enabled: status === 'authenticated' });
};

export const useRevokeSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.revokeSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
  });
};

export const useUpdateProfile = () => {
  const { updateUser } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (user) => {
      updateUser(user);
      qc.invalidateQueries({ queryKey: keys.profile(user.id) });
    },
  });
};

export const useChangePassword = () =>
  useMutation({ mutationFn: (v: { currentPassword: string; newPassword: string }) => api.changePassword(v.currentPassword, v.newPassword) });

export const useDeleteAccount = () => useMutation({ mutationFn: api.deleteAccount });

export const useLogoutAll = () => useMutation({ mutationFn: api.logoutAll });

export const usePublicProfile = (id: string) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.profile(id),
    queryFn: ({ signal }) => api.fetchPublicProfile(id, signal),
    enabled: status === 'authenticated' && !!id,
    retry: false,
  });
};

export const useMyEnrollments = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: keys.enrollments, queryFn: ({ signal }) => api.fetchMyEnrollments(signal), enabled: status === 'authenticated' });
};

export const useMyPoints = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: keys.points, queryFn: ({ signal }) => api.fetchMyPoints(signal), enabled: status === 'authenticated' });
};
