import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { getRole, isPlatformAdmin } from '../permissions/policy.js';
import { FILE_URL_PREFIX, isPublicPurpose, type UploadRecord } from './uploads.types.js';

/** Hạn sống của URL ký cho file riêng tư (giây). Đủ để <img>/<a> tải xong; muốn xem lại thì xin URL mới. */
export const FILE_URL_TTL_SEC = 300;

const mac = (key: string, userId: string, exp: number) =>
  createHmac('sha256', env.UPLOAD_SIGNING_SECRET).update(`file|${key}|${userId}|${exp}`).digest('base64url');

/** URL ký hạn ngắn cho 1 file riêng tư, gắn với userId xin URL (quyền được kiểm lại ở mỗi lần GET). */
export function signFileUrl(key: string, userId: string, ttlSec = FILE_URL_TTL_SEC) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return { url: `${FILE_URL_PREFIX}${key}?u=${encodeURIComponent(userId)}&exp=${exp}&sig=${mac(key, userId, exp)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

/** Trả về userId nếu chữ ký hợp lệ và chưa hết hạn, ngược lại undefined. */
export function verifyFileUrl(key: string, q: { u?: unknown; exp?: unknown; sig?: unknown }): string | undefined {
  if (typeof q.u !== 'string' || typeof q.exp !== 'string' || typeof q.sig !== 'string') return undefined;
  const exp = Number(q.exp);
  if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return undefined;
  const expected = Buffer.from(mac(key, q.u, exp));
  const given = Buffer.from(q.sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? q.u : undefined;
}

/** file nằm trong tin nhắn CÒN SỐNG (chưa thu hồi) của cuộc trò chuyện mà user là 1 trong 2 người. */
async function inLiveMessageOf(userId: string, key: string): Promise<boolean> {
  const m = await prisma.message.findFirst({
    where: {
      deletedAt: null,
      attachments: { array_contains: [{ url: `${FILE_URL_PREFIX}${key}` }] },
      conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
    },
    select: { id: true },
  });
  return !!m;
}

/** Còn tin nhắn sống nào (của bất kỳ ai) tham chiếu file này không. */
export async function isReferencedByLiveMessage(key: string): Promise<boolean> {
  const m = await prisma.message.findFirst({
    where: { deletedAt: null, attachments: { array_contains: [{ url: `${FILE_URL_PREFIX}${key}` }] } },
    select: { id: true },
  });
  return !!m;
}

/**
 * Ai được xem file riêng tư?
 *  - chủ file (người upload) và Platform Admin: luôn được;
 *  - message_attachment: 2 người của cuộc trò chuyện chứa tin nhắn còn sống (thu hồi -> hết quyền);
 *  - lesson_attachment: thành viên của khóa học gắn với file;
 *  - post_file: thành viên của ít nhất một cộng đồng mà chủ file cũng là thành viên.
 */
export async function canReadPrivateFile(userId: string, rec: UploadRecord): Promise<boolean> {
  if (isPublicPurpose(rec.purpose)) return true;
  if (rec.ownerId === userId) return true;
  if (await isPlatformAdmin(userId)) return true;
  switch (rec.purpose) {
    case 'message_attachment':
      return inLiveMessageOf(userId, rec.key);
    case 'lesson_attachment':
      return !!rec.communityId && (await getRole(userId, rec.communityId)) !== null;
    case 'post_file': {
      const [mine, theirs] = await Promise.all([enrollmentService.listByUser(userId), enrollmentService.listByUser(rec.ownerId)]);
      const set = new Set(theirs.map((m) => m.communityId));
      return mine.some((m) => set.has(m.communityId));
    }
    default:
      return false;
  }
}
