import { useTranslation } from 'react-i18next';
import { NavLink, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useCommunityDetail } from '../../courses/queries';
import { isAtLeast } from '../../communities/types';
import { isModPlus } from './contentUi';

// Tên icon lấy đúng từ file thiết kế gốc SofinHub Community.html (font Material Symbols Rounded).
const NAV_ICONS = {
  feed: 'groups',
  classroom: 'school',
  calendar: 'calendar_month',
  members: 'group',
  leaderboard: 'leaderboard',
  about: 'info',
  tools: 'handyman',
  referral: 'redeem',
};

export interface CommunityNavItem {
  key: string;
  to: string;
  labelKey: string;
  icon: keyof typeof NAV_ICONS;
  end?: boolean;
}

// Nhãn tab đầu tiên là "Cộng đồng" (đúng theo file thiết kế gốc) dù nội dung hiển thị là Bảng tin.
export const COMMUNITY_NAV_ITEMS: CommunityNavItem[] = [
  { key: 'feed', to: '', labelKey: 'sidebar.nav.feed', icon: 'feed', end: true },
  { key: 'classroom', to: 'lop-hoc', labelKey: 'sidebar.nav.classroom', icon: 'classroom' },
  { key: 'calendar', to: 'lich', labelKey: 'sidebar.nav.calendar', icon: 'calendar' },
  { key: 'members', to: 'thanh-vien', labelKey: 'sidebar.nav.members', icon: 'members' },
  { key: 'leaderboard', to: 'xep-hang', labelKey: 'sidebar.nav.leaderboard', icon: 'leaderboard' },
  { key: 'about', to: 'gioi-thieu', labelKey: 'sidebar.nav.about', icon: 'about' },
  { key: 'referral', to: 'chuong-trinh-gioi-thieu', labelKey: 'sidebar.nav.referral', icon: 'referral' },
  { key: 'tools', to: 'cong-cu', labelKey: 'sidebar.nav.tools', icon: 'tools' },
];

/**
 * Danh sách mục điều hướng của cộng đồng (dùng ở sidebar desktop VÀ ngăn kéo menu trên mobile). Đường dẫn tương đối so với route
 * `/communities/:id/community`, nên phải render bên trong route đó (Header của CommunityPage cũng nằm trong route này).
 * `onNavigate`: gọi sau khi bấm một mục (đóng ngăn kéo).
 */
export function CommunityNavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('community');
  const { id: courseId = '' } = useParams();
  const { data: viewerCourse } = useCommunityDetail(courseId);
  return (
      <nav className="mt-2 flex flex-col gap-1">
        {COMMUNITY_NAV_ITEMS.map((item) => (
          <NavLink
            onClick={onNavigate}
            key={item.key}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] ${
                isActive ? 'bg-brand-soft font-semibold text-brand dark:bg-white/10' : 'font-normal text-stone-900 hover:bg-stone-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <MaterialIcon name={NAV_ICONS[item.icon]} size={21} weight={isActive ? 500 : 400} color="currentColor" />
                {t(item.labelKey)}
              </>
            )}
          </NavLink>
        ))}
        {isModPlus(viewerCourse?.viewerRole) && (
          <NavLink
            onClick={onNavigate}
            to="kiem-duyet"
            className={({ isActive }) =>
              `flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] ${
                isActive ? 'bg-brand-soft font-semibold text-brand dark:bg-white/10' : 'font-normal text-stone-900 hover:bg-stone-50'
              }`
            }
          >
            <MaterialIcon name="shield" size={21} color="currentColor" />
            {t('sidebar.moderation')}
          </NavLink>
        )}
        {isModPlus(viewerCourse?.viewerRole) && (
          <NavLink
            onClick={onNavigate}
            to="khao-sat"
            className={({ isActive }) =>
              `flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] ${
                isActive ? 'bg-brand-soft font-semibold text-brand dark:bg-white/10' : 'font-normal text-stone-900 hover:bg-stone-50'
              }`
            }
          >
            <MaterialIcon name="poll" size={21} color="currentColor" />
            {t('sidebar.surveys')}
          </NavLink>
        )}
        {(viewerCourse?.viewerRole === 'owner' || viewerCourse?.viewerRole === 'platform_admin') && (
          <NavLink
            onClick={onNavigate}
            to="doanh-thu"
            className={({ isActive }) =>
              `flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] ${
                isActive ? 'bg-brand-soft font-semibold text-brand dark:bg-white/10' : 'font-normal text-stone-900 hover:bg-stone-50'
              }`
            }
          >
            <MaterialIcon name="payments" size={21} color="currentColor" />
            {t('sidebar.revenue')}
          </NavLink>
        )}
        {isAtLeast(viewerCourse?.viewerRole, 'admin') && (
          <NavLink
            onClick={onNavigate}
            to="cai-dat"
            className={({ isActive }) =>
              `flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] ${
                isActive ? 'bg-brand-soft font-semibold text-brand dark:bg-white/10' : 'font-normal text-stone-900 hover:bg-stone-50'
              }`
            }
          >
            <MaterialIcon name="settings" size={21} color="currentColor" />
            {t('sidebar.settings')}
          </NavLink>
        )}
      </nav>
  );
}

export function CommunitySidebar({ courseTitle }: { courseTitle: string }) {
  return (
    <aside className="glass sticky top-[72px] flex h-[calc(100vh-84px)] flex-col gap-1 overflow-auto rounded-3xl p-3 max-md:hidden">
      <div className="flex items-center gap-3 border-b border-[rgba(120,60,20,.08)] px-2 pt-1 pb-4">
        <span className="grid size-11 flex-none place-items-center rounded-xl bg-[#0f1a2e] text-sm font-bold text-white">
          {courseTitle.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 text-[15px] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap overflow-hidden">
          {courseTitle}
        </div>
      </div>
      <CommunityNavList />
    </aside>
  );
}
