export type ChatRole = 'user' | 'assistant';
export type AnswerSource = 'qa_direct' | 'agent' | 'refusal' | 'handoff' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  answerSource: AnswerSource | null;
  feedback: -1 | 0 | 1;
  createdAt: string;
  /** Ảnh khách gửi kèm (link riêng tư /api/files/<key>). */
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  url: string;
  contentType: string;
}

export interface ChatConversation {
  id: string;
  status: 'open' | 'handed_off' | 'closed';
  ticketCode: string | null;
}

export interface ChatbotStatus {
  available: boolean;
  zaloSupportUrl: string | null;
  maxInputChars: number;
  /** Cho gửi ảnh (ảnh chụp lỗi, màn hình...) để Tào đọc. */
  imagesEnabled?: boolean;
}

export interface Handoff {
  ticketId: string;
  ticketCode: string;
  zaloUrl: string | null;
  message: string;
}

export interface ToolCard {
  id: string;
  name: string;
  free: boolean;
  downloadUrl: string | null;
}

export interface DoneData {
  message: ChatMessage;
  conversation: ChatConversation;
  handoff: Handoff | null;
  tools: ToolCard[];
  /** Lựa chọn trả lời nhanh khi bot hỏi lại khách. */
  suggestions: string[];
}

export interface ConversationState {
  conversation: ChatConversation;
  messages: ChatMessage[];
}
