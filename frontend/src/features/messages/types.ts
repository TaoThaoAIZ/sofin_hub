export interface MessageAttachment {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments: MessageAttachment[];
  createdAt: string;
  deleted: boolean;
}

export interface ConversationView {
  id: string;
  other: { id: string; name: string };
  lastMessage: MessageView | null;
  unreadCount: number;
  lastMessageAt: string;
  blockedByMe: boolean;
}

export interface MessagePage {
  data: MessageView[];
  meta: { hasMore: boolean; nextBefore: string | null };
}

export interface BlockedUser {
  id: string;
  name: string;
  blockedAt: string;
}
