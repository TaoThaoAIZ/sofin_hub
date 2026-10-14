export type ChatRole = 'user' | 'assistant';
export type AnswerSource = 'qa_direct' | 'agent' | 'refusal' | 'handoff' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  answerSource: AnswerSource | null;
  feedback: -1 | 0 | 1;
  createdAt: string;
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
}

export interface ConversationState {
  conversation: ChatConversation;
  messages: ChatMessage[];
}
