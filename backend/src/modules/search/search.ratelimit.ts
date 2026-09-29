import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';

/** Rate limit cửa sổ trượt theo khóa (user hoặc IP), lưu trong bộ nhớ. Nhiều instance -> cần Redis. */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    /** true nếu còn trong hạn mức (và ghi nhận lượt này). */
    hit(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
      return true;
    },
  };
}

const limiter = createRateLimiter(env.NODE_ENV === 'test' ? 100_000 : 40, 60_000);

export const searchRateLimit: RequestHandler = (req, _res, next) => {
  if (!limiter.hit(req.userId ?? req.ip ?? 'anon')) return next(HttpError.tooMany('Bạn tìm kiếm quá nhanh, vui lòng thử lại sau'));
  next();
};
