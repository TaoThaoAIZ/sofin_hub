export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  /** Đường dẫn hồ sơ sofinhub.com/@handle (chữ thường). */
  handle?: string;
  instagram?: string;
  youtube?: string;
  showOnMap: boolean;
  language: 'vi' | 'en';
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  twoFactorEnabled: boolean;
  passwordChangedAt?: string;
  /** Email mới đang chờ xác nhận (đổi email). */
  pendingEmail?: string;
  emailVerified: boolean;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

/** Đăng nhập đúng mật khẩu nhưng tài khoản bật 2FA: chưa có phiên, cần gửi mã 6 số kèm `ticket`. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  ticket: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** Mã giới thiệu đã lưu từ link /gioi-thieu/:code hoặc ?ref=. */
  referralCode?: string;
}

/** Kết quả đăng ký: chưa có phiên, cần nhập mã OTP gửi về email. */
export interface RegistrationPending {
  verificationRequired: true;
  email: string;
  /** false = nhà cung cấp email lỗi, người dùng cần bấm "Gửi lại". */
  emailSent: boolean;
  /** Số giây tới lần gửi lại hợp lệ. */
  resendInSec: number;
}

export type SocialProvider = 'google' | 'facebook';
