import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useIsPlatformAdmin } from '../../features/admin/queries';
import { useAuth } from '../../features/auth/AuthContext';
import { MessagesButton } from '../../features/messages/components/MessagesButton';
import { NotificationBell } from '../../features/notifications/components/NotificationBell';
import { useClickOutside } from '../../lib/useClickOutside';
import { ButtonLink } from '../ui/Button';
import { GlobeIcon } from '../ui/icons';

// Chỉ giữ các mục có route thật.
const NAV_ITEMS: { label: string; to: string }[] = [
  { label: 'Khám phá', to: '/' },
  { label: 'Khóa học', to: '/#courses' },
  { label: 'Cộng đồng của tôi', to: '/me/communities' },
];

export function Header({ active = 'Khám phá' }: { active?: string }) {
  const { user, status, logout } = useAuth();
  const { isAdmin } = useIsPlatformAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false));

  const doLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="glass sticky top-3 z-20 mx-auto mt-3.5 flex w-[calc(100%-32px)] max-w-[1320px] items-center gap-[clamp(16px,3vw,40px)] rounded-[22px] py-2 pr-2 pl-4 md:w-[calc(100%-80px)] md:pl-6">
      <Link to="/" className="block flex-none leading-none">
        <img src="/images/logo.png" alt="SofinHub" className="block h-10 w-auto" />
      </Link>

      <nav className="hidden h-[22px] min-w-0 flex-1 flex-wrap items-center justify-center gap-x-[clamp(16px,2.5vw,40px)] gap-y-10 overflow-hidden text-[15px] leading-[22px] font-medium whitespace-nowrap md:flex">
        {NAV_ITEMS.map((item) => {
          const className = item.label === active ? 'font-semibold text-brand' : 'text-stone-900 hover:text-brand';
          return (
            <Link key={item.label} to={item.to} className={className}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex flex-none items-center gap-3 whitespace-nowrap md:ml-0">
        {status === 'authenticated' && (
          <div className="hidden items-center gap-3 sm:flex">
            <MessagesButton variant="header" />
            <NotificationBell variant="header" />
          </div>
        )}
        <div className="hidden items-center gap-1.5 px-2 text-sm font-medium lg:flex">
          <GlobeIcon size={18} />
          VI
        </div>

        {status === 'authenticated' && user ? (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="glass flex h-10 items-center gap-2 rounded-[14px] pr-3.5 pl-1.5 text-sm font-medium"
            >
              <span className="bg-brand-gradient grid size-7 place-items-center rounded-full text-[13px] font-bold text-white">
                {user.firstName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[120px] truncate sm:inline">{user.firstName}</span>
            </button>
            {menuOpen && (
              <div className="absolute top-[calc(100%+8px)] right-0 z-30 flex w-56 flex-col gap-1 rounded-2xl border border-[rgba(120,60,20,.1)] bg-white p-2 text-sm shadow-[0_16px_40px_rgba(120,60,20,.18)]">
                <div className="truncate px-3 py-1.5 text-stone-500">{user.email}</div>
                {[
                  { label: 'Cài đặt hồ sơ', to: '/settings' },
                  ...(isAdmin ? [{ label: 'Quản trị', to: '/admin' }] : []),
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-2 text-left font-medium text-stone-900 hover:bg-brand/10 hover:text-brand"
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={doLogout}
                  className="rounded-xl px-3 py-2 text-left font-medium text-stone-900 hover:bg-brand/10 hover:text-brand"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            state={{ from: location.pathname }}
            className="glass hidden h-10 items-center rounded-[14px] px-4 text-sm font-medium sm:flex"
          >
            Đăng nhập
          </Link>
        )}

        <ButtonLink to="/communities/new" className="h-10 rounded-[14px] px-[18px] text-sm font-semibold">
          Tạo cộng đồng
        </ButtonLink>
      </div>
    </header>
  );
}
