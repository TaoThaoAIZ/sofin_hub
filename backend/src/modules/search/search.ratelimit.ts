import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { createMemoryShared } from '../../infra/shared-state.js';
import { shared } from '../../infra/shared.js';
import { HttpError } from '../../utils/http-error.js';

/**
 * Rate limit theo khóa (user hoặc IP) trên state chia sẻ (Redis khi có REDIS_URL, nếu không thì RAM). Cửa sổ cố định.
 * `now` chỉ để test: có `now` thì dùng store in-memory riêng với đồng hồ đó. Lỗi store => cho qua (fail-open).
 */
export function createRateLimiter(max: number, windowMs: number, now?: () => number) {
  const own = now ? createMemoryShared({ now }) : undefined;
  return {
    /** true nếu còn trong hạn mức (và ghi nhận lượt này). */
    async hit(key: string): Promise<boolean> {
      try {
        return (await (own ?? shared()).rateLimiter.hit(`search:${key}`, max, windowMs)).ok;
      } catch (e) {
        console.error('[search] rate limiter lỗi, cho qua (fail-open):', e instanceof Error ? e.message : e);
        return true;
      }
    },
  };
}

const limiter = createRateLimiter(env.NODE_ENV === 'test' ? 100_000 : 40, 60_000);

export const searchRateLimit: RequestHandler = async (req, _res, next) => {
  if (!(await limiter.hit(req.userId ?? req.ip ?? 'anon'))) return next(HttpError.tooMany('Bạn tìm kiếm quá nhanh, vui lòng thử lại sau'));
  next();
};
