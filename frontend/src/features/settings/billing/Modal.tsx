import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';

/** Hộp thoại đúng bản thiết kế Cài đặt: nền mờ, rộng ≤460px, bo 22px, tiêu đề 19px + mô tả 13.5px + nút X. */
export function SettingsModal({
  title,
  body,
  onClose,
  children,
  footer,
  busy,
}: {
  title: string;
  body?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  /** Hàng nút cuối; mặc định không có. */
  footer?: ReactNode;
  busy?: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[rgba(28,25,23,.4)] p-5" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(460px,100%)] flex-col gap-3.5 rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(28,25,23,.25)]"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div id={titleId} className="text-[19px] font-extrabold break-words">
              {title}
            </div>
            {body && <div className="mt-1 text-[13.5px] leading-[1.55] text-stone-600">{body}</div>}
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose} disabled={busy} className="border-0 bg-transparent p-0 text-[#a8a29e] hover:text-stone-700">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  );
}

/** Hàng 2 nút: [Hủy] [CTA]. `danger` = CTA đỏ (hủy gói, xóa thẻ). */
export function ModalActions({
  cancelLabel = 'Hủy',
  okLabel,
  onCancel,
  onOk,
  pending,
  danger,
  disabled,
}: {
  cancelLabel?: string;
  okLabel: string;
  onCancel: () => void;
  onOk: () => void;
  pending?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-1 flex gap-2.5">
      <button type="button" onClick={onCancel} disabled={pending} className="h-[46px] flex-1 rounded-xl border-[1.5px] border-[#e7e0da] bg-white text-sm font-bold disabled:opacity-50">
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onOk}
        disabled={pending || disabled}
        className={`h-[46px] flex-1 rounded-xl border-0 text-sm font-bold text-white disabled:opacity-60 ${danger ? 'bg-[#dc2626]' : 'bg-gradient-to-b from-[#ff8f45] to-[#f26a1b]'}`}
      >
        {pending ? 'Đang xử lý…' : okLabel}
      </button>
    </div>
  );
}

export function ModalError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="text-[13px] font-semibold text-[#dc2626]">
      {children}
    </div>
  );
}

/** Ô nhập trong hộp thoại: nhãn đậm 13.5px, ô cao 46px viền 1.5px. */
export function ModalField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13.5px] font-bold">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="h-[46px] rounded-xl border-[1.5px] border-[#e7e0da] px-3.5 text-[14.5px] font-medium outline-0 focus:border-[#fdba74]"
      />
    </label>
  );
}
