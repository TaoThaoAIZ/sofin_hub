import type { SeedContext } from './context.js';

/**
 * Dữ liệu mẫu cho wizard "Tạo cộng đồng" (idempotent, id cố định, create-only: chạy lại không ghi đè tiến độ người dùng đã sửa):
 *  - 3 bản nháp của owner test: mới tạo bước 1 / đã qua bước 1-3 (có gói hosting dùng thử + thẻ mô phỏng) / sẵn sàng publish (đã kết nối payout mô phỏng).
 *  - 3 danh mục mới của mockup (Âm nhạc, Thể thao, Tâm linh) trong DiscoveryCategory.
 * Chạy SAU ensureAllDefaultCourses để các bước seed khác (bài viết, lớp học, thành viên minh họa) không đụng tới nháp.
 * Cộng đồng có giá năm: 'annual-demo' (communities-scenarios.ts).
 */
const base = { thumbnail: '/images/courses/biz.webp', instructorName: 'Olivia Owner', instructorRole: 'Chủ cộng đồng', tag: 'new' as const, language: 'vi' as const, moderationStatus: 'draft' as const };

export async function seedCommunityWizard(ctx: SeedContext): Promise<void> {
  const { db, userIds } = ctx;
  const ownerId = userIds.owner;

  const drafts = [
    { id: 'draft-gom-cuoi-tuan', title: 'Lớp Gốm Cuối Tuần', description: 'Học làm gốm từ con số 0 cùng nghệ nhân.', category: 'hobby' as const, draftSteps: ['basics'] },
    {
      id: 'draft-chay-bo-5k', title: 'Chạy Bộ 5K Cho Người Mới', description: 'Giáo án 8 tuần giúp người mới chạy trọn 5K không chấn thương.', category: 'sports' as const,
      draftSteps: ['basics', 'plan', 'identity'], brandColor: '#16a34a', promise: 'Chạy trọn 5K đầu tiên sau 8 tuần', benefits: ['Giáo án theo tuần', 'Nhóm chạy chung mỗi sáng Chủ nhật'],
    },
    {
      id: 'draft-viet-content', title: 'Viết Content Ra Đơn', description: 'Công thức viết bài bán hàng cho người làm tự do.', category: 'content' as const,
      draftSteps: ['basics', 'plan', 'identity', 'members'], priceCents: 175_000, priceAnnualCents: 1_200_000, pricing: 'paid' as const, visibility: 'private' as const,
      promise: 'Viết bài đầu tiên chốt được đơn trong 14 ngày', benefits: ['Thư viện mẫu bài viết', 'Chấm bài 1-1 hàng tuần'],
      joinQuestions: ['Bạn đang bán sản phẩm gì?', 'Bạn biết đến lớp từ đâu?'],
      rules: [{ title: 'Tôn trọng lẫn nhau', body: 'Góp ý văn minh.' }, { title: 'Không spam', body: '' }], requireRulesAgreement: true,
    },
  ];
  for (const d of drafts) {
    const { id, ...rest } = d;
    await db.community.upsert({ where: { id }, create: { id, ...base, ownerId, ...rest }, update: {} });
  }

  // Gói hosting (mô phỏng) cho bản nháp 2 + thẻ mô phỏng (chỉ brand/last4/hạn + token mock) + payout mô phỏng cho bản nháp 3.
  const card = await db.paymentCard.upsert({
    where: { userId_gatewayToken: { userId: ownerId, gatewayToken: 'tok_mock_seed_owner' } },
    create: { userId: ownerId, gatewayToken: 'tok_mock_seed_owner', brand: 'visa', last4: '4242', expMonth: 12, expYear: new Date().getUTCFullYear() + 3 },
    update: {},
  });
  const now = new Date();
  await db.hostingPlan.upsert({
    where: { communityId: 'draft-chay-bo-5k' },
    create: {
      communityId: 'draft-chay-bo-5k', ownerId, planKey: 'pro', cycle: 'monthly', priceAmount: 299_000, currency: 'VND', status: 'trialing',
      trialStartedAt: now, trialEndsAt: new Date(now.getTime() + 14 * 86_400_000), paymentCardId: card.id,
    },
    update: {},
  });
  await db.payoutAccount.upsert({
    where: { communityId: 'draft-viet-content' },
    create: { communityId: 'draft-viet-content', ownerId, status: 'connected', bankName: 'Vietcombank', accountHolder: 'OLIVIA OWNER', accountLast4: '8812', connectedAt: now },
    update: {},
  });

  // Danh mục mới (Discovery > Categories); đã có thì giữ nguyên (admin có thể đã đổi tên/tắt).
  const max = await db.discoveryCategory.aggregate({ _max: { position: true } });
  let pos = max._max.position ?? 0;
  for (const [key, name] of [['music', 'Âm nhạc'], ['sports', 'Thể thao'], ['spirituality', 'Tâm linh']] as const) {
    if (await db.discoveryCategory.findUnique({ where: { key } })) continue;
    await db.discoveryCategory.create({ data: { key, name, position: ++pos } });
  }
}
