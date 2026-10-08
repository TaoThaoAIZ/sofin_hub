import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import i18n, { currentLocale } from '../../../i18n';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { resolveApiPath } from '../../../lib/api';

// Tiện ích dùng chung cho các thành phần nội dung (bài viết, lịch, lớp học, kiểm duyệt).

export const errText = (err: unknown, fallback = i18n.t('ui.genericError', { ns: 'community' })) =>
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

export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(currentLocale());

/** ISO -> giá trị cho <input type="datetime-local"> theo giờ máy. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const inputCls = 'h-10 w-full rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3.5 text-sm outline-0 focus:border-brand';
export const areaCls = 'w-full rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3.5 py-2.5 text-sm outline-0 focus:border-brand';
export const primaryBtn = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ff8f45] to-brand px-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_18px_rgba(242,106,27,.28)] disabled:opacity-50';
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
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation('community');
  // Portal ra body: các thẻ `glass` (backdrop-filter) biến thành containing block của `fixed` nên dialog bị cắt trong thẻ cha.
  return createPortal(
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`m-auto flex max-h-[calc(100vh-24px)] w-full flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-h-[calc(100vh-32px)] ${wide ? 'max-w-[720px]' : 'max-w-[560px]'}`}
      >
        <div className="flex flex-none items-start justify-between gap-3 border-b border-[rgba(120,60,20,.08)] px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h2 className="m-0 text-[22px] leading-tight font-extrabold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 mb-0 truncate text-[13px] text-stone-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.close')}
            className="grid size-10 flex-none place-items-center rounded-full border border-[rgba(120,60,20,.1)] bg-white text-stone-700 shadow-sm hover:text-brand"
          >
            <MaterialIcon name="close" size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm text-stone-700">{children}</div>
        {footer && <div className="flex flex-none flex-wrap items-center justify-end gap-2.5 border-t border-[rgba(120,60,20,.08)] px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Nhãn đậm phía trên một ô nhập trong dialog. */
export function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <div className="mb-1.5 text-[13px] font-bold text-stone-900">
      {children}
      {required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
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
  const { t } = useTranslation('community');
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            {t('ui.cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={danger ? dangerBtn : primaryBtn}>
            {pending ? t('ui.processing') : confirmLabel}
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
