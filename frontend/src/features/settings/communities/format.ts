import i18n, { currentLocale } from '../../../i18n';
import { roleLabel } from '../../account/roles';
import type { MyCommunity } from './api';

const DAY = 86_400_000;

export const isOwner = (c: MyCommunity) => c.role === 'owner';
/** "Tôi quản lý" = chủ, quản trị viên, điều hành viên. */
export const isManager = (c: MyCommunity) => c.role !== 'member';

const daysLeft = (iso: string | null, now = Date.now()) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY)) : 0);

/** Nhãn vai trò cạnh tên: "Chủ sở hữu" hoặc "Thành viên · Cấp 3". */
export const roleText = (c: MyCommunity) => (isOwner(c) ? i18n.t('communities.fmt.owner', { ns: 'settings' }) : i18n.t('communities.fmt.roleLevel', { ns: 'settings', role: roleLabel(c.role), level: c.level }));

/** Dòng mô tả dưới tên (theo thiết kế): owner = thành viên/riêng tư/dùng thử; còn lại = ngày tham gia + gói. */
export function lineText(c: MyCommunity, now = Date.now()): string {
  if (isOwner(c)) {
    const parts = [i18n.t('communities.fmt.members', { ns: 'settings', count: c.memberCount, formatted: c.memberCount.toLocaleString(currentLocale()) }), c.visibility === 'private' ? i18n.t('communities.fmt.private', { ns: 'settings' }) : i18n.t('communities.fmt.public', { ns: 'settings' })];
    if (c.hosting?.status === 'trialing' && c.hosting.trialEndsAt) parts.push(i18n.t('communities.fmt.trialLeft', { ns: 'settings', count: daysLeft(c.hosting.trialEndsAt, now) }));
    return parts.join(' · ');
  }
  const joined = new Date(c.enrolledAt);
  const sameDay = new Date(now).toDateString() === joined.toDateString();
  const parts = [i18n.t('communities.fmt.joined', { ns: 'settings', when: sameDay ? i18n.t('communities.fmt.today', { ns: 'settings' }) : joined.toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) })];
  const s = c.subscription;
  if (s?.status === 'trialing') parts.push(i18n.t('communities.fmt.trialLeft', { ns: 'settings', count: daysLeft(s.trialEndsAt ?? s.currentPeriodEnd, now) }));
  else if (s && (s.status === 'active' || s.status === 'past_due' || s.status === 'paused')) parts.push(s.interval === 'annual' ? i18n.t('communities.fmt.annual', { ns: 'settings' }) : i18n.t('communities.fmt.monthly', { ns: 'settings' }));
  else if (c.free) parts.push(i18n.t('communities.fmt.free', { ns: 'settings' }));
  return parts.join(' · ');
}

export function agoText(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < 3_600_000) return i18n.t('communities.ago.justNow', { ns: 'settings' });
  if (diff < DAY) return i18n.t('communities.ago.hours', { ns: 'settings', count: Math.floor(diff / 3_600_000) });
  return i18n.t('communities.ago.days', { ns: 'settings', count: Math.floor(diff / DAY) });
}
