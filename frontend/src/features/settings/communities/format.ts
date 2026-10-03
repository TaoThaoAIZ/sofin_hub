import { ROLE_LABEL } from '../../account/roles';
import type { MyCommunity } from './api';

const DAY = 86_400_000;

export const isOwner = (c: MyCommunity) => c.role === 'owner';
/** "Tôi quản lý" = chủ, quản trị viên, điều hành viên. */
export const isManager = (c: MyCommunity) => c.role !== 'member';

const daysLeft = (iso: string | null, now = Date.now()) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY)) : 0);

/** Nhãn vai trò cạnh tên: "Chủ sở hữu" hoặc "Thành viên · Cấp 3". */
export const roleText = (c: MyCommunity) => (isOwner(c) ? 'Chủ sở hữu' : `${ROLE_LABEL[c.role]} · Cấp ${c.level}`);

/** Dòng mô tả dưới tên (theo thiết kế): owner = thành viên/riêng tư/dùng thử; còn lại = ngày tham gia + gói. */
export function lineText(c: MyCommunity, now = Date.now()): string {
  if (isOwner(c)) {
    const parts = [`${c.memberCount.toLocaleString('vi-VN')} thành viên`, c.visibility === 'private' ? 'Riêng tư' : 'Công khai'];
    if (c.hosting?.status === 'trialing' && c.hosting.trialEndsAt) parts.push(`Dùng thử còn ${daysLeft(c.hosting.trialEndsAt, now)} ngày`);
    return parts.join(' · ');
  }
  const joined = new Date(c.enrolledAt);
  const sameDay = new Date(now).toDateString() === joined.toDateString();
  const parts = [`Tham gia ${sameDay ? 'hôm nay' : joined.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`];
  const s = c.subscription;
  if (s?.status === 'trialing') parts.push(`Dùng thử còn ${daysLeft(s.trialEndsAt ?? s.currentPeriodEnd, now)} ngày`);
  else if (s && (s.status === 'active' || s.status === 'past_due' || s.status === 'paused')) parts.push(s.interval === 'annual' ? 'Gói năm' : 'Gói tháng');
  else if (c.free) parts.push('Miễn phí');
  return parts.join(' · ');
}

export function agoText(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < 3_600_000) return 'vừa xong';
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return `${Math.floor(diff / DAY)} ngày trước`;
}
