import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { codexLoggedIn } from './chatbot.llm.js';

/**
 * Cài đặt chatbot: 1 hàng PlatformSetting riêng (khóa `chatbot.settings`, chỉ lưu khóa bị ghi đè) — tách khỏi Global Settings để
 * nhân viên có quyền `support.manage` chỉnh được mà không cần `system.settings`. Cache trong tiến trình, nạp lại tối đa mỗi 10s
 * (giống settings.service.ts).
 */
export const CHATBOT_SETTINGS_KEY = 'chatbot.settings';
const TTL_MS = 10_000;

const DEFAULT_PERSONA = [
  'Tự xưng "Tào", gọi khách là "bạn" (không đổi theo cách khách xưng hô). Biết tên khách thì gọi "bạn <tên>".',
  'Mở câu bằng "dạ" khi trả lời, kết câu bằng "ạ", "nha" hoặc "nhé".',
  'Ngắn gọn: 1-2 câu, tối đa 3 câu khi cần liệt kê. Thân mật, không viết kiểu email, không chấm than liên tục, không emoji.',
].join('\n');

export const chatbotSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Model Codex (vd. gpt-5.4). Rỗng = model mặc định của tài khoản ChatGPT trong Codex. */
  model: z.string().trim().max(80),
  /** Điểm khớp câu mẫu (0..1) từ mức này => trả nguyên câu trả lời admin, không gọi AI. */
  directThreshold: z.number().min(0.3).max(1),
  /** Q&A học được có confidence từ mức này (và khách 👍) => bật ngay; thấp hơn => chờ duyệt. */
  autoLearnThreshold: z.number().min(0).max(1),
  autoLearnEnabled: z.boolean(),
  maxHistory: z.number().int().min(2).max(40),
  maxInputChars: z.number().int().min(100).max(4000),
  /** Số tin khách gửi tối đa mỗi ngày (0 = không giới hạn). */
  dailyMessagesPerUser: z.number().int().min(0).max(10_000),
  refusalText: z.string().trim().min(1).max(500),
  persona: z.string().trim().min(1).max(4000),
  extraInstructions: z.string().trim().max(4000),
  /** Link Zalo hỗ trợ (https://zalo.me/...). Rỗng = chỉ đưa mã ticket. */
  zaloSupportUrl: z.union([z.literal(''), z.string().trim().url().max(300).regex(/^https:\/\//, 'Link phải bắt đầu bằng https://')]),
  zaloHandoffText: z.string().trim().min(1).max(500),
});
export type ChatbotSettings = z.infer<typeof chatbotSettingsSchema>;
export const patchChatbotSettingsBody = chatbotSettingsSchema.partial().strict();

export function chatbotDefaults(): ChatbotSettings {
  return {
    enabled: true,
    model: '',
    directThreshold: 0.6,
    autoLearnThreshold: 0.85,
    autoLearnEnabled: true,
    maxHistory: 12,
    maxInputChars: 1000,
    dailyMessagesPerUser: 200,
    refusalText: 'dạ Tào chỉ hỗ trợ các câu hỏi về SofinHub và các tool đang bán thôi ạ, bạn cần hỗ trợ gì về những phần này không ạ',
    persona: DEFAULT_PERSONA,
    extraInstructions: '',
    zaloSupportUrl: '',
    zaloHandoffText: 'dạ bạn nhắn Zalo hỗ trợ kèm mã {code} để được người hỗ trợ ngay nha',
  };
}

type Overrides = Partial<Record<keyof ChatbotSettings, unknown>>;

/** Gộp mặc định + ghi đè; khóa ghi đè sai kiểu (DB bị sửa tay) bị bỏ qua. */
export function buildChatbotSettings(overrides: Overrides): ChatbotSettings {
  const out = chatbotDefaults() as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const field = chatbotSettingsSchema.shape[key as keyof ChatbotSettings];
    const parsed = field?.safeParse(value);
    if (parsed?.success) out[key] = parsed.data;
  }
  return out as ChatbotSettings;
}

let overrides: Overrides = {};
let current = buildChatbotSettings({});
let loadedAt = 0;
let inflight: Promise<void> | null = null;

export async function refreshChatbotSettings(): Promise<ChatbotSettings> {
  const row = await prisma.platformSetting.findUnique({ where: { key: CHATBOT_SETTINGS_KEY } });
  overrides = row && typeof row.value === 'object' && row.value && !Array.isArray(row.value) ? (row.value as Overrides) : {};
  current = buildChatbotSettings(overrides);
  loadedAt = Date.now();
  return current;
}

/** Cài đặt hiệu lực (đồng bộ). Quá TTL thì nạp lại nền, lần gọi này vẫn dùng bản cache. */
export function chatbotSettings(): ChatbotSettings {
  if (Date.now() - loadedAt > TTL_MS && !inflight) {
    inflight = refreshChatbotSettings()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
      });
  }
  return current;
}

/** Chatbot dùng được khi admin bật VÀ CODEX_HOME của bot đã đăng nhập ChatGPT (hoặc model giả cho dev/test). */
export const chatbotAvailable = (s: ChatbotSettings = chatbotSettings()) => s.enabled && (env.CHATBOT_FAKE_MODEL || codexLoggedIn());

/** Ghi đè một phần cài đặt (đã validate). Trả về cài đặt hiệu lực mới; cache cập nhật ngay. */
export async function writeChatbotSettings(patch: z.infer<typeof patchChatbotSettingsBody>, updatedById: string | null): Promise<ChatbotSettings> {
  await refreshChatbotSettings();
  const next: Overrides = { ...overrides, ...patch };
  const value = next as Prisma.InputJsonValue;
  await prisma.platformSetting.upsert({
    where: { key: CHATBOT_SETTINGS_KEY },
    create: { key: CHATBOT_SETTINGS_KEY, value, updatedById },
    update: { value, updatedById },
  });
  overrides = next;
  current = buildChatbotSettings(next);
  loadedAt = Date.now();
  return current;
}

export const resetChatbotSettingsForTests = () => {
  overrides = {};
  current = buildChatbotSettings({});
  loadedAt = 0;
};
