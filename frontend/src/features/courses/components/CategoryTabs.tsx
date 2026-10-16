import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PathIcon } from '../../../components/ui/icons';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ThemedImg } from '../../../components/ui/ThemedImg';
import { ALL_CATEGORY_ICON } from '../constants';
import type { Category, CategoryId } from '../types';

interface Props {
  categories: Category[];
  active: CategoryId | undefined;
  onChange: (id: CategoryId | undefined) => void;
  /** Mobile: bật/tắt hàng bộ lọc (nút tròn ở cuối hàng danh mục). */
  onToggleFilters?: () => void;
  filtersOpen?: boolean;
}

const CATEGORY_ICON_NAME: Record<CategoryId, string> = {
  business: 'cat1',
  content: 'cat2',
  tech: 'cat3',
  finance: 'cat4',
  health: 'cat5',
  self: 'cat6',
  hobby: 'cat7',
  relationships: 'cat8',
};

/** Danh mục chưa có icon trong Figma (Âm nhạc, Thể thao, Tâm linh...): dùng icon Material Symbols + màu nhấn; id lạ -> icon chung. */
const FALLBACK_ICON: Record<string, { name: string; color: string }> = {
  music: { name: 'music_note', color: '#a855f7' },
  sports: { name: 'sports_soccer', color: '#22c55e' },
  spirituality: { name: 'self_improvement', color: '#06b6d4' },
};

function CategoryIcon({ id }: { id: string }) {
  const figma = (CATEGORY_ICON_NAME as Record<string, string | undefined>)[id];
  if (figma) return <ThemedImg name={figma} className="size-6 flex-none max-md:size-4" />;
  const f = FALLBACK_ICON[id] ?? { name: 'category', color: '#ff570a' };
  return (
    <span className="cat-fallback grid size-6 flex-none place-items-center max-md:size-4 max-md:scale-[.67]" style={{ color: f.color }}>
      <MaterialIcon name={f.name} size={24} color="currentColor" />
    </span>
  );
}

/** Chip danh mục (Figma "Course category"): cao 60px, bo 20px, trắng + bóng mềm; đang chọn = cam, icon chuyển trắng. */
function TabButton({
  label,
  icon,
  on,
  onClick,
  ...rest
}: {
  label: string;
  icon: ReactNode;
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
      className={`flex h-[clamp(48px,3.33vw,60px)] flex-none items-center justify-center gap-[clamp(8px,0.78vw,14px)] rounded-[20px] px-[clamp(14px,1.1vw,20px)] text-[clamp(14px,1vw,18px)] leading-normal whitespace-nowrap max-md:h-auto max-md:gap-1.5 max-md:rounded-[32px] max-md:px-3 max-md:py-[7px] max-md:text-sm max-md:leading-5 max-md:shadow-none ${
        on
          ? 'bg-brand font-bold text-white shadow-[0_8px_30px_rgba(159,126,103,0.06)] [&_img]:brightness-0 [&_img]:invert [&_.cat-fallback]:!text-white'
          : 'bg-white font-medium text-[#201e1c] shadow-soft max-md:bg-[rgba(124,124,124,.1)] max-md:font-semibold max-md:text-[#626262] dark:bg-[rgba(63,63,63,.3)] dark:text-white max-md:dark:bg-white/10 max-md:dark:text-[#e8e8e8]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function CategoryTabs({ categories, active, onChange, onToggleFilters, filtersOpen }: Props) {
  const { t } = useTranslation('course');
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
    <div className="relative flex h-[clamp(76px,5.56vw,100px)] items-center gap-[15px] max-md:h-14 max-md:gap-1.5">
      <div className="flex flex-none items-center gap-[15px]">
        <TabButton
          label={t('list.all')}
          icon={
            active === undefined ? (
              <ThemedImg name="cat0" className="size-6 max-md:size-4" />
            ) : (
              <PathIcon d={ALL_CATEGORY_ICON.d} size={24} fill={ALL_CATEGORY_ICON.color} stroke={ALL_CATEGORY_ICON.color} strokeWidth={1.6} className="block flex-none" />
            )
          }
          on={active === undefined}
          onClick={() => onChange(undefined)}
        />
        <div className="h-[34px] w-px bg-[#eee5de] dark:bg-white/15" />
      </div>
      <div
        ref={scroller}
        className="no-scrollbar flex min-w-0 flex-1 gap-[15px] overflow-x-auto scroll-smooth py-5 [mask-image:linear-gradient(90deg,#000_calc(100%-70px),transparent)] max-md:gap-1.5 max-md:py-2 max-md:pr-12"
      >
        {categories.map((c) => (
          <TabButton
            key={c.id}
            label={c.name}
            icon={<CategoryIcon id={c.id} />}
            on={active === c.id}
            data-on={active === c.id ? '1' : '0'}
            onClick={() => onChange(c.id)}
          />
        ))}
      </div>
      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          aria-pressed={filtersOpen}
          aria-label="Bộ lọc"
          className={`absolute top-1/2 right-0 grid -translate-y-1/2 place-items-center rounded-[32px] p-[7px] shadow-soft md:hidden ${filtersOpen ? 'bg-brand text-white' : 'bg-[#cfcfcf] text-[#201e1c] dark:bg-white/20 dark:text-white'}`}
        >
          <MaterialIcon name="tune" size={20} color="currentColor" />
        </button>
      )}
    </div>
  );
}
