import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { shared } from '../../infra/shared.js';
import { HttpError } from '../../utils/http-error.js';
import { TOTP_STEP_SEC, verifyTotp } from './totp.js';

/** Vé đăng nhập bước 2: ký JWT ngắn hạn (5 phút), mang `typ: '2fa'` và KHÔNG có `sid`/`tv` nên không dùng làm access token được. */
const TICKET_TTL_SEC = 5 * 60;
const ATTEMPT_MAX = 8;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

export function signTwoFactorTicket(userId: string): string {
  return jwt.sign({ sub: userId, typ: '2fa' }, env.JWT_ACCESS_SECRET, { expiresIn: TICKET_TTL_SEC });
}

export function verifyTwoFactorTicket(ticket: string): string | null {
  try {
    const p = jwt.verify(ticket, env.JWT_ACCESS_SECRET) as { sub?: unknown; typ?: unknown };
    return p.typ === '2fa' && typeof p.sub === 'string' ? p.sub : null;
  } catch {
    return null;
  }
}

/**
 * Kiểm mã TOTP của `userId`: giới hạn số lần thử (429), chặn dùng lại cùng một mã trong cửa sổ hiệu lực (chống replay,
 * fail-closed). Trả true nếu đúng. Lỗi store giới hạn thử => bỏ qua (fail-open) theo quy ước CONVENTIONS.
 */
export async function checkTotpCode(userId: string, secret: string, code: string): Promise<boolean> {
  let limited = false;
  try {
    const r = await shared().rateLimiter.hit(`2fa:${userId}`, ATTEMPT_MAX, ATTEMPT_WINDOW_MS);
    limited = !r.ok;
  } catch {
    /* fail-open */
  }
  if (limited) throw HttpError.tooMany('Bạn nhập sai mã quá nhiều lần, vui lòng thử lại sau ít phút');
  const counter = verifyTotp(secret, code);
  if (counter === null) return false;
  // Mỗi (user, counter) chỉ dùng được 1 lần; 3 bước đủ phủ cửa sổ ±1.
  return shared().kv.setNx(`2fa-used:${userId}:${counter}`, '1', TOTP_STEP_SEC * 3 * 1000);
}
