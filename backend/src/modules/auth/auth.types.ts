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
  emailVerified?: boolean;
  /** Tăng khi cần vô hiệu mọi access token đã cấp (reset mật khẩu, logout-all...). Không bao giờ trả ra client. */
  tokenVersion?: number;
  /** Thành viên minh họa của seed: không đăng nhập được, không trả ra client. */
  isDemo?: boolean;
  /** Có giá trị = tài khoản đã xóa (ẩn danh hóa): không đăng nhập/làm mới phiên được, hồ sơ công khai 404. */
  deletedAt?: string;
}

/** Dữ liệu người dùng an toàn để trả về client (không có passwordHash). */
export type AuthUser = Omit<User, 'passwordHash' | 'emailVerified' | 'tokenVersion' | 'isDemo' | 'deletedAt'> & { emailVerified: boolean };

export function toAuthUser(user: User): AuthUser {
  const { passwordHash: _passwordHash, emailVerified, tokenVersion: _tv, isDemo: _demo, deletedAt: _deleted, ...rest } = user;
  return { ...rest, emailVerified: emailVerified ?? false };
}
