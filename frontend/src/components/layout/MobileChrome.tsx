import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, matchPath, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useIsPlatformAdmin } from '../../features/admin/queries';
import { useAuth } from '../../features/auth/AuthContext';
import { useToggleLanguage } from '../../features/auth/useToggleLanguage';
import { CommunityNavList } from '../../features/community/components/CommunitySidebar';
import { useCommunityDetail } from '../../features/courses/queries';
import { useMessagesContext } from '../../features/messages/MessagesProvider';
import { useNotificationsContext } from '../../features/notifications/NotificationsProvider';
import { useTheme } from '../../features/theme/ThemeProvider';
import { resolveApiPath } from '../../lib/api';
import { BrandLogo } from '../ui/BrandLogo';
import { MaterialIcon } from '../ui/MaterialIcon';

/**
 * Khung giao diện MOBILE (< md, theo Figma "Sofin-HUB" khung 390px): thanh trên (nút menu, logo/tiêu đề trang, tìm kiếm, chuông)
 * + ngăn kéo menu + thanh tab dưới (Trang chủ · Cộng đồng · Chat · Cá nhân). Desktop không thay đổi.
 */

/** Mục menu cộng đồng -> tiêu đề trên thanh trên (khóa i18n namespace `community`). */
const COMMUNITY_TITLES: Record<string, string> = {
  '': 'sidebar.nav.feed',
  'lop-hoc': 'sidebar.nav.classroom',
  lich: 'sidebar.nav.calendar',
  'thanh-vien': 'sidebar.nav.members',
  'xep-hang': 'sidebar.nav.leaderboard',
  'gioi-thieu': 'sidebar.nav.about',
  'chuong-trinh-gioi-thieu': 'sidebar.nav.referral',
  'cong-cu': 'sidebar.nav.tools',
  'kiem-duyet': 'sidebar.moderation',
  'doanh-thu': 'sidebar.revenue',
  'cai-dat': 'sidebar.settings',
};

const circleBtn = 'grid size-9 flex-none place-items-center rounded-full bg-[rgba(130,130,130,.2)] text-[#201e1c] dark:text-white';

function useCommunityTitleKey(): string | null {
  const { pathname } = useLocation();
  const m = matchPath({ path: '/communities/:id/community/*', end: false }, pathname);
  if (!m) return null;
  const first = (m.params['*'] ?? '').split('/')[0] ?? '';
  return COMMUNITY_TITLES[first] ?? null;
}

export function MobileTopBar() {
  const { t } = useTranslation('community');
  const { status } = useAuth();
  const { unreadCount } = useNotificationsContext();
  const titleKey = useCommunityTitleKey();
  const { pathname } = useLocation();
  // Lưu trang lúc mở: đổi trang thì ngăn kéo tự đóng (không cần effect).
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  return (
    <>
      <div className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-2 px-4 md:hidden">
        <button type="button" onClick={() => setOpenAt(pathname)} aria-label={t('mobile.menu')} aria-expanded={open} className={circleBtn}>
          <MaterialIcon name="notes" size={20} color="currentColor" />
        </button>
        {titleKey ? (
          <h1 className="m-0 min-w-0 flex-1 truncate text-center text-[18px] leading-[26px] font-bold text-[#201e1c] dark:text-white">{t(titleKey)}</h1>
        ) : (
          <Link to="/" aria-label="SofinHub" className="block leading-none">
            <BrandLogo className="h-[35px]" />
          </Link>
        )}
        <div className="flex items-center gap-1.5">
          <Link to="/search" aria-label={t('mobile.search')} className={circleBtn}>
            <MaterialIcon name="search" size={20} filled color="currentColor" />
          </Link>
          {status === 'authenticated' ? (
            <Link to="/notifications" aria-label={t('mobile.notifications')} className={`${circleBtn} relative`}>
              <MaterialIcon name="notifications" size={20} filled color="currentColor" />
              {unreadCount > 0 && (
                <span className="absolute -top-px left-[21px] grid size-4 place-items-center rounded-full bg-brand text-[11px] leading-none font-semibold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ) : (
            <Link to="/login" aria-label={t('mobile.login')} className={circleBtn}>
              <MaterialIcon name="person" size={20} filled color="currentColor" />
            </Link>
          )}
        </div>
      </div>
      {open && <MobileDrawer onClose={() => setOpenAt(null)} />}
    </>
  );
}

/** Ngăn kéo menu bên trái: điều hướng chung (+ menu cộng đồng khi đang ở trong một cộng đồng), giao diện, ngôn ngữ, đăng xuất. */
function MobileDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('community');
  const { t: tc, i18n } = useTranslation('common');
  const { t: tl } = useTranslation('layout');
  const { user, status, logout } = useAuth();
  const { isAdmin } = useIsPlatformAdmin();
  const { resolved, toggle: toggleTheme } = useTheme();
  const toggleLanguage = useToggleLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id = '' } = useParams();
  const inCommunity = Boolean(matchPath({ path: '/communities/:id/community/*', end: false }, pathname));
  const { data: course } = useCommunityDetail(inCommunity ? id : '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const link = 'flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[15px] text-[#201e1c] hover:bg-brand/10 dark:text-white';
  const doLogout = async () => {
    onClose();
    await logout();
    navigate('/');
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label={t('mobile.menu')}>
      <button type="button" aria-label={t('mobile.close')} onClick={onClose} className="absolute inset-0 border-0 bg-black/45" />
      <aside className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col gap-3 overflow-y-auto rounded-r-[28px] bg-white p-4 pb-8 shadow-[0_20px_60px_rgba(0,0,0,.35)] dark:bg-[#14181c]">
        <div className="flex items-center justify-between">
          <BrandLogo className="h-9" />
          <button type="button" onClick={onClose} aria-label={t('mobile.close')} className={circleBtn}>
            <MaterialIcon name="close" size={20} color="currentColor" />
          </button>
        </div>

        {status === 'authenticated' && user ? (
          <Link to="/settings" className="flex items-center gap-3 rounded-2xl bg-[rgba(130,130,130,.12)] p-3 no-underline">
            {user.avatarUrl ? (
              <img src={resolveApiPath(user.avatarUrl)} alt="" className="size-10 rounded-full object-cover" />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-brand text-base font-bold text-white">{user.firstName.charAt(0).toUpperCase()}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-[#201e1c] dark:text-white">{`${user.firstName} ${user.lastName}`.trim()}</span>
              <span className="block truncate text-xs text-[#696460] dark:text-[#bababa]">{user.email}</span>
            </span>
          </Link>
        ) : (
          <Link to="/login" state={{ from: pathname }} className="flex h-12 items-center justify-center rounded-2xl bg-brand text-[15px] font-bold text-white no-underline">
            {tc('header.login')}
          </Link>
        )}

        {inCommunity && (
          <section aria-label={course?.title}>
            <div className="mb-1 truncate px-1 text-[13px] font-semibold text-[#696460] dark:text-[#bababa]">{course?.title}</div>
            <CommunityNavList onNavigate={onClose} />
          </section>
        )}

        <nav className="flex flex-col gap-1 border-t border-[rgba(120,60,20,.1)] pt-3 dark:border-white/10">
          <Link to="/" className={link}>
            <MaterialIcon name="explore" size={22} color="currentColor" /> {tc('nav.discover')}
          </Link>
          <Link to="/#courses" className={link}>
            <MaterialIcon name="school" size={22} color="currentColor" /> {tc('nav.courses')}
          </Link>
          <Link to="/me/communities" className={link}>
            <MaterialIcon name="groups" size={22} color="currentColor" /> {tc('nav.myCommunities')}
          </Link>
          <Link to="/communities/new" className={link}>
            <MaterialIcon name="add_circle" size={22} color="currentColor" /> {tc('header.createCommunity')}
          </Link>
          {status === 'authenticated' && (
            <Link to="/settings" className={link}>
              <MaterialIcon name="settings" size={22} color="currentColor" /> {tc('header.profileSettings')}
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={link}>
              <MaterialIcon name="admin_panel_settings" size={22} color="currentColor" /> {tc('header.admin')}
            </Link>
          )}
        </nav>

        <div className="flex flex-col gap-1 border-t border-[rgba(120,60,20,.1)] pt-3 dark:border-white/10">
          <button type="button" onClick={toggleTheme} className={`${link} border-0 bg-transparent text-left`}>
            <MaterialIcon name={resolved === 'dark' ? 'light_mode' : 'dark_mode'} size={22} color="currentColor" />
            {resolved === 'dark' ? tc('header.themeToLight') : tc('header.themeToDark')}
          </button>
          <button type="button" onClick={toggleLanguage} className={`${link} border-0 bg-transparent text-left`}>
            <MaterialIcon name="language" size={22} color="currentColor" /> {tc('header.language')}: {i18n.language === 'en' ? 'EN' : 'VI'}
          </button>
          {status === 'authenticated' && (
            <button type="button" onClick={doLogout} className={`${link} border-0 bg-transparent text-left`}>
              <MaterialIcon name="logout" size={22} color="currentColor" /> {tc('header.logout')}
            </button>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2 text-xs text-[#696460] dark:text-[#bababa]">
          <Link to="/terms" className="text-inherit">{tl('footer.terms')}</Link>
          <Link to="/privacy" className="text-inherit">{tl('footer.privacy')}</Link>
          <Link to="/faq" className="text-inherit">FAQ</Link>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Thanh tab dưới

/** Trang KHÔNG hiện thanh tab (đăng nhập/đăng ký, admin, trình tạo cộng đồng, thanh toán, khung chat đang mở...). */
const HIDE_TABBAR = [
  '/login',
  '/register',
  '/verify-otp',
  '/oauth/*',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/admin/*',
  '/communities/new',
  '/communities/:id/checkout',
  '/invite/:code',
  '/messages/:id',
  '/certificates/:code',
];

type TabKey = 'home' | 'community' | 'chat' | 'me';

function activeTab(pathname: string): TabKey | null {
  if (pathname === '/' || matchPath('/communities/:id', pathname) || matchPath('/courses/:id', pathname) || pathname === '/tools') return 'home';
  if (pathname.startsWith('/me/communities') || matchPath({ path: '/communities/:id/community/*', end: false }, pathname)) return 'community';
  if (pathname.startsWith('/messages')) return 'chat';
  if (pathname.startsWith('/settings') || pathname.startsWith('/users/')) return 'me';
  return null;
}

export function MobileTabBar() {
  const { t } = useTranslation('community');
  const { pathname } = useLocation();
  const { status } = useAuth();
  const { unreadCount } = useMessagesContext();
  const hidden = HIDE_TABBAR.some((p) => matchPath({ path: p, end: true }, pathname));

  // Chừa chỗ ở cuối trang để nội dung không bị thanh tab che (CSS ở index.css: body.has-tabbar).
  useEffect(() => {
    document.body.classList.toggle('has-tabbar', !hidden);
    return () => document.body.classList.remove('has-tabbar');
  }, [hidden]);

  if (hidden) return null;
  const active = activeTab(pathname);
  const tabs: { key: TabKey; to: string; icon: string; label: string; badge?: number }[] = [
    { key: 'home', to: '/', icon: 'home', label: t('mobile.tabs.home') },
    { key: 'community', to: '/me/communities', icon: 'groups', label: t('mobile.tabs.community') },
    { key: 'chat', to: '/messages', icon: 'chat_bubble', label: t('mobile.tabs.chat'), badge: status === 'authenticated' ? unreadCount : 0 },
    { key: 'me', to: status === 'authenticated' ? '/settings' : '/login', icon: 'person', label: t('mobile.tabs.me') },
  ];

  return (
    <nav aria-label={t('mobile.tabs.aria')} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/25 to-transparent px-4 pt-6 pb-3 md:hidden">
      <div className="pointer-events-auto relative flex h-[70px] items-center justify-around gap-1 overflow-hidden px-2 rounded-[20px] bg-[rgba(72,72,72,.62)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)] backdrop-blur-[22px] backdrop-saturate-150">
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <Link
              key={tab.key}
              to={tab.to}
              aria-current={on ? 'page' : undefined}
              className={`relative flex h-[46px] min-w-[60px] flex-none flex-col whitespace-nowrap px-1 items-center justify-center gap-0.5 rounded-[50px] text-[12px] leading-[18px] no-underline ${on ? 'font-semibold text-white' : 'font-medium text-[#dedede]'}`}
            >
              {on && <span aria-hidden="true" className="absolute top-[-5px] left-0 h-[54px] w-full rounded-[41px] bg-[rgba(255,87,10,.8)] blur-[10px]" />}
              <span className="relative">
                <MaterialIcon name={tab.icon} size={24} filled color="currentColor" />
                {tab.badge ? (
                  <span className="absolute -top-1 -right-2 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4 font-bold text-white">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </span>
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
