import { useTranslation } from 'react-i18next';
import { readReferralCode } from '../referral/storage';
import { socialStartUrl } from './api';
import type { SocialProvider } from './types';

/**
 * Nút đăng nhập/đăng ký Google + Facebook. Là liên kết điều hướng THẲNG tới backend (OAuth2 authorization code chạy ở server);
 * xong việc backend đặt cookie phiên rồi chuyển về /oauth/callback.
 */
/**
 * TẠM ẨN (xem docs/TODO-SOCIAL-LOGIN.md): chưa có khoá Google/Facebook. Bật lại bằng VITE_SOCIAL_LOGIN=1 (frontend/.env) rồi build lại;
 * code backend và trang /oauth/callback vẫn giữ nguyên.
 */
export const SOCIAL_LOGIN_ENABLED = import.meta.env.VITE_SOCIAL_LOGIN === '1';

export function SocialButtons() {
  if (!SOCIAL_LOGIN_ENABLED) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <SocialButton provider="google" label="Google" />
      <SocialButton provider="facebook" label="Facebook" />
    </div>
  );
}

function SocialButton({ provider, label }: { provider: SocialProvider; label: string }) {
  const { t } = useTranslation('auth');
  return (
    <a
      href={socialStartUrl(provider, readReferralCode())}
      aria-label={t('social.continueWith', { provider: label })}
      className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white/85 text-[15px] font-semibold text-inherit no-underline hover:bg-white"
    >
      {provider === 'google' ? <GoogleMark /> : <FacebookMark />}
      {label}
    </a>
  );
}

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
    />
  </svg>
);

const FacebookMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#1877F2" />
    <path fill="#fff" d="M13.2 21.9v-7h2.3l.4-2.8h-2.7v-1.8c0-.8.3-1.4 1.4-1.4H16V6.4c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.2H8v2.8h2.4v7z" />
  </svg>
);
