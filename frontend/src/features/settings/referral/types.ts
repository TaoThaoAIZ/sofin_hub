export type ReferralKind = 'creator' | 'member';
export type ReferralRowStatus = 'paid' | 'trial' | 'cancel' | 'none';

export interface ReferralOverview {
  kind: ReferralKind;
  code: string;
  link: string;
  /** USD (cent) cho member; VND (đồng) cho creator. */
  currency: string;
  rates: { creatorRateBps: number; memberRateBps: number; rateBps: number; attributionDays: number; payoutDay: number };
  kpis: {
    registered: { value: number; delta: number | null };
    paying: { value: number };
    commissionThisMonth: { cents: number; deltaPct: number | null };
    pendingPayout: { cents: number; payoutOn: string };
  };
}

export interface ReferralRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  communityId: string | null;
  communityName: string | null;
  signedUpAt: string;
  status: ReferralRowStatus;
  earnedCents: number;
}

export interface ReferralUsers {
  data: ReferralRow[];
  meta: { total: number; shown: number; currency: string };
}

export interface CommissionDetail {
  currency: string;
  totalCents: number;
  data: { id: string; createdAt: string; baseCents: number; rateBps: number; amountCents: number; status: 'pending' | 'paid' | 'void'; communityId: string | null }[];
}
