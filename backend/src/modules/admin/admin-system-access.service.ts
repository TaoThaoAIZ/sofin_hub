import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { authService } from '../auth/auth.service.js';
import { mailService } from '../mail/mail.service.js';
import { auditService } from './admin-audit.service.js';
import { PERMISSIONS, PERMISSION_KEYS } from './admin-staff.permissions.js';
import { pageMeta, pageQuery } from './admin.common.js';

/** System: Admin Accounts + Roles & Permissions. Contract: docs/api/admin-batch3.md (C1, C2). */

const roleKeyField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{1,39}$/, 'Khóa vai trò chỉ gồm a-z, 0-9, _ (2-40 ký tự, bắt đầu bằng chữ)');
const permsField = z.array(z.string().max(60)).max(60);

export const adminsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  role: z.string().max(40).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});
export const createAdminBody = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(180),
  roleKey: roleKeyField,
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  twoFactorEnabled: z.boolean().default(false),
});
export const patchAdminBody = z
  .object({ roleKey: roleKeyField.optional(), twoFactorEnabled: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const suspendAdminBody = z.object({ reason: z.string().trim().max(500).optional() });
export const createRoleBody = z.object({
  name: z.string().trim().min(2, 'Tên vai trò tối thiểu 2 ký tự').max(60),
  key: roleKeyField.optional(),
  description: z.string().trim().max(300).default(''),
  permissions: permsField,
});
export const patchRoleBody = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(300).optional(),
    permissions: permsField.optional(),
    permission: z.string().max(60).optional(),
    granted: z.boolean().optional(),
  })
  .refine((b) => (b.permission === undefined) === (b.granted === undefined), { message: '`permission` và `granted` phải đi cùng nhau' })
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

function checkPerms(perms: string[]): string[] {
  const uniq = [...new Set(perms)];
  const bad = uniq.find((p) => !PERMISSION_KEYS.includes(p));
  if (bad) throw HttpError.badRequest(`Khóa quyền "${bad}" không hợp lệ`);
  if (uniq.includes('admin.manage')) throw HttpError.badRequest('Quyền "admin.manage" chỉ dành riêng cho Super Admin');
  return uniq;
}
const orderPerms = (perms: string[]) => PERMISSIONS.map((p) => p.key as string).filter((k) => perms.includes(k));

const nameOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
type AccountRow = Prisma.AdminAccountGetPayload<{ include: { user: true; role: true } }>;

function accountView(r: AccountRow, actorId: string) {
  return {
    id: r.userId,
    userId: r.userId,
    name: nameOf(r.user),
    email: r.user.email,
    avatarUrl: r.user.avatarUrl,
    role: { key: r.role.key, name: r.role.name },
    twoFactorEnabled: r.twoFactorEnabled,
    lastLoginAt: r.user.lastLoginAt?.toISOString() ?? null,
    status: r.status,
    source: 'staff' as const,
    locked: r.userId === actorId,
    createdAt: r.createdAt.toISOString(),
  };
}
function envView(u: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null; lastLoginAt: Date | null; createdAt: Date }) {
  return {
    id: u.id,
    userId: u.id,
    name: nameOf(u),
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: { key: 'super_admin', name: 'Super Admin' },
    twoFactorEnabled: false,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    status: 'active' as const,
    source: 'env' as const,
    locked: true,
    createdAt: u.createdAt.toISOString(),
  };
}

async function loadAccount(userId: string) {
  const acc = await prisma.adminAccount.findUnique({ where: { userId }, include: { user: true, role: true } });
  return acc;
}
/** Tìm nhân viên theo userId: env admin (locked) hoặc AdminAccount; 404 nếu không phải nhân viên. */
async function loadStaffTarget(userId: string, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.notFound('Không tìm thấy tài khoản admin');
  if (env.PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    throw HttpError.conflict('Tài khoản Super Admin cấu hình qua môi trường (PLATFORM_ADMIN_EMAILS) không thể thay đổi');
  }
  const acc = await loadAccount(userId);
  if (!acc) throw HttpError.notFound('Không tìm thấy tài khoản admin');
  if (userId === actorId) throw HttpError.conflict('Bạn không thể tự thay đổi tài khoản admin của chính mình');
  return acc;
}
async function requireRole(key: string) {
  const role = await prisma.adminRole.findUnique({ where: { key } });
  if (!role) throw HttpError.badRequest(`Vai trò "${key}" không tồn tại`);
  return role;
}

export const adminAccessService = {
  /* ---------------------------------------------------------------- admins */
  async listAdmins(actorId: string, q: z.infer<typeof adminsQuery>) {
    const [accounts, envUsers] = await Promise.all([
      prisma.adminAccount.findMany({ include: { user: true, role: true } }),
      env.PLATFORM_ADMIN_EMAILS.length ? prisma.user.findMany({ where: { email: { in: env.PLATFORM_ADMIN_EMAILS } } }) : Promise.resolve([]),
    ]);
    const envIds = new Set(envUsers.map((u) => u.id));
    let rows = [...envUsers.map(envView), ...accounts.filter((a) => !envIds.has(a.userId)).map((a) => accountView(a, actorId))];
    if (q.role) rows = rows.filter((r) => r.role.key === q.role);
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    if (q.q) {
      const s = q.q.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
    }
    rows.sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === 'env' ? -1 : 1));
    const slice = rows.slice((q.page - 1) * q.limit, q.page * q.limit);
    return { data: slice.map((r) => (r.userId === actorId ? { ...r, locked: true } : r)), meta: pageMeta(q.page, q.limit, rows.length) };
  },

  async createAdmin(actorId: string, b: z.infer<typeof createAdminBody>) {
    const role = await requireRole(b.roleKey);
    let user = await prisma.user.findUnique({ where: { email: b.email } });
    let invited = false;
    if (user) {
      if (user.deletedAt) throw HttpError.badRequest('Tài khoản này đã bị xóa');
      if (env.PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase()) || (await prisma.adminAccount.findUnique({ where: { userId: user.id } }))) {
        throw HttpError.conflict('Người này đã là nhân viên admin');
      }
    } else {
      if (!b.firstName) throw HttpError.badRequest('Email chưa có tài khoản: vui lòng nhập tên (firstName) để tạo tài khoản mời');
      user = await prisma.user.create({
        data: { email: b.email, firstName: b.firstName, lastName: b.lastName ?? '', passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10) },
      });
      invited = true;
    }
    await prisma.adminAccount.create({ data: { userId: user.id, roleKey: role.key, twoFactorEnabled: b.twoFactorEnabled, invitedById: actorId } });
    if (invited) await authService.forgotPassword(user.email); // gửi liên kết đặt mật khẩu qua email
    await auditService.record(actorId, {
      action: 'admin.create',
      targetType: 'admin',
      targetId: user.id,
      targetLabel: `${nameOf(user)} (${role.name})`,
      metadata: { roleKey: role.key, invited },
    });
    return accountView((await loadAccount(user.id))!, actorId);
  },

  async patchAdmin(actorId: string, userId: string, b: z.infer<typeof patchAdminBody>) {
    const acc = await loadStaffTarget(userId, actorId);
    const data: Prisma.AdminAccountUpdateInput = {};
    if (b.roleKey && b.roleKey !== acc.roleKey) data.role = { connect: { key: (await requireRole(b.roleKey)).key } };
    if (b.twoFactorEnabled !== undefined) data.twoFactorEnabled = b.twoFactorEnabled;
    await prisma.adminAccount.update({ where: { userId }, data });
    await auditService.record(actorId, { action: 'admin.update', targetType: 'admin', targetId: userId, targetLabel: nameOf(acc.user), metadata: { from: acc.roleKey, changes: b } });
    return accountView((await loadAccount(userId))!, actorId);
  },

  async setStatus(actorId: string, userId: string, status: 'active' | 'suspended', reason?: string) {
    const acc = await loadStaffTarget(userId, actorId);
    if (acc.status === status) throw HttpError.conflict(status === 'suspended' ? 'Tài khoản đã bị tạm khóa' : 'Tài khoản đang hoạt động');
    await prisma.adminAccount.update({ where: { userId }, data: { status, suspendedReason: status === 'suspended' ? (reason ?? null) : null } });
    await auditService.record(actorId, {
      action: status === 'suspended' ? 'admin.suspend' : 'admin.enable',
      targetType: 'admin',
      targetId: userId,
      targetLabel: nameOf(acc.user),
      reason: reason ?? null,
    });
    return accountView((await loadAccount(userId))!, actorId);
  },

  async reset2fa(actorId: string, userId: string) {
    const acc = await loadStaffTarget(userId, actorId);
    await prisma.adminAccount.update({ where: { userId }, data: { twoFactorEnabled: false } });
    await mailService.send({
      to: acc.user.email,
      subject: 'Xác thực 2 bước của bạn đã được đặt lại',
      text: `Xin chào ${acc.user.firstName},\n\nXác thực 2 bước cho tài khoản admin SofinHub của bạn đã được đặt lại bởi quản trị viên. Hãy thiết lập lại khi đăng nhập lần tới.`,
    });
    await auditService.record(actorId, { action: 'admin.reset_2fa', targetType: 'admin', targetId: userId, targetLabel: nameOf(acc.user) });
    return accountView((await loadAccount(userId))!, actorId);
  },

  async removeAdmin(actorId: string, userId: string) {
    const acc = await loadStaffTarget(userId, actorId);
    await prisma.adminAccount.delete({ where: { userId } });
    await auditService.record(actorId, { action: 'admin.remove', targetType: 'admin', targetId: userId, targetLabel: `${nameOf(acc.user)} (${acc.role.name})`, metadata: { roleKey: acc.roleKey } });
    return { removed: true };
  },

  /* ---------------------------------------------------------------- roles */
  async listRoles() {
    const [roles, counts, envCount] = await Promise.all([
      prisma.adminRole.findMany({ orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }, { key: 'asc' }] }),
      prisma.adminAccount.groupBy({ by: ['roleKey'], _count: { _all: true } }),
      env.PLATFORM_ADMIN_EMAILS.length ? prisma.user.count({ where: { email: { in: env.PLATFORM_ADMIN_EMAILS }, adminAccount: { is: null } } }) : Promise.resolve(0),
    ]);
    const cnt = new Map(counts.map((c) => [c.roleKey, c._count._all]));
    const order = ['super_admin', 'moderator', 'support', 'finance'];
    roles.sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99));
    return {
      permissions: PERMISSIONS.map((p) => ({ ...p })),
      roles: roles.map((r) => ({
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        locked: r.key === 'super_admin',
        memberCount: (cnt.get(r.key) ?? 0) + (r.key === 'super_admin' ? envCount : 0),
        permissions: r.key === 'super_admin' ? PERMISSIONS.map((p) => p.key as string) : orderPerms(r.permissions),
      })),
    };
  },

  async roleView(key: string) {
    const r = (await this.listRoles()).roles.find((x) => x.key === key);
    if (!r) throw HttpError.notFound('Không tìm thấy vai trò');
    return r;
  },

  async createRole(actorId: string, b: z.infer<typeof createRoleBody>) {
    const key = b.key ?? slug(b.name);
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) throw HttpError.badRequest('Không tạo được khóa vai trò từ tên này, hãy nhập `key`');
    if (await prisma.adminRole.findUnique({ where: { key } })) throw HttpError.conflict('Khóa vai trò đã tồn tại');
    const perms = orderPerms(checkPerms(b.permissions));
    await prisma.adminRole.create({ data: { key, name: b.name, description: b.description, permissions: perms, isSystem: false } });
    await auditService.record(actorId, { action: 'role.create', targetType: 'role', targetId: key, targetLabel: b.name, metadata: { permissions: perms } });
    return this.roleView(key);
  },

  async patchRole(actorId: string, key: string, b: z.infer<typeof patchRoleBody>) {
    const role = await prisma.adminRole.findUnique({ where: { key } });
    if (!role) throw HttpError.notFound('Không tìm thấy vai trò');
    if (key === 'super_admin') throw HttpError.conflict('Vai trò Super Admin luôn đủ quyền và không thể chỉnh sửa');
    let perms = role.permissions;
    if (b.permissions) perms = checkPerms(b.permissions);
    if (b.permission !== undefined) {
      const [p] = checkPerms([b.permission]);
      perms = b.granted ? [...new Set([...perms, p!])] : perms.filter((x) => x !== p);
    }
    perms = orderPerms(perms);
    await prisma.adminRole.update({
      where: { key },
      data: { permissions: perms, ...(b.name ? { name: b.name } : {}), ...(b.description !== undefined ? { description: b.description } : {}) },
    });
    await auditService.record(actorId, {
      action: 'role.update',
      targetType: 'role',
      targetId: key,
      targetLabel: b.name ?? role.name,
      metadata: { before: role.permissions, after: perms },
    });
    return this.roleView(key);
  },

  async deleteRole(actorId: string, key: string) {
    const role = await prisma.adminRole.findUnique({ where: { key } });
    if (!role) throw HttpError.notFound('Không tìm thấy vai trò');
    if (role.isSystem) throw HttpError.conflict('Không thể xóa vai trò hệ thống');
    if (await prisma.adminAccount.count({ where: { roleKey: key } })) throw HttpError.conflict('Vai trò đang được gán cho nhân viên, hãy đổi vai trò của họ trước');
    await prisma.adminRole.delete({ where: { key } });
    await auditService.record(actorId, { action: 'role.delete', targetType: 'role', targetId: key, targetLabel: role.name });
    return { deleted: true };
  },
};
