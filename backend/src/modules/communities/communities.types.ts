export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinAnswer {
  question: string;
  answer: string;
}

export interface JoinRequest {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  userId: string;
  message: string;
  /** Bản chụp câu hỏi gia nhập + câu trả lời lúc gửi (rỗng nếu cộng đồng không có câu hỏi). */
  answers: JoinAnswer[];
  rulesAcceptedAt?: string;
  status: JoinRequestStatus;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface Invite {
  code: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  createdBy: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface BanRecord {
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  userId: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
}

export interface Review {
  id: string;
  communityId: string;
  /** @deprecated alias của communityId (tương thích JSON cũ) — repository luôn điền. */
  courseId?: string;
  userId: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}
