import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';
import type { SearchType } from './types';

export const useSearch = (params: { q: string; type: SearchType; courseId?: string; page: number }) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['search', params],
    queryFn: ({ signal }) => api.search({ ...params, limit: 10 }, signal),
    enabled: status === 'authenticated' && params.q.trim().length >= 2,
    retry: false,
  });
};

export const useSuggest = (q: string) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['search', 'suggest', q],
    queryFn: ({ signal }) => api.suggest(q, signal),
    enabled: status === 'authenticated' && q.trim().length >= 2,
    retry: false,
    staleTime: 60_000,
  });
};

export const useMyCommunities = () => {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['search', 'my-communities'],
    queryFn: ({ signal }) => api.fetchMyCommunities(signal),
    enabled: status === 'authenticated',
  });
};
