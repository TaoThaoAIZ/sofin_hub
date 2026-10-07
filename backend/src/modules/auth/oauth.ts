import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';

/**
 * Đăng nhập mạng xã hội bằng OAuth2 authorization-code, chạy hoàn toàn ở backend (không thêm thư viện):
 * /auth/oauth/:provider/start -> trang đồng ý của Google/Facebook -> /auth/oauth/:provider/callback (đổi code lấy hồ sơ, cấp phiên).
 * Chống CSRF bằng `state` (JWT ký, 10 phút) + nonce trùng với cookie httpOnly của trình duyệt đang đăng nhập.
 */
export const SOCIAL_PROVIDERS = ['google', 'facebook'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export interface SocialProfile {
  provider: SocialProvider;
  /** Id người dùng phía nhà cung cấp. */
  id: string;
  email?: string;
  /** Email đã được nhà cung cấp xác minh (điều kiện để liên kết vào tài khoản có sẵn). */
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export const isSocialProvider = (v: string): v is SocialProvider => (SOCIAL_PROVIDERS as readonly string[]).includes(v);

const creds = (p: SocialProvider) =>
  p === 'google' ? { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET } : { id: env.FACEBOOK_APP_ID, secret: env.FACEBOOK_APP_SECRET };

export const socialEnabled = (p: SocialProvider) => Boolean(creds(p).id && creds(p).secret);

export const redirectUri = (p: SocialProvider) => `${env.OAUTH_REDIRECT_BASE.replace(/\/$/, '')}/api/auth/oauth/${p}/callback`;

export const OAUTH_NONCE_COOKIE = 'oauth_nonce';
const STATE_AUDIENCE = 'oauth-state';
const STATE_TTL_SEC = 10 * 60;
export const OAUTH_NONCE_MAX_AGE_MS = STATE_TTL_SEC * 1000;

interface StatePayload {
  p: SocialProvider;
  n: string;
  /** Mã giới thiệu (tùy chọn) mang qua vòng chuyển hướng. */
  ref?: string;
}

/** Tạo `state` + nonce (nonce phải đặt vào cookie của trình duyệt). */
export function createOAuthState(provider: SocialProvider, referralCode?: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('base64url');
  const payload: StatePayload = { p: provider, n: nonce, ...(referralCode ? { ref: referralCode } : {}) };
  return { nonce, state: jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: STATE_TTL_SEC, audience: STATE_AUDIENCE }) };
}

/** Kiểm `state` đúng nhà cung cấp, còn hạn và nonce khớp cookie. Trả mã giới thiệu đi kèm (nếu có) hoặc null nếu không hợp lệ. */
export function verifyOAuthState(state: unknown, nonceCookie: unknown, provider: SocialProvider): { referralCode?: string } | null {
  if (typeof state !== 'string' || typeof nonceCookie !== 'string' || !nonceCookie) return null;
  try {
    const p = jwt.verify(state, env.JWT_ACCESS_SECRET, { audience: STATE_AUDIENCE }) as Partial<StatePayload>;
    if (p.p !== provider || p.n !== nonceCookie) return null;
    return { referralCode: typeof p.ref === 'string' ? p.ref : undefined };
  } catch {
    return null;
  }
}

export function buildAuthUrl(provider: SocialProvider, state: string): string {
  const { id } = creds(provider);
  if (provider === 'google') {
    const q = new URLSearchParams({
      client_id: id!,
      redirect_uri: redirectUri(provider),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({ client_id: id!, redirect_uri: redirectUri(provider), response_type: 'code', scope: 'email,public_profile', state });
  return `https://www.facebook.com/v21.0/dialog/oauth?${q}`;
}

const TIMEOUT_MS = 10_000;

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !body) throw HttpError.coded(502, 'OAUTH_PROVIDER_ERROR', 'Nhà cung cấp đăng nhập không phản hồi hợp lệ');
  return body;
}

/** Đổi `code` lấy hồ sơ người dùng. Ném HttpError 502 khi nhà cung cấp lỗi / code sai. */
export async function fetchSocialProfile(provider: SocialProvider, code: string): Promise<SocialProfile> {
  const { id, secret } = creds(provider);
  if (provider === 'google') {
    const token = await getJson<{ access_token?: string }>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: id!, client_secret: secret!, redirect_uri: redirectUri(provider), grant_type: 'authorization_code' }),
    });
    if (!token.access_token) throw HttpError.coded(502, 'OAUTH_PROVIDER_ERROR', 'Không lấy được thông tin từ Google');
    const u = await getJson<{ sub?: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string; name?: string; picture?: string }>(
      'https://openidconnect.googleapis.com/v1/userinfo',
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    if (!u.sub) throw HttpError.coded(502, 'OAUTH_PROVIDER_ERROR', 'Không lấy được thông tin từ Google');
    const [first, ...rest] = (u.name ?? '').split(' ');
    return {
      provider,
      id: u.sub,
      email: u.email,
      emailVerified: u.email_verified === true,
      firstName: u.given_name ?? first ?? '',
      lastName: u.family_name ?? rest.join(' '),
      avatarUrl: u.picture,
    };
  }
  const token = await getJson<{ access_token?: string }>(
    `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({ client_id: id!, client_secret: secret!, redirect_uri: redirectUri(provider), code })}`,
  );
  if (!token.access_token) throw HttpError.coded(502, 'OAUTH_PROVIDER_ERROR', 'Không lấy được thông tin từ Facebook');
  const u = await getJson<{ id?: string; email?: string; first_name?: string; last_name?: string; name?: string; picture?: { data?: { url?: string; is_silhouette?: boolean } } }>(
    `https://graph.facebook.com/me?${new URLSearchParams({ fields: 'id,first_name,last_name,name,email,picture.type(large)', access_token: token.access_token })}`,
  );
  if (!u.id) throw HttpError.coded(502, 'OAUTH_PROVIDER_ERROR', 'Không lấy được thông tin từ Facebook');
  const [first, ...rest] = (u.name ?? '').split(' ');
  return {
    provider,
    id: u.id,
    email: u.email,
    // Facebook chỉ trả email đã được xác nhận trên tài khoản FB.
    emailVerified: Boolean(u.email),
    firstName: u.first_name ?? first ?? '',
    lastName: u.last_name ?? rest.join(' '),
    avatarUrl: u.picture?.data && !u.picture.data.is_silhouette ? u.picture.data.url : undefined,
  };
}
