import { apiGet, apiPost, apiPostStream } from '../../lib/api';
import type { ChatbotStatus, ChatConversation, ChatMessage, ConversationState, DoneData, Handoff } from './types';

export const fetchChatbotStatus = (signal?: AbortSignal) => apiGet<{ data: ChatbotStatus }>('/chatbot/status', undefined, signal).then((r) => r.data);

export const fetchCurrentConversation = (signal?: AbortSignal) =>
  apiGet<{ data: ConversationState | null }>('/chatbot/conversations/current', undefined, signal).then((r) => r.data);

export const startConversation = () => apiPost<{ data: ConversationState }>('/chatbot/conversations').then((r) => r.data);

export type { StreamHandlers } from './useMessageQueue';
import type { StreamHandlers } from './useMessageQueue';

/** Gửi tin và nhận trả lời dạng stream. Resolve với tin đã lưu (sự kiện `done`); sự kiện `error` => ném lỗi. */
export async function sendChatMessage(conversationId: string, text: string, h: StreamHandlers): Promise<DoneData> {
  let done: DoneData | null = null;
  let failure: string | null = null;
  await apiPostStream(`/chatbot/conversations/${conversationId}/messages`, { text }, (event, data) => {
    if (event === 'delta') h.onDelta((data as { text: string }).text);
    else if (event === 'replace') h.onReplace((data as { text: string }).text);
    else if (event === 'queued') h.onQueued?.((data as { ahead: number }).ahead);
    else if (event === 'done') done = data as DoneData;
    else if (event === 'error') failure = (data as { message?: string }).message ?? 'error';
  });
  if (failure) throw new Error(failure);
  if (!done) throw new Error('stream ended');
  return done;
}

export const requestHandoff = (conversationId: string) =>
  apiPost<{ data: { handoff: Handoff; conversation: ChatConversation; message: ChatMessage | null } }>(`/chatbot/conversations/${conversationId}/handoff`).then((r) => r.data);

export const sendFeedback = (messageId: string, value: -1 | 0 | 1) =>
  apiPost<{ data: ChatMessage }>(`/chatbot/messages/${messageId}/feedback`, { value }).then((r) => r.data);
