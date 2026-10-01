import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Cấu hình nền tảng (Global Settings). Mỗi khóa có GIÁ TRỊ MẶC ĐỊNH lấy từ env; admin ghi đè qua bảng PlatformSetting
 * (khóa `global.settings`, chỉ lưu các khóa bị ghi đè). Giá trị hiệu lực được cache trong tiến trình và nạp lại tối đa
 * mỗi 10s (nhiều instance: lệch tối đa bằng TTL). Ghi trong chính tiến trình thì cập nhật cache NGAY.
 */
export const SETTINGS_KEY = 'global.settings';
/** Đọc số từ env tại thời điểm gọi (không đi qua config/env.ts); sai/thiếu → mặc định. */
function envNum(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return process.env[name] !== undefined && process.env[name] !== '' && Number.isFinite(v) ? v : fallback;
}
const TTL_MS = 10_000;

export const SETTING_DEFS = {
  'platform.name': { schema: z.string().trim().min(1).max(80), default: () => 'SofinHub' },
  'platform.supportEmail': { schema: z.string().trim().toLowerCase().email().max(180), default: () => env.SUPPORT_EMAIL },
  'platform.defaultLanguage': { schema: z.enum(['en', 'vi']), default: () => 'vi' as 'en' | 'vi' },
  'platform.timezone': { schema: z.string().trim().min(1).max(80), default: () => 'GMT+7 · Ho Chi Minh City' },
  'payments.commissionPct': { schema: z.number().min(0).max(100), default: () => env.PLATFORM_COMMISSION_PCT },
  'payments.gatewayFeePct': { schema: z.number().min(0).max(100), default: () => env.GATEWAY_FEE_PCT },
  'payments.gatewayFeeFixedCents': { schema: z.number().int().min(0).max(100_000), default: () => env.GATEWAY_FEE_FIXED_CENTS },
  'payments.refundWindowDays': { schema: z.number().int().min(0).max(365), default: () => env.REFUND_WINDOW_DAYS },
  /** Cửa sổ tranh chấp/chargeback cộng thêm vào cửa sổ hoàn tiền: tiền chỉ được rút sau (refundWindowDays + disputeWindowDays). GIÁ TRỊ TẠM chờ chủ sở hữu chốt. */
  'payments.disputeWindowDays': { schema: z.number().int().min(0).max(365), default: () => envNum('PAYOUT_DISPUTE_WINDOW_DAYS', 7) },
  /** Rolling reserve: % doanh thu ròng đã đủ điều kiện luôn bị giữ lại làm bảo hiểm cho hoàn tiền/chargeback muộn. GIÁ TRỊ TẠM (mặc định 10%). */
  'payments.payoutReservePct': { schema: z.number().min(0).max(100), default: () => envNum('PAYOUT_RESERVE_PCT', 10) },
  'payments.payoutMinUsd': { schema: z.number().min(0).max(1_000_000), default: () => env.PAYOUT_MIN_USD },
  'payments.trialDays': { schema: z.number().int().min(1).max(365), default: () => env.TRIAL_DAYS },
  'payments.subscriptionPeriodDays': { schema: z.number().int().min(1).max(366), default: () => env.SUBSCRIPTION_PERIOD_DAYS },
  'payments.currency': { schema: z.enum(['USD', 'VND', 'EUR']), default: () => 'USD' as 'USD' | 'VND' | 'EUR' },
  'payments.autoPayouts': { schema: z.boolean(), default: () => true },
  'security.require2fa': { schema: z.boolean(), default: () => false },
  'security.sessionTimeoutMin': { schema: z.union([z.literal(15), z.literal(30), z.literal(120)]), default: () => 30 as 15 | 30 | 120 },
  'security.maintenanceMode': { schema: z.boolean(), default: () => false },
} as const;
export type SettingKey = keyof typeof SETTING_DEFS;
export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

export interface PlatformConfig {
  platform: { name: string; supportEmail: string; defaultLanguage: 'en' | 'vi'; timezone: string };
  payments: {
    commissionPct: number;
    gatewayFeePct: number;
    gatewayFeeFixedCents: number;
    refundWindowDays: number;
    disputeWindowDays: number;
    payoutReservePct: number;
    payoutMinUsd: number;
    trialDays: number;
    subscriptionPeriodDays: number;
    currency: 'USD' | 'VND' | 'EUR';
    autoPayouts: boolean;
  };
  security: { require2fa: boolean; sessionTimeoutMin: 15 | 30 | 120; maintenanceMode: boolean };
}

export type Overrides = Partial<Record<SettingKey, unknown>>;

/** Gộp mặc định + ghi đè thành cấu trúc lồng nhau. Giá trị ghi đè sai kiểu (DB bị sửa tay) bị bỏ qua. */
export function buildConfig(overrides: Overrides): PlatformConfig {
  const out: Record<string, Record<string, unknown>> = { platform: {}, payments: {}, security: {} };
  for (const key of SETTING_KEYS) {
    const def = SETTING_DEFS[key];
    const [group, name] = key.split('.') as [string, string];
    const parsed = key in overrides ? def.schema.safeParse(overrides[key]) : null;
    out[group]![name] = parsed?.success ? parsed.data : def.default();
  }
  return out as unknown as PlatformConfig;
}

let overrides: Overrides = {};
let current: PlatformConfig = buildConfig({});
let loadedAt = 0;
let inflight: Promise<void> | null = null;

export async function refreshConfig(): Promise<void> {
  const row = await prisma.platformSetting.findUnique({ where: { key: SETTINGS_KEY } });
  overrides = row && typeof row.value === 'object' && row.value && !Array.isArray(row.value) ? (row.value as Overrides) : {};
  current = buildConfig(overrides);
  loadedAt = Date.now();
}

/** Cấu hình hiệu lực (đồng bộ). Quá TTL thì nạp lại nền, lần gọi này vẫn dùng bản cache. */
export function cfg(): PlatformConfig {
  if (Date.now() - loadedAt > TTL_MS && !inflight) {
    inflight = refreshConfig()
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
      });
  }
  return current;
}

export const getOverrides = (): Overrides => ({ ...overrides });

/** Ghi đè (value=undefined/khóa trong `reset` = xóa ghi đè). Cache cập nhật ngay. */
export async function writeOverrides(next: Overrides, updatedById: string | null): Promise<void> {
  const value = next as Prisma.InputJsonValue;
  await prisma.platformSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value, updatedById },
    update: { value, updatedById },
  });
  overrides = next;
  current = buildConfig(next);
  loadedAt = Date.now();
}

export const resetConfigCacheForTests = () => {
  overrides = {};
  current = buildConfig({});
  loadedAt = 0;
};
