import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchChatbotStatus, fetchCurrentConversation } from './api';

export const chatbotKeys = {
  status: ['chatbot', 'status'] as const,
  current: ['chatbot', 'current'] as const,
};

/** Trạng thái chatbot (bật/tắt, link Zalo) — chỉ hỏi khi đã đăng nhập. */
export const useChatbotStatus = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: chatbotKeys.status, queryFn: ({ signal }) => fetchChatbotStatus(signal), enabled: status === 'authenticated', staleTime: 5 * 60_000 });
};

/** Hội thoại đang dở (nạp khi mở widget). */
export const useCurrentConversation = (enabled: boolean) =>
  useQuery({ queryKey: chatbotKeys.current, queryFn: ({ signal }) => fetchCurrentConversation(signal), enabled, staleTime: Infinity });
