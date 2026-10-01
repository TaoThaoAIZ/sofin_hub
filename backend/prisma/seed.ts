/** CLI seed: `npm run db:seed`. Logic ở seed-base.ts; phần nội dung từng module ở prisma/seed/<module>.ts. */
import { prisma } from '../src/db/prisma.js';
import { runSeed } from './seed-base.js';
import { TEST_PASSWORD } from './seed-accounts.js';

try {
  await runSeed(prisma);
  const [users, courses, enrollments] = await Promise.all([prisma.user.count(), prisma.community.count(), prisma.enrollment.count()]);
  console.log(`Seed xong: ${users} user, ${courses} cộng đồng, ${enrollments} ghi danh. Mật khẩu test: ${TEST_PASSWORD}`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
