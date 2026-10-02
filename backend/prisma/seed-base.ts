/**
 * Lõi seed (test cũng import `runSeed` từ đây). CLI: `npm run db:seed` -> prisma/seed.ts. Idempotent — chạy lại không lỗi, không nhân đôi.
 *
 * Phần nền (file này): khóa học, tài khoản test, ghi danh/vai trò. Phần NỘI DUNG do từng module điền ở `prisma/seed/<module>.ts`
 * (mỗi file export 1 hàm nhận PrismaClient, hiện là TODO) — chỉ sửa file của module mình, không sửa file này.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/prisma.js';
import { seedAdmin } from './seed/admin.js';
import { seedAdminBatch2 } from './seed/admin-batch2.js';
import { seedAdminBatch3 } from './seed/admin-batch3.js';
import { seedClassroom } from './seed/classroom.js';
import { ensureAllDefaultCourses } from './seed/courses.js';
import { seedCommunityWizard } from './seed/community-wizard.js';
import { seedDemoMembers } from './seed/demo-members.js';
import { seedEvents } from './seed/events.js';
import { seedMessagesNotifications } from './seed/messages-notifications.js';
import { seedPayments } from './seed/payments.js';
import { seedPoints } from './seed/points.js';
import { seedPosts } from './seed/posts.js';
import { courseSeedRows } from './seed-courses.js';
import { SEED_ACCOUNT_LIST, SEED_COURSE_OWNERS, TEST_PASSWORD, type SeedAccountKey } from './seed-accounts.js';
import type { SeedContext } from './seed/context.js';

type Db = typeof prisma;

/** Bản ghi Course thật cho mọi khóa trong courses.seed.ts. `ownerIds` map slug -> userId của owner test. */
export async function seedCommunityRows(db: Db, ownerIds: Partial<Record<string, string>> = {}): Promise<void> {
  for (const { id, ...data } of courseSeedRows(ownerIds)) {
    // Chạy lại không ghi đè số liệu sinh ra khi vận hành (điểm đánh giá thật, khóa/xóa mềm).
    const { rating: _rating, ratingCount: _ratingCount, ...refresh } = data;
    await db.community.upsert({ where: { id }, create: { id, ...data }, update: refresh });
  }
}

/** Tài khoản test cố định (mật khẩu TEST_PASSWORD). Trả về map key -> userId. */
export async function seedAccounts(db: Db): Promise<Record<SeedAccountKey, string>> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const ids = {} as Record<SeedAccountKey, string>;
  for (const a of SEED_ACCOUNT_LIST) {
    const data = { firstName: a.firstName, lastName: a.lastName, passwordHash, emailVerified: true, isDemo: false };
    const user = await db.user.upsert({ where: { email: a.email }, create: { email: a.email, ...data }, update: data });
    ids[a.key as SeedAccountKey] = user.id;
  }
  return ids;
}

/** Ghi danh + vai trò + ban theo `memberships` của từng tài khoản test. */
export async function seedMemberships(db: Db, userIds: Record<SeedAccountKey, string>): Promise<void> {
  for (const a of SEED_ACCOUNT_LIST) {
    const userId = userIds[a.key as SeedAccountKey];
    for (const m of a.memberships) {
      await db.enrollment.upsert({
        where: { userId_communityId: { userId, communityId: m.communityId } },
        create: { userId, communityId: m.communityId, role: m.role },
        update: { role: m.role },
      });
      if (m.banned) {
        const data = { reason: 'Tài khoản test bị cấm (seed)', bannedById: userIds.owner };
        await db.communityBan.upsert({
          where: { communityId_userId: { communityId: m.communityId, userId } },
          create: { communityId: m.communityId, userId, ...data },
          update: data,
        });
      }
    }
  }
}

export async function runSeed(db: Db = prisma): Promise<SeedContext> {
  // Owner phải tồn tại trước để gán Course.ownerId.
  const userIds = await seedAccounts(db);
  const ownerIds = Object.fromEntries(Object.entries(SEED_COURSE_OWNERS).map(([slug, key]) => [slug, userIds[key]]));
  await seedCommunityRows(db, ownerIds);
  await seedMemberships(db, userIds);

  const ctx: SeedContext = { db, userIds };
  // Thứ tự quan trọng: thành viên minh họa trước (bài viết/điểm/sự kiện có thể trỏ tới họ).
  await seedDemoMembers(ctx);
  await seedPosts(ctx);
  await seedEvents(ctx);
  await seedClassroom(ctx);
  await seedPoints(ctx);
  await seedPayments(ctx);
  await seedMessagesNotifications(ctx);
  // Cuối cùng: dữ liệu Admin đợt 1 (người dùng bị hạn chế, cộng đồng chờ duyệt, case kiểm duyệt, audit).
  await seedAdmin(ctx);
  // Admin đợt 2: nội dung, thanh toán (giao dịch/gói/hoàn tiền/chargeback mô phỏng/payout), Discovery.
  await seedAdminBatch2(ctx);
  // Admin đợt 3: nhân viên + ticket hỗ trợ + flags/tích hợp/mẫu email/broadcast + dữ liệu cho Analytics.
  await seedAdminBatch3(ctx);
  // Chốt: mọi cộng đồng (kể cả cộng đồng do seed đợt sau tạo) có >= 1 khóa học.
  await ensureAllDefaultCourses(db);
  // Sau cùng: bản nháp wizard (không có khóa học/thành viên/bài viết) + danh mục Discovery mới.
  await seedCommunityWizard(ctx);
  return ctx;
}
