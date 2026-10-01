import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Card, CARD_CLS, EmptyBlock, StatusBadge, TONE, btnCls, type BtnKind, type Tone } from './ui';

/* ================================ KPI ================================ */

export interface Kpi {
  icon: string;
  label: string;
  value: string;
  /** Mức thay đổi dạng "+12.4%" / "-3%" (có thể bỏ trống). */
  delta?: string | null;
  note?: string;
  onClick?: () => void;
  /** true: tăng là xấu (vd. báo cáo, tạm ngưng) → đảo màu delta. */
  bad?: boolean;
}

export function KpiGrid({ items, min = 170 }: { items: Kpi[]; min?: number }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))` }}>
      {items.map((k) => {
        const neg = !!k.delta && k.delta.startsWith('-');
        const good = k.bad ? neg : !neg;
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-stone-500">{k.label}</span>
              <span className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-[#fff1e6]">
                <MaterialIcon name={k.icon} size={19} color="#f26a1b" />
              </span>
            </div>
            <div className="mt-1 text-[26px] font-extrabold tracking-[-.02em] tabular-nums">{k.value}</div>
            <div className="mt-1.5 flex min-h-5 items-center gap-1.5 text-xs text-stone-400">
              {k.delta && (
                <span className="inline-flex items-center gap-[3px] rounded-full px-[7px] py-0.5 font-bold" style={{ background: good ? '#dcfce7' : '#fee2e2', color: good ? '#15803d' : '#b91c1c' }}>
                  <MaterialIcon name={neg ? 'trending_down' : 'trending_up'} size={14} />
                  {k.delta}
                </span>
              )}
              {k.note}
            </div>
          </>
        );
        const cls = `min-w-0 rounded-[18px] border border-[rgba(120,60,20,.08)] bg-white px-[17px] py-[15px] text-left shadow-[0_4px_16px_rgba(120,60,20,.04)]`;
        return k.onClick ? (
          <button key={k.label} type="button" onClick={k.onClick} className={`${cls} cursor-pointer hover:border-[#fdba74]`}>
            {body}
          </button>
        ) : (
          <div key={k.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ============================== Biểu đồ ============================== */

export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
}

const SERIES_COLORS = ['#f26a1b', '#2563eb', '#16a34a', '#a855f7', '#dc2626'];

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K` : String(Math.round(n)));

/** Biểu đồ đường SVG (bám bản thiết kế): legend bật/tắt từng đường, trục Y 4 mức, nhãn X thưa. */
export function ChartCard({
  title,
  sub,
  series,
  labels,
  fmt = compact,
  tools,
  loading,
}: {
  title: string;
  sub?: string;
  series: ChartSeries[];
  labels: string[];
  fmt?: (n: number) => string;
  tools?: ReactNode;
  loading?: boolean;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const n = labels.length;
  const step = Math.max(1, Math.ceil(n / 8)); // tối đa ~8 nhãn trục X để không chồng chữ
  const shown = series.filter((s) => !hidden[s.name]);
  const max = Math.max(1, ...shown.flatMap((s) => s.values)) * 1.08;
  const pt = (v: number, i: number) => `${n <= 1 ? 50 : (i / (n - 1)) * 100},${96 - (v / max) * 92}`;
  const summary = `${title}: ${series.map((s) => `${s.name} tổng ${fmt(s.values.reduce((a, b) => a + b, 0))}`).join('; ')}`;

  return (
    <Card title={title} sub={sub} action={tools}>
      <div className="flex flex-wrap gap-2">
        {series.map((s, i) => {
          const on = !hidden[s.name];
          const color = s.color ?? SERIES_COLORS[i % 5]!;
          return (
            <button
              key={s.name}
              type="button"
              aria-pressed={on}
              onClick={() => setHidden((h) => ({ ...h, [s.name]: on }))}
              className={`flex h-7 items-center gap-[7px] rounded-full px-2.5 text-xs font-semibold ${on ? 'border border-[#ece5df] bg-white text-stone-800' : 'border border-transparent bg-[#f5f1ed] text-stone-400'}`}
            >
              <span className="size-2 rounded-full" style={{ background: on ? color : '#d6d3d1' }} />
              {s.name}
            </button>
          );
        })}
      </div>
      {loading ? (
        <div className="grid h-[200px] place-items-center text-sm text-stone-400">Đang tải…</div>
      ) : n < 2 || series.length === 0 ? (
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
              {series.map((s, si) =>
                hidden[s.name] ? null : (
                  <polyline
                    key={s.name}
                    fill="none"
                    stroke={s.color ?? SERIES_COLORS[si % 5]}
                    strokeWidth={si === 0 ? 3 : 2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={s.values.map(pt).join(' ')}
                  />
                ),
              )}
            </svg>
            <div className="mt-2 flex justify-between text-[11px] text-stone-400" aria-hidden="true">
              {labels.map((l, i) => (
                <span key={i} className="flex w-0 justify-center whitespace-nowrap">
                  {i % step === 0 ? l : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {shown.length === 0 && series.length > 0 && <div className="text-center text-xs text-stone-400">Bật ít nhất một đường để xem biểu đồ.</div>}
    </Card>
  );
}

/* ============================ Cơ cấu / kv ============================ */

const BAR_COLORS = ['#f26a1b', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'];

export function BreakdownCard({ title, sub, items }: { title: string; sub?: string; items: { label: string; value: string; pct: number }[] }) {
  return (
    <Card title={title} sub={sub}>
      {items.length === 0 ? (
        <EmptyBlock>Chưa có dữ liệu.</EmptyBlock>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((b, i) => (
            <div key={b.label}>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-stone-700">{b.label}</span>
                <span className="font-bold">{b.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f5f1ed]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, b.pct))}%`, background: BAR_COLORS[Math.min(i, 4)] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export interface KvItem {
  k: string;
  v: ReactNode;
  /** Hiện giá trị dạng badge với tone này. */
  badge?: Tone;
}

export function KvCard({ title, sub, items, link, onLink }: { title: string; sub?: string; items: KvItem[]; link?: string; onLink?: () => void }) {
  return (
    <Card title={title} sub={sub} link={link} onLink={onLink}>
      <dl className="m-0 flex flex-col">
        {items.map((i) => (
          <div key={i.k} className="flex items-center justify-between gap-3 border-t border-[#f4efeb] py-2.5 text-[13.5px]">
            <dt className="flex-none text-stone-500">{i.k}</dt>
            <dd className="m-0 min-w-0 text-right font-semibold">
              {i.badge ? <StatusBadge tone={i.badge}>{i.v}</StatusBadge> : <span className="block truncate">{i.v}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/* ====================== Timeline / chú ý / thao tác nhanh ====================== */

export interface TimelineItem {
  icon: string;
  who: string;
  text: string;
  time: string;
  tone?: Tone;
}

export function TimelineCard({ title, sub, items, link, onLink, chips, empty = 'Chưa có hoạt động nào.' }: { title: string; sub?: string; items: TimelineItem[]; link?: string; onLink?: () => void; chips?: ReactNode; empty?: string }) {
  return (
    <Card title={title} sub={sub} link={link} onLink={onLink}>
      {chips}
      {items.length === 0 ? (
        <EmptyBlock>{empty}</EmptyBlock>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((i, idx) => {
            const [bg, fg] = TONE[i.tone ?? 'o'];
            return (
              <li key={idx} className="flex gap-3 py-[9px]">
                <span className="grid size-8 flex-none place-items-center rounded-[10px]" style={{ background: bg, color: fg }}>
                  <MaterialIcon name={i.icon} size={17} />
                </span>
                <div className="min-w-0 flex-1 text-[13.5px] leading-normal">
                  <b className="font-bold">{i.who}</b> <span className="text-stone-700">{i.text}</span>
                  <div className="mt-px text-xs text-stone-400">{i.time}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export interface AttentionItem {
  icon: string;
  label: string;
  sub?: string;
  count: string;
  tone: Tone;
  onClick: () => void;
}

export function AttentionCard({ title, items }: { title: string; items: AttentionItem[] }) {
  return (
    <Card title={title}>
      <div className="flex flex-col">
        {items.map((i) => {
          const [bg, fg] = TONE[i.tone];
          return (
            <button key={i.label} type="button" onClick={i.onClick} className="-mx-2 flex items-center gap-3 rounded-xl border-0 bg-transparent px-2 py-[9px] text-left hover:bg-[#fdf6f1]">
              <span className="grid size-9 flex-none place-items-center rounded-[11px]" style={{ background: bg, color: fg }}>
                <MaterialIcon name={i.icon} size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{i.label}</span>
                {i.sub && <span className="mt-px block text-xs text-stone-400">{i.sub}</span>}
              </span>
              <span className="grid h-6 min-w-[30px] place-items-center rounded-full bg-[#f5f1ed] px-2 text-[12.5px] font-bold">{i.count}</span>
              <MaterialIcon name="chevron_right" size={18} color="#d6d3d1" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function QuickCard({ title, items }: { title: string; items: { icon: string; label: string; onClick: () => void }[] }) {
  return (
    <Card title={title}>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((i) => (
          <button key={i.label} type="button" onClick={i.onClick} className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-[#f1ebe6] bg-transparent p-3.5 text-left hover:border-[#fdba74] hover:bg-[#fffaf6]">
            <MaterialIcon name={i.icon} size={22} color="#f26a1b" />
            <span className="text-[13.5px] font-semibold">{i.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export function RiskCard({ title, items, verdict }: { title: string; items: { label: string; value: string; pct: number; tone?: Tone }[]; verdict?: { text: string; tone: Tone } }) {
  return (
    <Card title={title}>
      <div className="flex flex-col gap-3.5">
        {items.map((i) => {
          const fg = TONE[i.tone ?? 'o'][1];
          return (
            <div key={i.label}>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-stone-700">{i.label}</span>
                <span className="font-bold" style={{ color: fg }}>
                  {i.value}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#f5f1ed]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, i.pct))}%`, background: fg }} />
              </div>
            </div>
          );
        })}
        {verdict && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold" style={{ background: TONE[verdict.tone][0], color: TONE[verdict.tone][1] }}>
            <MaterialIcon name={verdict.tone === 'g' ? 'verified_user' : 'report'} size={19} filled />
            {verdict.text}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ============================ Checklist / quyết định ============================ */

export interface ChecklistItem {
  key: string;
  label: string;
  sub?: string;
  checked: boolean;
  flag?: { text: string; tone: Tone };
  /** Mục tự tính từ dữ liệu: không cho bấm đổi. */
  auto?: boolean;
}

export function ChecklistCard({ title, items, onToggle }: { title: string; items: ChecklistItem[]; onToggle: (key: string) => void }) {
  const done = items.filter((i) => i.checked).length;
  const pct = items.length ? (done / items.length) * 100 : 0;
  return (
    <Card title={title}>
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f5f1ed]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: done === items.length ? '#16a34a' : '#f26a1b' }} />
        </div>
        <span className="text-[12.5px] font-bold">
          {done}/{items.length}
        </span>
      </div>
      <div className="flex flex-col">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            role="checkbox"
            aria-checked={i.checked}
            disabled={i.auto}
            onClick={() => onToggle(i.key)}
            className="flex items-center gap-3 border-0 border-t border-[#f4efeb] bg-transparent py-2.5 text-left disabled:cursor-default"
          >
            <MaterialIcon name={i.checked ? 'check_box' : 'check_box_outline_blank'} size={21} filled={i.checked} color={i.checked ? '#f26a1b' : '#a8a29e'} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">{i.label}</span>
              {i.sub && <span className="mt-px block text-[12.5px] text-stone-500">{i.sub}</span>}
            </span>
            {i.flag && <StatusBadge tone={i.flag.tone}>{i.flag.text}</StatusBadge>}
          </button>
        ))}
      </div>
    </Card>
  );
}

export interface DecisionButton {
  label: string;
  icon: string;
  kind?: BtnKind;
  disabled?: boolean;
  onClick: () => void;
}

/** Ô ghi chú nội bộ + hàng nút quyết định (Duyệt / Từ chối / Cảnh cáo...). */
export function DecisionPanel({
  title,
  sub,
  note,
  onNote,
  placeholder,
  buttons,
  done,
  showNote = true,
}: {
  title: string;
  sub?: string;
  note: string;
  onNote: (v: string) => void;
  placeholder: string;
  buttons: DecisionButton[];
  done?: string;
  showNote?: boolean;
}) {
  const id = useId();
  return (
    <Card title={title} sub={sub}>
      {showNote && (
        <textarea
          id={id}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={1000}
          className="h-[84px] w-full resize-y rounded-[14px] border-[1.5px] border-[#e7e0da] px-3.5 py-3 text-[13.5px] font-medium outline-0 focus:border-brand"
        />
      )}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
        {buttons.map((b) => (
          <button key={b.label} type="button" disabled={b.disabled} onClick={b.onClick} className={btnCls(b.kind ?? 'default', '!h-[42px]')}>
            <MaterialIcon name={b.icon} size={18} />
            {b.label}
          </button>
        ))}
      </div>
      {done && (
        <div className="flex items-center gap-2 rounded-xl bg-[#f0fdf4] px-3 py-2.5 text-[13px] font-semibold text-[#15803d]">
          <MaterialIcon name="check_circle" size={18} filled />
          {done}
        </div>
      )}
    </Card>
  );
}

/* ================================ Nội dung ================================ */

export function ContentCard({
  title,
  avatar,
  author,
  meta,
  heading,
  body,
  stats,
  context,
  children,
}: {
  title: string;
  avatar: ReactNode;
  author: string;
  meta: string;
  heading?: string;
  body: string;
  stats?: { icon: string; text: string }[];
  context?: { name: string; text: string; highlight?: boolean; avatar?: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <Card title={title}>
      <div className="flex items-center gap-3">
        {avatar}
        <div className="min-w-0">
          <div className="text-sm font-bold">{author}</div>
          <div className="text-[12.5px] text-stone-500">{meta}</div>
        </div>
      </div>
      <div className="rounded-[14px] border border-[#f1e9e3] bg-[#fbf8f6] px-[18px] py-4">
        {heading && <div className="text-[16.5px] leading-snug font-bold">{heading}</div>}
        <p className={`m-0 text-sm leading-[1.65] break-words whitespace-pre-wrap text-stone-700 ${heading ? 'mt-2' : ''}`}>{body}</p>
        {children}
        {stats && stats.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-4 text-[12.5px] text-stone-500">
            {stats.map((s) => (
              <span key={s.text} className="flex items-center gap-[5px]">
                <MaterialIcon name={s.icon} size={16} />
                {s.text}
              </span>
            ))}
          </div>
        )}
      </div>
      {context && context.length > 0 && (
        <>
          <div className="text-[11.5px] font-bold tracking-[.06em] text-stone-400">NGỮ CẢNH</div>
          <div className="flex flex-col gap-2">
            {context.map((c, i) => (
              <div key={i} className={`flex gap-2.5 rounded-xl px-3 py-2.5 ${c.highlight ? 'border border-[#fdba74] bg-[#fff4ec]' : 'border border-transparent bg-[#faf8f6]'}`}>
                {c.avatar}
                <div className="min-w-0 text-[13px] leading-normal">
                  <b>{c.name}</b> <span className="break-words text-stone-700">{c.text}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ================================ Vùng nguy hiểm ================================ */

export function DangerCard({ title, items }: { title: string; items: { title: string; desc: string; btn: string; onClick: () => void; disabled?: boolean }[] }) {
  return (
    <Card title={title}>
      <div className="flex flex-col gap-2.5">
        {items.map((d) => (
          <div key={d.title} className="flex flex-wrap items-center gap-3.5 rounded-[14px] border-[1.5px] border-[#fecaca] bg-[#fffafa] px-4 py-3.5">
            <div className="min-w-[200px] flex-1">
              <div className="text-sm font-bold text-[#991b1b]">{d.title}</div>
              <div className="mt-0.5 text-[12.5px] text-stone-500">{d.desc}</div>
            </div>
            <button type="button" disabled={d.disabled} onClick={d.onClick} className="h-[38px] rounded-[11px] border-0 bg-[#dc2626] px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">
              {d.btn}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ================================ Header thực thể ================================ */

export function EntityHeader({
  avatar,
  name,
  status,
  meta,
  actions,
  tabs,
  tab,
  onTab,
}: {
  avatar: ReactNode;
  name: string;
  status?: { label: string; tone: Tone };
  meta: { icon: string; text: string }[];
  actions?: ReactNode;
  tabs?: { key: string; label: string }[];
  tab?: string;
  onTab?: (key: string) => void;
}) {
  return (
    <div className={`${CARD_CLS} !rounded-[22px]`}>
      <div className="flex flex-wrap items-center gap-[18px] px-6 py-[22px]">
        {avatar}
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="m-0 text-[22px] font-extrabold tracking-[-.02em] break-words">{name}</h2>
            {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1.5">
            {meta.map((m) => (
              <span key={m.text} className="flex items-center gap-1.5 text-[13px] text-stone-600">
                <MaterialIcon name={m.icon} size={17} color="#a8a29e" />
                {m.text}
              </span>
            ))}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {tabs && (
        <div className="no-scrollbar flex gap-0.5 overflow-x-auto border-t border-[rgba(120,60,20,.07)] px-3.5" role="tablist">
          {tabs.map((t) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onTab?.(t.key)}
                className={`border-0 border-b-[2.5px] bg-transparent px-3 pt-3.5 pb-3 text-[13.5px] whitespace-nowrap ${on ? 'border-brand font-bold text-brand' : 'border-transparent font-medium text-stone-600'}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Lưới cột như `R(cols, ...)` của bản thiết kế: nhiều cột trên màn rộng, 1 cột khi hẹp. */
export function Row({ cols, children }: { cols?: string; children: ReactNode }) {
  return (
    <div className="admin-row grid items-start gap-[18px]" style={cols ? ({ '--cols': cols.split(' ').map((t) => `minmax(0,${t})`).join(' ') } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}
