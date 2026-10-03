import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** TOTP theo RFC 6238 (HMAC-SHA1, 6 số, bước 30 giây) — tương thích Google Authenticator / Authy. Chỉ dùng node:crypto. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SEC = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Chuỗi base32 không hợp lệ');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Bí mật 160 bit (20 byte) như khuyến nghị RFC 4226. */
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1]! & 0x0f;
  const bin = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

export const totpCounter = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / TOTP_STEP_SEC);

/** Sinh mã tại thời điểm `nowMs` (dùng trong test). */
export const totpAt = (secret: string, nowMs = Date.now()): string => hotp(secret, totpCounter(nowMs));

/** Trả về counter khớp (chấp nhận lệch ±`window` bước do đồng hồ máy) hoặc null. So sánh thời gian hằng số. */
export function verifyTotp(secret: string, code: string, nowMs = Date.now(), window = 1): number | null {
  const given = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  const base = totpCounter(nowMs);
  let matched: number | null = null;
  for (let d = -window; d <= window; d++) {
    const expect = Buffer.from(hotp(secret, base + d));
    if (timingSafeEqual(expect, Buffer.from(given)) && matched === null) matched = base + d;
  }
  return matched;
}

export function otpauthUrl(account: string, secret: string, issuer = 'SofinHub'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${TOTP_STEP_SEC}`;
}
