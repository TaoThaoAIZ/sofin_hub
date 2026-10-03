import type { AuthSessionInfo } from '../../account/types';

/** "vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước", "4 tháng trước", "2 năm trước". */
export function relativeTimeVi(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} ngày trước`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} tháng trước`;
  return `${Math.floor(day / 365)} năm trước`;
}

/** Phụ đề dòng "Mật khẩu": dựa vào passwordChangedAt (chưa từng đổi thì nói rõ). */
export const passwordSubtitle = (changedAt: string | undefined, now = Date.now()) =>
  changedAt ? `Đã cập nhật ${relativeTimeVi(changedAt, now)}` : 'Chưa đổi mật khẩu kể từ khi tạo tài khoản';

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
  const name = unknown ? 'Thiết bị không xác định' : `${d.browser} • ${d.os}`;
  const meta = unknown ? 'Không có thông tin trình duyệt' : `${[d.browser, d.browserVersion].filter(Boolean).join(' ')} • ${[d.os, d.osVersion].filter(Boolean).join(' ')}`;
  const where = `${s.ip ?? 'Không rõ IP'} • ${s.current ? 'Đang dùng' : relativeTimeVi(s.lastUsedAt, now)}`;
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
  { value: 'Asia/Ho_Chi_Minh', label: '(UTC+07:00) Hà Nội, TP. Hồ Chí Minh' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore' },
  { value: 'Asia/Seoul', label: '(UTC+09:00) Seoul, Tokyo' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Los Angeles' },
] as const;

/** Nhóm khóa base32 thành khối 4 ký tự cho dễ nhập tay: "ABCD EFGH ...". */
export const groupKey = (k: string) => k.replace(/(.{4})/g, '$1 ').trim();

/** Câu mô tả điều kiện chặn xóa tài khoản (null = không bị chặn). */
export function blockersSentence(b: { ownedCommunities: { title: string }[]; activeSubscriptions: number } | undefined): string | null {
  if (!b) return null;
  const parts: string[] = [];
  if (b.ownedCommunities.length > 0) {
    const names = b.ownedCommunities.map((c) => c.title);
    parts.push(
      b.ownedCommunities.length === 1
        ? `là quản trị của cộng đồng ${names[0]}`
        : `là quản trị của ${b.ownedCommunities.length} cộng đồng (${names.join(', ')})`,
    );
  }
  if (b.activeSubscriptions > 0) parts.push(`có ${b.activeSubscriptions} gói thành viên đang hoạt động`);
  if (parts.length === 0) return null;
  const todo = [b.ownedCommunities.length > 0 && 'chuyển quyền quản trị', b.activeSubscriptions > 0 && 'hủy các gói'].filter(Boolean).join(' và ');
  return `Bạn đang ${parts.join(' và ')}. Hãy ${todo} trước khi xóa.`;
}
