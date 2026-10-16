import { Codex } from '@openai/codex-sdk';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { env } from '../../config/env.js';

/**
 * Tầng gọi AI của chatbot = Codex SDK (`@openai/codex-sdk`) đăng nhập bằng TÀI KHOẢN CHATGPT (không dùng OpenAI API key).
 * Mỗi lượt chạy 1 tiến trình `codex exec` không trạng thái, trả JSON theo schema (structured output). Codex KHÔNG được dùng tool nào:
 * mọi dữ liệu (câu mẫu, tài liệu, thanh toán của chính khách...) do server gom sẵn và đưa vào prompt (chatbot.context.ts).
 *
 * Cô lập (khách có thể cố "lừa" bot):
 *  - CODEX_HOME RIÊNG (`CHATBOT_CODEX_HOME`, mặc định backend/data/codex-home): config.toml tối giản do server ghi, tắt shell/exec,
 *    trình duyệt, computer-use, plugin, hook, ảnh, multi-agent...; không dùng ~/.codex của người vận hành (tránh hook/plugin cá nhân).
 *  - sandbox read-only, approval never, không mạng, không web search, thư mục làm việc rỗng.
 *  - tiến trình con chỉ nhận vài biến môi trường tối thiểu (KHÔNG có DATABASE_URL, JWT_*, SEPAY_*...).
 *  - giới hạn số tiến trình chạy song song (chatbot.limiter.ts, bọc trong chatLlm()) + timeout mỗi lượt.
 */

export interface LlmUsage {
  tokensIn: number;
  tokensOut: number;
}

export interface LlmRequest<T> {
  /** answer = trả lời khách; learn = trích xuất tri thức (job học). */
  kind: 'answer' | 'learn';
  prompt: string;
  schema: z.ZodType<T>;
  /** Dữ liệu có cấu trúc đi kèm prompt — model giả dùng để dựng câu trả lời xác định (model thật bỏ qua). */
  hint?: unknown;
  model?: string;
  signal?: AbortSignal;
  /** Lượt phải xếp hàng (đã đủ lượt chạy song song): ahead = số lượt đứng trước — để báo khách "Đang có N người hỏi trước". */
  onQueued?: (ahead: number) => void;
}

export interface ChatLlm {
  complete<T>(req: LlmRequest<T>): Promise<{ output: T; usage: LlmUsage }>;
}

/** Hàng đợi giới hạn song song nằm ở chatbot.limiter.ts (bọc mọi model trong chatLlm()); giữ export cho nơi đang import. */
export { LlmBusyError } from './chatbot.limiter.js';
import { LlmBusyError } from './chatbot.limiter.js';

/** Tài khoản ChatGPT hết hạn mức của GÓI (5 giờ / tuần) — tạm ngừng gọi Codex tới giờ reset. */
export class LlmQuotaError extends Error {}

/**
 * Phân loại lỗi model (Codex dùng tài khoản ChatGPT):
 * - quota: hết hạn mức của GÓI ("You've hit your usage limit … try again at 1:41 PM", usage_limit_reached) => tạm ngừng tới giờ reset.
 * - rate_limit: bị giới hạn tốc độ TẠM THỜI (429 / too many requests) => thử lại sau vài giây, KHÔNG tạm ngừng cả trợ lý.
 * - error: lỗi khác.
 * Trước đây gộp chung + /429/ không có ranh giới từ (dãy "14290 ms" cũng khớp) => có thể tạm ngừng cả trợ lý dù ChatGPT còn hạn mức.
 */
export type LlmIssueKind = 'quota' | 'rate_limit' | 'error';
const USAGE_LIMIT = /usage[ _]limit|hit your (usage )?limit|plan limit|quota exceeded|exceeded your (current )?quota|insufficient_quota/i;
const RATE_LIMIT = /\b429\b|too many requests|rate[ _-]?limit/i;
/** Hết hạn mức mà không đọc được giờ reset => thử lại sau khoảng này (1 lượt gọi thử; thành công => hết tạm ngừng). */
export const QUOTA_COOLDOWN_MS = 5 * 60_000;
/** Không tạm ngừng quá 7 ngày dù thông báo nói lâu hơn (hạn mức tuần). */
const MAX_PAUSE_MS = 7 * 24 * 3600_000;
/** Thử lại khi bị giới hạn tốc độ tạm thời: chờ 2s rồi 5s. */
const RATE_LIMIT_RETRY_MS = [2000, 5000];

/** Giờ reset đọc từ thông báo lỗi (ms epoch) — "resets_in_seconds": N | "try again in 1 day 2 hours 3 minutes" | "try again at 1:41 PM". */
export function parseResetAt(message: string, now = Date.now()): number | null {
  const secs = /resets?_in_seconds"?\s*[:=]\s*(\d+)/i.exec(message);
  if (secs) return now + Number(secs[1]) * 1000;
  const inM = /try again in ([^.\n]*)/i.exec(message);
  if (inM) {
    const unit = (re: RegExp) => Number(re.exec(inM[1]!)?.[1] ?? 0);
    const ms = unit(/(\d+)\s*days?/i) * 86400_000 + unit(/(\d+)\s*h(?:ours?|rs?)?\b/i) * 3600_000 + unit(/(\d+)\s*m(?:in(?:ute)?s?)?\b/i) * 60_000 + unit(/(\d+)\s*s(?:ec(?:ond)?s?)?\b/i) * 1000;
    if (ms > 0) return now + ms;
  }
  const at = /try again at (\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(message);
  if (at) {
    let h = Number(at[1]) % 12;
    if ((at[3] ?? '').toUpperCase() === 'PM') h += 12;
    if (!at[3]) h = Number(at[1]);
    const d = new Date(now);
    d.setHours(h, Number(at[2]), 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null;
}

export function classifyLlmError(message: string): LlmIssueKind {
  if (USAGE_LIMIT.test(message)) return 'quota';
  if (RATE_LIMIT.test(message)) return 'rate_limit';
  return 'error';
}

export interface LlmHealth {
  lastSuccessAt: string | null;
  lastIssue: { kind: LlmIssueKind; message: string; at: string } | null;
  /** Đang tạm ngừng gọi Codex vì hết hạn mức của gói (tới thời điểm này). */
  pausedUntil: string | null;
}

const health: { lastSuccessAt: number | null; lastIssue: { kind: LlmIssueKind; message: string; at: number; until: number | null } | null } = { lastSuccessAt: null, lastIssue: null };

export function llmHealth(): LlmHealth {
  const i = health.lastIssue;
  const paused = i?.kind === 'quota' && i.until !== null && (!health.lastSuccessAt || health.lastSuccessAt < i.at) && Date.now() < i.until;
  return {
    lastSuccessAt: health.lastSuccessAt ? new Date(health.lastSuccessAt).toISOString() : null,
    lastIssue: i ? { kind: i.kind, message: i.message, at: new Date(i.at).toISOString() } : null,
    pausedUntil: paused && i?.until ? new Date(i.until).toISOString() : null,
  };
}

/** Ghi nhận kết quả 1 lượt gọi model (dùng chung cho Codex thật; test gọi trực tiếp). Trả về loại lỗi. */
export function recordLlmResult(error?: unknown): LlmIssueKind | null {
  if (!error) {
    health.lastSuccessAt = Date.now();
    return null;
  }
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  const kind = classifyLlmError(message);
  const now = Date.now();
  const until = kind === 'quota' ? Math.min(parseResetAt(message, now) ?? now + QUOTA_COOLDOWN_MS, now + MAX_PAUSE_MS) : null;
  health.lastIssue = { kind, message, at: now, until };
  if (kind === 'quota') console.error(`[chatbot] tài khoản ChatGPT hết hạn mức của gói — tạm ngừng gọi Codex tới ${new Date(until!).toISOString()}: ${message}`);
  else if (kind === 'rate_limit') console.warn(`[chatbot] ChatGPT giới hạn tốc độ tạm thời (không tạm ngừng trợ lý): ${message}`);
  return kind;
}

export const resetLlmHealthForTests = () => {
  health.lastSuccessAt = null;
  health.lastIssue = null;
};

// ------------------------------------------------------------------ CODEX_HOME riêng

export const codexHome = () => env.CHATBOT_CODEX_HOME;
const workspaceDir = () => join(codexHome(), 'workspace');

/** Tính năng Codex bị tắt cho bot (danh sách lấy từ `codex features list`, CLI 0.162). Tên lạ với bản CLI khác bị bỏ qua. */
const DISABLED_FEATURES = [
  'shell_tool',
  'unified_exec',
  'unified_exec_tty',
  'shell_snapshot',
  'apps',
  'browser_use',
  'browser_use_external',
  'browser_use_full_cdp_access',
  'computer_use',
  'code_mode_host',
  'hooks',
  'image_generation',
  'multi_agent',
  'plugins',
  'remote_plugin',
  'plugin_sharing',
  'skill_search',
  'skill_mcp_dependency_install',
  'tool_suggest',
  'view_image',
  'goals',
  'sleep_tool',
  'worktrees',
  'memories',
  'in_app_browser',
  'in_app_local_automation',
  'realtime_conversation',
];

const CONFIG_TOML = `# Sinh tự động bởi backend (src/modules/chatbot/chatbot.llm.ts) — đừng sửa tay, server ghi đè khi khởi động.
# CODEX_HOME riêng của chatbot hỗ trợ: chỉ dùng để trả lời khách bằng structured output, không tool, không mạng.
approval_policy = "never"
sandbox_mode = "read-only"
web_search = "disabled"
model_reasoning_effort = "low"
# Lưu token đăng nhập ChatGPT ra file auth.json trong thư mục này (không dùng keyring của hệ điều hành).
cli_auth_credentials_store = "file"

[history]
persistence = "none"

[features]
${DISABLED_FEATURES.map((f) => `${f} = false`).join('\n')}
`;

/** Tạo CODEX_HOME + workspace rỗng + config.toml (idempotent, ghi đè config khi nội dung khác). */
export function ensureCodexHome(): string {
  const home = codexHome();
  mkdirSync(workspaceDir(), { recursive: true });
  const cfgPath = join(home, 'config.toml');
  const current = existsSync(cfgPath) ? readFileSync(cfgPath, 'utf8') : null;
  if (current !== CONFIG_TOML) writeFileSync(cfgPath, CONFIG_TOML, 'utf8');
  return home;
}

let authCache: { at: number; ok: boolean } | null = null;
/** Xóa cache trạng thái đăng nhập (sau khi đăng nhập/đăng xuất). */
export const resetCodexAuthCache = () => {
  authCache = null;
};
/** Đã đăng nhập ChatGPT cho CODEX_HOME của bot chưa (có auth.json). Cache 30s. */
export function codexLoggedIn(): boolean {
  if (authCache && Date.now() - authCache.at < 30_000) return authCache.ok;
  const ok = existsSync(join(codexHome(), 'auth.json'));
  authCache = { at: Date.now(), ok };
  return ok;
}

/** Biến môi trường tối thiểu cho tiến trình codex (không kế thừa secret của backend). */
export function childEnv(): Record<string, string> {
  const keep = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'windir', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'LC_ALL', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'SSL_CERT_FILE'];
  const out: Record<string, string> = {};
  for (const k of keep) {
    const v = process.env[k];
    if (v) out[k] = v;
  }
  out.CODEX_HOME = codexHome();
  return out;
}

/** JSON Schema strict cho structured output (bỏ khóa $schema). */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export class CodexLlm implements ChatLlm {
  private codex: Codex | null = null;

  private client(): Codex {
    if (!this.codex) {
      ensureCodexHome();
      this.codex = new Codex({ env: childEnv(), ...(env.CHATBOT_CODEX_PATH ? { codexPathOverride: env.CHATBOT_CODEX_PATH } : {}) });
    }
    return this.codex;
  }

  async complete<T>(req: LlmRequest<T>): Promise<{ output: T; usage: LlmUsage }> {
    const paused = llmHealth().pausedUntil;
    if (paused) throw new LlmQuotaError(`Đang tạm ngừng gọi Codex vì hết hạn mức của gói (tới ${paused})`);
    for (let attempt = 0; ; attempt++) {
      try {
        const out = await this.runOnce(req);
        recordLlmResult();
        return out;
      } catch (e) {
        if (e instanceof LlmBusyError) throw e;
        const kind = recordLlmResult(e);
        if (kind === 'quota') throw new LlmQuotaError(e instanceof Error ? e.message : String(e));
        // Giới hạn tốc độ tạm thời: thử lại sau vài giây; vẫn bị => báo "đông người", KHÔNG tạm ngừng cả trợ lý.
        if (kind === 'rate_limit') {
          const wait = RATE_LIMIT_RETRY_MS[attempt];
          if (wait === undefined) throw new LlmBusyError();
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw e;
      }
    }
  }

  private runOnce<T>(req: LlmRequest<T>): Promise<{ output: T; usage: LlmUsage }> {
    return (async () => {
      const thread = this.client().startThread({
        ...(req.model ? { model: req.model } : {}),
        sandboxMode: 'read-only',
        approvalPolicy: 'never',
        workingDirectory: workspaceDir(),
        skipGitRepoCheck: true,
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
        modelReasoningEffort: 'low',
      });
      const signal = req.signal ? AbortSignal.any([req.signal, AbortSignal.timeout(env.CHATBOT_TIMEOUT_MS)]) : AbortSignal.timeout(env.CHATBOT_TIMEOUT_MS);
      const turn = await thread.run(req.prompt, { outputSchema: jsonSchemaOf(req.schema), signal });
      const used = turn.items.filter((i) => i.type === 'command_execution' || i.type === 'file_change' || i.type === 'mcp_tool_call' || i.type === 'web_search');
      if (used.length) console.warn(`[chatbot] Codex đã cố dùng tool (${used.map((i) => i.type).join(', ')}) — bỏ qua, chỉ lấy câu trả lời`);
      const raw = turn.finalResponse.trim();
      const parsed = req.schema.safeParse(JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) || 'null'));
      if (!parsed.success) throw new Error(`Codex trả JSON sai schema: ${parsed.error.message.slice(0, 300)}`);
      return { output: parsed.data, usage: { tokensIn: turn.usage?.input_tokens ?? 0, tokensOut: turn.usage?.output_tokens ?? 0 } };
    })();
  }
}

/** Xóa phiên Codex cũ trong CODEX_HOME/sessions (chứa nội dung chat của khách). Job `chatbot.codexCleanup`. */
export async function cleanupCodexSessions(maxAgeMs = 3600_000): Promise<{ removed: number }> {
  let removed = 0;
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (Date.now() - (await stat(p)).mtimeMs > maxAgeMs) {
        await rm(p, { force: true });
        removed++;
      }
    }
  };
  for (const sub of ['sessions', 'archived_sessions', 'log']) await walk(join(codexHome(), sub));
  return { removed };
}
