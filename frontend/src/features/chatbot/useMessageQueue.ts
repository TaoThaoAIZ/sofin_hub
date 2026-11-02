import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onReplace: (text: string) => void;
  /** Đang xếp hàng chờ lượt trả lời (nhiều người hỏi cùng lúc): ahead = số người đứng trước. */
  onQueued?: (ahead: number) => void;
  /** true khi lượt này đã bị hủy (khách bấm "Cuộc mới" lúc bot đang trả lời) => bỏ kết quả, không chèn vào cuộc mới. */
  cancelled?: () => boolean;
}

/** Gửi 1 lượt (các tin gộp `parts`, nối bằng xuống dòng = `text`) lên server; ném lỗi nếu thất bại. */
export type Deliver = (text: string, parts: string[], h: StreamHandlers) => Promise<void>;

/** Lượt đang chờ bot trả lời. `parts` = từng tin khách đã gửi (mỗi tin 1 bong bóng, giữ nguyên xuống dòng trong tin). */
export interface PendingTurn {
  user: string;
  parts: string[];
  reply: string;
  ahead?: number;
}

/** Lỗi do stream bị ngắt giữa chừng (không nhận được sự kiện `done`). Widget hiện câu báo thân thiện thay cho thông điệp kỹ thuật. */
export class StreamInterruptedError extends Error {
  constructor() {
    super('stream_interrupted');
    this.name = 'StreamInterruptedError';
  }
}

/** Lỗi server gửi qua sự kiện `error` của stream — `message` là câu báo cho người dùng. */
export class StreamServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamServerError';
  }
}

/** Câu báo lỗi cho người dùng: lỗi API / lỗi server gửi qua stream giữ nguyên câu của server; stream đứt => `interrupted`; còn lại (mất mạng...) => `fallback`. */
export function chatErrorText(e: unknown, fallback: string, interrupted: string): string {
  if (e instanceof StreamInterruptedError) return interrupted;
  if ((e instanceof ApiError || e instanceof StreamServerError) && e.message) return e.message;
  return fallback;
}

/**
 * Hàng chờ tin nhắn dùng chung cho các widget chatbot (bot Tào + bot cộng đồng). Khách nhắn liên tục (kiểu Zalo: 3-4 tin ngắn) trong lúc
 * bot đang trả lời: tin mới vào hàng chờ (hiện ngay, nhãn "chờ gửi"), trả lời xong thì GỘP cả hàng chờ thành 1 lượt (mỗi tin 1 dòng,
 * tối đa `maxChars`/lượt) — không gọi AI song song trên cùng hội thoại (backend cũng khóa theo hội thoại). Lỗi => `onError` nhận các tin
 * chưa gửi để trả về ô nhập. `clear()` hủy cả lượt đang chạy: kết quả của nó bị bỏ, tin mới gửi ngay không phải chờ.
 */
export function useMessageQueue(maxChars: number, deliver: Deliver, onError: (err: unknown, unsent: string[]) => void) {
  const busyRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  // Tăng mỗi lần clear(): vòng drain / lượt đang chạy thuộc "thế hệ" cũ thì dừng, không cập nhật gì nữa.
  const epochRef = useRef(0);
  const [queued, setQueued] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingTurn | null>(null);
  // Vòng drain chạy qua nhiều lần render: luôn gọi bản deliver/onError mới nhất.
  const deliverRef = useRef(deliver);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    deliverRef.current = deliver;
    onErrorRef.current = onError;
  });

  /** Lấy từ đầu hàng chờ các tin gộp được trong maxChars (ít nhất 1 tin). */
  function takeBatch(): string[] {
    const q = queueRef.current;
    const batch: string[] = [];
    let len = 0;
    while (q.length && (batch.length === 0 || len + 1 + q[0]!.length <= maxChars)) {
      len += (batch.length ? 1 : 0) + q[0]!.length;
      batch.push(q.shift()!);
    }
    setQueued([...q]);
    return batch;
  }

  async function drain() {
    const epoch = epochRef.current;
    const live = () => epochRef.current === epoch;
    busyRef.current = true;
    try {
      while (live() && queueRef.current.length) {
        const parts = takeBatch();
        const text = parts.join('\n');
        setPending({ user: text, parts, reply: '' });
        try {
          await deliverRef.current(text, parts, {
            onDelta: (d) => live() && setPending((p) => (p ? { ...p, reply: p.reply + d } : p)),
            onReplace: (r) => live() && setPending((p) => (p ? { ...p, reply: r } : p)),
            onQueued: (ahead) => live() && setPending((p) => (p ? { ...p, ahead } : p)),
            cancelled: () => !live(),
          });
        } catch (err) {
          if (!live()) return;
          const unsent = [...parts, ...queueRef.current];
          queueRef.current = [];
          setQueued([]);
          onErrorRef.current(err, unsent);
        } finally {
          if (live()) setPending(null);
        }
      }
    } finally {
      if (live()) busyRef.current = false;
    }
  }

  return {
    queued,
    pending,
    enqueue(text: string) {
      queueRef.current.push(text.slice(0, maxChars));
      setQueued([...queueRef.current]);
      if (!busyRef.current) void drain();
    },
    /** Hủy hàng chờ và lượt đang chạy (bấm "Cuộc mới"). */
    clear() {
      epochRef.current += 1;
      busyRef.current = false;
      queueRef.current = [];
      setQueued([]);
      setPending(null);
    },
  };
}
