import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { MAX_PINNED_POSTS, postsService } from '../posts/posts.service.js';
import { splitPost } from './announcement-sync.js';

/**
 * Lời chào thành viên mới + thông báo popup của chủ cộng đồng (docs/features/community-greetings.md).
 * - Lời chào: hiện 1 lần duy nhất / người / cộng đồng, chỉ cho người tham gia TỪ lúc chủ bật; rời rồi tham gia lại cũng không hiện nữa
 *   (CommunityWelcomeSeen không gắn với Enrollment).
 * - Thông báo = bài mục "Thông báo" đang GHIM (đăng ở đây hoặc ghim trên Bảng tin — announcement-sync.ts). Chỉ hiện ở trang của cộng
 *   đồng đó, mỗi thành viên mỗi thông báo 1 lần, CHỈ thông báo đăng/ghim sau khi người đó tham gia (người mới chỉ thấy lời chào, không bị
 *   dồn thông báo cũ). Nhiều thông báo chưa xem => trả về theo thứ tự cũ -> mới (FE hiện dạng slide), tối đa MAX_SLIDES.
 * Đánh dấu "đã xem" ngay khi popup / slide HIỆN (không chờ bấm đóng) => tải lại trang không hiện lại.
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

/** Số thông báo chưa xem tối đa hiện trong 1 lần (lấy mới nhất), để popup không quá dài. */
export const MAX_SLIDES = 10;

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

const postLink = (communityId: string, postId: string | null) => (postId ? `/communities/${communityId}/community?post=${postId}` : null);
const announcementView = (a: { id: string; communityId: string; title: string; body: string; link: string | null; postId: string | null; createdAt: Date }) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  /** Nút "Xem chi tiết": link riêng nếu có, không thì mở bài trên Bảng tin. */
  link: a.link ?? postLink(a.communityId, a.postId),
  postLink: postLink(a.communityId, a.postId),
  createdAt: a.createdAt.toISOString(),
});
const announcementSelect = { id: true, communityId: true, title: true, body: true, link: true, postId: true, createdAt: true, authorId: true } as const;
/** Thông báo còn hiệu lực: đang bật + bài gốc còn ghim, không bị ẩn/gỡ. */
const LIVE = { active: true, post: { pinned: true, hidden: false, removedAt: null } } as const;

const pinLimitError = () =>
  new HttpError(409, 'PIN_LIMIT', `Cộng đồng đã ghim đủ ${MAX_PINNED_POSTS} bài. Bỏ ghim bớt một bài để ghim bài mới.`, { limit: MAX_PINNED_POSTS });

const CATEGORY_LABEL: Record<string, string> = { general: 'Thảo luận chung', qa: 'Hỏi đáp', case_study: 'Case study', announcement: 'Thông báo' };

export const greetingsService = {
  /** Bài đang ghim (hộp "Quản lý ghim"; mod trở lên — cùng quyền ghim/bỏ ghim). Bài "Thông báo" kèm số người đã xem popup. */
  async pins(userId: string, communityId: string) {
    await requireRole(userId, communityId, 'mod');
    const rows = await prisma.post.findMany({
      where: { communityId, pinned: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, content: true, category: true, createdAt: true, hidden: true,
        author: { select: userSelect },
        announcement: { select: { active: true, _count: { select: { seen: true } } } },
      },
    });
    return {
      limit: MAX_PINNED_POSTS,
      pins: rows.map((p) => ({
        id: p.id,
        title: splitPost(p.content).title || '—',
        category: CATEGORY_LABEL[p.category] ?? p.category,
        popup: p.announcement?.active === true && !p.hidden,
        seenCount: p.announcement?._count.seen ?? null,
        author: nameOf(p.author),
        createdAt: p.createdAt.toISOString(),
        link: postLink(communityId, p.id),
      })),
    };
  },

  /** Popup cần hiện cho người đang xem trang cộng đồng. Người ngoài / cộng đồng bị khóa => không có gì. */
  async pending(userId: string, communityId: string) {
    const none = { welcome: null, announcements: [] };
    const { locked } = await catalogService.requireLockState(communityId);
    if (locked) return none;
    const role = await enrollmentService.getActiveRole(userId, communityId);
    if (!role) return none;
    const [community, enrollment, welcome, seen, me] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId }, select: { title: true, ownerId: true, instructorName: true } }),
      prisma.enrollment.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { enrolledAt: true } }),
      prisma.communityWelcome.findUnique({ where: { communityId } }),
      prisma.communityWelcomeSeen.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { seenAt: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
    ]);
    if (!community || !enrollment) return none;

    // Chỉ thông báo đăng/ghim SAU khi tham gia, chưa xem, không phải của chính mình; lấy MAX_SLIDES mới nhất rồi xếp cũ -> mới.
    const unseen = await prisma.communityAnnouncement.findMany({
      where: { communityId, ...LIVE, createdAt: { gt: enrollment.enrolledAt }, authorId: { not: userId }, seen: { none: { userId } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_SLIDES,
      select: announcementSelect,
    });
    const senders = new Map<string, Sender>();
    for (const a of unseen) if (!senders.has(a.authorId)) senders.set(a.authorId, await senderFor(communityId, a.authorId, community.instructorName));

    const showWelcome =
      role === 'member' &&
      !seen &&
      welcome?.enabled === true &&
      welcome.message.trim() !== '' &&
      welcome.enabledSince !== null &&
      enrollment.enrolledAt >= welcome.enabledSince;

    return {
      welcome: showWelcome
        ? {
            message: renderWelcome(welcome.message, { ten: me?.firstName ?? '', cong_dong: community.title }),
            sender: await senderFor(communityId, community.ownerId, community.instructorName),
          }
        : null,
      announcements: unseen.reverse().map((a) => ({ ...announcementView(a), sender: senders.get(a.authorId)! })),
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
        select: { ...announcementSelect, active: true, author: { select: userSelect }, post: { select: { pinned: true, hidden: true, removedAt: true } }, _count: { select: { seen: true } } },
      }),
      prisma.enrollment.count({ where: { communityId } }),
    ]);
    return {
      welcome: { enabled: welcome?.enabled ?? false, message: welcome?.message ?? '', enabledSince: welcome?.enabledSince?.toISOString() ?? null },
      announcements: rows.map((a) => ({
        ...announcementView(a),
        active: a.active && a.post?.pinned === true && !a.post.hidden && !a.post.removedAt,
        author: nameOf(a.author),
        seenCount: a._count.seen,
      })),
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

  /**
   * Đăng thông báo = đăng bài mục "Thông báo" lên Bảng tin + ghim (=> popup qua announcement-sync). Các thông báo đang ghim khác giữ
   * nguyên — thành viên chưa xem thấy dạng slide.
   */
  async publishAnnouncement(userId: string, communityId: string, input: z.infer<typeof announcementBody>) {
    await requireRole(userId, communityId, 'admin');
    // Đủ bài ghim => báo trước khi đăng (FE mở "Quản lý ghim"), tránh để lại bài không ghim.
    if ((await prisma.post.count({ where: { communityId, pinned: true } })) >= MAX_PINNED_POSTS) throw pinLimitError();
    // Bảng tin hiển thị chữ thuần => bỏ dấu **in đậm** trong bài (popup vẫn giữ in đậm).
    const post = await postsService.create(communityId, userId, `${input.title}\n\n${input.body.replace(/\*\*([^*\n]+?)\*\*/g, '$1')}`, 'Thông báo', []);
    try {
      await postsService.togglePin(post.id);
    } catch (e) {
      await prisma.post.delete({ where: { id: post.id } }); // vừa có người ghim chen vào => không để lại bài lẻ
      throw e;
    }
    // Giữ đúng tiêu đề / nội dung chủ nhập (không tách lại từ bài) + nút link riêng nếu có.
    await prisma.communityAnnouncement.update({ where: { postId: post.id }, data: { title: input.title, body: input.body, link: input.link ?? null } });
    return this.settings(userId, communityId);
  },

  /** Gỡ / hiện lại = bỏ ghim / ghim lại bài trên Bảng tin. Ai đã xem rồi không thấy lại. */
  async setAnnouncementActive(userId: string, communityId: string, announcementId: string, active: boolean) {
    await requireRole(userId, communityId, 'admin');
    const a = await prisma.communityAnnouncement.findFirst({ where: { id: announcementId, communityId }, select: { id: true, postId: true, post: { select: { pinned: true } } } });
    if (!a) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
    if (a.postId && a.post && a.post.pinned !== active) await postsService.togglePin(a.postId);
    else await prisma.communityAnnouncement.update({ where: { id: a.id }, data: { active } });
    return this.settings(userId, communityId);
  },
};
