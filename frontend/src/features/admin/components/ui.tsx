import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import i18n, { currentLocale } from '../../../i18n';

/**
 * Các mảnh UI dùng chung của khu vực Admin (bám bản thiết kế "SofinHub Admin"):
 * nút, badge trạng thái theo tone, avatar, thẻ nền trắng, trạng thái tải/lỗi/rỗng.
 */

export type Tone = 'g' | 'o' | 'r' | 'x' | 'b';

/** Cặp [nền, chữ] theo tone của bản thiết kế (g=xanh lá, o=cam, r=đỏ, x=xám, b=xanh dương). */
export const TONE: Record<Tone, readonly [string, string]> = {
  g: ['#dcfce7', '#15803d'],
  o: ['#ffedd5', '#c2410c'],
  r: ['#fee2e2', '#b91c1c'],
  x: ['#f1efed', '#57534e'],
  b: ['#dbeafe', '#1d4ed8'],
};

export const MONO_FONT = "'JetBrains Mono Variable','JetBrains Mono',ui-monospace,monospace";

export const errMessage = (e: unknown, fallback = i18n.t('ui.genericError', { ns: 'admin-components' })) => (e instanceof Error && e.message ? e.message : fallback);

// ---- Nút ----
export type BtnKind = 'primary' | 'default' | 'danger' | 'solidDanger' | 'dark';

const BTN_BASE = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const BTN_KIND: Record<BtnKind, string> = {
  primary:
    'h-10 rounded-[11px] border-0 bg-gradient-to-b from-[#ff8f45] to-[#f26a1b] px-[15px] text-[13.5px] text-white shadow-[0_6px_16px_rgba(242,106,27,.28)] hover:brightness-[1.05]',
  default: 'h-10 rounded-[11px] border-[1.5px] border-[#e7e0da] bg-white px-[15px] text-[13.5px] text-stone-800 hover:bg-[#fff4ec]',
  danger: 'h-10 rounded-[11px] border-[1.5px] border-[#fecaca] bg-[#fff5f5] px-[15px] text-[13.5px] text-[#b91c1c] hover:bg-[#fee2e2]',
  solidDanger: 'h-10 rounded-[11px] border-0 bg-[#dc2626] px-[15px] text-[13.5px] text-white hover:brightness-95',
  dark: 'h-8 rounded-[11px] border-0 bg-white/[.14] px-3 text-[12.5px] text-white hover:bg-white/25',
};

export const btnCls = (kind: BtnKind = 'default', extra = '') => `${BTN_BASE} ${BTN_KIND[kind]} ${extra}`;

export function AdminButton({ kind = 'default', icon, children, className = '', type = 'button', ...rest }: { kind?: BtnKind; icon?: string; children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={btnCls(kind, className)} {...rest}>
      {icon && <MaterialIcon name={icon} size={19} />}
      {children}
    </button>
  );
}

/** Nút nhỏ trong dòng bảng ("Xem", "Duyệt"...). */
export const miniBtnCls = (primary = false) =>
  `h-[30px] whitespace-nowrap rounded-[9px] px-[11px] text-[12.5px] font-semibold disabled:opacity-50 ${primary ? 'bg-brand text-white' : 'border border-[#e7e0da] bg-white text-stone-700 hover:bg-[#fff4ec]'}`;

// ---- Badge trạng thái ----
export function StatusBadge({ tone = 'b', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  const [bg, fg] = TONE[tone];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap ${className}`} style={{ background: bg, color: fg }}>
      <span className="size-1.5 flex-none rounded-full" style={{ background: fg }} />
      {children}
    </span>
  );
}

// ---- Avatar ----
const SOFT = [
  ['#f3ddd0', '#7c2d12'],
  ['#dbeafe', '#1e40af'],
  ['#dcfce7', '#166534'],
  ['#fae8ff', '#86198f'],
  ['#fef3c7', '#92400e'],
  ['#e0e7ff', '#3730a3'],
] as const;
const SQUARE = ['#0b1220', '#2563eb', '#16a34a', '#f26a1b', '#7c3aed', '#db2777', '#0891b2', '#ca8a04', '#0f766e', '#9333ea'];

/** Băm chuỗi -> số ổn định để chọn màu avatar (cùng một đối tượng luôn cùng màu). */
export const hashSeed = (s: string) => {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

/** Avatar tròn (người dùng) hoặc vuông bo (cộng đồng), có ảnh thì dùng ảnh. */
export function AdminAvatar({ name, src, shape = 'round', size = 34, seed }: { name: string; src?: string | null; shape?: 'round' | 'square'; size?: number; seed?: string }) {
  const h = hashSeed(seed ?? name);
  const common = { width: size, height: size } as const;
  if (src) return <img src={src} alt="" className={`flex-none object-cover ${shape === 'round' ? 'rounded-full' : 'rounded-[10px]'}`} style={common} />;
  const font = Math.max(10, Math.round(size * 0.36));
  if (shape === 'round') {
    const [bg, fg] = SOFT[h % 6]!;
    return (
      <span className="grid flex-none place-items-center rounded-full font-bold" style={{ ...common, background: bg, color: fg, fontSize: font }} aria-hidden="true">
        {initials(name)}
      </span>
    );
  }
  return (
    <span className="grid flex-none place-items-center rounded-[10px] font-extrabold text-white" style={{ ...common, background: SQUARE[h % 10], fontSize: font }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// ---- Thẻ nền trắng ----
export const CARD_CLS = 'min-w-0 rounded-[20px] border border-[rgba(120,60,20,.08)] bg-white shadow-[0_4px_16px_rgba(120,60,20,.04)]';

/** Khung thẻ có tiêu đề + phụ đề + (nút | link) ở góc phải như các "box" của bản thiết kế. */
export function Card({
  title,
  sub,
  link,
  onLink,
  action,
  children,
  className = '',
}: {
  title?: string;
  sub?: string;
  link?: string;
  onLink?: () => void;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD_CLS} flex flex-col gap-3.5 px-5 py-[18px] ${className}`}>
      {(title || action || link) && (
        <div className="flex flex-wrap items-start gap-2.5">
          <div className="min-w-0 flex-1">
            {title && <h2 className="m-0 text-[15px] font-bold">{title}</h2>}
            {sub && <div className="mt-[3px] text-[12.5px] leading-normal text-stone-400">{sub}</div>}
          </div>
          {action}
          {link && (
            <button type="button" onClick={onLink} className="border-0 bg-transparent p-0 text-[13px] font-semibold text-brand hover:underline">
              {link}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ---- Trạng thái chung ----
export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useTranslation('admin-components');
  return (
    <div role="status" className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-stone-400">
      <span className="size-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand" aria-hidden="true" />
      {label ?? t('ui.loading')}
    </div>
  );
}

export function ErrorBlock({ error, onRetry, className = '' }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation('admin-components');
  return (
    <div role="alert" className={`flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-[#b91c1c] ${className}`}>
      <MaterialIcon name="error" size={26} filled />
      <span>{errMessage(error, t('ui.loadFailed'))}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-1 h-8 rounded-[9px] border border-[#fecaca] bg-white px-3 text-[12.5px] font-semibold">
          {t('ui.retry')}
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ children, icon }: { children?: ReactNode; icon?: string }) {
  const { t } = useTranslation('admin-components');
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-stone-400">
      {icon && <MaterialIcon name={icon} size={28} />}
      {children ?? t('ui.noResults')}
    </div>
  );
}

/** Dòng nhãn/giá trị trong thẻ "kv". */
export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString(currentLocale()));
