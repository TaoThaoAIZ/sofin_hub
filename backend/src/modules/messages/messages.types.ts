export interface Attachment {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

export interface Conversation {
  id: string;
  /** Hai người tham gia, đã sắp xếp để cặp (a,b) luôn cho cùng 1 cuộc trò chuyện. */
  userIds: [string, string];
  createdAt: string;
  lastMessageAt: string;
  /** Số thứ tự tin đã đọc gần nhất của từng người. */
  readSeq: Record<string, number>;
  /** Mốc seq mà từng người đã "xóa cuộc trò chuyện" (tin <= mốc bị ẩn với người đó). */
  clearedSeq: Record<string, number>;
}

export interface MessageRecord {
  id: string;
  /** Số thứ tự tăng dần toàn cục — dùng làm cursor và tính chưa đọc, tránh trùng timestamp. */
  seq: number;
  conversationId: string;
  senderId: string;
  content: string;
  attachments: Attachment[];
  createdAt: string;
  deletedAt: string | null;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments: Attachment[];
  createdAt: string;
  deleted: boolean;
}

export const RECALLED_TEXT = 'Tin nhắn đã bị thu hồi';
