/**
 * Danh mục quyền nhân viên admin + luật "route -> quyền" TẬP TRUNG (một nơi duy nhất quyết định ai gọi được `/api/admin/*`).
 * Ma trận mặc định của 4 vai trò hệ thống phải khớp với INSERT trong migration `20261003100000_admin_batch3`.
 */
export const PERMISSIONS = [
  { key: 'dashboard.view', label: 'View dashboard', group: 'General' },
  { key: 'community.manage', label: 'Manage communities', group: 'Communities' },
  { key: 'content.manage', label: 'Manage content', group: 'Communities' },
  { key: 'report.resolve', label: 'Resolve reports', group: 'Moderation' },
  { key: 'user.ban', label: 'Ban users', group: 'Users' },
  { key: 'users.view', label: 'View users', group: 'Users' },
  { key: 'payment.view', label: 'View payments', group: 'Payments' },
  { key: 'payment.refund', label: 'Issue refunds', group: 'Payments' },
  { key: 'payment.manage', label: 'Manage payments', group: 'Payments' },
  { key: 'payout.approve', label: 'Approve payouts', group: 'Payments' },
  { key: 'analytics.view', label: 'View analytics', group: 'Analytics' },
  { key: 'support.manage', label: 'Handle support tickets', group: 'Support' },
  { key: 'audit.view', label: 'View audit logs', group: 'System' },
  { key: 'system.flags', label: 'Edit feature flags', group: 'System' },
  { key: 'system.settings', label: 'System settings', group: 'System' },
  { key: 'admin.manage', label: 'Manage admins', group: 'System' },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as readonly string[];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  super_admin: PERMISSIONS.map((p) => p.key),
  moderator: ['dashboard.view', 'community.manage', 'report.resolve', 'user.ban', 'users.view', 'content.manage', 'analytics.view'],
  support: ['dashboard.view', 'report.resolve', 'payment.refund', 'users.view', 'payment.view', 'support.manage'],
  finance: ['dashboard.view', 'payment.refund', 'payout.approve', 'payment.view', 'payment.manage', 'analytics.view'],
};

/** `null` = chỉ cần là nhân viên. `'super'` = chỉ Super Admin (route không có trong bảng). */
export type Requirement = PermissionKey | null | 'super';

/** Quyền cần cho (method, path sau `/api`, vd. `/admin/users/abc/ban`). Luật khớp đầu tiên thắng. */
export function requiredPermission(method: string, rawPath: string): Requirement {
  const path = rawPath.replace(/\/+$/, '');
  const read = method === 'GET' || method === 'HEAD';
  const starts = (p: string) => path === p || path.startsWith(`${p}/`);

  if (path === '/admin/me') return null;
  if (path === '/admin/dashboard') return 'dashboard.view';
  if (starts('/admin/communities') || starts('/admin/discovery') || starts('/admin/system/categories')) return 'community.manage';
  if (starts('/admin/content')) return 'content.manage';
  if (starts('/admin/moderation') || starts('/admin/reports')) return 'report.resolve';
  if (starts('/admin/users')) return read ? 'users.view' : 'user.ban';
  if (starts('/admin/payments')) {
    if (read) return 'payment.view';
    if (/^\/admin\/payments\/refunds\/[^/]+\/(approve|reject)$/.test(path) || /^\/admin\/payments\/transactions\/[^/]+\/refund$/.test(path)) return 'payment.refund';
    if (starts('/admin/payments/payouts')) return 'payout.approve';
    return 'payment.manage';
  }
  if (starts('/admin/refunds')) return read ? 'payment.view' : 'payment.refund';
  if (starts('/admin/payouts')) return read ? 'payment.view' : 'payout.approve';
  if (starts('/admin/analytics')) return 'analytics.view';
  if (starts('/admin/support')) return 'support.manage';
  if (starts('/admin/audit-logs')) return 'audit.view';
  if (starts('/admin/system/flags')) return 'system.flags';
  if (starts('/admin/system/admins') || starts('/admin/system/roles')) return 'admin.manage';
  if (
    starts('/admin/system/settings') ||
    starts('/admin/system/integrations') ||
    starts('/admin/system/notifications') ||
    starts('/admin/system/email-templates')
  ) {
    return 'system.settings';
  }
  return 'super';
}
