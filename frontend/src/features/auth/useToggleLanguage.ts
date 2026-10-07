import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPatch } from '../../lib/api';
import { useAuth } from './AuthContext';

/** Đổi VI/EN. Đang đăng nhập thì lưu luôn vào tài khoản (User.language) để lần đăng nhập sau — kể cả trình duyệt khác — giữ đúng ngôn ngữ. */
export function useToggleLanguage() {
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  return useCallback(() => {
    const next = i18n.language === 'en' ? 'vi' : 'en';
    void i18n.changeLanguage(next);
    if (!user) return;
    updateUser({ ...user, language: next });
    apiPatch('/auth/me/preferences', { language: next }).catch(() => {
      /* lưu tài khoản thất bại: giao diện vẫn đã đổi và được nhớ ở trình duyệt */
    });
  }, [i18n, user, updateUser]);
}
