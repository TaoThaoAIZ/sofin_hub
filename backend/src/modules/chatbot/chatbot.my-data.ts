import { prisma } from '../../db/prisma.js';
import { normalizeText } from '../search/search.text.js';
import { ticketCode } from '../support/tickets.core.js';

/**
 * Dữ liệu tài khoản của CHÍNH người đang chat (chỉ đọc) cho Tào: hồ sơ, gói & học tập, sự kiện & thông báo, giới thiệu & ticket.
 * Chỉ nhóm mà câu hỏi nhắc tới mới được lấy (giảm dữ liệu cá nhân gửi sang ChatGPT). Không bao giờ có: email đầy đủ, mật khẩu,
 * mã 2FA, phiên/IP, link phòng họp, nội dung tin nhắn riêng, dữ liệu của người khác. Muốn SỬA thì bot chỉ đưa link trang cài đặt.
 */
export type AccountGroup = 'profile' | 'learning' | 'events' | 'referral';

/** Mẫu câu (đã bỏ dấu) cho từng nhóm. */
const GROUP_TOPIC: Record<AccountGroup, RegExp> = {
  profile:
    /\b(ho so|trang ca nhan|profile|tai khoan|ten (hien thi|dang nhap)|handle|bio|tieu su|anh dai dien|avatar|email|xac minh|xac thuc|2fa|bao mat (2|hai) lop|ngon ngu|mui gio)\b/,
  learning:
    /\b(goi|het han|gia han|tien do|hoan thanh|hoc (duoc|den|xong|bao nhieu)|bai hoc|module|chung chi|certificate|subscription)\b/,
  events: /\b(su kien|lich|live|livestream|buoi hoc|buoi live|webinar|rsvp|thong bao|notification)\b/,
  referral: /\b(ma gioi thieu|link gioi thieu|chuong trinh gioi thieu|gioi thieu ban|nguoi (da )?(duoc )?(moi|gioi thieu)|hoa hong|referral|ticket|yeu cau ho tro|ma ho tro)\b|\bt ?\d{4}\b/,
};

/** Câu hỏi về CHÍNH khách ("của tôi", "mình đã..."). Không có thì chỉ là câu hỏi chung (vd "làm sao bật 2FA") — dùng câu mẫu/tài liệu. */
const PERSONAL = /\b(toi|minh|em|tui|cua toi|cua minh)\b|\bmy\b/;

/** Các nhóm dữ liệu tài khoản câu hỏi cần. Rỗng = không phải câu hỏi về tài khoản của chính khách. */
export function accountGroups(text: string): AccountGroup[] {
  const t = normalizeText(text);
  if (!PERSONAL.test(t)) return [];
  return (Object.keys(GROUP_TOPIC) as AccountGroup[]).filter((g) => GROUP_TOPIC[g].test(t));
}

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const day = (d: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
const time = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

/** "tuan@gmail.com" => "t***@gmail.com" — đủ để khách nhận ra email nào, không gửi nguyên email. */
const maskEmail = (e: string) => {
  const [name = '', domain = ''] = e.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
};

const SUB_STATUS: Record<string, string> = {
  trialing: 'đang dùng thử',
  active: 'đang hoạt động',
  past_due: 'quá hạn thanh toán',
  paused: 'tạm dừng',
  canceled: 'đã hủy',
  expired: 'đã hết hạn',
};
const TICKET_STATUS: Record<string, string> = {
  new: 'mới gửi, chờ tiếp nhận',
  open: 'đang xử lý',
  awaiting_reply: 'đang chờ bạn trả lời',
  resolved: 'đã giải quyết',
  closed: 'đã đóng',
};
const ACTIVE_COMMUNITY = { deletedAt: null, moderationStatus: 'active' } as const;
/** Bài học khách thấy được (giống lớp học: bỏ bài ẩn/gỡ, module nháp/gỡ). */
const VISIBLE_LESSON = { hidden: false, removedAt: null, module: { removedAt: null, publishStatus: 'published' } } as const;

async function profile(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { firstName: true, lastName: true, handle: true, bio: true, location: true, website: true, email: true, emailVerified: true, twoFactorEnabled: true, language: true, timezone: true, createdAt: true },
  });
  return {
    name: `${u.lastName} ${u.firstName}`.trim(),
    handle: u.handle,
    profileLink: `/users/${userId}`,
    bio: u.bio?.slice(0, 200) ?? null,
    location: u.location,
    website: u.website,
    email: maskEmail(u.email),
    emailVerified: u.emailVerified,
    twoFactorEnabled: u.twoFactorEnabled,
    language: u.language,
    timezone: u.timezone,
    joinedSofinHub: day(u.createdAt),
    editProfilePage: '/settings',
    securityPage: '/settings/bao-mat',
  };
}

async function learning(userId: string) {
  const enrolled = await prisma.enrollment.findMany({
    where: { userId, community: ACTIVE_COMMUNITY },
    select: { community: { select: { id: true, title: true } } },
  });
  const ids = enrolled.map((e) => e.community.id);
  const title = new Map(enrolled.map((e) => [e.community.id, e.community.title]));
  const [subs, totals, done, modules, certs] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId, community: ACTIVE_COMMUNITY },
      orderBy: { currentPeriodEnd: 'desc' },
      take: 10,
      select: { status: true, interval: true, priceCents: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, trialEndsAt: true, community: { select: { id: true, title: true } } },
    }),
    prisma.classroomLesson.groupBy({ by: ['communityId'], where: { communityId: { in: ids }, ...VISIBLE_LESSON }, _count: true }),
    prisma.lessonProgress.findMany({ where: { userId, completedAt: { not: null }, lesson: { communityId: { in: ids }, ...VISIBLE_LESSON } }, select: { lesson: { select: { communityId: true } } } }),
    prisma.moduleAccess.findMany({ where: { userId, module: { removedAt: null, community: ACTIVE_COMMUNITY } }, take: 10, select: { module: { select: { title: true, community: { select: { title: true } } } } } }),
    prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: 'desc' }, take: 10, select: { code: true, courseTitle: true, issuedAt: true, community: { select: { title: true } } } }),
  ]);
  const doneBy = new Map<string, number>();
  for (const p of done) doneBy.set(p.lesson.communityId, (doneBy.get(p.lesson.communityId) ?? 0) + 1);
  return {
    memberships: subs.map((s) => ({
      community: s.community.title,
      status: SUB_STATUS[s.status] ?? s.status,
      plan: `${vnd(s.priceCents)}/${s.interval === 'annual' ? 'năm' : 'tháng'}`,
      [s.cancelAtPeriodEnd || s.status === 'canceled' || s.status === 'expired' ? 'accessUntil' : 'renewsOn']: day(s.currentPeriodEnd),
      ...(s.status === 'trialing' && s.trialEndsAt ? { trialEndsOn: day(s.trialEndsAt) } : {}),
      link: `/communities/${s.community.id}/checkout`,
    })),
    progress: totals
      .filter((t) => t._count > 0)
      .map((t) => {
        const d = Math.min(doneBy.get(t.communityId) ?? 0, t._count);
        return { community: title.get(t.communityId) ?? '', lessonsDone: d, lessonsTotal: t._count, percent: Math.round((d / t._count) * 100), classroom: `/communities/${t.communityId}/community/lop-hoc` };
      }),
    unlockedModules: modules.map((m) => ({ module: m.module.title, community: m.module.community.title })),
    certificates: certs.map((c) => ({ course: c.courseTitle, community: c.community.title, issuedOn: day(c.issuedAt), link: `/certificates/${c.code}` })),
    billingPage: '/settings/thanh-toan',
  };
}

async function events(userId: string) {
  const now = new Date();
  const [upcoming, unread, latest] = await Promise.all([
    prisma.communityEvent.findMany({
      where: { startAt: { gte: now }, cancelledAt: null, removedAt: null, community: { ...ACTIVE_COMMUNITY, enrollments: { some: { userId } } } },
      orderBy: { startAt: 'asc' },
      take: 8,
      select: { title: true, startAt: true, communityId: true, community: { select: { title: true } }, rsvps: { where: { userId }, select: { userId: true } } },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5, select: { title: true, createdAt: true, readAt: true } }),
  ]);
  return {
    upcomingEvents: upcoming.map((e) => ({
      title: e.title,
      community: e.community.title,
      startsAt: time(e.startAt),
      registered: e.rsvps.length > 0,
      calendar: `/communities/${e.communityId}/community/lich`,
    })),
    unreadNotifications: unread,
    latestNotifications: latest.map((n) => ({ title: n.title.slice(0, 120), at: day(n.createdAt), read: n.readAt !== null })),
    notificationsPage: '/notifications',
    notificationSettingsPage: '/settings/thong-bao',
  };
}

async function referral(userId: string) {
  const [code, invited, commissions, tickets] = await Promise.all([
    prisma.referralCode.findUnique({ where: { userId }, select: { code: true } }),
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.referralCommission.groupBy({ by: ['status'], where: { referrerId: userId }, _sum: { amountCents: true } }),
    prisma.supportTicket.findMany({ where: { requesterId: userId }, orderBy: { lastActivityAt: 'desc' }, take: 5, select: { number: true, subject: true, status: true, lastActivityAt: true } }),
  ]);
  const sum = (s: string) => vnd(commissions.find((c) => c.status === s)?._sum.amountCents ?? 0);
  return {
    referralCode: code?.code ?? null,
    peopleInvited: invited,
    commission: { pending: sum('pending'), paid: sum('paid') },
    referralPage: '/settings/gioi-thieu',
    supportTickets: tickets.map((t) => ({ code: ticketCode(t.number), subject: t.subject.slice(0, 120), status: TICKET_STATUS[t.status] ?? t.status, lastActivity: day(t.lastActivityAt) })),
  };
}

const LOADERS: Record<AccountGroup, (userId: string) => Promise<unknown>> = { profile, learning, events, referral };

/** Lấy các nhóm dữ liệu được yêu cầu; nhóm nào lỗi thì bỏ qua (bot nói chưa có thông tin). */
export async function myAccount(userId: string, groups: AccountGroup[]): Promise<Partial<Record<AccountGroup, unknown>> | null> {
  if (!groups.length) return null;
  const parts = await Promise.all(groups.map(async (g) => [g, await LOADERS[g](userId).catch(() => null)] as const));
  return Object.fromEntries(parts.filter(([, v]) => v !== null));
}
