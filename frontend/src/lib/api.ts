import i18n from '../i18n';

export const API_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** `error.details` của BE (vd. { fieldErrors: { field: [msg] } } khi VALIDATION_ERROR). */
    public readonly details?: { fieldErrors?: Record<string, string[]>; missing?: unknown[] } & Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Params = object;
type RequestOptions = { signal?: AbortSignal; token?: string; skipAuthRetry?: boolean; headers?: Record<string, string> };

async function parseErrorBody(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string; details?: ApiError['details'] } } | null;
  throw new ApiError(res.status, body?.error?.message ?? i18n.t('api.requestFailed', { ns: 'misc', status: res.status }), body?.error?.code, body?.error?.details);
}

// ---- Giữ phiên đăng nhập giữa các request ----
// AuthContext là nơi duy nhất gọi các hàm dưới đây (xem features/auth/AuthContext.tsx): nó giữ
// module này luôn biết access token hiện tại, và biết cách xin token mới khi token hết hạn.

let currentToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let sessionExpiredHandler: (() => void) | null = null;

/** Đồng bộ access token hiện tại (gọi mỗi khi đăng nhập/đăng ký/refresh/đăng xuất). */
export function setAuthToken(token: string | null) {
  currentToken = token;
}

/**
 * Đăng ký cách module này tự phục hồi khi access token hết hạn giữa phiên:
 * `refresh` xin token mới từ refresh-token cookie, `onSessionExpired` được gọi khi refresh cũng thất bại thật sự.
 */
export function setAuthHandlers(handlers: { refresh: () => Promise<string | null>; onSessionExpired: () => void }) {
  refreshHandler = handlers.refresh;
  sessionExpiredHandler = handlers.onSessionExpired;
}

async function doFetch(method: string, url: string, body: unknown, token: string | null, signal?: AbortSignal, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
  });
}

/** Đọc `exp` (giây) từ JWT mà không kiểm chữ ký; null nếu không phải JWT hợp lệ. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

let refreshing: Promise<string | null> | null = null;
const refreshOnce = () => (refreshing ??= refreshHandler!().finally(() => (refreshing = null)));

async function request<T>(method: string, url: string, body: unknown, opts?: RequestOptions): Promise<T> {
  let token = opts?.token ?? currentToken;
  // Các endpoint "optionalAuth" của BE coi token hết hạn là khách (không trả 401) nên không tự refresh được:
  // để web mở lâu, request sẽ bị hiểu nhầm là chưa tham gia cộng đồng. Làm mới token trước khi gửi nếu sắp/đã hết hạn.
  if (token && refreshHandler && !opts?.skipAuthRetry) {
    const exp = tokenExpiry(token);
    if (exp !== null && exp * 1000 - Date.now() < 10_000) {
      const fresh = await refreshOnce();
      if (fresh) token = fresh;
    }
  }
  let res = await doFetch(method, url, body, token, opts?.signal, opts?.headers);

  // Access token hết hạn giữa phiên (khác lúc mới tải trang): thử xin token mới 1 lần rồi gọi lại
  // đúng request này. Bỏ qua cho chính các endpoint đăng nhập/đăng ký/refresh (`skipAuthRetry`) để
  // không tự gọi lại vô hạn hoặc "sửa hộ" một lỗi sai mật khẩu thành refresh phiên không liên quan.
  if (res.status === 401 && token && refreshHandler && !opts?.skipAuthRetry) {
    const newToken = await refreshOnce();
    if (newToken) {
      res = await doFetch(method, url, body, newToken, opts?.signal, opts?.headers);
    } else {
      sessionExpiredHandler?.();
    }
  }

  if (!res.ok) await parseErrorBody(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, params?: Params, signal?: AbortSignal, opts?: RequestOptions): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {}) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const qs = search.toString();
  return request<T>('GET', `${API_URL}${path}${qs ? `?${qs}` : ''}`, undefined, { ...opts, signal });
}

export const apiPost = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>('POST', `${API_URL}${path}`, body, opts);

export const apiPatch = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>('PATCH', `${API_URL}${path}`, body, opts);

export const apiDelete = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>('DELETE', `${API_URL}${path}`, body, opts);

export const apiPut = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>('PUT', `${API_URL}${path}`, body, opts);

/** Ghép đường dẫn API với base URL đã cấu hình — dùng cho EventSource. */
export const apiUrl = (path: string) => `${API_URL}${path}`;

/**
 * Đổi đường dẫn do BE trả ("/api/files/<key>", "/api/uploads/...") thành URL dùng được trên trình duyệt:
 * nếu VITE_API_URL là URL tuyệt đối (khác origin) thì ghép origin của API, ngược lại giữ nguyên.
 */
export function resolveApiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (/^https?:\/\//i.test(API_URL)) return `${new URL(API_URL).origin}${path}`;
  return path;
}

/** Tải một endpoint trả file (vd. .ics) kèm Bearer rồi cho trình duyệt lưu xuống. */
export async function apiDownload(path: string, filename: string, opts?: RequestOptions): Promise<void> {
  const token = opts?.token ?? currentToken;
  const url = `${API_URL}${path}`;
  let res = await doFetch('GET', url, undefined, token);
  if (res.status === 401 && token && refreshHandler && !opts?.skipAuthRetry) {
    const newToken = await refreshOnce();
    if (newToken) res = await doFetch('GET', url, undefined, newToken);
    else sessionExpiredHandler?.();
  }
  if (!res.ok) await parseErrorBody(res);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
