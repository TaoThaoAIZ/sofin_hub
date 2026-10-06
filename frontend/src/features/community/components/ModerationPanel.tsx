import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Pager } from '../../../components/ui/Pager';
import { useCommunityDetail } from '../../courses/queries';
import { useReports, useResolveReport } from '../queries';
import { reportReasonLabel, type Report, type ReportAction, type ReportStatus } from '../types';
import { areaCls, ConfirmDialog, errText, ErrorNote, fmtDateTime, ghostBtn, isModPlus, toast, ToastHost } from './contentUi';
import { PageBanner } from './shared';

const STATUS_TABS: ReadonlyArray<ReportStatus | 'all'> = ['open', 'resolved', 'dismissed', 'all'];

function ReportCard({ report, courseId }: { report: Report; courseId: string | null }) {
  const { t } = useTranslation('community');
  const resolve = useResolveReport(courseId);
  const [note, setNote] = useState('');
  const [confirmBan, setConfirmBan] = useState(false);
  const open = report.status === 'open';
  const cid = report.courseId ?? courseId;

  const run = (action: ReportAction) =>
    resolve.mutate(
      { reportId: report.id, action, note: note.trim() },
      {
        onSuccess: () => {
          setConfirmBan(false);
          toast(action === 'dismiss' ? t('moderation.toastDismiss') : action === 'hide_content' ? t('moderation.toastHide') : t('moderation.toastBan'));
        },
      },
    );

  return (
    <article className="rounded-2xl border border-[rgba(120,60,20,.1)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="rounded-lg bg-brand/10 px-2 py-0.5 font-bold text-brand">{t(`moderation.target.${report.targetType}`)}</span>
        <span className="rounded-lg bg-stone-100 px-2 py-0.5 font-semibold text-stone-700">{reportReasonLabel(report.reason)}</span>
        {report.courseTitle && <span className="text-stone-500">{report.courseTitle}</span>}
        <span className="ml-auto text-stone-400">{fmtDateTime(report.createdAt)}</span>
        <span
          className={`rounded-lg px-2 py-0.5 font-semibold ${
            report.status === 'open' ? 'bg-amber-100 text-amber-800' : report.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
          }`}
        >
          {t(`moderation.status.${report.status}`)}
        </span>
      </div>

      <blockquote className="mx-0 my-3 rounded-xl border-l-4 border-brand/40 bg-[#fbf9f7] px-3.5 py-2.5 text-[13.5px] break-words whitespace-pre-wrap text-stone-800">
        {report.targetExcerpt || <span className="text-stone-400">{t('moderation.noSnapshot')}</span>}
      </blockquote>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-stone-500">
        {report.targetUserName && (
          <span>
            {t('moderation.subject')} <b className="text-stone-700">{report.targetUserName}</b>
          </span>
        )}
        {report.reporterName && (
          <span>
            {t('moderation.reporter')} <b className="text-stone-700">{report.reporterName}</b>
          </span>
        )}
        {report.targetType === 'post' && cid && (
          <Link to={`/communities/${cid}/community?post=${report.targetId}`} className="font-semibold text-brand hover:underline">
            {t('moderation.viewPost')}
          </Link>
        )}
      </div>
      {report.detail && <p className="mt-2 mb-0 text-[13px] text-stone-600">{t('moderation.detail', { detail: report.detail })}</p>}

      {open ? (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-[rgba(120,60,20,.08)] pt-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={t('moderation.notePlaceholder')} aria-label={t('moderation.noteAria')} className={areaCls} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={resolve.isPending} onClick={() => run('dismiss')} className={ghostBtn}>
              <MaterialIcon name="do_not_disturb_on" size={18} /> {t('moderation.dismissBtn')}
            </button>
            {report.targetType !== 'member' && (
              <button type="button" disabled={resolve.isPending} onClick={() => run('hide_content')} className={ghostBtn}>
                <MaterialIcon name="visibility_off" size={18} /> {t('moderation.hideBtn')}
              </button>
            )}
            <button type="button" disabled={resolve.isPending} onClick={() => setConfirmBan(true)} className={`${ghostBtn} !text-red-600`}>
              <MaterialIcon name="gavel" size={18} color="#dc2626" /> {t('moderation.banBtn')}
            </button>
          </div>
          <ErrorNote message={resolve.isError && !confirmBan ? errText(resolve.error) : null} />
        </div>
      ) : (
        <div className="mt-3 border-t border-[rgba(120,60,20,.08)] pt-3 text-[12.5px] text-stone-500">
          {report.action && <b className="text-stone-700">{t(`moderation.action.${report.action}`)}</b>}
          {report.resolvedAt && ` · ${fmtDateTime(report.resolvedAt)}`}
          {report.note && <span>{t('moderation.note', { note: report.note })}</span>}
        </div>
      )}

      {confirmBan && (
        <ConfirmDialog
          title={t('moderation.banTitle')}
          message={t('moderation.banMessage', { name: report.targetUserName ?? t('moderation.thisMember') })}
          confirmLabel={t('moderation.banBtn')}
          pending={resolve.isPending}
          error={resolve.isError ? errText(resolve.error) : null}
          onClose={() => setConfirmBan(false)}
          onConfirm={() => run('ban_member')}
        />
      )}
    </article>
  );
}

/** Hàng đợi báo cáo. `courseId = null` => toàn nền tảng (Platform Admin). */
export function ReportQueue({ courseId }: { courseId: string | null }) {
  const { t } = useTranslation('community');
  const [tab, setTab] = useState<ReportStatus | 'all'>('open');
  const [page, setPage] = useState(1);
  const reports = useReports(courseId, tab === 'all' ? undefined : tab, page);

  return (
    <section className="glass rounded-3xl p-4">
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {STATUS_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setPage(1);
            }}
            className={`h-10 rounded-xl px-4 text-[13.5px] font-semibold ${tab === key ? 'bg-brand text-white' : 'glass-chip text-stone-900'}`}
          >
            {t(`moderation.status.${key}`)}
          </button>
        ))}
      </div>
      {reports.isPending && <p className="py-8 text-center text-stone-400">{t('moderation.loadingReports')}</p>}
      {reports.isError && <ErrorNote message={errText(reports.error, t('moderation.loadReportsFailed'))} />}
      {reports.isSuccess && reports.data.data.length === 0 && (
        <p className="py-8 text-center text-stone-500">{tab === 'open' ? t('moderation.emptyOpen') : t('moderation.empty')}</p>
      )}
      <div className="flex flex-col gap-3">
        {reports.data?.data.map((r) => (
          <ReportCard key={r.id} report={r} courseId={courseId} />
        ))}
      </div>
      {reports.data && <Pager page={reports.data.meta.page} totalPages={reports.data.meta.totalPages} onChange={setPage} />}
      <ToastHost />
    </section>
  );
}

/** Route /communities/:id/community/kiem-duyet — chỉ mod trở lên. */
export function ModerationPage() {
  const { t } = useTranslation('community');
  const { id: courseId = '' } = useParams();
  const { data: course } = useCommunityDetail(courseId);
  if (!course) return null;
  if (!isModPlus(course.viewerRole)) {
    return (
      <div className="glass mx-auto max-w-lg rounded-3xl p-8 text-center">
        <MaterialIcon name="lock" size={36} filled color="#f26a1b" />
        <h1 className="mt-2 mb-1 text-xl font-extrabold">{t('moderation.staffOnlyTitle')}</h1>
        <p className="m-0 text-sm text-stone-600">{t('moderation.staffOnlyDesc')}</p>
      </div>
    );
  }
  return (
    <main className="flex min-w-0 flex-col gap-4">
      <PageBanner image="cal-hero-bg.webp" icon="shield" title={t('moderation.pageTitle')} subtitle={t('moderation.pageSubtitle')} />
      <ReportQueue courseId={courseId} />
    </main>
  );
}

