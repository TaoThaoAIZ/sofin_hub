import { prisma } from '../../db/prisma.js';
import type { Enrollment } from '../../generated/prisma/client.js';

/**
 * Lớp truy cập dữ liệu tham gia khóa học/cộng đồng (Postgres qua Prisma: bảng Enrollment + CommunityBan).
 * Quy ước ban: tồn tại dòng CommunityBan(courseId,userId) = đang bị cấm; Enrollment vẫn giữ nhưng người bị ban
 * không được coi là thành viên (isEnrolled/listMembers/listByUser loại họ ra).
 */
export const MEMBER_ROLES = ['member', 'mod', 'admin', 'owner'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface Member {
  userId: string;
  courseId: string;
  role: MemberRole;
  enrolledAt: string;
  lastActiveAt: string;
}

/** Thông tin ghi kèm khi cấm (tùy chọn, service cũ không cần). */
export interface BanInfo {
  reason?: string;
  bannedById?: string;
}

export interface EnrollmentRepository {
  isEnrolled(userId: string, courseId: string): Promise<boolean>;
  /** enrolled=true: tạo ghi danh nếu chưa có (giữ nguyên vai trò cũ nếu đã có). enrolled=false: xóa ghi danh. */
  setEnrolled(userId: string, courseId: string, enrolled: boolean, role?: MemberRole): Promise<void>;
  /** Trả về cả người đang bị cấm (giống bản in-memory cũ); dùng isEnrolled để biết còn là thành viên hay không. */
  getMember(userId: string, courseId: string): Promise<Member | undefined>;
  setRole(userId: string, courseId: string, role: MemberRole): Promise<void>;
  listMembers(courseId: string): Promise<Member[]>;
  listByUser(userId: string): Promise<Member[]>;
  touchActivity(userId: string, courseId: string): Promise<void>;
  /** Cấm thành viên: vẫn ghi nhận nhưng không còn được coi là đã tham gia. */
  setBanned(userId: string, courseId: string, banned: boolean, info?: BanInfo): Promise<void>;
  isBanned(userId: string, courseId: string): Promise<boolean>;
}

const toMember = (e: Enrollment): Member => ({
  userId: e.userId,
  courseId: e.courseId,
  role: e.role,
  enrolledAt: e.enrolledAt.toISOString(),
  lastActiveAt: e.lastActiveAt.toISOString(),
});

export const enrollmentRepository: EnrollmentRepository = {
  async isEnrolled(userId, courseId) {
    const [row] = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM "Enrollment" e
        WHERE e."userId" = ${userId} AND e."courseId" = ${courseId}
          AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      ) AS ok`;
    return row?.ok === true;
  },

  async setEnrolled(userId, courseId, enrolled, role = 'member') {
    if (enrolled) {
      // upsert với update rỗng: đã là thành viên thì giữ nguyên vai trò/ngày tham gia (giống bản cũ).
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, role },
        update: {},
      });
    } else {
      await prisma.enrollment.deleteMany({ where: { userId, courseId } });
    }
  },

  async getMember(userId, courseId) {
    const e = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    return e ? toMember(e) : undefined;
  },

  async setRole(userId, courseId, role) {
    await prisma.enrollment.updateMany({ where: { userId, courseId }, data: { role } });
  },

  async listMembers(courseId) {
    const bans = await prisma.communityBan.findMany({ where: { courseId }, select: { userId: true } });
    const rows = await prisma.enrollment.findMany({
      where: { courseId, ...(bans.length ? { userId: { notIn: bans.map((b) => b.userId) } } : {}) },
      orderBy: [{ enrolledAt: 'asc' }, { userId: 'asc' }],
    });
    return rows.map(toMember);
  },

  async listByUser(userId) {
    const bans = await prisma.communityBan.findMany({ where: { userId }, select: { courseId: true } });
    const rows = await prisma.enrollment.findMany({
      where: { userId, ...(bans.length ? { courseId: { notIn: bans.map((b) => b.courseId) } } : {}) },
      orderBy: [{ enrolledAt: 'asc' }, { courseId: 'asc' }],
    });
    return rows.map(toMember);
  },

  async touchActivity(userId, courseId) {
    await prisma.enrollment.updateMany({ where: { userId, courseId }, data: { lastActiveAt: new Date() } });
  },

  async setBanned(userId, courseId, banned, info = {}) {
    if (banned) {
      await prisma.communityBan.upsert({
        where: { courseId_userId: { courseId, userId } },
        create: { courseId, userId, reason: info.reason ?? '', bannedById: info.bannedById ?? null },
        update: {},
      });
    } else {
      await prisma.communityBan.deleteMany({ where: { courseId, userId } });
    }
  },

  async isBanned(userId, courseId) {
    return (await prisma.communityBan.count({ where: { courseId, userId } })) > 0;
  },
};

/** @deprecated Tên cũ (từng là Map trong bộ nhớ). Nay là Prisma; dùng `enrollmentRepository`. */
export const inMemoryEnrollmentRepository: EnrollmentRepository = enrollmentRepository;
