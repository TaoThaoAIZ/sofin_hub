import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchBotConversations, fetchBotCurrent, fetchBotDocs, fetchBotQa, fetchBotSettings, fetchBotStatus } from './api';

export const botKeys = {
  all: (id: string) => ['community-bot', id] as const,
  status: (id: string) => ['community-bot', id, 'status'] as const,
  current: (id: string) => ['community-bot', id, 'current'] as const,
  settings: (id: string) => ['community-bot', id, 'settings'] as const,
  qa: (id: string, status: string) => ['community-bot', id, 'qa', status] as const,
  docs: (id: string) => ['community-bot', id, 'docs'] as const,
  conversations: (id: string) => ['community-bot', id, 'conversations'] as const,
};

/** Trạng thái bot của cộng đồng `id` (undefined => không hỏi). Dùng cả ở widget Tào để ẩn Tào khi cộng đồng có bot riêng. */
export const useCommunityBotStatus = (id: string | undefined) => {
  const { status } = useAuth();
  return useQuery({
    queryKey: botKeys.status(id ?? ''),
    queryFn: ({ signal }) => fetchBotStatus(id!, signal),
    enabled: status === 'authenticated' && Boolean(id),
    staleTime: 60_000,
    retry: false,
  });
};

export const useBotCurrent = (id: string, enabled: boolean) =>
  useQuery({ queryKey: botKeys.current(id), queryFn: ({ signal }) => fetchBotCurrent(id, signal), enabled, staleTime: Infinity });

export const useBotSettings = (id: string) => useQuery({ queryKey: botKeys.settings(id), queryFn: ({ signal }) => fetchBotSettings(id, signal) });
export const useBotQa = (id: string, status: string) => useQuery({ queryKey: botKeys.qa(id, status), queryFn: ({ signal }) => fetchBotQa(id, status, signal) });
export const useBotDocs = (id: string) => useQuery({ queryKey: botKeys.docs(id), queryFn: ({ signal }) => fetchBotDocs(id, signal) });
export const useBotConversations = (id: string) => useQuery({ queryKey: botKeys.conversations(id), queryFn: ({ signal }) => fetchBotConversations(id, signal) });
