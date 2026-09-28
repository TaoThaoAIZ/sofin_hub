import { createApp } from './app.js';
import { env } from './config/env.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
});

// ECS/EC2 gửi SIGTERM khi deploy: ngừng nhận request mới rồi thoát êm.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
