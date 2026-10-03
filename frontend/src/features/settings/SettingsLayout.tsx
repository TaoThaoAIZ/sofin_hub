import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { ToastProvider } from '../admin/components/overlay';
import { RequireAuth } from '../auth/RequireAuth';
import { SettingsTopbar } from './SettingsTopbar';

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

interface Promo {
  icon: string;
  title: string;
  text: string;
  cta: string;
  to: string;
}

/** Thẻ quảng bá cuối sidebar đổi theo tab (đúng nội dung thiết kế). */
const PROMO: Record<string, Promo> = {
  '/settings': { icon: 'crown', title: 'Nâng cấp tài khoản', text: 'Mở khóa thêm nhiều tính năng để phát triển cộng đồng của bạn.', cta: 'Khám phá ngay', to: '/communities/new' },
  '/settings/bao-mat': { icon: 'shield', title: 'Bảo vệ tài khoản', text: 'Kích hoạt xác minh 2 bước để tăng cường bảo mật cho tài khoản của bạn.', cta: 'Tìm hiểu thêm', to: '/settings/bao-mat?2fa=1' },
  '/settings/thanh-toan': { icon: 'credit_card', title: 'Quản lý thanh toán dễ dàng', text: 'Theo dõi chi tiêu, hóa đơn và nâng cấp gói linh hoạt.', cta: 'Tìm hiểu thêm', to: '/settings/thanh-toan' },
  '/settings/cong-dong': { icon: 'groups', title: 'Khám phá thêm nhiều cộng đồng', text: 'Kết nối, học hỏi và phát triển cùng những người cùng chí hướng.', cta: 'Khám phá ngay', to: '/search' },
  '/settings/gioi-thieu': { icon: 'redeem', title: 'Mời bạn bè, nhận hoa hồng', text: 'Cùng phát triển cộng đồng và nhận thu nhập thụ động.', cta: 'Tìm hiểu thêm', to: '/settings/gioi-thieu' },
};

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

function PromoCard({ promo }: { promo: Promo }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#fff4ea] to-[#ffe6d2] px-[18px] py-5">
      <MaterialIcon name={promo.icon} size={34} filled color="#f26a1b" />
      <div className="mt-2.5 text-base font-extrabold">{promo.title}</div>
      <div className="mt-1.5 text-[13px] leading-[1.55] text-stone-600">{promo.text}</div>
      <Link to={promo.to} className="mt-3.5 inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-white px-3.5 text-sm font-bold text-brand no-underline">
        {promo.cta}
        <MaterialIcon name="arrow_forward" size={18} />
      </Link>
    </div>
  );
}

/**
 * Khung trang Cài đặt (thiết kế "Cai dat ho so"): topbar + sidebar 6 mục + vùng nội dung (route lồng).
 * Tab Hồ sơ có thêm cột xem trước ở bên phải (≥1240px), nên lưới 3 cột chỉ áp cho tab đó.
 */
export function SettingsLayout() {
  const { pathname } = useLocation();
  const isProfile = pathname === '/settings' || pathname === '/settings/';
  const promo = PROMO[pathname.replace(/\/$/, '')] ?? PROMO['/settings']!;
  return (
    <RequireAuth>
      <ToastProvider>
        <div className="flex min-h-screen flex-col bg-[#faf8f6]">
          <SettingsTopbar />
          <div
            className={`grid flex-1 items-start gap-[18px] px-4 pt-5 pb-7 md:px-6 min-[900px]:grid-cols-[250px_minmax(0,1fr)] min-[1240px]:grid-cols-[280px_minmax(0,1fr)] ${
              isProfile ? 'min-[1240px]:grid-cols-[280px_minmax(0,1fr)_380px]' : ''
            }`}
          >
            <aside className="flex flex-col gap-1 self-start rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-3.5 pt-5 pb-3.5 min-[900px]:sticky min-[900px]:top-[88px] min-[900px]:row-span-2 min-[900px]:min-h-[calc(100vh-108px)] min-[1240px]:row-span-1">
              <SideNav />
              <div className="min-h-6 flex-1" />
              <PromoCard promo={promo} />
            </aside>
            <Outlet />
          </div>
        </div>
      </ToastProvider>
    </RequireAuth>
  );
}
