// Kiểu dữ liệu của wizard "Tạo cộng đồng". Phần "view model" (HostPlanInfo, FeeInfo, PayoutInfo) là cái các bước hiển thị;
// phần còn lại bám sát hợp đồng backend/docs/api/community-wizard.md.

/** Gói lưu trữ dành cho chủ cộng đồng (bước 2). Giá theo đơn vị chính của `currency` (VND = số nguyên). */
export interface HostPlanInfo {
  id: 'start' | 'pro';
  name: string;
  tagline?: string;
  free: boolean;
  popular?: boolean;
  currency: string;
  monthlyPrice: number;
  annualPrice: number;
  /** % tiết kiệm khi trả theo năm (do BE trả ở `cycles`). */
  annualSavingsPct?: number;
  trialDays: number;
  features: string[];
  fit?: string;
}

/** Tỷ lệ phí giao dịch theo gói (0.029 = 2,9%) — chỉ để hiển thị máy tính "Gói nào lợi hơn?". */
export interface FeeInfo {
  freeFeeRate: number;
  proFeeRate: number;
}

export interface PayoutInfo {
  status: 'none' | 'connected' | 'skipped';
  label?: string;
}

// ---- Hợp đồng BE ----
export interface OwnerPlansResponse {
  currency: string;
  trialDays: number;
  remindDaysBefore: number;
  required: boolean;
  cycles: { key: 'monthly' | 'annual'; label: string; savingsPct: number }[];
  plans: {
    key: 'start' | 'pro';
    name: string;
    tagline?: string;
    priceMonthly: number;
    priceAnnual: number;
    transactionFeePct: number;
    features: string[];
    fit?: string;
    popular?: boolean;
  }[];
}

export type DraftStepName = 'basics' | 'plan' | 'identity' | 'members';

export interface CardSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface HostingPlanView {
  planKey: 'start' | 'pro';
  cycle: 'monthly' | 'annual';
  priceAmount: number;
  currency: string;
  status: 'trialing' | 'active' | 'canceled';
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  firstChargeDate?: string | null;
  firstChargeAmount?: number | null;
  todayDue?: number;
  paymentMethod?: CardSummary | null;
  mock?: boolean;
}

export interface PayoutAccountView {
  status: 'connected' | 'skipped';
  bankName?: string;
  accountHolder?: string;
  accountMasked?: string;
  connectedAt?: string;
  note?: string;
}

export interface DraftView {
  id: string;
  slug: string;
  status: 'draft';
  createdAt: string;
  updatedAt: string;
  completedSteps: DraftStepName[];
  nextStep: DraftStepName | 'launch';
  basics: { title: string; slug: string; description: string; category: string };
  plan: HostingPlanView | null;
  identity: {
    logoUrl: string | null;
    coverUrl: string | null;
    brandColor: string | null;
    promise: string | null;
    benefits: string[];
    introVideoUrl: string | null;
  };
  members: {
    visibility: 'public' | 'private';
    language: 'vi' | 'en';
    priceUsd: number;
    priceAnnualUsd: number | null;
    annualSavingsPct?: number | null;
    joinQuestions: string[];
    rules: { title: string; body?: string }[];
    requireRulesAgreement: boolean;
    autoApprovePaid: boolean;
  };
  payout: PayoutAccountView | null;
  readiness: { canPublish: boolean; missing: { step: string; field: string; message: string }[] };
}

export interface SlugCheck {
  slug: string;
  available: boolean;
  reason: null | 'invalid_format' | 'too_short' | 'too_long' | 'reserved' | 'taken';
  message: string;
  suggestion?: string;
}

export interface RevenueEstimate {
  interval: 'monthly' | 'annual';
  priceUsd: number;
  members: number;
  grossCents: number;
  netCents: number;
  netPerMemberCents: number;
  commissionPct: number;
  gatewayFeePct: number;
  note?: string;
}

export interface LaunchChecklist {
  slug: string;
  doneCount: number;
  total: number;
  items: { key: string; done: boolean; current?: number; required?: number }[];
  discovery: {
    eligible: boolean;
    conditions: { key: string; met: boolean; current?: number; required?: number }[];
  };
}

export interface PublishedCommunity {
  id: string;
  title: string;
  defaultCourseId?: string;
}
