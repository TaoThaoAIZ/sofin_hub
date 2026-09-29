import type { prisma } from '../../src/db/prisma.js';
import type { SeedAccountKey } from '../seed-accounts.js';

/** Thứ truyền cho mọi hàm seed nội dung. */
export interface SeedContext {
  db: typeof prisma;
  /** Tài khoản test cố định: key (SEED_ACCOUNTS) -> userId. */
  userIds: Record<SeedAccountKey, string>;
}
