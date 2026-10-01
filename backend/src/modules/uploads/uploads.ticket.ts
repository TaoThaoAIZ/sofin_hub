import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { shared } from '../../infra/shared.js';

/** Nội dung vé PUT: ràng buộc key + contentType + maxSize + người sở hữu + hạn dùng. */
export interface UploadTicket {
  k: string;
  ct: string;
  ms: number;
  u: string;
  exp: number;
  n: string;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (payload: string) => createHmac('sha256', env.UPLOAD_SIGNING_SECRET).update(payload).digest();

const USED_PREFIX = 'upload:nonce:';

export function signUploadTicket(input: { key: string; contentType: string; maxSize: number; userId: string; ttlSec?: number }) {
  const exp = Date.now() + (input.ttlSec ?? env.UPLOAD_TICKET_TTL_SEC) * 1000;
  const payload: UploadTicket = { k: input.key, ct: input.contentType, ms: input.maxSize, u: input.userId, exp, n: randomBytes(8).toString('hex') };
  const body = b64(JSON.stringify(payload));
  return { token: `${body}.${b64(sign(body))}`, expiresAt: new Date(exp).toISOString() };
}

export type TicketCheck = { ok: true; ticket: UploadTicket } | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/** Kiểm chữ ký + hạn (thuần, đồng bộ). KHÔNG đụng tới replay — gọi `consumeTicket` (atomic) sau khi mọi ràng buộc khác đã đạt. */
export function verifyUploadTicket(token: string): TicketCheck {
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { ok: false, reason: 'invalid' };
  const given = Buffer.from(mac, 'base64url');
  const expected = sign(body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'invalid' };
  let ticket: UploadTicket;
  try {
    ticket = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UploadTicket;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof ticket.exp !== 'number' || ticket.exp < Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, ticket };
}

/** Kiểm tra nhanh (không đánh dấu) vé đã bị dùng chưa — để phát lại trả 401 "đã dùng" thay vì lỗi khác. Chốt chặn thật là `consumeTicket`. */
export async function isTicketUsed(ticket: UploadTicket): Promise<boolean> {
  return (await shared().kv.get(USED_PREFIX + ticket.n)) !== null;
}

/**
 * Đánh dấu vé đã dùng bằng SET NX PX (atomic, chia sẻ giữa các instance, sống sót khi restart nếu có Redis).
 * Trả true nếu CHÍNH lần gọi này là lần dùng đầu tiên; false = đã bị dùng (replay / hai PUT đua nhau — chỉ một bên thắng).
 * Lỗi store => ném lỗi (fail-closed: thà từ chối upload còn hơn mở cửa replay).
 */
export async function consumeTicket(ticket: UploadTicket): Promise<boolean> {
  const ttlMs = Math.max(1_000, ticket.exp - Date.now() + 1_000);
  return shared().kv.setNx(USED_PREFIX + ticket.n, '1', ttlMs);
}
