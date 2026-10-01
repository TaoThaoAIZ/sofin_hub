import '@fontsource-variable/jetbrains-mono';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useClickOutside } from '../../../lib/useClickOutside';
import { useAuth } from '../../auth/AuthContext';
import { NotificationBell } from '../../notifications/components/NotificationBell';
import { matchNav, requiredPerm, visibleNav } from '../nav';
import { useAdminCommunities, useAdminUsers, useCan, useCases, useIsPlatformAdmin, useModerationSummary } from '../queries';
import { USER_STATUS } from '../types';
import { ROLE_LABEL } from '../types.batch3';
import { useMenu, ToastProvider } from './overlay';
import { AdminAvatar, MONO_FONT } from './ui';

/* ------------------------------ Sidebar ------------------------------ */

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { group: activeGroup, kid: activeKid } = matchNav(pathname);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const can = useCan();
  const summary = useModerationSummary(can('report.resolve'));
  const pendingReports = summary.data?.open ?? 0;
  const nav = visibleNav(can);

  return (
    <aside className="flex h-full w-[260px] flex-none flex-col border-r border-[rgba(120,60,20,.08)] bg-white">
      <Link to="/admin" onClick={onNavigate} className="flex h-[68px] flex-none items-center gap-2.5 px-[22px] text-xl font-extrabold tracking-[-.02em] text-stone-900 no-underline">
        <span className="grid size-8 place-items-center rounded-[9px] bg-gradient-to-b from-[#ff8f45] to-[#f26a1b] text-lg text-white shadow-[0_6px_14px_rgba(242,106,27,.3)]">S</span>
        <span>
          Sofin<span className="text-brand">Hub</span>
        </span>
        <span className="rounded-md bg-[#fff1e6] px-[7px] py-[3px] text-[10.5px] font-bold tracking-[.06em] text-[#c2410c]">ADMIN</span>
      </Link>
      <nav aria-label="Menu quản trị" className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-1.5 pb-4 [scrollbar-width:thin]">
        {nav.map((g) => {
          const on = activeGroup.key === g.key;
          const hasKids = !!g.kids;
          const expanded = hasKids && (open[g.key] ?? on);
          const badge = g.key === 'moderation' && pendingReports > 0 ? (pendingReports > 99 ? '99+' : String(pendingReports)) : '';
          const rowCls = `mb-0.5 flex h-[42px] w-full flex-none items-center gap-3 rounded-xl border-0 px-3 text-left text-sm no-underline ${on ? 'font-bold text-stone-900' : 'font-medium text-stone-700'} ${on && !hasKids ? 'bg-[#fff1e6]' : 'bg-transparent hover:bg-[#faf5f1]'}`;
          const inner = (
            <>
              <MaterialIcon name={g.icon} size={21} filled={on} color={on ? '#f26a1b' : '#78716c'} />
              <span className="min-w-0 flex-1">{g.label}</span>
              {badge && <span className="grid h-5 min-w-6 place-items-center rounded-full bg-brand px-[7px] text-[11px] font-bold text-white">{badge}</span>}
              {hasKids && <MaterialIcon name="expand_more" size={19} color="#a8a29e" className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />}
            </>
          );
          return (
            <div key={g.key}>
              {g.to ? (
                <Link to={g.to} onClick={onNavigate} aria-current={on ? 'page' : undefined} className={rowCls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" aria-expanded={expanded} onClick={() => setOpen((o) => ({ ...o, [g.key]: !expanded }))} className={rowCls}>
                  {inner}
                </button>
              )}
              {expanded && (
                <div className="mt-0.5 mb-1.5 ml-[23px] flex flex-col gap-px border-l-[1.5px] border-[#efe7e1] pl-3.5">
                  {g.kids!.map((k) => {
                    const a = on && activeKid?.key === k.key;
                    return (
                      <Link
                        key={k.key}
                        to={k.to}
                        onClick={onNavigate}
                        aria-current={a ? 'page' : undefined}
                        className={`rounded-[10px] px-3 py-2 text-[13.5px] no-underline ${a ? 'bg-[#fff1e6] font-semibold text-brand' : 'font-medium text-stone-600 hover:bg-[#faf5f1]'}`}
                      >
                        {k.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/* ------------------------------ Tìm kiếm chung ------------------------------ */

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Ô tìm kiếm chung: người dùng, cộng đồng, vụ việc — gọi các API danh sách admin thật (`q`), Ctrl/⌘K để focus. */
function GlobalSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const can = useCan();
  const q = useDebounced(text.trim());
  const enabled = open && q.length >= 2;
  const users = useAdminUsers({ q, limit: 4 }, enabled && can('users.view'));
  const coms = useAdminCommunities({ q, limit: 4, status: 'active,pending_review,changes_requested,rejected,suspended,deleted' }, enabled && can('community.manage'));
  const cases = useCases({ q, limit: 4, status: 'all' }, enabled && can('report.resolve'));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setText('');
    navigate(to);
  };

  const groups = [
    {
      title: 'NGƯỜI DÙNG',
      items: (users.data?.data ?? []).map((u) => ({ icon: 'person', t: u.name, s: u.email, id: USER_STATUS[u.status].label, to: `/admin/users/${u.id}` })),
    },
    {
      title: 'CỘNG ĐỒNG',
      items: (coms.data?.data ?? []).map((c) => ({ icon: 'groups', t: c.name, s: `Chủ sở hữu: ${c.owner.name}`, id: c.id, to: `/admin/communities/${c.id}` })),
    },
    {
      title: 'VỤ VIỆC KIỂM DUYỆT',
      items: (cases.data?.data ?? []).map((c) => ({ icon: 'flag', t: c.content.title || c.caseCode, s: c.reportedUser?.name ?? '', id: c.caseCode, to: `/admin/moderation/cases/${c.id}` })),
    },
  ].filter((g) => g.items.length > 0);
  const loading = enabled && (users.isFetching || coms.isFetching || cases.isFetching);
  const searchable = can('users.view') || can('community.manage') || can('report.resolve');

  return (
    <div ref={ref} className="relative min-w-0 flex-[0_1_520px]">
      <div className="flex h-[42px] items-center gap-2.5 rounded-xl border-[1.5px] border-[#ece5df] bg-white px-3.5 focus-within:border-brand">
        <MaterialIcon name="search" size={20} color="#a8a29e" />
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={searchable ? 'Tìm người dùng, cộng đồng, vụ việc...' : 'Vai trò của bạn không có quyền tìm kiếm chung'}
          disabled={!searchable}
          aria-label="Tìm kiếm toàn hệ thống"
          className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] font-medium outline-0"
        />
        <span className="hidden rounded-md border border-[#ece5df] px-1.5 py-0.5 text-[11px] text-stone-400 sm:inline">⌘K</span>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-[50px] z-[31] max-h-[70vh] overflow-y-auto rounded-2xl border border-[rgba(120,60,20,.1)] bg-white p-2 shadow-[0_20px_50px_rgba(60,30,10,.16)]">
          {q.length < 2 && <div className="px-3 py-3.5 text-[13px] leading-relaxed text-stone-500">Tìm theo tên hoặc email người dùng, tên hoặc mã cộng đồng, mã vụ việc (CASE-…) hoặc nội dung bị báo cáo. Nhập ít nhất 2 ký tự.</div>}
          {q.length >= 2 && loading && groups.length === 0 && <div className="px-3 py-3.5 text-[13px] text-stone-400">Đang tìm…</div>}
          {q.length >= 2 && !loading && groups.length === 0 && <div className="px-3 py-3.5 text-[13px] text-stone-500">Không có kết quả cho "{q}".</div>}
          {groups.map((g) => (
            <div key={g.title}>
              <div className="px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-[.06em] text-stone-400">{g.title}</div>
              {g.items.map((it) => (
                <button key={it.id + it.to} type="button" onClick={() => go(it.to)} className="flex w-full items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left hover:bg-[#fff4ec]">
                  <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-[#fff1e6]">
                    <MaterialIcon name={it.icon} size={18} color="#f26a1b" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{it.t}</span>
                    <span className="block truncate text-xs text-stone-400">{it.s}</span>
                  </span>
                  <span className="text-[11px] text-stone-500" style={{ fontFamily: MONO_FONT }}>
                    {it.id}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Topbar ------------------------------ */

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { openMenu, menuEl } = useMenu();
  const can = useCan();
  const { me } = useIsPlatformAdmin();
  const summary = useModerationSummary(can('report.resolve'));
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : 'Quản trị viên';
  const circle = 'grid size-10 flex-none place-items-center rounded-full border-0 bg-transparent text-stone-800 hover:bg-[#fff1e6]';

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-[rgba(120,60,20,.08)] bg-white px-4 md:px-6">
      <button type="button" onClick={onMenu} aria-label="Mở menu" className={`${circle} lg:!hidden`}>
        <MaterialIcon name="menu" size={24} />
      </button>
      <GlobalSearch />
      <div className="flex-1" />
      <button
        type="button"
        aria-haspopup="menu"
        onClick={(e) =>
          openMenu(
            e,
            [
              { perm: 'report.resolve', icon: 'flag', label: 'Duyệt báo cáo', sub: summary.data ? `${summary.data.open} đang chờ` : undefined, onClick: () => navigate('/admin/moderation') },
              { perm: 'users.view', icon: 'person_search', label: 'Tìm người dùng', onClick: () => navigate('/admin/users') },
              { perm: 'community.manage', icon: 'travel_explore', label: 'Tìm cộng đồng', onClick: () => navigate('/admin/communities') },
              { perm: 'community.manage', icon: 'how_to_reg', label: 'Xét duyệt cộng đồng', onClick: () => navigate('/admin/communities/review') },
              { perm: 'payment.view', icon: 'payments', label: 'Duyệt hoàn tiền', onClick: () => navigate('/admin/payments/refunds') },
              { perm: 'support.manage', icon: 'support_agent', label: 'Ticket hỗ trợ', onClick: () => navigate('/admin/support/tickets') },
              { perm: 'audit.view', icon: 'history', label: 'Xem nhật ký', onClick: () => navigate('/admin/system/audit') },
            ]
              .filter((m) => can(m.perm))
              .map(({ perm: _p, ...m }) => m),
            'THAO TÁC NHANH',
            250,
          )
        }
        className="hidden h-10 flex-none items-center gap-1.5 rounded-[11px] border-[1.5px] border-[#ece5df] bg-white px-3.5 text-[13.5px] font-semibold whitespace-nowrap text-stone-800 hover:bg-[#fff4ec] md:flex"
      >
        <MaterialIcon name="bolt" size={19} filled color="#f26a1b" />
        Thao tác nhanh
      </button>
      <div className="grid size-10 flex-none place-items-center rounded-full text-stone-800 hover:bg-[#fff1e6]">
        <NotificationBell />
      </div>
      <button
        type="button"
        aria-label="Trợ giúp"
        aria-haspopup="menu"
        className={`${circle} hidden sm:grid`}
        onClick={(e) =>
          openMenu(
            e,
            [
              { icon: 'help', label: 'Câu hỏi thường gặp', onClick: () => window.open('/faq', '_blank', 'noopener') },
              { icon: 'gavel', label: 'Điều khoản sử dụng', onClick: () => window.open('/terms', '_blank', 'noopener') },
              { icon: 'policy', label: 'Chính sách bảo mật', onClick: () => window.open('/privacy', '_blank', 'noopener') },
              { icon: 'support_agent', label: 'Liên hệ nền tảng', onClick: () => window.open('/contact', '_blank', 'noopener') },
            ],
            'TRỢ GIÚP',
            250,
          )
        }
      >
        <MaterialIcon name="help" size={22} />
      </button>
      <button
        type="button"
        aria-haspopup="menu"
        aria-label="Tài khoản"
        onClick={(e) =>
          openMenu(
            e,
            [
              { icon: 'badge', label: 'Hồ sơ & cài đặt', sub: user?.email, onClick: () => navigate('/settings') },
              { icon: 'home', label: 'Về trang chủ', onClick: () => navigate('/') },
              { icon: 'logout', label: 'Đăng xuất', danger: true, onClick: () => void logout().then(() => navigate('/login')) },
            ],
            user?.email,
            240,
          )
        }
        className="flex items-center gap-2.5 rounded-full border-0 bg-transparent py-1 pr-2 pl-1 hover:bg-[#fff1e6]"
      >
        <AdminAvatar name={name} src={user?.avatarUrl} size={36} />
        <span className="hidden text-left leading-tight whitespace-nowrap md:block">
          <span className="block text-[13.5px] font-bold">{name}</span>
          <span className="block text-[11.5px] text-stone-500">{me?.adminRole ? (ROLE_LABEL[me.adminRole.key] ?? me.adminRole.name) : 'Quản trị nền tảng'}</span>
        </span>
        <MaterialIcon name="expand_more" size={18} color="#78716c" className="hidden md:inline-block" />
      </button>
      {menuEl}
    </header>
  );
}

/* ------------------------------ Chặn theo quyền ------------------------------ */

/** Trang hiện tại cần quyền mà vai trò của tôi không có -> thông báo "không đủ quyền" ngay trong khung admin. */
function GuardedOutlet() {
  const { pathname } = useLocation();
  const can = useCan();
  const { me } = useIsPlatformAdmin();
  const need = requiredPerm(pathname);
  if (can(need)) return <Outlet />;
  return (
    <div className="grid flex-1 place-items-center py-16 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fee2e2]">
          <MaterialIcon name="lock" size={30} filled color="#dc2626" />
        </span>
        <h1 className="mt-4 mb-1 text-xl font-extrabold">Không đủ quyền</h1>
        <p className="m-0 text-sm leading-relaxed text-stone-600">
          Vai trò {me?.adminRole ? <b>{ROLE_LABEL[me.adminRole.key] ?? me.adminRole.name}</b> : 'hiện tại'} của bạn chưa được cấp quyền truy cập mục này. Liên hệ Super Admin nếu bạn cần thêm quyền.
        </p>
        <Link to="/admin" className="mt-5 inline-flex h-10 items-center rounded-[11px] bg-gradient-to-b from-[#ff8f45] to-[#f26a1b] px-[15px] text-[13.5px] font-semibold text-white no-underline shadow-[0_6px_16px_rgba(242,106,27,.28)]">
          Về tổng quan
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------ Khung chính ------------------------------ */

function Shell() {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="flex min-h-screen bg-[#faf8f6] font-sans text-stone-900">
      <div className="sticky top-0 hidden h-screen flex-none lg:block">
        <Sidebar />
      </div>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(28,25,23,.4)]" onClick={() => setDrawer(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawer(true)} />
        <main className="box-border flex w-full flex-1 flex-col gap-5 px-4 pt-[22px] pb-12 md:px-6">
          <GuardedOutlet />
        </main>
      </div>
    </div>
  );
}

/** Layout của /admin/*: chỉ Platform Admin vào được; người khác thấy thông báo "không có quyền". */
export function AdminLayout() {
  const { status } = useAuth();
  const location = useLocation();
  const { isAdmin, isLoading } = useIsPlatformAdmin();

  if (status === 'loading' || isLoading) {
    return (
      <div role="status" className="grid min-h-screen place-items-center bg-[#faf8f6] text-stone-400">
        Đang kiểm tra quyền…
      </div>
    );
  }
  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#faf8f6] p-6 text-center">
        <div className="max-w-sm">
          <MaterialIcon name="lock" size={36} filled color="#f26a1b" />
          <p className="mt-2 mb-4 text-stone-600">Bạn cần đăng nhập để vào khu vực quản trị.</p>
          <Link to="/login" state={{ from: location.pathname + location.search }} className="inline-flex h-10 items-center rounded-[14px] bg-brand px-[18px] text-sm font-semibold text-white no-underline">
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#faf8f6] p-6 text-center">
        <div className="max-w-sm">
          <MaterialIcon name="block" size={36} filled color="#dc2626" />
          <h1 className="mt-2 mb-1 text-xl font-extrabold">Không có quyền truy cập</h1>
          <p className="m-0 text-stone-600">Bạn không có quyền truy cập khu vực quản trị.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-brand">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
