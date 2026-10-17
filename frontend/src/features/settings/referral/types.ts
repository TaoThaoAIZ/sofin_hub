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

export type WithdrawalStatus = 'requested' | 'paid' | 'rejected';

export interface Withdrawal {
  id: string;
  amountCents: number;
  refCode: string;
  status: WithdrawalStatus;
  bankName: string;
  accountHolder: string;
  accountLast4: string;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface PayoutAccount {
  bankBin: string;
  bankName: string;
  accountHolder: string;
  accountLast4: string;
  accountMasked: string;
}

/** Rút hoa hồng luôn bằng VND (đồng). */
export interface WithdrawOverview {
  currency: 'VND';
  minCents: number;
  earnedCents: number;
  pendingCents: number;
  paidCents: number;
  withdrawableCents: number;
  account: PayoutAccount | null;
  withdrawals: Withdrawal[];
}

export interface Bank {
  bin: string;
  short: string;
  name: string;
}
