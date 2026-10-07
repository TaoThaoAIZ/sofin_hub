import i18n from '../../i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : i18n.t('validation.required', { ns: 'auth', label });
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return i18n.t('validation.emailRequired', { ns: 'auth' });
  if (!EMAIL_RE.test(value.trim())) return i18n.t('validation.emailInvalid', { ns: 'auth' });
  return null;
}

/** Mật khẩu đăng nhập: chỉ bắt buộc nhập, không áp quy tắc phức tạp (tài khoản cũ có thể chưa theo chuẩn mới). */
export function validateLoginPassword(value: string): string | null {
  return value ? null : i18n.t('validation.passwordRequired', { ns: 'auth' });
}

/** Mật khẩu khi đăng ký: khớp quy tắc phía backend (auth.schema.ts). */
export function validateNewPassword(value: string): string | null {
  // Gom đủ mọi lỗi (như backend trả về trong fieldErrors) thay vì chỉ lỗi đầu tiên.
  const errs: string[] = [];
  if (value.length < 8) errs.push(i18n.t('validation.passwordMin', { ns: 'auth' }));
  if (!/[A-Z]/.test(value)) errs.push(i18n.t('validation.passwordUpper', { ns: 'auth' }));
  if (!/[^A-Za-z0-9]/.test(value)) errs.push(i18n.t('validation.passwordSpecial', { ns: 'auth' }));
  return errs.length ? errs.join('. ') : null;
}
