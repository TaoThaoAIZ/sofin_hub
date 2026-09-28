import { apiPost } from '../../lib/api';
import type { AuthSession, LoginInput, RegisterInput } from './types';

export const register = (input: RegisterInput) =>
  apiPost<{ data: AuthSession }>('/auth/register', input).then((r) => r.data);

// skipAuthRetry: sai mật khẩu cũng trả 401 — không phải access token hết hạn, đừng tự refresh phiên khác rồi thử lại.
export const login = (input: LoginInput) =>
  apiPost<{ data: AuthSession }>('/auth/login', input, { skipAuthRetry: true }).then((r) => r.data);

let inFlightRefresh: Promise<AuthSession> | null = null;

/**
 * Dùng refresh token (cookie httpOnly, single-use/rotating) để lấy access token mới.
 * Gộp các lệnh gọi trùng lặp trong cùng thời điểm (vd. React StrictMode chạy effect 2 lần ở dev,
 * hoặc lúc `lib/api.ts` tự refresh giữa phiên) thành một request duy nhất, tránh request thứ hai
 * bị 401 vì token đã bị request đầu tiêu thụ.
 * skipAuthRetry: đây chính là request refresh — không được để nó tự gọi lại chính nó khi 401.
 */
export const refresh = (): Promise<AuthSession> => {
  if (!inFlightRefresh) {
    inFlightRefresh = apiPost<{ data: AuthSession }>('/auth/refresh', undefined, { skipAuthRetry: true })
      .then((r) => r.data)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
};

export const logout = (accessToken: string) => apiPost<void>('/auth/logout', undefined, { token: accessToken });
