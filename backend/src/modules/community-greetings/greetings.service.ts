import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';

/**
 * Lời chào thành viên mới + thông báo popup của chủ cộng đồng (docs/features/community-greetings.md).
 * - Lời chào: hiện 1 lần duy nhất / người / cộng đồng, chỉ cho người tham gia TỪ lúc chủ bật; rời rồi tham gia lại cũng không hiện nữa
 *   (CommunityWelcomeSeen không gắn với Enrollment).
 * - Thông báo: chỉ bản active mới nhất, chỉ hiện ở trang của cộng đồng đó, mỗi thành viên 1 lần.
 * Đánh dấu "đã xem" ngay khi popup HIỆN (không chờ bấm đóng) => tải lại trang không hiện lại.
 */

const LINK = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/[a-z0-9]/i.test(v) || /^https:\/\/[^\s]+$/i.test(v), 'Đường dẫn phải bắt đầu bằng / (trang trong site) hoặc https://');

export const welcomeBody = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(2000, 'Lời chào tối đa 2000 ký tự'),
});
export const announcementBody = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(120, 'Tiêu đề tối đa 120 ký tự'),
  body: z.string().trim().min(1, 'Vui lòng nhập nội dung').max(2000, 'Nội dung tối đa 2000 ký tự'),
  link: LINK.nullish().or(z.literal('').transform(() => null)),
});
export const patchAnnouncementBody = z.object({ active: z.boolean() });

type Sender = { id: string | null; name: string; avatarUrl: string | null; role: 'owner' | 'admin' | 'mod' | 'member' | null };

const userSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const nameOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

/** Biến trong lời chào: {ten} = tên thành viên, {cong_dong} = tên cộng đồng. */
export const renderWelcome = (message: string, vars: { ten: string; cong_dong: string }) =>
  message.replace(/\{(ten|cong_dong)\}/g, (_, k: 'ten' | 'cong_dong') => vars[k]);

async function senderFor(communityId: string, userId: string | null, fallbackName: string): Promise<Sender> {
  if (!userId) return { id: null, name: fallbackName, avatarUrl: null, role: null };
  const [u, e] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: userSelect }),
    prisma.enrollment.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { role: true } }),
  ]);
  return u ? { id: u.id, name: nameOf(u), avatarUrl: u.avatarUrl, role: e?.role ?? null } : { id: null, name: fallbackName, avatarUrl: null, role: null };
}

const announcementView = (a: { id: string; title: string; body: string; link: string | null; createdAt: Date }) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  link: a.link,
  createdAt: a.createdAt.toISOString(),
});

export const greetingsService = {
  /** Popup cần hiện cho người đang xem trang cộng đồng (null = không có). Người ngoài / cộng đồng bị khóa => không có gì. */
  async pending(userId: string, communityId: string) {
    const none = { welcome: null, announcement: null };
    const { locked } = await catalogService.requireLockState(communityId);
    if (locked) return none;
    const role = await enrollmentService.getActiveRole(userId, communityId);
    if (!role) return none;
    const [community, enrollment, welcome, seen, latest, me] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId }, select: { title: true, ownerId: true, instructorName: true } }),
      prisma.enrollment.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { enrolledAt: true } }),
      prisma.communityWelcome.findUnique({ where: { communityId } }),
      prisma.communityWelcomeSeen.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { seenAt: true } }),
      prisma.communityAnnouncement.findFirst({
        where: { communityId, active: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, body: true, link: true, createdAt: true, authorId: true, seen: { where: { userId }, select: { userId: true } } },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
    ]);
    if (!community || !enrollment) return none;

    const showWelcome =
      role === 'member' &&
      !seen &&
      welcome?.enabled === true &&
      welcome.message.trim() !== '' &&
      welcome.enabledSince !== null &&
      enrollment.enrolledAt >= welcome.enabledSince;
    const showAnnouncement = latest && latest.authorId !== userId && latest.seen.length === 0;

    return {
      welcome: showWelcome
        ? {
            message: renderWelcome(welcome.message, { ten: me?.firstName ?? '', cong_dong: community.title }),
            sender: await senderFor(communityId, community.ownerId, community.instructorName),
          }
        : null,
      announcement: showAnnouncement ? { ...announcementView(latest), sender: await senderFor(communityId, latest.authorId, community.instructorName) } : null,
    };
  },

  async markWelcomeSeen(userId: string, communityId: string) {
    if (!(await enrollmentService.getActiveRole(userId, communityId))) throw new HttpError(403, 'NOT_MEMBER', 'Bạn chưa tham gia cộng đồng này');
    await prisma.communityWelcomeSeen.createMany({ data: [{ userId, communityId }], skipDuplicates: true });
    return { ok: true };
  },

  async markAnnouncementSeen(userId: string, communityId: string, announcementId: string) {
    if (!(await enrollmentService.getActiveRole(userId, communityId))) throw new HttpError(403, 'NOT_MEMBER', 'Bạn chưa tham gia cộng đồng này');
    const a = await prisma.communityAnnouncement.findFirst({ where: { id: announcementId, communityId }, select: { id: true } });
    if (!a) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
    await prisma.communityAnnouncementSeen.createMany({ data: [{ announcementId, userId }], skipDuplicates: true });
    return { ok: true };
  },

  // -------------------------------------------------------------- quản trị (admin cộng đồng trở lên)
  async settings(userId: string, communityId: string) {
    await requireRole(userId, communityId, 'admin');
    const [welcome, rows, members] = await Promise.all([
      prisma.communityWelcome.findUnique({ where: { communityId } }),
      prisma.communityAnnouncement.findMany({
        where: { communityId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, title: true, body: true, link: true, active: true, createdAt: true, author: { select: userSelect }, _count: { select: { seen: true } } },
      }),
      prisma.enrollment.count({ where: { communityId } }),
    ]);
    return {
      welcome: { enabled: welcome?.enabled ?? false, message: welcome?.message ?? '', enabledSince: welcome?.enabledSince?.toISOString() ?? null },
      announcements: rows.map((a) => ({ ...announcementView(a), active: a.active, author: nameOf(a.author), seenCount: a._count.seen })),
      members,
    };
  },

  async saveWelcome(userId: string, communityId: string, input: z.infer<typeof welcomeBody>) {
    await requireRole(userId, communityId, 'admin');
    if (input.enabled && !input.message) throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng nhập lời chào trước khi bật');
    const prev = await prisma.communityWelcome.findUnique({ where: { communityId } });
    // Mỗi lần BẬT (tắt -> bật) tính lại mốc: chỉ người tham gia từ đây mới thấy lời chào.
    const enabledSince = input.enabled ? (prev?.enabled && prev.enabledSince ? prev.enabledSince : new Date()) : (prev?.enabledSince ?? null);
    const data = { enabled: input.enabled, message: input.message, enabledSince, updatedById: userId };
    await prisma.communityWelcome.upsert({ where: { communityId }, create: { communityId, ...data }, update: data });
    return this.settings(userId, communityId);
  },

  /** Đăng thông báo mới: các thông báo cũ thôi hiện (chỉ bản mới nhất là popup). */
  async publishAnnouncement(userId: string, communityId: string, input: z.infer<typeof announcementBody>) {
    await requireRole(userId, communityId, 'admin');
    await prisma.$transaction([
      prisma.communityAnnouncement.updateMany({ where: { communityId, active: true }, data: { active: false } }),
      prisma.communityAnnouncement.create({ data: { communityId, authorId: userId, title: input.title, body: input.body, link: input.link ?? null } }),
    ]);
    return this.settings(userId, communityId);
  },

  /** Gỡ (active=false) / hiện lại (active=true — các bản khác thôi hiện). Người đã xem rồi không thấy lại. */
  async setAnnouncementActive(userId: string, communityId: string, announcementId: string, active: boolean) {
    await requireRole(userId, communityId, 'admin');
    const a = await prisma.communityAnnouncement.findFirst({ where: { id: announcementId, communityId }, select: { id: true } });
    if (!a) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
    await prisma.$transaction([
      ...(active ? [prisma.communityAnnouncement.updateMany({ where: { communityId, active: true }, data: { active: false } })] : []),
      prisma.communityAnnouncement.update({ where: { id: announcementId }, data: { active } }),
    ]);
    return this.settings(userId, communityId);
  },
};
