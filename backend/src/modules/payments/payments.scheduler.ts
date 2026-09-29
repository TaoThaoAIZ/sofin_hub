import { env } from '../../config/env.js';
import { paymentsService } from './payments.service.js';

const INTERVAL_MS = 5 * 60_000;

/** Chạy gia hạn / hết hạn dùng thử / hết kỳ đã hủy mỗi 5 phút. Không chạy khi test (test gọi processDueSubscriptions trực tiếp). */
export function startSubscriptionScheduler(): NodeJS.Timeout | undefined {
  if (env.NODE_ENV === 'test') return undefined;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // chưa xong lượt trước thì bỏ qua, tránh chồng lượt
    running = true;
    try {
      await paymentsService.processDueSubscriptions(new Date());
    } catch (err) {
      console.error('processDueSubscriptions lỗi:', err);
    } finally {
      running = false;
    }
  }, INTERVAL_MS);
  timer.unref();
  return timer;
}
