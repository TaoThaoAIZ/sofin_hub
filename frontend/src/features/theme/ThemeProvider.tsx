import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useUpdatePreferences } from '../settings/security/queries';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Khóa localStorage — index.html đọc cùng khóa này (script chạy trước khi vẽ) để không bị chớp sáng khi tải lại trang. */
export const THEME_STORAGE_KEY = 'sofinhub.theme';

interface ThemeContextValue {
  /** Lựa chọn của người dùng (có thể là "theo hệ thống"). */
  preference: ThemePreference;
  /** Giao diện đang áp dụng thật. */
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  /** Đổi nhanh sáng <-> tối (nút ở Header). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isPref = (v: unknown): v is ThemePreference => v === 'light' || v === 'dark' || v === 'system';

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (isPref(v)) return v;
  } catch {
    /* localStorage bị chặn: dùng mặc định */
  }
  return 'light';
}

const systemPrefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;

/**
 * Giao diện sáng/tối. Người đã đăng nhập: theo `user.theme` lưu ở tài khoản (Cài đặt > Giao diện), đổi bằng nút ở Header sẽ lưu lại
 * vào tài khoản; khách: lưu ở trình duyệt. Áp dụng bằng class `dark` trên <html> (Tailwind variant `dark:` + khối "đảo bảng màu" ở index.css).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const savePrefs = useUpdatePreferences();
  const [localPref, setLocalPref] = useState<ThemePreference>(readStored);
  // Lựa chọn vừa bấm khi đã đăng nhập, giữ tới khi server lưu xong để giao diện đổi ngay (không chờ mạng).
  const [pending, setPending] = useState<ThemePreference | null>(null);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Người đã đăng nhập: giao diện lưu ở tài khoản là nguồn sự thật (đồng bộ giữa các thiết bị); khách: theo trình duyệt.
  const accountTheme = user?.theme;
  const preference: ThemePreference = pending ?? (status === 'authenticated' && isPref(accountTheme) ? accountTheme : localPref);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      /* bỏ qua */
    }
  }, [resolved, preference]);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setLocalPref(p);
      if (status !== 'authenticated') return;
      setPending(p);
      savePrefs.mutate({ theme: p }, { onSettled: () => setPending(null) });
    },
    [status, savePrefs],
  );

  const toggle = useCallback(() => setPreference(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPreference]);

  const value = useMemo(() => ({ preference, resolved, setPreference, toggle }), [preference, resolved, setPreference, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme phải nằm trong ThemeProvider');
  return ctx;
}
