import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './db/prisma.js';
import { closeShared } from './infra/shared.js';
import { createScheduler } from './infra/scheduler.js';
import { allJobs } from './jobs.js';
import { gracefulShutdown, installSignalHandlers } from './lifecycle.js';
import { CHATBOT_BASELINE_VERSION, chatbotBaselineVersion } from './modules/chatbot/chatbot.baseline.js';
import { streamHub } from './modules/messages/messages.stream.js';
import { closeNotificationStreams } from './modules/notifications/notifications.routes.js';
import { flushNotifications } from './modules/notifications/notifications.service.js';
import { refreshConfig } from './modules/settings/settings.service.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
});
// Upload video dài: Node mặc định ngắt request nhận quá 300s; nới lên 3 giờ (headersTimeout giữ mặc định để vẫn chống slowloris ở bước header).
server.requestTimeout = 3 * 60 * 60 * 1000;

// Nạp cấu hình nền tảng (Global Settings) ngay khi khởi động; lỗi thì dùng mặc định từ env.
void refreshConfig().catch((e) => console.error('[settings] không nạp được cấu hình:', e));

// Chatbot: dữ liệu nền (câu mẫu + tài liệu) KHÔNG tự nạp — chỉ nhắc nếu chưa chạy lệnh `npm run chatbot:baseline` cho bản hiện tại.
if (env.NODE_ENV !== 'test')
  void chatbotBaselineVersion()
    .then((v) => {
      if (v === null || v < CHATBOT_BASELINE_VERSION)
        console.warn(`[chatbot] chưa nạp dữ liệu nền v${CHATBOT_BASELINE_VERSION} (DB: ${v === null ? 'chưa có' : `v${v}`}) — chạy lệnh: npm run chatbot:baseline (container: node dist/cli/chatbot-baseline.js)`);
    })
    .catch(() => undefined);

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
