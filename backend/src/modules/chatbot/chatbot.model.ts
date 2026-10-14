import { env } from '../../config/env.js';
import { FakeChatModel } from './chatbot.fake-model.js';
import { CodexLlm, type ChatLlm } from './chatbot.llm.js';

let override: ChatLlm | null = null;
let codex: CodexLlm | null = null;
let fake: FakeChatModel | null = null;

/** Test: ép mọi lượt dùng model này (null = theo cấu hình). */
export function setChatLlmForTests(llm: ChatLlm | null) {
  override = llm;
}

/** Model hiệu lực: override test > model giả (CHATBOT_FAKE_MODEL=1) > Codex (đăng nhập ChatGPT). */
export function chatLlm(): ChatLlm {
  if (override) return override;
  if (env.CHATBOT_FAKE_MODEL) return (fake ??= new FakeChatModel());
  return (codex ??= new CodexLlm());
}
