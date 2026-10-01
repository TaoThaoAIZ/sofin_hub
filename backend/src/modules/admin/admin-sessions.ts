import { prisma } from '../../db/prisma.js';
import { revokeAllSessions } from '../auth/tokens.js';

/** Tăng tokenVersion + thu hồi mọi phiên: access/refresh token đang có của user chết ngay (cơ chế sid/tv của auth). */
export async function bumpTokenVersionAndRevoke(userId: string): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  await revokeAllSessions(userId);
}
