import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { PERMISSIONS, type Requirement } from './admin-staff.permissions.js';

export interface Staff {
  userId: string;
  email: string;
  /** `env` = email trong PLATFORM_ADMIN_EMAILS (luôn Super Admin, không sửa được). */
  source: 'env' | 'staff';
  roleKey: string;
  roleName: string;
  permissions: string[];
}

/** IP của request admin hiện tại, để `auditService.record` điền cột `ip` mà không phải truyền qua mọi service. */
export const adminRequestContext = new AsyncLocalStorage<{ ip: string | null }>();

const ALL = PERMISSIONS.map((p) => p.key as string);

/**
 * Nhân viên hiệu lực của user: Super Admin (env) > AdminAccount `active`. Trả null nếu không phải nhân viên.
 * Nhân viên `suspended` -> 403 riêng (để FE hiện đúng lý do).
 */
export async function resolveStaff(userId: string): Promise<Staff | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, adminAccount: { select: { status: true, role: { select: { key: true, name: true, permissions: true } } } } },
  });
  if (!u) return null;
  if (env.PLATFORM_ADMIN_EMAILS.includes(u.email.toLowerCase())) {
    return { userId, email: u.email, source: 'env', roleKey: 'super_admin', roleName: 'Super Admin', permissions: ALL };
  }
  const acc = u.adminAccount;
  if (!acc) return null;
  if (acc.status !== 'active') throw HttpError.forbidden('Tài khoản admin của bạn đã bị tạm khóa');
  const perms = acc.role.key === 'super_admin' ? ALL : acc.role.permissions.filter((k) => ALL.includes(k));
  return { userId, email: u.email, source: 'staff', roleKey: acc.role.key, roleName: acc.role.name, permissions: perms };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: Staff;
    }
  }
}

/** Kiểm tra yêu cầu quyền cho 1 nhân viên: 403 nếu thiếu. */
export function assertAllowed(staff: Staff | null, need: Requirement): asserts staff is Staff {
  if (!staff) throw HttpError.forbidden('Chỉ nhân viên admin mới có quyền này');
  if (need === null) return;
  if (need === 'super') {
    if (staff.roleKey !== 'super_admin') throw HttpError.forbidden('Chỉ Super Admin mới có quyền này');
    return;
  }
  if (!staff.permissions.includes(need)) throw HttpError.forbidden(`Vai trò ${staff.roleName} không có quyền "${need}"`);
}

/** Nhân viên đang hoạt động có quyền `perm` (cho dropdown giao việc). Gồm cả Super Admin env. */
export async function staffWithPermission(perm: string) {
  const [accounts, envUsers] = await Promise.all([
    prisma.adminAccount.findMany({
      where: { status: 'active', role: { permissions: { has: perm } } },
      select: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, role: { select: { key: true, name: true } } },
    }),
    env.PLATFORM_ADMIN_EMAILS.length ? prisma.user.findMany({ where: { email: { in: env.PLATFORM_ADMIN_EMAILS } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [],
  ]);
  const out = new Map<string, { id: string; name: string; email: string; role: string }>();
  for (const u of envUsers) out.set(u.id, { id: u.id, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, role: 'Super Admin' });
  for (const a of accounts) out.set(a.user.id, { id: a.user.id, name: `${a.user.firstName} ${a.user.lastName}`.trim(), email: a.user.email, role: a.role.name });
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Nhân viên active có quyền này không (Super Admin env luôn có). Suspended/không phải nhân viên -> false. */
export async function hasPermission(userId: string, perm: string): Promise<boolean> {
  try {
    const s = await resolveStaff(userId);
    return !!s && s.permissions.includes(perm);
  } catch {
    return false;
  }
}
