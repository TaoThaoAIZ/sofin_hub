const API_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Params = object;
type RequestOptions = { signal?: AbortSignal; token?: string; skipAuthRetry?: boolean };

async function parseErrorBody(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
  throw new ApiError(res.status, body?.error?.message ?? `Yêu cầu thất bại (${res.status})`, body?.error?.code);
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

async function doFetch(method: string, url: string, body: unknown, token: string | null, signal?: AbortSignal) {
  const headers: Record<string, string> = {};
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

async function request<T>(method: string, url: string, body: unknown, opts?: RequestOptions): Promise<T> {
  const token = opts?.token ?? currentToken;
  let res = await doFetch(method, url, body, token, opts?.signal);

  // Access token hết hạn giữa phiên (khác lúc mới tải trang): thử xin token mới 1 lần rồi gọi lại
  // đúng request này. Bỏ qua cho chính các endpoint đăng nhập/đăng ký/refresh (`skipAuthRetry`) để
  // không tự gọi lại vô hạn hoặc "sửa hộ" một lỗi sai mật khẩu thành refresh phiên không liên quan.
  if (res.status === 401 && token && refreshHandler && !opts?.skipAuthRetry) {
    const newToken = await refreshHandler();
    if (newToken) {
      res = await doFetch(method, url, body, newToken, opts?.signal);
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
