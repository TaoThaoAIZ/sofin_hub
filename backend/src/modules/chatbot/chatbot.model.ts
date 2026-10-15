import { env } from '../../config/env.js';
import { FakeChatModel } from './chatbot.fake-model.js';
import { createLimiter } from './chatbot.limiter.js';
import { CodexLlm, llmHealth, LlmQuotaError, type ChatLlm, type LlmRequest } from './chatbot.llm.js';

let override: ChatLlm | null = null;
let codex: CodexLlm | null = null;
let fake: FakeChatModel | null = null;

/** Hàng đợi giới hạn song song CHUNG cho mọi lượt gọi AI của tiến trình (bot Tào + bot cộng đồng + job học). */
export const llmLimiter = createLimiter({ max: env.CHATBOT_MAX_CONCURRENCY, waitMs: env.CHATBOT_QUEUE_WAIT_MS });

/**
 * Tài khoản ChatGPT cá nhân (đăng nhập Codex) KHÔNG dành cho tải tự động cao: chạy nhiều lượt song song dễ chạm hạn mức và có rủi ro vi
 * phạm điều khoản / bị khóa tài khoản (mọi bot ngừng). Muốn phục vụ đông người => dùng API key / gói doanh nghiệp, không ép tài khoản này.
 */
export const SAFE_CHATGPT_CONCURRENCY = 3;
if (!env.CHATBOT_FAKE_MODEL && env.NODE_ENV !== 'test' && env.CHATBOT_MAX_CONCURRENCY > SAFE_CHATGPT_CONCURRENCY) {
  console.warn(
    `[chatbot] CHATBOT_MAX_CONCURRENCY=${env.CHATBOT_MAX_CONCURRENCY} > ${SAFE_CHATGPT_CONCURRENCY}: tài khoản ChatGPT cá nhân không dành cho tải tự động cao (rủi ro hạn mức / vi phạm điều khoản). Cân nhắc API key khi cần phục vụ đông người.`,
  );
}

/** Test: ép mọi lượt dùng model này (null = theo cấu hình). */
export function setChatLlmForTests(llm: ChatLlm | null) {
  override = llm;
}

function raw(): ChatLlm {
  if (override) return override;
  if (env.CHATBOT_FAKE_MODEL) return (fake ??= new FakeChatModel());
  return (codex ??= new CodexLlm());
}

/**
 * Model hiệu lực (override test > model giả CHATBOT_FAKE_MODEL=1 > Codex), luôn đi qua hàng đợi `llmLimiter`. Đang tạm ngừng vì hết
 * hạn mức ChatGPT => trả lỗi ngay, không xếp hàng.
 */
export function chatLlm(): ChatLlm {
  const inner = raw();
  return {
    complete<T>(req: LlmRequest<T>) {
      const paused = llmHealth().pausedUntil;
      if (paused && inner instanceof CodexLlm) return Promise.reject(new LlmQuotaError(`Đang tạm ngừng gọi Codex vì hết hạn mức (tới ${paused})`));
      return llmLimiter.run(() => inner.complete(req), req.onQueued);
    },
  };
}
