import { env } from './config/env.js';
import { disconnectPrisma } from './db/prisma.js';
import { createScheduler } from './infra/scheduler.js';
import { closeShared } from './infra/shared.js';
import { allJobs } from './jobs.js';
import { gracefulShutdown, installSignalHandlers } from './lifecycle.js';
import { flushNotifications } from './modules/notifications/notifications.service.js';
import { refreshConfig } from './modules/settings/settings.service.js';

/**
 * Entrypoint worker: chỉ chạy job nền (không mở cổng HTTP). Dùng khi tách web (RUN_SCHEDULERS=0) và worker; có thể chạy nhiều
 * worker để dự phòng — leader election (advisory lock) đảm bảo mỗi job chỉ chạy ở 1 worker mỗi lượt.
 * Thông báo do job tạo được GHI DB; đẩy realtime (SSE) tới các instance web cần REDIS_URL (pub/sub chung) — không có Redis thì
 * người dùng vẫn thấy thông báo khi tải lại, chỉ không có realtime.
 */
console.log(`[worker] khởi động (${env.NODE_ENV}), state chia sẻ: ${env.REDIS_URL ? 'redis' : 'in-memory (chỉ DB, không realtime tới web)'}`);
await refreshConfig().catch((e) => console.error('[settings] không nạp được cấu hình:', e));

const scheduler = createScheduler(allJobs());
scheduler.start();
const keepAlive = setInterval(() => undefined, 60_000); // timer của scheduler đã unref; giữ process sống tới khi nhận SIGTERM

installSignalHandlers(() =>
  gracefulShutdown({
    stopWork: () => scheduler.stop(),
    flush: flushNotifications,
    cleanup: [async () => clearInterval(keepAlive), disconnectPrisma, closeShared],
  }),
);
