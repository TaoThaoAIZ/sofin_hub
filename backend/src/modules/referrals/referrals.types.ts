import type { ReferralKindName } from './referrals.schema.js';

/** Trạng thái hiển thị của 1 người được giới thiệu. `none` = chưa phát sinh (chưa tham gia / chưa mở cộng đồng trả phí). */
export type ReferralRowStatus = 'paid' | 'trial' | 'cancel' | 'none';

export interface ReferralRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  communityId: string | null;
  communityName: string | null;
  signedUpAt: string;
  status: ReferralRowStatus;
  /** Tổng hoa hồng (không tính đã hủy) của người này theo `kind`, đơn vị nhỏ nhất của `currency`. */
  earnedCents: number;
}

export interface ReferralOverview {
  kind: ReferralKindName;
  code: string;
  link: string;
  /** Tiền của `kind` này: member = VND (đồng), creator = tiền gói hosting (VND, không có phần thập phân). */
  currency: string;
  rates: { creatorRateBps: number; memberRateBps: number; rateBps: number; attributionDays: number; payoutDay: number };
  kpis: {
    registered: { value: number; delta: number | null };
    paying: { value: number };
    commissionThisMonth: { cents: number; deltaPct: number | null };
    pendingPayout: { cents: number; payoutOn: string };
  };
}
