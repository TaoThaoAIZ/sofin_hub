import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { useClickOutside } from '../../lib/useClickOutside';
import { useIsPlatformAdmin } from '../admin/queries';
import { useAuth } from '../auth/AuthContext';
import { MessagesButton } from '../messages/components/MessagesButton';
import { NotificationBell } from '../notifications/components/NotificationBell';
import { SearchBox } from '../search/components/SearchBox';

const MENU_ITEM = 'rounded-xl px-3 py-2 hover:bg-brand/10 hover:text-brand';

/** Thanh trên của trang Cài đặt (thiết kế "Cai dat ho so"): logo, tìm kiếm, tin nhắn, thông báo, avatar. */
export function SettingsTopbar() {
  const { user, logout } = useAuth();
  const { isAdmin } = useIsPlatformAdmin();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useClickOutside(menuRef, () => setOpen(false));
  const close = () => setOpen(false);
  const ini = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '?';

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-4 border-b border-[rgba(120,60,20,.07)] bg-white px-4 md:gap-7 md:px-8">
      <Link to="/" className="block flex-none leading-none">
        <img src="/images/logo.png" alt="SofinHub" className="block h-8 w-auto" />
      </Link>
      <div className="min-w-0 flex-[0_1_440px] max-sm:hidden">
        <SearchBox placeholder="Tìm cộng đồng, bài viết, khóa học..." />
      </div>
      <div className="flex-1" />
      <div className="flex flex-none items-center gap-1">
        <MessagesButton />
        <NotificationBell />
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Tài khoản" aria-expanded={open} className="flex items-center gap-1.5 border-0 bg-transparent p-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="size-[42px] rounded-full object-cover" />
            ) : (
              <span className="grid size-[42px] place-items-center rounded-full bg-[#2f4fa8] text-[15px] font-bold text-white">{ini}</span>
            )}
            <MaterialIcon name="expand_more" size={20} color="#57534e" />
          </button>
          {open && (
            <div className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-56 flex-col gap-0.5 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white p-2 text-sm shadow-lg">
              <div className="truncate px-3 py-1.5 text-stone-500">{user?.email}</div>
              <Link to="/" onClick={close} className={MENU_ITEM}>
                Về trang chủ
              </Link>
              <Link to="/settings" onClick={close} className={MENU_ITEM}>
                Hồ sơ & cài đặt
              </Link>
              <Link to="/messages" onClick={close} className={MENU_ITEM}>
                Tin nhắn
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={close} className={MENU_ITEM}>
                  Quản trị
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  close();
                  await logout();
                  navigate('/');
                }}
                className={`${MENU_ITEM} text-left`}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
