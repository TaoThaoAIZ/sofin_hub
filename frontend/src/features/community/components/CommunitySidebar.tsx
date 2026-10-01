import { Link, NavLink, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useCommunityDetail } from '../../courses/queries';
import { isModPlus } from './contentUi';

// Tên icon lấy đúng từ file thiết kế gốc SofinHub Community.html (font Material Symbols Rounded).
const NAV_ICONS = {
  feed: 'groups',
  classroom: 'school',
  calendar: 'calendar_month',
  members: 'group',
  leaderboard: 'leaderboard',
  about: 'info',
};

export interface CommunityNavItem {
  key: string;
  to: string;
  label: string;
  icon: keyof typeof NAV_ICONS;
  end?: boolean;
}

// Nhãn tab đầu tiên là "Cộng đồng" (đúng theo file thiết kế gốc) dù nội dung hiển thị là Bảng tin.
export const COMMUNITY_NAV_ITEMS: CommunityNavItem[] = [
  { key: 'feed', to: '', label: 'Cộng đồng', icon: 'feed', end: true },
  { key: 'classroom', to: 'lop-hoc', label: 'Lớp học', icon: 'classroom' },
  { key: 'calendar', to: 'lich', label: 'Lịch sự kiện', icon: 'calendar' },
  { key: 'members', to: 'thanh-vien', label: 'Thành viên', icon: 'members' },
  { key: 'leaderboard', to: 'xep-hang', label: 'Bảng xếp hạng', icon: 'leaderboard' },
  { key: 'about', to: 'gioi-thieu', label: 'Giới thiệu', icon: 'about' },
];

export function CommunitySidebar({ courseTitle }: { courseTitle: string }) {
  const { id: courseId = '' } = useParams();
  const { data: viewerCourse } = useCommunityDetail(courseId);
  return (
    <aside className="glass sticky top-[70px] flex h-[calc(100vh-82px)] flex-col gap-1 overflow-auto rounded-3xl p-3 max-md:hidden">
      <div className="flex items-center gap-3 border-b border-[rgba(120,60,20,.08)] px-2 pt-1 pb-4">
        <span className="grid size-11 flex-none place-items-center rounded-xl bg-[#0f1a2e] text-sm font-bold text-white">
          {courseTitle.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 text-[15px] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap overflow-hidden">
          {courseTitle}
        </div>
      </div>
      <nav className="mt-2 flex flex-col gap-1">
        {COMMUNITY_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] ${
                isActive ? 'bg-brand-soft font-semibold text-brand' : 'font-normal text-stone-900 hover:bg-stone-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <MaterialIcon name={NAV_ICONS[item.icon]} size={21} weight={isActive ? 500 : 400} color="currentColor" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        {isModPlus(viewerCourse?.viewerRole) && (
          <NavLink
            to="kiem-duyet"
            className={({ isActive }) =>
              `flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] ${
                isActive ? 'bg-brand-soft font-semibold text-brand' : 'font-normal text-stone-900 hover:bg-stone-50'
              }`
            }
          >
            <MaterialIcon name="shield" size={21} color="currentColor" />
            Kiểm duyệt
          </NavLink>
        )}
      </nav>

      <div className="relative mt-auto overflow-hidden rounded-2xl border border-white/90 bg-gradient-to-br from-brand-soft to-[#ffe0cb] p-4 text-center">
        <div className="relative mx-auto mt-1 mb-2.5" style={{ width: 150, height: 88 }}>
          <div
            className="absolute"
            style={{ left: 4, top: 44, width: 142, height: 36, borderRadius: '50%', border: '3px solid rgba(255,190,140,.55)', transform: 'rotate(-8deg)' }}
          />
          <div
            className="absolute"
            style={{
              left: 28,
              top: 20,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 32% 28%,#ffd2a8 0%,#ff9a4d 45%,#e8520c 100%)',
              boxShadow: 'inset -3px -4px 8px rgba(160,40,0,.25), 0 4px 10px rgba(242,106,27,.25)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: 20,
              top: 42,
              width: 38,
              height: 30,
              borderRadius: '19px 19px 8px 8px',
              background: 'radial-gradient(ellipse at 35% 20%,#ffcfa3 0%,#ff9a4d 50%,#e8520c 100%)',
              boxShadow: 'inset -4px -5px 10px rgba(160,40,0,.22), 0 6px 14px rgba(242,106,27,.25)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: 98,
              top: 20,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 32% 28%,#ffd2a8 0%,#ff9a4d 45%,#e8520c 100%)',
              boxShadow: 'inset -3px -4px 8px rgba(160,40,0,.25), 0 4px 10px rgba(242,106,27,.25)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: 92,
              top: 42,
              width: 38,
              height: 30,
              borderRadius: '19px 19px 8px 8px',
              background: 'radial-gradient(ellipse at 35% 20%,#ffcfa3 0%,#ff9a4d 50%,#e8520c 100%)',
              boxShadow: 'inset -4px -5px 10px rgba(160,40,0,.22), 0 6px 14px rgba(242,106,27,.25)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: 58,
              top: 4,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 32% 28%,#ffd2a8 0%,#ff8a3d 45%,#e8520c 100%)',
              boxShadow: 'inset -3px -4px 8px rgba(160,40,0,.25), 0 4px 10px rgba(242,106,27,.25)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: 46,
              top: 38,
              width: 58,
              height: 38,
              borderRadius: '29px 29px 8px 8px',
              background: 'radial-gradient(ellipse at 35% 20%,#ffcfa3 0%,#ff7a2b 50%,#e8520c 100%)',
              boxShadow: 'inset -4px -5px 10px rgba(160,40,0,.22), 0 6px 14px rgba(242,106,27,.25)',
            }}
          />
          <span className="absolute" style={{ left: 6, top: 0 }}>
            <MaterialIcon name="auto_awesome" size={22} filled color="#ffae5e" />
          </span>
          <span className="absolute" style={{ right: 4, top: 10, transform: 'rotate(12deg)', filter: 'drop-shadow(0 3px 5px rgba(242,106,27,.35))' }}>
            <MaterialIcon name="favorite" size={22} filled color="#ff8a3d" />
          </span>
        </div>
        <div className="mt-2.5 text-[14px] font-extrabold text-stone-900">Xây dựng cộng đồng của riêng bạn</div>
        <p className="mt-1 text-[12px] leading-relaxed text-stone-600">
          Kết nối mọi người xung quanh đam mê của bạn và nhận tiền.
        </p>
        <Link
          to="/communities/new"
          className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-brand text-[13.5px] font-bold text-white hover:bg-brand-dark"
        >
          Bắt đầu
          <MaterialIcon name="arrow_forward" size={17} color="#fff" />
        </Link>
      </div>
    </aside>
  );
}
