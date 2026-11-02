import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchChatbotStatus, fetchCurrentConversation } from './api';

export const chatbotKeys = {
  status: ['chatbot', 'status'] as const,
  /** Gắn theo userId: đổi tài khoản không tải lại trang thì người sau KHÔNG thấy hội thoại (bộ nhớ đệm) của người trước. */
  current: (userId: string) => ['chatbot', 'current', userId] as const,
};

/** Trạng thái chatbot (bật/tắt, link Zalo) — chỉ hỏi khi đã đăng nhập. */
export const useChatbotStatus = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: chatbotKeys.status, queryFn: ({ signal }) => fetchChatbotStatus(signal), enabled: status === 'authenticated', staleTime: 5 * 60_000 });
};

/**
 * Hội thoại đang dở (nạp khi mở widget). Widget tự ghi trạng thái mới nhất vào bộ nhớ đệm này (ChatSession) nên không cần tải lại khi
 * mở lại khung chat; F5 thì tải lại từ server.
 */
export const useCurrentConversation = (userId: string) =>
  useQuery({ queryKey: chatbotKeys.current(userId), queryFn: ({ signal }) => fetchCurrentConversation(signal), staleTime: Infinity });
