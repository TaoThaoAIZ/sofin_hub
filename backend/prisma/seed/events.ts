import type { SeedContext } from './context.js';
import { DEMO_NAMES, demoUserId } from './demo-ids.js';

/**
 * Sự kiện + RSVP minh họa (thay cho events.seed.ts "sinh lười").
 *
 * 1) MỌI cộng đồng (Course chưa xóa mềm): 1 sự kiện sắp tới (Zoom Q&A, sức chứa 100) + 1 sự kiện đã qua, chủ trì là thành viên minh họa
 *    số 0 (admin minh họa); một số thành viên minh họa RSVP (số RSVP là bản ghi thật).
 * 2) Riêng `photo`: kịch bản thủ công với tài khoản test — xem `photoEvents`.
 *
 * Idempotent: id xác định (`seed-event-...`) + createMany(skipDuplicates). Yêu cầu seedDemoMembers đã chạy trước.
 */
const N = DEMO_NAMES.length;
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** `days` ngày kể từ hôm nay, 20:00 (giờ máy chủ) — giống events.seed.ts cũ. */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(20, 0, 0, 0);
  return d;
}

interface EventRow {
  id: string;
  courseId: string;
  hostId: string;
  title: string;
  description: string;
  startAt: Date;
  timezone: string;
  meetingLink: string;
  capacity?: number;
  /** userId đã RSVP. */
  rsvps: string[];
}

const TZ = 'Asia/Ho_Chi_Minh';

function demoEvents(courseId: string, instructor: string): EventRow[] {
  const demo = (i: number) => demoUserId(courseId, i % N);
  const range = (from: number, count: number) => Array.from({ length: count }, (_, k) => demo(from + k));
  return [
    {
      id: `seed-event-${courseId}-qa`,
      courseId,
      hostId: demo(0),
      title: `Zoom Q&A cùng ${instructor}`,
      description: 'Buổi hỏi đáp trực tiếp hàng tháng, giải đáp mọi thắc mắc về khóa học.',
      startAt: daysFromNow(5),
      timezone: TZ,
      meetingLink: 'https://zoom.us/j/000000000',
      capacity: 100,
      rsvps: range(1, 12),
    },
    {
      id: `seed-event-${courseId}-practice`,
      courseId,
      hostId: demo(0),
      title: 'Buổi thực hành nhóm nhỏ',
      description: 'Cùng thực hành trực tiếp các bài tập của module hiện tại.',
      startAt: daysFromNow(-3),
      timezone: TZ,
      meetingLink: 'https://zoom.us/j/000000001',
      rsvps: range(1, 8),
    },
  ];
}

function photoEvents(u: SeedContext['userIds']): EventRow[] {
  const courseId = 'photo';
  const demo = (i: number) => demoUserId(courseId, i);
  return [
    {
      // Sắp tới, giới hạn 3 chỗ, member2 (+1 thành viên minh họa) đã RSVP -> còn đúng 1 chỗ cuối.
      id: 'seed-event-photo-limited',
      courseId,
      hostId: u.mod,
      title: 'Workshop chụp chân dung ngoài trời',
      description: 'Thực hành ánh sáng tự nhiên và tạo dáng. Chỉ 3 chỗ để được hướng dẫn kèm 1-1.',
      startAt: new Date(daysFromNow(7).getTime()),
      timezone: TZ,
      meetingLink: 'https://meet.example.com/photo-workshop',
      capacity: 3,
      rsvps: [u.member2, demo(1)],
    },
    {
      // Sắp tới nhưng ĐẦY chỗ (2/2) — member1/member2/member3 đều chưa RSVP.
      id: 'seed-event-photo-full',
      courseId,
      hostId: u.owner,
      title: 'Photowalk phố cổ (đã đủ người)',
      description: 'Buổi đi chụp nhóm nhỏ; đã đủ số lượng đăng ký.',
      startAt: daysFromNow(3),
      timezone: TZ,
      meetingLink: 'https://meet.example.com/photowalk',
      capacity: 2,
      rsvps: [demo(1), demo(2)],
    },
    {
      // Đã qua: không RSVP được nữa; member1 và member2 từng tham gia.
      id: 'seed-event-photo-past',
      courseId,
      hostId: u.owner,
      title: 'Livestream chấm ảnh tháng trước',
      description: 'Buổi chấm ảnh và góp ý trực tiếp.',
      startAt: new Date(Date.now() - 7 * DAY - HOUR),
      timezone: TZ,
      meetingLink: 'https://meet.example.com/photo-review',
      rsvps: [u.member1, u.member2, demo(3)],
    },
  ];
}

export async function seedEvents(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const courses = await db.course.findMany({ where: { deletedAt: null }, select: { id: true, instructorName: true } });
  const events: EventRow[] = [];
  for (const c of courses) events.push(...demoEvents(c.id, c.instructorName));
  if (courses.some((c) => c.id === 'photo')) events.push(...photoEvents(ctx.userIds));

  const userIds = new Set((await db.user.findMany({ select: { id: true } })).map((u) => u.id));
  const rows = events.filter((e) => userIds.has(e.hostId));
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.communityEvent.createMany({
      data: rows.slice(i, i + CHUNK).map(({ rsvps: _r, ...e }) => e),
      skipDuplicates: true,
    });
  }
  const rsvps = rows.flatMap((e) => e.rsvps.filter((id) => userIds.has(id)).map((userId) => ({ eventId: e.id, userId })));
  for (let i = 0; i < rsvps.length; i += CHUNK) await db.eventRsvp.createMany({ data: rsvps.slice(i, i + CHUNK), skipDuplicates: true });
}
