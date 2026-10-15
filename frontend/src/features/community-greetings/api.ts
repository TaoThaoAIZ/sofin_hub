import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';

/** Lời chào thành viên mới + thông báo popup của chủ cộng đồng (backend/docs/api/community-greetings.md). */
export interface GreetingSender {
  id: string | null;
  name: string;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'mod' | 'member' | null;
}
export interface PendingAnnouncement {
  id: string;
  title: string;
  body: string;
  /** Nút "Xem chi tiết": link riêng của chủ hoặc bài trên Bảng tin. */
  link: string | null;
  postLink: string | null;
  createdAt: string;
  sender: GreetingSender;
}
export interface PendingGreetings {
  welcome: { message: string; sender: GreetingSender } | null;
  /** Thông báo chưa xem, cũ -> mới (hiện dạng slide). */
  announcements: PendingAnnouncement[];
}
export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  postLink: string | null;
  createdAt: string;
  active: boolean;
  author: string;
  seenCount: number;
}
export interface GreetingSettings {
  welcome: { enabled: boolean; message: string; enabledSince: string | null };
  announcements: AnnouncementRow[];
  members: number;
}

const G = (id: string) => `/communities/${encodeURIComponent(id)}/greetings`;

export const greetingKeys = {
  pending: (id: string) => ['community-greetings', id, 'pending'] as const,
  settings: (id: string) => ['community-greetings', id, 'settings'] as const,
};

export const markWelcomeSeen = (id: string) => apiPost(`${G(id)}/welcome/seen`);
export const markAnnouncementSeen = (id: string, aid: string) => apiPost(`${G(id)}/announcements/${aid}/seen`);
export const saveWelcome = (id: string, body: { enabled: boolean; message: string }) => apiPut<{ data: GreetingSettings }>(`${G(id)}/welcome`, body).then((r) => r.data);
export const publishAnnouncement = (id: string, body: { title: string; body: string; link: string | null }) =>
  apiPost<{ data: GreetingSettings }>(`${G(id)}/announcements`, body).then((r) => r.data);
export const setAnnouncementActive = (id: string, aid: string, active: boolean) =>
  apiPatch<{ data: GreetingSettings }>(`${G(id)}/announcements/${aid}`, { active }).then((r) => r.data);

/**
 * Popup cần hiện ở trang cộng đồng `id`. Mỗi lần vào lại cộng đồng đều hỏi lại server (staleTime 0); popup đã hiện thì
 * GreetingPopup xóa khỏi cache ngay (dropFromCache) để quay lại trang không thấy bản cũ trong cache.
 */
export const usePendingGreetings = (id: string) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: greetingKeys.pending(id),
    queryFn: ({ signal }) => apiGet<{ data: PendingGreetings }>(`${G(id)}/pending`, undefined, signal).then((r) => r.data),
    enabled: status === 'authenticated' && Boolean(id),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

export const useGreetingSettings = (id: string) =>
  useQuery({ queryKey: greetingKeys.settings(id), queryFn: ({ signal }) => apiGet<{ data: GreetingSettings }>(`${G(id)}/settings`, undefined, signal).then((r) => r.data) });

// ------------------------------------------------------------------ quản lý ghim (tối đa `limit` bài / cộng đồng)
export interface PinnedPost {
  id: string;
  title: string;
  category: string;
  /** Bài "Thông báo" => đang hiện popup cho thành viên. */
  popup: boolean;
  seenCount: number | null;
  author: string;
  createdAt: string;
  link: string;
}
export const pinKeys = { list: (id: string) => ['community-pins', id] as const };
export const usePins = (id: string, enabled = true) =>
  useQuery({
    queryKey: pinKeys.list(id),
    queryFn: ({ signal }) => apiGet<{ data: { limit: number; pins: PinnedPost[] } }>(`/communities/${encodeURIComponent(id)}/pins`, undefined, signal).then((r) => r.data),
    enabled,
  });
/** Bật/tắt ghim (dùng để bỏ ghim trong hộp Quản lý ghim). */
export const togglePostPin = (postId: string) => apiPost<{ data: { pinned: boolean } }>(`/posts/${postId}/pin`).then((r) => r.data);
/** Lỗi 409 PIN_LIMIT (đã đủ bài ghim) => mở hộp Quản lý ghim thay vì báo lỗi. */
export const isPinLimit = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'PIN_LIMIT';
