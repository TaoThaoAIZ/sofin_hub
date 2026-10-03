export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  createdAt: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  /** Đường dẫn hồ sơ sofinhub.com/@handle (chữ thường, duy nhất). */
  handle?: string;
  instagram?: string;
  youtube?: string;
  /** Hiện vị trí trên bản đồ thành viên (mặc định true). */
  showOnMap?: boolean;
  /** Tùy chọn cá nhân: chỉ lưu, FE chưa có i18n/dark mode. */
  language?: string;
  timezone?: string;
  theme?: string;
  /** Bí mật TOTP base32. KHÔNG bao giờ trả ra client. */
  totpSecret?: string;
  twoFactorEnabled?: boolean;
  passwordChangedAt?: string;
  /** Email mới đang chờ xác minh (đổi email). */
  pendingEmail?: string;
  emailVerified?: boolean;
  /** Tăng khi cần vô hiệu mọi access token đã cấp (reset mật khẩu, logout-all...). Không bao giờ trả ra client. */
  tokenVersion?: number;
  /** Thành viên minh họa của seed: không đăng nhập được, không trả ra client. */
  isDemo?: boolean;
  /** Có giá trị = tài khoản đã xóa (ẩn danh hóa): không đăng nhập/làm mới phiên được, hồ sơ công khai 404. */
  deletedAt?: string;
}

/** Dữ liệu người dùng an toàn để trả về client (không có passwordHash). */
export type AuthUser = Omit<
  User,
  'passwordHash' | 'emailVerified' | 'tokenVersion' | 'isDemo' | 'deletedAt' | 'totpSecret' | 'showOnMap' | 'language' | 'timezone' | 'theme' | 'twoFactorEnabled'
> & { emailVerified: boolean; showOnMap: boolean; language: string; timezone: string; theme: string; twoFactorEnabled: boolean };

export function toAuthUser(user: User): AuthUser {
  const { passwordHash: _passwordHash, emailVerified, tokenVersion: _tv, isDemo: _demo, deletedAt: _deleted, totpSecret: _totp, ...rest } = user;
  return {
    ...rest,
    emailVerified: emailVerified ?? false,
    showOnMap: user.showOnMap ?? true,
    language: user.language ?? 'vi',
    timezone: user.timezone ?? 'Asia/Ho_Chi_Minh',
    theme: user.theme ?? 'light',
    twoFactorEnabled: user.twoFactorEnabled ?? false,
  };
}
