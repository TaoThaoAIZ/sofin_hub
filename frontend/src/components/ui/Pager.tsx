import { MaterialIcon } from './MaterialIcon';

/** Phân trang đơn giản (Trước / Trang x/y / Sau) dùng cho các trang danh sách. */
export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Trang trước"
        className="grid size-9 place-items-center rounded-full border border-[rgba(120,60,20,.12)] bg-white disabled:opacity-40"
      >
        <MaterialIcon name="chevron_left" size={20} />
      </button>
      <span className="text-stone-600">
        Trang <b>{page}</b> / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Trang sau"
        className="grid size-9 place-items-center rounded-full border border-[rgba(120,60,20,.12)] bg-white disabled:opacity-40"
      >
        <MaterialIcon name="chevron_right" size={20} />
      </button>
    </div>
  );
}
