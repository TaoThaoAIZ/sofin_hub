import i18n from '../../../i18n';
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
  coverUrl: string;
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
  coverUrl: u.coverUrl ?? '',
});

/** Ô handle: chữ thường, chỉ a-z 0-9 . _ (giống mockup). */
export const sanitizeHandle = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24);

/** Trạng thái định dạng handle phía FE trước khi hỏi BE: '' = để trống (được phép, xóa đường dẫn). */
export function handleFormatError(h: string): string | null {
  if (!h) return null;
  if (h.length < 3) return i18n.t('profileForm.handleMin', { ns: 'settings' });
  if (h.startsWith('.') || h.endsWith('.') || h.includes('..')) return i18n.t('profileForm.invalid', { ns: 'settings' });
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
  if (!f.first.trim()) return i18n.t('profileForm.firstRequired', { ns: 'settings' });
  if (!f.last.trim()) return i18n.t('profileForm.lastRequired', { ns: 'settings' });
  if (f.bio.length > BIO_MAX) return i18n.t('profileForm.bioMax', { ns: 'settings', max: BIO_MAX });
  if (f.website.trim() && !isHttpUrl(normalizeUrl(f.website))) return i18n.t('profileForm.websiteInvalid', { ns: 'settings' });
  if (f.youtube.trim() && !isHttpUrl(normalizeUrl(f.youtube))) return i18n.t('profileForm.youtubeInvalid', { ns: 'settings' });
  if (f.instagram.trim() && !/^@?[A-Za-z0-9._]{1,30}$/.test(f.instagram.trim())) return i18n.t('profileForm.instagramInvalid', { ns: 'settings' });
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
  if (f.coverUrl !== saved.coverUrl) patch.coverUrl = f.coverUrl;
  return patch;
}

/** Chữ cái đầu cho avatar mặc định (như topbar: tên + họ). */
export const initialsOf = (first: string, last: string) => `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || 'U';
