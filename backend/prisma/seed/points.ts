import type { SeedContext } from './context.js';
import { demoProfiles } from './demo-members.js';

/**
 * Sổ điểm (PointEvent) của thành viên minh họa: mỗi người 3 bản ghi ứng với 3 cửa sổ của bảng xếp hạng
 * (≤7 ngày, 8–30 ngày, >30 ngày) nên tổng 7d/30d/all đúng bằng số cũ của community.seed.ts (phân phối giảm dần theo thứ hạng
 * => đủ Cấp 1..6). Id xác định; mỗi lần seed xóa rồi tạo lại để mốc thời gian luôn tươi (không nhân đôi).
 * Thêm điểm cho member1..3 ở cộng đồng `photo` để bảng xếp hạng có tên tài khoản test.
 */
const DAY = 86_400_000;
const CHUNK = 1000;

export async function seedPoints(ctx: SeedContext): Promise<void> {
  const { db, userIds } = ctx;
  const now = Date.now();
  const courseIds = (await db.community.findMany({ where: { moderationStatus: { not: 'draft' } }, select: { id: true } })).map((c) => c.id);

  const data: { id: string; userId: string; communityId: string; points: number; reason: 'post' | 'like_received' | 'lesson_complete'; createdAt: Date }[] = [];
  for (const communityId of courseIds) {
    for (const p of demoProfiles(communityId, now)) {
      const i = p.index;
      const buckets = [
        { key: '7d', points: p.points['7d'], reason: 'post' as const, ago: (1 + (i % 5)) * DAY },
        { key: '30d', points: p.points['30d'] - p.points['7d'], reason: 'like_received' as const, ago: (10 + (i % 15)) * DAY },
        { key: 'old', points: p.points.all - p.points['30d'], reason: 'lesson_complete' as const, ago: (40 + (i % 100)) * DAY },
      ];
      for (const b of buckets) {
        if (b.points <= 0) continue;
        data.push({ id: `demo-pt-${communityId}-${i}-${b.key}`, userId: p.userId, communityId, points: b.points, reason: b.reason, createdAt: new Date(now - b.ago) });
      }
    }
  }

  // Tài khoản test ở photo: member1 dẫn đầu nhóm thật, member2 giữa, member3 ít (đều còn ở Cấp thấp/vừa để test cấp độ).
  const testPoints: [key: 'member1' | 'member2' | 'member3', bucket: { n: number; points: number; reason: 'post' | 'like_received' | 'lesson_complete'; ago: number }[]][] = [
    ['member1', [{ n: 0, points: 35, reason: 'post', ago: 1 }, { n: 1, points: 30, reason: 'like_received', ago: 12 }, { n: 2, points: 45, reason: 'lesson_complete', ago: 50 }]],
    ['member2', [{ n: 0, points: 12, reason: 'post', ago: 3 }, { n: 1, points: 18, reason: 'like_received', ago: 20 }]],
    ['member3', [{ n: 0, points: 6, reason: 'post', ago: 2 }]],
  ];
  for (const [key, list] of testPoints) {
    for (const e of list) {
      data.push({ id: `seed-pt-photo-${key}-${e.n}`, userId: userIds[key], communityId: 'photo', points: e.points, reason: e.reason, createdAt: new Date(now - e.ago * DAY) });
    }
  }

  // Làm mới mốc thời gian mỗi lần seed: nếu giữ bản ghi cũ (skipDuplicates) thì sau vài ngày cửa sổ 7 ngày của bảng xếp hạng sẽ trống.
  await db.pointEvent.deleteMany({ where: { OR: [{ id: { startsWith: 'demo-pt-' } }, { id: { startsWith: 'seed-pt-' } }] } });
  for (let i = 0; i < data.length; i += CHUNK) await db.pointEvent.createMany({ data: data.slice(i, i + CHUNK), skipDuplicates: true });
}
