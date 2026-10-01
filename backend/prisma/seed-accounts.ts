/**
 * Tài khoản TEST cố định do `npm run db:seed` tạo — tài liệu, bộ test thủ công và test tự động tham chiếu file này.
 * Mật khẩu chung: TEST_PASSWORD. Email dùng đuôi @sofinhub.test (không gửi mail thật).
 */
import type { MemberRole } from '../src/generated/prisma/enums.js';

export const TEST_PASSWORD = 'Passw0rd!x';
export const TEST_EMAIL_DOMAIN = 'sofinhub.test';

export interface SeedMembership {
  communityId: string;
  role: MemberRole;
  /** true = có bản ghi CommunityBan (bị cấm) dù vẫn còn dòng Enrollment. */
  banned?: boolean;
}

export interface SeedAccount {
  /** Khóa ngắn để code/test tham chiếu (SEED_ACCOUNTS.owner). */
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Mô tả vai trò để tài liệu/manual test đọc. */
  description: string;
  /** Là Platform Admin (email phải nằm trong PLATFORM_ADMIN_EMAILS). */
  platformAdmin?: boolean;
  memberships: SeedMembership[];
}

const acc = (key: string): string => `${key}@${TEST_EMAIL_DOMAIN}`;

export const SEED_ACCOUNTS = {
  admin: {
    key: 'admin',
    email: acc('admin'),
    firstName: 'Platform',
    lastName: 'Admin',
    description: 'Platform Admin (đội SofinHub) — ghi đè quyền mọi cộng đồng. Cần PLATFORM_ADMIN_EMAILS chứa email này.',
    platformAdmin: true,
    memberships: [],
  },
  owner: {
    key: 'owner',
    email: acc('owner'),
    firstName: 'Olivia',
    lastName: 'Owner',
    description: 'Chủ (owner) của cộng đồng photo, yt và fin.',
    memberships: [
      { communityId: 'photo', role: 'owner' },
      { communityId: 'yt', role: 'owner' },
      { communityId: 'fin', role: 'owner' },
    ],
  },
  cadmin: {
    key: 'cadmin',
    email: acc('cadmin'),
    firstName: 'Adam',
    lastName: 'CommunityAdmin',
    description: 'Admin cộng đồng photo (dưới owner, trên mod).',
    memberships: [{ communityId: 'photo', role: 'admin' }],
  },
  mod: {
    key: 'mod',
    email: acc('mod'),
    firstName: 'Mia',
    lastName: 'Moderator',
    description: 'Mod của cộng đồng photo.',
    memberships: [{ communityId: 'photo', role: 'mod' }],
  },
  member1: {
    key: 'member1',
    email: acc('member1'),
    firstName: 'Minh',
    lastName: 'Member1',
    description: 'Thành viên photo, yt và fin.',
    memberships: [
      { communityId: 'photo', role: 'member' },
      { communityId: 'yt', role: 'member' },
      { communityId: 'fin', role: 'member' },
    ],
  },
  member2: {
    key: 'member2',
    email: acc('member2'),
    firstName: 'Mai',
    lastName: 'Member2',
    description: 'Thành viên photo.',
    memberships: [{ communityId: 'photo', role: 'member' }],
  },
  member3: {
    key: 'member3',
    email: acc('member3'),
    firstName: 'Manh',
    lastName: 'Member3',
    description: 'Thành viên photo.',
    memberships: [{ communityId: 'photo', role: 'member' }],
  },
  newbie: {
    key: 'newbie',
    email: acc('newbie'),
    firstName: 'Nam',
    lastName: 'Newbie',
    description: 'Người dùng chưa tham gia cộng đồng nào (dùng thử luồng tham gia/thanh toán).',
    memberships: [],
  },
  banned: {
    key: 'banned',
    email: acc('banned'),
    firstName: 'Bao',
    lastName: 'Banned',
    description: 'Bị cấm khỏi cộng đồng photo (có CommunityBan) — không được coi là thành viên.',
    memberships: [{ communityId: 'photo', role: 'member', banned: true }],
  },
} as const satisfies Record<string, SeedAccount>;

export type SeedAccountKey = keyof typeof SEED_ACCOUNTS;
export const SEED_ACCOUNT_LIST: readonly SeedAccount[] = Object.values(SEED_ACCOUNTS);

/** Chủ sở hữu của từng cộng đồng seed (Course.ownerId); cộng đồng khác vẫn "chưa có chủ" như hiện nay. */
export const SEED_COURSE_OWNERS: Record<string, SeedAccountKey> = {
  photo: 'owner',
  yt: 'owner',
  fin: 'owner',
};
