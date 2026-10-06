import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import i18n from '../../../i18n';
import { Button } from '../../../components/ui/Button';

export const errorText = (err: unknown, fallback = i18n.t('common.errorFallback', { ns: 'communities' })) =>
  err instanceof Error && err.message ? err.message : fallback;

/** Hộp thoại dùng chung của khu cộng đồng (cùng kiểu với hộp thoại "Khóa học có phí"). */
export function Modal({
  title,
  icon = 'info',
  onClose,
  children,
  footer,
}: {
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid size-12 place-items-center rounded-2xl bg-brand/10">
          <MaterialIcon name={icon} size={24} color="#f26a1b" />
        </div>
        <h2 className="mt-3.5 text-lg font-extrabold">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-stone-600">{children}</div>
        {footer && <div className="mt-5 flex gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function CancelButton({ onClick, children }: { onClick: () => void; children?: ReactNode }) {
  const { t } = useTranslation('communities');
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 flex-1 rounded-xl border border-[rgba(120,60,20,.15)] text-sm font-semibold text-stone-700 hover:bg-stone-50"
    >
      {children ?? t('common.cancel')}
    </button>
  );
}

export function PrimaryButton({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return danger ? (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 flex-1 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  ) : (
    <Button onClick={onClick} disabled={disabled} className="h-11 flex-1 rounded-xl text-sm font-bold">
      {children}
    </Button>
  );
}

export const INPUT_CLASS =
  'w-full rounded-xl border border-[rgba(120,60,20,.15)] bg-white/90 px-3.5 py-2.5 text-sm outline-0 focus:border-brand';

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 text-sm font-medium text-red-600">
      {children}
    </p>
  );
}
