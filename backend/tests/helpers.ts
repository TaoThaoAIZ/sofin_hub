import { readdirSync, readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Helper dùng chung cho test tích hợp API (node:test + fetch thật vào app Express, cổng ngẫu nhiên).
 * Chạy: `npm test` trong backend/. Mỗi file *.test.ts tự khởi tạo server riêng bằng startTestServer().
 * Mọi test chạy trên Postgres THẬT trong schema tạm riêng (không đụng DB dev): user/phiên/khóa học/ghi danh đều ở DB.
 */
process.env.NODE_ENV = 'test';
// Hộp thư dev (GET /api/dev/outbox) chỉ mount khi bật tường minh; test cần nó để lấy token reset/verify.
process.env.ENABLE_DEV_OUTBOX = '1';
// Thanh toán = chuyển khoản: test cần tài khoản nhận tiền + key webhook SePay (đặt TRƯỚC khi nạp env.ts).
export const TEST_WEBHOOK_KEY = 'test-sepay-key';
process.env.BANK_ACCOUNT ||= '0123456789';
process.env.BANK_ACCOUNT_NAME ||= 'SOFINHUB TEST';
process.env.SEPAY_WEBHOOK_KEY ||= TEST_WEBHOOK_KEY;
process.env.SEPAY_API_TOKEN = ''; // test không gọi SePay thật; test quét tự dựng fetch giả

/* ------------------------------------------------------------------------------------------------
 * DB thật (Postgres) cho test. Xem backend/docs/DATABASE.md, mục "Viết test với DB thật".
 *  - startTestServer luôn dùng DB thật. Sau migration nó nạp DỮ LIỆU NỀN tối thiểu: các Course từ courses.seed.ts
 *    (không có thành viên/bài viết demo — test cần gì thì tự tạo). `resetDb()` xóa sạch rồi nạp lại dữ liệu nền.
 *  - Mỗi file test = 1 process = 1 Postgres SCHEMA ngẫu nhiên `test_*` trong DB `sofinhub_test`
 *    (migration của prisma/migrations được áp vào schema đó; DROP khi close()).
 *  - `useTestDb()` dùng được độc lập với TEST_DB (vd. tests/db.test.ts) — nhưng phải gọi TRƯỚC khi import src/config/env.ts.
 * ---------------------------------------------------------------------------------------------- */
/** Giữ để tương thích; repository in-memory đã bị thay bằng Prisma nên không còn chế độ tắt DB. */
export const TEST_DB_ENABLED = true;
const BASE_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sofinhub:sofinhub@localhost:5435/sofinhub_test';
const MIGRATIONS_DIR = fileURLToPath(new URL('../prisma/migrations/', import.meta.url));
/** Tên schema chứa mốc thời gian để dọn schema mồ côi của lần chạy bị kill giữa chừng. */
const SCHEMA = `test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const STALE_MS = 30 * 60 * 1000;
export const TEST_DATABASE_URL = `${BASE_DB_URL}${BASE_DB_URL.includes('?') ? '&' : '?'}schema=${SCHEMA}`;
// Phải đặt TRƯỚC khi env.ts được nạp (helpers luôn là import đầu tiên của file test).
process.env.DATABASE_URL = TEST_DATABASE_URL;

export interface TestDb {
  schema: string;
  url: string;
  /** Prisma client trỏ vào schema tạm (chính là singleton của app). */
  prisma: PrismaClient;
  /** Xóa sạch dữ liệu mọi bảng (giữ cấu trúc, KHÔNG nạp lại dữ liệu nền). Thường dùng `resetDb()` để có lại Course nền. */
  reset(): Promise<void>;
  /** Nạp dữ liệu nền: cộng đồng (Community) từ catalog.seed.ts + 1 khóa học mặc định mỗi cộng đồng (bulk createMany, idempotent). */
  seedBase(): Promise<void>;
  /** Đóng kết nối + DROP schema. startTestServer().close() tự gọi khi TEST_DB=1. */
  drop(): Promise<void>;
}

const q = (ident: string) => `"${ident.replaceAll('"', '""')}"`;
let provisioned: Promise<TestDb> | undefined;

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: BASE_DB_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function provision(): Promise<TestDb> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const sql = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf-8'))
    .join('\n');

  await withClient(async (c) => {
    // Dọn schema test_* mồ côi (process bị kill) cũ hơn 30 phút.
    const { rows } = await c.query<{ schema_name: string }>("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'test\\_%'");
    for (const { schema_name } of rows) {
      const ts = parseInt(schema_name.split('_')[1] ?? '', 36);
      if (Number.isFinite(ts) && Date.now() - ts > STALE_MS) await c.query(`DROP SCHEMA IF EXISTS ${q(schema_name)} CASCADE`);
    }
    await c.query(`CREATE SCHEMA ${q(SCHEMA)}`);
    // Migration dùng tên không kèm schema -> đặt search_path rồi chạy nguyên file SQL (nhanh hơn `prisma migrate deploy`).
    await c.query(`SET search_path TO ${q(SCHEMA)}`);
    await c.query(sql);
  });

  const { prisma, disconnectPrisma } = await import('../src/db/prisma.js');

  return {
    schema: SCHEMA,
    url: TEST_DATABASE_URL,
    prisma,
    async reset() {
      await withClient(async (c) => {
        const { rows } = await c.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname = $1', [SCHEMA]);
        if (rows.length === 0) return;
        const list = rows.map((r) => `${q(SCHEMA)}.${q(r.tablename)}`).join(', ');
        await c.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
      });
    },
    async seedBase() {
      const { courseSeedRows } = await import('../prisma/seed-courses.js');
      const rows = courseSeedRows();
      await prisma.community.createMany({ data: rows, skipDuplicates: true });
      // Mỗi cộng đồng nền có 1 khóa học mặc định (id xác định `course-<id>-main`, tên = tên cộng đồng) — như migration backfill/tạo cộng đồng.
      await prisma.course.createMany({
        data: rows.map((r) => ({ id: `course-${r.id}-main`, communityId: r.id, title: r.title, description: r.description, position: 1 })),
        skipDuplicates: true,
      });
    },
    async drop() {
      await disconnectPrisma();
      await withClient((c) => c.query(`DROP SCHEMA IF EXISTS ${q(SCHEMA)} CASCADE`));
      provisioned = undefined;
    },
  };
}

/** Tạo (1 lần / process) schema Postgres tạm đã áp migration. Gọi lại trả về cùng đối tượng. */
export function useTestDb(): Promise<TestDb> {
  return (provisioned ??= provision());
}

let baseWanted = false;

/**
 * Xóa sạch dữ liệu trong schema test hiện tại (tạo schema nếu chưa có). Nếu đã có startTestServer() thì nạp lại dữ liệu nền (Course)
 * để test tiếp tục dùng course 'photo'...; dùng `(await useTestDb()).reset()` nếu muốn bảng hoàn toàn trống.
 */
export async function resetDb(): Promise<void> {
  const db = await useTestDb();
  await db.reset();
  if (baseWanted) await db.seedBase();
}
export const truncateAll = resetDb;

export interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const db = await useTestDb();
  baseWanted = true;
  await db.seedBase();
  const { createApp } = await import('../src/app.js');
  const server: Server = await new Promise((resolve) => {
    const s = createApp().listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}/api`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      // Chờ thông báo ghi nền (báo admin/owner khi có thanh toán...) xong để DROP SCHEMA không đụng deadlock với ghi dở.
      await (await import('../src/modules/notifications/notifications.service.js')).flushNotifications().catch(() => undefined);
      await (await import('../src/infra/shared.js')).closeShared(); // đóng kết nối Redis (nếu REDIS_URL được đặt) để process test thoát
      await db.drop();
    },
  };
}

export interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export function makeClient(baseUrl: string) {
  async function call<T = any>(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<ApiResult<T>> {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let body: any = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* giữ nguyên text (vd. file .ics) */
    }
    return { status: res.status, body, headers: res.headers };
  }

  /** Mã OTP mới nhất trong hộp thư dev của `email` (đọc thẳng outbox trong process, không qua HTTP). */
  async function otpFor(email: string): Promise<string> {
    const { mailService } = await import('../src/modules/mail/mail.service.js');
    const mails = mailService.listOutbox(email).filter((m) => /\b\d{6}\b/.test(m.subject));
    const code = mails.at(-1)?.subject.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`không có OTP trong outbox cho ${email}`);
    return code;
  }

  /**
   * Đăng ký + xác thực OTP, trả kết quả của /auth/register/verify (cùng hình dạng phiên như /auth/login). Nếu đăng ký bị từ chối thì trả
   * thẳng kết quả đăng ký. Xóa thư OTP khỏi outbox để test đếm thư của user không bị lệch.
   */
  async function registerVerified(body: { email: string; password: string; firstName: string; lastName: string; referralCode?: string }): Promise<ApiResult> {
    const reg = await call('POST', '/auth/register', { body });
    if (reg.status >= 300) return reg;
    const code = await otpFor(body.email);
    const verified = await call('POST', '/auth/register/verify', { body: { email: body.email, code, ...(body.referralCode !== undefined ? { referralCode: body.referralCode } : {}) } });
    const { mailService } = await import('../src/modules/mail/mail.service.js');
    mailService.dropOutbox(body.email);
    return verified;
  }

  /** Gọi webhook SePay như ngân hàng đẩy sang. `key` sai/undefined để test từ chối. */
  async function bankWebhook(body: Record<string, unknown>, opts: { key?: string | null; scheme?: string } = {}): Promise<ApiResult> {
    const key = opts.key === undefined ? process.env.SEPAY_WEBHOOK_KEY : opts.key;
    return call('POST', '/payments/webhook', { body, headers: key ? { Authorization: `${opts.scheme ?? 'Apikey'} ${key}` } : {} });
  }

  /** Dựng payload webhook SePay (tiền vào) cho 1 mã tham chiếu. */
  function sepayTx(o: { id: string; refCode: string; amount: number; content?: string }) {
    return {
      id: o.id,
      gateway: 'MBBank',
      transactionDate: '2026-10-09 10:30:00',
      accountNumber: process.env.BANK_ACCOUNT,
      code: null,
      content: o.content ?? `${o.refCode} chuyen tien`,
      transferType: 'in',
      transferAmount: o.amount,
      referenceCode: `FT${o.id}`,
    };
  }

  /**
   * Mô phỏng khách chuyển ĐÚNG số tiền cho phiên thanh toán `id` rồi trả kết quả đọc lại phiên (hình dạng cũ của `/confirm`).
   * externalId cố định theo phiên ⇒ gọi song song/lặp = webhook gửi trùng (phải idempotent). Đọc phiên lỗi (403/404) thì trả luôn lỗi đó.
   */
  async function payIntent(id: string, token: string, o: { amount?: number } = {}): Promise<ApiResult> {
    const cur = await call('GET', `/payments/${id}`, { token });
    if (cur.status !== 200) return cur;
    const p = cur.body.data;
    if (p.status === 'pending') {
      const w = await bankWebhook(sepayTx({ id: `T${id.replaceAll('-', '')}`, refCode: p.refCode, amount: o.amount ?? p.amountCents }));
      if (w.status !== 200) return w;
    }
    return call('GET', `/payments/${id}`, { token });
  }

  let counter = 0;
  /** Đăng ký user mới (mật khẩu đạt quy tắc: >= 8 ký tự, có chữ hoa và ký tự đặc biệt) và trả về token + id. */
  async function registerUser(prefix = 'user') {
    const email = `${prefix}-${Date.now()}-${counter++}@test.local`;
    const password = 'Passw0rd!x';
    const r = await registerVerified({ email, password, firstName: 'Test', lastName: prefix });
    if (r.status >= 300) throw new Error(`register failed: ${r.status} ${JSON.stringify(r.body)}`);
    const data = r.body.data;
    return { email, password, token: data.accessToken as string, id: data.user.id as string };
  }

  return { call, registerUser, registerVerified, otpFor, bankWebhook, sepayTx, payIntent };
}

/** Id khóa học mặc định của cộng đồng nền (xem seedBase) — dùng khi test tạo module bằng Prisma trực tiếp. */
export const mainCourseId = (communityId: string) => `course-${communityId}-main`;

/** Tạo khóa học mặc định cho cộng đồng test tự tạo bằng Prisma (idempotent) và trả về id. */
export async function ensureMainCourse(prisma: PrismaClient, communityId: string): Promise<string> {
  const id = mainCourseId(communityId);
  await prisma.course.upsert({ where: { id }, create: { id, communityId, title: communityId, position: 1 }, update: {} });
  return id;
}
