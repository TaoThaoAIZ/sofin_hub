import type { Server } from 'node:http';

export interface ShutdownSteps {
  /** HTTP server (có thể vắng ở worker). */
  server?: Server;
  /** Dừng nhận việc mới ở các nơi khác (scheduler...). Chạy đầu tiên; được chờ tối đa `stepTimeoutMs`. */
  stopWork?: () => Promise<unknown>;
  /** Đóng mọi luồng SSE (streamHub.closeAll, luồng thông báo). Không có bước này thì server.close() treo vì SSE không tự đóng. */
  closeStreams?: () => Promise<unknown> | unknown;
  /** Chờ ghi nền xong (flushNotifications). Chạy SAU khi request đang bay đã xong. */
  flush?: () => Promise<unknown>;
  /** Giải phóng tài nguyên cuối cùng (Prisma, Redis...). */
  cleanup?: Array<() => Promise<unknown>>;
  /** Trần thời gian cho mỗi bước chờ (mặc định 5s). */
  stepTimeoutMs?: number;
  log?: (msg: string) => void;
}

const withTimeout = async <T>(p: Promise<T> | T, ms: number, label: string, log: (m: string) => void) => {
  let t: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.resolve(p),
      new Promise<void>((r) => {
        t = setTimeout(() => {
          log(`[shutdown] ${label} quá ${ms}ms, bỏ qua`);
          r();
        }, ms);
      }),
    ]);
  } catch (e) {
    log(`[shutdown] ${label} lỗi: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(t);
  }
};

/**
 * Tắt êm (SIGTERM khi deploy): dừng scheduler -> đóng SSE -> ngừng nhận kết nối mới và chờ request đang bay -> flush thông báo
 * -> đóng DB/Redis. Không có timer "giết cứng" vô điều kiện: nếu mọi bước xong sớm thì thoát ngay (thường < 1s dù còn SSE mở).
 * Trần thời gian từng bước chỉ để một bước kẹt không giữ process mãi.
 */
export async function gracefulShutdown(steps: ShutdownSteps): Promise<void> {
  const log = steps.log ?? ((m: string) => console.log(m));
  const ms = steps.stepTimeoutMs ?? 5_000;
  if (steps.stopWork) await withTimeout(steps.stopWork(), ms, 'dừng scheduler', log);
  if (steps.closeStreams) await withTimeout(steps.closeStreams(), ms, 'đóng SSE', log);
  const { server } = steps;
  if (server?.listening) {
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    // Kết nối keep-alive nhàn rỗi (kể cả SSE vừa end) phải được đóng liên tục: một lần gọi duy nhất sẽ bỏ sót socket vừa hết bận.
    const sweep = setInterval(() => server.closeIdleConnections?.(), 25);
    server.closeIdleConnections?.();
    // Request đang bay có `ms` để xong; quá hạn thì cắt các kết nối còn lại.
    await withTimeout(closed, ms, 'chờ request đang xử lý', log).finally(() => clearInterval(sweep));
    server.closeAllConnections?.();
  }
  if (steps.flush) await withTimeout(steps.flush(), ms, 'flush ghi nền', log);
  for (const fn of steps.cleanup ?? []) await withTimeout(fn(), ms, 'dọn tài nguyên', log);
}

/** Gắn SIGTERM/SIGINT -> gracefulShutdown -> exit(0). Watchdog chỉ là lưới an toàn cuối cùng (đã unref + hủy khi thoát). */
export function installSignalHandlers(run: () => Promise<void>, watchdogMs = 30_000): void {
  let started = false;
  const handler = (signal: string) => {
    if (started) return;
    started = true;
    console.log(`${signal} received, shutting down`);
    setTimeout(() => process.exit(1), watchdogMs).unref();
    run()
      .then(() => process.exit(0))
      .catch((e) => {
        console.error('[shutdown] lỗi', e);
        process.exit(1);
      });
  };
  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGINT', () => handler('SIGINT'));
}
