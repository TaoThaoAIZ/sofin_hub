import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchCategories, fetchCourseDetail, fetchCourses, fetchStats, toggleEnrollment } from './api';
import type { CourseDetail, CourseQuery } from './types';

export const courseKeys = {
  all: ['courses'] as const,
  list: (query: CourseQuery) => [...courseKeys.all, 'list', query] as const,
  detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
  categories: ['categories'] as const,
  stats: ['stats'] as const,
};

export const useCourses = (query: CourseQuery) =>
  useQuery({
    queryKey: courseKeys.list(query),
    queryFn: ({ signal }) => fetchCourses(query, signal),
    // Giữ dữ liệu trang cũ khi đổi filter/trang để lưới không bị nháy
    placeholderData: keepPreviousData,
  });

export const useCategories = () =>
  useQuery({
    queryKey: courseKeys.categories,
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 5 * 60_000,
  });

export const usePlatformStats = () =>
  useQuery({
    queryKey: courseKeys.stats,
    queryFn: ({ signal }) => fetchStats(signal),
    staleTime: 5 * 60_000,
  });

/** Chi tiết cộng đồng (GET /communities/:id). */
export const useCommunityDetail = (id: string) => {
  const { accessToken, status } = useAuth();
  return useQuery({
    queryKey: courseKeys.detail(id),
    queryFn: ({ signal }) => fetchCourseDetail(id, accessToken ?? undefined, signal),
    enabled: status !== 'loading',
  });
};

export const useToggleEnrollment = (id: string) => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!accessToken) throw new Error('Bạn cần đăng nhập để tham gia khóa học');
      return toggleEnrollment(id, accessToken);
    },
    onSuccess: ({ enrolled }) => {
      queryClient.setQueryData<CourseDetail>(courseKeys.detail(id), (prev) =>
        prev ? { ...prev, viewerEnrolled: enrolled } : prev,
      );
    },
  });
};
export const useCourseDetail = useCommunityDetail;
export const useCommunities = useCourses;
