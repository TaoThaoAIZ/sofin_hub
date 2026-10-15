import type { ChatMessage } from '../chatbot/types';

/** Chatbot riêng của cộng đồng — contract: backend/docs/api/community-bot.md. */
export type BotTier = 'free' | 'vip';
export type BotUnavailableReason = 'BOT_DISABLED' | 'COMMUNITY_NOT_PRO' | 'NOT_MEMBER' | 'COMMUNITY_LOCKED' | 'BOT_UNAVAILABLE';

export interface QuotaView {
  tier: BotTier;
  limit: number;
  used: number;
  remaining: number;
}

export interface PersonaOption {
  key: string;
  label: string;
}

export type CommunityBotStatus =
  | { available: false; reason: BotUnavailableReason }
  | {
      available: true;
      botName: string;
      welcomeText: string;
      tier: BotTier;
      persona: PersonaOption;
      defaultPersonaKey: string;
      personas: PersonaOption[];
      canChoosePersona: boolean;
      upgradeAvailable: boolean;
      quota: QuotaView;
      maxInputChars: number;
    };

export interface BotConversation {
  id: string;
  status: 'open' | 'handed_off' | 'closed';
}

export interface BotConversationState {
  conversation: BotConversation;
  messages: ChatMessage[];
}

export interface BotDoneData {
  message: ChatMessage;
  conversation: BotConversation;
  handoffOffer: { reason: string } | null;
  suggestions: string[];
  quota: QuotaView;
}

export interface StyleExample {
  situation: string;
  good: string;
  tooVerbose: string;
  tooCurt: string;
}

/** Khớp personaSchema (backend chatbot.persona.ts). */
export const PLAYBOOK_KEYS = ['explain', 'exercise', 'mistake', 'frustrated', 'praise', 'locked', 'noInfo', 'outOfScope', 'closing'] as const;
export type PlaybookKey = (typeof PLAYBOOK_KEYS)[number];

export interface Persona {
  label: string;
  /** Hợp với cộng đồng nào — chỉ hiện cho chủ, không vào prompt. */
  bestFor: string;
  identity: string;
  traits: string[];
  selfPronoun: string;
  userPronoun: string;
  tone: string;
  formality: 'casual' | 'friendly' | 'polite' | 'formal';
  verbosity: 'short' | 'medium' | 'detailed';
  emoji: 'none' | 'light' | 'lively';
  teaching: 'direct' | 'guided' | 'socratic';
  particles: string;
  clarify: string;
  smallTalk: string;
  playbook: Record<PlaybookKey, string>;
  doList: string[];
  avoidList: string[];
  styleExamples: StyleExample[];
}

export interface BotSettings {
  enabled: boolean;
  botName: string;
  welcomeText: string;
  personaKey: string;
  customPersona: Persona | null;
  memberPersonaKeys: string[];
  extraInstructions: string;
  freeDailyMessages: number;
  vipDailyMessages: number;
}

export interface BotSettingsView {
  settings: BotSettings;
  isPro: boolean;
  canToggle: boolean;
  presets: (Persona & { key: string })[];
  stats: { qa: Record<string, number>; documents: number; conversations7d: number; handoffs7d: number };
}

export interface BotQa {
  id: string;
  question: string;
  variants: string[];
  answer: string;
  status: 'active' | 'candidate' | 'rejected' | 'archived' | 'stale';
  source: 'admin' | 'learned' | 'import';
  hitCount: number;
  updatedAt: string;
}

export interface BotDocument {
  id: string;
  title: string;
  status: 'active' | 'archived';
  chunks: number;
  updatedAt: string;
}

export interface BotConversationRow {
  id: string;
  user: { id: string; name: string };
  status: string;
  messages: number;
  negative: number;
  firstQuestion: string;
  lastMessageAt: string | null;
}
