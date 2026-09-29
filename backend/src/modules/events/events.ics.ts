import type { CommunityEvent } from './events.types.js';

/**
 * Sinh iCalendar (RFC 5545). Dùng giờ UTC (hậu tố Z) nên không cần VTIMEZONE; timezone gốc của sự kiện ghi vào DESCRIPTION.
 * Sự kiện chưa có giờ kết thúc -> mặc định kéo dài 1 giờ.
 */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/** Escape TEXT theo RFC 5545 §3.3.11: \ ; , và xuống dòng. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** Gập dòng > 75 octet (RFC 5545 §3.1): CRLF + 1 khoảng trắng, không cắt ngang ký tự UTF-8. */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75; // dòng tiếp theo bắt đầu bằng 1 khoảng trắng nên chỉ còn 74 octet cho nội dung
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (curBytes + b > limit) {
      out.push(cur);
      cur = '';
      curBytes = 0;
      limit = 74;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) out.push(cur);
  return out.join('\r\n ');
}

function eventLines(e: CommunityEvent, hostName: string | undefined, url: string | undefined, stamp: Date): string[] {
  const start = new Date(e.startAt);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  const desc = [e.description, hostName ? `Người tổ chức: ${hostName}` : '', e.meetingLink ? `Liên kết: ${e.meetingLink}` : '', `Múi giờ gốc: ${e.timezone}`]
    .filter(Boolean)
    .join('\n');
  const lines = [
    'BEGIN:VEVENT',
    `UID:${e.id}@sofinhub`,
    `DTSTAMP:${utc(stamp)}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
  ];
  if (e.meetingLink) lines.push(`LOCATION:${icsEscape(e.meetingLink)}`);
  if (url) lines.push(`URL:${url}`);
  // SEQUENCE tăng khi sửa để ứng dụng lịch nhận biết bản cập nhật; dùng updatedAt làm mốc.
  lines.push(`SEQUENCE:${e.updatedAt ? Math.floor(new Date(e.updatedAt).getTime() / 1000) : 0}`, 'END:VEVENT');
  return lines;
}

export interface IcsEventInput {
  event: CommunityEvent;
  hostName?: string;
  url?: string;
}

export function buildIcs(items: IcsEventInput[], calendarName: string, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SofinHub//Community Events//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    ...items.flatMap((i) => eventLines(i.event, i.hostName, i.url, now)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
