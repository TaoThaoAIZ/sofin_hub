import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthSession } from './auth.service.js';

/**
 * Đăng nhập Google cho app mobile: dùng chính luồng OAuth ở server (oauth.ts) nhưng mở bằng trình duyệt hệ thống,
 * xong thì chuyển về deep link `sofinhub://oauth#code=...`. Phiên KHÔNG đi qua URL: URL chỉ mang mã đổi một lần (60 giây),
 * ràng buộc bằng PKCE (app gửi sha256(verifier) lúc bắt đầu, gửi verifier lúc đổi) nên app khác chặn được deep link cũng không đổi được.
 * Lưu trong bộ nhớ tiến trình: đủ cho 1 instance backend; nhiều instance cần chuyển sang Redis/DB.
 */
export const MOBILE_REDIRECT = 'sofinhub://oauth';
const TTL_MS = 60_000;
const MAX_PENDING = 5_000;

/** Challenge hợp lệ = base64url của sha256 (43 ký tự). */
export const isMobileChallenge = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);

const pending = new Map<string, { session: AuthSession; challenge: string; exp: number }>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.exp < now) pending.delete(k);
}

export function putMobileSession(session: AuthSession, challenge: string): string {
  sweep();
  if (pending.size >= MAX_PENDING) pending.clear();
  const code = randomBytes(24).toString('base64url');
  pending.set(code, { session, challenge, exp: Date.now() + TTL_MS });
  return code;
}

/** Dùng 1 lần: sai verifier cũng xóa mã luôn (không cho thử lại). */
export function takeMobileSession(code: string, verifier: string): AuthSession | null {
  const row = pending.get(code);
  pending.delete(code);
  if (!row || row.exp < Date.now()) return null;
  const expected = Buffer.from(row.challenge);
  const actual = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? row.session : null;
}
