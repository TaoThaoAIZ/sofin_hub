import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';

/**
 * Trạng thái tài khoản do Platform Admin đặt (User.status). restricted = chỉ đọc (chặn theo từng quyền);
 * suspended/banned = không đăng nhập được và mọi phiên bị thu hồi lúc đặt. Hạn (statusUntil) tự hết hiệu lực khi được đọc.
 */
export const RESTRICTIONS = ['post', 'comment', 'dm', 'create_community', 'purchase'] as const;
export type Restriction = (typeof RESTRICTIONS)[number];

const RESTRICTION_TEXT: Record<Restriction, string> = {
  post: 'đăng bài',
  comment: 'bình luận',
  dm: 'nhắn tin',
  create_community: 'tạo cộng đồng',
  purchase: 'mua hàng',
};

interface StatusRow {
  status: 'active' | 'restricted' | 'suspended' | 'banned';
  statusReason: string | null;
  statusUntil: Date | null;
  statusRestrictions: string[];
}

/** Đọc trạng thái; nếu đã quá hạn thì gỡ luôn (về active) để mọi nơi thấy nhất quán. */
async function loadStatus(userId: string): Promise<StatusRow | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, statusReason: true, statusUntil: true, statusRestrictions: true },
  });
  if (!u) return null;
  if (u.status !== 'active' && u.statusUntil && u.statusUntil.getTime() <= Date.now()) {
    await prisma.user.updateMany({
      where: { id: userId, status: u.status },
      data: { status: 'active', statusReason: null, statusUntil: null, statusRestrictions: [], statusChangedAt: new Date() },
    });
    return { status: 'active', statusReason: null, statusUntil: null, statusRestrictions: [] };
  }
  return u;
}

/** Chặn đăng nhập/refresh khi bị đình chỉ hoặc cấm (403 kèm lý do để FE hiển thị). */
export async function assertCanSignIn(userId: string): Promise<void> {
  const s = await loadStatus(userId);
  if (!s || s.status === 'active' || s.status === 'restricted') return;
  const details = { reason: s.statusReason, until: s.statusUntil?.toISOString() ?? null };
  if (s.status === 'banned') {
    throw HttpError.coded(403, 'ACCOUNT_BANNED', 'Tài khoản của bạn đã bị cấm vĩnh viễn khỏi SofinHub.', details);
  }
  throw HttpError.coded(
    403,
    'ACCOUNT_SUSPENDED',
    s.statusUntil ? `Tài khoản của bạn đang bị đình chỉ đến ${s.statusUntil.toISOString()}.` : 'Tài khoản của bạn đang bị đình chỉ.',
    details,
  );
}

/** 403 ACCOUNT_RESTRICTED nếu tài khoản đang bị hạn chế đúng quyền này (suspended/banned cũng bị chặn, phòng token cũ). */
export async function assertUserCan(userId: string, what: Restriction): Promise<void> {
  const s = await loadStatus(userId);
  if (!s || s.status === 'active') return;
  if (s.status === 'banned' || s.status === 'suspended') return assertCanSignIn(userId);
  if (s.statusRestrictions.includes(what)) {
    throw HttpError.coded(403, 'ACCOUNT_RESTRICTED', `Tài khoản của bạn đang bị hạn chế, không thể ${RESTRICTION_TEXT[what]}.`, {
      reason: s.statusReason,
      until: s.statusUntil?.toISOString() ?? null,
    });
  }
}

export async function recordLogin(userId: string): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}
