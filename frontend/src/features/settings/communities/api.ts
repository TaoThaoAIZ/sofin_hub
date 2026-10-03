import { apiDelete, apiGet, apiPatch, apiPut } from '../../../lib/api';
import type { MemberRole } from '../../account/types';

export interface MyCommunity {
  id: string;
  title: string;
  logoUrl: string | null;
  thumbnail: string;
  visibility: 'public' | 'private';
  free: boolean;
  role: MemberRole;
  enrolledAt: string;
  memberCount: number;
  points: number;
  level: number;
  sidebarVisible: boolean;
  pinned: boolean;
  sortOrder: number | null;
  subscription: {
    status: 'trialing' | 'active' | 'canceled' | 'expired' | 'past_due' | 'paused';
    interval: 'monthly' | 'annual';
    trialEndsAt: string | null;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  hosting: { status: 'trialing' | 'active' | 'canceled'; trialEndsAt: string | null } | null;
}

export interface PendingRequest {
  id: string;
  communityId: string;
  title: string;
  logoUrl: string | null;
  thumbnail: string;
  createdAt: string;
}

export interface PendingItems {
  requests: PendingRequest[];
  /** Lời mời là link/mã chung (không có người nhận) nên BE luôn trả mảng rỗng. */
  invites: never[];
}

export const fetchMyCommunities = (signal?: AbortSignal) => apiGet<{ data: MyCommunity[] }>('/me/communities', undefined, signal).then((r) => r.data);

export const patchMyCommunity = (id: string, body: { sidebarVisible?: boolean; pinned?: boolean }) =>
  apiPatch<{ data: unknown }>(`/me/communities/${encodeURIComponent(id)}`, body);

export const reorderMyCommunities = (ids: string[]) => apiPut<{ data: { ids: string[] } }>('/me/communities/order', { ids });

export const leaveCommunity = (id: string) => apiDelete<{ data: { left: boolean } }>(`/me/communities/${encodeURIComponent(id)}`);

export const fetchPending = (signal?: AbortSignal) => apiGet<{ data: PendingItems }>('/me/join-requests', undefined, signal).then((r) => r.data);

export const cancelJoinRequest = (id: string) => apiDelete<{ data: { cancelled: boolean } }>(`/join-requests/${encodeURIComponent(id)}`);
