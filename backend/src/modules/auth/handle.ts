/** Đường dẫn hồ sơ sofinhub.com/@handle: 3-24 ký tự [a-z0-9._], không phân biệt hoa thường (luôn lưu chữ thường). */
export const HANDLE_RE = /^[a-z0-9._]{3,24}$/;

/** Tên giữ chỗ: trùng route/thương hiệu hoặc dễ mạo danh. */
export const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'sofinhub',
  'sofin',
  'support',
  'help',
  'root',
  'system',
  'staff',
  'official',
  'moderator',
  'mod',
  'api',
  'settings',
  'login',
  'register',
  'communities',
  'about',
  'contact',
  'billing',
  'null',
  'undefined',
]);

export type HandleCheck = 'ok' | 'invalid' | 'reserved';

export function checkHandleFormat(handle: string): HandleCheck {
  if (!HANDLE_RE.test(handle)) return 'invalid';
  // Không cho bắt đầu/kết thúc bằng dấu chấm hoặc có hai dấu chấm liền nhau (giống Instagram).
  if (handle.startsWith('.') || handle.endsWith('.') || handle.includes('..')) return 'invalid';
  return RESERVED_HANDLES.has(handle) ? 'reserved' : 'ok';
}
