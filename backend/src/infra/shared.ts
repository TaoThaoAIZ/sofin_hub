import { env } from '../config/env.js';
import { createMemoryShared, createRedisShared, type Shared } from './shared-state.js';

/**
 * Singleton state chia sẻ của tiến trình: Redis nếu có REDIS_URL, ngược lại in-memory.
 * Khởi tạo lười (lần dùng đầu) để import module không mở kết nối.
 */
let instance: Shared | undefined;

export function shared(): Shared {
  if (!instance) {
    instance = env.REDIS_URL ? createRedisShared(env.REDIS_URL, { keyPrefix: env.REDIS_KEY_PREFIX }) : createMemoryShared();
  }
  return instance;
}

/** Đóng kết nối Redis (shutdown / cuối test). An toàn khi gọi nhiều lần. */
export async function closeShared(): Promise<void> {
  const s = instance;
  instance = undefined;
  await s?.close();
}

/** Chỉ cho test: xóa sạch state chia sẻ (ví dụ giữa các test dùng chung Redis). */
export async function resetSharedForTests(): Promise<void> {
  await shared().reset();
}
