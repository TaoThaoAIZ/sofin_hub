import type { RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import { requiredPermission } from './admin-staff.permissions.js';
import { adminRequestContext, assertAllowed, resolveStaff } from './admin-staff.service.js';

/**
 * Mọi route admin: phải đăng nhập (401) rồi là nhân viên admin có ĐÚNG quyền cho route đó (403).
 * Quyền suy ra tập trung từ (method, path) ở `requiredPermission` — Super Admin (env) qua mọi route như trước đây.
 */
export const adminOnly: RequestHandler[] = [
  requireAuth,
  async (req, _res, next) => {
    try {
      const staff = await resolveStaff(req.userId!);
      assertAllowed(staff, requiredPermission(req.method, req.originalUrl.split('?')[0]!.replace(/^\/api/, '')));
      req.staff = staff;
      adminRequestContext.enterWith({ ip: req.ip ?? null });
      next();
    } catch (e) {
      next(e);
    }
  },
];

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuery>;

export const pageMeta = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

/** Chuỗi phân cách bằng dấu phẩy -> mảng đã làm sạch (rỗng nếu không có). */
export const csv = (s?: string): string[] => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

/** Lọc theo danh sách giá trị hợp lệ của enum; giá trị lạ -> 400 thay vì lỗi Prisma 500. */
export function enumList<T extends string>(raw: string | undefined, allowed: readonly T[], name: string): T[] {
  const out = csv(raw);
  const bad = out.find((v) => !(allowed as readonly string[]).includes(v));
  if (bad) throw HttpError.validation(`Giá trị "${bad}" không hợp lệ cho ${name}`);
  return out as T[];
}

export const reasonField = z.string({ error: 'Vui lòng nhập lý do' }).trim().min(1, 'Vui lòng nhập lý do').max(500);
export const noteField = z.string().trim().max(2000).optional();
/** Ghi chú ngắn của quyết định duyệt/bỏ qua/giải quyết: tối đa 500 ký tự. */
export const shortNoteField = z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').optional();

const DURATION_MS = { '24h': 24 * 3_600_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 } as const;
export const durationFields = {
  duration: z.enum(['24h', '7d', '30d', 'indefinite']).optional(),
  until: z.string().datetime({ offset: true }).optional(),
};

/** `until` (ISO) thắng `duration`; không có gì hoặc `indefinite` = vô thời hạn (null). */
export function resolveUntil(input: { duration?: '24h' | '7d' | '30d' | 'indefinite'; until?: string }): Date | null {
  if (input.until) {
    const d = new Date(input.until);
    if (d.getTime() <= Date.now()) throw HttpError.validation('Thời hạn phải ở tương lai');
    return d;
  }
  if (input.duration && input.duration !== 'indefinite') return new Date(Date.now() + DURATION_MS[input.duration]);
  return null;
}

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Escape ký tự đặc biệt của LIKE/ILIKE để tìm theo chuỗi thường. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
