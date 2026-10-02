import type { ReactNode } from 'react';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { FieldError } from '../../components/ui/FieldMessage';

/** Ô nhập của wizard: viền đỏ khi có lỗi (đúng pattern FormField của app). */
export const inputCls = (error?: string) =>
  `w-full rounded-xl border-[1.5px] bg-white px-3.5 text-[15px] font-medium outline-0 focus:border-brand ${error ? 'border-red-400' : 'border-[#e7e0da]'}`;

export function IconBadge({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-full bg-[#fff1e6]" style={{ width: size, height: size }}>
      <MaterialIcon name={name} size={size / 2} color="#f26a1b" filled />
    </span>
  );
}

/** Một khối trường: icon tròn + nhãn + ô nhập + lỗi/gợi ý bên dưới. */
export function WField({
  icon,
  label,
  optional,
  error,
  hint,
  right,
  children,
  htmlFor,
}: {
  icon?: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex gap-4">
      {icon && <IconBadge name={icon} />}
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="mb-2.5 block text-[15.5px] font-bold">
          {label} {optional && <span className="font-medium text-stone-500">(không bắt buộc)</span>}
        </label>
        {children}
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          (hint || right) && (
            <div className="mt-2 flex justify-between gap-3 text-[12.5px] text-stone-500">
              <span>{hint}</span>
              <span>{right}</span>
            </div>
          )
        )}
        {error && right && <div className="mt-1 text-right text-[12.5px] text-stone-500">{right}</div>}
      </div>
    </div>
  );
}

export function SectionCard({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[#f0ebe6] bg-white p-5 shadow-[0_4px_16px_rgba(120,60,20,.04)]">
      <div className="mb-4 flex items-center gap-3">
        <IconBadge name={icon} size={38} />
        <span className="flex-1 text-[17px] font-extrabold">{title}</span>
        {right}
      </div>
      {children}
    </section>
  );
}

export function CheckRow({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string }) {
  return (
    <div>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="flex items-center gap-3 border-0 bg-transparent p-0 py-2 text-left text-[14.5px] text-stone-800"
      >
        <MaterialIcon name={checked ? 'check_box' : 'check_box_outline_blank'} size={24} filled={checked} color={checked ? '#f26a1b' : error ? '#f87171' : '#a8a29e'} />
        {children}
      </button>
      {error && <FieldError indent>{error}</FieldError>}
    </div>
  );
}

export function SegTabs<T extends string>({
  value,
  options,
  onChange,
  cols,
}: {
  value: T;
  options: { id: T; label: string; badge?: string }[];
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div role="tablist" className="relative grid gap-0 rounded-[14px] bg-[#f5f2ef] p-1" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`relative flex h-[42px] items-center justify-center rounded-[11px] border-[1.5px] px-3 text-[14.5px] font-semibold ${
            value === o.id ? 'border-[#fdba74] bg-white text-brand shadow-[0_2px_8px_rgba(242,106,27,.12)]' : 'border-transparent bg-transparent text-stone-600'
          }`}
        >
          {o.label}
          {o.badge && (
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white">{o.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
