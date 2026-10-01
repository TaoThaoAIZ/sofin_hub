import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './db/prisma.js';
import { closeShared } from './infra/shared.js';
import { createScheduler } from './infra/scheduler.js';
import { allJobs } from './jobs.js';
import { gracefulShutdown, installSignalHandlers } from './lifecycle.js';
import { streamHub } from './modules/messages/messages.stream.js';
import { closeNotificationStreams } from './modules/notifications/notifications.routes.js';
import { flushNotifications } from './modules/notifications/notifications.service.js';
import { refreshConfig } from './modules/settings/settings.service.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
});

// Nạp cấu hình nền tảng (Global Settings) ngay khi khởi động; lỗi thì dùng mặc định từ env.
void refreshConfig().catch((e) => console.error('[settings] không nạp được cấu hình:', e));

// Job nền (gia hạn, đối soát tiền, nhắc lịch) chạy dưới leader election (Postgres advisory lock): bật ở mọi instance cũng chỉ 1 instance
// chạy mỗi lượt. RUN_SCHEDULERS=0 => process web-only, job do `npm run start:worker` đảm nhiệm. Không chạy khi test.
const scheduler = env.RUN_SCHEDULERS && env.NODE_ENV !== 'test' ? createScheduler(allJobs()) : undefined;
scheduler?.start();
if (!scheduler) console.log(`[scheduler] tắt trong process này (RUN_SCHEDULERS=${env.RUN_SCHEDULERS ? '1' : '0'}, NODE_ENV=${env.NODE_ENV})`);

installSignalHandlers(() =>
  gracefulShutdown({
    server,
    stopWork: () => scheduler?.stop() ?? Promise.resolve(),
    closeStreams: async () => {
      closeNotificationStreams();
      await streamHub.closeAll();
    },
    flush: flushNotifications,
    cleanup: [disconnectPrisma, closeShared],
  }),
);
