import { recalcCourseRating } from '../../src/modules/communities/communities.repository.js';
import type { SeedContext } from './context.js';

/**
 * Kịch bản TEST THỦ CÔNG cho module communities (idempotent, id/mã cố định):
 *  - 'private-demo': cộng đồng RIÊNG TƯ miễn phí do owner làm chủ + 2 JoinRequest pending (newbie, member1) + lời mời
 *    DEMO-VALID (còn hiệu lực) / DEMO-EXPIRED (hết hạn) / DEMO-REVOKED (thu hồi) / DEMO-USED (hết lượt).
 *  - 'paid-demo': cộng đồng CÔNG KHAI CÓ PHÍ ($19/tháng) do owner làm chủ + lời mời DEMO-PAID (nhận lời mời vẫn 402).
 *  - photo: đánh giá thật của member1..3 (5/4/3 sao); tài khoản `banned` đã có CommunityBan từ seed-base.
 * Gọi hai lần: 'courses' (tạo Course + owner, TRƯỚC khi sinh thành viên minh họa) và 'activity' (phần còn lại).
 */
export const SCENARIO_COURSES = ['private-demo', 'paid-demo'] as const;

const DAY = 86_400_000;

export async function seedCommunityScenarios(ctx: SeedContext, phase: 'courses' | 'activity'): Promise<void> {
  const { db, userIds } = ctx;

  if (phase === 'courses') {
    const common = {
      category: 'hobby' as const,
      thumbnail: '/images/courses/biz.webp',
      instructorName: 'Olivia Owner',
      instructorRole: 'Chủ cộng đồng',
      language: 'vi' as const,
      status: 'open' as const,
      ownerId: userIds.owner,
    };
    const defs = [
      { id: 'private-demo', title: 'Cộng đồng riêng tư (demo)', description: 'Cộng đồng kín để thử luồng yêu cầu tham gia và lời mời.', visibility: 'private' as const, pricing: 'free' as const, priceCents: 0 },
      { id: 'paid-demo', title: 'Cộng đồng có phí (demo)', description: 'Cộng đồng công khai có phí để thử luồng thanh toán.', visibility: 'public' as const, pricing: 'paid' as const, priceCents: 1900 },
      // Gói tháng $7 + gói năm $48 (tiết kiệm 43%) + nhận diện/nội quy — để thử hộp thoại "Chọn gói thành viên".
      {
        id: 'annual-demo', title: 'Cộng đồng gói năm (demo)', description: 'Cộng đồng có phí có cả gói tháng và gói năm, dùng thử 7 ngày.', visibility: 'public' as const, pricing: 'paid' as const,
        priceCents: 700, priceAnnualCents: 4800, promise: 'Học đều mỗi tuần, tiết kiệm 43% khi trả theo năm', brandColor: '#2563eb', benefits: ['Buổi học trực tiếp mỗi tuần', 'Thư viện video đầy đủ'],
        rules: [{ title: 'Tôn trọng lẫn nhau', body: 'Góp ý văn minh.' }],
      },
    ];
    for (const d of defs) {
      const { id, ...rest } = d;
      await db.community.upsert({ where: { id }, create: { id, ...common, ...rest, tag: 'new' }, update: {} });
      await db.enrollment.upsert({
        where: { userId_communityId: { userId: userIds.owner, communityId: id } },
        create: { userId: userIds.owner, communityId: id, role: 'owner' },
        update: { role: 'owner' },
      });
    }
    return;
  }

  const now = Date.now();
  // Yêu cầu tham gia đang chờ (mới nhất trước: newbie).
  for (const [key, ago, msg] of [
    ['newbie', 1, 'Chào admin, em muốn tham gia để học hỏi ạ.'],
    ['member1', 3, 'Mình là thành viên photo, xin vào nhóm kín này.'],
  ] as const) {
    const userId = userIds[key];
    await db.joinRequest.upsert({
      where: { id: `seed-jr-private-demo-${key}` },
      create: { id: `seed-jr-private-demo-${key}`, communityId: 'private-demo', userId, message: msg, status: 'pending', createdAt: new Date(now - ago * DAY) },
      update: {},
    });
  }

  // Lời mời (mã cố định dễ nhớ).
  const owner = userIds.owner;
  const invites = [
    { code: 'DEMO-VALID', communityId: 'private-demo', maxUses: 5, usedCount: 0, expiresAt: new Date(now + 30 * DAY), revokedAt: null },
    { code: 'DEMO-EXPIRED', communityId: 'private-demo', maxUses: null, usedCount: 0, expiresAt: new Date(now - 2 * DAY), revokedAt: null },
    { code: 'DEMO-REVOKED', communityId: 'private-demo', maxUses: null, usedCount: 0, expiresAt: null, revokedAt: new Date(now - DAY) },
    { code: 'DEMO-USED', communityId: 'private-demo', maxUses: 1, usedCount: 1, expiresAt: null, revokedAt: null },
    { code: 'DEMO-PAID', communityId: 'paid-demo', maxUses: null, usedCount: 0, expiresAt: null, revokedAt: null },
  ];
  for (const i of invites) {
    await db.invite.upsert({ where: { code: i.code }, create: { ...i, createdById: owner }, update: {} });
  }

  // Đánh giá thật ở photo, rồi tính lại điểm Course (nền seed + review thật) — idempotent.
  for (const [key, rating, text] of [
    ['member1', 5, 'Cộng đồng rất chất lượng, mình học được nhiều về nhiếp ảnh.'],
    ['member2', 4, 'Nội dung tốt, mong có thêm buổi livestream.'],
    ['member3', 3, 'Ổn, nhưng đôi lúc hơi ồn ào.'],
  ] as const) {
    const userId = userIds[key];
    await db.review.upsert({
      where: { communityId_userId: { communityId: 'photo', userId } },
      create: { communityId: 'photo', userId, rating, text },
      update: {},
    });
  }
  await db.$transaction((tx) => recalcCourseRating(tx, 'photo'));
}
