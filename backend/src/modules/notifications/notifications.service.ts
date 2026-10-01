import { randomBytes, randomUUID } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { shared as sharedState } from '../../infra/shared.js';
import type { Shared } from '../../infra/shared-state.js';
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
 *
 * Độ bền + realtime (AUDIT §6.3/§6.5):
 *  - Ghi DB có RETRY với backoff (`notificationWriteRetry`); thất bại hẳn thì KHÔNG nuốt im lặng: log, lưu vào hàng "thư chết"
 *    (`deadLetters()`) và gọi `opts.onWriteFailed` để nơi gọi hoàn tác cờ chống-trùng (vd. nhắc lịch sự kiện, PostLikeNotice) cho lần sau.
 *  - SSE CHỈ phát SAU KHI hàng đã commit vào DB => không có thông báo "ma" (hiện realtime kèm id nhưng DB không có).
 *  - Phát SSE đi qua pub/sub chia sẻ (Redis khi có REDIS_URL): mọi instance nhận và đẩy cho kết nối cục bộ của mình.
 *  - Vé SSE và cache preference dùng state chia sẻ: vé mint ở instance A redeem được ở B; đổi preference ở A xóa cache ở B.
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

/** Retry ghi DB khi lỗi tạm thời (test chỉnh `baseMs` nhỏ). Backoff: baseMs, 2*baseMs, 4*baseMs... */
export const notificationWriteRetry = { attempts: 4, baseMs: 100 };

export interface NotifyOptions {
  /** Gọi khi ghi DB thất bại HẲN (đã hết retry): nơi gọi hoàn tác cờ chống-trùng đã commit trước đó để lần sau còn thử lại. */
  onWriteFailed?: (n: Notification, err: unknown) => void | Promise<void>;
}

const NEW_CHANNEL = 'notif:new';
const PREFS_CHANNEL = 'notif:prefs';
const TICKET_PREFIX = 'ticket:notifications:';
const DEAD_MAX = 100;

const isMandatory = (t: NotificationType) => MANDATORY_TYPES.includes(t);

function mergePrefs(saved: NotificationPreferences | undefined): NotificationPreferences {
  const base = defaultPreferences();
  if (!saved) return base;
  const types = { ...base.types, ...saved.types };
  for (const t of MANDATORY_TYPES) types[t] = true; // loại quan trọng luôn bật
  return { types, emailDigest: saved.emailDigest };
}

export function createNotificationsService(
  repo: NotificationsRepository = prismaNotificationsRepository,
  deps: { shared?: () => Shared } = {},
) {
  const st = deps.shared ?? sharedState;
  const listeners = new Set<(n: Notification) => void>();
  const instanceId = randomUUID();
  const dead: Notification[] = [];

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

  function emitLocal(n: Notification) {
    for (const fn of listeners) {
      try {
        fn(n);
      } catch {
        /* listener lỗi không được chặn các listener khác */
      }
    }
  }

  let subscribing: Promise<unknown> | undefined;
  /** Đăng ký 2 kênh dùng chung (thông báo mới + vô hiệu cache preference). Lười, thử lại ở lần sau nếu lỗi. */
  function ensureSubscribed(): Promise<unknown> {
    subscribing ??= Promise.all([
      st().pubsub.subscribe(NEW_CHANNEL, (raw) => {
        try {
          emitLocal(JSON.parse(raw) as Notification);
        } catch (e) {
          console.error('[notifications] gói tin lỗi', e instanceof Error ? e.message : e);
        }
      }),
      st().pubsub.subscribe(PREFS_CHANNEL, (raw) => {
        try {
          const m = JSON.parse(raw) as { userId: string; origin: string };
          if (m.origin !== instanceId) prefsCache.delete(m.userId);
        } catch {
          /* bỏ qua */
        }
      }),
    ]).catch((e) => {
      subscribing = undefined;
      console.error('[notifications] không đăng ký được pub/sub:', e instanceof Error ? e.message : e);
    });
    return subscribing;
  }

  /** Phát tới mọi instance. Chỉ gọi SAU KHI hàng đã commit. Pub/sub hỏng thì rơi về phát cục bộ. */
  async function emit(n: Notification): Promise<void> {
    try {
      await st().pubsub.publish(NEW_CHANNEL, JSON.stringify(n));
    } catch {
      emitLocal(n);
    }
  }

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let i = 0; i < notificationWriteRetry.attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (i < notificationWriteRetry.attempts - 1) await new Promise((r) => setTimeout(r, notificationWriteRetry.baseMs * 2 ** i));
      }
    }
    throw last;
  }

  async function fail(n: Notification, e: unknown, opts: NotifyOptions) {
    console.error('[notifications] ghi thông báo thất bại hẳn', n.id, n.type, e instanceof Error ? e.message : e);
    dead.push(n);
    if (dead.length > DEAD_MAX) dead.shift();
    try {
      await opts.onWriteFailed?.(n, e);
    } catch (e2) {
      console.error('[notifications] onWriteFailed lỗi', e2 instanceof Error ? e2.message : e2);
    }
  }

  async function loadPreferences(userId: string): Promise<NotificationPreferences> {
    const hit = prefsCache.get(userId);
    if (hit && hit.exp > Date.now()) return hit.prefs;
    void ensureSubscribed();
    const prefs = mergePrefs(await repo.getPrefs(userId));
    prefsCache.set(userId, { prefs, exp: Date.now() + PREFS_TTL_MS });
    return prefs;
  }

  /** Ghi tuần tự (giữ thứ tự), có retry; emit SSE chỉ sau khi commit; hỏng hẳn => `fail` (không nuốt im lặng). */
  function enqueueWrite(n: Notification, opts: NotifyOptions): void {
    const p = writeChain
      .then(async () => {
        await withRetry(() => repo.add(n));
        await emit(n);
      })
      .catch((e) => fail(n, e, opts));
    writeChain = p;
    track(p);
  }

  function accept(n: Notification, prefs: NotificationPreferences, opts: NotifyOptions): void {
    if (!isMandatory(n.type) && !prefs.types[n.type]) {
      const i = recent.indexOf(n);
      if (i >= 0) recent.splice(i, 1);
      return;
    }
    enqueueWrite(n, opts);
  }

  const service = {
    async getPreferences(userId: string): Promise<NotificationPreferences> {
      return mergePrefs(await repo.getPrefs(userId));
    },

    /**
     * Trả ngay thông báo (chữ ký cũ). Nếu user tắt loại này thì KHÔNG lưu/không phát (đối tượng trả về chỉ để giữ chữ ký).
     * Phát SSE ngay khi biết preference (đồng bộ nếu cache còn hạn), ghi DB chạy nền.
     */
    notify(input: Omit<Notification, 'id' | 'readAt' | 'createdAt'>, opts: NotifyOptions = {}): Notification {
      const n: Notification = { ...input, ...(input.communityId ? { courseId: input.communityId } : {}), id: randomUUID(), readAt: null, createdAt: nextTimestamp().toISOString() };
      recent.push(n);
      if (recent.length > RECENT_MAX) recent.shift();
      const hit = prefsCache.get(n.userId);
      if (hit && hit.exp > Date.now()) accept(n, hit.prefs, opts);
      else {
        track(
          withRetry(() => loadPreferences(n.userId))
            .then((prefs) => accept(n, prefs, opts))
            .catch((e) => fail(n, e, opts)),
        );
      }
      return n;
    },

    flush,

    /** Thông báo ghi DB thất bại hẳn (chẩn đoán/test; tối đa 100 gần nhất). */
    deadLetters: (): Notification[] => [...dead],

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
      // Các instance khác xóa cache của user này ngay (không phải chờ hết TTL).
      void ensureSubscribed();
      await st().pubsub.publish(PREFS_CHANNEL, JSON.stringify({ userId, origin: instanceId })).catch(() => undefined);
      return next;
    },

    /** Vé SSE dùng 1 lần, sống 30s: tránh đưa access token (sống lâu hơn) lên URL. Lưu state chia sẻ nên mint ở A redeem được ở B. */
    async issueStreamTicket(userId: string) {
      const ticket = randomBytes(24).toString('base64url');
      await st().kv.set(TICKET_PREFIX + ticket, userId, TICKET_TTL_MS);
      return { ticket, expiresInSec: TICKET_TTL_MS / 1000 };
    },

    /** Atomic (GETDEL): đua nhiều request/instance chỉ một bên thành công. */
    async consumeStreamTicket(ticket: string): Promise<string | undefined> {
      return (await st().kv.getDel(TICKET_PREFIX + ticket)) ?? undefined;
    },

    /** Chờ đăng ký pub/sub xong (route SSE await trước khi báo kết nối sẵn sàng để không mất event ở khe hở subscribe). */
    ready: (): Promise<unknown> => ensureSubscribed(),

    onNew(fn: (n: Notification) => void) {
      listeners.add(fn);
      void ensureSubscribed();
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

export function notify(input: Omit<Notification, 'id' | 'readAt' | 'createdAt'>, opts?: NotifyOptions): Notification {
  return notificationsService.notify(input, opts);
}

/** Chờ mọi thông báo đang ghi nền xong (dùng trong test và khi shutdown). */
export function flushNotifications(): Promise<void> {
  return notificationsService.flush();
}
