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
 * + ngăn kéo menu (đã gồm Trang chủ · Cộng đồng · Chat · Cá nhân). Không còn thanh tab dưới; màn con có nút quay lại ở thanh trên. Desktop không thay đổi.
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
  'khao-sat': 'sidebar.surveys',
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

/** Màn chính (không hiện nút quay lại). Mọi màn khác có nút quay lại ở thanh trên. */
const ROOT_PATHS = ['/', '/me/communities', '/messages', '/settings', '/explore', '/notifications'];
const isRootScreen = (pathname: string) => ROOT_PATHS.includes(pathname) || !!matchPath({ path: '/communities/:id/community', end: true }, pathname);

export function MobileTopBar() {
  const { t } = useTranslation('community');
  const { status } = useAuth();
  const { unreadCount } = useNotificationsContext();
  const titleKey = useCommunityTitleKey();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const showBack = !isRootScreen(pathname);
  // Quay lại màn trước; mở thẳng bằng link (không có lịch sử) thì về trang chính phù hợp.
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) return navigate(-1);
    const m = matchPath({ path: '/communities/:id/community/*', end: false }, pathname);
    navigate(m ? `/communities/${m.params.id}/community` : '/');
  };
  // Lưu trang lúc mở: đổi trang thì ngăn kéo tự đóng (không cần effect).
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  return (
    <>
      <div className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-2 px-4 md:hidden">
        <div className="flex items-center gap-1.5">
          {showBack && (
            <button type="button" onClick={goBack} aria-label={t('mobile.back')} className={circleBtn}>
              <MaterialIcon name="arrow_back" size={20} color="currentColor" />
            </button>
          )}
          <button type="button" onClick={() => setOpenAt(pathname)} aria-label={t('mobile.menu')} aria-expanded={open} className={circleBtn}>
            <MaterialIcon name="notes" size={20} color="currentColor" />
          </button>
        </div>
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
  const { unreadCount: chatUnread } = useMessagesContext();
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
          {status === 'authenticated' && (
            <Link to="/messages" className={link}>
              <MaterialIcon name="chat_bubble" size={22} color="currentColor" /> {t('mobile.tabs.chat')}
              {chatUnread > 0 && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] leading-5 font-bold text-white">{chatUnread > 9 ? '9+' : chatUnread}</span>}
            </Link>
          )}
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
