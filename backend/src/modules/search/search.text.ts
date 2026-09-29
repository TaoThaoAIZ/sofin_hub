export interface Segment {
  text: string;
  match: boolean;
}

/** Bỏ dấu tiếng Việt (NFD, đ->d) và hạ chữ thường. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

/** Chuẩn hóa kèm bản đồ vị trí về chuỗi gốc, để tô đậm đúng đoạn chữ có dấu ban đầu. */
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of s) {
    const n = normalizeText(ch);
    for (let k = 0; k < n.length; k++) map.push(i);
    norm += n;
    i += ch.length;
  }
  return { norm, map };
}

/** Các đoạn [start, end) trong chuỗi gốc khớp `needle` (đã chuẩn hóa). */
export function findMatches(text: string, needle: string): Array<[number, number]> {
  if (!needle) return [];
  const { norm, map } = normalizeWithMap(text);
  const out: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const at = norm.indexOf(needle, from);
    if (at < 0) break;
    const start = map[at]!;
    const end = map[at + needle.length - 1]! + 1;
    const last = out[out.length - 1];
    if (!last || start >= last[1]) out.push([start, end]);
    from = at + needle.length;
  }
  return out;
}

export const matches = (text: string, needle: string) => normalizeText(text).includes(needle);

/**
 * Trích đoạn quanh chỗ khớp đầu tiên, tách thành các segment {text, match}. FE render bằng text node
 * (không phải HTML) nên không có nguy cơ XSS từ nội dung người dùng.
 */
export function makeSnippet(text: string, needle: string, radius = 60): Segment[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  const found = findMatches(flat, needle);
  if (found.length === 0) {
    const head = flat.slice(0, radius * 2);
    return [{ text: head + (flat.length > head.length ? '…' : ''), match: false }];
  }
  const from = Math.max(0, found[0]![0] - radius);
  const to = Math.min(flat.length, found[0]![1] + radius);
  const segs: Segment[] = [];
  const push = (t: string, m: boolean) => t && segs.push({ text: t, match: m });
  let cursor = from;
  for (const [s, e] of found) {
    if (s >= to) break;
    push(flat.slice(cursor, s), false);
    push(flat.slice(s, Math.min(e, to)), true);
    cursor = Math.min(e, to);
  }
  push(flat.slice(cursor, to), false);
  if (from > 0 && segs[0]) segs[0].text = '…' + segs[0].text;
  if (to < flat.length) segs[segs.length - 1]!.text += '…';
  return segs;
}
