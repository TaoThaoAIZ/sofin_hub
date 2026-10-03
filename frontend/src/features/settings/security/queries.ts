import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import * as api from './api';

const keys = {
  sessions: ['account', 'sessions'] as const, // cùng khóa với features/account/queries
  blockers: ['settings', 'delete-blockers'] as const,
};

export const useDeleteBlockers = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: keys.blockers, queryFn: ({ signal }) => api.fetchDeleteBlockers(signal), enabled: status === 'authenticated' });
};

export const useRevokeOthers = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.revokeOtherSessions, onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }) });
};

/** Mutation trả về AuthUser mới thì đồng bộ vào AuthContext (cờ 2FA, tùy chọn...). */
function useUserMutation<V>(fn: (v: V) => Promise<import('../../auth/types').AuthUser>) {
  const { updateUser } = useAuth();
  return useMutation({ mutationFn: fn, onSuccess: updateUser });
}

export const useUpdatePreferences = () => useUserMutation(api.updatePreferences);
export const useEnableTwoFactor = () => useUserMutation(api.enableTwoFactor);
export const useDisableTwoFactor = () => useUserMutation(api.disableTwoFactor);
export const useSetupTwoFactor = () => useMutation({ mutationFn: api.setupTwoFactor });
export const useChangeEmail = () =>
  useMutation({ mutationFn: (v: { newEmail: string; password: string }) => api.changeEmail(v.newEmail, v.password) });
