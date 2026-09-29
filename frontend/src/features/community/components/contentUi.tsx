import { useEffect, useState, type ReactNode } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { resolveApiPath } from '../../../lib/api';

// Tiện ích dùng chung cho các thành phần nội dung (bài viết, lịch, lớp học, kiểm duyệt).

export const errText = (err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại') =>
  err instanceof Error && err.message ? err.message : fallback;

export type ViewerRole = 'member' | 'mod' | 'admin' | 'owner' | 'platform_admin' | null | undefined;
export const isModPlus = (role: ViewerRole) => role === 'mod' || role === 'admin' || role === 'owner' || role === 'platform_admin';
export const isAdminPlus = (role: ViewerRole) => role === 'admin' || role === 'owner' || role === 'platform_admin';

/** Đường dẫn tương đối do BE trả (vd. /api/files/x.png) -> URL tuyệt đối http(s) (BE yêu cầu URL đầy đủ khi lưu). */
export function absoluteUrl(url: string): string {
  const resolved = resolveApiPath(url);
  return /^https?:\/\//i.test(resolved) ? resolved : `${window.location.origin}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
}

/** Chỉ cho phép http(s) hoặc đường dẫn tương đối khi gắn vào href/src (chống javascript:/data:). */
export function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return resolveApiPath(url);
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('vi-VN');

/** ISO -> giá trị cho <input type="datetime-local"> theo giờ máy. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const inputCls = 'h-10 w-full rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3.5 text-sm outline-0 focus:border-brand';
export const areaCls = 'w-full rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3.5 py-2.5 text-sm outline-0 focus:border-brand';
export const primaryBtn = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-50';
export const ghostBtn =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50';
export const dangerBtn = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50';

// ---- Toast tối giản (singleton, không cần Provider) ----
type ToastKind = 'ok' | 'error';
interface ToastItem {
  id: number;
  msg: string;
  kind: ToastKind;
}
let toastSeq = 0;
const toastListeners = new Set<(t: ToastItem) => void>();

export function toast(msg: string, kind: ToastKind = 'ok') {
  const item = { id: ++toastSeq, msg, kind };
  toastListeners.forEach((l) => l(item));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const l = (t: ToastItem) => {
      setItems((cur) => [...cur.slice(-2), t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 4000);
    };
    toastListeners.add(l);
    return () => {
      toastListeners.delete(l);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
            t.kind === 'ok' ? 'bg-stone-900' : 'bg-red-600'
          }`}
        >
          <MaterialIcon name={t.kind === 'ok' ? 'check_circle' : 'error'} size={18} color="#fff" />
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="m-0 text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-stone-400 hover:text-stone-700">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <div className="mt-3 text-sm text-stone-700">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  pending,
  error,
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Hủy
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={danger ? dangerBtn : primaryBtn}>
            {pending ? 'Đang xử lý…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="m-0 leading-relaxed">{message}</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
    </Dialog>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{message}</p>;
}
