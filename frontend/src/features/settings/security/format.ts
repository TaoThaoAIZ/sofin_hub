import i18n from '../../../i18n';
import type { AuthSessionInfo } from '../../account/types';

/** "vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước", "4 tháng trước", "2 năm trước". */
export function relativeTimeVi(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return i18n.t('security.rel.justNow', { ns: 'settings' });
  if (min < 60) return i18n.t('security.rel.minutes', { ns: 'settings', count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return i18n.t('security.rel.hours', { ns: 'settings', count: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return i18n.t('security.rel.days', { ns: 'settings', count: day });
  const month = Math.floor(day / 30);
  if (month < 12) return i18n.t('security.rel.months', { ns: 'settings', count: month });
  return i18n.t('security.rel.years', { ns: 'settings', count: Math.floor(day / 365) });
}

/** Phụ đề dòng "Mật khẩu": dựa vào passwordChangedAt (chưa từng đổi thì nói rõ). */
export const passwordSubtitle = (changedAt: string | undefined, now = Date.now()) =>
  changedAt ? i18n.t('security.passwordUpdated', { ns: 'settings', when: relativeTimeVi(changedAt, now) }) : i18n.t('security.passwordNever', { ns: 'settings' });

export interface DeviceView {
  id: string;
  icon: string;
  name: string;
  where: string;
  meta: string;
  current: boolean;
}

const ICON: Record<string, string> = { macOS: 'laptop_mac', Windows: 'desktop_windows', iOS: 'smartphone', Android: 'smartphone' };

/** Dựng 3 dòng hiển thị của 1 thiết bị từ phiên đăng nhập (UA đã được BE phân tích). Không có geo-IP nên "nơi" = địa chỉ IP. */
export function deviceView(s: AuthSessionInfo, now = Date.now()): DeviceView {
  const d = s.device;
  const unknown = d.kind === 'unknown';
  const icon = d.kind === 'tablet' ? 'tablet_mac' : d.kind === 'mobile' ? 'smartphone' : (ICON[d.os] ?? (unknown ? 'devices' : 'computer'));
  const name = unknown ? i18n.t('security.device.unknown', { ns: 'settings' }) : `${d.browser} • ${d.os}`;
  const meta = unknown ? i18n.t('security.device.noBrowser', { ns: 'settings' }) : `${[d.browser, d.browserVersion].filter(Boolean).join(' ')} • ${[d.os, d.osVersion].filter(Boolean).join(' ')}`;
  const where = `${s.ip ?? i18n.t('security.device.unknownIp', { ns: 'settings' })} • ${s.current ? i18n.t('security.device.inUse', { ns: 'settings' }) : relativeTimeVi(s.lastUsedAt, now)}`;
  return { id: s.id, icon, name, where, meta, current: s.current };
}

/** Thiết bị đang dùng lên đầu, còn lại mới hoạt động trước. */
export const sortDevices = (list: AuthSessionInfo[]) =>
  [...list].sort((a, b) => Number(b.current) - Number(a.current) || new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());

export const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
] as const;

/** Múi giờ theo bản thiết kế (giá trị IANA). */
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Ho_Chi_Minh', get label() { return i18n.t('security.tz.hcm', { ns: 'settings' }); } },
  { value: 'Asia/Singapore', get label() { return i18n.t('security.tz.sg', { ns: 'settings' }); } },
  { value: 'Asia/Seoul', get label() { return i18n.t('security.tz.seoul', { ns: 'settings' }); } },
  { value: 'Europe/London', get label() { return i18n.t('security.tz.london', { ns: 'settings' }); } },
  { value: 'America/Los_Angeles', get label() { return i18n.t('security.tz.la', { ns: 'settings' }); } },
] as const;

/** Nhóm khóa base32 thành khối 4 ký tự cho dễ nhập tay: "ABCD EFGH ...". */
export const groupKey = (k: string) => k.replace(/(.{4})/g, '$1 ').trim();

/** Câu mô tả điều kiện chặn xóa tài khoản (null = không bị chặn). */
export function blockersSentence(b: { ownedCommunities: { title: string }[]; activeSubscriptions: number } | undefined): string | null {
  if (!b) return null;
  const tr = (key: string, opts: Record<string, unknown> = {}) => i18n.t(key, { ns: 'settings', ...opts });
  const parts: string[] = [];
  if (b.ownedCommunities.length > 0) {
    const names = b.ownedCommunities.map((c) => c.title);
    parts.push(
      b.ownedCommunities.length === 1
        ? tr('security.blockers.adminOne', { name: names[0] })
        : tr('security.blockers.adminMany', { count: b.ownedCommunities.length, names: names.join(', ') }),
    );
  }
  if (b.activeSubscriptions > 0) parts.push(tr('security.blockers.subs', { count: b.activeSubscriptions }));
  if (parts.length === 0) return null;
  const todo = [b.ownedCommunities.length > 0 && tr('security.blockers.todoAdmin'), b.activeSubscriptions > 0 && tr('security.blockers.todoSubs')].filter(Boolean).join(tr('security.blockers.and'));
  return tr('security.blockers.sentence', { parts: parts.join(tr('security.blockers.and')), todo });
}
