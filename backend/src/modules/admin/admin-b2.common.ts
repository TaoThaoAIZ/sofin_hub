import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { noteField, reasonField } from './admin.common.js';

/** Helper dùng chung cho Admin đợt 2 (content / payments / discovery). */

export const personSelect = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } as const;
export interface PersonRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
}
export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
export const person = (u: PersonRow | null | undefined) =>
  u ? { id: u.id, name: fullName(u), email: u.email, avatarUrl: u.avatarUrl } : null;
export const ref = (c: { id: string; title: string }) => ({ id: c.id, name: c.title });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Mã hiển thị: tiền tố + 8 ký tự đầu của uuid (viết hoa). Id không phải uuid (vd. dữ liệu seed `seed-admin-post-1`) lấy 8 ký tự chữ/số CUỐI để không trùng mã. */
export const code = (prefix: string, id: string) => {
  const flat = id.replace(/-/g, '');
  return `${prefix}-${(UUID_RE.test(id) ? flat.slice(0, 8) : id.replace(/[^0-9a-z]/gi, '').slice(-8)).toUpperCase()}`;
};
/** Ngược lại: chuỗi tìm kiếm dạng `POST-3FA2B1C4` / `3fa2` -> tiền tố uuid chữ thường (undefined nếu không giống mã). */
export function codePrefix(q: string, prefix: string): string | undefined {
  const m = new RegExp(`^(?:${prefix}-)?([0-9a-f]{4,8})$`, 'i').exec(q.trim());
  return m ? m[1]!.toLowerCase() : undefined;
}

export const excerpt = (s: string, n = 80) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Tên người dùng theo id (cho moderatedBy / resolvedBy...). */
export async function nameMap(ids: Array<string | null | undefined>) {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, ReturnType<typeof person>>();
  if (!uniq.length) return out;
  const rows = await prisma.user.findMany({ where: { id: { in: uniq } }, select: personSelect });
  for (const r of rows) out.set(r.id, person(r));
  return out;
}

export const optionalReason = z.string().trim().max(500).optional();
export const hideBody = z.object({ reason: reasonField, note: noteField, notifyAuthor: z.boolean().default(true) });
export const restoreNoteBody = z.object({ note: noteField });
export const optNotifyBody = z.object({ reason: optionalReason, note: noteField });

export const bulkBody = z
  .object({
    action: z.enum(['hide', 'remove', 'restore']),
    ids: z.array(z.string().min(1).max(100)).min(1).max(100),
    reason: optionalReason,
  })
  .refine((b) => b.action === 'restore' || !!b.reason, { message: 'Vui lòng nhập lý do', path: ['reason'] });

/** Khoảng ngày `from`/`to` (ISO hoặc YYYY-MM-DD; `to` dạng ngày tính hết ngày đó). */
export const dateRangeFields = {
  from: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional(),
  to: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional(),
};
export function resolveRange(q: { from?: string; to?: string }): { from?: Date; to?: Date } {
  const from = q.from ? new Date(q.from) : undefined;
  const to = q.to ? new Date(new Date(q.to).getTime() + (q.to.length === 10 ? DAY - 1 : 0)) : undefined;
  if (from && to && from > to) throw HttpError.validation('`from` phải trước `to`');
  return { from, to };
}

export const pctRound = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
