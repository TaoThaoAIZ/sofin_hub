import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { User } from './auth.types.js';

/**
 * Lớp truy cập dữ liệu người dùng. Hiện lưu vào file JSON trên đĩa (đủ dùng cho dev/demo);
 * khi có DB (RDS/DynamoDB) chỉ cần thay implementation này, service/controller giữ nguyên.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  create(data: Pick<User, 'email' | 'firstName' | 'lastName' | 'passwordHash'>): Promise<User>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../../../data/users.json');

function load(): User[] {
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as User[];
  } catch {
    return [];
  }
}

function save(users: User[]) {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

let users: User[] = load();

export const fileUserRepository: UserRepository = {
  async findByEmail(email) {
    return users.find((u) => u.email === email);
  },

  async findById(id) {
    return users.find((u) => u.id === id);
  },

  async create({ email, firstName, lastName, passwordHash }) {
    const user: User = { id: randomUUID(), email, firstName, lastName, passwordHash, createdAt: new Date().toISOString() };
    users = [...users, user];
    save(users);
    return user;
  },
};
