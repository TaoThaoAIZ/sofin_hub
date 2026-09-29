import { randomBytes, randomUUID } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import type { ListNotificationsQuery, UpdatePreferencesBody } from './notifications.schema.js';
import { prismaNotificationsRepository, type NotificationsRepository } from './notifications.repository.js';
import {
  MANDATORY_TYPES,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationPreferences,
  type NotificationType,
} from './notifications.types.js';

/**
 * Điểm phát thông báo dùng chung cho mọi module (bài viết, sự kiện, thanh toán...). Các module KHÁC chỉ cần gọi
 * `notify()`; phần đọc / đánh dấu đã đọc / realtime nằm ở notifications.routes.ts.
 *
 * `notify()` giữ chữ ký ĐỒNG BỘ (nhiều nơi gọi không await): trả ngay đối tượng thông báo (id/createdAt sinh tại app),
 * còn việc kiểm tra preference + ghi DB chạy nền, tuần tự, có bắt lỗi. Đọc (list/unread/read...) luôn `await flush` trước
 * nên trong cùng tiến trình luôn thấy thông báo vừa `notify()`. Test dùng `flushNotifications()` để chờ.
 */
export { NOTIFICATION_TYPES };
export type { Notification, NotificationType };

const TICKET_TTL_MS = 30_000;
/** Cache preference ngắn hạn để `notify()` không phải hỏi DB mỗi lần (nhiều instance: tối đa lệch bằng TTL này). */
const PREFS_TTL_MS = 5_000;
/** Nhật ký các thông báo phát gần đây trong tiến trình (chỉ để chẩn đoán/test, KHÔNG phải nguồn dữ liệu). */
const RECENT_MAX = 1000;

export function defaultPreferences(): NotificationPreferences {
  return {
    types: Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, true])) as Record<NotificationType, boolean>,
    emailDigest: 'off',
  };
}

const isMandatory = (t: NotificationType) => MANDATORY_TYPES.includes(t);

function mergePrefs(saved: NotificationPreferences | undefined): NotificationPreferences {
  const base = defaultPreferences();
  if (!saved) return base;
  const types = { ...base.types, ...saved.types };
  for (const t of MANDATORY_TYPES) types[t] = true; // loại quan trọng luôn bật
  return { types, emailDigest: saved.emailDigest };
}

export function createNotificationsService(repo: NotificationsRepository = prismaNotificationsRepository) {
  const listeners = new Set<(n: Notification) => void>();
  /**
   * Vé SSE: giữ trong bộ nhớ tiến trình (sống 30s, dùng 1 lần) — cố ý không lưu DB.
   * Chạy nhiều instance phía sau load balancer thì cần Redis (hoặc sticky session) để vé/stream dùng chung.
   */
  const tickets = new Map<string, { userId: string; expiresAt: number }>();

  const prefsCache = new Map<string, { prefs: NotificationPreferences; exp: number }>();
  const recent: Notification[] = [];
  const pending = new Set<Promise<unknown>>();
  let writeChain: Promise<unknown> = Promise.resolve();
  let lastTs = 0;

  /** createdAt tăng ngặt theo từng ms trong tiến trình => thứ tự "mới nhất trước" luôn xác định. */
  const nextTimestamp = () => new Date((lastTs = Math.max(Date.now(), lastTs + 1)));

  const track = <T>(p: Promise<T>): Promise<T> => {
    pending.add(p);
    void p.finally(() => pending.delete(p)).catch(() => undefined);
    return p;
  };

  /** Chờ mọi ghi nền đang chờ xong (kể cả cái phát sinh trong lúc chờ). */
  async function flush(): Promise<void> {
    while (pending.size > 0) await Promise.allSettled([...pending]);
  }

  async function loadPreferences(userId: string): Promise<NotificationPreferences> {
    const hit = prefsCache.get(userId);
    if (hit && hit.exp > Date.now()) return hit.prefs;
    const prefs = mergePrefs(await repo.getPrefs(userId));
    prefsCache.set(userId, { prefs, exp: Date.now() + PREFS_TTL_MS });
    return prefs;
  }

  function enqueueWrite(n: Notification): void {
    const p = writeChain.then(() => repo.add(n)).catch((e) => {
      console.error('[notifications] ghi thông báo thất bại', n.id, e instanceof Error ? e.message : e);
    });
    writeChain = p;
    track(p);
  }

  function accept(n: Notification, prefs: NotificationPreferences): void {
    if (!isMandatory(n.type) && !prefs.types[n.type]) {
      const i = recent.indexOf(n);
      if (i >= 0) recent.splice(i, 1);
      return;
    }
    for (const fn of listeners) {
      try {
        fn(n);
      } catch {
        /* listener lỗi không được chặn việc lưu */
      }
    }
    enqueueWrite(n);
  }

  const service = {
    async getPreferences(userId: string): Promise<NotificationPreferences> {
      return mergePrefs(await repo.getPrefs(userId));
    },

    /**
     * Trả ngay thông báo (chữ ký cũ). Nếu user tắt loại này thì KHÔNG lưu/không phát (đối tượng trả về chỉ để giữ chữ ký).
     * Phát SSE ngay khi biết preference (đồng bộ nếu cache còn hạn), ghi DB chạy nền.
     */
    notify(input: Omit<Notification, 'id' | 'readAt' | 'createdAt'>): Notification {
      const n: Notification = { ...input, id: randomUUID(), readAt: null, createdAt: nextTimestamp().toISOString() };
      recent.push(n);
      if (recent.length > RECENT_MAX) recent.shift();
      const hit = prefsCache.get(n.userId);
      if (hit && hit.exp > Date.now()) accept(n, hit.prefs);
      else {
        track(
          loadPreferences(n.userId)
            .then((prefs) => accept(n, prefs))
            .catch((e) => {
              console.error('[notifications] đọc preference thất bại', n.id, e instanceof Error ? e.message : e);
            }),
        );
      }
      return n;
    },

    flush,

    /** Nhật ký gần đây trong tiến trình (đồng bộ; gồm cả cái đang chờ preference). Dùng cho test/chẩn đoán. */
    recent: (): Notification[] => [...recent],

    async list(userId: string, query: ListNotificationsQuery) {
      await flush();
      const { items, total } = await repo.list(userId, {
        unreadOnly: !!query.unread,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      return {
        data: items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
      };
    },

    async unreadCount(userId: string): Promise<number> {
      await flush();
      return repo.unreadCount(userId);
    },

    /** Thông báo của người khác được coi như không tồn tại (404) để không lộ id. */
    async markRead(userId: string, id: string): Promise<Notification> {
      await flush();
      const n = await repo.markRead(userId, id, new Date().toISOString());
      if (!n) throw HttpError.notFound('Không tìm thấy thông báo');
      return n;
    },

    async markAllRead(userId: string) {
      await flush();
      return { updated: await repo.markAllRead(userId, new Date().toISOString()) };
    },

    async remove(userId: string, id: string): Promise<void> {
      await flush();
      if (!(await repo.remove(userId, id))) throw HttpError.notFound('Không tìm thấy thông báo');
    },

    async updatePreferences(userId: string, body: UpdatePreferencesBody): Promise<NotificationPreferences> {
      for (const [t, on] of Object.entries(body.types ?? {})) {
        if (on === false && isMandatory(t as NotificationType)) {
          throw HttpError.badRequest(`Không thể tắt thông báo quan trọng: ${t}`);
        }
      }
      const cur = await service.getPreferences(userId);
      const next: NotificationPreferences = {
        types: { ...cur.types, ...(body.types as Partial<Record<NotificationType, boolean>> | undefined) },
        emailDigest: body.emailDigest ?? cur.emailDigest,
      };
      await repo.setPrefs(userId, next);
      prefsCache.set(userId, { prefs: next, exp: Date.now() + PREFS_TTL_MS });
      return next;
    },

    /** Vé SSE dùng 1 lần, sống 30s: tránh đưa access token (sống lâu hơn) lên URL. */
    issueStreamTicket(userId: string) {
      const now = Date.now();
      for (const [k, v] of tickets) if (v.expiresAt <= now) tickets.delete(k); // dọn vé hết hạn
      const ticket = randomBytes(24).toString('base64url');
      tickets.set(ticket, { userId, expiresAt: now + TICKET_TTL_MS });
      return { ticket, expiresInSec: TICKET_TTL_MS / 1000 };
    },

    consumeStreamTicket(ticket: string): string | undefined {
      const t = tickets.get(ticket);
      tickets.delete(ticket);
      return t && t.expiresAt > Date.now() ? t.userId : undefined;
    },

    onNew(fn: (n: Notification) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Mọi thông báo trong DB (test/chẩn đoán), sau khi chờ ghi nền xong. */
    async allFromDb(): Promise<Notification[]> {
      await flush();
      return repo.all();
    },
  };
  return service;
}

export const notificationsService = createNotificationsService();

/**
 * Giữ API cũ cho các module/test khác. `all()` vẫn ĐỒNG BỘ nhưng chỉ là nhật ký thông báo đã phát trong tiến trình này
 * (không phải nguồn dữ liệu — dữ liệu thật ở DB, xem `allFromDb()`); cần chắc chắn đã ghi DB thì `await flushNotifications()`.
 */
export const notificationStore = {
  all: () => notificationsService.recent(),
  allFromDb: () => notificationsService.allFromDb(),
  onNew: notificationsService.onNew,
};

export function notify(input: Omit<Notification, 'id' | 'readAt' | 'createdAt'>): Notification {
  return notificationsService.notify(input);
}

/** Chờ mọi thông báo đang ghi nền xong (dùng trong test và khi shutdown). */
export function flushNotifications(): Promise<void> {
  return notificationsService.flush();
}
