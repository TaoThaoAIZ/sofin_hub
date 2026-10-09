import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';
import type { PaymentMethodInput } from '../../lib/card';
import type {
  DraftStepName,
  DraftView,
  LaunchChecklist,
  OwnerPlansResponse,
  PayoutAccountView,
  PublishedCommunity,
  RevenueEstimate,
  SlugCheck,
} from './types';

export interface BasicsBody {
  title: string;
  slug?: string;
  description: string;
  category: string;
}
export interface PlanBody {
  planKey: 'start' | 'pro';
  cycle?: 'monthly' | 'annual';
  paymentMethod?: PaymentMethodInput;
}
export interface IdentityBody {
  logoUrl?: string | null;
  coverUrl?: string | null;
  brandColor?: string | null;
  promise?: string | null;
  benefits?: string[];
  introVideoUrl?: string | null;
}
export interface MembersBody {
  visibility?: 'public' | 'private';
  language?: 'vi' | 'en';
  priceUsd?: number;
  priceAnnualUsd?: number | null;
  joinQuestions?: string[];
  rules?: { title: string; body?: string }[];
  requireRulesAgreement?: boolean;
  autoApprovePaid?: boolean;
}
export interface StepBody {
  basics: Partial<BasicsBody>;
  plan: PlanBody;
  identity: IdentityBody;
  members: MembersBody;
}

export const checkSlug = (slug: string, signal?: AbortSignal) =>
  apiGet<{ data: SlugCheck }>('/communities/slug-available', { slug }, signal).then((r) => r.data);

export const createDraft = (body: BasicsBody) => apiPost<{ data: DraftView }>('/communities/drafts', body).then((r) => r.data);
export const listDrafts = (signal?: AbortSignal) => apiGet<{ data: DraftView[] }>('/me/community-drafts', undefined, signal).then((r) => r.data);
export const getDraft = (id: string, signal?: AbortSignal) => apiGet<{ data: DraftView }>(`/communities/${id}/draft`, undefined, signal).then((r) => r.data);
export const patchDraftStep = <S extends DraftStepName>(id: string, step: S, body: StepBody[S]) =>
  apiPatch<{ data: DraftView }>(`/communities/${id}/draft/steps/${step}`, body).then((r) => r.data);
export const deleteDraft = (id: string) => apiDelete<{ data: { deleted: boolean } }>(`/communities/${id}/draft`).then((r) => r.data);
export const publishDraft = (id: string) =>
  apiPost<{ data: PublishedCommunity }>(`/communities/${id}/publish`, { acceptTerms: true }).then((r) => r.data);

export const fetchOwnerPlans = (signal?: AbortSignal) => apiGet<{ data: OwnerPlansResponse }>('/owner-plans', undefined, signal).then((r) => r.data);
export const fetchRevenueEstimate = (price: number, interval: 'monthly' | 'annual', signal?: AbortSignal) =>
  apiGet<{ data: RevenueEstimate }>('/communities/revenue-estimate', { price, interval }, signal).then((r) => r.data);
export const fetchRulesTemplate = (signal?: AbortSignal) =>
  apiGet<{ data: { rules: { title: string; body?: string }[] } }>('/communities/rules-template', undefined, signal).then((r) => r.data.rules);

export const putPayoutAccount = (id: string, body: { bankName: string; accountHolder: string; accountNumber: string }) =>
  apiPut<{ data: PayoutAccountView }>(`/communities/${id}/payout-account`, body).then((r) => r.data);
export const skipPayoutAccount = (id: string) => apiPost<{ data: PayoutAccountView }>(`/communities/${id}/payout-account/skip`).then((r) => r.data);

export const fetchLaunchChecklist = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: LaunchChecklist }>(`/communities/${id}/launch-checklist`, undefined, signal).then((r) => r.data);
