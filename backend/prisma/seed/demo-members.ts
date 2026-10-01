import type { SeedContext } from './context.js';
import { DEMO_NAMES, demoEmail, demoUserId } from './demo-ids.js';
import { seedCommunityScenarios } from './communities-scenarios.js';

/**
 * Thành viên minh họa (User.isDemo=true) thay cho các id "seed:<communityId>:<i>" của community.seed.ts cũ.
 * Với MỖI Course trong DB tạo DEMO_NAMES.length người + Enrollment (i=0 admin, còn lại member).
 * Bulk createMany + skipDuplicates nên chạy lại không nhân đôi (và không ghi đè dữ liệu đã có).
 */

/** Chuỗi KHÔNG phải hash bcrypt hợp lệ => bcrypt.compare luôn sai (và login còn chặn isDemo). */
export const DEMO_PASSWORD_HASH = '!demo-account-cannot-login';

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoProfile {
  index: number;
  userId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'member';
  enrolledAt: Date;
  lastActiveAt: Date;
  points: { '7d': number; '30d': number; all: number };
}

/** Hồ sơ xác định (cùng communityId luôn ra cùng số) — dùng chung với seed điểm. Thời gian tương đối với `now`. */
export function demoProfiles(communityId: string, now = Date.now()): DemoProfile[] {
  const rnd = mulberry32(hash(communityId));
  return DEMO_NAMES.map((name, i): DemoProfile => {
    const online = i < 7;
    const minutesAgo = online ? (20 + i * 25) / 60 : 45 + Math.floor(rnd() * 60 * 24 * 6); // 7 người đầu: 20s..~3 phút (trong cửa sổ online 5 phút)
    const w7 = Math.floor(rnd() ** 3 * 14);
    const w30 = w7 + Math.floor(rnd() ** 2 * 22);
    const all = w30 + Math.round(300 * 0.9 ** i * (0.85 + rnd() * 0.3));
    const enrolledDaysAgo = 7 + Math.floor(rnd() * 200);
    const sp = name.indexOf(' ');
    return {
      index: i,
      userId: demoUserId(communityId, i),
      email: demoEmail(communityId, i),
      name,
      firstName: sp < 0 ? name : name.slice(0, sp),
      lastName: sp < 0 ? '' : name.slice(sp + 1),
      role: i === 0 ? 'admin' : 'member',
      enrolledAt: new Date(now - enrolledDaysAgo * 86_400_000),
      lastActiveAt: new Date(now - minutesAgo * 60_000),
      points: { '7d': w7, '30d': w30, all },
    };
  });
}

const CHUNK = 1000;

export async function seedDemoMembers(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  // Kịch bản cộng đồng riêng tư / có phí phải có trước để cũng được gắn thành viên minh họa.
  await seedCommunityScenarios(ctx, 'courses');

  const courseIds = (await db.community.findMany({ select: { id: true } })).map((c) => c.id);
  const now = Date.now();
  const users: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    emailVerified: boolean;
    isDemo: boolean;
  }[] = [];
  const enrollments: { userId: string; communityId: string; role: 'admin' | 'member'; enrolledAt: Date; lastActiveAt: Date }[] = [];
  for (const communityId of courseIds) {
    for (const p of demoProfiles(communityId, now)) {
      users.push({
        id: p.userId,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        passwordHash: DEMO_PASSWORD_HASH,
        emailVerified: true,
        isDemo: true,
      });
      enrollments.push({ userId: p.userId, communityId, role: p.role, enrolledAt: p.enrolledAt, lastActiveAt: p.lastActiveAt });
    }
  }
  for (let i = 0; i < users.length; i += CHUNK) await db.user.createMany({ data: users.slice(i, i + CHUNK), skipDuplicates: true });
  for (let i = 0; i < enrollments.length; i += CHUNK) {
    await db.enrollment.createMany({ data: enrollments.slice(i, i + CHUNK), skipDuplicates: true });
  }

  // Phần còn lại của kịch bản (yêu cầu tham gia, lời mời, đánh giá) chạy sau khi thành viên minh họa đã có.
  await seedCommunityScenarios(ctx, 'activity');
}
