import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import type { AuthUser } from '../auth/types';
import type { AuthSessionInfo, MyEnrollment, MyPoints, PublicProfile, UpdateProfileInput } from './types';

export const updateProfile = (input: UpdateProfileInput) =>
  apiPatch<{ data: AuthUser }>('/auth/me', input).then((r) => r.data);

// skipAuthRetry: sai mật khẩu trả 400 (không phải 401) nhưng vẫn không muốn "sửa hộ" bằng refresh.
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiPost<{ data: { message: string } }>('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data);

export const deleteAccount = (password: string) => apiDelete<void>('/auth/me', { password });

export const fetchSessions = (signal?: AbortSignal) =>
  apiGet<{ data: AuthSessionInfo[] }>('/auth/sessions', undefined, signal).then((r) => r.data);

export const revokeSession = (id: string) => apiDelete<void>(`/auth/sessions/${encodeURIComponent(id)}`);

export const logoutAll = () => apiPost<void>('/auth/logout-all');

export const fetchPublicProfile = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: PublicProfile }>(`/users/${encodeURIComponent(id)}`, undefined, signal).then((r) => r.data);

export const fetchMyEnrollments = (signal?: AbortSignal) =>
  apiGet<{ data: MyEnrollment[] }>('/me/enrollments', undefined, signal).then((r) => r.data);

export const fetchMyPoints = (signal?: AbortSignal) =>
  apiGet<{ data: MyPoints }>('/me/points', undefined, signal).then((r) => r.data);
