import { randomBytes } from 'node:crypto';
import type { Response } from 'express';

/** Trung tâm SSE: user → các kết nối đang mở (nhiều tab/thiết bị). */
const connections = new Map<string, Set<Response>>();
const HEARTBEAT_MS = 25_000;

export const streamHub = {
  isOnline: (userId: string) => (connections.get(userId)?.size ?? 0) > 0,

  /** Gửi 1 event tới mọi kết nối của user; trả về số kết nối đã gửi. */
  push(userId: string, event: string, data: unknown): number {
    const set = connections.get(userId);
    if (!set) return 0;
    for (const res of set) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return set.size;
  },

  /** Đăng ký 1 phản hồi SSE; tự dọn khi client ngắt kết nối. */
  attach(userId: string, res: Response): void {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // tắt buffer của nginx/ALB để event tới ngay
    });
    res.flushHeaders();
    res.write('event: ready\ndata: {}\n\n');

    const set = connections.get(userId) ?? new Set<Response>();
    set.add(res);
    connections.set(userId, set);

    const timer = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    timer.unref();
    res.on('close', () => {
      clearInterval(timer);
      set.delete(res);
      if (set.size === 0) connections.delete(userId);
    });
  },

  closeAll(): void {
    for (const set of connections.values()) for (const res of set) res.end();
  },
};

/** Vé ngắn hạn vì EventSource không đặt được header Authorization. TTL 30s, dùng 1 lần. */
const TICKET_TTL_MS = 30_000;
const tickets = new Map<string, { userId: string; exp: number }>();

export function issueStreamTicket(userId: string) {
  const now = Date.now();
  for (const [t, v] of tickets) if (v.exp < now) tickets.delete(t);
  const ticket = randomBytes(24).toString('base64url');
  tickets.set(ticket, { userId, exp: now + TICKET_TTL_MS });
  return { ticket, expiresAt: new Date(now + TICKET_TTL_MS).toISOString() };
}

export function consumeStreamTicket(ticket: string): string | null {
  const v = tickets.get(ticket);
  tickets.delete(ticket);
  return v && v.exp >= Date.now() ? v.userId : null;
}
