import { notify } from '../notifications/notifications.service.js';
import { eventsRepository } from './events.repository.js';
import { eventPath } from './events.service.js';

const REMIND_BEFORE_MS = 60 * 60 * 1000;

/**
 * Gửi nhắc cho người đã RSVP khi sự kiện còn <= 1 giờ nữa bắt đầu (và chưa bắt đầu).
 * Sự kiện đến hạn được chọn bằng truy vấn DB; mỗi (sự kiện, user) chỉ nhắc 1 lần nhờ `claimReminders`
 * (UPDATE ... WHERE remindedAt IS NULL RETURNING — atomic) nên nhiều instance chạy đồng thời cũng không nhắc trùng.
 * Cờ chỉ bị nhả khi việc ghi thông báo thất bại hẳn (onWriteFailed) nên nhắc lịch không bao giờ mất âm thầm.
 * Chạy định kỳ bởi src/jobs.ts (leader election). Trả về số thông báo đã gửi.
 */
export async function runEventRemindersOnce(now: Date = new Date()): Promise<number> {
  const repo = eventsRepository;
  let sent = 0;
  for (const event of await repo.listStartingBetween(now, new Date(now.getTime() + REMIND_BEFORE_MS))) {
    const diff = new Date(event.startAt).getTime() - now.getTime();
    for (const userId of await repo.claimReminders(event.id)) {
      notify({
        userId,
        type: 'event_reminder',
        title: 'Sự kiện sắp diễn ra',
        body: `"${event.title}" sẽ bắt đầu trong khoảng ${Math.max(1, Math.round(diff / 60_000))} phút nữa`,
        link: eventPath(event),
        communityId: event.communityId,
      }, {
        // Ghi thông báo thất bại hẳn (sau retry) => nhả cờ `remindedAt` của đúng user này để lượt sau nhắc lại, không mất nhắc lịch.
        onWriteFailed: () => repo.unclaimReminder(event.id, userId),
      });
      sent += 1;
    }
  }
  return sent;
}
