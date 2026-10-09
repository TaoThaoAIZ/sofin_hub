import type { Job } from './infra/scheduler.js';
import { runEventRemindersOnce } from './modules/events/events.reminders.js';
import { purgeUnverifiedUsers } from './modules/auth/unverified.js';
import { paymentsService } from './modules/payments/payments.service.js';
import { referralsService } from './modules/referrals/referrals.service.js';

/**
 * Mọi job nền của hệ thống. Chạy dưới leader election (infra/scheduler.ts): nhiều instance cùng bật scheduler thì mỗi job vẫn chỉ
 * chạy ở 1 instance mỗi lượt. Thêm job mới ở ĐÂY (không tự `setInterval` rải rác).
 */
export function allJobs(): Job[] {
  return [
    // Hết dùng thử / hết kỳ đã hủy / hết ân hạn gia hạn (chuyển khoản không tự trừ được).
    { name: 'payments.subscriptions', intervalMs: 5 * 60_000, run: () => paymentsService.processDueSubscriptions(new Date()) },
    // Nhắc thanh toán trước khi hết dùng thử (claim idempotent trong DB).
    { name: 'payments.trialReminders', intervalMs: 15 * 60_000, run: () => paymentsService.sendTrialReminders(new Date()) },
    // Đối soát tiền: hoàn tiền kẹt `refunding`, khoản chuyển trùng chưa ghi nhận hoàn, phiên chuyển khoản quá hạn.
    { name: 'payments.reconcile', intervalMs: 5 * 60_000, run: () => paymentsService.reconcileMoney() },
    // (B) Đường đối soát "đảm bảo" của chuyển khoản: kéo giao dịch vào từ SePay mỗi phút — chạy được cả khi webhook không tới được server.
    { name: 'payments.bankScan', intervalMs: 60_000, run: () => paymentsService.scanBankTransactions() },
    // Phát hóa đơn gia hạn (phiên QR kỳ kế tiếp) cho gói active sắp hết kỳ.
    { name: 'payments.renewalInvoices', intervalMs: 15 * 60_000, run: () => paymentsService.issueRenewalInvoices(new Date()) },
    // Hoa hồng giới thiệu còn thiếu (hook sau commit bị mất do process chết). Idempotent theo sourceRef.
    { name: 'referrals.reconcile', intervalMs: 10 * 60_000, run: () => referralsService.reconcileCommissions(new Date()) },
    // Nhắc lịch sự kiện cho người đã RSVP (còn <= 1 giờ).
    { name: 'events.reminders', intervalMs: 60_000, run: () => runEventRemindersOnce() },
    // Dọn tài khoản đăng ký dở (chưa nhập OTP) quá 7 ngày để không chiếm email.
    { name: 'auth.purgeUnverified', intervalMs: 60 * 60_000, run: () => purgeUnverifiedUsers(new Date()) },
  ];
}
