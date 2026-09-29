import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

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

/** Vé đã dùng (theo nonce) — vé dùng 1 lần; xóa khi quá hạn để không phình bộ nhớ. */
const used = new Map<string, number>();

export function signUploadTicket(input: { key: string; contentType: string; maxSize: number; userId: string; ttlSec?: number }) {
  const exp = Date.now() + (input.ttlSec ?? env.UPLOAD_TICKET_TTL_SEC) * 1000;
  const payload: UploadTicket = { k: input.key, ct: input.contentType, ms: input.maxSize, u: input.userId, exp, n: randomBytes(8).toString('hex') };
  const body = b64(JSON.stringify(payload));
  return { token: `${body}.${b64(sign(body))}`, expiresAt: new Date(exp).toISOString() };
}

export type TicketCheck = { ok: true; ticket: UploadTicket } | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/** Kiểm chữ ký + hạn. KHÔNG đánh dấu đã dùng — gọi `consumeTicket` sau khi mọi ràng buộc khác đã đạt. */
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
  if (used.has(ticket.n)) return { ok: false, reason: 'used' };
  return { ok: true, ticket };
}

export function consumeTicket(ticket: UploadTicket): void {
  const now = Date.now();
  for (const [n, exp] of used) if (exp < now) used.delete(n);
  used.set(ticket.n, ticket.exp);
}
