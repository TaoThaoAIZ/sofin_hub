import { prisma } from '../../db/prisma.js';
import type { HostingPlan, PayoutAccount, Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { paymentsRepository } from '../payments/payments.repository.js';
import { cardView } from '../payments/payments.service.js';
import { requireRole } from '../permissions/policy.js';
import { cfg } from '../settings/settings.service.js';
import type { PlanBody } from './wizard.schema.js';

const DAY_MS = 86_400_000;

/**
 * Chủ cộng đồng (kể cả khi còn là bản nháp — chưa có Enrollment): nháp ⇒ so ownerId (người khác nhận 404, không lộ sự tồn tại);
 * đã publish ⇒ requireRole owner qua policy như mọi nơi khác. Trả hàng cộng đồng.
 */
export async function requireOwnerOf(userId: string, communityId: string) {
  const row = await prisma.community.findFirst({ where: { id: communityId, deletedAt: null } });
  if (!row) throw HttpError.notFound('Không tìm thấy cộng đồng');
  if (row.moderationStatus === 'draft') {
    if (row.ownerId !== userId) throw HttpError.notFound('Không tìm thấy cộng đồng');
    return row;
  }
  await requireRole(userId, communityId, 'owner');
  return row;
}

// ============================================================================================ gói hosting (MÔ PHỎNG, A16)
/** Nội dung gói lấy từ mockup (tiếng Việt, cố định); giá/ngày thử/phí hiển thị lấy từ Global Settings `owner.*`. */
const PLAN_COPY = {
  start: {
    name: 'Khởi đầu',
    tagline: 'Dành cho cộng đồng mới',
    features: ['Thành viên, khóa học, sự kiện không giới hạn', 'Bảng tin, lịch, bảng xếp hạng & cấp độ', '1 quản trị viên'],
    fit: 'Hợp khi bạn đang thử ý tưởng',
  },
  pro: {
    name: 'Chuyên nghiệp',
    tagline: 'Dành cho cộng đồng phát triển',
    features: ['Mọi thứ của gói Khởi đầu', 'Quản trị viên không giới hạn, tên miền riêng', 'Thành viên giới thiệu nhận hoa hồng, tích hợp thanh toán'],
    fit: 'Hợp khi doanh thu đã ổn định',
  },
} as const;

export function ownerPlanCatalogue() {
  const o = cfg().owner;
  const savingsPct = o.proMonthlyPrice > 0 ? Math.max(0, Math.round((1 - o.proAnnualPrice / (12 * o.proMonthlyPrice)) * 100)) : 0;
  return {
    currency: o.currency,
    trialDays: o.trialDays,
    remindDaysBefore: cfg().payments.trialReminderDays,
    required: o.requirePlan,
    mock: true,
    cycles: [
      { key: 'monthly' as const, label: 'Theo tháng', savingsPct: 0 },
      { key: 'annual' as const, label: 'Theo năm - tặng 2 tháng', savingsPct },
    ],
    plans: [
      { key: 'start' as const, ...PLAN_COPY.start, priceMonthly: 0, priceAnnual: 0, transactionFeePct: o.startFeePct, popular: false },
      { key: 'pro' as const, ...PLAN_COPY.pro, priceMonthly: o.proMonthlyPrice, priceAnnual: o.proAnnualPrice, transactionFeePct: o.proFeePct, popular: true },
    ],
  };
}

type PlanRow = HostingPlan & { paymentCard: { id: string; brand: string; last4: string; expMonth: number; expYear: number; createdAt: Date } | null };

function planView(r: PlanRow) {
  const trialing = r.status === 'trialing';
  return {
    planKey: r.planKey,
    cycle: r.cycle,
    priceAmount: r.priceAmount,
    currency: r.currency,
    status: r.status,
    trialStartedAt: r.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
    firstChargeDate: trialing ? (r.trialEndsAt?.toISOString() ?? null) : null,
    firstChargeAmount: r.planKey === 'pro' ? r.priceAmount : 0,
    todayDue: r.planKey === 'pro' && !trialing && r.status === 'active' ? r.priceAmount : 0,
    paymentMethod: r.paymentCard ? cardView({ ...r.paymentCard, userId: r.ownerId, gatewayToken: '', createdAt: r.paymentCard.createdAt.toISOString() }) : null,
    mock: true as const,
  };
}
export type HostingPlanView = ReturnType<typeof planView>;

export async function getHostingPlanView(communityId: string): Promise<HostingPlanView | null> {
  const row = await prisma.hostingPlan.findUnique({ where: { communityId }, include: { paymentCard: true } });
  return row ? planView(row) : null;
}

export async function selectHostingPlan(userId: string, communityId: string, input: PlanBody, now = new Date()): Promise<HostingPlanView> {
  await requireOwnerOf(userId, communityId);
  const o = cfg().owner;
  const existing = await prisma.hostingPlan.findUnique({ where: { communityId } });
  let data: Prisma.HostingPlanUncheckedUpdateInput;

  if (input.planKey === 'start') {
    // Gói miễn phí: không thẻ, không dùng thử; giữ mốc dùng thử cũ (nếu có) để không bị "dùng thử lại" khi đổi qua đổi lại.
    data = { planKey: 'start', cycle: 'monthly', priceAmount: 0, currency: o.currency, status: 'active', paymentCardId: null, trialStartedAt: existing?.trialStartedAt ?? null, trialEndsAt: existing?.trialEndsAt ?? null };
  } else {
    if (!input.paymentMethod) throw HttpError.coded(400, 'PAYMENT_METHOD_REQUIRED', 'Nhập thông tin thẻ để dùng thử gói Chuyên nghiệp');
    const card = await paymentsRepository.upsertCard(userId, input.paymentMethod); // chỉ brand/last4/hạn + token
    const price = input.cycle === 'annual' ? o.proAnnualPrice : o.proMonthlyPrice;
    // Chỉ được dùng thử MỘT lần cho mỗi cộng đồng: đổi gói rồi quay lại không khởi động lại đồng hồ.
    const trialStartedAt = existing?.trialStartedAt ?? now;
    const trialEndsAt = existing?.trialEndsAt ?? new Date(now.getTime() + o.trialDays * DAY_MS);
    const trialing = trialEndsAt.getTime() > now.getTime();
    data = { planKey: 'pro', cycle: input.cycle, priceAmount: price, currency: o.currency, status: trialing ? 'trialing' : 'active', paymentCardId: card.id, trialStartedAt, trialEndsAt };
  }
  const row = await prisma.hostingPlan.upsert({
    where: { communityId },
    create: { ...(data as Prisma.HostingPlanUncheckedCreateInput), communityId, ownerId: userId },
    update: { ...data, ownerId: userId },
    include: { paymentCard: true },
  });
  return planView(row);
}

export async function readHostingPlan(userId: string, communityId: string): Promise<HostingPlanView | null> {
  await requireOwnerOf(userId, communityId);
  return getHostingPlanView(communityId);
}

// ============================================================================================ tài khoản nhận tiền (MÔ PHỎNG)
function accountView(r: PayoutAccount) {
  return {
    status: r.status,
    ...(r.status === 'connected'
      ? { bankName: r.bankName ?? undefined, accountHolder: r.accountHolder ?? undefined, accountMasked: r.accountLast4 ? `****${r.accountLast4}` : undefined, connectedAt: r.connectedAt?.toISOString() }
      : {}),
    note: 'Mô phỏng: chưa xác minh danh tính/ngân hàng thật. Chỉ lưu 4 số cuối tài khoản.',
  };
}
export type PayoutAccountView = ReturnType<typeof accountView>;

export async function getPayoutAccountView(communityId: string): Promise<PayoutAccountView | null> {
  const row = await prisma.payoutAccount.findUnique({ where: { communityId } });
  return row ? accountView(row) : null;
}

export async function readPayoutAccount(userId: string, communityId: string) {
  await requireOwnerOf(userId, communityId);
  return getPayoutAccountView(communityId);
}

export async function connectPayoutAccount(userId: string, communityId: string, input: { bankName: string; accountHolder: string; accountNumber: string }) {
  await requireOwnerOf(userId, communityId);
  const data = { ownerId: userId, status: 'connected' as const, bankName: input.bankName, accountHolder: input.accountHolder, accountLast4: input.accountNumber.slice(-4), connectedAt: new Date() };
  return accountView(await prisma.payoutAccount.upsert({ where: { communityId }, create: { ...data, communityId }, update: data }));
}

/** "Bỏ qua, làm sau": không ghi đè tài khoản ĐÃ kết nối (an toàn khi bấm nhầm/gọi lại). */
export async function skipPayoutAccount(userId: string, communityId: string) {
  await requireOwnerOf(userId, communityId);
  const cur = await prisma.payoutAccount.findUnique({ where: { communityId } });
  if (cur?.status === 'connected') return accountView(cur);
  return accountView(
    await prisma.payoutAccount.upsert({
      where: { communityId },
      create: { communityId, ownerId: userId, status: 'skipped' },
      update: { ownerId: userId, status: 'skipped' },
    }),
  );
}
