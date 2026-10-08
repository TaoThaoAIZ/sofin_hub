import { prisma } from '../../db/prisma.js';
import type { User as DbUser } from '../../generated/prisma/client.js';
import type { User } from './auth.types.js';

/** Lớp truy cập dữ liệu người dùng (Postgres qua Prisma). Bảng User; phiên/token một lần nằm ở tokens.ts / one-time-tokens.ts. */
export interface UserRepository {
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  /** Tìm theo handle (đã chuẩn hóa chữ thường); bỏ qua tài khoản đã xóa. */
  findByHandle(handle: string): Promise<User | undefined>;
  /**
   * Hoàn tất đổi email: email = pendingEmail, xóa pendingEmail, emailVerified = true. Ném lỗi Prisma P2002 nếu email đã bị người khác dùng;
   * trả undefined nếu user không còn pendingEmail.
   */
  applyPendingEmail(id: string): Promise<User | undefined>;
  create(data: Pick<User, 'email' | 'firstName' | 'lastName' | 'passwordHash'>): Promise<User>;
  /** Cập nhật một phần; giá trị `undefined` = xóa trường tùy chọn đó. Trả về user mới hoặc undefined nếu không tồn tại. */
  update(id: string, patch: UserPatch): Promise<User | undefined>;
  delete(id: string): Promise<boolean>;
  /**
   * Xóa tài khoản theo hướng ẩn danh hóa: giữ hàng User (email `deleted-<id>@deleted.invalid`, tên "Thành viên đã xóa", xóa hồ sơ,
   * mật khẩu vô hiệu, bump tokenVersion, đặt deletedAt) để bài viết/bình luận/điểm/thanh toán còn tham chiếu được; xóa dữ liệu riêng tư
   * (ghi danh, thông báo, chặn, hội thoại...). Trả false nếu user không tồn tại hoặc đã ẩn danh.
   */
  anonymize(id: string): Promise<boolean>;
  /** Tăng tokenVersion: mọi access token đã cấp cho user này chết ngay. */
  bumpTokenVersion(id: string): Promise<void>;
}

export type UserPatch = Partial<Omit<User, 'id' | 'email' | 'createdAt'>>;

const NULLABLE_FIELDS = new Set(['bio', 'location', 'website', 'avatarUrl', 'coverUrl', 'handle', 'instagram', 'youtube', 'totpSecret', 'pendingEmail']);

export function toUser(u: DbUser): User {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt.toISOString(),
    bio: u.bio ?? undefined,
    location: u.location ?? undefined,
    website: u.website ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined,
    coverUrl: u.coverUrl ?? undefined,
    handle: u.handle ?? undefined,
    instagram: u.instagram ?? undefined,
    youtube: u.youtube ?? undefined,
    showOnMap: u.showOnMap,
    language: u.language,
    timezone: u.timezone,
    theme: u.theme,
    totpSecret: u.totpSecret ?? undefined,
    twoFactorEnabled: u.twoFactorEnabled,
    passwordChangedAt: u.passwordChangedAt?.toISOString(),
    pendingEmail: u.pendingEmail ?? undefined,
    emailVerified: u.emailVerified,
    tokenVersion: u.tokenVersion,
    isDemo: u.isDemo,
    deletedAt: u.deletedAt?.toISOString(),
  };
}

export const userRepository: UserRepository = {
  async findByEmail(email) {
    const u = await prisma.user.findUnique({ where: { email } });
    return u ? toUser(u) : undefined;
  },

  async findById(id) {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? toUser(u) : undefined;
  },

  async findByHandle(handle) {
    const u = await prisma.user.findUnique({ where: { handle } });
    return u && !u.deletedAt ? toUser(u) : undefined;
  },

  async applyPendingEmail(id) {
    return prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id }, select: { pendingEmail: true } });
      if (!u?.pendingEmail) return undefined;
      return toUser(await tx.user.update({ where: { id }, data: { email: u.pendingEmail, pendingEmail: null, emailVerified: true } }));
    });
  },

  async create({ email, firstName, lastName, passwordHash }) {
    return toUser(await prisma.user.create({ data: { email, firstName, lastName, passwordHash } }));
  },

  async update(id, patch) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        // undefined trong patch = xóa trường tùy chọn (Prisma bỏ qua undefined nên phải đổi sang null).
        if (NULLABLE_FIELDS.has(key)) data[key] = null;
      } else data[key] = value;
    }
    try {
      return toUser(await prisma.user.update({ where: { id }, data }));
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') return undefined;
      throw e;
    }
  },

  async delete(id) {
    // CASCADE xóa phiên, token, ghi danh... của user (xem docs/DATABASE.md).
    return (await prisma.user.deleteMany({ where: { id } })).count > 0;
  },

  async anonymize(id) {
    return prisma.$transaction(async (tx) => {
      const done = await tx.user.updateMany({
        where: { id, deletedAt: null },
        data: {
          email: `deleted-${id}@deleted.invalid`,
          firstName: 'Thành viên',
          lastName: 'đã xóa',
          bio: null,
          website: null,
          location: null,
          avatarUrl: null,
          coverUrl: null,
          handle: null,
          instagram: null,
          youtube: null,
          totpSecret: null,
          twoFactorEnabled: false,
          pendingEmail: null,
          // Không phải hash bcrypt hợp lệ nên bcrypt.compare luôn false.
          passwordHash: '!deleted',
          emailVerified: false,
          tokenVersion: { increment: 1 },
          deletedAt: new Date(),
        },
      });
      if (done.count === 0) return false;
      // Dữ liệu riêng tư/không còn ý nghĩa thì xóa; bài viết, bình luận, like, phiếu bình chọn, điểm, thanh toán được GIỮ.
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.oneTimeToken.deleteMany({ where: { userId: id } });
      await tx.enrollment.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.notificationPreference.deleteMany({ where: { userId: id } });
      await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: id }, { targetId: id }] } });
      await tx.conversation.deleteMany({ where: { OR: [{ userAId: id }, { userBId: id }] } });
      await tx.eventRsvp.deleteMany({ where: { userId: id } });
      await tx.joinRequest.deleteMany({ where: { userId: id, status: 'pending' } });
      return true;
    });
  },

  async bumpTokenVersion(id) {
    await prisma.user.updateMany({ where: { id }, data: { tokenVersion: { increment: 1 } } });
  },
};

/** @deprecated Tên cũ (từng là data/users.json). Nay là Prisma; dùng `userRepository`. Giữ alias để các module khác không vỡ. */
export const fileUserRepository: UserRepository = userRepository;
