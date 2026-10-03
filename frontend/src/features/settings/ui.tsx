import type { ReactNode } from 'react';
import { MaterialIcon } from '../../components/ui/MaterialIcon';

/** Thẻ trắng bo 20px dùng cho mọi khối ở trang Cài đặt (đúng thiết kế "Cai dat ho so"). */
export function SCard({ children, className = '', tone = 'white' }: { children: ReactNode; className?: string; tone?: 'white' | 'danger' }) {
  const toneCls = tone === 'danger' ? 'border-[#fecaca] bg-[#fff5f5]' : 'border-[rgba(120,60,20,.07)] bg-white';
  return <section className={`min-w-0 rounded-[20px] border px-6 py-[22px] ${toneCls} ${className}`}>{children}</section>;
}

/** Icon tròn cam nhạt + tiêu đề + mô tả ở đầu mỗi thẻ. `action` nằm bên phải. */
export function SHead({
  icon,
  title,
  sub,
  action,
  size = 'md',
  danger,
  className = '',
}: {
  icon?: string;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
  size?: 'md' | 'lg';
  danger?: boolean;
  className?: string;
}) {
  const box = size === 'lg' ? 'size-[46px]' : 'size-11';
  return (
    <div className={`flex flex-wrap items-start gap-3.5 ${className}`}>
      {icon && (
        <span className={`grid ${box} flex-none place-items-center rounded-full ${danger ? 'bg-[#fee2e2]' : 'bg-[#fff1e6]'}`}>
          <MaterialIcon name={icon} size={size === 'lg' ? 23 : 22} filled color={danger ? '#dc2626' : '#f26a1b'} />
        </span>
      )}
      <div className="min-w-[200px] flex-1">
        <div className={`${size === 'lg' ? 'text-xl' : 'text-[19px]'} font-extrabold`}>{title}</div>
        {sub && <div className="mt-[3px] text-[13.5px] text-stone-500">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

/** Công tắc bật/tắt (cam khi bật). */
export function Toggle({ on, onChange, label, small, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; small?: boolean; disabled?: boolean }) {
  const [w, h, k, off] = small ? [50, 28, 22, 25] : [52, 30, 24, 25];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{ width: w, height: h }}
      className={`relative inline-block flex-none rounded-full border-0 p-0 transition-colors duration-200 disabled:opacity-50 ${on ? 'bg-gradient-to-b from-[#ff8f45] to-[#f26a1b]' : 'bg-[#e2dcd6]'}`}
    >
      <span
        style={{ top: 3, left: on ? off : 3, width: k, height: k }}
        className="absolute rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left] duration-200"
      />
    </button>
  );
}

/** Nhóm nút chọn 1 (nền xám, mục đang chọn trắng viền cam). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  cols,
  className = '',
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`${cols ? 'grid' : 'flex'} rounded-[14px] bg-[#f5f2ef] p-1 ${className}`}
      style={cols ? { gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` } : undefined}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`flex h-10 items-center justify-center gap-2 rounded-[11px] border-[1.5px] px-4 text-sm font-semibold whitespace-nowrap ${
              on ? 'border-[#fdba74] bg-white text-brand' : 'border-transparent bg-transparent text-stone-600'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const OUTLINE_BTN =
  'inline-flex h-[46px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-[18px] text-sm font-bold text-stone-900 hover:border-[#fdba74] disabled:opacity-50';
export const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl border-0 bg-gradient-to-b from-[#ff8f45] to-[#f26a1b] font-bold text-white shadow-[0_10px_24px_rgba(242,106,27,.32)] disabled:opacity-60 disabled:shadow-none';

/** Ô nhập có icon bên trái (khung bo 12px, viền be). */
export function IconInput({
  icon,
  iconColor = '#78716c',
  children,
  className = '',
  height = 50,
}: {
  icon?: string;
  iconColor?: string;
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className={`flex items-center gap-2.5 rounded-xl border-[1.5px] border-[#e7e0da] px-3.5 focus-within:border-[#fdba74] ${className}`}>
      {icon && <MaterialIcon name={icon} size={20} color={iconColor} />}
      {children}
    </div>
  );
}
export const BARE_INPUT = 'min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium outline-0 placeholder:text-stone-400';

export function Badge({ tone, children }: { tone: 'green' | 'amber' | 'gray' | 'red' | 'dark'; children: ReactNode }) {
  const cls = {
    green: 'bg-[#dcfce7] text-[#15803d]',
    amber: 'bg-[#fef3c7] text-[#b45309]',
    gray: 'bg-[#f1efed] text-stone-600',
    red: 'bg-[#fee2e2] text-[#b91c1c]',
    dark: 'bg-[#1e293b] text-white',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

/** Tên cộng đồng → ô chữ viết tắt có màu (khi chưa có ảnh bìa). */
const LOGO_COLORS: readonly [string, string][] = [
  ['#2f4fa8', '#fff'],
  ['#9a3412', '#fff'],
  ['#dcfce7', '#166534'],
  ['#7e22ce', '#fff'],
  ['#0f766e', '#fff'],
  ['#fcd34d', '#1c1917'],
];
export function CommunityLogo({ name, seed, size = 54, src }: { name: string; seed: string; size?: number; src?: string | null }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = LOGO_COLORS[h % LOGO_COLORS.length]!;
  const ini = name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (src) return <img src={src} alt="" style={{ width: size, height: size }} className="flex-none rounded-xl object-cover" />;
  return (
    <span style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.34) }} className="grid flex-none place-items-center rounded-xl font-extrabold">
      {ini}
    </span>
  );
}
