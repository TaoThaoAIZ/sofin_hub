import { prisma } from '../../db/prisma.js';
import type { CommunityBot } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { catalogService } from '../catalog/catalog.service.js';
import { isPersonaKey, resolvePersona, type Persona } from '../chatbot/chatbot.persona.js';
import { paymentsService } from '../payments/payments.service.js';
import { atLeast, getRole, type Role } from '../permissions/policy.js';

/**
 * Phân quyền chatbot cộng đồng (chatbot.md mục 2 + 4.3):
 *  - bật được khi chủ ở gói Pro (HostingPlan pro: active, hoặc trialing còn hạn dùng thử);
 *  - MỌI thành viên chat được, 2 mức: thường (free) / VIP = thành viên trả phí còn hạn (hasLiveSubscription); mod+ luôn VIP;
 *  - VIP mở khóa chọn nhân cách, nhiều tin/ngày hơn, trích bài học sâu hơn, nhớ lịch sử dài hơn.
 * Khóa bài học trả phí/level của lớp học vẫn áp dụng theo TỪNG NGƯỜI (community-bot.context.ts) — VIP không mở được bài chưa mua.
 */

export type BotTier = 'free' | 'vip';

export interface TierLimits {
  dailyMessages: number;
  /** Số ký tự tối đa trích từ 1 bài học đã mở. */
  lessonExcerptChars: number;
  /** Số lượt (tin) lịch sử đưa vào prompt. */
  historyTurns: number;
}

export const TIER_LIMITS: Record<BotTier, Omit<TierLimits, 'dailyMessages'>> = {
  free: { lessonExcerptChars: 400, historyTurns: 4 },
  vip: { lessonExcerptChars: 1500, historyTurns: 12 },
};

export interface BotAccess {
  bot: CommunityBot;
  role: Role;
  tier: BotTier;
  personaKey: string;
  persona: Persona;
  limits: TierLimits;
}

const botError = (status: number, code: string, message: string) => HttpError.coded(status, code, message);

/** Cộng đồng đang ở gói Pro hợp lệ? (gói hosting hiện là mô phỏng: trialing hết hạn dùng thử mà chưa active thì KHÔNG tính.) */
export async function communityIsPro(communityId: string, now = new Date()): Promise<boolean> {
  const plan = await prisma.hostingPlan.findUnique({ where: { communityId }, select: { planKey: true, status: true, trialEndsAt: true } });
  if (!plan || plan.planKey !== 'pro') return false;
  if (plan.status === 'active') return true;
  return plan.status === 'trialing' && (!plan.trialEndsAt || plan.trialEndsAt > now);
}

/** Cấu hình bot (mặc định chưa có hàng = tắt). */
export const findBot = (communityId: string) => prisma.communityBot.findUnique({ where: { communityId } });

/** Thành viên có phải VIP (trả phí còn hạn) không — mod+ luôn VIP. */
async function tierOf(userId: string, communityId: string, role: Role): Promise<BotTier> {
  if (atLeast(role, 'mod')) return 'vip';
  return (await paymentsService.hasLiveSubscription(userId, communityId)) ? 'vip' : 'free';
}

/** Nhân cách hiệu lực: VIP dùng nhân cách tự chọn nếu chủ còn cho phép, ngược lại nhân cách mặc định của chủ. */
async function personaKeyFor(bot: CommunityBot, userId: string, tier: BotTier): Promise<string> {
  if (tier === 'vip') {
    const pref = await prisma.communityBotMemberPref.findUnique({ where: { communityId_userId: { communityId: bot.communityId, userId } } });
    if (pref && bot.memberPersonaKeys.includes(pref.personaKey) && isPersonaKey(pref.personaKey)) return pref.personaKey;
  }
  return bot.personaKey;
}

/**
 * Quyền chat với bot của cộng đồng. Lỗi (theo thứ tự): 404 cộng đồng không tồn tại; 403 COMMUNITY_LOCKED; 503 BOT_DISABLED;
 * 403 COMMUNITY_NOT_PRO; 403 NOT_MEMBER (chưa tham gia / bị cấm).
 */
export async function communityBotAccess(userId: string, communityId: string): Promise<BotAccess> {
  const { locked } = await catalogService.requireLockState(communityId);
  const role = await getRole(userId, communityId);
  if (locked && role !== 'platform_admin') throw botError(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
  const bot = await findBot(communityId);
  if (!bot?.enabled) throw botError(503, 'BOT_DISABLED', 'Trợ lý AI của cộng đồng đang tắt');
  if (!(await communityIsPro(communityId))) throw botError(403, 'COMMUNITY_NOT_PRO', 'Trợ lý AI chỉ dùng được khi cộng đồng ở gói Chuyên nghiệp');
  if (!role) throw botError(403, 'NOT_MEMBER', 'Bạn cần tham gia cộng đồng để trò chuyện với trợ lý');
  const tier = await tierOf(userId, communityId, role);
  const personaKey = await personaKeyFor(bot, userId, tier);
  return {
    bot,
    role,
    tier,
    personaKey,
    persona: resolvePersona(personaKey, bot.customPersona),
    limits: { ...TIER_LIMITS[tier], dailyMessages: tier === 'vip' ? bot.vipDailyMessages : bot.freeDailyMessages },
  };
}
