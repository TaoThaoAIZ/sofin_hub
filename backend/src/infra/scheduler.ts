import { withAdvisoryLock, type WithLock } from './leader.js';

export interface Job {
  /** Tên duy nhất — cũng là tên advisory lock (đừng đổi tên tùy tiện khi đang chạy nhiều instance). */
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
}

export type TickOutcome = 'ran' | 'skipped-not-leader' | 'skipped-busy' | 'failed';

/**
 * Lập lịch job nền dưới leader election: mỗi lượt, instance nào giành được advisory lock của job thì chạy, các instance khác bỏ qua
 * lượt đó. Job phải idempotent (đã đúng với claim atomic ở DB) vì lượt kế tiếp có thể do instance khác chạy.
 * Tắt hẳn trong process web-only bằng RUN_SCHEDULERS=0 (xem src/index.ts); chạy riêng bằng `npm run start:worker`.
 */
export function createScheduler(jobs: Job[], opts: { withLock?: WithLock; log?: (msg: string, err?: unknown) => void } = {}) {
  const withLock = opts.withLock ?? withAdvisoryLock;
  const log = opts.log ?? ((msg, err) => console.error(msg, err));
  const timers: NodeJS.Timeout[] = [];
  const running = new Map<string, Promise<TickOutcome>>();
  let stopped = false;

  /** Một lượt của job: chống chồng lượt trong cùng process, rồi giành khóa. Không bao giờ ném lỗi. */
  function tick(name: string): Promise<TickOutcome> {
    const job = jobs.find((j) => j.name === name);
    if (!job) return Promise.reject(new Error(`Không có job ${name}`));
    if (running.has(name)) return Promise.resolve('skipped-busy');
    const p = (async (): Promise<TickOutcome> => {
      try {
        const r = await withLock(job.name, job.run);
        return r.ran ? 'ran' : 'skipped-not-leader';
      } catch (err) {
        log(`[scheduler] job ${job.name} lỗi:`, err);
        return 'failed';
      }
    })().finally(() => running.delete(name));
    running.set(name, p);
    return p;
  }

  return {
    tick,
    start() {
      for (const job of jobs) {
        const t = setInterval(() => void (stopped || tick(job.name)), job.intervalMs);
        t.unref();
        timers.push(t);
      }
    },
    /** Ngừng lập lịch và chờ các lượt đang chạy xong (graceful shutdown). */
    async stop() {
      stopped = true;
      for (const t of timers) clearInterval(t);
      timers.length = 0;
      await Promise.allSettled([...running.values()]);
    },
  };
}
