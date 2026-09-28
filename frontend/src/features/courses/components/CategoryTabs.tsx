import { useEffect, useRef } from 'react';
import { PathIcon } from '../../../components/ui/icons';
import { ALL_CATEGORY_ICON, CATEGORY_UI } from '../constants';
import type { Category, CategoryId } from '../types';

interface Props {
  categories: Category[];
  active: CategoryId | undefined;
  onChange: (id: CategoryId | undefined) => void;
}

function TabButton({
  label,
  d,
  color,
  on,
  onClick,
  ...rest
}: {
  label: string;
  d: string;
  color: string;
  on: boolean;
  onClick: () => void;
  'data-on'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      {...rest}
      className={`flex h-12 flex-none items-center gap-[clamp(6px,0.6vw,10px)] rounded-[14px] py-0 pr-[clamp(12px,1.1vw,20px)] pl-[clamp(10px,0.9vw,16px)] text-sm font-medium whitespace-nowrap ${
        on
          ? 'bg-brand-gradient border border-white/35 text-white shadow-brand-chip backdrop-blur-[20px] backdrop-saturate-[180%]'
          : 'glass-chip text-stone-900'
      }`}
    >
      <PathIcon
        d={d}
        size={22}
        fill={on ? '#fff' : color}
        stroke={on ? '#fff' : color}
        strokeWidth={1.6}
        className="block flex-none"
      />
      {label}
    </button>
  );
}

export function CategoryTabs({ categories, active, onChange }: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  // Cuộn ngang bằng bánh xe chuột khi danh sách tràn
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Đưa tab đang chọn vào giữa
  useEffect(() => {
    const el = scroller.current;
    const btn = el?.querySelector<HTMLElement>('[data-on="1"]');
    if (el && btn) el.scrollLeft = btn.offsetLeft - el.clientWidth / 2 + btn.offsetWidth / 2;
  }, [active]);

  return (
    <div className="mx-auto flex max-w-[1400px] items-start gap-3 px-4 pt-2.5 md:px-10">
      <div className="flex flex-none items-center gap-3 pt-1.5 pb-3">
        <TabButton
          label="Tất cả"
          {...ALL_CATEGORY_ICON}
          on={active === undefined}
          onClick={() => onChange(undefined)}
        />
        <div className="h-7 w-px bg-[rgba(120,60,20,.15)]" />
      </div>
      <div
        ref={scroller}
        className="no-scrollbar flex min-w-0 flex-1 gap-3 overflow-x-auto scroll-smooth px-0.5 pt-1.5 pb-3 [mask-image:linear-gradient(90deg,#000_calc(100%-48px),transparent)]"
      >
        {categories.map((c) => (
          <TabButton
            key={c.id}
            label={c.name}
            {...CATEGORY_UI[c.id]}
            on={active === c.id}
            data-on={active === c.id ? '1' : '0'}
            onClick={() => onChange(c.id)}
          />
        ))}
      </div>
    </div>
  );
}
