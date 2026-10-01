import type { RequestHandler } from 'express';
import { shared } from '../infra/shared.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Rate limit TOÀN CỤC + theo nhóm endpoint ghi (đăng bài, bình luận, like, RSVP...). Cửa sổ cố định theo khóa (user nếu đã đăng nhập, ngược
 * lại IP). Bộ đếm nằm ở state chia sẻ (infra/shared): Redis khi có REDIS_URL (hạn mức chung cho mọi instance), nếu không thì trong RAM
 * tiến trình (đúng cho 1 instance). Lỗi store => FAIL-OPEN (cho qua + log) để Redis chết không làm sập cả API.
 *
 * Cấu hình bằng biến môi trường (đọc 1 lần khi nạp module; test chỉnh trực tiếp `rateLimitSettings`):
 *   RATE_LIMIT_DISABLED=1          tắt hoàn toàn (mặc định tắt khi NODE_ENV=test)
 *   RATE_LIMIT_GLOBAL_PER_MIN      mọi request /api theo IP (mặc định 1200)
 *   RATE_LIMIT_WRITE_PER_MIN       hạn mức mặc định cho 1 nhóm ghi theo user (mặc định 60); từng nhóm có mặc định riêng bên dưới
 */
const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return process.env[name] !== undefined && process.env[name] !== '' && Number.isFinite(v) && v > 0 ? v : fallback;
};

export const rateLimitSettings = {
  enabled: process.env.NODE_ENV !== 'test' && process.env.RATE_LIMIT_DISABLED !== '1',
  windowMs: 60_000,
  globalMax: num('RATE_LIMIT_GLOBAL_PER_MIN', 1200),
  /** Ghi đè hạn mức theo nhóm (test): { posts: 2 }. */
  bucketMax: {} as Record<string, number>,
};

/** Hạn mức mặc định theo nhóm endpoint ghi (mỗi phút, mỗi user). */
export const WRITE_LIMITS = {
  posts: 10,
  comments: 30,
  likes: 60,
  rsvp: 30,
  votes: 60,
  general: num('RATE_LIMIT_WRITE_PER_MIN', 60),
} as const;
export type WriteBucket = keyof typeof WRITE_LIMITS;

/** true nếu còn trong hạn mức (và ghi nhận lượt này). Lỗi store => cho qua (fail-open). */
export async function rateLimitHit(key: string, max: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  try {
    const r = await shared().rateLimiter.hit(key, max, rateLimitSettings.windowMs);
    return { ok: r.ok, retryAfterSec: r.ok ? 0 : r.retryAfterSec };
  } catch (e) {
    console.error('[rate-limit] store lỗi, cho qua (fail-open):', e instanceof Error ? e.message : e);
    return { ok: true, retryAfterSec: 0 };
  }
}

export const resetRateLimitsForTests = () => shared().reset();

/** Giới hạn toàn cục theo IP. Bỏ qua file tĩnh và webhook của cổng thanh toán (nguồn tin cậy, chữ ký riêng). */
export const globalRateLimit: RequestHandler = async (req, res, next) => {
  if (!rateLimitSettings.enabled) return next();
  if (req.path.startsWith('/files/') || req.path === '/payments/webhook') return next();
  const r = await rateLimitHit(`g:${req.ip ?? 'anon'}`, rateLimitSettings.globalMax);
  if (r.ok) return next();
  res.setHeader('Retry-After', String(r.retryAfterSec));
  next(HttpError.tooMany());
};

/** Giới hạn endpoint ghi theo nhóm + user (đặt SAU requireAuth). */
export const writeRateLimit =
  (bucket: WriteBucket): RequestHandler =>
  async (req, res, next) => {
    if (!rateLimitSettings.enabled) return next();
    const max = rateLimitSettings.bucketMax[bucket] ?? WRITE_LIMITS[bucket];
    const r = await rateLimitHit(`w:${bucket}:${req.userId ?? req.ip ?? 'anon'}`, max);
    if (r.ok) return next();
    res.setHeader('Retry-After', String(r.retryAfterSec));
    next(HttpError.tooMany('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'));
  };
