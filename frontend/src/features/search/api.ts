import { apiGet } from '../../lib/api';
import type { SearchResponse, SearchResult, SearchType } from './types';

export const search = (params: { q: string; type?: SearchType; courseId?: string; page?: number; limit?: number }, signal?: AbortSignal) =>
  apiGet<SearchResponse>('/search', { ...params, type: params.type === 'all' ? undefined : params.type }, signal);

export const suggest = (q: string, signal?: AbortSignal) =>
  apiGet<{ data: SearchResult[] }>('/search/suggest', { q }, signal).then((r) => r.data);

/** Danh sách cộng đồng của tôi — dùng cho bộ lọc theo cộng đồng (GET /me/enrollments). */
export const fetchMyCommunities = (signal?: AbortSignal) =>
  apiGet<{ data: { course: { id: string; title: string } }[] }>('/me/enrollments', undefined, signal).then((r) =>
    r.data.map((e) => ({ id: e.course.id, title: e.course.title })),
  );
