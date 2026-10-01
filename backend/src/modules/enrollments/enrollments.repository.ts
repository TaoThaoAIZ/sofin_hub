import { prisma } from '../../db/prisma.js';
import { Prisma, type Enrollment } from '../../generated/prisma/client.js';

/**
 * Lớp truy cập dữ liệu tham gia khóa học/cộng đồng (Postgres qua Prisma: bảng Enrollment + CommunityBan).
 * Quy ước ban: tồn tại dòng CommunityBan(communityId,userId) = đang bị cấm; Enrollment vẫn giữ nhưng người bị ban
 * không được coi là thành viên (isEnrolled/listMembers/listByUser loại họ ra).
 */
export const MEMBER_ROLES = ['member', 'mod', 'admin', 'owner'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface Member {
  userId: string;
  communityId: string;
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
  isEnrolled(userId: string, communityId: string): Promise<boolean>;
  /** enrolled=true: tạo ghi danh nếu chưa có (giữ nguyên vai trò cũ nếu đã có). enrolled=false: xóa ghi danh. */
  setEnrolled(userId: string, communityId: string, enrolled: boolean, role?: MemberRole): Promise<void>;
  /** Trả về cả người đang bị cấm (giống bản in-memory cũ); dùng isEnrolled để biết còn là thành viên hay không. */
  getMember(userId: string, communityId: string): Promise<Member | undefined>;
  setRole(userId: string, communityId: string, role: MemberRole): Promise<void>;
  listMembers(communityId: string): Promise<Member[]>;
  listByUser(userId: string): Promise<Member[]>;
  /**
   * Id thành viên (không bị cấm) theo thứ tự userId, phân trang keyset (`afterUserId`) — dùng để rải thông báo theo lô thay vì nạp cả cộng đồng.
   * `roles` giới hạn vai trò; `excludeDemo` bỏ thành viên minh họa; `excludeUserId` bỏ 1 người (vd. người tạo).
   */
  memberIdsPage(communityId: string, opts: { afterUserId?: string; limit: number; roles?: MemberRole[]; excludeDemo?: boolean; excludeUserId?: string }): Promise<string[]>;
  /** Owner hiện tại (không bị cấm), nếu có — 1 truy vấn. */
  findOwnerId(communityId: string): Promise<string | undefined>;
  touchActivity(userId: string, communityId: string): Promise<void>;
  /** Cập nhật hoạt động CHỈ khi đang là thành viên (không bị cấm) — 1 truy vấn; trả true nếu là thành viên. */
  touchIfMember(userId: string, communityId: string): Promise<boolean>;
  /** Vai trò trong cộng đồng nếu đang là thành viên (không bị cấm), ngược lại undefined — 1 truy vấn. */
  getActiveRole(userId: string, communityId: string): Promise<MemberRole | undefined>;
  /** Cấm thành viên: vẫn ghi nhận nhưng không còn được coi là đã tham gia. */
  setBanned(userId: string, communityId: string, banned: boolean, info?: BanInfo): Promise<void>;
  isBanned(userId: string, communityId: string): Promise<boolean>;
}

const toMember = (e: Enrollment): Member => ({
  userId: e.userId,
  communityId: e.communityId,
  role: e.role,
  enrolledAt: e.enrolledAt.toISOString(),
  lastActiveAt: e.lastActiveAt.toISOString(),
});

export const enrollmentRepository: EnrollmentRepository = {
  async isEnrolled(userId, communityId) {
    const [row] = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM "Enrollment" e
        WHERE e."userId" = ${userId} AND e."courseId" = ${communityId}
          AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      ) AS ok`;
    return row?.ok === true;
  },

  async setEnrolled(userId, communityId, enrolled, role = 'member') {
    if (enrolled) {
      // upsert với update rỗng: đã là thành viên thì giữ nguyên vai trò/ngày tham gia (giống bản cũ).
      await prisma.enrollment.upsert({
        where: { userId_communityId: { userId, communityId } },
        create: { userId, communityId, role },
        update: {},
      });
    } else {
      await prisma.enrollment.deleteMany({ where: { userId, communityId } });
    }
  },

  async getMember(userId, communityId) {
    const e = await prisma.enrollment.findUnique({ where: { userId_communityId: { userId, communityId } } });
    return e ? toMember(e) : undefined;
  },

  async setRole(userId, communityId, role) {
    await prisma.enrollment.updateMany({ where: { userId, communityId }, data: { role } });
  },

  async listMembers(communityId) {
    const bans = await prisma.communityBan.findMany({ where: { communityId }, select: { userId: true } });
    const rows = await prisma.enrollment.findMany({
      where: { communityId, ...(bans.length ? { userId: { notIn: bans.map((b) => b.userId) } } : {}) },
      orderBy: [{ enrolledAt: 'asc' }, { userId: 'asc' }],
    });
    return rows.map(toMember);
  },

  async listByUser(userId) {
    const bans = await prisma.communityBan.findMany({ where: { userId }, select: { communityId: true } });
    const rows = await prisma.enrollment.findMany({
      where: { userId, ...(bans.length ? { communityId: { notIn: bans.map((b) => b.communityId) } } : {}) },
      orderBy: [{ enrolledAt: 'asc' }, { communityId: 'asc' }],
    });
    return rows.map(toMember);
  },

  async memberIdsPage(communityId, { afterUserId, limit, roles, excludeDemo, excludeUserId }) {
    const rows = await prisma.$queryRaw<{ userId: string }[]>`
      SELECT e."userId" FROM "Enrollment" e
      ${excludeDemo ? Prisma.sql`JOIN "User" u ON u."id" = e."userId" AND NOT u."isDemo"` : Prisma.empty}
      WHERE e."courseId" = ${communityId}
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
        ${afterUserId ? Prisma.sql`AND e."userId" > ${afterUserId}` : Prisma.empty}
        ${excludeUserId ? Prisma.sql`AND e."userId" <> ${excludeUserId}` : Prisma.empty}
        ${roles ? Prisma.sql`AND e."role"::text = ANY(${roles}::text[])` : Prisma.empty}
      ORDER BY e."userId"
      LIMIT ${limit}`;
    return rows.map((r) => r.userId);
  },

  async findOwnerId(communityId) {
    const [row] = await prisma.$queryRaw<{ userId: string }[]>`
      SELECT e."userId" FROM "Enrollment" e
      WHERE e."courseId" = ${communityId} AND e."role" = 'owner'
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      ORDER BY e."enrolledAt", e."userId" LIMIT 1`;
    return row?.userId;
  },

  async touchActivity(userId, communityId) {
    await prisma.enrollment.updateMany({ where: { userId, communityId }, data: { lastActiveAt: new Date() } });
  },

  async touchIfMember(userId, communityId) {
    const rows = await prisma.$queryRaw<{ one: number }[]>`
      UPDATE "Enrollment" e SET "lastActiveAt" = now()
      WHERE e."userId" = ${userId} AND e."courseId" = ${communityId}
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      RETURNING 1 AS one`;
    return rows.length > 0;
  },

  async getActiveRole(userId, communityId) {
    const rows = await prisma.$queryRaw<{ role: MemberRole }[]>`
      SELECT e."role"::text AS role FROM "Enrollment" e
      WHERE e."userId" = ${userId} AND e."courseId" = ${communityId}
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")`;
    return rows[0]?.role;
  },

  async setBanned(userId, communityId, banned, info = {}) {
    if (banned) {
      await prisma.communityBan.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, userId, reason: info.reason ?? '', bannedById: info.bannedById ?? null },
        update: {},
      });
    } else {
      await prisma.communityBan.deleteMany({ where: { communityId, userId } });
    }
  },

  async isBanned(userId, communityId) {
    return (await prisma.communityBan.count({ where: { communityId, userId } })) > 0;
  },
};

/** @deprecated Tên cũ (từng là Map trong bộ nhớ). Nay là Prisma; dùng `enrollmentRepository`. */
export const inMemoryEnrollmentRepository: EnrollmentRepository = enrollmentRepository;
