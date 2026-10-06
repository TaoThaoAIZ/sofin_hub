import { useTranslation } from 'react-i18next';

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/** 1 2 3 … N — luôn hiện trang đầu, cuối và lân cận trang hiện tại. */
function pageItems(page: number, total: number): (number | '…')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) out.push('…');
    out.push(n);
  });
  return out;
}

const btn = (on: boolean) =>
  `grid h-10 min-w-10 place-items-center rounded-[10px] px-3 text-sm font-semibold ${
    on ? 'bg-brand-gradient border border-white/35 text-white backdrop-blur-[20px]' : 'glass-chip text-stone-900'
  }`;

export function Pagination({ page, totalPages, onChange }: Props) {
  const { t } = useTranslation('course');
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={t('list.pagination')}
      className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-2 px-4 pt-10 pb-14 md:px-10"
    >
      <button
        type="button"
        aria-label={t('list.prevPage')}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className={`${btn(false)} disabled:opacity-40`}
      >
        ←
      </button>

      {pageItems(page, totalPages).map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="grid h-10 min-w-10 place-items-center text-sm font-medium text-stone-500">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onChange(n)}
            className={btn(n === page)}
          >
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label={t('list.nextPage')}
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className={`${btn(false)} disabled:opacity-40`}
      >
        →
      </button>
    </nav>
  );
}
