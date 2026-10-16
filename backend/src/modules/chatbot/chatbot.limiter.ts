/**
 * Hàng đợi giới hạn số lượt gọi AI chạy song song TRONG 1 TIẾN TRÌNH (dùng chung cho bot Tào + mọi bot cộng đồng, mọi model — kể cả
 * model giả, để test tải đo được). Mỗi lượt Codex là 1 tiến trình `codex exec` (~8-12s, tốn RAM) nên không chạy quá `max` cùng lúc.
 *
 * Nhiều người hỏi cùng lúc (chatbot.md — test 10-50 người): lượt vượt `max` xếp hàng FIFO, được báo vị trí (`onQueued(ahead)`, ahead =
 * số lượt đứng trước trong hàng) mỗi khi hàng dịch lên — widget hiện "Đang có N người hỏi trước bạn". Chờ quá `waitMs` => LlmBusyError
 * (khách nhận câu "nhiều người hỏi cùng lúc"). Câu khớp câu mẫu (qa_direct) không gọi AI nên không đi qua hàng đợi này.
 */
export class LlmBusyError extends Error {
  constructor() {
    super('Chatbot đang bận, vui lòng thử lại sau ít giây');
  }
}

export interface LimiterStats {
  max: number;
  waitMs: number;
  active: number;
  queued: number;
  /** Số lượt chạy song song cao nhất từng thấy (kiểm tra không vượt `max`). */
  maxActiveSeen: number;
  /** Số lượt bị trả về bận vì chờ quá `waitMs`. */
  busyRejected: number;
}

interface Waiter {
  go: () => void;
  notify?: (ahead: number) => void;
}

export function createLimiter(opts: { max: number; waitMs: number }) {
  let { max, waitMs } = opts;
  let active = 0;
  let maxActiveSeen = 0;
  let busyRejected = 0;
  const queue: Waiter[] = [];
  const announce = () => queue.forEach((w, i) => w.notify?.(i));

  async function run<T>(fn: () => Promise<T>, onQueued?: (ahead: number) => void): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve, reject) => {
        const w: Waiter = {
          go: () => {
            clearTimeout(timer);
            resolve();
          },
          ...(onQueued ? { notify: onQueued } : {}),
        };
        const timer = setTimeout(() => {
          const i = queue.indexOf(w);
          if (i >= 0) queue.splice(i, 1);
          busyRejected++;
          announce();
          reject(new LlmBusyError());
        }, waitMs);
        queue.push(w);
        onQueued?.(queue.length - 1);
      });
    }
    active++;
    maxActiveSeen = Math.max(maxActiveSeen, active);
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.go();
      announce();
    }
  }

  return {
    run,
    stats: (): LimiterStats => ({ max, waitMs, active, queued: queue.length, maxActiveSeen, busyRejected }),
    /** Chỉ cho test / script đo tải: đổi giới hạn + xóa số liệu. */
    configure(next: { max?: number; waitMs?: number }) {
      if (next.max) max = next.max;
      if (next.waitMs) waitMs = next.waitMs;
      maxActiveSeen = active;
      busyRejected = 0;
    },
  };
}
