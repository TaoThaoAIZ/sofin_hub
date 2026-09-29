import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Pager } from '../../../components/ui/Pager';
import { useCourseDetail } from '../../courses/queries';
import { useReports, useResolveReport } from '../queries';
import { REPORT_REASONS, type Report, type ReportAction, type ReportStatus } from '../types';
import { areaCls, ConfirmDialog, errText, ErrorNote, fmtDateTime, ghostBtn, isModPlus, toast, ToastHost } from './contentUi';
import { PageBanner } from './shared';

const STATUS_TABS: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Đang chờ' },
  { key: 'resolved', label: 'Đã xử lý' },
  { key: 'dismissed', label: 'Đã bỏ qua' },
  { key: 'all', label: 'Tất cả' },
];
const TARGET_LABEL = { post: 'Bài viết', comment: 'Bình luận', member: 'Thành viên' } as const;
const ACTION_LABEL: Record<ReportAction, string> = { dismiss: 'Bỏ qua', hide_content: 'Đã ẩn nội dung', ban_member: 'Đã cấm thành viên' };
const reasonLabel = (k: string) => REPORT_REASONS.find((r) => r.key === k)?.label ?? k;

function ReportCard({ report, courseId }: { report: Report; courseId: string | null }) {
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
          toast(action === 'dismiss' ? 'Đã bỏ qua báo cáo' : action === 'hide_content' ? 'Đã ẩn nội dung' : 'Đã cấm thành viên');
        },
      },
    );

  return (
    <article className="rounded-2xl border border-[rgba(120,60,20,.1)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="rounded-lg bg-brand/10 px-2 py-0.5 font-bold text-brand">{TARGET_LABEL[report.targetType]}</span>
        <span className="rounded-lg bg-stone-100 px-2 py-0.5 font-semibold text-stone-700">{reasonLabel(report.reason)}</span>
        {report.courseTitle && <span className="text-stone-500">{report.courseTitle}</span>}
        <span className="ml-auto text-stone-400">{fmtDateTime(report.createdAt)}</span>
        <span
          className={`rounded-lg px-2 py-0.5 font-semibold ${
            report.status === 'open' ? 'bg-amber-100 text-amber-800' : report.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
          }`}
        >
          {report.status === 'open' ? 'Đang chờ' : report.status === 'resolved' ? 'Đã xử lý' : 'Đã bỏ qua'}
        </span>
      </div>

      <blockquote className="mx-0 my-3 rounded-xl border-l-4 border-brand/40 bg-[#fbf9f7] px-3.5 py-2.5 text-[13.5px] break-words whitespace-pre-wrap text-stone-800">
        {report.targetExcerpt || <span className="text-stone-400">(Không có nội dung ảnh chụp)</span>}
      </blockquote>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-stone-500">
        {report.targetUserName && (
          <span>
            Đối tượng: <b className="text-stone-700">{report.targetUserName}</b>
          </span>
        )}
        {report.reporterName && (
          <span>
            Người báo cáo: <b className="text-stone-700">{report.reporterName}</b>
          </span>
        )}
        {report.targetType === 'post' && cid && (
          <Link to={`/courses/${cid}/community?post=${report.targetId}`} className="font-semibold text-brand hover:underline">
            Xem bài viết
          </Link>
        )}
      </div>
      {report.detail && <p className="mt-2 mb-0 text-[13px] text-stone-600">Chi tiết: {report.detail}</p>}

      {open ? (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-[rgba(120,60,20,.08)] pt-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Ghi chú xử lý (không bắt buộc)" aria-label="Ghi chú xử lý" className={areaCls} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={resolve.isPending} onClick={() => run('dismiss')} className={ghostBtn}>
              <MaterialIcon name="do_not_disturb_on" size={18} /> Bỏ qua
            </button>
            {report.targetType !== 'member' && (
              <button type="button" disabled={resolve.isPending} onClick={() => run('hide_content')} className={ghostBtn}>
                <MaterialIcon name="visibility_off" size={18} /> Ẩn nội dung
              </button>
            )}
            <button type="button" disabled={resolve.isPending} onClick={() => setConfirmBan(true)} className={`${ghostBtn} !text-red-600`}>
              <MaterialIcon name="gavel" size={18} color="#dc2626" /> Cấm thành viên
            </button>
          </div>
          <ErrorNote message={resolve.isError && !confirmBan ? errText(resolve.error) : null} />
        </div>
      ) : (
        <div className="mt-3 border-t border-[rgba(120,60,20,.08)] pt-3 text-[12.5px] text-stone-500">
          {report.action && <b className="text-stone-700">{ACTION_LABEL[report.action]}</b>}
          {report.resolvedAt && ` · ${fmtDateTime(report.resolvedAt)}`}
          {report.note && <span> · Ghi chú: {report.note}</span>}
        </div>
      )}

      {confirmBan && (
        <ConfirmDialog
          title="Cấm thành viên?"
          message={`${report.targetUserName ?? 'Thành viên này'} sẽ bị xóa khỏi cộng đồng và không thể tham gia lại. Hành động này có thể bị từ chối nếu người đó có vai trò bằng hoặc cao hơn bạn.`}
          confirmLabel="Cấm thành viên"
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
  const [tab, setTab] = useState<ReportStatus | 'all'>('open');
  const [page, setPage] = useState(1);
  const reports = useReports(courseId, tab === 'all' ? undefined : tab, page);

  return (
    <section className="glass rounded-3xl p-4">
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`h-10 rounded-xl px-4 text-[13.5px] font-semibold ${tab === t.key ? 'bg-brand text-white' : 'glass-chip text-stone-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {reports.isPending && <p className="py-8 text-center text-stone-400">Đang tải báo cáo…</p>}
      {reports.isError && <ErrorNote message={errText(reports.error, 'Không tải được báo cáo')} />}
      {reports.isSuccess && reports.data.data.length === 0 && (
        <p className="py-8 text-center text-stone-500">{tab === 'open' ? 'Không có báo cáo nào đang chờ xử lý.' : 'Không có báo cáo nào.'}</p>
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

/** Route /courses/:id/community/kiem-duyet — chỉ mod trở lên. */
export function ModerationPage() {
  const { id: courseId = '' } = useParams();
  const { data: course } = useCourseDetail(courseId);
  if (!course) return null;
  if (!isModPlus(course.viewerRole)) {
    return (
      <div className="glass mx-auto max-w-lg rounded-3xl p-8 text-center">
        <MaterialIcon name="lock" size={36} filled color="#f26a1b" />
        <h1 className="mt-2 mb-1 text-xl font-extrabold">Chỉ dành cho quản trị viên</h1>
        <p className="m-0 text-sm text-stone-600">Bạn cần là mod trở lên của cộng đồng này để xử lý báo cáo.</p>
      </div>
    );
  }
  return (
    <main className="flex min-w-0 flex-col gap-4">
      <PageBanner image="cal-hero-bg.webp" icon="shield" title="Kiểm duyệt" subtitle="Xem và xử lý báo cáo bài viết, bình luận, thành viên trong cộng đồng." className="min-h-[120px]" />
      <ReportQueue courseId={courseId} />
    </main>
  );
}

