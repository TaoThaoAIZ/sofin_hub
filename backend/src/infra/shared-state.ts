import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

/**
 * Trừu tượng "state chia sẻ giữa các instance" (AUDIT §6.5). Hai cài đặt cùng một hợp đồng hành vi:
 *   - memory: trong RAM tiến trình (mặc định cho dev/test — không cần Redis; đúng cho 1 instance).
 *   - redis : ioredis (bật khi có REDIS_URL) — bắt buộc khi chạy NHIỀU instance sau load balancer.
 * Hợp đồng được kiểm bằng tests/shared-state.test.ts (chạy cả hai khi có REDIS_URL).
 *
 * Giá trị luôn là chuỗi (gọi bên JSON.stringify khi cần). TTL tính bằng ms.
 */
export interface KV {
  get(key: string): Promise<string | null>;
  /** Ghi đè; `ttlMs` bỏ trống = không hết hạn. */
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  /** ATOMIC SET NX PX: true nếu khóa chưa tồn tại và đã được tạo (người thắng duy nhất khi nhiều bên đua). */
  setNx(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** ATOMIC lấy-và-xóa (vé dùng 1 lần): chỉ MỘT người gọi nhận được giá trị. */
  getDel(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

export interface PubSub {
  /** Fan-out tới MỌI subscriber của kênh (kể cả ở instance khác; kể cả chính instance này). Fire-and-forget, không bền. */
  publish(channel: string, message: string): Promise<void>;
  /** Trả hàm hủy đăng ký. Lỗi trong handler không ảnh hưởng handler khác. */
  subscribe(channel: string, handler: (message: string) => void): Promise<() => Promise<void>>;
}

export interface RateLimitResult {
  ok: boolean;
  /** Số lượt đã tính trong cửa sổ hiện tại (gồm lượt này). */
  count: number;
  retryAfterSec: number;
}

export interface RateLimiter {
  /** Cửa sổ CỐ ĐỊNH theo khóa: ghi nhận 1 lượt và cho biết còn trong hạn mức `max` / `windowMs` hay không. */
  hit(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
}

export interface Shared {
  kind: 'memory' | 'redis';
  kv: KV;
  pubsub: PubSub;
  rateLimiter: RateLimiter;
  /** Chỉ cho test: xóa mọi khóa của namespace này. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/* ----------------------------------------------------------------------------------------------- memory */

export function createMemoryShared(opts: { now?: () => number } = {}): Shared {
  const now = opts.now ?? Date.now;
  const store = new Map<string, { value: string; exp: number }>(); // exp = Infinity khi không TTL
  const windows = new Map<string, { start: number; count: number }>();
  const handlers = new Map<string, Set<(m: string) => void>>();

  const live = (key: string) => {
    const e = store.get(key);
    if (!e) return undefined;
    if (e.exp <= now()) {
      store.delete(key);
      return undefined;
    }
    return e;
  };
  const sweep = () => {
    if (store.size < 20_000) return;
    for (const k of [...store.keys()]) live(k);
  };

  const kv: KV = {
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, ttlMs) {
      sweep();
      store.set(key, { value, exp: ttlMs ? now() + ttlMs : Infinity });
    },
    async setNx(key, value, ttlMs) {
      if (live(key)) return false;
      sweep();
      store.set(key, { value, exp: now() + ttlMs });
      return true;
    },
    async getDel(key) {
      const e = live(key);
      store.delete(key);
      return e?.value ?? null;
    },
    async del(key) {
      store.delete(key);
    },
  };

  const pubsub: PubSub = {
    async publish(channel, message) {
      for (const fn of [...(handlers.get(channel) ?? [])]) {
        try {
          fn(message);
        } catch (e) {
          console.error('[pubsub] handler lỗi', e instanceof Error ? e.message : e);
        }
      }
    },
    async subscribe(channel, handler) {
      const set = handlers.get(channel) ?? new Set();
      set.add(handler);
      handlers.set(channel, set);
      return async () => {
        set.delete(handler);
        if (set.size === 0) handlers.delete(channel);
      };
    },
  };

  const rateLimiter: RateLimiter = {
    async hit(key, max, windowMs) {
      const t = now();
      let w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        w = { start: t, count: 0 };
        windows.set(key, w);
        if (windows.size > 50_000) for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k);
      }
      w.count++;
      return { ok: w.count <= max, count: w.count, retryAfterSec: Math.max(1, Math.ceil((windowMs - (t - w.start)) / 1000)) };
    },
  };

  return {
    kind: 'memory',
    kv,
    pubsub,
    rateLimiter,
    async reset() {
      store.clear();
      windows.clear();
    },
    async close() {
      handlers.clear();
    },
  };
}

/* ------------------------------------------------------------------------------------------------ redis */

const RATE_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {c, ttl}`;

export function createRedisShared(url: string, opts: { keyPrefix?: string } = {}): Shared {
  const prefix = opts.keyPrefix ?? 'sofinhub:';
  const k = (key: string) => `${prefix}${key}`;
  const instanceId = randomUUID();
  let lastErrLog = 0;
  const onError = (e: Error) => {
    // ioredis tự reconnect; chỉ log thưa để không ngập log khi Redis chết.
    if (Date.now() - lastErrLog > 10_000) {
      lastErrLog = Date.now();
      console.error(`[redis:${instanceId.slice(0, 8)}]`, e.message);
    }
  };
  const mk = () => {
    const c = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2, enableReadyCheck: true });
    c.on('error', onError);
    return c;
  };
  const cmd = mk();
  let sub: Redis | undefined;
  const handlers = new Map<string, Set<(m: string) => void>>();

  const getSub = () => {
    if (sub) return sub;
    sub = mk();
    sub.on('message', (channel: string, message: string) => {
      for (const fn of [...(handlers.get(channel) ?? [])]) {
        try {
          fn(message);
        } catch (e) {
          console.error('[pubsub] handler lỗi', e instanceof Error ? e.message : e);
        }
      }
    });
    // Sau reconnect ioredis tự subscribe lại các kênh đã đăng ký (autoResubscribe mặc định bật).
    return sub;
  };

  const kv: KV = {
    get: (key) => cmd.get(k(key)),
    async set(key, value, ttlMs) {
      if (ttlMs) await cmd.set(k(key), value, 'PX', Math.ceil(ttlMs));
      else await cmd.set(k(key), value);
    },
    async setNx(key, value, ttlMs) {
      return (await cmd.set(k(key), value, 'PX', Math.ceil(ttlMs), 'NX')) === 'OK';
    },
    getDel: (key) => cmd.getdel(k(key)),
    async del(key) {
      await cmd.del(k(key));
    },
  };

  const pubsub: PubSub = {
    async publish(channel, message) {
      await cmd.publish(k(channel), message);
    },
    async subscribe(channel, handler) {
      const ch = k(channel);
      const s = getSub();
      let set = handlers.get(ch);
      if (!set) {
        set = new Set();
        handlers.set(ch, set);
        await s.subscribe(ch);
      }
      set.add(handler);
      return async () => {
        const cur = handlers.get(ch);
        if (!cur) return;
        cur.delete(handler);
        if (cur.size === 0) {
          handlers.delete(ch);
          await s.unsubscribe(ch).catch(() => undefined);
        }
      };
    },
  };

  const rateLimiter: RateLimiter = {
    async hit(key, max, windowMs) {
      const [count, ttl] = (await cmd.eval(RATE_LUA, 1, k(`rl:${key}`), String(windowMs))) as [number, number];
      return { ok: count <= max, count, retryAfterSec: Math.max(1, Math.ceil(ttl / 1000)) };
    },
  };

  return {
    kind: 'redis',
    kv,
    pubsub,
    rateLimiter,
    async reset() {
      let cursor = '0';
      do {
        const [next, keys] = await cmd.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
        cursor = next;
        if (keys.length) await cmd.del(...keys);
      } while (cursor !== '0');
    },
    async close() {
      handlers.clear();
      await Promise.allSettled([cmd.quit(), sub?.quit()]);
      cmd.disconnect();
      sub?.disconnect();
    },
  };
}
