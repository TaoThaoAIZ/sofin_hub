/**
 * Menu bên trái của Admin — đủ 10 nhóm + submenu đúng bản thiết kế (nhãn tiếng Việt theo từ điển của bản thiết kế).
 * `perm` = khóa quyền cần có (theo ma trận ở backend/docs/api/admin-batch3.md); không có = ai là nhân viên cũng vào được.
 * Quyền của mục con ghi đè quyền của nhóm. Nhóm không còn mục con nào truy cập được sẽ bị ẩn.
 */

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

const kid = (group: string, key: string, label: string, to?: string, perm?: string): NavKid => ({ key, label, to: to ?? `/admin/${group}/${key}`, perm });

export const ADMIN_NAV: NavGroup[] = [
  { key: 'dash', icon: 'space_dashboard', label: 'Tổng quan', to: '/admin', perm: 'dashboard.view' },
  {
    key: 'communities',
    perm: 'community.manage',
    icon: 'groups',
    label: 'Cộng đồng',
    kids: [
      kid('communities', 'list', 'Danh sách cộng đồng', '/admin/communities'),
      kid('communities', 'review', 'Xét duyệt', '/admin/communities/review'),
      kid('communities', 'suspend', 'Tạm ngưng', '/admin/communities/suspended'),
      kid('communities', 'trash', 'Xóa / Khôi phục', '/admin/communities/trash'),
    ],
  },
  {
    key: 'users',
    perm: 'users.view',
    icon: 'person',
    label: 'Người dùng',
    kids: [
      kid('users', 'all', 'Tất cả người dùng', '/admin/users'),
      kid('users', 'restrict', 'Hạn chế / Tạm ngưng', '/admin/users/restricted'),
      kid('users', 'ban', 'Cấm', '/admin/users/banned'),
    ],
  },
  {
    key: 'content',
    perm: 'content.manage',
    icon: 'article',
    label: 'Nội dung',
    kids: [
      kid('content', 'posts', 'Bài viết'),
      kid('content', 'comments', 'Bình luận'),
      kid('content', 'courses', 'Khóa học'),
      kid('content', 'lessons', 'Bài học'),
      kid('content', 'events', 'Sự kiện'),
      kid('content', 'media', 'Media'),
    ],
  },
  {
    key: 'moderation',
    perm: 'report.resolve',
    icon: 'shield_person',
    label: 'Kiểm duyệt',
    kids: [
      kid('moderation', 'queue', 'Hàng đợi báo cáo', '/admin/moderation'),
      kid('moderation', 'warning', 'Cảnh cáo', '/admin/moderation/warnings'),
      kid('moderation', 'remove', 'Gỡ nội dung', '/admin/moderation/removals'),
      kid('moderation', 'suspend', 'Tạm ngưng', '/admin/moderation/suspensions'),
      kid('moderation', 'ban', 'Cấm', '/admin/moderation/bans'),
    ],
  },
  {
    key: 'payments',
    perm: 'payment.view',
    icon: 'payments',
    label: 'Thanh toán',
    kids: [
      kid('payments', 'tx', 'Giao dịch'),
      kid('payments', 'subs', 'Gói đăng ký'),
      kid('payments', 'refunds', 'Hoàn tiền'),
      kid('payments', 'chargebacks', 'Tranh chấp thanh toán'),
      kid('payments', 'creator', 'Doanh thu creator'),
      kid('payments', 'payouts', 'Chi trả'),
    ],
  },
  {
    key: 'discovery',
    perm: 'community.manage',
    icon: 'explore',
    label: 'Khám phá',
    kids: [
      kid('discovery', 'listed', 'Cộng đồng hiển thị'),
      kid('discovery', 'categories', 'Danh mục'),
      kid('discovery', 'featured', 'Nổi bật'),
      kid('discovery', 'rankings', 'Xếp hạng'),
      kid('discovery', 'seo', 'Hiển thị tìm kiếm'),
    ],
  },
  {
    key: 'analytics',
    perm: 'analytics.view',
    icon: 'monitoring',
    label: 'Phân tích',
    kids: [
      kid('analytics', 'users', 'Người dùng'),
      kid('analytics', 'communities', 'Cộng đồng'),
      kid('analytics', 'engagement', 'Tương tác'),
      kid('analytics', 'retention', 'Giữ chân'),
      kid('analytics', 'revenue', 'Doanh thu'),
      kid('analytics', 'conversion', 'Chuyển đổi'),
    ],
  },
  {
    key: 'support',
    perm: 'support.manage',
    icon: 'support_agent',
    label: 'Hỗ trợ',
    kids: [kid('support', 'tickets', 'Ticket hỗ trợ'), kid('support', 'user', 'Vấn đề người dùng'), kid('support', 'creator', 'Vấn đề creator'), kid('support', 'payment', 'Vấn đề thanh toán')],
  },
  {
    key: 'system',
    icon: 'settings',
    label: 'Hệ thống',
    kids: [
      kid('system', 'admins', 'Tài khoản quản trị', undefined, 'admin.manage'),
      kid('system', 'roles', 'Vai trò & Quyền', undefined, 'admin.manage'),
      kid('system', 'categories', 'Danh mục', undefined, 'community.manage'),
      kid('system', 'flags', 'Tính năng thử nghiệm', undefined, 'system.flags'),
      kid('system', 'integrations', 'Tích hợp', undefined, 'system.settings'),
      kid('system', 'notifications', 'Thông báo', undefined, 'system.settings'),
      kid('system', 'email', 'Mẫu email', undefined, 'system.settings'),
      kid('system', 'audit', 'Nhật ký hoạt động', undefined, 'audit.view'),
      kid('system', 'settings', 'Cài đặt chung', undefined, 'system.settings'),
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
