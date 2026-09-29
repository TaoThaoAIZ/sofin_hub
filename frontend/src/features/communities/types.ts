import type { CategoryId, Language, Visibility } from '../courses/types';

export type MemberRoleDetail = 'member' | 'mod' | 'admin' | 'owner';
/** Vai trò hiệu lực của người xem (thêm platform_admin). */
export type ViewerRole = MemberRoleDetail | 'platform_admin';
export type AssignableRole = 'member' | 'mod' | 'admin';

export const ROLE_LABEL: Record<ViewerRole, string> = {
  member: 'Thành viên',
  mod: 'Điều hành viên',
  admin: 'Quản trị viên',
  owner: 'Chủ cộng đồng',
  platform_admin: 'Quản trị nền tảng',
};

export const ROLE_RANK: Record<ViewerRole, number> = { member: 0, mod: 1, admin: 2, owner: 3, platform_admin: 4 };

export const isAtLeast = (role: ViewerRole | null | undefined, min: ViewerRole) =>
  !!role && ROLE_RANK[role] >= ROLE_RANK[min];

export interface CreateCommunityInput {
  title: string;
  description: string;
  category: CategoryId;
  priceUsd: number;
  visibility: Visibility;
  language: Language;
  thumbnail?: string;
}

export type UpdateCommunityInput = Partial<CreateCommunityInput>;

export interface UserBrief {
  id: string;
  name: string;
}

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

export interface JoinRequestWithUser extends JoinRequest {
  user: UserBrief;
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

export interface InvitePreview {
  code: string;
  course: { id: string; title: string; thumbnail: string; members: number; visibility: Visibility; priceUsd: number };
  expiresAt: string | null;
  remainingUses: number | null;
}

export interface BanRow {
  courseId: string;
  userId: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  user: UserBrief;
}

export interface Review {
  id: string;
  userId: string;
  name: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewList {
  data: Review[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: { rating: number; ratingCount: number };
}

export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam / quảng cáo' },
  { key: 'harassment', label: 'Quấy rối, xúc phạm' },
  { key: 'inappropriate', label: 'Nội dung không phù hợp' },
  { key: 'misinformation', label: 'Thông tin sai lệch' },
  { key: 'other', label: 'Lý do khác' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['key'];
