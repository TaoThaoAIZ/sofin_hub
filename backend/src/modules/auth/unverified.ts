import { prisma } from '../../db/prisma.js';

const UNVERIFIED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Xóa tài khoản đăng ký dở: chưa xác thực email, quá 7 ngày, không phải thành viên minh họa, chưa từng có phiên đăng nhập.
 * Tài khoản chưa xác thực không đăng nhập được nên không có dữ liệu nghiệp vụ; FK còn lại (nếu có) làm lệnh xóa của user đó thất bại và bị bỏ qua.
 */
export async function purgeUnverifiedUsers(now: Date): Promise<number> {
  const stale = await prisma.user.findMany({
    where: { emailVerified: false, isDemo: false, deletedAt: null, createdAt: { lt: new Date(now.getTime() - UNVERIFIED_TTL_MS) }, sessions: { none: {} } },
    select: { id: true },
    take: 500,
  });
  let removed = 0;
  for (const { id } of stale) {
    try {
      await prisma.user.delete({ where: { id } });
      removed++;
    } catch {
      /* còn dữ liệu tham chiếu: giữ lại */
    }
  }
  return removed;
}
