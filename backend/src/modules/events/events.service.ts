import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { pointsService } from '../points/points.service.js';
import { buildIcs } from './events.ics.js';
import { eventsRepository, type EventPatch, type EventsRepository } from './events.repository.js';
import type { CommunityEvent, CommunityEventView } from './events.types.js';
import type { CreateEventBody, UpdateEventBody } from './events.schema.js';

/**
 * Thông báo "sự kiện mới" được rải cho MỌI thành viên theo lô (không còn cắt cứng 200 người). Lô đầu chạy ngay trong request
 * (cộng đồng nhỏ nhận thông báo ngay khi tạo); các lô sau chạy nền để request tạo sự kiện không bị kéo dài.
 */
const EVENT_NOTIFY_BATCH = 500;

export const eventPath = (e: Pick<CommunityEvent, 'communityId'>) => `/courses/${e.communityId}/community/lich`;

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
    async list(communityId: string, viewerId: string): Promise<CommunityEventView[]> {
      await catalogService.getById(communityId);
      return toViews(await repo.listByCourse(communityId), viewerId);
    },

    async create(communityId: string, hostId: string, body: CreateEventBody) {
      const event = await repo.create({ communityId, hostId, ...body });
      const notifyBatch = (ids: string[]) => {
        for (const userId of ids) {
          notify({ userId, type: 'event_created', title: 'Sự kiện mới', body: `Sự kiện "${event.title}" vừa được tạo`, link: eventPath(event), communityId });
        }
      };
      const first = await enrollmentService.memberIdsPage(communityId, { limit: EVENT_NOTIFY_BATCH, excludeUserId: hostId });
      notifyBatch(first);
      if (first.length === EVENT_NOTIFY_BATCH) {
        const after = first[first.length - 1]!;
        void (async () => {
          let cursor = after;
          for (;;) {
            const ids = await enrollmentService.memberIdsPage(communityId, { limit: EVENT_NOTIFY_BATCH, excludeUserId: hostId, afterUserId: cursor });
            if (ids.length === 0) return;
            notifyBatch(ids);
            if (ids.length < EVENT_NOTIFY_BATCH) return;
            cursor = ids[ids.length - 1]!;
            await new Promise((r) => setImmediate(r)); // nhường event loop giữa các lô
          }
        })().catch((e) => console.error('[events] rải thông báo sự kiện mới lỗi giữa chừng:', e instanceof Error ? e.message : e));
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
          communityId: event.communityId,
        });
      }
      await repo.delete(eventId);
    },

    async toggleRsvp(eventId: string, userId: string) {
      const event = await this.getOrThrow(eventId);
      if (event.cancelledAt) throw HttpError.conflict('Sự kiện đã bị hủy, không thể đăng ký');
      if (new Date(event.startAt).getTime() < Date.now()) throw HttpError.badRequest('Sự kiện đã diễn ra, không thể đăng ký');

      // Kiểm sức chứa nằm trong transaction của repo (khóa hàng sự kiện) nên an toàn khi nhiều người RSVP đồng thời.
      const result = await repo.toggleRsvp(eventId, userId);
      if (result === 'gone') throw HttpError.notFound('Không tìm thấy sự kiện');
      if (result === 'full') throw HttpError.conflict('Sự kiện đã đủ số lượng đăng ký');
      const rsvped = result === 'rsvped';
      // Khóa nghiệp vụ (user, event_rsvp, event, eventId): RSVP → hủy → RSVP lại chỉ cộng điểm đúng 1 lần.
      if (rsvped) await pointsService.award(userId, event.communityId, 'event_rsvp', { type: 'event', id: eventId });
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

    async icsForCourse(communityId: string) {
      const course = await catalogService.getById(communityId);
      const events = await repo.listByCourse(communityId);
      const names = new Map(await Promise.all([...new Set(events.map((e) => e.hostId))].map(async (id) => [id, (await userBriefView(id)).name] as const)));
      const items = events.map((event) => ({ event, hostName: names.get(event.hostId)! }));
      return buildIcs(items, `SofinHub — ${course.title}`);
    },
  };
}

export const eventsService = createEventsService();
