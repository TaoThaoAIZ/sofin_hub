import { API_URL, apiPost } from '../../lib/api';
import type { AuthSession, AuthUser, LoginInput, RegisterInput, RegistrationPending, SocialProvider, TwoFactorChallenge } from './types';

// Đăng ký KHÔNG cấp phiên: server gửi OTP về email, hoàn tất bằng verifyRegistration.
export const register = (input: RegisterInput) =>
  apiPost<{ data: RegistrationPending }>('/auth/register', input, { skipAuthRetry: true }).then((r) => r.data);

export const verifyRegistration = (email: string, code: string, referralCode?: string) =>
  apiPost<{ data: AuthSession }>('/auth/register/verify', { email, code, referralCode }, { skipAuthRetry: true }).then((r) => r.data);

export const resendRegistrationOtp = (email: string) =>
  apiPost<{ data: RegistrationPending }>('/auth/register/resend', { email }, { skipAuthRetry: true }).then((r) => r.data);

/** URL bắt đầu đăng nhập Google/Facebook (trình duyệt điều hướng thẳng tới backend, không phải fetch). */
export const socialStartUrl = (provider: SocialProvider, referralCode?: string) =>
  `${API_URL}/auth/oauth/${provider}/start${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`;

// skipAuthRetry: sai mật khẩu cũng trả 401 — không phải access token hết hạn, đừng tự refresh phiên khác rồi thử lại.
export const login = (input: LoginInput) =>
  apiPost<{ data: AuthSession | TwoFactorChallenge }>('/auth/login', input, { skipAuthRetry: true }).then((r) => r.data);

// Bước 2 khi bật 2FA: vé từ bước 1 + mã 6 số của ứng dụng xác thực.
export const loginTwoFactor = (ticket: string, code: string) =>
  apiPost<{ data: AuthSession }>('/auth/login/2fa', { ticket, code }, { skipAuthRetry: true }).then((r) => r.data);

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

// ---- Quên/đặt lại mật khẩu, xác thực email (không cần đăng nhập, trừ send-verification) ----
export const forgotPassword = (email: string) =>
  apiPost<{ data: { message: string } }>('/auth/forgot-password', { email }, { skipAuthRetry: true }).then((r) => r.data);

export const resetPassword = (token: string, password: string) =>
  apiPost<{ data: { message: string } }>('/auth/reset-password', { token, password }, { skipAuthRetry: true }).then((r) => r.data);

export const verifyEmail = (token: string) =>
  apiPost<{ data: AuthUser }>('/auth/verify-email', { token }, { skipAuthRetry: true }).then((r) => r.data);

export const sendVerification = () => apiPost<{ data: { message: string } }>('/auth/send-verification').then((r) => r.data);
