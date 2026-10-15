import type { SeedContext } from './context.js';

/**
 * Chatbot cộng đồng (chatbot.md) — dữ liệu demo / E2E:
 *  - `paid-demo` (có phí, member1 có gói active => VIP): gói Pro dùng thử + bot bật, nhân cách mặc định mentor, VIP đổi được buddy/coach/concise;
 *    1 câu mẫu + 1 tài liệu riêng.
 *  - `photo` (miễn phí, member2 là thành viên thường): gói Pro dùng thử + bot bật (mọi thành viên ở mức thường, không đổi nhân cách).
 *  - các cộng đồng khác (vd `yt`): không bật bot => trong trang cộng đồng vẫn hiện trợ lý Tào.
 * Idempotent: upsert theo khóa; bản admin đã sửa không bị ghi đè (update: {}).
 */
export async function seedCommunityBot({ db }: SeedContext): Promise<void> {
  const now = new Date();
  const setups = [
    { communityId: 'paid-demo', botName: 'Trợ lý Paid Demo', personaKey: 'mentor', memberPersonaKeys: ['buddy', 'coach', 'concise'], welcomeText: 'Chào bạn! Hỏi mình về bài học, nội quy hay sự kiện của cộng đồng nhé.' },
    { communityId: 'photo', botName: 'Trợ lý Nhiếp ảnh', personaKey: 'buddy', memberPersonaKeys: ['mentor', 'concise'], welcomeText: '' },
  ];
  for (const s of setups) {
    const c = await db.community.findUnique({ where: { id: s.communityId }, select: { ownerId: true } });
    if (!c?.ownerId) continue;
    await db.hostingPlan.upsert({
      where: { communityId: s.communityId },
      create: {
        communityId: s.communityId, ownerId: c.ownerId, planKey: 'pro', cycle: 'monthly', priceAmount: 299_000, currency: 'VND', status: 'trialing',
        trialStartedAt: now, trialEndsAt: new Date(now.getTime() + 365 * 86_400_000),
      },
      update: {},
    });
    await db.communityBot.upsert({
      where: { communityId: s.communityId },
      create: { communityId: s.communityId, enabled: true, botName: s.botName, personaKey: s.personaKey, memberPersonaKeys: s.memberPersonaKeys, welcomeText: s.welcomeText, freeDailyMessages: 10, vipDailyMessages: 100 },
      update: {},
    });
  }

  if (await db.communityBot.findUnique({ where: { communityId: 'paid-demo' } })) {
    await db.chatbotQA.upsert({
      where: { id: 'seed-cbot-qa-paid-demo-schedule' },
      create: {
        id: 'seed-cbot-qa-paid-demo-schedule', communityId: 'paid-demo', status: 'active', source: 'admin',
        question: 'Lịch học live của cộng đồng là khi nào?', variants: ['khi nào có buổi live', 'lịch live hằng tuần'],
        answer: 'Buổi live Q&A diễn ra 20:00 tối thứ Năm hằng tuần, link tham gia nằm ở mục Lịch của cộng đồng nhé.',
      },
      update: {},
    });
  }
}
