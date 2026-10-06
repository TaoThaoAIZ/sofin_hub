import i18n, { currentLocale } from '../i18n';

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", hoặc ngày đầy đủ nếu > 30 ngày. */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return i18n.t('time.justNow', { ns: 'common' });
  if (mins < 60) return i18n.t('time.minutesAgo', { ns: 'common', count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return i18n.t('time.hoursAgo', { ns: 'common', count: hours });
  const days = Math.floor(hours / 24);
  if (days <= 30) return i18n.t('time.daysAgo', { ns: 'common', count: days });
  return formatDate(iso);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Số cent -> "$12.34". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Chỉ cho phép đường dẫn nội bộ của FE (bắt đầu bằng "/" nhưng không phải "//") — chặn link ngoài/độc hại. */
export function safeInternalPath(link: string | undefined | null): string | null {
  if (!link) return null;
  if (!link.startsWith('/') || link.startsWith('//')) return null;
  return link;
}
