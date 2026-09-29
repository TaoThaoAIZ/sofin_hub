export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequest {
  id: string;
  courseId: string;
  userId: string;
  message: string;
  status: JoinRequestStatus;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface Invite {
  code: string;
  courseId: string;
  createdBy: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface BanRecord {
  courseId: string;
  userId: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
}

export interface Review {
  id: string;
  courseId: string;
  userId: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}
