import { useEffect, useRef, useState } from 'react';

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onReplace: (text: string) => void;
  /** Đang xếp hàng chờ lượt trả lời (nhiều người hỏi cùng lúc): ahead = số người đứng trước. */
  onQueued?: (ahead: number) => void;
}

/** Gửi 1 lượt (các tin gộp `parts`, nối bằng xuống dòng = `text`) lên server; ném lỗi nếu thất bại. */
export type Deliver = (text: string, parts: string[], h: StreamHandlers) => Promise<void>;

/**
 * Hàng chờ tin nhắn dùng chung cho các widget chatbot (bot Tào + bot cộng đồng). Khách nhắn liên tục (kiểu Zalo: 3-4 tin ngắn) trong lúc
 * bot đang trả lời: tin mới vào hàng chờ (hiện ngay, nhãn "chờ gửi"), trả lời xong thì GỘP cả hàng chờ thành 1 lượt (mỗi tin 1 dòng,
 * tối đa `maxChars`/lượt) — không gọi AI song song trên cùng hội thoại (backend cũng khóa theo hội thoại). Lỗi => `onError` nhận các tin
 * chưa gửi để trả về ô nhập.
 */
export function useMessageQueue(maxChars: number, deliver: Deliver, onError: (err: unknown, unsent: string[]) => void) {
  const busyRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const [queued, setQueued] = useState<string[]>([]);
  const [pending, setPending] = useState<{ user: string; reply: string; ahead?: number } | null>(null);
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
    busyRef.current = true;
    try {
      while (queueRef.current.length) {
        const parts = takeBatch();
        const text = parts.join('\n');
        setPending({ user: text, reply: '' });
        try {
          await deliverRef.current(text, parts, {
            onDelta: (d) => setPending((p) => (p ? { ...p, reply: p.reply + d } : p)),
            onReplace: (r) => setPending((p) => (p ? { ...p, reply: r } : p)),
            onQueued: (ahead) => setPending((p) => (p ? { ...p, ahead } : p)),
          });
        } catch (err) {
          const unsent = [...parts, ...queueRef.current];
          queueRef.current = [];
          setQueued([]);
          onErrorRef.current(err, unsent);
        } finally {
          setPending(null);
        }
      }
    } finally {
      busyRef.current = false;
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
    clear() {
      queueRef.current = [];
      setQueued([]);
    },
  };
}
