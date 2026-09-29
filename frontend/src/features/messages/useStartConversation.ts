import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openConversation } from './api';
import { messageErrorText } from './queries';

/**
 * Hook bắt đầu (hoặc mở lại) cuộc trò chuyện 1-1: POST /conversations rồi điều hướng tới /messages/:id.
 * `error` là thông báo tiếng Việt (vd. không chung cộng đồng / bị chặn) để nơi gọi tự hiển thị.
 */
export function useStartConversation() {
  const navigate = useNavigate();
  const [pendingUserId, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startConversation = useCallback(
    async (userId: string) => {
      setError(null);
      setPending(userId);
      try {
        const conv = await openConversation(userId);
        navigate(`/messages/${conv.id}`);
      } catch (err) {
        setError(messageErrorText(err));
      } finally {
        setPending(null);
      }
    },
    [navigate],
  );

  return { startConversation, pendingUserId, error, clearError: () => setError(null) };
}
