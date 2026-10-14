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
 *  - giới hạn số tiến trình chạy song song + timeout mỗi lượt.
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
}

export interface ChatLlm {
  complete<T>(req: LlmRequest<T>): Promise<{ output: T; usage: LlmUsage }>;
}

export class LlmBusyError extends Error {
  constructor() {
    super('Chatbot đang bận, vui lòng thử lại sau ít giây');
  }
}

/** Tài khoản ChatGPT hết hạn mức (gói free/Plus có giới hạn) — khác lỗi thường: tạm ngừng gọi Codex một lúc. */
export class LlmQuotaError extends Error {}

const QUOTA_PATTERN = /usage limit|rate limit|quota|too many requests|429/i;
/** Sau khi hết hạn mức, không gọi Codex lại trong khoảng này (tránh dồn yêu cầu vô ích, trả lời khách ngay). */
export const QUOTA_COOLDOWN_MS = 5 * 60_000;

export interface LlmHealth {
  lastSuccessAt: string | null;
  lastIssue: { kind: 'quota' | 'error'; message: string; at: string } | null;
  /** Đang tạm ngừng gọi Codex vì hết hạn mức (tới thời điểm này). */
  pausedUntil: string | null;
}

const health: { lastSuccessAt: number | null; lastIssue: { kind: 'quota' | 'error'; message: string; at: number } | null } = { lastSuccessAt: null, lastIssue: null };

export function llmHealth(): LlmHealth {
  const i = health.lastIssue;
  const paused = i?.kind === 'quota' && (!health.lastSuccessAt || health.lastSuccessAt < i.at) && Date.now() - i.at < QUOTA_COOLDOWN_MS;
  return {
    lastSuccessAt: health.lastSuccessAt ? new Date(health.lastSuccessAt).toISOString() : null,
    lastIssue: i ? { kind: i.kind, message: i.message, at: new Date(i.at).toISOString() } : null,
    pausedUntil: paused && i ? new Date(i.at + QUOTA_COOLDOWN_MS).toISOString() : null,
  };
}

/** Ghi nhận kết quả 1 lượt gọi model (dùng chung cho Codex thật; test gọi trực tiếp). Lỗi hết hạn mức => LlmQuotaError. */
export function recordLlmResult(error?: unknown): void {
  if (!error) {
    health.lastSuccessAt = Date.now();
    return;
  }
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  const kind = QUOTA_PATTERN.test(message) ? 'quota' : 'error';
  health.lastIssue = { kind, message, at: Date.now() };
  if (kind === 'quota') console.error(`[chatbot] tài khoản ChatGPT hết hạn mức — tạm ngừng gọi Codex ${QUOTA_COOLDOWN_MS / 60_000} phút: ${message}`);
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

/** Hàng đợi giới hạn số lượt chạy song song; chờ quá `waitMs` => LlmBusyError. */
function limiter(max: number, waitMs: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          const i = queue.indexOf(go);
          if (i >= 0) queue.splice(i, 1);
          reject(new LlmBusyError());
        }, waitMs);
        const go = () => {
          clearTimeout(timer);
          resolve();
        };
        queue.push(go);
      });
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

export class CodexLlm implements ChatLlm {
  private codex: Codex | null = null;
  private readonly run = limiter(env.CHATBOT_MAX_CONCURRENCY, 20_000);

  private client(): Codex {
    if (!this.codex) {
      ensureCodexHome();
      this.codex = new Codex({ env: childEnv(), ...(env.CHATBOT_CODEX_PATH ? { codexPathOverride: env.CHATBOT_CODEX_PATH } : {}) });
    }
    return this.codex;
  }

  async complete<T>(req: LlmRequest<T>): Promise<{ output: T; usage: LlmUsage }> {
    const paused = llmHealth().pausedUntil;
    if (paused) throw new LlmQuotaError(`Đang tạm ngừng gọi Codex vì hết hạn mức (tới ${paused})`);
    try {
      const out = await this.runOnce(req);
      recordLlmResult();
      return out;
    } catch (e) {
      if (e instanceof LlmBusyError) throw e;
      recordLlmResult(e);
      if (llmHealth().lastIssue?.kind === 'quota') throw new LlmQuotaError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  private runOnce<T>(req: LlmRequest<T>): Promise<{ output: T; usage: LlmUsage }> {
    return this.run(async () => {
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
    });
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
