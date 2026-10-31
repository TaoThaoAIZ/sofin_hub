import { Prisma } from '../../generated/prisma/client.js';
import type { ReferralWithdrawal } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { announceWithdrawal } from '../payments/payments.alerts.js';
import { makeRefCode } from '../payments/payments.bank.js';
import { notify } from '../notifications/notifications.service.js';
import { cfg } from '../settings/settings.service.js';
import { bankByBin } from './referral-banks.js';
import { decryptSecret, encryptSecret } from './referral-payout-crypto.js';

/** Số tiền rút tối thiểu mỗi lần (đồng). Khớp copy giao diện "Số dư tối thiểu để rút: 200.000đ". */
export const MIN_WITHDRAW_CENTS = 200_000;
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const isUnique = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

/** Bỏ dấu + viết hoa: tên chủ tài khoản ngân hàng luôn không dấu. */
export const normalizeHolder = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Số dư rút được = hoa hồng (trừ `void`) − các yêu cầu rút CHƯA bị từ chối. Hoa hồng người tạo cộng đồng tính theo tiền của gói hosting:
 * chỉ cộng vào khi tiền đó là VND (rút luôn bằng VND).
 */
async function balanceOf(db: Db, userId: string, communityId?: string) {
  const kinds = cfg().owner.currency === 'VND' ? (['creator', 'member', 'community'] as const) : (['member', 'community'] as const);
  const [earned, active] = await Promise.all([
    // Hoa hồng cộng đồng đã được CHỦ CỘNG ĐỒNG tự chuyển khoản (payoutId có giá trị) thì người nhận không rút lại qua nền tảng nữa.
    db.referralCommission.aggregate({ where: { referrerId: userId, status: { not: 'void' }, kind: { in: [...kinds] }, payoutId: null, ...(communityId ? { communityId } : {}) }, _sum: { amountCents: true } }),
    db.referralWithdrawal.groupBy({ by: ['status'], where: { userId, status: { in: ['requested', 'paid'] }, ...(communityId ? { communityId } : {}) }, _sum: { amountCents: true } }),
  ]);
  const sum = (s: string) => active.find((x) => x.status === s)?._sum.amountCents ?? 0;
  const earnedCents = earned._sum.amountCents ?? 0;
  const pendingCents = sum('requested');
  const paidCents = sum('paid');
  return { earnedCents, pendingCents, paidCents, withdrawableCents: Math.max(0, earnedCents - pendingCents - paidCents) };
}

const accountView = (a: { bankBin: string; bankName: string; accountHolder: string; accountLast4: string }) => ({
  bankBin: a.bankBin,
  bankName: a.bankName,
  accountHolder: a.accountHolder,
  accountLast4: a.accountLast4,
  accountMasked: `•••• ${a.accountLast4}`,
});

const withdrawalView = (w: ReferralWithdrawal) => ({
  id: w.id,
  amountCents: w.amountCents,
  refCode: w.refCode,
  status: w.status,
  bankName: w.bankName,
  accountHolder: w.accountHolder,
  accountLast4: w.accountLast4,
  note: w.note,
  createdAt: w.createdAt.toISOString(),
  paidAt: w.paidAt?.toISOString() ?? null,
});

/** Dữ liệu để admin chuyển tiền: số tài khoản đầy đủ (giải mã) + QR VietQR điền sẵn số tiền, nội dung = mã tham chiếu. */
function transferOf(w: ReferralWithdrawal) {
  const accountNumber = decryptSecret(w.accountNumberEnc);
  const qs = `amount=${w.amountCents}&addInfo=${encodeURIComponent(w.refCode)}&accountName=${encodeURIComponent(w.accountHolder)}`;
  return {
    bankBin: w.bankBin,
    bankName: w.bankName,
    accountNumber,
    accountHolder: w.accountHolder,
    amount: w.amountCents,
    content: w.refCode,
    qrUrl: `https://img.vietqr.io/image/${w.bankBin}-${accountNumber}-compact2.png?${qs}`,
  };
}

export type SettleOutcome = 'paid' | 'already' | 'unmatched' | 'underpaid' | 'duplicate' | 'rejected';

export const referralWithdrawalsService = {
  MIN_WITHDRAW_CENTS,
  balanceOf: (userId: string, communityId?: string) => balanceOf(prisma, userId, communityId),
  /** Như balanceOf nhưng đọc trong một transaction đang mở (đã giữ khóa rút tiền của user). */
  balanceInTx: (tx: Prisma.TransactionClient, userId: string, communityId?: string) => balanceOf(tx, userId, communityId),

  /** Màn "Rút tiền hoa hồng": số dư + tài khoản nhận + lịch sử gần đây. */
  async overview(userId: string, communityId?: string) {
    const [balance, account, list, direct, fromCommunity, sources] = await Promise.all([
      balanceOf(prisma, userId, communityId),
      prisma.referralPayoutAccount.findUnique({ where: { userId } }),
      prisma.referralWithdrawal.findMany({ where: { userId, ...(communityId ? { communityId } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20 }),
      // Chủ cộng đồng chuyển khoản trực tiếp: không phải yêu cầu rút nhưng vẫn là tiền đã nhận, nên hiện chung trong lịch sử.
      prisma.communityCommissionPayout.findMany({ where: { referrerId: userId, ...(communityId ? { communityId } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, include: { community: { select: { title: true } } } }),
      // Trang trong một cộng đồng: phần hoa hồng chưa rút/chưa được chi trả sinh ra từ CỘNG ĐỒNG đó (ví vẫn là một).
      communityId
        ? prisma.referralCommission.aggregate({ where: { referrerId: userId, communityId, status: { not: 'void' }, kind: { in: ['member', 'community'] }, payoutId: null }, _sum: { amountCents: true } })
        : null,
      // Nguồn của số dư: gộp theo cộng đồng + loại hoa hồng (để người dùng thấy tiền đến từ đâu, kể cả khi không thuộc cộng đồng đang xem).
      prisma.referralCommission.groupBy({
        by: ['communityId', 'kind'],
        where: { referrerId: userId, status: { not: 'void' }, payoutId: null, kind: { in: [...(cfg().owner.currency === 'VND' ? (['creator', 'member', 'community'] as const) : (['member', 'community'] as const))] } },
        _sum: { amountCents: true },
      }),
    ]);
    const titles = new Map((await prisma.community.findMany({ where: { id: { in: sources.flatMap((s) => (s.communityId ? [s.communityId] : [])) } }, select: { id: true, title: true } })).map((c) => [c.id, c.title]));
    return {
      currency: 'VND',
      minCents: 0, // không có mức rút tối thiểu
      ...balance, // trong trang cộng đồng: số liệu của riêng cộng đồng đó
      account: account ? accountView(account) : null,
      sources: sources
        .map((s) => ({ communityId: s.communityId, communityTitle: s.communityId ? (titles.get(s.communityId) ?? null) : null, kind: s.kind, cents: s._sum.amountCents ?? 0 }))
        .filter((s) => s.cents > 0)
        .sort((a, b) => b.cents - a.cents),
      ...(communityId ? { communityEarnedCents: fromCommunity?._sum.amountCents ?? 0 } : {}),
      withdrawals: list.map(withdrawalView),
      directPayouts: direct.map((d) => ({ id: d.id, amountCents: d.amountCents, communityId: d.communityId, communityTitle: d.community.title, note: d.note, createdAt: d.createdAt.toISOString() })),
    };
  },

  async saveAccount(userId: string, input: { bankBin: string; accountNumber: string; accountHolder: string }) {
    const bank = bankByBin(input.bankBin);
    if (!bank) throw HttpError.badRequest('Ngân hàng không được hỗ trợ');
    const number = input.accountNumber.replace(/\s+/g, '');
    if (!/^\d{6,19}$/.test(number)) throw HttpError.badRequest('Số tài khoản chỉ gồm 6–19 chữ số');
    const holder = normalizeHolder(input.accountHolder);
    if (!/^[A-Z ]{2,60}$/.test(holder)) throw HttpError.badRequest('Tên chủ tài khoản chỉ gồm chữ cái (không dấu), tối đa 60 ký tự');
    const data = { bankBin: bank.bin, bankName: bank.short, accountHolder: holder, accountNumberEnc: encryptSecret(number), accountLast4: number.slice(-4) };
    const acc = await prisma.referralPayoutAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return accountView(acc);
  },

  /**
   * Bấm "Rút tiền ngay": tạo yêu cầu (requested) có mã tham chiếu, trừ khỏi số dư rút được ngay. Khóa advisory theo user để hai request
   * song song không cùng rút một khoản.
   */
  async request(userId: string, amountCents: number, communityId?: string) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw HttpError.badRequest('Số tiền không hợp lệ');
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refwd:${userId}`}))`;
      const account = await tx.referralPayoutAccount.findUnique({ where: { userId } });
      if (!account) throw HttpError.coded(409, 'NO_ACCOUNT', 'Hãy thêm tài khoản ngân hàng nhận tiền trước khi rút');
      const bal = await balanceOf(tx, userId, communityId);
      if (amountCents > bal.withdrawableCents) throw HttpError.coded(409, 'INSUFFICIENT_BALANCE', `Số dư rút được chỉ còn ${vnd(bal.withdrawableCents)}`);
      for (let i = 0; i < 5; i++) {
        try {
          return await tx.referralWithdrawal.create({
            data: {
              userId,
              amountCents,
              ...(communityId ? { communityId } : {}),
              refCode: makeRefCode(),
              bankBin: account.bankBin,
              bankName: account.bankName,
              accountHolder: account.accountHolder,
              accountNumberEnc: account.accountNumberEnc,
              accountLast4: account.accountLast4,
            },
          });
        } catch (e) {
          if (!isUnique(e)) throw e;
        }
      }
      throw HttpError.conflict('Không tạo được mã tham chiếu, vui lòng thử lại');
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    void announceWithdrawal({
      id: created.id,
      amountCents,
      refCode: created.refCode,
      who: user ? `${`${user.firstName} ${user.lastName}`.trim()} (${user.email})` : userId,
      bankName: created.bankName,
    });
    return withdrawalView(created);
  },

  /** Một yêu cầu của chính người dùng (FE hỏi lại để thấy requested -> paid). */
  async get(userId: string, id: string) {
    const w = await prisma.referralWithdrawal.findFirst({ where: { id, userId } });
    if (!w) throw HttpError.notFound('Không tìm thấy yêu cầu rút tiền');
    return withdrawalView(w);
  },

  // -------------------------------------------------------------------------------------------- admin
  async adminList(status: 'requested' | 'paid' | 'rejected' | undefined, page: number, limit: number) {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      prisma.referralWithdrawal.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.referralWithdrawal.count({ where }),
    ]);
    return {
      data: rows.map((w) => ({
        ...withdrawalView(w),
        user: { id: w.user.id, name: `${w.user.firstName} ${w.user.lastName}`.trim(), email: w.user.email },
        // Số tài khoản đầy đủ + QR chỉ trả cho yêu cầu còn phải chuyển.
        transfer: w.status === 'requested' ? transferOf(w) : null,
      })),
      meta: { page, limit, total },
    };
  },

  /** Admin đã chuyển tay (không chờ SePay): chuyển requested -> paid. Idempotent. */
  async markPaid(adminId: string, id: string, note?: string) {
    const r = await prisma.referralWithdrawal.updateMany({ where: { id, status: 'requested' }, data: { status: 'paid', paidAt: new Date(), resolvedById: adminId, note: note ?? null } });
    return this.afterResolve(id, r.count, 'paid');
  },

  async reject(adminId: string, id: string, reason: string) {
    const r = await prisma.referralWithdrawal.updateMany({ where: { id, status: 'requested' }, data: { status: 'rejected', resolvedById: adminId, note: reason } });
    return this.afterResolve(id, r.count, 'rejected');
  },

  async afterResolve(id: string, changed: number, to: 'paid' | 'rejected') {
    const w = await prisma.referralWithdrawal.findUnique({ where: { id } });
    if (!w) throw HttpError.notFound('Không tìm thấy yêu cầu rút tiền');
    if (!changed && w.status !== to) throw HttpError.conflict('Yêu cầu này đã được xử lý');
    if (changed) notifyUser(w, to);
    return withdrawalView(w);
  },

  /**
   * SePay báo có TIỀN RA: khớp mã tham chiếu trong nội dung + số tiền thì tự chuyển paid (giống nạp: chuyển đúng mã là xong).
   * Idempotent: chạy lại cùng giao dịch không đổi gì (bankTxExternalId unique + chỉ chuyển từ requested).
   */
  async settleByBank(ref: string, amount: number, externalId: string): Promise<SettleOutcome> {
    if (!ref) return 'unmatched';
    const w = await prisma.referralWithdrawal.findUnique({ where: { refCode: ref } });
    if (!w) return 'unmatched';
    if (w.status === 'paid') return w.bankTxExternalId === externalId ? 'already' : 'duplicate';
    if (w.status === 'rejected') return 'rejected';
    if (amount < w.amountCents) return 'underpaid';
    try {
      const r = await prisma.referralWithdrawal.updateMany({ where: { id: w.id, status: 'requested' }, data: { status: 'paid', paidAt: new Date(), bankTxExternalId: externalId } });
      if (r.count) notifyUser(w, 'paid');
      return r.count ? 'paid' : 'already';
    } catch (e) {
      if (isUnique(e)) return 'already';
      throw e;
    }
  },
};

function notifyUser(w: ReferralWithdrawal, to: 'paid' | 'rejected') {
  notify({
    userId: w.userId,
    type: 'system',
    title: to === 'paid' ? 'Đã chuyển hoa hồng' : 'Yêu cầu rút tiền bị từ chối',
    body:
      to === 'paid'
        ? `Chúng tôi đã chuyển ${vnd(w.amountCents)} về ${w.bankName} •••• ${w.accountLast4} (mã ${w.refCode}).`
        : `Yêu cầu rút ${vnd(w.amountCents)} (mã ${w.refCode}) bị từ chối${w.note ? `: ${w.note}` : ''}. Số tiền đã được hoàn lại vào số dư.`,
    link: '/me/communities',
  });
}

