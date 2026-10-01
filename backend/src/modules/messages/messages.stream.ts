import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { shared } from '../../infra/shared.js';

/**
 * Trung tâm SSE: user → các kết nối đang mở TRÊN INSTANCE NÀY (nhiều tab/thiết bị).
 *
 * Fan-out nhiều instance: `push()` KHÔNG ghi thẳng vào socket mà publish lên kênh pub/sub dùng chung (Redis khi có REDIS_URL,
 * in-memory nếu không); mọi instance đã subscribe nhận lại và ghi cho các kết nối cục bộ của userId đó. Nhờ vậy người gửi POST
 * ở instance A, người nhận cắm SSE ở instance B vẫn nhận được event. SSE chỉ là kênh BEST-EFFORT: dữ liệu thật luôn ở DB.
 */
const connections = new Map<string, Set<Response>>();
const HEARTBEAT_MS = 25_000;
const CHANNEL = 'sse:messages';

interface Envelope {
  userId: string;
  event: string;
  data: unknown;
}

function deliverLocal({ userId, event, data }: Envelope): number {
  const set = connections.get(userId);
  if (!set) return 0;
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(frame);
    } catch {
      /* socket đã chết: sự kiện 'close' sẽ dọn */
    }
  }
  return set.size;
}

let subscribing: Promise<() => Promise<void>> | undefined;
function ensureSubscribed(): Promise<unknown> {
  subscribing ??= shared()
    .pubsub.subscribe(CHANNEL, (raw) => {
      try {
        deliverLocal(JSON.parse(raw) as Envelope);
      } catch (e) {
        console.error('[sse] gói tin lỗi', e instanceof Error ? e.message : e);
      }
    })
    .catch((e) => {
      subscribing = undefined; // lần attach sau thử lại
      throw e;
    });
  return subscribing;
}

export const streamHub = {
  /** Có kết nối SSE trên instance NÀY không. KHÔNG dùng làm tín hiệu "online" (kết nối xác sống vẫn tính). */
  hasLocalConnection: (userId: string) => (connections.get(userId)?.size ?? 0) > 0,

  /** Số kết nối đang mở trên instance này (chẩn đoán/test). */
  connectionCount(): number {
    let n = 0;
    for (const s of connections.values()) n += s.size;
    return n;
  },

  /**
   * Gửi 1 event tới mọi kết nối của user ở MỌI instance (best-effort). Không bao giờ ném lỗi: nếu pub/sub hỏng thì
   * rơi về giao hàng cục bộ (đủ cho 1 instance) — người nhận ở instance khác sẽ thấy khi tải lại (dữ liệu ở DB).
   */
  async push(userId: string, event: string, data: unknown): Promise<void> {
    const env: Envelope = { userId, event, data };
    try {
      await shared().pubsub.publish(CHANNEL, JSON.stringify(env));
    } catch (e) {
      console.error('[sse] publish thất bại, giao cục bộ:', e instanceof Error ? e.message : e);
      deliverLocal(env);
    }
  },

  /** Đăng ký 1 phản hồi SSE; tự dọn khi client ngắt kết nối. */
  async attach(userId: string, res: Response): Promise<void> {
    // Đăng ký kênh pub/sub XONG rồi mới báo `ready`: client thấy ready nghĩa là event gửi sau đó chắc chắn tới (không rơi vào khe hở subscribe).
    await ensureSubscribed().catch(() => undefined); // lỗi đã được log trong push khi cần
    if (res.destroyed || res.writableEnded) return; // client đã bỏ đi trong lúc chờ subscribe
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

  /** Đóng mọi kết nối SSE cục bộ (shutdown) và hủy đăng ký kênh. */
  async closeAll(): Promise<void> {
    for (const set of [...connections.values()]) for (const res of [...set]) res.end();
    connections.clear();
    const s = subscribing;
    subscribing = undefined;
    if (s) await s.then((off) => off()).catch(() => undefined);
  },
};

/** Vé ngắn hạn vì EventSource không đặt được header Authorization. TTL 30s, dùng 1 lần, lưu state chia sẻ (mint ở A, redeem ở B được). */
const TICKET_TTL_MS = 30_000;
const TICKET_PREFIX = 'ticket:messages:';

export async function issueStreamTicket(userId: string) {
  const ticket = randomBytes(24).toString('base64url');
  await shared().kv.set(TICKET_PREFIX + ticket, userId, TICKET_TTL_MS);
  return { ticket, expiresAt: new Date(Date.now() + TICKET_TTL_MS).toISOString() };
}

/** Atomic: chỉ một lần redeem thành công dù nhiều request/instance đua nhau. */
export async function consumeStreamTicket(ticket: string): Promise<string | null> {
  return shared().kv.getDel(TICKET_PREFIX + ticket);
}
