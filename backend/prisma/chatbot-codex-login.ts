/**
 * Đăng nhập ChatGPT cho CODEX_HOME RIÊNG của chatbot (mặc định backend/data/codex-home, env CHATBOT_CODEX_HOME).
 * Tách khỏi ~/.codex của người vận hành để: không dùng chung hook/plugin cá nhân, và không tranh nhau làm mới token.
 * Cách dễ hơn: Admin > Hỗ trợ > Chatbot > Cài đặt > "Tài khoản ChatGPT" (Super Admin) — copy link + mã, không cần terminal.
 *   npm run chatbot:codex-login                     # mặc định: in link + mã thiết bị để copy (KHÔNG tự mở trình duyệt)
 *   npm run chatbot:codex-login -- --browser        # mở trình duyệt đăng nhập trên chính máy này
 *   npm run chatbot:codex-login -- status           # xem trạng thái đăng nhập
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { env } from '../src/config/env.js';
import { ensureCodexHome } from '../src/modules/chatbot/chatbot.llm.js';

const home = ensureCodexHome();
const codexJs = env.CHATBOT_CODEX_PATH ?? createRequire(import.meta.url).resolve('@openai/codex/bin/codex.js');
const raw = process.argv.slice(2);
// Mặc định dùng mã thiết bị; `--browser` = luồng mở trình duyệt cũ; `status`/`--device-auth` truyền thẳng.
const args = raw.includes('--browser') ? raw.filter((a) => a !== '--browser') : raw.length ? raw : ['--device-auth'];
const cmd = env.CHATBOT_CODEX_PATH ? codexJs : process.execPath;
const argv = [...(env.CHATBOT_CODEX_PATH ? [] : [codexJs]), 'login', ...args];
console.log(`[chatbot] CODEX_HOME = ${home}`);
const child = spawn(cmd, argv, { stdio: 'inherit', env: { ...process.env, CODEX_HOME: home } });
child.on('exit', (code) => process.exit(code ?? 1));
