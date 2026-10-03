import type { AuthUser } from '../../auth/types';
import type { UpdateProfileInput } from '../../account/types';

/** Trạng thái form tab Hồ sơ (chuỗi rỗng = chưa nhập). `city` ↔ `location` ở BE. */
export interface ProfileForm {
  last: string;
  first: string;
  handle: string;
  bio: string;
  website: string;
  instagram: string;
  youtube: string;
  city: string;
  showOnMap: boolean;
  avatarUrl: string;
}

export const BIO_MAX = 150;

export const formFromUser = (u: AuthUser): ProfileForm => ({
  last: u.lastName,
  first: u.firstName,
  handle: u.handle ?? '',
  bio: u.bio ?? '',
  website: u.website ?? '',
  instagram: u.instagram ? `@${u.instagram}` : '',
  youtube: u.youtube ?? '',
  city: u.location ?? '',
  showOnMap: u.showOnMap,
  avatarUrl: u.avatarUrl ?? '',
});

/** Ô handle: chữ thường, chỉ a-z 0-9 . _ (giống mockup). */
export const sanitizeHandle = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24);

/** Trạng thái định dạng handle phía FE trước khi hỏi BE: '' = để trống (được phép, xóa đường dẫn). */
export function handleFormatError(h: string): string | null {
  if (!h) return null;
  if (h.length < 3) return 'Tối thiểu 3 ký tự';
  if (h.startsWith('.') || h.endsWith('.') || h.includes('..')) return 'Không hợp lệ';
  return null;
}

/** Thiếu scheme thì thêm https:// (BE chỉ nhận URL http/https). */
export const normalizeUrl = (v: string) => {
  const t = v.trim();
  return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t;
};

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Lỗi tiếng Việt đầu tiên của form (null = hợp lệ) — khớp quy tắc ở BE (auth.schema.ts). */
export function validateForm(f: ProfileForm): string | null {
  if (!f.first.trim()) return 'Vui lòng nhập tên';
  if (!f.last.trim()) return 'Vui lòng nhập họ';
  if (f.bio.length > BIO_MAX) return `Giới thiệu tối đa ${BIO_MAX} ký tự`;
  if (f.website.trim() && !isHttpUrl(normalizeUrl(f.website))) return 'Website phải là URL hợp lệ';
  if (f.youtube.trim() && !isHttpUrl(normalizeUrl(f.youtube))) return 'Liên kết YouTube phải là URL hợp lệ';
  if (f.instagram.trim() && !/^@?[A-Za-z0-9._]{1,30}$/.test(f.instagram.trim())) return 'Tên Instagram không hợp lệ';
  return null;
}

/** Chỉ gửi các trường đã đổi so với bản đã lưu. */
export function diffToPatch(saved: ProfileForm, f: ProfileForm): UpdateProfileInput {
  const patch: UpdateProfileInput = {};
  if (f.first.trim() !== saved.first) patch.firstName = f.first.trim();
  if (f.last.trim() !== saved.last) patch.lastName = f.last.trim();
  if (f.handle !== saved.handle) patch.handle = f.handle;
  if (f.bio.trim() !== saved.bio) patch.bio = f.bio.trim();
  if (f.website.trim() !== saved.website) patch.website = normalizeUrl(f.website);
  if (f.instagram.trim() !== saved.instagram) patch.instagram = f.instagram.trim();
  if (f.youtube.trim() !== saved.youtube) patch.youtube = normalizeUrl(f.youtube);
  if (f.city.trim() !== saved.city) patch.location = f.city.trim();
  if (f.showOnMap !== saved.showOnMap) patch.showOnMap = f.showOnMap;
  if (f.avatarUrl !== saved.avatarUrl) patch.avatarUrl = f.avatarUrl;
  return patch;
}

/** Chữ cái đầu cho avatar mặc định (như topbar: tên + họ). */
export const initialsOf = (first: string, last: string) => `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || 'U';
