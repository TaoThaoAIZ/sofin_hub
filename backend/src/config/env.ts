import 'dotenv/config';
import { z } from 'zod';
import { productionEnvProblems, productionEnvWarnings } from './env-guard.js';

const schema = z.object({
  // BẮT BUỘC khai báo (không có default): quên đặt biến thì app từ chối khởi động thay vì lặng lẽ chạy như dev
  // (outbox thư, secret dev-*, cookie không Secure, lộ err.message). Script dev/test đặt sẵn qua cross-env.
  NODE_ENV: z.enum(['development', 'test', 'production'], {
    error: 'NODE_ENV bắt buộc là development | test | production (không có giá trị mặc định)',
  }),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  // Bí mật ký JWT. Có giá trị mặc định cho dev, BẮT BUỘC đặt riêng khi lên production.
  JWT_ACCESS_SECRET: z.string().min(1).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-refresh-secret-change-me'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Postgres (Prisma). Mặc định trỏ tới DB docker local (`npm run db:up`). Test DB dùng schema riêng, xem tests/helpers.ts.
  // Production BẮT BUỘC đặt DATABASE_URL (không có default); ngoài production mặc định trỏ DB docker local.
  DATABASE_URL: z.string().min(1).optional(),
  // Opt-in tường minh (=1) cho hộp thư dev GET /api/dev/outbox, độc lập với NODE_ENV. KHÔNG được đặt khi production.
  ENABLE_DEV_OUTBOX: z
    .string()
    .optional()
    .transform((v) => v === '1'),

  // Email của Platform Admin (đội SofinHub), ngăn cách bằng dấu phẩy. Họ có quyền ghi đè Owner ở mọi cộng đồng.
  PLATFORM_ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),

  // URL frontend, dùng dựng link trong email (đặt lại mật khẩu, xác thực email).
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  // Hộp thư nhận form liên hệ.
  SUPPORT_EMAIL: z.string().default('support@sofinhub.local'),

  // --- Gửi email thật (SMTP qua nodemailer). Bỏ trống SMTP_HOST: dev/test dùng outbox RAM, production chỉ log (KHÔNG gửi). ---
  SMTP_HOST: z.string().optional().transform((v) => v?.trim() || undefined),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  /** true = TLS ngay từ đầu (cổng 465); false = STARTTLS (cổng 587). */
  SMTP_SECURE: z.string().optional().transform((v) => v === '1' || v === 'true'),
  SMTP_USER: z.string().optional().transform((v) => v?.trim() || undefined),
  SMTP_PASS: z.string().optional().transform((v) => v || undefined),
  // Gửi qua HTTP API của Brevo (cổng 443). Dùng khi host chặn cổng SMTP (Render gói Free). Có khoá này thì ưu tiên hơn SMTP.
  BREVO_API_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
  MAIL_FROM: z.string().default('SofinHub <no-reply@sofinhub.local>'),

  // Bí mật HMAC cho mã OTP email. BẮT BUỘC đặt riêng khi production (giá trị dev-* bị env-guard chặn).
  OTP_PEPPER: z.string().min(1).default('dev-otp-pepper-change-me'),

  // --- Đăng nhập mạng xã hội (OAuth2 authorization code). Thiếu cặp id/secret = nhà cung cấp đó bị tắt. ---
  // URL công khai của BACKEND (nơi Google/Facebook gọi lại), ví dụ https://api.sofinhub.com. Redirect URI = <OAUTH_REDIRECT_BASE>/api/auth/oauth/<provider>/callback
  OAUTH_REDIRECT_BASE: z.string().default('http://localhost:4000'),
  GOOGLE_CLIENT_ID: z.string().optional().transform((v) => v?.trim() || undefined),
  GOOGLE_CLIENT_SECRET: z.string().optional().transform((v) => v?.trim() || undefined),
  FACEBOOK_APP_ID: z.string().optional().transform((v) => v?.trim() || undefined),
  FACEBOOK_APP_SECRET: z.string().optional().transform((v) => v?.trim() || undefined),

  // --- Upload file (module uploads) ---
  UPLOAD_DIR: z.string().default('data/uploads'),
  // Bí mật ký vé upload (HMAC). BẮT BUỘC đặt riêng khi production.
  UPLOAD_SIGNING_SECRET: z.string().min(1).default('dev-upload-secret-change-me'),
  UPLOAD_TICKET_TTL_SEC: z.coerce.number().int().positive().default(600),
  UPLOAD_MAX_IMAGE_MB: z.coerce.number().positive().default(5),
  UPLOAD_MAX_FILE_MB: z.coerce.number().positive().default(25),
  UPLOAD_MAX_AVATAR_MB: z.coerce.number().positive().default(3),
  UPLOAD_MAX_COVER_MB: z.coerce.number().positive().default(8),
  UPLOAD_USER_QUOTA_MB: z.coerce.number().positive().default(200),
  // Có S3_BUCKET = lưu file ở S3 (bucket private, backend vẫn là cổng kiểm quyền); bỏ trống = LocalDiskStorage (UPLOAD_DIR).
  // Credentials lấy theo chuỗi mặc định của AWS SDK (IAM role của EC2/ECS) — KHÔNG đặt access key tĩnh vào .env.
  S3_BUCKET: z.string().optional().transform((v) => v?.trim() || undefined),
  S3_REGION: z.string().optional().transform((v) => v?.trim() || undefined),

  // --- State chia sẻ giữa các instance (SSE fan-out, vé, rate limit...). Bỏ trống = in-memory (đúng cho 1 instance). ---
  REDIS_URL: z.string().optional().transform((v) => v?.trim() || undefined),
  REDIS_KEY_PREFIX: z.string().default('sofinhub:'),
  // 0 = KHÔNG chạy scheduler trong process này (web-only; dùng `npm run start:worker` cho job nền). Mặc định 1.
  RUN_SCHEDULERS: z
    .string()
    .optional()
    .transform((v) => v !== '0'),

  // --- Tin nhắn: số tin tối đa mỗi user / phút (0 = tắt). Khi NODE_ENV=test mặc định tắt. ---
  MESSAGE_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(0).default(20),

  // --- Thanh toán (Phase 8). Các giá trị chính sách bên dưới là TẠM, chờ chốt (PLAN.md câu hỏi #2, #6, #8, #9) ---
  PAYMENT_WEBHOOK_SECRET: z.string().min(1).default('dev-webhook-secret-change-me'),
  TRIAL_DAYS: z.coerce.number().int().min(1).default(7),
  SUBSCRIPTION_PERIOD_DAYS: z.coerce.number().int().min(1).default(30),
  REFUND_WINDOW_DAYS: z.coerce.number().int().min(0).default(7),
  PLATFORM_COMMISSION_PCT: z.coerce.number().min(0).max(100).default(10),
  GATEWAY_FEE_PCT: z.coerce.number().min(0).max(100).default(2.9),
  GATEWAY_FEE_FIXED_CENTS: z.coerce.number().int().min(0).default(30),
  PAYOUT_MIN_USD: z.coerce.number().min(0).default(50),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.prettifyError(parsed.error));
  process.exit(1);
}

const LOCAL_DATABASE_URL = 'postgresql://sofinhub:sofinhub@localhost:5435/sofinhub?schema=public';

export const env = { ...parsed.data, DATABASE_URL: parsed.data.DATABASE_URL ?? LOCAL_DATABASE_URL };
export const isProd = env.NODE_ENV === 'production';
/** Chỉ môi trường dev thật mới được lộ chi tiết lỗi / bỏ cờ Secure của cookie. */
export const isDev = env.NODE_ENV === 'development';

const problems = productionEnvProblems({ ...parsed.data, NODE_ENV: env.NODE_ENV });
if (problems.length > 0) {
  console.error(['Cấu hình production không an toàn:', ...problems.map((p) => `- ${p}`)].join('\n'));
  process.exit(1);
}

for (const w of productionEnvWarnings({ ...parsed.data, NODE_ENV: env.NODE_ENV }, process.env)) console.warn(`[config] CẢNH BÁO: ${w}`);
