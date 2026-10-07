import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useMenu, type MenuItem } from './overlay';
import { AdminAvatar, CARD_CLS, EmptyBlock, ErrorBlock, LoadingBlock, MONO_FONT, miniBtnCls, fmtNum } from './ui';

/**
 * Bảng dữ liệu dùng chung của Admin (bám bản thiết kế): thanh tiêu đề, tab đếm, ô tìm kiếm (debounce),
 * bộ lọc dạng dropdown, hàng có nút hành động đầu + menu "…", phân trang số trang ở chân bảng.
 * Bảng không tự giữ dữ liệu — trang cha truyền rows/loading/error và state tìm kiếm/lọc/trang.
 */

export interface Column<T> {
  key: string;
  label: string;
  /** Độ rộng tương đối (fr), mặc định 1. */
  w?: number;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export interface RowAction {
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface TableFilter {
  key: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}

export interface TableTab {
  key: string;
  label: string;
  count?: number | null;
}

export interface TablePage {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}

/* ---- Ô dựng sẵn ---- */

export function MainCell({ name, sub, avatar, shape = 'round', avatarSrc, icon, seed }: { name: string; sub?: string | null; avatar?: boolean; shape?: 'round' | 'square'; avatarSrc?: string | null; icon?: string; seed?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-[11px]">
      {icon ? (
        <span className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-[#fff1e6] text-brand">
          <MaterialIcon name={icon} size={19} />
        </span>
      ) : (
        avatar !== false && <AdminAvatar name={name} shape={shape} src={avatarSrc} seed={seed} />
      )}
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold">{name}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-stone-400">{sub}</div>}
      </div>
    </div>
  );
}

export const TextCell = ({ children }: { children: ReactNode }) => <span className="truncate text-[13.5px] text-stone-800">{children}</span>;
export const MutedCell = ({ children }: { children: ReactNode }) => <span className="truncate text-[13px] text-stone-500">{children}</span>;
export const NumCell = ({ children }: { children: ReactNode }) => <span className="truncate text-[13.5px] font-semibold tabular-nums">{children}</span>;
export const MonoCell = ({ children }: { children: ReactNode }) => (
  <span className="truncate text-xs text-stone-600" style={{ fontFamily: MONO_FONT }}>
    {children}
  </span>
);

/* ---- Ô tìm kiếm có debounce ---- */

export function SearchInput({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const { t } = useTranslation('admin-parts');
  const [local, setLocal] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  // Đồng bộ khi trang cha reset giá trị (vd. "Xóa bộ lọc").
  useEffect(() => setLocal(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className={`flex h-[38px] min-w-0 flex-1 basis-60 items-center gap-2 rounded-[11px] border-[1.5px] border-[#ece5df] bg-white px-3 focus-within:border-brand ${className}`}>
      <MaterialIcon name="search" size={19} color="#a8a29e" />
      <input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onChange(e.target.value), 350);
        }}
        placeholder={placeholder}
        aria-label={placeholder ?? t('table.search')}
        className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-0"
      />
    </div>
  );
}

/* ---- Phân trang số ---- */

function pageWindow(page: number, total: number): (number | '…')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page, page - 1, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1]! > 1) out.push('…');
    out.push(n);
  });
  return out;
}

export function TablePager({ info }: { info: TablePage }) {
  const { t } = useTranslation('admin-parts');
  const { page, totalPages, onPage } = info;
  const sq = 'grid size-8 place-items-center rounded-[9px] border-[1.5px] border-[#ece5df] bg-white text-[13px] text-stone-700 hover:bg-[#fff4ec] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white';
  return (
    <nav aria-label={t('table.pagination')} className="flex gap-1.5">
      <button type="button" className={sq} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('table.prevPage')}>
        <MaterialIcon name="chevron_left" size={18} />
      </button>
      {pageWindow(page, totalPages).map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="grid size-8 place-items-center text-stone-400">
            …
          </span>
        ) : (
          <button key={n} type="button" onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} className={n === page ? 'grid size-8 place-items-center rounded-[9px] bg-brand font-bold text-white' : sq}>
            {n}
          </button>
        ),
      )}
      <button type="button" className={sq} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label={t('table.nextPage')}>
        <MaterialIcon name="chevron_right" size={18} />
      </button>
    </nav>
  );
}

/* ---- Bảng ---- */

export interface DataTableProps<T> {
  title?: string;
  sub?: string;
  headAction?: ReactNode;
  headLink?: { label: string; onClick: () => void };
  /** Công cụ nhỏ cạnh tiêu đề (vd. nhóm segment). */
  headTools?: ReactNode;
  tabs?: TableTab[];
  tab?: string;
  onTab?: (key: string) => void;
  search?: { value: string; onChange: (v: string) => void; placeholder: string } | null;
  filters?: TableFilter[];
  onClearFilters?: () => void;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRow?: (row: T) => void;
  isActive?: (row: T) => boolean;
  /** Hành động đầu tiên hiện thành nút trong dòng, phần còn lại vào menu "…". */
  actions?: (row: T) => RowAction[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyText?: string;
  page?: TablePage;
  /** Tiêu chí tính cột thao tác: số ký tự của nút đầu dài nhất (để chừa chỗ). */
  footerNote?: string;
  /** Chọn nhiều dòng (checkbox đầu dòng) — dùng cho thao tác hàng loạt; `selected` là danh sách rowKey. */
  select?: { selected: string[]; onChange: (ids: string[]) => void };
  /** Thanh thao tác hàng loạt hiện khi có dòng được chọn. */
  bulkBar?: ReactNode;
}

const actionColWidth = (rows: { label: string }[]) => Math.max(96, Math.ceil(Math.max(0, ...rows.map((r) => r.label.length)) * 7.4 + 26) + 6 + 30) + 12;

export function DataTable<T>(props: DataTableProps<T>) {
  const { title, sub, headAction, headLink, headTools, tabs, tab, onTab, search, filters = [], onClearFilters, columns, rows, rowKey, onRow, isActive, actions, loading, error, onRetry, emptyText, page } = props;
  const { t } = useTranslation('admin-parts');
  const { openMenu, menuEl } = useMenu();

  const firstActions = actions ? rows.map((r) => actions(r)[0]).filter((a): a is RowAction => !!a) : [];
  const actW = actions ? actionColWidth(firstActions) : 0;
  const sel = props.select;
  const selW = sel ? 24 : 0;
  const grid = [...(sel ? [`${selW}px`] : []), ...columns.map((c) => `minmax(${Math.round(96 * (c.w ?? 1))}px,${c.w ?? 1}fr)`), ...(actions ? [`${actW}px`] : [])].join(' ');
  const minW = columns.reduce((a, c) => a + Math.round(96 * (c.w ?? 1)), 0) + actW + (columns.length + (actions ? 1 : 0) + (sel ? 1 : 0)) * 16 + 36 + selW;
  const hasFilter = filters.some((f) => f.value);

  const filterMenu = (e: MouseEvent<HTMLElement>, f: TableFilter) => {
    const items: MenuItem[] = [{ label: t('table.all'), on: !f.value, onClick: () => f.onChange('') }, ...f.options.map((o) => ({ label: o.label, on: f.value === o.value, onClick: () => f.onChange(o.value) }))];
    openMenu(e, items, f.label.toUpperCase(), 230);
  };

  const rowMenu = (e: MouseEvent<HTMLElement>, list: RowAction[]) =>
    openMenu(
      e,
      list.map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, disabled: a.disabled, onClick: a.onClick })),
      undefined,
      220,
    );

  const showHeader = title || headAction || headLink || headTools;
  const showTools = !!search || filters.length > 0 || !!tabs;
  const empty = !loading && !error && rows.length === 0;

  return (
    <section className={`${CARD_CLS} overflow-hidden`}>
      {(showHeader || showTools) && (
        <div className="flex flex-col gap-3 border-b border-[#f1ebe6] px-[18px] py-4">
          {showHeader && (
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                {title && <h2 className="m-0 text-[15px] font-bold">{title}</h2>}
                {sub && <div className="mt-0.5 text-[12.5px] text-stone-400">{sub}</div>}
              </div>
              {headTools}
              {headAction}
              {headLink && (
                <button type="button" onClick={headLink.onClick} className="border-0 bg-transparent p-0 text-[13px] font-semibold text-brand hover:underline">
                  {headLink.label}
                </button>
              )}
            </div>
          )}
          {showTools && (
            <div className="flex flex-wrap items-center gap-3">
              {tabs && (
                <div className="flex flex-wrap gap-1.5" role="tablist">
                  {tabs.map((t) => {
                    const on = t.key === tab;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => onTab?.(t.key)}
                        className={`flex h-8 items-center gap-[7px] rounded-[9px] border-0 px-[11px] text-[13px] font-semibold ${on ? 'bg-[#1c1917] text-white' : 'bg-[#f5f1ed] text-stone-700'}`}
                      >
                        {t.label}
                        {t.count != null && <span className={`rounded-full px-[7px] py-px text-[11px] font-bold ${on ? 'bg-white/[.18] text-white' : 'bg-white text-stone-500'}`}>{fmtNum(t.count)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {(search || filters.length > 0) && (
                <div className={`flex min-w-0 flex-[1_1_320px] flex-wrap items-center gap-2 ${tabs ? 'justify-end' : ''}`}>
                  {search && <SearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} className="max-w-[340px]" />}
                  {filters.map((f) => {
                    const cur = f.options.find((o) => o.value === f.value);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        aria-haspopup="menu"
                        onClick={(e) => filterMenu(e, f)}
                        className={`flex h-[38px] items-center gap-1 rounded-[11px] pr-2.5 pl-3 text-[13px] font-semibold whitespace-nowrap ${cur ? 'border-[1.5px] border-[#fdba74] bg-[#fff4ec] text-[#c2410c]' : 'border-[1.5px] border-[#ece5df] bg-white text-stone-700'}`}
                      >
                        {cur ? `${f.label}: ${cur.label}` : f.label}
                        <MaterialIcon name="expand_more" size={17} />
                      </button>
                    );
                  })}
                  {hasFilter && onClearFilters && (
                    <button type="button" onClick={onClearFilters} className="border-0 bg-transparent px-1 text-[12.5px] font-semibold text-brand hover:underline">
                      {t('table.clearFilters')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {props.bulkBar && sel && sel.selected.length > 0 && <div className="flex flex-wrap items-center gap-2.5 border-b border-[#fdba74] bg-[#fff4ec] px-[18px] py-2.5">{props.bulkBar}</div>}
      {loading && <LoadingBlock />}
      {!loading && !!error && <ErrorBlock error={error} onRetry={onRetry} />}
      {empty && <EmptyBlock>{emptyText ?? t('table.noResults')}</EmptyBlock>}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <div style={{ minWidth: minW }} role="table">
            <div role="row" className="grid items-center gap-4 border-b border-[#f1ebe6] bg-[#fbf9f7] px-[18px] py-2.5" style={{ gridTemplateColumns: grid }}>
              {sel && (
                <input
                  type="checkbox"
                  aria-label={t('table.selectAll')}
                  className="size-4 accent-[#f26a1b]"
                  checked={rows.length > 0 && rows.every((r) => sel.selected.includes(rowKey(r)))}
                  onChange={(e) => sel.onChange(e.target.checked ? rows.map(rowKey) : [])}
                />
              )}
              {columns.map((c) => (
                <span key={c.key} role="columnheader" className={`truncate text-[11.5px] font-bold tracking-[.02em] text-stone-500 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </span>
              ))}
              {actions && (
                <span
                  role="columnheader"
                  aria-label={t('table.actions')}
                  className="sticky right-0 z-[1] -mr-[18px] -ml-3 self-stretch bg-[#fbf9f7] shadow-[-10px_0_12px_-12px_rgba(60,30,10,.35)]"
                />
              )}
            </div>
            {rows.map((r) => {
              const list = actions ? actions(r) : [];
              const first = list[0];
              const more = list.slice(1);
              const active = isActive?.(r);
              const bg = active ? '#fff1e6' : '#fff';
              return (
                <div
                  key={rowKey(r)}
                  role="row"
                  onClick={onRow ? () => onRow(r) : undefined}
                  onKeyDown={onRow ? (e) => e.key === 'Enter' && e.target === e.currentTarget && onRow(r) : undefined}
                  tabIndex={onRow ? 0 : undefined}
                  className={`group grid items-center gap-4 border-b border-[#f6f1ed] px-[18px] py-3 hover:bg-[#fdf9f6] ${onRow ? 'cursor-pointer' : ''}`}
                  style={{ gridTemplateColumns: grid, background: bg, boxShadow: active ? 'inset 3px 0 0 #f26a1b' : undefined }}
                >
                  {sel && (
                    <input
                      type="checkbox"
                      aria-label={t('table.selectRow')}
                      className="size-4 accent-[#f26a1b]"
                      checked={sel.selected.includes(rowKey(r))}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => sel.onChange(e.target.checked ? [...sel.selected, rowKey(r)] : sel.selected.filter((x) => x !== rowKey(r)))}
                    />
                  )}
                  {columns.map((c) => (
                    <div key={c.key} role="cell" className={`flex min-w-0 items-center overflow-hidden ${c.align === 'right' ? 'justify-end' : ''}`}>
                      {c.render(r)}
                    </div>
                  ))}
                  {actions && (
                    <div
                      role="cell"
                      className="sticky right-0 z-[1] -mr-[18px] -ml-3 flex items-center justify-end gap-1.5 self-stretch pr-[18px] pl-3 shadow-[-10px_0_12px_-12px_rgba(60,30,10,.35)] group-hover:!bg-[#fdf9f6]"
                      style={{ background: bg }}
                    >
                      {first && (
                        <button
                          type="button"
                          disabled={first.disabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            first.onClick();
                          }}
                          className={miniBtnCls()}
                        >
                          {first.label}
                        </button>
                      )}
                      {more.length === 0 ? (
                        <span className="size-[30px] flex-none" />
                      ) : (
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-label={t('table.moreActions')}
                          onClick={(e) => rowMenu(e, more)}
                          className="grid size-[30px] flex-none place-items-center rounded-[9px] border border-[#e7e0da] bg-white hover:bg-[#fff4ec]"
                        >
                          <MaterialIcon name="more_horiz" size={18} color="#57534e" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(page || props.footerNote) && !loading && !error && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f1ebe6] px-[18px] py-3 text-[12.5px] text-stone-500">
          <span>
            {props.footerNote ?? (page ? t('table.showing', { shown: fmtNum(rows.length), total: fmtNum(page.total) }) : null)}
          </span>
          {page && page.totalPages > 1 && <TablePager info={page} />}
        </div>
      )}
      {menuEl}
    </section>
  );
}

/** Nhóm segment nhỏ (nền xám, mục chọn nền trắng) dùng cạnh tiêu đề bảng/thẻ. */
export function Segment<T extends string>({ options, value, onChange, small, label }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; small?: boolean; label?: string }) {
  return (
    <div className={`flex flex-wrap rounded-[10px] bg-[#f5f1ed] p-[3px]`} role="tablist" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border-0 font-semibold whitespace-nowrap ${small ? 'px-2.5 py-[5px] text-xs' : 'px-3 py-[7px] text-[12.5px]'} ${on ? 'bg-white text-stone-900 shadow-[0_1px_4px_rgba(0,0,0,.08)]' : 'bg-transparent text-stone-500'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
