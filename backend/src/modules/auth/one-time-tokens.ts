import { createHash, randomBytes } from 'node:crypto';
import { oneTimePurposeFromDomain, oneTimePurposeToDomain } from '../../db/enums.js';
import { prisma } from '../../db/prisma.js';

export type OneTimePurpose = 'reset-password' | 'verify-email';

/** Chỉ lưu BẢN BĂM sha256 của token (như mật khẩu): lộ kho dữ liệu cũng không dùng lại được token. Bảng OneTimeToken. */
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Tạo token ngẫu nhiên 32 byte; token cũ cùng mục đích của user đó bị ghi đè (unique userId+purpose). Trả về token thô (chỉ để đưa vào email). */
export async function issueOneTimeToken(userId: string, purpose: OneTimePurpose, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const data = { tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs), createdAt: new Date() };
  const p = oneTimePurposeFromDomain(purpose);
  await prisma.oneTimeToken.upsert({
    where: { userId_purpose: { userId, purpose: p } },
    create: { userId, purpose: p, ...data },
    update: data,
  });
  return token;
}

/** Dùng 1 lần: trả về userId nếu hợp lệ rồi xóa ngay (xóa là atomic nên 2 request song song chỉ 1 request thắng). */
export async function consumeOneTimeToken(token: string, purpose: OneTimePurpose): Promise<string | null> {
  let row;
  try {
    row = await prisma.oneTimeToken.delete({ where: { tokenHash: sha256(token) } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025') return null;
    throw e;
  }
  if (oneTimePurposeToDomain(row.purpose) !== purpose || row.expiresAt.getTime() < Date.now()) return null;
  return row.userId;
}

export async function purgeOneTimeTokens(userId: string): Promise<void> {
  await prisma.oneTimeToken.deleteMany({ where: { userId } });
}

/** Số ms kể từ lúc phát hành token hiện hành (null nếu không có) — dùng làm cooldown gửi lại email xác thực. */
export async function oneTimeTokenAgeMs(userId: string, purpose: OneTimePurpose): Promise<number | null> {
  const row = await prisma.oneTimeToken.findUnique({
    where: { userId_purpose: { userId, purpose: oneTimePurposeFromDomain(purpose) } },
    select: { createdAt: true },
  });
  return row ? Date.now() - row.createdAt.getTime() : null;
}
