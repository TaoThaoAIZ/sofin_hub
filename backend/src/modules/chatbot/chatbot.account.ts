import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { auditService } from '../admin/admin-audit.service.js';
import { codexHome, ensureCodexHome, resetCodexAuthCache } from './chatbot.llm.js';

/**
 * Tài khoản ChatGPT của chatbot (Admin > Hệ thống > Chatbot — chỉ Super Admin): xem trạng thái, đăng nhập bằng MÃ THIẾT BỊ
 * (device auth — server không mở trình duyệt; admin copy link + mã, mở trên máy bất kỳ), đăng xuất.
 * Tiến trình `codex login --device-auth` chạy trong nền tối đa 15 phút (hạn của mã). Chỉ 1 phiên đăng nhập cùng lúc / instance.
 * Không bao giờ trả token: chỉ email + gói lấy từ phần payload của id_token.
 */

const DEVICE_URL = /https:\/\/auth\.openai\.com\/\S+/;
const DEVICE_CODE = /\b[A-Z0-9]{4}-[A-Z0-9]{4,6}\b/;
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
const LOGIN_TTL_MS = 15 * 60_000;

interface Pending {
  child: ChildProcess;
  url: string | null;
  code: string | null;
  startedAt: Date;
  expiresAt: Date;
  output: string;
}

let pending: Pending | null = null;
let lastResult: { at: Date; ok: boolean; message: string } | null = null;

function codexCommand(args: string[]): { cmd: string; argv: string[] } {
  if (env.CHATBOT_CODEX_PATH) return { cmd: env.CHATBOT_CODEX_PATH, argv: args };
  const js = createRequire(import.meta.url).resolve('@openai/codex/bin/codex.js');
  return { cmd: process.execPath, argv: [js, ...args] };
}

function runCodex(args: string[], timeoutMs = 20_000): Promise<{ code: number | null; output: string }> {
  ensureCodexHome();
  const { cmd, argv } = codexCommand(args);
  return new Promise((resolve) => {
    const child = spawn(cmd, argv, { env: { ...process.env, CODEX_HOME: codexHome() }, windowsHide: true });
    let output = '';
    child.stdout?.on('data', (d) => (output += String(d)));
    child.stderr?.on('data', (d) => (output += String(d)));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output: output.replace(ANSI, '') });
    });
  });
}

/** Email + gói ChatGPT từ id_token trong auth.json (chỉ đọc payload, không xác minh chữ ký, không trả token). */
function accountInfo(): { email: string | null; plan: string | null } {
  try {
    const auth = JSON.parse(readFileSync(join(codexHome(), 'auth.json'), 'utf8')) as { tokens?: { id_token?: string } };
    const payload = auth.tokens?.id_token?.split('.')[1];
    if (!payload) return { email: null, plan: null };
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>;
    const openai = (claims['https://api.openai.com/auth'] ?? {}) as Record<string, unknown>;
    return { email: typeof claims.email === 'string' ? claims.email : null, plan: typeof openai.chatgpt_plan_type === 'string' ? openai.chatgpt_plan_type : null };
  } catch {
    return { email: null, plan: null };
  }
}

function view() {
  const loggedIn = existsSync(join(codexHome(), 'auth.json'));
  const p = pending;
  return {
    loggedIn,
    ...(loggedIn ? accountInfo() : { email: null, plan: null }),
    codexHome: codexHome(),
    pending: p && p.url && p.code ? { url: p.url, code: p.code, startedAt: p.startedAt.toISOString(), expiresAt: p.expiresAt.toISOString() } : null,
    lastResult: lastResult ? { at: lastResult.at.toISOString(), ok: lastResult.ok, message: lastResult.message } : null,
  };
}

export const chatbotAccountService = {
  status: view,

  /** Bắt đầu đăng nhập bằng mã thiết bị; trả link + mã ngay khi CLI in ra (tối đa ~20s). Đang có phiên chờ thì trả lại phiên đó. */
  async startLogin(actorId: string) {
    if (pending?.url && pending.code && pending.expiresAt > new Date()) return view();
    ensureCodexHome();
    const { cmd, argv } = codexCommand(['login', '--device-auth']);
    const child = spawn(cmd, argv, { env: { ...process.env, CODEX_HOME: codexHome() }, windowsHide: true });
    const startedAt = new Date();
    const p: Pending = { child, url: null, code: null, startedAt, expiresAt: new Date(startedAt.getTime() + LOGIN_TTL_MS), output: '' };
    pending = p;
    const onData = (d: unknown) => {
      p.output += String(d).replace(ANSI, '');
      const after = p.output.slice(p.output.search(/one-time code|code/i) + 1);
      p.url ??= DEVICE_URL.exec(p.output)?.[0] ?? null;
      p.code ??= DEVICE_CODE.exec(after)?.[0] ?? null;
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    const killTimer = setTimeout(() => child.kill(), LOGIN_TTL_MS + 5_000);
    child.on('close', (code) => {
      clearTimeout(killTimer);
      if (pending === p) pending = null;
      resetCodexAuthCache();
      const ok = code === 0 && existsSync(join(codexHome(), 'auth.json'));
      const tail = p.output.trim().split('\n').slice(-2).join(' ').slice(0, 300);
      lastResult = { at: new Date(), ok, message: ok ? 'Đăng nhập thành công' : tail || `codex login thoát với mã ${code}` };
      if (ok) void auditService.record(actorId, { action: 'chatbot.account.login', targetType: 'settings', targetId: 'chatbot.account', targetLabel: accountInfo().email ?? 'ChatGPT' });
    });

    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && pending === p && !(p.url && p.code)) await new Promise((r) => setTimeout(r, 200));
    if (!(p.url && p.code)) {
      child.kill();
      throw HttpError.coded(502, 'CODEX_LOGIN_FAILED', `Không lấy được mã đăng nhập từ Codex: ${p.output.trim().split('\n').slice(-2).join(' ').slice(0, 300) || 'không có phản hồi'}`);
    }
    return view();
  },

  cancelLogin() {
    pending?.child.kill();
    pending = null;
    return view();
  },

  async logout(actorId: string) {
    pending?.child.kill();
    pending = null;
    const email = accountInfo().email;
    await runCodex(['logout']);
    resetCodexAuthCache();
    await auditService.record(actorId, { action: 'chatbot.account.logout', targetType: 'settings', targetId: 'chatbot.account', targetLabel: email ?? 'ChatGPT' });
    return view();
  },
};
