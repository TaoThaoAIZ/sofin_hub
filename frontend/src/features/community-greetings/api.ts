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
export interface PendingGreetings {
  welcome: { message: string; sender: GreetingSender } | null;
  announcement: { id: string; title: string; body: string; link: string | null; createdAt: string; sender: GreetingSender } | null;
}
export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
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

/** Popup cần hiện ở trang cộng đồng `id` — hỏi 1 lần mỗi lần vào cộng đồng (không tự tải lại). */
export const usePendingGreetings = (id: string) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: greetingKeys.pending(id),
    queryFn: ({ signal }) => apiGet<{ data: PendingGreetings }>(`${G(id)}/pending`, undefined, signal).then((r) => r.data),
    enabled: status === 'authenticated' && Boolean(id),
    staleTime: Infinity,
    retry: false,
  });
};

export const useGreetingSettings = (id: string) =>
  useQuery({ queryKey: greetingKeys.settings(id), queryFn: ({ signal }) => apiGet<{ data: GreetingSettings }>(`${G(id)}/settings`, undefined, signal).then((r) => r.data) });
