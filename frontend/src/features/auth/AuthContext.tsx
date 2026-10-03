import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setAuthHandlers, setAuthToken } from '../../lib/api';
import * as authApi from './api';
import type { AuthSession, AuthUser, LoginInput, RegisterInput, TwoFactorChallenge } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  /** Trả về user, hoặc `TwoFactorChallenge` khi tài khoản bật 2FA (gọi tiếp `completeTwoFactor`). */
  login: (input: LoginInput) => Promise<AuthUser | TwoFactorChallenge>;
  completeTwoFactor: (ticket: string, code: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Ghi đè thông tin user hiện tại (sau khi sửa hồ sơ / xác thực email). */
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const applySession = useCallback((session: AuthSession) => {
    setUser(session.user);
    setAccessToken(session.accessToken);
    setAuthToken(session.accessToken); // để lib/api.ts tự đính kèm token cho các request khác
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setAuthToken(null);
    setStatus('guest');
  }, []);

  // Khi tải lại trang: thử lấy access token mới từ refresh-token cookie (httpOnly) để giữ phiên đăng nhập.
  useEffect(() => {
    let cancelled = false;
    authApi
      .refresh()
      .then((session) => {
        if (cancelled) return;
        applySession(session);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('guest');
      });
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // Giữa phiên (khác lúc tải trang): khi 1 request bị 401 vì access token (15 phút) đã hết hạn,
  // lib/api.ts gọi hàm này để xin token mới rồi tự thử lại request đó — không cần F5 trang.
  useEffect(() => {
    setAuthHandlers({
      refresh: async () => {
        try {
          const session = await authApi.refresh();
          applySession(session);
          return session.accessToken;
        } catch {
          return null;
        }
      },
      // Refresh cũng thất bại (refresh token hết hạn/đã bị thu hồi) → phiên kết thúc thật sự.
      onSessionExpired: clearSession,
    });
  }, [applySession, clearSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await authApi.login(input);
      if ('twoFactorRequired' in result) return result;
      applySession(result);
      setStatus('authenticated');
      return result.user;
    },
    [applySession],
  );

  const completeTwoFactor = useCallback(
    async (ticket: string, code: string) => {
      const session = await authApi.loginTwoFactor(ticket, code);
      applySession(session);
      setStatus('authenticated');
      return session.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await authApi.register(input);
      applySession(session);
      setStatus('authenticated');
      return session.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    if (accessToken) await authApi.logout(accessToken).catch(() => {});
    clearSession();
  }, [accessToken, clearSession]);

  const updateUser = useCallback((next: AuthUser) => setUser(next), []);

  return (
    <AuthContext.Provider value={{ user, accessToken, status, login, completeTwoFactor, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return ctx;
}
