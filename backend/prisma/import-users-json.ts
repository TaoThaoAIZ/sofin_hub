/**
 * Nhập tài khoản cũ từ backend/data/users.json (nguồn user trước khi chuyển sang Postgres) vào bảng User.
 * Giữ nguyên id / passwordHash / createdAt nên người dùng đăng nhập lại bằng mật khẩu cũ. Idempotent: bản ghi trùng id hoặc email bị bỏ qua.
 *
 * Chạy: `npm run db:import-users [đường-dẫn-file.json]`. File users.json KHÔNG bị xóa/sửa (đã deprecated, chỉ còn để nhập một lần).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

interface LegacyUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  createdAt: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

const file = resolve(process.argv[2] ?? fileURLToPath(new URL('../data/users.json', import.meta.url)));

try {
  if (!existsSync(file)) {
    console.log(`Không có ${file}, bỏ qua.`);
  } else {
    const legacy = JSON.parse(readFileSync(file, 'utf-8')) as LegacyUser[];
    const { count } = await prisma.user.createMany({
      skipDuplicates: true,
      data: legacy.map((u) => ({
        id: u.id,
        email: u.email.toLowerCase(),
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash: u.passwordHash,
        bio: u.bio ?? null,
        location: u.location ?? null,
        website: u.website ?? null,
        avatarUrl: u.avatarUrl ?? null,
        emailVerified: u.emailVerified ?? false,
        createdAt: new Date(u.createdAt),
      })),
    });
    console.log(`Đã nhập ${count}/${legacy.length} tài khoản từ ${file} (phần còn lại đã tồn tại).`);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
