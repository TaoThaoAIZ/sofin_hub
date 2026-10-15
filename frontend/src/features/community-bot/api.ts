import { apiDelete, apiGet, apiPatch, apiPost, apiPostStream, apiPut } from '../../lib/api';
import type { ChatMessage } from '../chatbot/types';
import type { StreamHandlers } from '../chatbot/useMessageQueue';
import type {
  BotConversationRow,
  BotConversationState,
  BotDocument,
  BotDoneData,
  BotQa,
  BotSettings,
  BotSettingsView,
  CommunityBotStatus,
} from './types';

const B = (id: string) => `/communities/${encodeURIComponent(id)}/bot`;

export const fetchBotStatus = (id: string, signal?: AbortSignal) => apiGet<{ data: CommunityBotStatus }>(`${B(id)}/status`, undefined, signal).then((r) => r.data);
export const fetchBotCurrent = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: BotConversationState | null }>(`${B(id)}/conversations/current`, undefined, signal).then((r) => r.data);
export const startBotConversation = (id: string) => apiPost<{ data: BotConversationState }>(`${B(id)}/conversations`).then((r) => r.data);

/** Gửi tin + nhận trả lời dạng stream (giống bot Tào); sự kiện `error` => ném lỗi. */
export async function sendBotMessage(id: string, conversationId: string, text: string, h: StreamHandlers): Promise<BotDoneData> {
  let done: BotDoneData | null = null;
  let failure: string | null = null;
  await apiPostStream(`${B(id)}/conversations/${conversationId}/messages`, { text }, (event, data) => {
    if (event === 'delta') h.onDelta((data as { text: string }).text);
    else if (event === 'replace') h.onReplace((data as { text: string }).text);
    else if (event === 'done') done = data as BotDoneData;
    else if (event === 'error') failure = (data as { message?: string }).message ?? 'error';
  });
  if (failure) throw new Error(failure);
  if (!done) throw new Error('stream ended');
  return done;
}

export const sendBotFeedback = (id: string, messageId: string, value: -1 | 0 | 1) =>
  apiPost<{ data: ChatMessage }>(`${B(id)}/messages/${messageId}/feedback`, { value }).then((r) => r.data);
export const setMyPersona = (id: string, personaKey: string | null) => apiPut<{ data: CommunityBotStatus }>(`${B(id)}/my-persona`, { personaKey }).then((r) => r.data);
export const handoffToOwner = (id: string, conversationId: string) =>
  apiPost<{ data: { via: 'message' | 'notification'; messageConversationId: string | null } }>(`${B(id)}/conversations/${conversationId}/handoff`).then((r) => r.data);

// ---------------------------------------------------------------- chủ / admin cộng đồng
export const fetchBotSettings = (id: string, signal?: AbortSignal) => apiGet<{ data: BotSettingsView }>(`${B(id)}/settings`, undefined, signal).then((r) => r.data);
export const patchBotSettings = (id: string, body: Partial<BotSettings>) => apiPatch<{ data: BotSettingsView }>(`${B(id)}/settings`, body).then((r) => r.data);
export const fetchBotQa = (id: string, status: string, signal?: AbortSignal) =>
  apiGet<{ data: BotQa[] }>(`${B(id)}/qa`, { status, limit: 100 }, signal).then((r) => r.data);
export const createBotQa = (id: string, body: { question: string; answer: string }) => apiPost<{ data: BotQa }>(`${B(id)}/qa`, body).then((r) => r.data);
export const patchBotQa = (id: string, qid: string, body: Partial<Pick<BotQa, 'question' | 'answer' | 'status'>>) =>
  apiPatch<{ data: BotQa }>(`${B(id)}/qa/${qid}`, body).then((r) => r.data);
export const deleteBotQa = (id: string, qid: string) => apiDelete<void>(`${B(id)}/qa/${qid}`);
export const fetchBotDocs = (id: string, signal?: AbortSignal) => apiGet<{ data: BotDocument[] }>(`${B(id)}/docs`, undefined, signal).then((r) => r.data);
export const fetchBotDoc = (id: string, did: string) => apiGet<{ data: BotDocument & { contentMd: string } }>(`${B(id)}/docs/${did}`).then((r) => r.data);
export const createBotDoc = (id: string, body: { title: string; contentMd: string }) => apiPost<{ data: BotDocument }>(`${B(id)}/docs`, body).then((r) => r.data);
export const patchBotDoc = (id: string, did: string, body: { title?: string; contentMd?: string; status?: 'active' | 'archived' }) =>
  apiPatch<{ data: BotDocument }>(`${B(id)}/docs/${did}`, body).then((r) => r.data);
export const fetchBotConversations = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: BotConversationRow[] }>(`${B(id)}/conversations`, { limit: 50 }, signal).then((r) => r.data);
export const fetchBotConversationDetail = (id: string, cid: string) =>
  apiGet<{ data: { id: string; user: { name: string }; messages: (ChatMessage & { redacted: boolean })[] } }>(`${B(id)}/conversations/${cid}/detail`).then((r) => r.data);
