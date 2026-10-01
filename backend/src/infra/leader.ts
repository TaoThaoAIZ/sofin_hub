import pg from 'pg';
import { env } from '../config/env.js';
import { parseDatabaseUrl } from '../db/prisma.js';

/**
 * Bầu leader bằng Postgres advisory lock (không cần Redis): `pg_try_advisory_lock` là khóa mức PHIÊN, nên giữ nó trên 1 kết nối
 * RIÊNG (không dùng pool của Prisma — pool trả kết nối lẫn lộn thì khóa "trôi"). Process chết => kết nối đứt => Postgres tự nhả khóa
 * (không có "khóa mồ côi"). Khóa theo TÊN job: mỗi job có leader riêng, nhiều instance chạy đồng thời thì đúng 1 instance chạy job đó.
 */
export type LockResult<T> = { ran: true; value: T } | { ran: false };

export type WithLock = <T>(name: string, fn: () => Promise<T>) => Promise<LockResult<T>>;

/** Namespace cố định để không đụng advisory lock của ứng dụng khác dùng chung DB. */
const NAMESPACE = 'sofinhub';

export const withAdvisoryLock: WithLock = async (name, fn) => {
  const { connectionString } = parseDatabaseUrl(env.DATABASE_URL);
  const client = new pg.Client({ connectionString, application_name: `sofinhub-lock:${name}` });
  client.on('error', () => undefined); // lỗi kết nối giữa chừng: khóa tự nhả; kết quả job đã/đang được xử lý ở dưới
  await client.connect();
  let locked = false;
  try {
    const r = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS ok', [NAMESPACE, name]);
    locked = r.rows[0]?.ok === true;
    if (!locked) return { ran: false };
    return { ran: true, value: await fn() };
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1), hashtext($2))', [NAMESPACE, name]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
};
