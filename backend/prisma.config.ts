import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: URL kết nối nằm ở đây (không còn trong schema.prisma). Mặc định trỏ tới DB docker local.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://sofinhub:sofinhub@localhost:5435/sofinhub?schema=public',
  },
});
