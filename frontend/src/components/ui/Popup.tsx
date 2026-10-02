import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { Button } from './Button';

export type PopupTone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<PopupTone, { icon: string; box: string; color: string }> = {
  info: { icon: 'info', box: 'bg-brand/10', color: '#f26a1b' },
  success: { icon: 'check_circle', box: 'bg-green-100', color: '#16a34a' },
  warning: { icon: 'warning', box: 'bg-amber-100', color: '#d97706' },
  danger: { icon: 'delete', box: 'bg-red-100', color: '#dc2626' },
};

const SIZE = { sm: 'max-w-[380px]', md: 'max-w-[440px]', lg: 'max-w-[560px]', xl: 'max-w-[720px]' } as const;

/** Nút bấm dùng trong chân popup (chia đều chiều ngang). */
export function PopupButton({
  variant = 'primary',
  className = '',
  ...props
}: { variant?: 'primary' | 'danger' | 'secondary' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'h-11 flex-1 rounded-xl text-sm font-bold';
  if (variant === 'danger')
    return (
      <button
        type="button"
        className={`${base} bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        {...props}
      />
    );
  if (variant === 'secondary')
    return (
      <button
        type="button"
        className={`${base} border border-[rgba(120,60,20,.15)] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 ${className}`}
        {...props}
      />
    );
  return <Button className={`${base} ${className}`} {...props} />;
}

export interface PopupProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Tên icon Material Symbols; mặc định theo `tone`. `false` = không hiện icon. */
  icon?: string | false;
  tone?: PopupTone;
  size?: keyof typeof SIZE;
  children?: ReactNode;
  /** Vùng nút bấm; không truyền = không có chân. */
  footer?: ReactNode;
  /** Bấm nền tối / nhấn Esc để đóng (mặc định true). Tắt khi đang xử lý hoặc form chưa lưu. */
  dismissible?: boolean;
  /** Hiện nút X góc phải. */
  showClose?: boolean;
}

/**
 * Popup nền tảng — dùng trực tiếp để làm popup tùy biến (form, nội dung dài…):
 * `<Popup open onClose title="…" footer={…}>…</Popup>`. Có khóa cuộn trang, Esc, role=dialog.
 * Popup thông báo/xác nhận dựng sẵn: `MessagePopup`, `ConfirmPopup` hoặc hook `usePopup()`.
 */
export function Popup({
  open,
  onClose,
  title,
  icon,
  tone = 'info',
  size = 'md',
  children,
  footer,
  dismissible = true,
  showClose = false,
}: PopupProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;
  const t = TONE[tone];
  const iconName = icon === undefined ? t.icon : icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`relative max-h-[90vh] w-full ${SIZE[size]} overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
          >
            <MaterialIcon name="close" size={20} />
          </button>
        )}
        {iconName && (
          <div className={`grid size-12 place-items-center rounded-2xl ${t.box}`}>
            <MaterialIcon name={iconName} size={24} color={t.color} />
          </div>
        )}
        {title && (
          <h2 id={titleId} className={`${iconName ? 'mt-3.5' : ''} text-lg font-extrabold`}>
            {title}
          </h2>
        )}
        {children && <div className="mt-2 text-sm leading-relaxed text-stone-600">{children}</div>}
        {footer && <div className="mt-5 flex gap-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Popup thông báo: một nút đóng. */
export function MessagePopup({
  open,
  onClose,
  title,
  message,
  tone = 'info',
  okText = 'Đã hiểu',
  icon,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  message: ReactNode;
  tone?: PopupTone;
  okText?: string;
  icon?: string | false;
}) {
  return (
    <Popup open={open} onClose={onClose} title={title} tone={tone} icon={icon} footer={<PopupButton onClick={onClose}>{okText}</PopupButton>}>
      {message}
    </Popup>
  );
}

/** Popup xác nhận: Hủy / Đồng ý. `tone="danger"` đổi nút xác nhận sang đỏ. */
export function ConfirmPopup({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  tone = 'warning',
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  icon,
  loading = false,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: ReactNode;
  message?: ReactNode;
  tone?: PopupTone;
  confirmText?: string;
  cancelText?: string;
  icon?: string | false;
  loading?: boolean;
}) {
  return (
    <Popup
      open={open}
      onClose={onCancel}
      title={title}
      tone={tone}
      icon={icon}
      dismissible={!loading}
      footer={
        <>
          <PopupButton variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </PopupButton>
          <PopupButton variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xử lý…' : confirmText}
          </PopupButton>
        </>
      }
    >
      {message}
    </Popup>
  );
}
