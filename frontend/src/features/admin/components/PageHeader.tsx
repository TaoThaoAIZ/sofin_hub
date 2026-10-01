import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { matchNav, type Crumb } from '../nav';

export type RangeDays = 7 | 30 | 90;
export const RANGES: { value: RangeDays; label: string }[] = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
];

/** Nhóm chip khoảng thời gian của bản thiết kế (nền trắng bo 12, mục chọn nền trắng đổ bóng). Backend hỗ trợ 7/30/90 ngày. */
export function DateRangeChips({ value, onChange }: { value: RangeDays; onChange: (v: RangeDays) => void }) {
  return (
    <div className="flex rounded-xl border-[1.5px] border-[#ece5df] bg-white p-1" role="tablist" aria-label="Khoảng thời gian">
      {RANGES.map((r) => {
        const on = r.value === value;
        return (
          <button
            key={r.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(r.value)}
            className={`rounded-lg border-0 px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap ${on ? 'bg-[#fff1e6] text-[#c2410c]' : 'bg-transparent text-stone-500 hover:text-stone-800'}`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/** Breadcrumb + tiêu đề + phụ đề + khu vực nút/khoảng thời gian — dùng ở đầu mọi trang admin. */
export function PageHeader({ title, subtitle, actions, trail }: { title: string; subtitle?: string; actions?: ReactNode; trail?: Crumb[] }) {
  const { pathname } = useLocation();
  const { group, kid } = matchNav(pathname);
  const crumbs: Crumb[] = [{ label: 'Quản trị', to: '/admin' }];
  if (group.key !== 'dash') {
    crumbs.push({ label: group.label, to: group.kids?.[0]?.to });
    if (trail) crumbs.push(...trail);
    else if (kid) crumbs.push({ label: kid.label });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12.5px] text-stone-400">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <MaterialIcon name="chevron_right" size={16} color="#d6d3d1" />}
              {c.to && !last ? (
                <Link to={c.to} className="font-medium text-stone-400 hover:text-brand">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'font-semibold text-stone-600' : 'font-medium'}>
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-60 flex-1">
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-.025em]">{title}</h1>
          {subtitle && <p className="mt-[5px] mb-0 text-sm text-pretty text-stone-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}
