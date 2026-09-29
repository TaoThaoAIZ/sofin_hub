import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
  DATABASE_URL: z.string().default('postgresql://sofinhub:sofinhub@localhost:5435/sofinhub?schema=public'),

  // Email của Platform Admin (đội SofinHub), ngăn cách bằng dấu phẩy. Họ có quyền ghi đè Owner ở mọi cộng đồng.
  PLATFORM_ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),

  // URL frontend, dùng dựng link trong email (đặt lại mật khẩu, xác thực email).
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  // Hộp thư nhận form liên hệ.
  SUPPORT_EMAIL: z.string().default('support@sofinhub.local'),

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

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

if (isProd && (env.JWT_ACCESS_SECRET.startsWith('dev-') || env.JWT_REFRESH_SECRET.startsWith('dev-'))) {
  console.error('JWT_ACCESS_SECRET/JWT_REFRESH_SECRET phải được đặt riêng khi NODE_ENV=production');
  process.exit(1);
}
