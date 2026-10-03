import { randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import type { ReferralKind } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { notify } from '../notifications/notifications.service.js';
import { cfg } from '../settings/settings.service.js';
import { referralsRepository as repo } from './referrals.repository.js';
import type { ReferralKindName } from './referrals.schema.js';
import type { ReferralOverview, ReferralRow, ReferralRowStatus } from './referrals.types.js';

const DAY_MS = 86_400_000;
/** Bảng "Người bạn đã giới thiệu": số dòng hiển thị khi thu gọn / tối đa khi "Xem tất cả". */
export const COLLAPSED_ROWS = 4;
export const MAX_ROWS = 500;
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const REMIND_TITLE = 'Lời nhắc nâng cấp gói';
const REMIND_COOLDOWN_MS = DAY_MS;

const isUnique = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';
const monthStart = (d: Date, offset = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
const nameOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
const genCode = (len = 8) => Array.from({ length: len }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** Ngày chi trả kế tiếp: ngày `referral.payoutDay` của THÁNG SAU (mặc định mùng 5). */
export function nextPayoutDate(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, cfg().referral.payoutDay));
}

/** Tiền của từng loại: hoa hồng người tạo tính trên gói hosting (owner.currency, VND không có phần thập phân); hoa hồng thành viên tính trên giao dịch USD (cent). */
const currencyOf = (kind: ReferralKindName) => (kind === 'creator' ? cfg().owner.currency : 'USD');
const rateOf = (kind: ReferralKindName) => (kind === 'creator' ? cfg().referral.creatorRateBps : cfg().referral.memberRateBps);

/** Lỗi trong chương trình giới thiệu không bao giờ được làm hỏng luồng tiền/đăng ký đang chạy. */
async function isolate<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.error(`referrals.${label}: bỏ qua do lỗi:`, err);
    return undefined;
  }
}

export function createReferralsService() {
  /** Mã giới thiệu của user: lần đầu tạo theo `handle` (nếu có và chưa bị chiếm), không thì sinh ngẫu nhiên. Nguồn sự thật = bảng ReferralCode. */
  async function ensureCode(userId: string): Promise<string> {
    const existing = await repo.findCodeByUser(userId);
    if (existing) return existing.code;
    const user = await repo.findUser(userId);
    if (!user) throw HttpError.notFound('Không tìm thấy người dùng');
    const candidates = [...(user.handle ? [user.handle.toLowerCase()] : []), ...Array.from({ length: 6 }, () => genCode())];
    for (const code of candidates) {
      try {
        return (await repo.createCode(userId, code)).code;
      } catch (e) {
        if (!isUnique(e)) throw e;
        const again = await repo.findCodeByUser(userId); // đua với request song song của chính user
        if (again) return again.code;
      }
    }
    throw HttpError.conflict('Không tạo được mã giới thiệu, vui lòng thử lại');
  }

  const linkOf = (code: string) => `${env.FRONTEND_URL.replace(/\/$/, '')}/gioi-thieu/${code}`;

  /** Trạng thái + cộng đồng tiêu biểu của từng người được giới thiệu theo loại. */
  async function loadRows(referrerId: string, kind: ReferralKindName, limit = MAX_ROWS): Promise<ReferralRow[]> {
    const refs = await repo.listReferrals(referrerId, limit);
    if (refs.length === 0) return [];
    const ids = refs.map((r) => r.referredUserId);
    const earned = await repo.earnedByUser(referrerId, kind as ReferralKind, ids);
    const rank: Record<ReferralRowStatus, number> = { paid: 4, trial: 3, cancel: 2, none: 1 };
    const pick = new Map<string, { communityId: string; communityName: string; status: ReferralRowStatus }>();
    const offer = (userId: string, communityId: string, communityName: string, status: ReferralRowStatus) => {
      const cur = pick.get(userId);
      if (!cur || rank[status] > rank[cur.status]) pick.set(userId, { communityId, communityName, status });
    };

    if (kind === 'member') {
      // Mỗi người có thể có nhiều gói: ưu tiên gói đang trả phí > dùng thử > đã hủy.
      for (const s of await repo.listSubscriptions(ids)) {
        offer(s.userId, s.communityId, s.community.title, s.status === 'trialing' ? 'trial' : s.status === 'active' ? 'paid' : 'cancel');
      }
    } else {
      for (const c of await repo.listOwnedCommunities(ids)) {
        if (!c.ownerId) continue;
        const plan = c.hostingPlan;
        offer(c.ownerId, c.id, c.title, !plan || plan.planKey !== 'pro' ? 'none' : plan.status === 'active' ? 'paid' : plan.status === 'trialing' ? 'trial' : 'cancel');
      }
    }

    return refs.map((r) => {
      const p = pick.get(r.referredUserId);
      return {
        userId: r.referredUserId,
        name: nameOf(r.referredUser),
        avatarUrl: r.referredUser.avatarUrl,
        communityId: p?.communityId ?? null,
        communityName: p?.communityName ?? null,
        signedUpAt: r.createdAt.toISOString(),
        status: p?.status ?? 'none',
        earnedCents: earned.get(r.referredUserId) ?? 0,
      };
    });
  }

  return {
    ensureCode,

    async overview(userId: string, kind: ReferralKindName, now = new Date()): Promise<ReferralOverview> {
      const code = await ensureCode(userId);
      const k = kind as ReferralKind;
      const thisMonth = monthStart(now);
      const lastMonth = monthStart(now, -1);
      const [registered, newThisMonth, rows, cur, prev, pending] = await Promise.all([
        repo.countReferrals(userId),
        repo.countReferrals(userId, thisMonth),
        loadRows(userId, kind),
        repo.sumCommissions(userId, k, { status: { not: 'void' }, from: thisMonth }),
        repo.sumCommissions(userId, k, { status: { not: 'void' }, from: lastMonth, to: thisMonth }),
        repo.sumCommissions(userId, k, { status: 'pending' }),
      ]);
      const r = cfg().referral;
      return {
        kind,
        code,
        link: linkOf(code),
        currency: currencyOf(kind),
        rates: { creatorRateBps: r.creatorRateBps, memberRateBps: r.memberRateBps, rateBps: rateOf(kind), attributionDays: r.attributionDays, payoutDay: r.payoutDay },
        kpis: {
          // delta = số người đăng ký thêm trong tháng này ("so với tháng trước"); null khi không có gì mới.
          registered: { value: registered, delta: newThisMonth > 0 ? newThisMonth : null },
          paying: { value: rows.filter((x) => x.status === 'paid').length },
          // % chỉ có nghĩa khi tháng trước có số liệu.
          commissionThisMonth: { cents: cur, deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null },
          pendingPayout: { cents: pending, payoutOn: nextPayoutDate(now).toISOString() },
        },
      };
    },

    async users(userId: string, kind: ReferralKindName, all: boolean) {
      await ensureCode(userId);
      const rows = await loadRows(userId, kind);
      const data = all ? rows : rows.slice(0, COLLAPSED_ROWS);
      return { data, meta: { total: rows.length, shown: data.length, currency: currencyOf(kind) } };
    },

    /** Chi tiết hoa hồng của 1 người được giới thiệu (modal "Chi tiết hoa hồng"). */
    async commissionsOf(userId: string, referredUserId: string, kind: ReferralKindName) {
      if (!(await repo.findReferral(userId, referredUserId))) throw HttpError.notFound('Không tìm thấy người được giới thiệu');
      const list = await repo.listCommissions(userId, referredUserId, kind as ReferralKind, 100);
      return {
        currency: currencyOf(kind),
        totalCents: list.filter((c) => c.status !== 'void').reduce((s, c) => s + c.amountCents, 0),
        data: list.map((c) => ({ id: c.id, createdAt: c.createdAt.toISOString(), baseCents: c.baseCents, rateBps: c.rateBps, amountCents: c.amountCents, status: c.status, communityId: c.communityId })),
      };
    },

    /** Gửi thông báo trong app nhắc người đang dùng thử nâng cấp. Tối đa 1 lần / 24h cho mỗi cặp (người giới thiệu, người được giới thiệu). */
    async remind(userId: string, referredUserId: string, kind: ReferralKindName, now = new Date()) {
      if (!(await repo.findReferral(userId, referredUserId))) throw HttpError.notFound('Không tìm thấy người được giới thiệu');
      const row = (await loadRows(userId, kind)).find((r) => r.userId === referredUserId);
      if (!row || row.status !== 'trial' || !row.communityId) throw HttpError.coded(409, 'NOT_TRIALING', 'Người này hiện không ở trạng thái dùng thử');
      const sender = await repo.findUser(userId);
      const prefix = `${sender ? nameOf(sender) : 'Một thành viên'} `;
      if (await repo.recentReminder(referredUserId, REMIND_TITLE, prefix, new Date(now.getTime() - REMIND_COOLDOWN_MS))) {
        throw HttpError.coded(429, 'REMINDER_COOLDOWN', 'Bạn vừa nhắc người này, hãy thử lại sau 24 giờ');
      }
      notify({
        userId: referredUserId,
        type: 'system',
        title: REMIND_TITLE,
        body: `${prefix}nhắc bạn nâng cấp gói của "${row.communityName}" trước khi hết thời gian dùng thử.`,
        link: kind === 'member' ? `/communities/${row.communityId}/checkout` : `/communities/${row.communityId}/community/cai-dat`,
        communityId: row.communityId,
      });
      return { sent: true };
    },

    // ----------------------------------------------------------------------------------------- ghi nhận người được giới thiệu
    /**
     * Gắn người dùng mới vào người giới thiệu theo mã (mã = ReferralCode.code, hoặc `handle` nếu người đó chưa có dòng mã).
     * Bỏ qua êm: mã lạ, tự giới thiệu, đã có người giới thiệu. Không bao giờ ném lỗi ra ngoài (đăng ký không được hỏng vì việc này).
     */
    async attribute(newUserId: string, rawCode: string | undefined, now = new Date()): Promise<boolean> {
      const code = rawCode?.trim().toLowerCase();
      if (!code) return false;
      return (
        (await isolate('attribute', async () => {
          const found = await repo.findCode(code);
          const referrerId = found?.userId ?? (await repo.findUserByHandle(code))?.id;
          if (!referrerId || referrerId === newUserId) return false;
          if (await repo.findReferralOf(newUserId)) return false;
          try {
            await repo.createReferral({ referrerId, referredUserId: newUserId, code, expiresAt: new Date(now.getTime() + cfg().referral.attributionDays * DAY_MS) });
            return true;
          } catch (e) {
            if (isUnique(e)) return false; // đã được ghi nhận bởi request song song
            throw e;
          }
        })) ?? false
      );
    },

    // ----------------------------------------------------------------------------------------- hoa hồng
    /**
     * Gọi SAU KHI giao dịch thành viên thành công đã commit (settle / gia hạn / hết dùng thử có thẻ). Idempotent theo `sourceRef = payment:<id>`.
     * Cửa sổ ghi nhận (`expiresAt`) chỉ xét tại LẦN THANH TOÁN ĐẦU của người được giới thiệu; đã có hoa hồng member trước đó thì các kỳ sau
     * (gia hạn hằng tháng) vẫn được tính dù cửa sổ đã hết — đúng mô tả "hoa hồng định kỳ".
     */
    async onPaymentSucceeded(p: { id: string; userId: string; communityId: string; amountCents: number; confirmedAt?: string }): Promise<void> {
      await isolate('onPaymentSucceeded', async () => {
        if (p.amountCents <= 0) return;
        const ref = await repo.findReferralOf(p.userId);
        if (!ref) return;
        const sourceRef = `payment:${p.id}`;
        if (await repo.findCommissionBySource(sourceRef)) return;
        const at = p.confirmedAt ? new Date(p.confirmedAt) : new Date();
        if (at.getTime() > ref.expiresAt.getTime() && !(await repo.hasCommissionFor(p.userId, 'member'))) return;
        const rateBps = cfg().referral.memberRateBps;
        if (rateBps <= 0) return;
        try {
          await repo.createCommission({
            referrerId: ref.referrerId,
            referredUserId: p.userId,
            kind: 'member',
            communityId: p.communityId,
            sourceRef,
            baseCents: p.amountCents,
            rateBps,
            amountCents: Math.round((p.amountCents * rateBps) / 10_000),
            payoutOn: nextPayoutDate(at),
          });
        } catch (e) {
          if (!isUnique(e)) throw e;
        }
      });
    },

    /**
     * Hoa hồng "creator": người được giới thiệu trả phí gói hosting cho cộng đồng của họ. CHƯA có luồng trừ tiền gói hosting (A16 mô phỏng) nên
     * chưa có nơi nào gọi hàm này; khi có job/cổng trừ tiền thật, gọi sau mỗi lần trừ thành công với `chargeRef` duy nhất (vd. id giao dịch hosting).
     * `amount` theo đơn vị nhỏ nhất của owner.currency.
     */
    async onHostingCharge(c: { ownerId: string; communityId: string; chargeRef: string; amount: number; at?: Date }): Promise<void> {
      await isolate('onHostingCharge', async () => {
        if (c.amount <= 0) return;
        const ref = await repo.findReferralOf(c.ownerId);
        if (!ref) return;
        const sourceRef = `hosting:${c.chargeRef}`;
        if (await repo.findCommissionBySource(sourceRef)) return;
        const at = c.at ?? new Date();
        if (at.getTime() > ref.expiresAt.getTime() && !(await repo.hasCommissionFor(c.ownerId, 'creator'))) return;
        const rateBps = cfg().referral.creatorRateBps;
        if (rateBps <= 0) return;
        try {
          await repo.createCommission({
            referrerId: ref.referrerId,
            referredUserId: c.ownerId,
            kind: 'creator',
            communityId: c.communityId,
            sourceRef,
            baseCents: c.amount,
            rateBps,
            amountCents: Math.round((c.amount * rateBps) / 10_000),
            payoutOn: nextPayoutDate(at),
          });
        } catch (e) {
          if (!isUnique(e)) throw e;
        }
      });
    },

    /** Hoàn tiền toàn bộ / chargeback: hủy hoa hồng `pending` sinh từ giao dịch đó (đã chi trả rồi thì giữ nguyên — cần xử lý tay). */
    async voidForPayment(paymentId: string): Promise<void> {
      await isolate('voidForPayment', async () => {
        await repo.voidPendingBySource(`payment:${paymentId}`);
      });
    },

    /** Đối soát: tạo hoa hồng cho giao dịch thành công gần đây còn thiếu (hook sau commit bị mất do process chết). Idempotent. */
    async reconcileCommissions(now = new Date(), opts: { sinceDays?: number; limit?: number } = {}) {
      let created = 0;
      const rows = await repo.listUncommissionedPayments(new Date(now.getTime() - (opts.sinceDays ?? 3) * DAY_MS), opts.limit ?? 100);
      for (const { id } of rows) {
        const p = await repo.findPayment(id);
        if (!p) continue;
        await this.onPaymentSucceeded({ id: p.id, userId: p.userId, communityId: p.communityId, amountCents: p.amountCents, confirmedAt: p.confirmedAt?.toISOString() });
        if (await repo.findCommissionBySource(`payment:${id}`)) created++;
      }
      return { scanned: rows.length, created };
    },
  };
}

export const referralsService = createReferralsService();
