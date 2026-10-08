import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';

export interface ShellStep {
  label: string;
  /** done | active | todo */
  state: 'done' | 'active' | 'todo';
  /** Có thì bước đã hoàn thành bấm được để quay lại. */
  onSelect?: () => void;
}

/** Khung popup nhiều bước theo thiết kế: tiêu đề + phụ đề + bước + nút đóng; phần thân/chân do từng bước tự dựng. */
export function ModalShell({
  title,
  subtitle,
  steps,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  subtitle?: string;
  steps?: ShellStep[];
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useTranslation('community');
  return createPortal(
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-[rgba(28,25,23,.45)] p-3 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: width }}
        className="m-auto flex max-h-[calc(100vh-24px)] w-full flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_30px_80px_rgba(28,25,23,.3)] sm:max-h-[calc(100vh-32px)]"
      >
        <div className="flex flex-none items-start gap-3 border-b border-[#f1ebe6] px-[22px] pt-5 pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-xl leading-tight font-extrabold">{title}</div>
            {subtitle && <div className="mt-[3px] truncate text-[12.5px] text-stone-500">{subtitle}</div>}
            {steps && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {steps.map((s, i) => (
                  <span key={s.label} className="contents">
                    {i > 0 && <span className="h-[1.5px] w-[18px] bg-[#e7e0da]" />}
                    <button
                      type="button"
                      disabled={!(s.state === 'done' && s.onSelect)}
                      onClick={s.onSelect}
                      title={s.state === 'done' && s.onSelect ? s.label : undefined}
                      className={`flex items-center gap-1.5 text-[12.5px] font-semibold disabled:cursor-default ${s.state === 'todo' ? 'text-stone-400' : 'text-stone-900'} ${s.state === 'done' && s.onSelect ? 'cursor-pointer hover:text-brand' : ''}`}
                    >
                      <span
                        className={`grid size-[22px] place-items-center rounded-full text-[11.5px] font-extrabold ${s.state === 'todo' ? 'bg-[#f1efed] text-stone-500' : 'bg-brand text-white'}`}
                      >
                        {s.state === 'done' ? '✓' : i + 1}
                      </span>
                      {s.label}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.close')}
            className="grid size-[38px] flex-none place-items-center rounded-full border border-[#ece5df] bg-white hover:text-brand"
          >
            <MaterialIcon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Thân cuộn được của một bước. */
export function ShellBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[22px] py-[18px] text-sm text-stone-800 ${className}`}>{children}</div>;
}

/** Chân cố định của một bước. */
export function ShellFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-none flex-wrap items-center gap-2.5 border-t border-[#f1ebe6] px-[22px] py-3.5">{children}</div>;
}

export const shellGhostBtn =
  'h-[42px] rounded-[10px] border-[1.5px] border-[#e7e0da] bg-white px-4 text-[13.5px] font-bold text-stone-900 hover:bg-stone-50 disabled:opacity-50';
export const shellPrimaryBtn =
  'h-[42px] rounded-[10px] bg-gradient-to-b from-[#ff8f45] to-[#e85d10] px-[18px] text-[13.5px] font-bold text-white shadow-[0_8px_18px_rgba(242,106,27,.3)] disabled:cursor-not-allowed disabled:opacity-50';

/** Công tắc bật/tắt theo thiết kế (track 40×23). */
export function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-block h-[23px] w-10 flex-none rounded-full transition-colors ${on ? 'bg-brand' : 'bg-[#d6d3d1]'}`}>
      <span className={`absolute top-[3px] size-[17px] rounded-full bg-white transition-[left] ${on ? 'left-5' : 'left-[3px]'}`} />
    </span>
  );
}
