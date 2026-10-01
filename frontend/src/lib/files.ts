import { useEffect, useState } from 'react';
import { apiPost, resolveApiPath } from './api';

/**
 * File riêng tư (tin nhắn, tài liệu bài học, file bài viết) KHÔNG xem được bằng URL trần: BE yêu cầu đăng nhập + quyền.
 * <img>/<a href> không gửi được header Authorization nên xin URL ký hạn ngắn (POST /files/:key/url) rồi dùng URL đó.
 * Ảnh công khai (avatar/cover/ảnh bài viết) BE trả lại URL thường.
 */
const FILE_KEY_RE = /\/api\/files\/([a-f0-9]{32}\.[a-z0-9]{2,5})(?:[?#]|$)/i;

/** Khóa file nếu `url` trỏ vào /api/files/<key> (tương đối hoặc tuyệt đối), ngược lại null (link ngoài). */
export const fileKeyOf = (url: string | undefined): string | null => (url ? (FILE_KEY_RE.exec(url)?.[1] ?? null) : null);

interface Signed {
  url: string;
  /** ms epoch; Infinity với ảnh công khai. */
  until: number;
}
const cache = new Map<string, Promise<Signed>>();
const SAFETY_MS = 20_000;

function signed(key: string): Promise<Signed> {
  const hit = cache.get(key);
  if (hit) {
    return hit.then((s) => (s.until - SAFETY_MS > Date.now() ? s : fetchSigned(key)));
  }
  return fetchSigned(key);
}

function fetchSigned(key: string): Promise<Signed> {
  const p = apiPost<{ data: { url: string; expiresAt: string | null } }>(`/files/${key}/url`).then((res) => ({
    url: resolveApiPath(res.data.url),
    until: res.data.expiresAt ? Date.parse(res.data.expiresAt) : Infinity,
  }));
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/** URL dùng được trên trình duyệt cho 1 file do BE phục vụ; link ngoài trả nguyên. Ném lỗi nếu không có quyền. */
export async function resolveFileUrl(url: string): Promise<string> {
  const key = fileKeyOf(url);
  return key ? (await signed(key)).url : url;
}

/** Mở file (tab mới) qua URL ký. Dùng cho nút "xem trước"/"tải xuống". */
export async function openFile(url: string): Promise<void> {
  window.open(await resolveFileUrl(url), '_blank', 'noopener');
}

/** Hook: URL dùng được cho <img src>/<a href>. `undefined` khi đang xin URL ký; `null` nếu không có quyền/lỗi. */
export function useFileUrl(url: string | undefined): string | null | undefined {
  const key = fileKeyOf(url);
  const [state, setState] = useState<{ for: string; value: string | null } | null>(null);
  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
    resolveFileUrl(url).then(
      (value) => alive && setState({ for: url, value }),
      () => alive && setState({ for: url, value: null }),
    );
    return () => {
      alive = false;
    };
  }, [url, key]);
  if (!url) return undefined;
  if (!key) return resolveApiPath(url); // link ngoài / không phải file của hệ thống
  return state && state.for === url ? state.value : undefined;
}
