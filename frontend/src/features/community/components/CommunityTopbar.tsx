import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useClickOutside } from '../../../lib/useClickOutside';
import { useIsPlatformAdmin } from '../../admin/queries';
import { useAuth } from '../../auth/AuthContext';
import { useCommunityDetail } from '../../courses/queries';
import { MessagesButton } from '../../messages/components/MessagesButton';
import { NotificationBell } from '../../notifications/components/NotificationBell';
import { SearchBox } from '../../search/components/SearchBox';

const MENU_ITEM = 'rounded-xl px-3 py-2 hover:bg-brand/10 hover:text-brand';

/** Thanh trên cùng của khu vực cộng đồng (theo file thiết kế SofinHub Community.html): logo, tìm kiếm ⌘K, ngôn ngữ, thông báo, tin nhắn, tài khoản. */
export function CommunityTopbar({ courseId }: { courseId: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useClickOutside(menuRef, () => setMenuOpen(false));
  const { isAdmin } = useIsPlatformAdmin();
  const { data: course } = useCommunityDetail(courseId);
  const canSeeRevenue = course?.viewerRole === 'owner' || course?.viewerRole === 'platform_admin';

  const initials = user ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) ?? ''}`.toUpperCase() : '?';
  const close = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 flex h-[58px] items-center gap-4 border-b border-[rgba(120,60,20,.08)] bg-white/95 px-4 backdrop-blur md:px-6">
      <Link to="/" className="flex-none leading-none">
        <img src="/images/logo.png" alt="SofinHub" className="block h-9 w-auto" />
      </Link>

      <SearchBox />

      <div className="ml-auto flex flex-none items-center gap-5 text-sm font-medium">
        <span className="flex items-center gap-1.5 max-md:hidden">
          <MaterialIcon name="language" size={20} />
          VI
        </span>
        <div className="max-md:hidden">
          <MessagesButton />
        </div>
        <div className="max-md:hidden">
          <NotificationBell />
        </div>
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1.5" aria-label="Tài khoản">
            <span className="grid size-9 place-items-center rounded-full bg-[#f5dcc8] text-[13px] font-bold text-stone-800">{initials}</span>
            <MaterialIcon name="expand_more" size={20} />
          </button>
          {menuOpen && (
            <div className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-56 flex-col gap-0.5 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white p-2 text-sm shadow-lg">
              <div className="truncate px-3 py-1.5 text-stone-500">{user?.email}</div>
              <Link to="/" onClick={close} className={MENU_ITEM}>
                Về trang chủ
              </Link>
              <Link to="/settings" onClick={close} className={MENU_ITEM}>
                Hồ sơ & cài đặt
              </Link>
              <Link to="/me/communities" onClick={close} className={MENU_ITEM}>
                Cộng đồng của tôi
              </Link>
              <Link to="/notifications" onClick={close} className={MENU_ITEM}>
                Thông báo
              </Link>
              <Link to="/messages" onClick={close} className={MENU_ITEM}>
                Tin nhắn
              </Link>
              <Link to="/billing" onClick={close} className={MENU_ITEM}>
                Gói & thanh toán
              </Link>
              {canSeeRevenue && (
                <Link to={`/communities/${courseId}/revenue-dashboard`} onClick={close} className={MENU_ITEM}>
                  Doanh thu & rút tiền
                </Link>
              )}
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
