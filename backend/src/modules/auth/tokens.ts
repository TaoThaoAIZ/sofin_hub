import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

/**
 * Access token gắn với PHIÊN (`sid`) và phiên bản tài khoản (`tv` = User.tokenVersion). Chữ ký/hạn chưa đủ để tin:
 * `authenticateAccessToken` còn kiểm tra DB nên thu hồi phiên / đổi tokenVersion / xóa user có hiệu lực ngay.
 */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
  tv: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  /** Mã phiên ổn định qua các lần xoay (rotation) refresh token = Session.id. */
  sid: string;
}

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  ip?: string;
  userAgent?: string;
}

const ACCESS_TTL_SEC = env.ACCESS_TOKEN_TTL_MIN * 60;
const REFRESH_TTL_SEC = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TTL_SEC * 1000;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function signAccessToken(userId: string, sid: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, sid, tv: tokenVersion } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL_SEC,
  });
}

/** Chỉ kiểm CHỮ KÝ + HẠN, không chạm DB. Đừng dùng để xác thực request — dùng `authenticateAccessToken`. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<AccessTokenPayload>;
    return typeof p.sub === 'string' && typeof p.sid === 'string' && typeof p.tv === 'number' ? (p as AccessTokenPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Xác thực đầy đủ access token: chữ ký + hạn, rồi trong DB phiên phải còn hiệu lực (không revokedAt, chưa hết hạn),
 * đúng chủ và `user.tokenVersion === tv`. Truy vấn 1 lần theo PK mỗi request (không cache) nên thu hồi có hiệu lực NGAY.
 * Trả về null nếu sai bất kỳ điều kiện nào (caller trả 401).
 */
export async function authenticateAccessToken(token: string): Promise<{ userId: string; sid: string } | null> {
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { tokenVersion: true } } },
  });
  if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.tokenVersion !== payload.tv) return null;
  return { userId: payload.sub, sid: payload.sid };
}

/**
 * Cấp refresh token. Truyền `sid` cũ khi xoay token để giữ nguyên phiên; bỏ trống = tạo phiên mới.
 * Trả về null nếu `sid` không còn hiệu lực (đã bị thu hồi giữa chừng).
 */
export async function issueRefreshToken(userId: string, meta: SessionMeta = {}, sid?: string): Promise<{ token: string; sid: string } | null> {
  const jti = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_SEC * 1000);
  const refreshTokenHash = sha256(jti);
  let id: string;
  if (sid) {
    const { count } = await prisma.session.updateMany({
      where: { id: sid, userId, revokedAt: null },
      data: {
        refreshTokenHash,
        lastUsedAt: now,
        expiresAt,
        ...(meta.ip ? { ip: meta.ip } : {}),
        ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      },
    });
    if (count === 0) return null;
    id = sid;
  } else {
    id = (await prisma.session.create({ data: { userId, refreshTokenHash, ip: meta.ip, userAgent: meta.userAgent, expiresAt } })).id;
  }
  const token = jwt.sign({ sub: userId, jti, sid: id } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC });
  return { token, sid: id };
}

function verifyRefresh(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    return payload.sid && payload.jti ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Xác thực + vô hiệu ngay (rotation): mỗi refresh token chỉ dùng được một lần. `updateMany` có điều kiện là atomic
 * nên 2 request song song cùng token chỉ 1 request thắng; phiên (sid) được giữ để cấp token kế tiếp.
 */
export async function consumeRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  const payload = verifyRefresh(token);
  if (!payload) return null;
  const { count } = await prisma.session.updateMany({
    where: { id: payload.sid, userId: payload.sub, refreshTokenHash: sha256(payload.jti), revokedAt: null, expiresAt: { gt: new Date() } },
    data: { refreshTokenHash: null },
  });
  return count === 1 ? payload : null;
}

/** Đọc sid của refresh token (cookie) mà không tiêu thụ nó — dự phòng khi request không có access token. */
export async function peekSessionId(token: string | undefined): Promise<string | undefined> {
  if (!token) return undefined;
  const payload = verifyRefresh(token);
  if (!payload) return undefined;
  const s = await prisma.session.findFirst({
    where: { id: payload.sid, userId: payload.sub, refreshTokenHash: sha256(payload.jti), revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return s?.id;
}

export async function listSessions(userId: string): Promise<SessionInfo[]> {
  const rows = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    ip: s.ip ?? undefined,
    userAgent: s.userAgent ?? undefined,
  }));
}

/** Thu hồi 1 phiên: access token và refresh token của phiên đó chết ngay. */
export async function revokeSession(userId: string, sid: string): Promise<boolean> {
  const { count } = await prisma.session.updateMany({
    where: { id: sid, userId, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}

/** Thu hồi mọi phiên trừ `keepSid` (dùng khi đổi mật khẩu). */
export async function revokeOtherSessions(userId: string, keepSid?: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(keepSid ? { id: { not: keepSid } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await revokeOtherSessions(userId);
}
