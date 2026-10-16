import { PAGE_X } from '../../lib/layout';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useIsPlatformAdmin } from '../../features/admin/queries';
import { useAuth } from '../../features/auth/AuthContext';
import { useToggleLanguage } from '../../features/auth/useToggleLanguage';
import { MessagesButton } from '../../features/messages/components/MessagesButton';
import { NotificationBell } from '../../features/notifications/components/NotificationBell';
import { useTheme } from '../../features/theme/ThemeProvider';
import { useClickOutside } from '../../lib/useClickOutside';
import { MaterialIcon } from '../ui/MaterialIcon';
import { BrandLogo } from '../ui/BrandLogo';
import { ThemedImg } from '../ui/ThemedImg';
import { resolveApiPath } from '../../lib/api';

// Chỉ giữ các mục có route thật.
const NAV_ITEMS: { key: string; to: string }[] = [
  { key: 'discover', to: '/' },
  { key: 'courses', to: '/#courses' },
  { key: 'myCommunities', to: '/me/communities' },
];

function Logo() {
  return (
    <Link to="/" aria-label="SofinHub" className="block flex-none leading-none">
      <BrandLogo className="h-[clamp(36px,2.8vw,50px)]" />
    </Link>
  );
}

const PILL =
  'border border-white bg-white/80 shadow-[1px_6px_30px_2px_rgba(121,81,54,0.1)] dark:border-[rgba(81,81,81,.2)] dark:bg-[rgba(51,51,51,.3)] dark:shadow-none';

export function Header({ active = 'discover' }: { active?: string }) {
  const { t, i18n } = useTranslation('common');
  const { user, status, logout } = useAuth();
  const toggleLanguage = useToggleLanguage();
  const { resolved, toggle: toggleTheme } = useTheme();
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
    <header className={`${PAGE_X} sticky top-[18px] z-20 mt-[18px] flex h-[72px] items-center gap-[clamp(12px,2vw,32px)] rounded-[28px] border border-transparent bg-white/70 py-0 pr-[11px] pl-4 shadow-nav backdrop-blur-[22px] backdrop-saturate-[180%] md:pl-6 min-[1600px]:pl-9 dark:border-white/10 dark:bg-black/30`}>
      <Logo />

      <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-[clamp(16px,1.8vw,32px)] overflow-hidden text-[clamp(15px,1vw,18px)] leading-[1.5] whitespace-nowrap md:flex">
        {NAV_ITEMS.map((item) => {
          const className = item.key === active ? 'font-bold text-brand' : 'font-normal text-[#201e1c] hover:text-brand dark:text-white dark:hover:text-brand';
          return (
            <Link key={item.key} to={item.to} className={className}>
              {t(`nav.${item.key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex min-w-0 flex-none items-center gap-2 whitespace-nowrap sm:gap-[clamp(10px,1vw,16px)] md:ml-0">
        {status === 'authenticated' && (
          <div className="hidden items-center gap-[clamp(10px,1vw,16px)] sm:flex">
            <MessagesButton variant="header" />
            <NotificationBell variant="header" />
          </div>
        )}
        <button
          type="button"
          onClick={toggleLanguage}
          aria-label={t('header.language')}
          title={t('header.language')}
          className="flex items-center gap-1.5 overflow-clip rounded-xl px-1 text-[clamp(15px,1vw,18px)] leading-[1.5] text-[#201e1c] hover:text-brand dark:text-white"
        >
          <ThemedImg name="lang" className="size-[28px]" />
          {i18n.language === 'en' ? 'EN' : 'VI'}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={resolved === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
          title={resolved === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
          className="grid size-[clamp(36px,2.4vw,42px)] flex-none place-items-center rounded-full text-[#201e1c] hover:bg-brand/10 hover:text-brand dark:text-white"
        >
          <MaterialIcon name={resolved === 'dark' ? 'light_mode' : 'dark_mode'} size={22} color="currentColor" />
        </button>

        {status === 'authenticated' && user ? (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={`flex h-[clamp(42px,2.8vw,50px)] items-center gap-2.5 overflow-clip rounded-[20px] px-[9px] text-[clamp(15px,1vw,18px)] leading-[1.5] text-[#201e1c] dark:text-white ${PILL}`}
            >
              {user.avatarUrl ? (
                <img src={resolveApiPath(user.avatarUrl)} alt="" className="size-[35px] rounded-full object-cover" />
              ) : (
                <span className="bg-brand-gradient grid size-[35px] place-items-center rounded-full text-[15px] font-bold text-white">
                  {user.firstName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[120px] truncate pr-1 sm:inline">{user.firstName}</span>
            </button>
            {menuOpen && (
              <div className="absolute top-[calc(100%+8px)] right-0 z-30 flex w-56 max-w-[calc(100vw-48px)] flex-col gap-1 rounded-2xl border border-[rgba(120,60,20,.1)] bg-white p-2 text-sm shadow-[0_16px_40px_rgba(120,60,20,.18)] dark:shadow-[0_16px_40px_rgba(0,0,0,.5)]">
                <div className="truncate px-3 py-1.5 text-stone-500" title={user.email}>{user.email}</div>
                {/* Mobile: thanh điều hướng/chuông/tin nhắn/nút tạo bị ẩn ở header nên đưa vào menu này. */}
                {[
                  ...NAV_ITEMS.map((n) => ({ label: t(`nav.${n.key}`), to: n.to, cls: 'md:hidden' })),
                  { label: t('header.messages'), to: '/messages', cls: 'sm:hidden' },
                  { label: t('header.notifications'), to: '/notifications', cls: 'sm:hidden' },
                  { label: t('header.createCommunity'), to: '/communities/new', cls: 'sm:hidden' },
                  { label: t('header.profileSettings'), to: '/settings', cls: '' },
                  ...(isAdmin ? [{ label: t('header.admin'), to: '/admin', cls: '' }] : []),
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-xl px-3 py-2.5 text-left font-medium text-stone-900 hover:bg-brand/10 hover:text-brand ${item.cls}`}
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={doLogout}
                  className="rounded-xl px-3 py-2 text-left font-medium text-stone-900 hover:bg-brand/10 hover:text-brand"
                >
                  {t('header.logout')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            state={{ from: location.pathname }}
            className={`flex h-[clamp(42px,2.8vw,50px)] items-center rounded-[20px] px-[18px] text-[clamp(15px,1vw,18px)] text-[#201e1c] dark:text-white ${PILL}`}
          >
            {t('header.login')}
          </Link>
        )}

        <Link
          to="/communities/new"
          className="flex h-[clamp(42px,2.8vw,50px)] items-center rounded-[20px] bg-brand px-[clamp(14px,1.2vw,22px)] text-[clamp(15px,1vw,18px)] leading-[1.5] font-semibold text-white shadow-[0_8px_30px_rgba(159,126,103,0.06)] hover:brightness-[1.06] max-sm:hidden"
        >
          {t('header.createCommunity')}
        </Link>
      </div>
    </header>
  );
}
