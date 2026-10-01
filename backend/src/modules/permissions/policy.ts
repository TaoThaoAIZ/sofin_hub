import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { userRepository } from '../auth/auth.repository.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';

/**
 * Chính sách phân quyền TẬP TRUNG (PLAN.md Phase 2, BRD mục 2). Mọi route cần kiểm tra vai trò phải đi qua đây,
 * không tự so sánh role rải rác. Thứ bậc: member < mod < admin < owner < platform_admin.
 *  - member: đọc/đăng bài/bình luận/like/RSVP
 *  - mod:    + ghim/ẩn bài, xóa bình luận của người khác, tạo/sửa/xóa sự kiện, quản lý nội dung lớp học
 *  - admin:  + đổi vai trò mod, kick/ban thành viên, sửa thông tin cộng đồng
 *  - owner:  + cấp/thu hồi admin, đổi giá, xem doanh thu/payout, xóa cộng đồng
 *  - platform_admin: đội SofinHub (env PLATFORM_ADMIN_EMAILS) — ghi đè Owner ở mọi cộng đồng để xử lý vi phạm
 */
export const ROLES = ['member', 'mod', 'admin', 'owner', 'platform_admin'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { member: 0, mod: 1, admin: 2, owner: 3, platform_admin: 4 };

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  if (env.PLATFORM_ADMIN_EMAILS.length === 0) return false;
  const user = await userRepository.findById(userId);
  return !!user && env.PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/** Vai trò hiệu lực của user trong 1 cộng đồng; null nếu chưa tham gia (và không phải Platform Admin). */
export async function getRole(userId: string, communityId: string): Promise<Role | null> {
  if (await isPlatformAdmin(userId)) return 'platform_admin';
  return (await enrollmentService.getActiveRole(userId, communityId)) ?? null; // 1 truy vấn (null nếu chưa tham gia / bị cấm)
}

export const atLeast = (role: Role | null, min: Role) => role !== null && RANK[role] >= RANK[min];

/**
 * 403 nếu user không đạt vai trò tối thiểu trong cộng đồng. Trả về vai trò để route dùng tiếp.
 * Cộng đồng đang BỊ KHÓA (Course.locked, gồm cả đình chỉ kiểm duyệt): chỉ Platform Admin / nhân viên admin vượt được — owner/admin/mod
 * không sửa, xóa, chuyển quyền, rút tiền, xem doanh thu hay quản lý lớp học (lệnh khóa không còn chỉ chặn thành viên thường).
 */
export async function requireRole(userId: string, communityId: string, min: Role): Promise<Role> {
  const role = await getRole(userId, communityId);
  if (!atLeast(role, min)) throw HttpError.forbidden('Bạn không có quyền thực hiện thao tác này trong cộng đồng');
  if (role !== 'platform_admin') {
    const community = await prisma.community.findUnique({ where: { id: communityId }, select: { locked: true } });
    if (community?.locked && !(await isStaff(userId))) throw HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
  }
  return role!;
}

/** 403 nếu user không phải Platform Admin. */
export async function requirePlatformAdmin(userId: string): Promise<void> {
  if (!(await isPlatformAdmin(userId))) throw HttpError.forbidden('Chỉ Platform Admin mới có quyền này');
}

/** Được sửa/xóa nội dung của người khác? (tác giả luôn được; ngoài ra cần đạt `min` — mặc định mod). */
export async function canManageContent(userId: string, communityId: string, authorId: string, min: Role = 'mod'): Promise<boolean> {
  if (userId === authorId) return true;
  return atLeast(await getRole(userId, communityId), min);
}

/** Bậc số của vai trò (member=0 ... platform_admin=4) — dùng so sánh thứ bậc khi kick/ban/đổi vai trò. */
export const roleRank = (role: Role | null): number => (role === null ? -1 : RANK[role]);

/** Chính xác là Owner của cộng đồng (KHÔNG tính Platform Admin) — dùng cho thao tác gắn với tài khoản nhận tiền như rút tiền. */
export async function isCommunityOwner(userId: string, communityId: string): Promise<boolean> {
  if (!(await enrollmentService.isEnrolled(userId, communityId))) return false;
  return (await enrollmentService.getMember(userId, communityId))?.role === 'owner';
}

/** Nhân viên admin đang hoạt động? (email trong env HOẶC có AdminAccount `active`). Quyền chi tiết do middleware admin kiểm tra theo route. */
export async function isStaff(userId: string): Promise<boolean> {
  if (await isPlatformAdmin(userId)) return true;
  const acc = await prisma.adminAccount.findUnique({ where: { userId }, select: { status: true } });
  return acc?.status === 'active';
}

/** 403 nếu không phải nhân viên admin (dùng cho service mà route đã kiểm tra quyền chi tiết ở tầng admin). */
export async function requireStaff(userId: string): Promise<void> {
  if (!(await isStaff(userId))) throw HttpError.forbidden('Chỉ nhân viên admin mới có quyền này');
}
