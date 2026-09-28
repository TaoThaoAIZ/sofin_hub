export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  createdAt: string;
}

/** Dữ liệu người dùng an toàn để trả về client (không có passwordHash). */
export type AuthUser = Omit<User, 'passwordHash'>;

export function toAuthUser(user: User): AuthUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
