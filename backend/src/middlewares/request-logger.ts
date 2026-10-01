import morgan from 'morgan';
import type { RequestHandler } from 'express';

/** Tham số query có thể chứa bí mật (token đăng nhập, vé SSE/upload, chữ ký URL file) — không bao giờ được ghi log. */
const SENSITIVE_QUERY = /([?&](?:access_token|refresh_token|token|ticket|sig|signature|code|password)=)[^&#\s]*/gi;

/** Che giá trị các tham số nhạy cảm trong URL/Referer trước khi ghi log. */
export function redactUrl(url: string | undefined): string {
  return (url ?? '-').replace(SENSITIVE_QUERY, '$1[redacted]');
}

morgan.token('safe-url', (req) => redactUrl((req as { originalUrl?: string; url?: string }).originalUrl ?? req.url));
morgan.token('safe-referrer', (req) => redactUrl(req.headers.referer ?? req.headers.referrer?.toString()));

// Giống 'combined' / 'dev' của morgan nhưng dùng :safe-url / :safe-referrer thay cho :url / :referrer.
export const COMBINED_FORMAT =
  ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":safe-referrer" ":user-agent"';
export const DEV_FORMAT = ':method :safe-url :status :response-time ms - :res[content-length]';

export function requestLogger(prod: boolean, stream?: { write(line: string): void }): RequestHandler {
  return morgan(prod ? COMBINED_FORMAT : DEV_FORMAT, stream ? { stream } : {});
}
