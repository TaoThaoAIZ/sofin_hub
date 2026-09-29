import type { SeedContext } from './context.js';

/**
 * Thông báo + tin nhắn + bản tin mẫu cho TEST THỦ CÔNG (gắn với tài khoản test trong prisma/seed-accounts.ts).
 * Không sinh dữ liệu cho thành viên minh họa: thông báo/tin nhắn là dữ liệu cá nhân.
 *
 * Idempotent: id cố định (`seed-notif-*`, `seed-conv-*`, `seed-msg-*`) + kiểm tra tồn tại; chạy lại không nhân đôi và không
 * ghi đè thay đổi của người test (đã đọc/xóa...). Xem báo cáo/DATABASE.md mục "Seed thông báo & tin nhắn" để biết kịch bản.
 */
const MIN = 60_000;
const HOUR = 60 * MIN;
const ago = (ms: number) => new Date(Date.now() - ms);

export const SEED_CONVERSATION_ID = 'seed-conv-member1-member2';

export async function seedMessagesNotifications(ctx: SeedContext): Promise<void> {
  const { db, userIds } = ctx;
  const m1 = userIds.member1;
  const m2 = userIds.member2;
  const m3 = userIds.member3;

  // ---- 1) Thông báo của member1: 7 cái, 4 chưa đọc / 3 đã đọc, nhiều loại + link vào các trang FE ----
  const notifications = [
    { id: 'seed-notif-member1-1', type: 'post_liked', title: 'Linh Trần đã thích bài viết của bạn', body: 'Bài "Chia sẻ bộ ảnh chân dung ánh sáng tự nhiên"', link: '/courses/photo/community', courseId: 'photo', createdAt: ago(10 * MIN), read: false },
    { id: 'seed-notif-member1-2', type: 'post_commented', title: 'Thành viên mới bình luận bài viết của bạn', body: 'Ảnh đẹp quá, bạn dùng ống kính nào vậy?', link: '/courses/photo/community', courseId: 'photo', createdAt: ago(45 * MIN), read: false },
    { id: 'seed-notif-member1-3', type: 'event_reminder', title: 'Sự kiện sắp diễn ra', body: 'Buổi photowalk cuối tuần bắt đầu sau 1 giờ nữa', link: '/courses/photo/community/lich', courseId: 'photo', createdAt: ago(2 * HOUR), read: false },
    { id: 'seed-notif-member1-4', type: 'message_received', title: 'Mai Member2 đã gửi tin nhắn cho bạn', body: 'Cuối tuần này bạn có tham gia buổi photowalk không?', link: `/messages/${SEED_CONVERSATION_ID}`, courseId: null, createdAt: ago(3 * HOUR), read: false },
    { id: 'seed-notif-member1-5', type: 'event_created', title: 'Sự kiện mới trong cộng đồng', body: 'Workshop hậu kỳ Lightroom đã được tạo', link: '/courses/photo/community/lich', courseId: 'photo', createdAt: ago(26 * HOUR), read: true },
    { id: 'seed-notif-member1-6', type: 'payment_succeeded', title: 'Thanh toán thành công', body: 'Bạn đã tham gia cộng đồng YouTube thành công', link: '/courses/yt', courseId: 'yt', createdAt: ago(3 * 24 * HOUR), read: true },
    { id: 'seed-notif-member1-7', type: 'system', title: 'Chào mừng đến SofinHub', body: 'Hãy hoàn thiện hồ sơ và khám phá các khóa học.', link: '/', courseId: null, createdAt: ago(5 * 24 * HOUR), read: true },
  ] as const;
  await db.notification.createMany({
    skipDuplicates: true,
    data: notifications.map((n) => ({
      id: n.id,
      userId: m1,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      courseId: n.courseId,
      createdAt: n.createdAt,
      readAt: n.read ? new Date(n.createdAt.getTime() + 5 * MIN) : null,
    })),
  });

  // member1 giữ tùy chọn thông báo MẶC ĐỊNH (không tạo dòng NotificationPreference).
  // member3 có tùy chọn KHÔNG mặc định để test màn Cài đặt thông báo: tắt post_liked, bản tin tuần.
  await db.notificationPreference.upsert({
    where: { userId: m3 },
    create: { userId: m3, types: { post_liked: false, member_joined: false }, emailDigest: 'weekly' },
    update: {},
  });

  // ---- 2) Hội thoại member1 <-> member2 (cùng cộng đồng photo), 8 tin, 1 tin thu hồi, 3 tin member2 chưa đọc ----
  // Thứ tự cặp theo đúng so sánh của Postgres (CHECK "userAId" < "userBId").
  const ltRows = await db.$queryRaw<{ lt: boolean }[]>`SELECT (${m1}::text < ${m2}::text) AS lt`;
  const [userAId, userBId] = ltRows[0]!.lt ? [m1, m2] : [m2, m1];
  const existing = await db.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  let convId = existing?.id;
  if (!convId) {
    const last = ago(3 * HOUR);
    convId = (
      await db.conversation.create({ data: { id: SEED_CONVERSATION_ID, userAId, userBId, createdAt: ago(2 * 24 * HOUR), lastMessageAt: last } })
    ).id;
    const script: { id: string; from: string; content: string; ageMs: number; recalled?: boolean }[] = [
      { id: 'seed-msg-1', from: m2, content: 'Chào bạn, mình vừa xem bài chia sẻ ảnh chân dung của bạn, đẹp quá!', ageMs: 2 * 24 * HOUR },
      { id: 'seed-msg-2', from: m1, content: 'Cảm ơn bạn! Mình chụp bằng ống 85mm f/1.8.', ageMs: 2 * 24 * HOUR - 10 * MIN },
      { id: 'seed-msg-3', from: m2, content: 'Bạn có dùng đèn flash không?', ageMs: 2 * 24 * HOUR - 20 * MIN },
      { id: 'seed-msg-4', from: m1, content: 'Không, mình dùng ánh sáng cửa sổ buổi sáng.', ageMs: 2 * 24 * HOUR - 30 * MIN },
      { id: 'seed-msg-5', from: m1, content: 'gửi nhầm', ageMs: 5 * HOUR, recalled: true },
      { id: 'seed-msg-6', from: m1, content: 'Cuối tuần này bạn có tham gia buổi photowalk không?', ageMs: 3 * HOUR + 2 * MIN },
      { id: 'seed-msg-7', from: m1, content: 'Nếu có, mình rủ thêm vài bạn nữa nhé.', ageMs: 3 * HOUR + MIN },
      { id: 'seed-msg-8', from: m1, content: 'Mình sẽ gửi danh sách địa điểm sau.', ageMs: 3 * HOUR },
    ];
    const seqById: Record<string, number> = {};
    for (const m of script) {
      // Tạo tuần tự để seq (autoincrement) tăng đúng thứ tự kịch bản.
      const row = await db.message.create({
        data: {
          id: m.id,
          conversationId: convId,
          senderId: m.from,
          content: m.recalled ? '' : m.content,
          createdAt: ago(m.ageMs),
          deletedAt: m.recalled ? ago(m.ageMs - MIN) : null,
        },
      });
      seqById[m.id] = row.seq;
    }
    // member1 (người gửi) đã đọc hết; member2 mới đọc tới tin số 4 => chưa đọc: tin 6,7,8 (tin thu hồi không tính).
    const readM1 = seqById['seed-msg-8']!;
    const readM2 = seqById['seed-msg-4']!;
    await db.conversation.update({
      where: { id: convId },
      data: userAId === m1 ? { readSeqA: readM1, readSeqB: readM2 } : { readSeqA: readM2, readSeqB: readM1 },
    });
  }

  // ---- 3) member3 đã chặn member2 (cùng cộng đồng photo) — dùng để test: member2 nhắn member3 => 403, member3 bỏ chặn => nhắn lại được ----
  await db.userBlock.createMany({ data: [{ blockerId: m3, targetId: m2 }], skipDuplicates: true });

  // ---- 4) Người đăng ký bản tin ----
  const subscribers = [
    { email: 'subscriber1@sofinhub.test', subscribedAt: ago(20 * 24 * HOUR), unsubscribedAt: null },
    { email: 'subscriber2@sofinhub.test', subscribedAt: ago(9 * 24 * HOUR), unsubscribedAt: null },
    { email: 'member1@sofinhub.test', subscribedAt: ago(4 * 24 * HOUR), unsubscribedAt: null },
    { email: 'unsubscribed@sofinhub.test', subscribedAt: ago(30 * 24 * HOUR), unsubscribedAt: ago(7 * 24 * HOUR) },
  ];
  await db.newsletterSubscriber.createMany({ data: subscribers, skipDuplicates: true });
}
