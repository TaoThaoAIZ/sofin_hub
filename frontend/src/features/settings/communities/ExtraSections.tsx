import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { usePopup } from '../../../components/ui/usePopup';
import { ApiError } from '../../../lib/api';
import i18n, { currentLocale } from '../../../i18n';
import { useMyPoints } from '../../account/queries';
import { reasonLabel, formatDate } from '../../account/roles';
import { useToast } from '../../admin/components/overlay';
import { useDeleteDraft, useMyDrafts } from '../../wizard/queries';
import { CommunityLogo, OUTLINE_BTN, PRIMARY_BTN, SCard, SHead } from '../ui';
import { agoText } from './format';
import { useCancelJoinRequest, usePendingItems } from './queries';
import type { MyCommunity } from './api';

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : i18n.t('communities.errGeneric', { ns: 'settings' }));

/** "Đang chờ": yêu cầu gia nhập do chính mình gửi (lời mời là link chung nên không có hộp thư theo người dùng). */
export function PendingSection() {
  const { t } = useTranslation('settings');
  const q = usePendingItems();
  const cancel = useCancelJoinRequest();
  const toast = useToast();
  const requests = q.data?.requests ?? [];
  return (
    <SCard className="col-span-full">
      <SHead size="lg" icon="schedule" title={t('communities.pending.title')} sub={t('communities.pending.sub')} className="mb-4" />
      {requests.length > 0 && (
        <div className="rounded-2xl border border-[#f0ebe6] px-4">
          {requests.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-4 border-b border-[#f3eee9] py-3.5 last:border-b-0">
              <CommunityLogo name={p.title} seed={p.communityId} size={52} src={p.logoUrl} />
              <div className="min-w-[200px] flex-1">
                <Link to={`/courses/${p.communityId}`} className="text-base font-bold text-stone-900 no-underline">
                  {p.title}
                </Link>
                <div className="mt-[3px] text-sm text-stone-500">{t('communities.pending.requested', { ago: agoText(p.createdAt) })}</div>
              </div>
              <button
                type="button"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(p.id, { onSuccess: () => toast.success(t('communities.pending.cancelledToast', { title: p.title })), onError: (e) => toast.error(errMsg(e)) })}
                className={`${OUTLINE_BTN} h-11 min-w-[200px] whitespace-nowrap`}
              >
                {t('communities.pending.cancel')}
              </button>
            </div>
          ))}
        </div>
      )}
      {q.isPending && <div className="px-2.5 py-6 text-center text-[14.5px] text-stone-500">{t('communities.pending.loading')}</div>}
      {q.isError && <div role="alert" className="px-2.5 py-6 text-center text-[14.5px] text-red-600">{errMsg(q.error)}</div>}
      {q.data && requests.length === 0 && <div className="px-2.5 py-6 text-center text-[14.5px] text-stone-500">{t('communities.pending.empty')}</div>}
    </SCard>
  );
}

/** Bản nháp cộng đồng (wizard tạo cộng đồng) — chuyển từ trang "Cộng đồng của tôi" cũ. */
export function DraftsSection() {
  const { t } = useTranslation('settings');
  const drafts = useMyDrafts();
  const del = useDeleteDraft();
  const { confirm } = usePopup();
  const toast = useToast();
  if (!drafts.data || drafts.data.length === 0) return null;
  return (
    <SCard className="col-span-full" >
      <SHead size="lg" icon="edit_note" title={t('communities.drafts.title')} sub={t('communities.drafts.sub')} className="mb-4" />
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {drafts.data.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f0ebe6] p-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{d.basics.title || t('communities.drafts.untitled')}</div>
              <div className="mt-0.5 text-[13px] text-stone-500">
                {t('communities.drafts.progress', { done: d.completedSteps.length, date: formatDate(d.updatedAt) })}
              </div>
            </div>
            <Link to={`/communities/new?draft=${encodeURIComponent(d.id)}`} className={`${PRIMARY_BTN} h-11 px-[18px] text-sm no-underline`}>
              {t('communities.drafts.continue')}
            </Link>
            <button
              type="button"
              disabled={del.isPending}
              onClick={async () => {
                if (await confirm({ title: t('communities.drafts.deleteTitle'), message: t('communities.drafts.deleteMsg'), tone: 'danger', confirmText: t('communities.drafts.deleteConfirm') })) {
                  del.mutate(d.id, { onSuccess: () => toast.success(t('communities.drafts.deletedToast')), onError: (e) => toast.error(errMsg(e)) });
                }
              }}
              className={`${OUTLINE_BTN} h-11 hover:text-red-600`}
            >
              {t('communities.drafts.deleteConfirm')}
            </button>
          </li>
        ))}
      </ul>
    </SCard>
  );
}

/** Điểm của tôi — chuyển từ trang cũ (tổng điểm, điểm theo cộng đồng, hoạt động gần đây). */
export function PointsSection({ communities }: { communities: MyCommunity[] }) {
  const { t } = useTranslation('settings');
  const points = useMyPoints();
  const titleById = new Map(communities.map((c) => [c.id, c.title]));
  const p = points.data;
  return (
    <SCard className="col-span-full">
      <SHead size="lg" icon="military_tech" title={t('communities.points.title')} sub={t('communities.points.sub')} className="mb-4" />
      {points.isPending && <p className="m-0 text-sm text-stone-500">{t('communities.points.loading')}</p>}
      {points.isError && <p role="alert" className="m-0 text-sm text-red-600">{errMsg(points.error)}</p>}
      {p && (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="rounded-2xl border border-[#f0ebe6] p-4">
            <div className="text-4xl font-extrabold text-brand">{p.total}</div>
            <div className="text-sm text-stone-500">{t('communities.points.total')}</div>
            {p.byCourse.length > 0 && (
              <ul className="mt-3 mb-0 flex list-none flex-col gap-2 p-0 text-sm">
                {p.byCourse.map((b) => (
                  <li key={b.course.id} className="flex justify-between gap-3">
                    <Link to={`/communities/${b.course.id}/community`} className="min-w-0 truncate text-stone-800">
                      {'title' in b.course ? b.course.title : (titleById.get(b.course.id) ?? t('communities.points.community'))}
                    </Link>
                    <b>{b.points}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-[#f0ebe6] p-4">
            <div className="mb-2 flex items-center gap-2 font-bold">
              <MaterialIcon name="history" size={20} color="#f26a1b" />
              {t('communities.points.recent')}
            </div>
            {p.recent.length === 0 ? (
              <p className="m-0 text-sm text-stone-500">{t('communities.points.none')}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-stone-200/70 p-0 text-sm">
                {p.recent.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium">{reasonLabel(e.reason)}</div>
                      <div className="truncate text-xs text-stone-500">
                        {titleById.get(e.courseId) ?? t('communities.points.community')} · {new Date(e.createdAt).toLocaleString(currentLocale())}
                      </div>
                    </div>
                    <b className="text-brand">+{e.points}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SCard>
  );
}
