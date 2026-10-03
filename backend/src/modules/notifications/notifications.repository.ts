import { prisma } from '../../db/prisma.js';
import type { Notification as Row } from '../../generated/prisma/client.js';
import { COMMUNITY_PREF_KEYS, NOTIFICATION_TYPES, type CommunityPref, type EmailDigest, type Notification, type NotificationPreferences, type NotificationType } from './notifications.types.js';

/** Tối đa mỗi user giữ bao nhiêu thông báo (xóa cũ nhất). Thực thi bằng truy vấn xóa, không quét bộ nhớ. */
export const MAX_PER_USER = 200;
/** Thông báo ĐÃ ĐỌC quá số ngày này sẽ bị dọn. */
export const READ_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface NotificationsRepository {
  /** Ghi thông báo rồi dọn: đã đọc quá hạn + vượt MAX_PER_USER (giữ cái mới nhất). */
  add(n: Notification): Promise<void>;
  /** Mới nhất trước; không trả thông báo đã đọc quá hạn. */
  list(userId: string, opts: { unreadOnly: boolean; skip: number; take: number }): Promise<{ items: Notification[]; total: number }>;
  unreadCount(userId: string): Promise<number>;
  /** Đặt readAt nếu chưa có; trả thông báo (undefined nếu không phải của user / không tồn tại). */
  markRead(userId: string, id: string, at: string): Promise<Notification | undefined>;
  remove(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string, at: string): Promise<number>;
  /** Mọi thông báo (chẩn đoán/test), mới nhất trước. */
  all(): Promise<Notification[]>;
  getPrefs(userId: string): Promise<NotificationPreferences | undefined>;
  setPrefs(userId: string, prefs: NotificationPreferences): Promise<void>;
}

const toDomain = (r: Row): Notification => ({
  id: r.id,
  userId: r.userId,
  type: r.type,
  title: r.title,
  body: r.body,
  ...(r.link ? { link: r.link } : {}),
  ...(r.communityId ? { communityId: r.communityId, courseId: r.communityId } : {}),
  readAt: r.readAt ? r.readAt.toISOString() : null,
  createdAt: r.createdAt.toISOString(),
});

const notExpired = () => ({ OR: [{ readAt: null }, { readAt: { gte: new Date(Date.now() - READ_TTL_MS) } }] });

export const prismaNotificationsRepository: NotificationsRepository = {
  async add(n) {
    await prisma.notification.create({
      data: {
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link ?? null,
        communityId: n.communityId ?? null,
        readAt: n.readAt ? new Date(n.readAt) : null,
        createdAt: new Date(n.createdAt),
      },
    });
    // Dọn bằng truy vấn xóa: (1) đã đọc quá hạn, (2) vượt trần — giữ MAX_PER_USER cái mới nhất.
    await prisma.notification.deleteMany({ where: { userId: n.userId, readAt: { lt: new Date(Date.now() - READ_TTL_MS) } } });
    await prisma.$executeRaw`
      DELETE FROM "Notification"
      WHERE "userId" = ${n.userId}
        AND id IN (
          SELECT id FROM "Notification" WHERE "userId" = ${n.userId}
          ORDER BY "createdAt" DESC, id DESC OFFSET ${MAX_PER_USER}
        )`;
  },

  async list(userId, { unreadOnly, skip, take }) {
    const where = { userId, ...notExpired(), ...(unreadOnly ? { readAt: null } : {}) };
    const [total, rows] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
    ]);
    return { items: rows.map(toDomain), total };
  },

  unreadCount: (userId) => prisma.notification.count({ where: { userId, readAt: null } }),

  async markRead(userId, id, at) {
    await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date(at) } });
    const row = await prisma.notification.findFirst({ where: { id, userId } });
    return row ? toDomain(row) : undefined;
  },

  async remove(userId, id) {
    return (await prisma.notification.deleteMany({ where: { id, userId } })).count > 0;
  },

  async markAllRead(userId, at) {
    return (await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date(at) } })).count;
  },

  async all() {
    return (await prisma.notification.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(toDomain);
  },

  async getPrefs(userId) {
    const r = await prisma.notificationPreference.findUnique({ where: { userId } });
    if (!r) return undefined;
    const stored = (r.types ?? {}) as Record<string, unknown>;
    const types = {} as Record<NotificationType, boolean>;
    for (const t of NOTIFICATION_TYPES) if (typeof stored[t] === 'boolean') types[t] = stored[t] as boolean;
    const communityPrefs: Record<string, CommunityPref> = {};
    for (const [id, v] of Object.entries((r.communityPrefs ?? {}) as Record<string, Record<string, unknown>>)) {
      communityPrefs[id] = Object.fromEntries(COMMUNITY_PREF_KEYS.map((k) => [k, v?.[k] !== false])) as CommunityPref;
    }
    return {
      types,
      emailDigest: r.emailDigest as EmailDigest,
      quiet: { enabled: r.quietEnabled, from: r.quietFrom, to: r.quietTo },
      dmAllowed: r.dmAllowed,
      emailUnreadDm: r.emailUnreadDm,
      notifyFollowedPosts: r.notifyFollowedPosts,
      communityPrefs,
    };
  },

  async setPrefs(userId, prefs) {
    const data = {
      types: prefs.types,
      emailDigest: prefs.emailDigest,
      quietEnabled: prefs.quiet.enabled,
      quietFrom: prefs.quiet.from,
      quietTo: prefs.quiet.to,
      dmAllowed: prefs.dmAllowed,
      emailUnreadDm: prefs.emailUnreadDm,
      notifyFollowedPosts: prefs.notifyFollowedPosts,
      communityPrefs: prefs.communityPrefs,
    };
    await prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  },
};

/** Email + múi giờ để quyết định gửi mail / giờ im lặng (không nằm trong interface repo để test giả không phải cài thêm). */
export async function getDeliveryInfo(userId: string): Promise<{ email: string; timezone: string } | undefined> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, timezone: true, isDemo: true, deletedAt: true } });
  return u && !u.isDemo && !u.deletedAt ? { email: u.email, timezone: u.timezone } : undefined;
}

export interface CommunityRow {
  id: string;
  title: string;
  logoUrl: string | null;
  thumbnail: string;
  role: 'member' | 'mod' | 'admin' | 'owner';
}

/** Cộng đồng user đang là thành viên (không bị cấm, chưa xóa, không phải bản nháp) cho bảng "Theo từng cộng đồng". */
export async function listCommunityRows(userId: string): Promise<CommunityRow[]> {
  const bans = await prisma.communityBan.findMany({ where: { userId }, select: { communityId: true } });
  const rows = await prisma.enrollment.findMany({
    where: {
      userId,
      ...(bans.length ? { communityId: { notIn: bans.map((b) => b.communityId) } } : {}),
      community: { deletedAt: null, moderationStatus: { not: 'draft' } },
    },
    select: { role: true, enrolledAt: true, community: { select: { id: true, title: true, logoUrl: true, thumbnail: true } } },
    orderBy: [{ enrolledAt: 'asc' }, { communityId: 'asc' }],
  });
  return rows.map((r) => ({ ...r.community, role: r.role }));
}
