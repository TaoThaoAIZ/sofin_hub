import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { useTestDb, type TestDb } from './helpers.js';

/** Seed thông báo/tin nhắn/bản tin cho test thủ công: đúng kịch bản, idempotent. Không phụ thuộc seed của module khác. */
describe('seed messages-notifications', () => {
  let db: TestDb;
  before(async () => {
    db = await useTestDb();
  });
  after(() => db.drop());

  it('tạo kịch bản đúng và chạy lại không nhân đôi', async () => {
    const { seedAccounts, seedCourses, seedMemberships } = await import('../prisma/seed-base.js');
    const { seedMessagesNotifications } = await import('../prisma/seed/messages-notifications.js');
    const userIds = await seedAccounts(db.prisma);
    await seedCourses(db.prisma, { photo: userIds.owner, yt: userIds.owner, fin: userIds.owner });
    await seedMemberships(db.prisma, userIds);
    const ctx = { db: db.prisma, userIds };
    await seedMessagesNotifications(ctx);
    await seedMessagesNotifications(ctx);

    const p = db.prisma;
    const notifs = await p.notification.findMany({ where: { userId: userIds.member1 } });
    assert.equal(notifs.length, 7);
    assert.equal(notifs.filter((n) => !n.readAt).length, 4);
    assert.ok(new Set(notifs.map((n) => n.type)).size >= 6);
    assert.equal(await p.notificationPreference.count({ where: { userId: userIds.member1 } }), 0);

    const conv = await p.conversation.findFirstOrThrow({ where: { OR: [{ userAId: userIds.member1 }, { userBId: userIds.member1 }] } });
    assert.deepEqual([conv.userAId, conv.userBId].sort(), [userIds.member1, userIds.member2].sort());
    const msgs = await p.message.findMany({ where: { conversationId: conv.id }, orderBy: { seq: 'asc' } });
    assert.equal(msgs.length, 8);
    assert.equal(msgs.filter((m) => m.deletedAt).length, 1);
    const readM2 = conv.userAId === userIds.member2 ? conv.readSeqA : conv.readSeqB;
    const unreadM2 = msgs.filter((m) => m.senderId !== userIds.member2 && !m.deletedAt && m.seq > readM2).length;
    assert.equal(unreadM2, 3);

    assert.equal(await p.userBlock.count({ where: { blockerId: userIds.member3, targetId: userIds.member2 } }), 1);
    assert.equal(await p.newsletterSubscriber.count(), 4);
    assert.equal(await p.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }), 1);
  });
});
