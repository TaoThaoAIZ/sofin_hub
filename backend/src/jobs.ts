import type { Job } from './infra/scheduler.js';
import { runEventRemindersOnce } from './modules/events/events.reminders.js';
import { paymentsService } from './modules/payments/payments.service.js';
import { referralsService } from './modules/referrals/referrals.service.js';

/**
 * Mọi job nền của hệ thống. Chạy dưới leader election (infra/scheduler.ts): nhiều instance cùng bật scheduler thì mỗi job vẫn chỉ
 * chạy ở 1 instance mỗi lượt. Thêm job mới ở ĐÂY (không tự `setInterval` rải rác).
 */
export function allJobs(): Job[] {
  return [
    // Gia hạn / hết dùng thử / hết kỳ đã hủy.
    { name: 'payments.subscriptions', intervalMs: 5 * 60_000, run: () => paymentsService.processDueSubscriptions(new Date()) },
    // Email + thông báo nhắc 3 ngày trước ngày trừ tiền đầu tiên của gói dùng thử có thẻ (claim idempotent trong DB).
    { name: 'payments.trialReminders', intervalMs: 15 * 60_000, run: () => paymentsService.sendTrialReminders(new Date()) },
    // Đối soát tiền: hoàn tiền kẹt `refunding`, charge đã trừ nhưng chưa settle, khoản trừ trùng chưa hoàn, webhook kẹt/failed (reapStaleWebhooks).
    { name: 'payments.reconcile', intervalMs: 5 * 60_000, run: () => paymentsService.reconcileMoney() },
    // Hoa hồng giới thiệu còn thiếu (hook sau commit bị mất do process chết). Idempotent theo sourceRef.
    { name: 'referrals.reconcile', intervalMs: 10 * 60_000, run: () => referralsService.reconcileCommissions(new Date()) },
    // Nhắc lịch sự kiện cho người đã RSVP (còn <= 1 giờ).
    { name: 'events.reminders', intervalMs: 60_000, run: () => runEventRemindersOnce() },
  ];
}
