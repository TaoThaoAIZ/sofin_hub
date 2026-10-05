import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { ToastProvider } from '../admin/components/overlay';
import { RequireAuth } from '../auth/RequireAuth';
import { Header } from '../../components/layout/Header';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  divider?: boolean;
}

const NAV: NavItem[] = [
  { to: '/settings', icon: 'person', label: 'Hồ sơ' },
  { to: '/settings/thong-bao', icon: 'notifications', label: 'Thông báo' },
  { to: '/settings/bao-mat', icon: 'lock', label: 'Tài khoản & bảo mật' },
  { to: '/settings/thanh-toan', icon: 'credit_card', label: 'Thanh toán' },
  { to: '/settings/cong-dong', icon: 'group', label: 'Cộng đồng của tôi', divider: true },
  { to: '/settings/gioi-thieu', icon: 'redeem', label: 'Chương trình giới thiệu' },
];

function SideNav() {
  return (
    <>
      <div className="flex items-center gap-3.5 px-2 pb-3.5">
        <span className="text-[26px] font-extrabold tracking-[-.02em]">Cài đặt</span>
      </div>
      <nav aria-label="Cài đặt" className="flex flex-col gap-1">
        {NAV.map((n) => (
          <div key={n.to}>
            {n.divider && <div className="mx-2.5 my-2.5 h-px bg-[#efe9e4]" />}
            <NavLink
              to={n.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-[14px] px-2.5 py-[9px] text-[15.5px] no-underline ${
                  isActive ? 'bg-gradient-to-r from-[#ffe9da] to-[#fff3ea] font-bold text-brand' : 'font-medium text-stone-800 hover:bg-[#faf5f1]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid size-[38px] flex-none place-items-center rounded-full ${
                      isActive ? 'bg-gradient-to-b from-[#ff8f45] to-[#f26a1b]' : 'border border-[#efe9e4] bg-white'
                    }`}
                  >
                    <MaterialIcon name={n.icon} size={21} filled={isActive} color={isActive ? '#fff' : '#292524'} />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          </div>
        ))}
      </nav>
    </>
  );
}

/**
 * Khung trang Cài đặt (thiết kế "Cai dat ho so"): header chung + sidebar 6 mục + vùng nội dung (route lồng).
 * Tab Hồ sơ có thêm cột xem trước ở bên phải (≥1240px), nên lưới 3 cột chỉ áp cho tab đó.
 */
export function SettingsLayout() {
  const { pathname } = useLocation();
  const isProfile = pathname === '/settings' || pathname === '/settings/';
  return (
    <RequireAuth>
      <ToastProvider>
        <div className="flex min-h-screen flex-col bg-[#faf8f6]">
          <Header active="" />
          <div
            className={`mx-auto grid w-[calc(100%-32px)] max-w-[1320px] flex-1 items-start gap-[18px] pt-5 pb-7 md:w-[calc(100%-80px)] min-[900px]:grid-cols-[250px_minmax(0,1fr)] min-[1240px]:grid-cols-[280px_minmax(0,1fr)] ${
              isProfile ? 'min-[1240px]:grid-cols-[280px_minmax(0,1fr)_380px]' : ''
            }`}
          >
            <aside className="flex flex-col gap-1 self-start rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-3.5 pt-5 pb-3.5 min-[900px]:sticky min-[900px]:top-[88px] min-[900px]:row-span-2 min-[900px]:min-h-[calc(100vh-108px)] min-[1240px]:row-span-1">
              <SideNav />
            </aside>
            <Outlet />
          </div>
        </div>
      </ToastProvider>
    </RequireAuth>
  );
}
