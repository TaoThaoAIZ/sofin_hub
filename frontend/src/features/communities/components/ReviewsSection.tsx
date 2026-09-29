import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { SectionTitle } from '../../../components/ui/SectionTitle';
import { useAuth } from '../../auth/AuthContext';
import { useDeleteMyReview, useDeleteReview, useReviews, useSaveReview } from '../queries';
import { isAtLeast, type Review, type ViewerRole } from '../types';
import { errorText } from './Modal';

const AVATAR_COLORS = ['#fdba74', '#93c5fd', '#86efac', '#c4b5fd', '#fde68a', '#fca5a5', '#a5f3fc'];
const colorFor = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
};

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialIcon key={n} name="star" size={size} filled={n <= value} color={n <= value ? '#f59e0b' : '#d6d3d1'} />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex" role="radiogroup" aria-label="Chọn số sao">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sao`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <MaterialIcon name="star" size={30} filled={n <= value} color={n <= value ? '#f59e0b' : '#d6d3d1'} />
        </button>
      ))}
    </span>
  );
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

/** Phần "Đánh giá từ học viên": dữ liệu thật từ GET /courses/:id/reviews + form của thành viên. */
export function ReviewsSection({
  courseId,
  viewerEnrolled,
  viewerRole,
  fallbackRating,
  fallbackCount,
}: {
  courseId: string;
  viewerEnrolled: boolean;
  viewerRole: ViewerRole | null | undefined;
  fallbackRating: number;
  fallbackCount: number;
}) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const reviews = useReviews(courseId, page);
  const save = useSaveReview(courseId);
  const removeMine = useDeleteMyReview(courseId);
  const removeOther = useDeleteReview(courseId);

  const rows = reviews.data?.data ?? [];
  const mine = user ? rows.find((r) => r.userId === user.id) : undefined;
  const summary = reviews.data?.summary;
  const canModerate = isAtLeast(viewerRole, 'mod');
  const totalPages = reviews.data?.meta.totalPages ?? 1;

  return (
    <div className="glass flex flex-col gap-[22px] rounded-[26px] p-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionTitle>Đánh giá từ học viên</SectionTitle>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[48px] leading-none font-extrabold tracking-[-1px]">{summary?.rating ?? fallbackRating}</span>
        <Stars value={Math.round(summary?.rating ?? fallbackRating)} size={24} />
        <span className="text-[15px] text-stone-600">{summary?.ratingCount ?? fallbackCount} đánh giá</span>
      </div>

      {viewerEnrolled ? (
        // key theo id đánh giá của tôi: khi dữ liệu tải xong/đổi, form nạp lại giá trị mới
        <ReviewForm
          key={mine?.id ?? 'new'}
          mine={mine}
          pending={save.isPending}
          error={save.isError ? errorText(save.error) : null}
          saved={save.isSuccess}
          onSubmit={(rating, text) => save.mutate({ rating, text })}
          onDelete={mine ? () => removeMine.mutate() : undefined}
          deleting={removeMine.isPending}
          deleteError={removeMine.isError ? errorText(removeMine.error) : null}
        />
      ) : (
        <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-stone-600">Tham gia cộng đồng để viết đánh giá của bạn.</p>
      )}

      {reviews.isPending && <p className="text-sm text-stone-500">Đang tải đánh giá…</p>}
      {reviews.isError && <p className="text-sm text-red-600">{errorText(reviews.error, 'Không tải được đánh giá')}</p>}
      {reviews.data && rows.length === 0 && <p className="text-sm text-stone-500">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>}

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-[18px] border border-white/95 bg-white/75 p-[18px] shadow-[0_6px_18px_rgba(120,60,20,.06)]">
            <div className="flex items-center gap-2.5">
              <span className="size-[38px] flex-none rounded-full" style={{ background: colorFor(r.userId) }} />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <b className="text-sm">{r.name}</b>
                <Stars value={r.rating} size={15} />
                <span className="text-xs text-stone-400">{formatDate(r.updatedAt)}</span>
              </div>
              {user && r.userId !== user.id && canModerate && (
                <button
                  type="button"
                  title="Xóa đánh giá này"
                  aria-label="Xóa đánh giá này"
                  disabled={removeOther.isPending}
                  onClick={() => {
                    if (window.confirm(`Xóa đánh giá của ${r.name}?`)) removeOther.mutate(r.id);
                  }}
                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <MaterialIcon name="delete" size={18} color="currentColor" />
                </button>
              )}
            </div>
            {r.text && <p className="mt-3 text-sm leading-[1.6] text-stone-700 text-pretty">{r.text}</p>}
          </div>
        ))}
      </div>
      {removeOther.isError && <p className="text-sm text-red-600">{errorText(removeOther.error)}</p>}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="h-9 rounded-xl border border-[rgba(120,60,20,.15)] bg-white px-3 font-semibold disabled:opacity-40"
          >
            Trước
          </button>
          <span className="text-stone-600">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="h-9 rounded-xl border border-[rgba(120,60,20,.15)] bg-white px-3 font-semibold disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewForm({
  mine,
  pending,
  error,
  saved,
  onSubmit,
  onDelete,
  deleting,
  deleteError,
}: {
  mine: Review | undefined;
  pending: boolean;
  error: string | null;
  saved: boolean;
  onSubmit: (rating: number, text: string) => void;
  onDelete?: () => void;
  deleting: boolean;
  deleteError: string | null;
}) {
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [text, setText] = useState(mine?.text ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (rating < 1) {
      setLocalError('Vui lòng chọn số sao (1–5)');
      return;
    }
    setLocalError(null);
    onSubmit(rating, text.trim());
  };

  return (
    <div className="rounded-[18px] border border-brand/15 bg-white/70 p-[18px]">
      <div className="text-[15px] font-bold">{mine ? 'Đánh giá của bạn' : 'Viết đánh giá'}</div>
      <div className="mt-2">
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Chia sẻ trải nghiệm của bạn (không bắt buộc)…"
        className="mt-2 w-full resize-none rounded-xl border border-[rgba(120,60,20,.15)] bg-white/90 px-3.5 py-2.5 text-sm outline-0 focus:border-brand"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending} className="h-10 rounded-xl px-5 text-sm font-bold">
          {pending ? 'Đang gửi…' : mine ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
        </Button>
        {onDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (window.confirm('Xóa đánh giá của bạn?')) onDelete();
            }}
            className="h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? 'Đang xóa…' : 'Xóa đánh giá'}
          </button>
        )}
        {saved && !error && !pending && <span className="text-sm text-green-700">Đã lưu đánh giá</span>}
      </div>
      {(localError || error || deleteError) && <p className="mt-2 text-sm font-medium text-red-600">{localError ?? error ?? deleteError}</p>}
    </div>
  );
}
