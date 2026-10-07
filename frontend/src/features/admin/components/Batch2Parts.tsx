import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../lib/datetime';
import { AUDIT_ACTION, type AuditItem } from '../types';
import { auditLabel } from '../types.batch3';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Segment } from './DataTable';
import { CheckField, InputField, ModalShell, OptionChips, TextAreaField, useToast } from './overlay';
import { AdminButton, Card, EmptyBlock, errMessage } from './ui';

/**
 * Các mảnh dùng chung của Admin đợt 2 (Nội dung · Thanh toán · Khám phá):
 * ActionDialog (modal xác nhận + lý do + ghi chú, gọi API thật), MediaGrid, FactorsCard, FeaturedCard, DateInput.
 */

export const opts = (labels: readonly string[]) => labels.map((l) => ({ value: l, label: l }));

export interface ActionResult {
  reason: string;
  note: string;
  flag: boolean;
}

/**
 * Modal thao tác chung: [lý do (chip)] + [ghi chú] + [ô gõ từ xác nhận] + [checkbox], bấm xác nhận thì gọi `run`.
 * Thành công -> toast + đóng + onDone; lỗi hiển thị ngay trong modal.
 */
export function ActionDialog({
  icon,
  danger,
  title,
  body,
  cta,
  reasons,
  reasonLabel,
  requireReason,
  noteLabel,
  notePlaceholder,
  requireNote,
  flagLabel,
  flagDefault = true,
  confirmWord,
  successMessage,
  disabledExtra,
  defaultNote = '',
  run,
  onClose,
  onDone,
  children,
}: {
  defaultNote?: string;
  /** Chặn nút xác nhận khi dữ liệu trong `children` chưa hợp lệ. */
  disabledExtra?: boolean;
  icon: string;
  danger?: boolean;
  title: string;
  body?: ReactNode;
  cta: string;
  reasons?: readonly { value: string; label: string }[];
  reasonLabel?: string;
  requireReason?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
  requireNote?: boolean;
  flagLabel?: string;
  flagDefault?: boolean;
  confirmWord?: string;
  successMessage: string;
  /** Có thể trả `{ message }` để thay thông báo thành công mặc định (vd. gộp cả phần bị bỏ qua vào một toast). */
  run: (v: ActionResult) => Promise<unknown>;
  onClose: () => void;
  onDone?: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation('admin-parts');
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState(defaultNote);
  const [flag, setFlag] = useState(flagDefault);
  const [word, setWord] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !!disabledExtra || (!!requireReason && !reason) || (!!requireNote && !note.trim()) || (!!confirmWord && word !== confirmWord);

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = (await run({ reason, note: note.trim(), flag })) as { message?: string } | undefined;
      toast.success(typeof res?.message === 'string' ? res.message : successMessage);
      onClose();
      onDone?.();
    } catch (e) {
      setError(errMessage(e));
      setPending(false);
    }
  };

  return (
    <ModalShell icon={icon} danger={danger} title={title} body={body} cta={cta} pending={pending} disabled={disabled} error={error} onConfirm={() => void submit()} onClose={onClose}>
      {children}
      {reasons && <OptionChips label={reasonLabel ?? t('action.reason')} options={reasons} value={reason} onChange={(v) => setReason(v as string)} />}
      {noteLabel && <TextAreaField label={noteLabel} value={note} onChange={setNote} placeholder={notePlaceholder} />}
      {flagLabel && <CheckField text={flagLabel} checked={flag} onChange={setFlag} />}
      {confirmWord && <InputField label={t('action.typeToConfirm', { word: confirmWord })} value={word} onChange={setWord} placeholder={confirmWord} mono />}
    </ModalShell>
  );
}

/** Ô chọn ngày kiểu bản thiết kế (input date nhỏ). */
export function DateInput({ value, onChange, label, min }: { value: string; onChange: (v: string) => void; label: string; min?: string }) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-[#e7e0da] bg-white px-2 text-xs font-medium outline-0 focus:border-brand"
    />
  );
}

/* ================================ Media ================================ */

export interface MediaCardItem {
  id: string;
  kind: 'image' | 'video' | 'document' | 'audio' | string;
  name: string;
  meta: string;
  thumbUrl?: string | null;
  reports?: number;
  buttons: { icon: string; label: string; danger?: boolean; onClick: () => void }[];
}

const MEDIA_ICON: Record<string, string> = { image: 'image', video: 'movie', document: 'description', audio: 'graphic_eq' };
export const mediaIcon = (kind: string) => MEDIA_ICON[kind] ?? 'draft';

/** Lưới thư viện media (ô 180px, ảnh 120px, nhãn "n báo cáo", 3 nút Xem/Tải/Gỡ). */
export function MediaGrid({ items, title, sub, tools, chips }: { items: MediaCardItem[]; title: string; sub?: string; tools?: ReactNode; chips?: ReactNode }) {
  const { t } = useTranslation('admin-parts');
  return (
    <Card title={title} sub={sub} action={tools}>
      {chips}
      {items.length === 0 ? (
        <EmptyBlock icon="perm_media">{t('media.empty')}</EmptyBlock>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
          {items.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-[14px] border border-[#f1ebe6]">
              <div className="relative grid h-[120px] place-items-center overflow-hidden bg-[#f5f1ed]">
                {m.kind === 'image' && m.thumbUrl ? <img src={m.thumbUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : <MaterialIcon name={mediaIcon(m.kind)} size={38} color="#c9bfb6" />}
                {!!m.reports && <span className="absolute top-2 right-2 rounded-full bg-[#dc2626] px-2 py-0.5 text-[11px] font-bold text-white">{t('media.reports', { count: m.reports })}</span>}
              </div>
              <div className="px-3 py-2.5">
                <div className="truncate text-[13px] font-semibold" title={m.name}>
                  {m.name}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-stone-400" title={m.meta}>
                  {m.meta}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  {m.buttons.map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      title={b.label}
                      aria-label={b.label}
                      onClick={b.onClick}
                      className={`grid size-[30px] place-items-center rounded-lg border bg-white ${b.danger ? 'border-[#fecaca] text-[#b91c1c]' : 'border-[#e7e0da] text-stone-600'} hover:bg-[#fff4ec]`}
                    >
                      <MaterialIcon name={b.icon} size={17} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Nhóm chip lọc nhanh (Tất cả / Hình ảnh / ...) đặt phía trên lưới media. */
export function FilterChips<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return <Segment options={options} value={value} onChange={onChange} />;
}

/* ============================ Trọng số xếp hạng ============================ */

export interface FactorItem {
  key: string;
  label: string;
  value: number;
  /** Yếu tố trừ điểm hiện màu đỏ. */
  penalty?: boolean;
}

/** Thẻ "Yếu tố xếp hạng": thanh + nút −/+ (bước 5). */
export function FactorsCard({ title, sub, items, onChange, max = 60 }: { title: string; sub?: string; items: FactorItem[]; onChange: (key: string, value: number) => void; max?: number }) {
  const { t } = useTranslation('admin-parts');
  const sq = 'grid size-7 place-items-center rounded-lg border border-[#e7e0da] bg-white hover:bg-[#fff4ec] disabled:opacity-40';
  return (
    <Card title={title} sub={sub}>
      <div className="flex flex-col gap-3">
        {items.map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <span className="flex-none basis-[130px] text-[13.5px] font-semibold">{f.label}</span>
            <div className="h-2 min-w-10 flex-1 overflow-hidden rounded-full bg-[#f5f1ed]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, f.value * 2.5)}%`, background: f.penalty ? '#dc2626' : '#f26a1b' }} />
            </div>
            <button type="button" className={sq} aria-label={t('factors.decrease', { label: f.label })} disabled={f.value <= 0} onClick={() => onChange(f.key, Math.max(0, f.value - 5))}>
              <MaterialIcon name="remove" size={17} />
            </button>
            <span className="min-w-10 text-center text-[13px] font-bold tabular-nums">{f.value}%</span>
            <button type="button" className={sq} aria-label={t('factors.increase', { label: f.label })} disabled={f.value >= max} onClick={() => onChange(f.key, Math.min(max, f.value + 5))}>
              <MaterialIcon name="add" size={17} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================== Nổi bật ============================== */

export interface FeaturedRow {
  id: string;
  name: string;
  meta: string;
  start: string;
  end: string;
}

/** Thẻ danh sách nổi bật: thứ hạng, ngày bắt đầu/kết thúc, nút lên/xuống/gỡ + nút "Tìm & thêm cộng đồng". */
export function FeaturedCard({
  title,
  sub,
  rows,
  busy,
  onMove,
  onRemove,
  onDates,
  onAdd,
}: {
  title: string;
  sub?: string;
  rows: FeaturedRow[];
  busy?: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (row: FeaturedRow) => void;
  onDates: (row: FeaturedRow, start: string, end: string) => void;
  onAdd: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation('admin-parts');
  const arrow = 'grid size-8 place-items-center rounded-[7px] border-0 bg-transparent text-stone-500 hover:bg-[#f5f1ed] disabled:opacity-30';
  return (
    <Card title={title} sub={sub}>
      <div className="flex flex-col">
        {rows.length === 0 && <EmptyBlock>{t('featured.empty')}</EmptyBlock>}
        {rows.map((r, i) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2.5 border-t border-[#f4efeb] py-2.5 first:border-t-0">
            <span className="w-6 text-[13px] font-extrabold text-brand">#{i + 1}</span>
            <div className="min-w-[140px] flex-1">
              <div className="truncate text-[13.5px] font-semibold">{r.name}</div>
              <div className="truncate text-xs text-stone-400">{r.meta}</div>
            </div>
            <DateInput label={t('featured.start', { name: r.name })} value={r.start} onChange={(v) => onDates(r, v, r.end)} />
            <span className="text-xs text-stone-400">→</span>
            <DateInput label={t('featured.end', { name: r.name })} value={r.end} min={r.start} onChange={(v) => onDates(r, r.start, v)} />
            <button type="button" className={arrow} disabled={busy || i === 0} aria-label={t('featured.moveUp')} onClick={() => onMove(i, -1)}>
              <MaterialIcon name="arrow_upward" size={19} />
            </button>
            <button type="button" className={arrow} disabled={busy || i === rows.length - 1} aria-label={t('featured.moveDown')} onClick={() => onMove(i, 1)}>
              <MaterialIcon name="arrow_downward" size={19} />
            </button>
            <button type="button" className={`${arrow} !text-[#dc2626] hover:!bg-[#fef2f2]`} disabled={busy} aria-label={t('featured.remove')} onClick={() => onRemove(r)}>
              <MaterialIcon name="close" size={19} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="flex h-10 items-center justify-center gap-1.5 rounded-[11px] border-[1.5px] border-dashed border-[#fdba74] bg-transparent text-[13px] font-semibold text-brand hover:bg-[#fffaf6] disabled:opacity-50"
      >
        <MaterialIcon name="add" size={18} />
        {t('featured.add')}
      </button>
    </Card>
  );
}

export { AdminButton };

/* ============================ Ô / khung phụ ============================ */

/** Ô thanh tiến độ nhỏ (Hoàn thành, Tương tác, Điểm chất lượng...). */
export function BarCell({ pct, tone }: { pct: number; tone?: 'auto' | 'brand' }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const color = tone === 'brand' ? '#f26a1b' : v >= 70 ? '#16a34a' : v >= 45 ? '#f26a1b' : '#dc2626';
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-[#f5f1ed]">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="w-9 flex-none text-right text-xs font-semibold text-stone-600 tabular-nums">{v}%</span>
    </div>
  );
}

/** Khung xem nhanh (không có nút xác nhận): tiêu đề + nội dung cuộn + nút Đóng. */
export function PreviewDialog({ title, sub, onClose, children, wide }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useTranslation('admin-parts');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[rgba(28,25,23,.4)] p-5 backdrop-blur-[3px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[88vh] flex-col gap-4 overflow-hidden rounded-3xl bg-white p-6 shadow-[0_30px_80px_rgba(28,25,23,.25)]`}
        style={{ width: `min(${wide ? 760 : 600}px,100%)` }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[18.5px] font-extrabold tracking-[-.01em] break-words">{title}</div>
            {sub && <div className="mt-1 text-[13px] text-stone-500">{sub}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label={t('preview.close')} className="border-0 bg-transparent p-0 text-stone-400 hover:text-stone-700">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">{children}</div>
        <button type="button" onClick={onClose} className="h-[44px] rounded-[13px] border-[1.5px] border-[#e7e0da] bg-white text-sm font-semibold hover:bg-[#fff4ec]">
          {t('preview.close')}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Khối "tiêu đề nhỏ + nội dung" trong PreviewDialog. */
export function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11.5px] font-bold tracking-[.06em] text-stone-400 uppercase">{title}</div>
      {children}
    </div>
  );
}

/** Lịch sử thao tác quản trị (history[] của các endpoint chi tiết). */
export function HistoryList({ items }: { items: AuditItem[] }) {
  const { t } = useTranslation('admin-parts');
  if (!items?.length) return <div className="text-[13px] text-stone-400">{t('history.empty')}</div>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {items.map((h, i) => (
        <li key={h.id ?? i} className="rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
          <b>{auditLabel(h.action, AUDIT_ACTION)}</b> <span className="text-stone-500">· {h.actor?.name ?? t('history.system')} · {formatDateTime(h.createdAt)}</span>
          {h.reason && <div className="mt-0.5 text-stone-600">{t('history.reason', { value: h.reason })}</div>}
          {h.note && <div className="mt-0.5 text-stone-600">{t('history.note', { value: h.note })}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Dòng nhãn/giá trị gọn dùng trong PreviewDialog. */
export function PreviewKv({ items }: { items: readonly [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid gap-x-4 gap-y-1.5 text-[13.5px]" style={{ gridTemplateColumns: 'minmax(110px,auto) 1fr' }}>
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-stone-500">{k}</dt>
          <dd className="m-0 min-w-0 font-semibold break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Trạng thái tìm kiếm/lọc/trang của một bảng (đổi bộ lọc tự về trang 1). */
export function useTableState<F extends Record<string, string>>(initial: F, initialTab = '') {
  const [q, setQ] = useState('');
  const [f, setF] = useState<F>(initial);
  const [tab, setTab] = useState(initialTab);
  const [page, setPage] = useState(1);
  return {
    q,
    f,
    tab,
    page,
    setPage,
    onQ: (v: string) => {
      setQ(v);
      setPage(1);
    },
    onTab: (v: string) => {
      setTab(v);
      setPage(1);
    },
    setFilter: (k: keyof F) => (v: string) => {
      setF((o) => ({ ...o, [k]: v }));
      setPage(1);
    },
    clear: () => {
      setF(initial);
      setPage(1);
    },
  };
}

/** Chỗ hiển thị 1 modal tại một thời điểm: `show((close) => <Modal onClose={close} />)`. */
export function useDialogSlot() {
  const [factory, setFactory] = useState<((close: () => void) => ReactNode) | null>(null);
  const close = () => setFactory(null);
  return {
    show: (f: (close: () => void) => ReactNode) => setFactory(() => f),
    el: factory ? factory(close) : null,
  };
}

/** Tiền cent -> "$1,234" (làm tròn đô) cho thẻ KPI lớn. */
export const usd0 = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/** Chuyển ngày yyyy-mm-dd <-> ISO an toàn. */
export const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
