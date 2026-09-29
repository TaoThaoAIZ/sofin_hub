import { apiPost, apiUrl } from './api';

interface SseOptions {
  /** Endpoint xin vé một lần, vd. "/notifications/stream-ticket". */
  ticketPath: string;
  /** Endpoint SSE, vd. "/notifications/stream" (vé được nối thêm vào query). */
  streamPath: string;
  /** Tên event -> hàm xử lý (nhận dữ liệu đã JSON.parse; nếu không parse được thì nhận chuỗi thô). */
  handlers: Record<string, (data: unknown) => void>;
  /** Gọi mỗi lần kết nối (lại) thành công; `reconnected` = true nếu trước đó đã từng rớt kết nối. */
  onOpen?: (reconnected: boolean) => void;
}

/**
 * Mở luồng SSE có xác thực bằng vé một lần (EventSource không đặt được header Authorization).
 * Vé chỉ dùng được 1 lần nên khi rớt kết nối phải đóng hẳn và xin vé mới — tự thử lại với backoff
 * (1s, 2s, 4s ... tối đa 30s). Trả về hàm dọn dẹp (gọi khi logout/unmount).
 */
export function openSseStream(opts: SseOptions): () => void {
  let closed = false;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let everConnected = false;

  const schedule = () => {
    if (closed) return;
    const delay = Math.min(30_000, 1000 * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(() => void connect(), delay);
  };

  const connect = async () => {
    if (closed) return;
    let ticket: string;
    try {
      const res = await apiPost<{ data: { ticket: string } }>(opts.ticketPath);
      ticket = res.data.ticket;
    } catch {
      schedule();
      return;
    }
    if (closed) return;
    const es = new EventSource(`${apiUrl(opts.streamPath)}?ticket=${encodeURIComponent(ticket)}`);
    source = es;
    es.onopen = () => {
      const reconnected = everConnected;
      everConnected = true;
      attempt = 0;
      opts.onOpen?.(reconnected);
    };
    es.onerror = () => {
      es.close();
      if (source === es) source = null;
      schedule();
    };
    for (const [name, handler] of Object.entries(opts.handlers)) {
      es.addEventListener(name, (ev) => {
        const raw = (ev as MessageEvent<string>).data;
        let parsed: unknown = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          /* giữ chuỗi thô */
        }
        handler(parsed);
      });
    }
  };

  void connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    source?.close();
    source = null;
  };
}
