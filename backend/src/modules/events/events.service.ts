import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { pointsService } from '../points/points.service.js';
import { buildIcs } from './events.ics.js';
import { eventsRepository, type EventPatch, type EventsRepository } from './events.repository.js';
import type { CommunityEvent, CommunityEventView } from './events.types.js';
import type { CreateEventBody, UpdateEventBody } from './events.schema.js';

/** Giới hạn số thành viên nhận thông báo "sự kiện mới" để cộng đồng đông không tạo hàng nghìn bản ghi. */
const EVENT_CREATED_NOTIFY_LIMIT = 200;

export const eventPath = (e: Pick<CommunityEvent, 'courseId'>) => `/courses/${e.courseId}/community/lich`;

export function createEventsService(repo: EventsRepository = eventsRepository) {
  async function toViews(events: CommunityEvent[], viewerId: string): Promise<CommunityEventView[]> {
    const ids = events.map((e) => e.id);
    const [counts, mine] = await Promise.all([repo.rsvpCounts(ids), repo.rsvpedEventIds(ids, viewerId)]);
    const now = Date.now();
    return events.map((e) => ({
      ...e,
      rsvpCount: counts.get(e.id) ?? 0,
      viewerRsvped: mine.has(e.id),
      isPast: new Date(e.startAt).getTime() < now,
    }));
  }
  const toView = async (e: CommunityEvent, viewerId: string) => (await toViews([e], viewerId))[0]!;

  async function hostName(e: CommunityEvent) {
    return (await userBriefView(e.hostId)).name;
  }

  return {
    async list(courseId: string, viewerId: string): Promise<CommunityEventView[]> {
      await courseService.getById(courseId);
      return toViews(await repo.listByCourse(courseId), viewerId);
    },

    async create(courseId: string, hostId: string, body: CreateEventBody) {
      const event = await repo.create({ courseId, hostId, ...body });
      const members = (await enrollmentService.listMembers(courseId)).filter((m) => m.userId !== hostId).slice(0, EVENT_CREATED_NOTIFY_LIMIT);
      for (const m of members) {
        notify({
          userId: m.userId,
          type: 'event_created',
          title: 'Sự kiện mới',
          body: `Sự kiện "${event.title}" vừa được tạo`,
          link: eventPath(event),
          courseId,
        });
      }
      return event;
    },

    async getOrThrow(eventId: string) {
      const event = await repo.findById(eventId);
      if (!event) throw HttpError.notFound('Không tìm thấy sự kiện');
      return event;
    },

    async getView(eventId: string, viewerId: string) {
      return toView(await this.getOrThrow(eventId), viewerId);
    },

    async update(eventId: string, body: UpdateEventBody, viewerId: string) {
      const event = await this.getOrThrow(eventId);
      const { meetingLink, capacity, ...rest } = body;
      if (capacity != null && capacity < (await repo.rsvpCount(eventId))) {
        throw HttpError.conflict('Sức chứa không được nhỏ hơn số người đã đăng ký');
      }
      const patch: EventPatch = { ...rest };
      if (meetingLink !== undefined) patch.meetingLink = meetingLink; // null = xóa
      if (capacity !== undefined) patch.capacity = capacity;
      const updated = await repo.update(eventId, patch);
      if (!updated) throw HttpError.notFound('Không tìm thấy sự kiện');
      // Đổi giờ thì cho phép nhắc lại theo giờ mới.
      if (body.startAt && new Date(body.startAt).getTime() !== new Date(event.startAt).getTime()) await repo.clearReminded(eventId);
      return toView(updated, viewerId);
    },

    async remove(eventId: string) {
      const event = await this.getOrThrow(eventId);
      for (const userId of await repo.listRsvpUserIds(eventId)) {
        notify({
          userId,
          type: 'system',
          title: 'Sự kiện đã bị hủy',
          body: `Sự kiện "${event.title}" đã bị hủy`,
          link: eventPath(event),
          courseId: event.courseId,
        });
      }
      await repo.delete(eventId);
    },

    async toggleRsvp(eventId: string, userId: string) {
      const event = await this.getOrThrow(eventId);
      if (new Date(event.startAt).getTime() < Date.now()) throw HttpError.badRequest('Sự kiện đã diễn ra, không thể đăng ký');

      // Kiểm sức chứa nằm trong transaction của repo (khóa hàng sự kiện) nên an toàn khi nhiều người RSVP đồng thời.
      const result = await repo.toggleRsvp(eventId, userId);
      if (result === 'gone') throw HttpError.notFound('Không tìm thấy sự kiện');
      if (result === 'full') throw HttpError.conflict('Sự kiện đã đủ số lượng đăng ký');
      const rsvped = result === 'rsvped';
      if (rsvped) await pointsService.award(userId, event.courseId, 'event_rsvp');
      return { rsvped, rsvpCount: await repo.rsvpCount(eventId) };
    },

    /** Hủy đăng ký tường minh, idempotent (chưa đăng ký cũng trả 200). */
    async cancelRsvp(eventId: string, userId: string) {
      await this.getOrThrow(eventId);
      await repo.cancelRsvp(eventId, userId);
      return { rsvped: false, rsvpCount: await repo.rsvpCount(eventId) };
    },

    async icsForEvent(eventId: string, baseUrl?: string) {
      const event = await this.getOrThrow(eventId);
      return buildIcs([{ event, hostName: await hostName(event), url: baseUrl }], event.title);
    },

    async icsForCourse(courseId: string) {
      const course = await courseService.getById(courseId);
      const events = await repo.listByCourse(courseId);
      const names = new Map(await Promise.all([...new Set(events.map((e) => e.hostId))].map(async (id) => [id, (await userBriefView(id)).name] as const)));
      const items = events.map((event) => ({ event, hostName: names.get(event.hostId)! }));
      return buildIcs(items, `SofinHub — ${course.title}`);
    },
  };
}

export const eventsService = createEventsService();
