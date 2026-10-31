import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const BRAND = 'SofinHub';
const KEYS: [RegExp, string][] = [
  [/^\/login/, 'login'],
  [/^\/register/, 'register'],
  [/^\/verify-otp/, 'verifyOtp'],
  [/^\/forgot-password/, 'forgotPassword'],
  [/^\/reset-password/, 'resetPassword'],
  [/^\/search/, 'search'],
  [/^\/messages/, 'messages'],
  [/^\/notifications/, 'notifications'],
  [/^\/settings/, 'settings'],
  [/^\/me\/communities/, 'myCommunities'],
  [/^\/tools/, 'tools'],
  [/^\/faq/, 'faq'],
  [/^\/terms/, 'terms'],
  [/^\/privacy/, 'privacy'],
  [/^\/contact/, 'contact'],
  [/^\/communities\/new/, 'createCommunity'],
  [/^\/admin/, 'admin'],
];

/** Đặt tiêu đề tab theo trang. Trang chủ giữ tiêu đề trong index.html; trang cộng đồng tự đặt theo tên cộng đồng (xem useDocumentTitle). */
export function PageTitle() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation('common');
  useEffect(() => {
    if (pathname === '/') {
      document.title = t('pageTitle.home');
      return;
    }
    if (/^\/communities\/(?!new)/.test(pathname)) return;
    const hit = KEYS.find(([re]) => re.test(pathname));
    document.title = hit ? `${t(`pageTitle.${hit[1]}`)} | ${BRAND}` : BRAND;
  }, [pathname, t, i18n.language]);
  return null;
}

/** Tiêu đề tab riêng của một trang (vd. tên cộng đồng); chạy sau PageTitle nên ghi đè. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} | ${BRAND}`;
  }, [title]);
}
