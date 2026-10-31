import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ThemedImg } from '../../../components/ui/ThemedImg';
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
        className={`flex h-[clamp(42px,2.78vw,50px)] min-w-[clamp(92px,6vw,108px)] items-center justify-between gap-3 rounded-[18px] px-[clamp(16px,1.2vw,22px)] text-[clamp(14px,1vw,18px)] leading-normal font-medium whitespace-nowrap shadow-soft ${
          active
            ? 'bg-brand-soft text-brand ring-1 ring-brand/50 dark:bg-[rgba(255,87,10,.16)]'
            : 'bg-white text-[#201e1c] dark:bg-[rgba(63,63,63,.3)] dark:text-white'
        } ${open && !active ? 'ring-1 ring-brand/50' : ''}`}
      >
        {t(selected?.labelKey ?? def.labelKey)}
        <ThemedImg name="expand" className="size-5 flex-none" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-[calc(100%+8px)] left-0 z-10 flex min-w-[200px] flex-col rounded-[18px] border border-white bg-white p-1.5 shadow-soft-lg dark:border-white/10 dark:bg-[#1b1f22]"
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
                className={`flex h-10 items-center justify-between gap-4 rounded-[10px] px-3 text-left text-sm whitespace-nowrap hover:bg-[rgba(255,87,10,.1)] ${
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
      className={`grid size-[clamp(40px,2.78vw,50px)] place-items-center rounded-2xl ${on ? 'bg-brand [&_img]:brightness-0 [&_img]:invert' : 'text-[#201e1c] dark:text-white [&_img]:brightness-0 dark:[&_img]:invert'}`}
    >
      {children}
    </button>
  );
}

export function FilterBar({ filters, onFilterChange, view, onViewChange, total }: Props) {
  const { t } = useTranslation('course');
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="relative z-20 flex min-h-[60px] flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-start gap-[15px]">
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
      </div>

      <div className="ml-auto flex items-center gap-[clamp(14px,1.4vw,25px)]">
        <div className="flex gap-[5px] rounded-[20px] bg-white p-[5px] shadow-soft dark:bg-[rgba(63,63,63,.3)]">
          <ViewButton on={view === 'grid'} title={t('list.grid')} onClick={() => onViewChange('grid')}>
            <ThemedImg name="grid" className="size-6" />
          </ViewButton>
          <ViewButton on={view === 'list'} title={t('list.listView')} onClick={() => onViewChange('list')}>
            <ThemedImg name="menu" className="size-[22px]" />
          </ViewButton>
        </div>
        <span className="text-[clamp(14px,1vw,18px)] whitespace-nowrap text-[#625e5a] dark:text-[#bababa]">
          <Trans t={t} i18nKey="list.found" values={{ total: total ?? '–' }} components={{ b: <b className="text-brand" /> }} />
        </span>
      </div>
    </div>
  );
}
