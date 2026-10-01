import { useRef, useState, type ReactNode } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Row } from './Cards';
import { Card, EmptyBlock, MONO_FONT } from './ui';

/**
 * Các mảnh dùng chung của Admin đợt 3 (Phân tích · Hỗ trợ · Hệ thống):
 * biểu đồ cột, phễu, bản đồ nhiệt giữ chân, công tắc, ma trận quyền, trình soạn mẫu email (chip biến + xem trước).
 */

/* ============================== Công tắc ============================== */

/** Công tắc bật/tắt kiểu bản thiết kế (cam khi bật). */
export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[22px] w-10 flex-none rounded-full border-0 p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-brand' : 'bg-[#d6d3d1]'}`}
    >
      <span className={`absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : ''}`} />
    </button>
  );
}

/* ============================== Biểu đồ cột ============================== */

export interface BarSeries {
  name: string;
  values: number[];
  color?: string;
}

const COLORS = ['#f26a1b', '#2563eb', '#16a34a', '#a855f7', '#dc2626'];
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K` : String(Math.round(n)));

/** Biểu đồ cột nhóm (SVG) — dùng cho dữ liệu theo khoảng thời gian khi đường không hợp (vd. chuyển đổi, số lượng). */
export function BarChartCard({ title, sub, series, labels, fmt = compact, tools }: { title: string; sub?: string; series: BarSeries[]; labels: string[]; fmt?: (n: number) => string; tools?: ReactNode }) {
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.08;
  const step = Math.max(1, Math.ceil(n / 8));
  const empty = n === 0 || series.length === 0 || series.every((s) => s.values.every((v) => !v));
  const summary = `${title}: ${series.map((s) => `${s.name} tổng ${fmt(s.values.reduce((a, b) => a + b, 0))}`).join('; ')}`;
  const groupW = 100 / Math.max(1, n);
  const barW = (groupW * 0.7) / Math.max(1, series.length);
  return (
    <Card title={title} sub={sub} action={tools}>
      <div className="flex flex-wrap gap-2">
        {series.map((s, i) => (
          <span key={s.name} className="flex h-7 items-center gap-[7px] rounded-full border border-[#ece5df] bg-white px-2.5 text-xs font-semibold">
            <span className="size-2 rounded-full" style={{ background: s.color ?? COLORS[i % 5] }} />
            {s.name}
          </span>
        ))}
      </div>
      {empty ? (
        <EmptyBlock>Chưa đủ dữ liệu để vẽ biểu đồ.</EmptyBlock>
      ) : (
        <div className="flex gap-2.5">
          <div className="flex h-[200px] min-w-10 flex-col justify-between text-right text-[11px] text-stone-400" aria-hidden="true">
            {[max, (max * 2) / 3, max / 3, 0].map((v, i) => (
              <span key={i}>{fmt(v)}</span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <svg role="img" aria-label={summary} viewBox="0 0 100 100" preserveAspectRatio="none" className="block h-[200px] w-full overflow-visible">
              {[4, 34.7, 65.3].map((y) => (
                <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#f1ebe6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              ))}
              <line x1="0" x2="100" y1="96" y2="96" stroke="#e7e0da" vectorEffect="non-scaling-stroke" />
              {labels.map((_, gi) =>
                series.map((s, si) => {
                  const v = s.values[gi] ?? 0;
                  const h = (v / max) * 92;
                  return <rect key={`${gi}-${si}`} x={gi * groupW + groupW * 0.15 + si * barW} y={96 - h} width={Math.max(0.3, barW * 0.9)} height={h} rx="0.4" fill={s.color ?? COLORS[si % 5]} />;
                }),
              )}
            </svg>
            <div className="mt-2 flex text-[11px] text-stone-400" aria-hidden="true">
              {labels.map((l, i) => (
                <span key={i} className="flex flex-1 justify-center whitespace-nowrap">
                  {i % step === 0 ? l : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ================================ Phễu ================================ */

export interface FunnelStep {
  label: string;
  /** Giá trị hiển thị bên phải (số lượng). */
  value: string;
  /** Độ rộng thanh so với bước đầu (0-100). */
  pct: number;
  /** Chữ nhỏ dưới nhãn (vd. tỷ lệ so với bước trước). */
  note?: string;
}

/** Phễu chuyển đổi: các thanh thu hẹp dần theo từng bước. */
export function FunnelCard({ title, sub, steps }: { title: string; sub?: string; steps: FunnelStep[] }) {
  return (
    <Card title={title} sub={sub}>
      {steps.length === 0 ? (
        <EmptyBlock>Chưa có dữ liệu.</EmptyBlock>
      ) : (
        <div className="flex flex-col gap-2.5">
          {steps.map((s, i) => (
            <div key={s.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-stone-700">
                  {s.label}
                  {s.note && <span className="ml-2 text-[11.5px] text-stone-400">{s.note}</span>}
                </span>
                <span className="flex-none font-bold tabular-nums">{s.value}</span>
              </div>
              <div className="h-7 overflow-hidden rounded-[9px] bg-[#f5f1ed]">
                <div className="h-full rounded-[9px]" style={{ width: `${Math.max(1.5, Math.min(100, s.pct))}%`, background: `linear-gradient(90deg,#ff8f45,#f26a1b)`, opacity: 1 - i * 0.12 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ====================== Bản đồ nhiệt giữ chân theo nhóm ====================== */

export interface CohortRow {
  label: string;
  sub?: string;
  size: number;
  /** Tỷ lệ % còn hoạt động theo từng mốc (null = chưa tới mốc). */
  values: (number | null)[];
}

/** Bảng nhiệt: mỗi dòng là một nhóm đăng ký, mỗi cột là một mốc tuần — ô càng đậm càng giữ chân tốt. */
export function CohortHeatmap({ title, sub, columns, rows }: { title: string; sub?: string; columns: string[]; rows: CohortRow[] }) {
  const cell = (v: number | null) => {
    if (v == null) return { background: '#faf7f4', color: '#d6d3d1' };
    const a = 0.12 + Math.min(100, v) / 100 * 0.78;
    return { background: `rgba(242,106,27,${a.toFixed(2)})`, color: a > 0.5 ? '#fff' : '#7c2d12' };
  };
  return (
    <Card title={title} sub={sub}>
      {rows.length === 0 ? (
        <EmptyBlock>Chưa có nhóm đăng ký nào.</EmptyBlock>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] font-bold text-stone-400 uppercase">
                <th className="px-2 py-1">Nhóm</th>
                <th className="px-2 py-1 text-right">Người dùng</th>
                {columns.map((c) => (
                  <th key={c} className="px-2 py-1 text-center">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-2 py-1.5">
                    <div className="font-semibold">{r.label}</div>
                    {r.sub && <div className="text-[11.5px] text-stone-400">{r.sub}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{r.size.toLocaleString('vi-VN')}</td>
                  {columns.map((_, i) => {
                    const v = r.values[i] ?? null;
                    return (
                      <td key={i} className="rounded-lg px-2 py-2 text-center font-bold tabular-nums" style={cell(v)}>
                        {v == null ? '—' : `${Math.round(v)}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ============================ Ma trận quyền ============================ */

export interface MatrixRole {
  key: string;
  label: string;
  /** Vai trò khóa (Super Admin) — không sửa được. */
  locked?: boolean;
}

export interface MatrixPermission {
  key: string;
  label: string;
  desc?: string;
}

/**
 * Ma trận Quyền × Vai trò. `granted` là tập "roleKey:permKey". Bấm ô để bật/tắt; ô đang lưu hiện spinner.
 * Chỉ báo trạng thái, việc gọi API do trang cha xử lý trong `onToggle`.
 */
export function PermissionMatrix({
  roles,
  permissions,
  granted,
  busyCell,
  readOnly,
  onToggle,
}: {
  roles: MatrixRole[];
  permissions: MatrixPermission[];
  granted: Set<string>;
  busyCell?: string | null;
  readOnly?: boolean;
  onToggle: (role: MatrixRole, perm: MatrixPermission, next: boolean) => void;
}) {
  const grid = `minmax(220px,2fr) repeat(${roles.length},minmax(96px,1fr))`;
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 220 + roles.length * 100 }}>
        <div className="grid items-center gap-3 border-b border-[#f1ebe6] px-5 py-3 text-[11.5px] font-bold tracking-[.04em] text-stone-400 uppercase" style={{ gridTemplateColumns: grid }}>
          <span>Quyền</span>
          {roles.map((r) => (
            <span key={r.key} className="text-center">
              {r.label}
            </span>
          ))}
        </div>
        {permissions.map((p) => (
          <div key={p.key} className="grid items-center gap-3 border-b border-[#f4efeb] px-5 py-2.5 last:border-b-0" style={{ gridTemplateColumns: grid }}>
            <div className="flex min-w-0 items-center gap-[11px]">
              <span className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-[#fff1e6] text-brand">
                <MaterialIcon name="key" size={18} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">{p.label}</div>
                <div className="truncate text-xs text-stone-400" style={{ fontFamily: MONO_FONT }}>
                  {p.key}
                </div>
              </div>
            </div>
            {roles.map((r) => {
              const id = `${r.key}:${p.key}`;
              const on = granted.has(id);
              const dis = readOnly || r.locked || busyCell === id;
              return (
                <div key={r.key} className="flex justify-center">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${r.label}: ${p.label}`}
                    disabled={dis}
                    onClick={() => onToggle(r, p, !on)}
                    className={`grid size-[30px] place-items-center rounded-lg border-[1.5px] disabled:cursor-not-allowed ${on ? 'border-brand bg-brand text-white' : 'border-[#e7e0da] bg-white text-transparent hover:border-brand'} ${dis && !on ? 'opacity-50' : ''} ${r.locked && on ? 'opacity-70' : ''}`}
                  >
                    {busyCell === id ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : <MaterialIcon name="check" size={18} />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====================== Trình soạn mẫu email ====================== */

/** Thay `{{biến}}` bằng dữ liệu mẫu để xem trước; biến lạ giữ nguyên. */
export const renderTemplate = (text: string, sample: Record<string, string>) => text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k: string) => sample[k] ?? m);

/** Chip biến: bấm để chèn `{{biến}}` vào ô đang focus. */
export function VariableChips({ variables, onInsert }: { variables: string[]; onInsert: (v: string) => void }) {
  if (variables.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] font-bold">Biến có thể chèn</div>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onInsert(`{{${v}}}`)}
            className="h-7 rounded-lg border border-[#fdba74] bg-[#fffaf6] px-2.5 text-xs font-semibold text-[#c2410c] hover:bg-[#fff1e6]"
            style={{ fontFamily: MONO_FONT }}
            title="Bấm để chèn vào ô đang soạn"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Ô nhập có theo dõi vị trí con trỏ để chèn biến (subject hoặc body). */
export function useInsertable(value: string, setValue: (v: string) => void) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const insert = (text: string) => {
    const el = ref.current;
    if (!el) return setValue(value + text);
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const next = value.slice(0, s) + text + value.slice(e);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + text.length, s + text.length);
    });
  };
  return { ref, insert };
}

/** Khung xem trước email (tiêu đề + thân). */
export function EmailPreview({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#ece5df] bg-white">
      <div className="border-b border-[#f1ebe6] bg-[#faf7f4] px-4 py-2.5">
        <div className="text-[11px] font-bold tracking-[.06em] text-stone-400 uppercase">Tiêu đề</div>
        <div className="mt-0.5 text-sm font-bold break-words">{subject || '—'}</div>
      </div>
      <div className="px-4 py-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-stone-800">{body || <span className="text-stone-400">Nội dung trống.</span>}</div>
    </div>
  );
}

/* ============================ Biểu mẫu cài đặt ============================ */

/** Một dòng cài đặt (nhãn + mô tả + điều khiển bên phải). */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#f4efeb] py-3 first:border-t-0">
      <div className="min-w-[160px] flex-1">
        <div className="text-[13.5px] font-semibold">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
      </div>
      <div className="flex min-w-0 flex-none items-center">{children}</div>
    </div>
  );
}

/** Ô nhập văn bản gọn cho dòng cài đặt. */
export function SettingInput({ value, onChange, placeholder, label, type = 'text', width = 240 }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; type?: string; width?: number }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      style={{ width: `min(${width}px,100%)` }}
      className="h-10 rounded-[11px] border-[1.5px] border-[#e7e0da] bg-white px-3 text-[13.5px] font-medium outline-0 focus:border-brand"
    />
  );
}

/** Thanh "có thay đổi chưa lưu" cho biểu mẫu cài đặt. */
export function useDirty<T>(server: T | undefined) {
  const [draft, setDraft] = useState<T | null>(null);
  const value = (draft ?? server) as T;
  return { value, dirty: draft !== null, set: (v: T) => setDraft(v), reset: () => setDraft(null) };
}

export { Row };
