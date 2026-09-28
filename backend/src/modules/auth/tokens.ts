import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface AccessTokenPayload {
  sub: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const ACCESS_TTL_SEC = env.ACCESS_TOKEN_TTL_MIN * 60;
const REFRESH_TTL_SEC = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TTL_SEC * 1000;

/** jti (refresh token) còn hiệu lực cho từng user, để có thể thu hồi khi đăng xuất. */
const activeRefreshTokens = new Map<string, Set<string>>();

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function issueRefreshToken(userId: string): string {
  const jti = randomUUID();
  const set = activeRefreshTokens.get(userId) ?? new Set<string>();
  set.add(jti);
  activeRefreshTokens.set(userId, set);
  return jwt.sign({ sub: userId, jti } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC });
}

/** Xác thực + thu hồi ngay (rotation): mỗi refresh token chỉ dùng được một lần. */
export function consumeRefreshToken(token: string): RefreshTokenPayload | null {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    return null;
  }
  const set = activeRefreshTokens.get(payload.sub);
  if (!set?.has(payload.jti)) return null;
  set.delete(payload.jti);
  return payload;
}

export function revokeAllRefreshTokens(userId: string): void {
  activeRefreshTokens.delete(userId);
}
