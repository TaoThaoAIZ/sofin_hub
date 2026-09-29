import { useState } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { formatDate } from '../../../lib/datetime';
import { messageErrorText, useBlocks, useBlockToggle } from '../queries';

export function BlockedUsersDialog({ onClose }: { onClose: () => void }) {
  const blocks = useBlocks();
  const toggle = useBlockToggle();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Người dùng đã chặn">
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Người dùng đã chặn</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-stone-500 hover:text-stone-900">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        {blocks.isPending && <p className="py-8 text-center text-stone-400">Đang tải…</p>}
        {blocks.isError && <p className="py-8 text-center text-red-600">Không tải được danh sách.</p>}
        {blocks.data?.length === 0 && <p className="py-8 text-center text-stone-500">Bạn chưa chặn ai.</p>}
        <ul className="mt-2 max-h-[50vh] divide-y divide-[rgba(120,60,20,.07)] overflow-y-auto">
          {blocks.data?.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{b.name}</div>
                <div className="text-[12px] text-stone-500">Chặn từ {formatDate(b.blockedAt)}</div>
              </div>
              <button
                type="button"
                disabled={toggle.isPending}
                onClick={() => {
                  setError(null);
                  toggle.mutate({ userId: b.id, block: false }, { onError: (e) => setError(messageErrorText(e)) });
                }}
                className="h-9 rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-[13px] font-medium hover:bg-[#fff7f0] disabled:opacity-50"
              >
                Bỏ chặn
              </button>
            </li>
          ))}
        </ul>
        {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}
      </div>
    </div>
  );
}
