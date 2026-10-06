import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ChevronDownIcon, GridIcon, ListIcon } from '../../../components/ui/icons';
import { FILTER_DROPDOWNS, type FilterDropdown } from '../constants';
import type { CourseFilters } from '../types';

export type ViewMode = 'grid' | 'list';

interface Props {
  filters: CourseFilters;
  onFilterChange: <K extends keyof CourseFilters>(key: K, value: CourseFilters[K]) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  total: number | undefined;
}

function Dropdown({
  def,
  value,
  open,
  onToggle,
  onClose,
  onPick,
}: {
  def: FilterDropdown;
  value: string | undefined;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (value: string | undefined) => void;
}) {
  const { t } = useTranslation('course');
  const ref = useRef<HTMLDivElement>(null);
  const selected = def.options.find((o) => o.value === value);
  const active = !!selected;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`glass-chip flex h-10 items-center gap-3.5 rounded-xl py-0 pr-4 pl-[18px] text-sm font-medium whitespace-nowrap ${
          active ? 'text-brand [--chip-bg:rgba(255,237,224,.6)]' : 'text-stone-900'
        } ${active || open ? '[--chip-border:rgba(242,106,27,.55)]' : ''}`}
      >
        {t(selected?.labelKey ?? def.labelKey)}
        <ChevronDownIcon size={14} />
      </button>

      {open && (
        <div
          role="listbox"
          className="glass absolute top-[50px] left-0 flex min-w-[200px] flex-col rounded-[18px] p-1.5 [--glass-bg:rgba(255,255,255,.72)]"
        >
          {def.options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onPick(on ? undefined : o.value)}
                className={`flex h-10 items-center justify-between gap-4 rounded-[10px] px-3 text-left text-sm whitespace-nowrap hover:bg-[rgba(242,106,27,.1)] ${
                  on ? 'bg-brand-soft font-semibold text-brand' : 'font-medium text-stone-900'
                }`}
              >
                {t(o.labelKey)}
                <span className={on ? 'text-brand' : 'invisible'}>✓</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ViewButton({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      onClick={onClick}
      className={`grid size-10 place-items-center rounded-[10px] border border-transparent ${
        on ? 'bg-brand-gradient text-white shadow-brand-chip' : 'text-stone-900'
      }`}
    >
      {children}
    </button>
  );
}

export function FilterBar({ filters, onFilterChange, view, onViewChange, total }: Props) {
  const { t } = useTranslation('course');
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="relative z-[5] mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 md:px-10">
      {FILTER_DROPDOWNS.map((def) => (
        <Dropdown
          key={def.key}
          def={def}
          value={filters[def.key]}
          open={openKey === def.key}
          onToggle={() => setOpenKey(openKey === def.key ? null : def.key)}
          onClose={() => setOpenKey((k) => (k === def.key ? null : k))}
          onPick={(v) => {
            onFilterChange(def.key, v as never);
            setOpenKey(null);
          }}
        />
      ))}

      <div className="ml-auto flex items-center gap-5">
        <div className="glass flex gap-1 rounded-2xl p-1">
          <ViewButton on={view === 'grid'} title={t('list.grid')} onClick={() => onViewChange('grid')}>
            <GridIcon size={18} />
          </ViewButton>
          <ViewButton on={view === 'list'} title={t('list.listView')} onClick={() => onViewChange('list')}>
            <ListIcon size={18} />
          </ViewButton>
        </div>
        <span className="text-sm whitespace-nowrap text-stone-600">
          <Trans t={t} i18nKey="list.found" values={{ total: total ?? '–' }} components={{ b: <b className="text-brand" /> }} />
        </span>
      </div>
    </div>
  );
}
