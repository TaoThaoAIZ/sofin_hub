import bcrypt from 'bcryptjs';
import { HttpError } from '../../utils/http-error.js';
import { fileUserRepository, type UserRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody } from './auth.schema.js';
import { toAuthUser, type AuthUser } from './auth.types.js';
import { consumeRefreshToken, issueRefreshToken, revokeAllRefreshTokens, signAccessToken } from './tokens.js';

const SALT_ROUNDS = 10;

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export function createAuthService(repo: UserRepository = fileUserRepository) {
  async function issueSession(userId: string, user: AuthUser): Promise<AuthSession> {
    return { user, accessToken: signAccessToken(userId), refreshToken: issueRefreshToken(userId) };
  }

  return {
    async register({ firstName, lastName, email, password }: RegisterBody): Promise<AuthSession> {
      if (await repo.findByEmail(email)) throw HttpError.conflict('Email này đã được đăng ký');
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await repo.create({ firstName, lastName, email, passwordHash });
      return issueSession(user.id, toAuthUser(user));
    },

    async login({ email, password }: LoginBody): Promise<AuthSession> {
      const user = await repo.findByEmail(email);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw HttpError.unauthorized('Email hoặc mật khẩu không đúng');
      }
      return issueSession(user.id, toAuthUser(user));
    },

    async refresh(refreshToken: string): Promise<AuthSession> {
      const payload = consumeRefreshToken(refreshToken);
      if (!payload) throw HttpError.unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
      const user = await repo.findById(payload.sub);
      if (!user) throw HttpError.unauthorized('Tài khoản không tồn tại');
      return issueSession(user.id, toAuthUser(user));
    },

    logout(userId: string): void {
      revokeAllRefreshTokens(userId);
    },

    async me(userId: string): Promise<AuthUser> {
      const user = await repo.findById(userId);
      if (!user) throw HttpError.unauthorized();
      return toAuthUser(user);
    },
  };
}

export const authService = createAuthService();
