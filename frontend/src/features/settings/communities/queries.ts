import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import * as api from './api';
import type { MyCommunity, PendingItems } from './api';

export const myCommunitiesKey = ['settings', 'my-communities'] as const;
export const pendingKey = ['settings', 'my-pending'] as const;

/** Ghim lên đầu, rồi theo thứ tự đã kéo thả (đúng quy tắc của BE). */
export const sortCommunities = (list: MyCommunity[]) =>
  [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.enrolledAt.localeCompare(b.enrolledAt));

export const useMyCommunities = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: myCommunitiesKey, queryFn: ({ signal }) => api.fetchMyCommunities(signal), enabled: status === 'authenticated' });
};

export const usePendingItems = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: pendingKey, queryFn: ({ signal }) => api.fetchPending(signal), enabled: status === 'authenticated' });
};

/** Đổi ngay trên giao diện, lỗi thì trả lại bản cũ rồi đồng bộ lại với BE. */
function useOptimistic<V>(mutationFn: (v: V) => Promise<unknown>, apply: (list: MyCommunity[], v: V) => MyCommunity[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: myCommunitiesKey });
      const prev = qc.getQueryData<MyCommunity[]>(myCommunitiesKey);
      if (prev) qc.setQueryData(myCommunitiesKey, apply(prev, v));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(myCommunitiesKey, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: myCommunitiesKey }),
  });
}

export const usePatchCommunity = () =>
  useOptimistic<{ id: string; body: { sidebarVisible?: boolean; pinned?: boolean } }>(
    ({ id, body }) => api.patchMyCommunity(id, body),
    (list, { id, body }) => sortCommunities(list.map((c) => (c.id === id ? { ...c, ...body } : c))),
  );

export const useReorderCommunities = () =>
  useOptimistic<string[]>(
    (ids) => api.reorderMyCommunities(ids),
    (list, ids) => sortCommunities(list.map((c) => ({ ...c, sortOrder: ids.indexOf(c.id) }))),
  );

export const useLeaveCommunity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.leaveCommunity,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: myCommunitiesKey });
      void qc.invalidateQueries({ queryKey: ['account'] });
      void qc.invalidateQueries({ queryKey: ['notifications', 'settings'] });
    },
  });
};

export const useCancelJoinRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.cancelJoinRequest,
    onSuccess: (_d, id) => {
      qc.setQueryData<PendingItems>(pendingKey, (p) => (p ? { ...p, requests: p.requests.filter((r) => r.id !== id) } : p));
      void qc.invalidateQueries({ queryKey: pendingKey });
    },
  });
};
