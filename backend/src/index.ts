import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './db/prisma.js';
import { startEventReminders } from './modules/events/events.reminders.js';
import { startSubscriptionScheduler } from './modules/payments/payments.scheduler.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
});

startEventReminders();
startSubscriptionScheduler();

// ECS/EC2 gửi SIGTERM khi deploy: ngừng nhận request mới rồi thoát êm.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => void disconnectPrisma().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
