import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Tách `?schema=xxx` khỏi DATABASE_URL: Prisma 7 + driver adapter không tự đọc tham số này,
 * phải truyền qua option `schema` của adapter (test dùng schema Postgres riêng cho mỗi file).
 */
export function parseDatabaseUrl(url: string): { connectionString: string; schema: string } {
  const u = new URL(url);
  const schema = u.searchParams.get('schema') ?? 'public';
  u.searchParams.delete('schema');
  return { connectionString: u.toString(), schema };
}

function createClient(): PrismaClient {
  const { connectionString, schema } = parseDatabaseUrl(env.DATABASE_URL);
  // `schema` chỉ áp cho truy vấn do Prisma sinh; đặt thêm search_path để $queryRaw tên bảng không kèm schema cũng đúng.
  const adapter = new PrismaPg({ connectionString, options: `-c search_path="${schema}"` }, { schema });
  return new PrismaClient({ adapter, log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
}

// Giữ 1 instance duy nhất kể cả khi `tsx watch` nạp lại module (tránh cạn kết nối).
const globalForPrisma = globalThis as unknown as { __sofinPrisma?: PrismaClient };

/** Prisma client dùng chung toàn app. Kết nối được mở lười ở truy vấn đầu tiên. */
export const prisma: PrismaClient = (globalForPrisma.__sofinPrisma ??= createClient());

/** Đóng pool kết nối — gọi khi shutdown (src/index.ts) hoặc cuối test. */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  globalForPrisma.__sofinPrisma = undefined;
}

export type { PrismaClient } from '../generated/prisma/client.js';
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
