import { prisma } from '../../db/prisma.js';
import type { CommunityEvent as DbEvent } from '../../generated/prisma/client.js';
import type { CommunityEvent } from './events.types.js';

/** Lịch sự kiện (Postgres qua Prisma: CommunityEvent, EventRsvp). */
export type EventPatch = Partial<Pick<CommunityEvent, 'title' | 'description' | 'startAt' | 'timezone'>> & {
  /** null = xóa giá trị. */
  meetingLink?: string | null;
  capacity?: number | null;
};

/** Kết quả bật/tắt RSVP: 'full' = hết chỗ (không ghi gì), 'gone' = sự kiện không còn tồn tại. */
export type ToggleRsvpResult = 'rsvped' | 'cancelled' | 'full' | 'gone';

export interface EventsRepository {
  listByCourse(courseId: string): Promise<CommunityEvent[]>;
  /** Sự kiện có startAt trong (from, to] — dùng cho nhắc lịch. */
  listStartingBetween(from: Date, to: Date): Promise<CommunityEvent[]>;
  findById(eventId: string): Promise<CommunityEvent | undefined>;
  create(event: Omit<CommunityEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommunityEvent>;
  update(eventId: string, patch: EventPatch): Promise<CommunityEvent | undefined>;
  /** Xóa sự kiện; RSVP (kèm dấu đã-nhắc) xóa theo (CASCADE). */
  delete(eventId: string): Promise<void>;
  rsvpCount(eventId: string): Promise<number>;
  rsvpCounts(eventIds: string[]): Promise<Map<string, number>>;
  listRsvpUserIds(eventId: string): Promise<string[]>;
  isRsvped(eventId: string, userId: string): Promise<boolean>;
  /** Trong số các sự kiện đã cho, những sự kiện userId đã RSVP. */
  rsvpedEventIds(eventIds: string[], userId: string): Promise<Set<string>>;
  /**
   * Bật/tắt RSVP. Kiểm sức chứa an toàn đồng thời: transaction khóa hàng sự kiện (SELECT ... FOR UPDATE)
   * rồi đếm RSVP hiện có, nên hai người tranh chỗ cuối cùng thì chỉ một người vào được.
   */
  toggleRsvp(eventId: string, userId: string): Promise<ToggleRsvpResult>;
  /** Hủy đăng ký tường minh; trả true nếu trước đó đang đăng ký. */
  cancelRsvp(eventId: string, userId: string): Promise<boolean>;
  /** true nếu đây là lần đầu (sự kiện, user) được đánh dấu đã nhắc (atomic: updateMany ... WHERE remindedAt IS NULL). */
  markReminded(eventId: string, userId: string): Promise<boolean>;
  /**
   * Nhận (claim) tất cả RSVP của sự kiện chưa được nhắc và đánh dấu remindedAt trong một câu lệnh
   * (UPDATE ... RETURNING) => nhiều instance chạy song song cũng không nhắc trùng. Trả về userId đã nhận.
   */
  claimReminders(eventId: string): Promise<string[]>;
  /** Cho phép nhắc lại (vd. đổi giờ): đặt remindedAt = null cho mọi RSVP của sự kiện. */
  clearReminded(eventId: string): Promise<void>;
}

const toEvent = (e: DbEvent): CommunityEvent => ({
  id: e.id,
  courseId: e.courseId,
  hostId: e.hostId,
  title: e.title,
  description: e.description,
  startAt: e.startAt.toISOString(),
  timezone: e.timezone,
  meetingLink: e.meetingLink ?? undefined,
  capacity: e.capacity ?? undefined,
  ...(e.cancelledAt ? { cancelledAt: e.cancelledAt.toISOString() } : {}),
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
});

export const eventsRepository: EventsRepository = {
  async listByCourse(courseId) {
    const rows = await prisma.communityEvent.findMany({ where: { courseId, removedAt: null }, orderBy: [{ startAt: 'asc' }, { id: 'asc' }] });
    return rows.map(toEvent);
  },

  async listStartingBetween(from, to) {
    const rows = await prisma.communityEvent.findMany({ where: { startAt: { gt: from, lte: to }, cancelledAt: null, removedAt: null }, orderBy: { startAt: 'asc' } });
    return rows.map(toEvent);
  },

  async findById(eventId) {
    const e = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    return e && !e.removedAt ? toEvent(e) : undefined;
  },

  async create(event) {
    const e = await prisma.communityEvent.create({
      data: {
        courseId: event.courseId,
        hostId: event.hostId,
        title: event.title,
        description: event.description,
        startAt: new Date(event.startAt),
        timezone: event.timezone,
        meetingLink: event.meetingLink,
        capacity: event.capacity,
      },
    });
    return toEvent(e);
  },

  async update(eventId, patch) {
    const data = {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.startAt !== undefined ? { startAt: new Date(patch.startAt) } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      ...(patch.meetingLink !== undefined ? { meetingLink: patch.meetingLink } : {}),
      ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
    };
    try {
      return toEvent(await prisma.communityEvent.update({ where: { id: eventId }, data }));
    } catch (e) {
      if ((e as { code?: string }).code === 'P2025') return undefined;
      throw e;
    }
  },

  async delete(eventId) {
    await prisma.communityEvent.deleteMany({ where: { id: eventId } });
  },

  async rsvpCount(eventId) {
    return prisma.eventRsvp.count({ where: { eventId } });
  },

  async rsvpCounts(eventIds) {
    const out = new Map<string, number>();
    if (eventIds.length === 0) return out;
    const rows = await prisma.eventRsvp.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds } }, _count: { _all: true } });
    for (const r of rows) out.set(r.eventId, r._count._all);
    return out;
  },

  async listRsvpUserIds(eventId) {
    const rows = await prisma.eventRsvp.findMany({ where: { eventId }, select: { userId: true }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => r.userId);
  },

  async isRsvped(eventId, userId) {
    return (await prisma.eventRsvp.count({ where: { eventId, userId } })) > 0;
  },

  async rsvpedEventIds(eventIds, userId) {
    if (eventIds.length === 0) return new Set();
    const rows = await prisma.eventRsvp.findMany({ where: { userId, eventId: { in: eventIds } }, select: { eventId: true } });
    return new Set(rows.map((r) => r.eventId));
  },

  async toggleRsvp(eventId, userId) {
    return prisma.$transaction(async (tx) => {
      // Khóa hàng sự kiện: các RSVP song song của cùng sự kiện được tuần tự hóa nên kiểm sức chứa không bị vượt.
      const locked = await tx.$queryRaw<{ capacity: number | null }[]>`SELECT "capacity" FROM "CommunityEvent" WHERE "id" = ${eventId} FOR UPDATE`;
      if (locked.length === 0) return 'gone' as const;
      const removed = await tx.eventRsvp.deleteMany({ where: { eventId, userId } });
      if (removed.count > 0) return 'cancelled' as const;
      const capacity = locked[0]!.capacity;
      if (capacity != null && (await tx.eventRsvp.count({ where: { eventId } })) >= capacity) return 'full' as const;
      await tx.eventRsvp.create({ data: { eventId, userId } });
      return 'rsvped' as const;
    });
  },

  async cancelRsvp(eventId, userId) {
    return (await prisma.eventRsvp.deleteMany({ where: { eventId, userId } })).count > 0;
  },

  async markReminded(eventId, userId) {
    const r = await prisma.eventRsvp.updateMany({ where: { eventId, userId, remindedAt: null }, data: { remindedAt: new Date() } });
    return r.count === 1;
  },

  async claimReminders(eventId) {
    const rows = await prisma.$queryRaw<{ userId: string }[]>`
      UPDATE "EventRsvp" SET "remindedAt" = (now() AT TIME ZONE 'UTC')
      WHERE "eventId" = ${eventId} AND "remindedAt" IS NULL
      RETURNING "userId"`;
    return rows.map((r) => r.userId);
  },

  async clearReminded(eventId) {
    await prisma.eventRsvp.updateMany({ where: { eventId }, data: { remindedAt: null } });
  },
};

/** @deprecated Tên cũ; dùng `eventsRepository`. */
export const inMemoryEventsRepository: EventsRepository = eventsRepository;
