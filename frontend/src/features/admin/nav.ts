/**
 * Menu bên trái của Admin — đủ 10 nhóm + submenu đúng bản thiết kế (nhãn tiếng Việt theo từ điển của bản thiết kế).
 * `perm` = khóa quyền cần có (theo ma trận ở backend/docs/api/admin-batch3.md); không có = ai là nhân viên cũng vào được.
 * Quyền của mục con ghi đè quyền của nhóm. Nhóm không còn mục con nào truy cập được sẽ bị ẩn.
 */

import { tl } from './types';

export interface NavKid {
  key: string;
  label: string;
  to: string;
  perm?: string;
}

export interface NavGroup {
  key: string;
  icon: string;
  label: string;
  /** Quyền mặc định cho cả nhóm. */
  perm?: string;
  /** Đường dẫn khi nhóm không có submenu (Tổng quan). */
  to?: string;
  kids?: NavKid[];
}

const kid = (group: string, key: string, to?: string, perm?: string): NavKid => ({ key, get label() { return tl(`nav.kids.${group}_${key}`); }, to: to ?? `/admin/${group}/${key}`, perm });

export const ADMIN_NAV: NavGroup[] = [
  { key: 'dash', icon: 'space_dashboard', get label() { return tl('nav.groups.dash'); }, to: '/admin', perm: 'dashboard.view' },
  {
    key: 'communities',
    perm: 'community.manage',
    icon: 'groups',
    get label() { return tl('nav.groups.communities'); },
    kids: [
      kid('communities', 'list', '/admin/communities'),
      kid('communities', 'review', '/admin/communities/review'),
      kid('communities', 'suspend', '/admin/communities/suspended'),
      kid('communities', 'trash', '/admin/communities/trash'),
    ],
  },
  {
    key: 'users',
    perm: 'users.view',
    icon: 'person',
    get label() { return tl('nav.groups.users'); },
    kids: [
      kid('users', 'all', '/admin/users'),
      kid('users', 'restrict', '/admin/users/restricted'),
      kid('users', 'ban', '/admin/users/banned'),
    ],
  },
  {
    key: 'content',
    perm: 'content.manage',
    icon: 'article',
    get label() { return tl('nav.groups.content'); },
    kids: [
      kid('content', 'posts'),
      kid('content', 'comments'),
      kid('content', 'courses'),
      kid('content', 'lessons'),
      kid('content', 'events'),
      kid('content', 'media'),
    ],
  },
  {
    key: 'moderation',
    perm: 'report.resolve',
    icon: 'shield_person',
    get label() { return tl('nav.groups.moderation'); },
    kids: [
      kid('moderation', 'queue', '/admin/moderation'),
      kid('moderation', 'warning', '/admin/moderation/warnings'),
      kid('moderation', 'remove', '/admin/moderation/removals'),
      kid('moderation', 'suspend', '/admin/moderation/suspensions'),
      kid('moderation', 'ban', '/admin/moderation/bans'),
    ],
  },
  {
    key: 'payments',
    perm: 'payment.view',
    icon: 'payments',
    get label() { return tl('nav.groups.payments'); },
    kids: [
      kid('payments', 'tx'),
      kid('payments', 'subs'),
      kid('payments', 'refunds'),
      kid('payments', 'chargebacks'),
      kid('payments', 'creator'),
      kid('payments', 'payouts'),
      kid('payments', 'bank'),
    ],
  },
  {
    key: 'discovery',
    perm: 'community.manage',
    icon: 'explore',
    get label() { return tl('nav.groups.discovery'); },
    kids: [
      kid('discovery', 'listed'),
      kid('discovery', 'categories'),
      kid('discovery', 'featured'),
      kid('discovery', 'rankings'),
      kid('discovery', 'seo'),
    ],
  },
  {
    key: 'analytics',
    perm: 'analytics.view',
    icon: 'monitoring',
    get label() { return tl('nav.groups.analytics'); },
    kids: [
      kid('analytics', 'users'),
      kid('analytics', 'communities'),
      kid('analytics', 'engagement'),
      kid('analytics', 'retention'),
      kid('analytics', 'revenue'),
      kid('analytics', 'conversion'),
    ],
  },
  {
    key: 'support',
    perm: 'support.manage',
    icon: 'support_agent',
    get label() { return tl('nav.groups.support'); },
    kids: [kid('support', 'tickets'), kid('support', 'user'), kid('support', 'creator'), kid('support', 'payment')],
  },
  {
    key: 'system',
    icon: 'settings',
    get label() { return tl('nav.groups.system'); },
    kids: [
      kid('system', 'admins', undefined, 'admin.manage'),
      kid('system', 'roles', undefined, 'admin.manage'),
      kid('system', 'categories', undefined, 'community.manage'),
      kid('system', 'flags', undefined, 'system.flags'),
      kid('system', 'integrations', undefined, 'system.settings'),
      kid('system', 'notifications', undefined, 'system.settings'),
      kid('system', 'email', undefined, 'system.settings'),
      kid('system', 'audit', undefined, 'audit.view'),
      kid('system', 'settings', undefined, 'system.settings'),
    ],
  },
];

export interface Crumb {
  label: string;
  to?: string;
}

/** Tìm nhóm + mục con khớp đường dẫn hiện tại (khớp chính xác, rồi khớp tiền tố cho trang chi tiết). */
export function matchNav(pathname: string): { group: NavGroup; kid: NavKid | null } {
  const path = pathname.replace(/\/$/, '') || '/admin';
  const dash = ADMIN_NAV[0]!;
  let best: { group: NavGroup; kid: NavKid | null; len: number } | null = null;
  for (const group of ADMIN_NAV) {
    if (group.to) {
      if (path === group.to) return { group, kid: null };
      continue;
    }
    for (const k of group.kids ?? []) {
      const exact = path === k.to;
      const prefix = path.startsWith(`${k.to}/`);
      if (exact) return { group, kid: k };
      // Trang chi tiết (vd. /admin/users/:id thuộc "Tất cả người dùng"): lấy tiền tố dài nhất.
      if (prefix && (!best || k.to.length > best.len)) best = { group, kid: k, len: k.to.length };
    }
  }
  if (best) return { group: best.group, kid: best.kid };
  // Trang chi tiết nằm dưới đường dẫn nhóm nhưng không khớp mục con nào (vd. /admin/users/:id, /admin/moderation/cases/:id).
  const byGroup = ADMIN_NAV.find((g) => g.kids && path.startsWith(`/admin/${g.key}`));
  if (byGroup) return { group: byGroup, kid: byGroup.kids![0] ?? null };
  return { group: dash, kid: null };
}

export type CanFn = (perm: string | undefined) => boolean;

/** Quyền cần để vào đường dẫn hiện tại (mục con ghi đè nhóm). */
export function requiredPerm(pathname: string): string | undefined {
  const { group, kid } = matchNav(pathname);
  return kid?.perm ?? group.perm;
}

/** Menu đã lọc theo quyền: bỏ mục con không có quyền, bỏ nhóm không còn mục nào. */
export function visibleNav(can: CanFn): NavGroup[] {
  return ADMIN_NAV.flatMap((g) => {
    if (g.to) return can(g.perm) ? [g] : [];
    const kids = (g.kids ?? []).filter((k) => can(k.perm ?? g.perm));
    return kids.length > 0 ? [{ ...g, kids }] : [];
  });
}
