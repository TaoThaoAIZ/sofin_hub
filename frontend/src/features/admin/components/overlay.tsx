import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { MONO_FONT } from './ui';

/* ============================== Toast ============================== */

type ToastKind = 'success' | 'error';
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}
const ToastContext = createContext<ToastApi | null>(null);

/** Toast góc phải-dưới của bản thiết kế (nền đen, icon tròn). Bọc toàn bộ AdminLayout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ kind: ToastKind; message: string; id: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((kind: ToastKind, message: string) => {
    window.clearTimeout(timer.current);
    setToast({ kind, message, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 4500 : 2800);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const api = useMemo<ToastApi>(() => ({ success: (m) => show('success', m), error: (m) => show('error', m) }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className="fixed right-6 bottom-6 z-[90] flex max-w-[calc(100vw-48px)] items-center gap-2.5 rounded-[14px] bg-[#1c1917] px-[18px] py-[13px] text-sm font-medium text-white shadow-[0_16px_40px_rgba(28,25,23,.3)]"
        >
          <MaterialIcon name={toast.kind === 'error' ? 'error' : 'check_circle'} size={20} filled color={toast.kind === 'error' ? '#f87171' : '#4ade80'} />
          <span className="min-w-0 break-words">{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải nằm trong ToastProvider');
  return ctx;
}

/* ============================ Popover menu ============================ */

export interface MenuItem {
  label: string;
  icon?: string;
  sub?: string;
  danger?: boolean;
  /** Đánh dấu lựa chọn đang chọn (menu lọc). */
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface MenuState {
  rect: DOMRect;
  items: MenuItem[];
  title?: string;
  width: number;
}

function PopMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const { rect, items, title, width } = state;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
  const estH = items.length * 40 + (title ? 28 : 0) + 12;
  const top = rect.bottom + 6 + estH > window.innerHeight ? Math.max(8, rect.top - 6 - estH) : rect.bottom + 6;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label={title}
        className="fixed z-[71] max-h-[70vh] overflow-y-auto rounded-[14px] border border-[rgba(120,60,20,.1)] bg-white p-1.5 shadow-[0_20px_50px_rgba(60,30,10,.18)]"
        style={{ left, top, width }}
      >
        {title && <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-bold tracking-[.06em] text-stone-400">{title}</div>}
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={`flex w-full items-center gap-2.5 rounded-[9px] border-0 bg-transparent px-2.5 py-[9px] text-left text-[13.5px] font-semibold hover:bg-[#fff4ec] disabled:opacity-40 ${it.danger ? 'text-[#b91c1c]' : 'text-stone-800'}`}
          >
            {it.icon && <MaterialIcon name={it.icon} size={18} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{it.label}</span>
              {it.sub && <span className="mt-px block text-[11.5px] font-medium text-stone-400">{it.sub}</span>}
            </span>
            {it.on && <MaterialIcon name="check" size={17} color="#f26a1b" />}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

/** Hook mở menu nổi neo vào phần tử bấm. `menuEl` phải được render ở đâu đó trong component. */
export function useMenu() {
  const [state, setState] = useState<MenuState | null>(null);
  const close = useCallback(() => setState(null), []);
  const openMenu = useCallback((e: MouseEvent<HTMLElement>, items: MenuItem[], title?: string, width = 220) => {
    e.stopPropagation();
    setState({ rect: e.currentTarget.getBoundingClientRect(), items, title, width });
  }, []);
  const menuEl = state ? <PopMenu state={state} onClose={close} /> : null;
  return { openMenu, menuEl };
}

/* ============================== Modal ============================== */

/** Khung modal chung: icon + tiêu đề + nội dung + [Hủy | CTA]. Lỗi từ API hiển thị ngay trong modal. */
export function ModalShell({
  icon,
  danger,
  title,
  body,
  cta,
  pending,
  disabled,
  error,
  onConfirm,
  onClose,
  children,
}: {
  icon: string;
  danger?: boolean;
  title: string;
  body?: ReactNode;
  cta: string;
  pending?: boolean;
  disabled?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !pending && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const blocked = disabled || pending;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[rgba(28,25,23,.4)] p-5 backdrop-blur-[3px]"
      onClick={() => !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(500px,100%)] flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_30px_80px_rgba(28,25,23,.25)]"
      >
        <div className="flex items-start gap-3.5">
          <span className={`grid size-[46px] flex-none place-items-center rounded-[14px] ${danger ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#fff1e6] text-brand'}`}>
            <MaterialIcon name={icon} size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div id={titleId} className="text-[18.5px] font-extrabold tracking-[-.01em] break-words">
              {title}
            </div>
            {body && <div className="mt-1 text-[13.5px] leading-relaxed text-stone-600">{body}</div>}
          </div>
          <button type="button" onClick={onClose} disabled={pending} aria-label="Đóng" className="border-0 bg-transparent p-0 text-stone-400 hover:text-stone-700">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        {children}
        {error && (
          <div role="alert" className="rounded-xl bg-[#fef2f2] px-3.5 py-2.5 text-[13px] font-medium text-[#b91c1c]">
            {error}
          </div>
        )}
        <div className="mt-1 flex gap-2.5">
          <button type="button" onClick={onClose} disabled={pending} className="h-[46px] flex-1 rounded-[13px] border-[1.5px] border-[#e7e0da] bg-white text-sm font-semibold disabled:opacity-50">
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={blocked}
            className={`h-[46px] flex-1 rounded-[13px] border-0 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 ${danger ? 'bg-[#dc2626]' : 'bg-gradient-to-b from-[#ff8f45] to-[#f26a1b]'}`}
          >
            {pending ? 'Đang xử lý…' : cta}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---- Các field dùng trong modal ---- */

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-bold">{children}</div>;
}

/** Nhóm chip chọn 1 hoặc nhiều giá trị (lý do, thời hạn, hạn chế...). */
export function OptionChips<T extends string>({
  label,
  options,
  value,
  onChange,
  multi,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T | T[] | '';
  onChange: (v: T | T[]) => void;
  multi?: boolean;
}) {
  const cur = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="flex flex-col gap-2">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex flex-wrap gap-1.5" role={multi ? 'group' : 'radiogroup'} aria-label={label}>
        {options.map((o) => {
          const on = cur.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => onChange(multi ? (on ? cur.filter((x) => x !== o.value) : [...cur, o.value]) : o.value)}
              className={`flex h-[34px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold ${on ? 'border-[1.5px] border-brand bg-[#fff4ec] text-[#c2410c]' : 'border-[1.5px] border-[#e7e0da] bg-white text-stone-700'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CheckField({ text, checked, onChange }: { text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2 border-0 bg-transparent p-0 text-left text-[13.5px] text-stone-800">
      <MaterialIcon name={checked ? 'check_box' : 'check_box_outline_blank'} size={21} filled={checked} color={checked ? '#f26a1b' : '#a8a29e'} />
      {text}
    </button>
  );
}

export function TextAreaField({ label, value, onChange, placeholder, maxLength = 1000 }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        className="h-[76px] w-full resize-y rounded-xl border-[1.5px] border-[#e7e0da] px-[13px] py-2.5 text-[13.5px] font-medium outline-0 focus:border-brand"
      />
    </div>
  );
}

export function InputField({ label, value, onChange, placeholder, mono, maxLength }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; maxLength?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        className={`h-11 rounded-xl border-[1.5px] border-[#e7e0da] px-[13px] outline-0 focus:border-brand ${mono ? 'text-[15px] font-bold tracking-[.1em]' : 'text-sm font-medium'}`}
        style={mono ? { fontFamily: MONO_FONT } : undefined}
      />
    </div>
  );
}

export function InfoGrid({ items }: { items: readonly [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 rounded-xl bg-[#faf7f4] px-3 py-2.5">
          <div className="text-[11.5px] text-stone-500">{k}</div>
          <div className="mt-0.5 text-sm font-bold break-words">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function WarnBox({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3">
      {lines.map((l) => (
        <div key={l} className="flex gap-2 text-[13px] leading-normal text-[#991b1b]">
          <MaterialIcon name="error" size={16} className="mt-0.5" />
          {l}
        </div>
      ))}
    </div>
  );
}
