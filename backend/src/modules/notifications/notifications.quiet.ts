/** Giờ im lặng: hàm thuần (dễ test), tính theo múi giờ IANA của user. */
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHm(s: string): number | null {
  const m = HM.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Số phút từ 00:00 theo giờ địa phương của `tz` (múi giờ lạ => dùng mặc định). */
export function localMinutes(now: Date, tz: string): number {
  const fmt = (zone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = fmt(tz);
  } catch {
    parts = fmt(DEFAULT_TIMEZONE);
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get('hour') % 24) * 60 + get('minute');
}

/**
 * Đang trong giờ im lặng? Khoảng [from, to): qua nửa đêm (22:00-07:00) được hiểu là from->24:00 và 00:00->to.
 * from == to coi như khoảng rỗng (không im lặng); giờ sai định dạng => không im lặng.
 */
export function isQuietNow(q: { enabled: boolean; from: string; to: string }, tz: string, now: Date = new Date()): boolean {
  if (!q.enabled) return false;
  const from = parseHm(q.from);
  const to = parseHm(q.to);
  if (from === null || to === null || from === to) return false;
  const cur = localMinutes(now, tz);
  return from < to ? cur >= from && cur < to : cur >= from || cur < to;
}
