import { prisma } from '../../db/prisma.js';
import type { PaymentCard } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import type { PaymentMethodInput } from './payments.schema.js';
import type { PaymentCardView } from './payments.types.js';

/**
 * Quản lý thẻ đã lưu ("Cài đặt > Thanh toán"). DB chỉ có brand/last4/hạn + token cổng (client tokenize) — KHÔNG có số thẻ/CVC;
 * vì server không bao giờ thấy số thẻ nên Luhn chỉ kiểm được phía client, server kiểm định dạng token/brand/last4/hạn dùng (payments.schema).
 *
 * "Thẻ mặc định" = thẻ có `createdAt` MỚI NHẤT (schema chưa có cột isDefault và đã đóng băng). Hệ quả có chủ đích:
 *  - thẻ vừa nhập ở thanh toán/dùng thử (upsertCard) tự thành mặc định;
 *  - "Thêm thẻ" ở Cài đặt: thẻ đầu tiên là mặc định, thẻ sau KHÔNG đổi mặc định (được lùi `createdAt` về trước thẻ cũ nhất);
 *  - "Đặt làm mặc định" = nâng `createdAt` lên hiện tại. Gói đang sống/chưa hủy sẽ chuyển sang thẻ mặc định mới để gia hạn đúng thẻ.
 */
export const MAX_CARDS = 10;

export type SavedCardView = PaymentCardView & { isDefault: boolean };

const view = (c: PaymentCard, defaultId: string | undefined): SavedCardView => ({
  id: c.id,
  brand: c.brand,
  last4: c.last4,
  expMonth: c.expMonth,
  expYear: c.expYear,
  createdAt: c.createdAt.toISOString(),
  isDefault: c.id === defaultId,
});

const isUnique = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

async function cardsOf(userId: string) {
  return prisma.paymentCard.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
}

async function ownedCard(userId: string, id: string) {
  const card = await prisma.paymentCard.findFirst({ where: { id, userId } });
  if (!card) throw HttpError.notFound('Không tìm thấy thẻ');
  return card;
}

/** Gói còn gia hạn/trừ tiền bằng thẻ này (đang sống và chưa đặt hủy cuối kỳ) + gói hosting trả phí đang chạy. */
async function dependants(cardId: string) {
  const [subs, hosting] = await Promise.all([
    prisma.subscription.findMany({ where: { paymentCardId: cardId, status: { in: ['trialing', 'active'] } }, select: { id: true, cancelAtPeriodEnd: true } }),
    prisma.hostingPlan.findMany({ where: { paymentCardId: cardId, planKey: 'pro', status: { in: ['trialing', 'active'] } }, select: { id: true } }),
  ]);
  return { subIds: subs.filter((s) => !s.cancelAtPeriodEnd).map((s) => s.id), hostingIds: hosting.map((h) => h.id) };
}

/** Chuyển gói đang sống / gói hosting từ thẻ `from` sang thẻ `to`. */
async function moveDependants(from: string, to: string) {
  const d = await dependants(from);
  if (d.subIds.length) await prisma.subscription.updateMany({ where: { id: { in: d.subIds } }, data: { paymentCardId: to } });
  if (d.hostingIds.length) await prisma.hostingPlan.updateMany({ where: { id: { in: d.hostingIds } }, data: { paymentCardId: to } });
}

/**
 * Khối "Lần trừ tiền tiếp theo" + "Tổng mỗi tháng": chỉ tính gói đang sống VÀ chưa đặt hủy cuối kỳ (gói đã hủy sẽ không bị trừ nữa).
 * Gói năm quy về /12 (990.000 -> 82.500 trong mockup). Tiền gói thành viên là VND (chuyển khoản; xem A16).
 */
export async function billingSummary(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { in: ['trialing', 'active'] }, cancelAtPeriodEnd: false },
    orderBy: [{ currentPeriodEnd: 'asc' }, { id: 'asc' }],
    include: { community: { select: { title: true } } },
  });
  const first = subs[0];
  return {
    currency: 'VND',
    // Gói dùng thử: hạn thanh toán đầu là lúc hết dùng thử (= currentPeriodEnd của kỳ thử).
    next: first ? { amountCents: first.priceCents, date: first.currentPeriodEnd.toISOString(), communityId: first.communityId, communityTitle: first.community.title, trialing: first.status === 'trialing' } : null,
    monthlyTotalCents: subs.reduce((s, x) => s + (x.interval === 'annual' ? Math.round(x.priceCents / 12) : x.priceCents), 0),
    activeCount: subs.length,
  };
}

/** Trạng thái yêu cầu hoàn tiền mới nhất của từng giao dịch (để trang lịch sử hiện "đang chờ duyệt"...). */
export async function refundStatuses(paymentIds: string[]) {
  const rows = paymentIds.length ? await prisma.refundRequest.findMany({ where: { paymentId: { in: paymentIds } }, orderBy: { createdAt: 'asc' }, select: { paymentId: true, status: true } }) : [];
  return new Map(rows.map((r) => [r.paymentId, r.status])); // bản ghi sau (mới hơn) ghi đè bản trước
}

export const cardsService = {
  async list(userId: string): Promise<SavedCardView[]> {
    const cards = await cardsOf(userId);
    return cards.map((c) => view(c, cards[0]?.id));
  },

  async add(userId: string, input: PaymentMethodInput): Promise<SavedCardView> {
    const cards = await cardsOf(userId);
    if (cards.length >= MAX_CARDS) throw HttpError.coded(400, 'CARD_LIMIT', `Bạn chỉ lưu được tối đa ${MAX_CARDS} thẻ`);
    if (cards.some((c) => c.gatewayToken === input.token || (c.brand === input.brand && c.last4 === input.last4 && c.expMonth === input.expMonth && c.expYear === input.expYear))) {
      throw HttpError.coded(409, 'CARD_EXISTS', 'Thẻ này đã được lưu');
    }
    // Thẻ đầu tiên = mặc định; thẻ sau lùi createdAt để không chiếm mặc định.
    const oldest = cards[cards.length - 1];
    const createdAt = oldest ? new Date(oldest.createdAt.getTime() - 1000) : new Date();
    try {
      const row = await prisma.paymentCard.create({
        data: { userId, gatewayToken: input.token, brand: input.brand, last4: input.last4, expMonth: input.expMonth, expYear: input.expYear, createdAt },
      });
      return view(row, cards[0]?.id ?? row.id);
    } catch (e) {
      if (isUnique(e)) throw HttpError.coded(409, 'CARD_EXISTS', 'Thẻ này đã được lưu');
      throw e;
    }
  },

  async setDefault(userId: string, id: string): Promise<SavedCardView[]> {
    await ownedCard(userId, id);
    const cards = await cardsOf(userId);
    if (cards[0]?.id !== id) {
      const newest = cards[0]!.createdAt.getTime();
      await prisma.paymentCard.update({ where: { id }, data: { createdAt: new Date(Math.max(Date.now(), newest + 1)) } });
      // Gói đang gia hạn bằng thẻ khác chuyển sang thẻ mặc định mới.
      await prisma.subscription.updateMany({
        where: { userId, status: { in: ['trialing', 'active'] }, cancelAtPeriodEnd: false, paymentCardId: { not: null, notIn: [id] } },
        data: { paymentCardId: id },
      });
    }
    return this.list(userId);
  },

  /** "Cập nhật thẻ": thay thông tin (token/brand/last4/hạn) của đúng thẻ này, giữ nguyên id/vị trí mặc định/gói đang gắn. */
  async replace(userId: string, id: string, input: PaymentMethodInput): Promise<SavedCardView> {
    await ownedCard(userId, id);
    const cards = await cardsOf(userId);
    if (cards.some((c) => c.id !== id && (c.gatewayToken === input.token || (c.brand === input.brand && c.last4 === input.last4)))) {
      throw HttpError.coded(409, 'CARD_EXISTS', 'Thẻ này đã được lưu');
    }
    try {
      const row = await prisma.paymentCard.update({
        where: { id },
        data: { gatewayToken: input.token, brand: input.brand, last4: input.last4, expMonth: input.expMonth, expYear: input.expYear },
      });
      return view(row, cards[0]?.id);
    } catch (e) {
      if (isUnique(e)) throw HttpError.coded(409, 'CARD_EXISTS', 'Thẻ này đã được lưu');
      throw e;
    }
  },

  /**
   * Xóa thẻ. Thẻ còn đang được gói (chưa hủy) hoặc gói hosting dùng để gia hạn:
   *  - còn thẻ khác  → chuyển các gói đó sang thẻ mặc định còn lại rồi xóa;
   *  - không còn thẻ → 409 CARD_IN_USE (hãy thêm thẻ khác hoặc hủy gói trước) để không làm gói rớt vì không có thẻ trừ tiền.
   * Giao dịch cũ chỉ mất liên kết thẻ (FK SetNull) — lịch sử/hóa đơn giữ nguyên.
   */
  async remove(userId: string, id: string): Promise<SavedCardView[]> {
    await ownedCard(userId, id);
    const rest = (await cardsOf(userId)).filter((c) => c.id !== id);
    const d = await dependants(id);
    if ((d.subIds.length || d.hostingIds.length) && rest.length === 0) {
      throw HttpError.coded(409, 'CARD_IN_USE', 'Thẻ này đang dùng cho gói thành viên. Hãy thêm thẻ khác hoặc hủy gói trước khi xóa.');
    }
    if (rest.length) await moveDependants(id, rest[0]!.id);
    await prisma.paymentCard.delete({ where: { id } });
    return this.list(userId);
  },
};
