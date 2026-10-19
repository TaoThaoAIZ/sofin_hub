import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { SectionTitle } from '../../../components/ui/SectionTitle';
import { Avatar } from '../../account/components/Avatar';
import { useAuth } from '../../auth/AuthContext';
import { useDeleteMyReview, useDeleteReview, useReviews, useSaveReview } from '../queries';
import { isAtLeast, type Review, type ViewerRole } from '../types';
import { errorText } from './Modal';
import { usePopup } from '../../../components/ui/usePopup';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const { t } = useTranslation('communities');
  return (
    <span className="inline-flex" aria-label={t('reviews.stars', { value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialIcon key={n} name="star" size={size} filled={n <= value} color={n <= value ? '#f59e0b' : '#d6d3d1'} />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useTranslation('communities');
  return (
    <span className="inline-flex" role="radiogroup" aria-label={t('reviews.pickStars')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('reviews.starsN', { n })}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <MaterialIcon name="star" size={30} filled={n <= value} color={n <= value ? '#f59e0b' : '#d6d3d1'} />
        </button>
      ))}
    </span>
  );
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(currentLocale());

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
  const { t } = useTranslation('communities');
  const { confirm } = usePopup();
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
    <div className="flex flex-col gap-5 rounded-[26px] bg-white p-6 shadow-[1px_6px_15px_rgba(121,81,54,0.1)] dark:bg-[rgba(63,63,63,.3)] dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionTitle>{t('reviews.title')}</SectionTitle>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[46px] leading-[46px] font-extrabold">{summary?.rating ?? fallbackRating}</span>
        <Stars value={Math.round(summary?.rating ?? fallbackRating)} size={24} />
        <span className="text-[15px] text-stone-600">{t('reviews.count', { count: summary?.ratingCount ?? fallbackCount })}</span>
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
        <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-stone-600">{t('reviews.joinToReview')}</p>
      )}

      {reviews.isPending && <p className="text-sm text-stone-500">{t('reviews.loading')}</p>}
      {reviews.isError && <p className="text-sm text-red-600">{errorText(reviews.error, t('reviews.loadError'))}</p>}
      {reviews.data && rows.length === 0 && <p className="text-sm text-stone-500">{t('reviews.empty')}</p>}

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-[18px] border border-white/95 bg-white/75 p-[18px] shadow-[0_6px_18px_rgba(120,60,20,.06)]">
            <div className="flex items-center gap-2.5">
              <Avatar url={r.avatarUrl} name={r.name} size={38} />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <b className="text-sm">{r.name}</b>
                <Stars value={r.rating} size={15} />
                <span className="text-xs text-stone-400">{formatDate(r.updatedAt)}</span>
              </div>
              {user && r.userId !== user.id && canModerate && (
                <button
                  type="button"
                  title={t('reviews.deleteThis')}
                  aria-label={t('reviews.deleteThis')}
                  disabled={removeOther.isPending}
                  onClick={async () => {
                    if (await confirm({ title: t('reviews.deleteOfTitle', { name: r.name }), tone: 'danger', confirmText: t('reviews.delete') })) removeOther.mutate(r.id);
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
            {t('reviews.prev')}
          </button>
          <span className="text-stone-600">
            {t('reviews.page', { page, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="h-9 rounded-xl border border-[rgba(120,60,20,.15)] bg-white px-3 font-semibold disabled:opacity-40"
          >
            {t('reviews.next')}
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
  const { t } = useTranslation('communities');
  const { confirm } = usePopup();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [text, setText] = useState(mine?.text ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (rating < 1) {
      setLocalError(t('reviews.pickError'));
      return;
    }
    setLocalError(null);
    onSubmit(rating, text.trim());
  };

  return (
    <div className="rounded-[17px] border border-[#e4e4e4] p-4 dark:border-white/10">
      <div className="text-[15px] font-bold">{mine ? t('reviews.yours') : t('reviews.write')}</div>
      <div className="mt-2">
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={t('reviews.placeholder')}
        className="mt-2 w-full resize-none rounded-[11px] border border-[#e4e4e4] bg-transparent px-[13px] py-2 text-[13px] outline-0 placeholder:text-[#999] focus:border-brand dark:border-white/10"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending} className="h-9 rounded-[11px] bg-[#ff6815] px-4 text-[13px] font-bold shadow-[0_5px_12px_rgba(244,119,35,0.15)]">
          {pending ? t('reviews.sending') : mine ? t('reviews.update') : t('reviews.submit')}
        </Button>
        {onDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (await confirm({ title: t('reviews.deleteMineTitle'), tone: 'danger', confirmText: t('reviews.delete') })) onDelete();
            }}
            className="h-9 rounded-[11px] border border-[#ffbcbc] px-4 text-[13px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? t('reviews.deleting') : t('reviews.deleteMine')}
          </button>
        )}
        {saved && !error && !pending && <span className="text-sm text-green-700">{t('reviews.saved')}</span>}
      </div>
      {(localError || error || deleteError) && <p className="mt-2 text-sm font-medium text-red-600">{localError ?? error ?? deleteError}</p>}
    </div>
  );
}
