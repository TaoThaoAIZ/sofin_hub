const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `Vui lòng nhập ${label}`;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Vui lòng nhập email';
  if (!EMAIL_RE.test(value.trim())) return 'Email không hợp lệ';
  return null;
}

/** Mật khẩu đăng nhập: chỉ bắt buộc nhập, không áp quy tắc phức tạp (tài khoản cũ có thể chưa theo chuẩn mới). */
export function validateLoginPassword(value: string): string | null {
  return value ? null : 'Vui lòng nhập mật khẩu';
}

/** Mật khẩu khi đăng ký: khớp quy tắc phía backend (auth.schema.ts). */
export function validateNewPassword(value: string): string | null {
  if (value.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự';
  if (!/[A-Z]/.test(value)) return 'Mật khẩu cần ít nhất 1 chữ in hoa';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Mật khẩu cần ít nhất 1 ký tự đặc biệt';
  return null;
}
