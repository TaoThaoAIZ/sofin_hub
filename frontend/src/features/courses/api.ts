import { apiGet, apiPost } from '../../lib/api';
import type { Category, Course, CourseDetail, CourseQuery, Paginated, PlatformStats } from './types';

export const fetchCourses = (query: CourseQuery, signal?: AbortSignal) =>
  apiGet<Paginated<Course>>('/communities', query, signal);

export const fetchCategories = (signal?: AbortSignal) =>
  apiGet<{ data: Category[] }>('/categories', undefined, signal).then((r) => r.data);

export const fetchStats = (signal?: AbortSignal) =>
  apiGet<{ data: PlatformStats }>('/stats', undefined, signal).then((r) => r.data);

export const fetchCourseDetail = (id: string, token?: string, signal?: AbortSignal) =>
  apiGet<{ data: CourseDetail }>(`/communities/${id}`, undefined, signal, { token }).then((r) => r.data);

export const toggleEnrollment = (id: string, token: string) =>
  apiPost<{ data: { enrolled: boolean } }>(`/communities/${id}/enroll`, undefined, { token }).then((r) => r.data);
