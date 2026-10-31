import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Mã hóa số tài khoản nhận hoa hồng khi lưu DB (AES-256-GCM). Khóa dẫn xuất (HKDF-SHA256) từ PAYOUT_ENC_KEY; chưa đặt thì dùng
 * UPLOAD_SIGNING_SECRET (production bắt buộc đã đặt riêng) để không phải thêm biến mới khi deploy. Đổi khóa = không giải mã được dữ liệu cũ.
 */
const key = () => Buffer.from(hkdfSync('sha256', env.PAYOUT_ENC_KEY ?? env.UPLOAD_SIGNING_SECRET, 'sofinhub', 'referral-payout-account', 32));

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${ct.toString('base64url')}`;
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, ct] = enc.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Dữ liệu mã hóa không hợp lệ');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}
