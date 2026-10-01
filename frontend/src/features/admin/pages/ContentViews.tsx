import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { apiDownload, resolveApiPath } from '../../../lib/api';
import { openFile } from '../../../lib/files';
import { formatDateTime, formatRelative } from '../../../lib/datetime';
import { USER_REASONS } from '../components/ActionModals';
import { ActionDialog, BarCell, HistoryList, MediaGrid, PreviewDialog, PreviewKv, PreviewSection, opts, useDialogSlot, useTableState, type MediaCardItem } from '../components/Batch2Parts';
import { KpiGrid } from '../components/Cards';
import { DataTable, MainCell, MutedCell, NumCell, SearchInput, Segment, TablePager, TextCell, type Column, type RowAction } from '../components/DataTable';
import { InputField, TextAreaField, useToast } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, Card, ErrorBlock, LoadingBlock, StatusBadge, errMessage, fmtNum } from '../components/ui';
import { useAdminAction, useAdminData, useAdminList } from '../queries.batch2';
import {
  CONTENT_STATUS,
  LESSON_ICON,
  LESSON_TYPE,
  MEDIA_KIND_LABEL,
  fmtBytes,
  type AdminComment,
  type AdminCommentDetail,
  type AdminCourse,
  type AdminCourseDetail,
  type AdminEvent,
  type AdminEventDetail,
  type AdminLesson,
  type AdminLessonDetail,
  type AdminMedia,
  type AdminPost,
  type AdminPostDetail,
  type ContentSummary,
  type MediaSummary,
  type PostSummary,
} from '../types.batch2';

const LIMIT = 20;

const statusBadge = (s: string) => {
  const m = CONTENT_STATUS[s] ?? { label: s, tone: 'x' as const };
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
};
const personName = (p: { name: string } | null | undefined) => <TextCell>{p?.name ?? '—'}</TextCell>;
const reportsCell = (n: number) => <span className={`text-[13.5px] font-semibold tabular-nums ${n > 0 ? 'text-[#b91c1c]' : 'text-stone-400'}`}>{n}</span>;
const SORT_CONTENT = [
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'engagement', label: 'Tương tác cao nhất' },
  { value: 'reports', label: 'Nhiều báo cáo nhất' },
];
const pageOf = (m: { page: number; totalPages: number; total: number } | undefined, onPage: (p: number) => void, limit = LIMIT) => (m ? { page: m.page, totalPages: m.totalPages, total: m.total, limit, onPage } : undefined);

/* ============================ Hành động chung ============================ */

type Res = 'posts' | 'comments' | 'lessons';
const NOUN: Record<Res, string> = { posts: 'bài viết', comments: 'bình luận', lessons: 'bài học' };

/** Ẩn / Gỡ / Khôi phục cho bài viết, bình luận, bài học (cùng một hợp đồng). */
function useModerateActions(res: Res) {
  const slot = useDialogSlot();
  const act = useAdminAction();
  const noun = NOUN[res];
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/content/${res}/${id}/${action}`, body });

  const hide = (id: string, name: string) =>
    slot.show((close) => (
      <ActionDialog
        icon="visibility_off"
        title={`Ẩn ${noun}?`}
        body={`${name}. Nội dung sẽ không còn hiển thị với thành viên thường.`}
        cta="Ẩn"
        reasons={USER_REASONS}
        requireReason
        noteLabel="Ghi chú nội bộ"
        notePlaceholder="Chỉ quản trị viên thấy..."
        flagLabel="Thông báo cho tác giả"
        successMessage={`Đã ẩn ${noun}`}
        run={(v) => post(id, 'hide', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const remove = (id: string, name: string) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title={`Gỡ ${noun}`}
        body={`${name}. Nội dung bị gỡ khỏi API công khai; chỉ quản trị viên còn thấy.`}
        cta="Gỡ nội dung"
        reasons={USER_REASONS}
        requireReason
        noteLabel="Lý do nội bộ"
        notePlaceholder="Vì sao gỡ nội dung này..."
        flagLabel="Thông báo cho tác giả"
        successMessage={`Đã gỡ ${noun}`}
        run={(v) => post(id, 'remove', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const restore = (id: string, name: string) =>
    slot.show((close) => (
      <ActionDialog
        icon="restore"
        title={`Khôi phục ${noun}?`}
        body={`${name}. Nội dung sẽ hiển thị lại bình thường.`}
        cta="Khôi phục"
        noteLabel="Ghi chú (tùy chọn)"
        successMessage={`Đã khôi phục ${noun}`}
        run={(v) => post(id, 'restore', { note: v.note || undefined })}
        onClose={close}
      />
    ));
  return { slot, hide, remove, restore };
}

/* ============================ Xem trước chi tiết ============================ */

function PreviewBody({ loading, error, children }: { loading: boolean; error: unknown; children: ReactNode }) {
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  return <>{children}</>;
}

const TextBlock = ({ children }: { children: ReactNode }) => <div className="rounded-xl bg-[#faf7f4] p-3.5 text-[13.5px] leading-relaxed wrap-break-word whitespace-pre-wrap">{children}</div>;

function ReportList({ list }: { list: AdminPostDetail['reportList'] }) {
  if (!list?.length) return <div className="text-[13px] text-stone-400">Không có báo cáo.</div>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {list.map((r) => (
        <li key={r.id} className="rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
          <b>{r.caseCode}</b> · {r.reason} · {r.reporter.name} · <span className="text-stone-500">{formatRelative(r.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function PostPreview({ kind, id, onClose }: { kind: 'posts' | 'comments'; id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const q = useAdminData<AdminPostDetail | AdminCommentDetail>('content', `/content/${kind}/${id}`);
  const d = q.data;
  const thread = d && 'thread' in d ? d.thread : [];
  return (
    <PreviewDialog title={kind === 'posts' ? 'Xem trước bài viết' : 'Xem trước bình luận'} sub={d?.code} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                ['Tác giả', d.author.name],
                ['Cộng đồng', d.community.name],
                ['Trạng thái', statusBadge(d.status)],
                ['Báo cáo', String(d.reports)],
                ['Đăng lúc', formatDateTime(d.createdAt)],
                ...(d.moderationReason ? ([['Lý do kiểm duyệt', d.moderationReason]] as [string, ReactNode][]) : []),
              ]}
            />
            <PreviewSection title="Nội dung">
              <TextBlock>{d.content}</TextBlock>
            </PreviewSection>
            {thread.length > 0 && (
              <PreviewSection title="Bình luận gần đây">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {thread.map((t) => (
                    <li key={t.id} className="rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                      <b>{t.author.name}</b> {t.status !== 'published' && <span className="text-[#b91c1c]">({CONTENT_STATUS[t.status]?.label ?? t.status})</span>}
                      <div className="text-stone-700">{t.text}</div>
                    </li>
                  ))}
                </ul>
              </PreviewSection>
            )}
            <PreviewSection title="Báo cáo">
              <ReportList list={d.reportList} />
            </PreviewSection>
            <PreviewSection title="Lịch sử quản trị">
              <HistoryList items={d.history} />
            </PreviewSection>
            <div>
              <AdminButton icon="person" onClick={() => navigate(`/admin/users/${d.author.id}`)}>
                Xem tác giả
              </AdminButton>
            </div>
          </>
        )}
      </PreviewBody>
    </PreviewDialog>
  );
}

/* ================================ Bài viết ================================ */

export function PostsView() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const t = useTableState({ sort: '' }, '');
  const [selected, setSelected] = useState<string[]>([]);
  const summary = useAdminData<PostSummary>('content', '/content/posts/summary');
  const list = useAdminList<AdminPost>('content-posts', '/content/posts', { q: t.q || undefined, status: t.tab || undefined, sort: t.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: t.page, limit: LIMIT });
  const { slot, hide, remove, restore } = useModerateActions('posts');
  const bulk = useAdminAction();
  const s = summary.data;

  const bulkRun = (action: 'hide' | 'remove' | 'restore') => {
    const label = action === 'hide' ? 'Ẩn' : action === 'remove' ? 'Gỡ' : 'Khôi phục';
    const n = selected.length;
    slot.show((close) => (
      <ActionDialog
        icon={action === 'restore' ? 'restore' : action === 'hide' ? 'visibility_off' : 'delete'}
        danger={action === 'remove'}
        title={`${label} ${n} bài viết?`}
        cta={label}
        reasons={action === 'restore' ? undefined : USER_REASONS}
        requireReason={action !== 'restore'}
        successMessage={`Đã xử lý ${n} bài viết`}
        run={async (v) => {
          const r = (await bulk.mutateAsync({ path: '/content/posts/bulk', body: { action, ids: selected, reason: v.reason || undefined } })) as { updated: number; skipped: { id: string; reason: string }[] } | undefined;
          if (r?.skipped?.length) toast.error(`Bỏ qua ${r.skipped.length} bài: ${r.skipped[0]!.reason}`);
          setSelected([]);
        }}
        onClose={close}
      />
    ));
  };

  const columns: Column<AdminPost>[] = [
    { key: 'post', label: 'Bài viết', w: 2.4, render: (p) => <MainCell name={p.title || '(Không có nội dung)'} sub={p.code} icon="article" /> },
    { key: 'author', label: 'Tác giả', render: (p) => personName(p.author) },
    { key: 'community', label: 'Cộng đồng', w: 1.4, render: (p) => <TextCell>{p.community.name}</TextCell> },
    { key: 'eng', label: 'Tương tác', w: 0.8, render: (p) => <NumCell>{fmtNum(p.engagement)}</NumCell> },
    { key: 'reports', label: 'Báo cáo', w: 0.6, render: (p) => reportsCell(p.reports) },
    { key: 'status', label: 'Trạng thái', render: (p) => statusBadge(p.underReview && p.status === 'published' ? 'under_review' : p.status) },
    { key: 'created', label: 'Tạo lúc', render: (p) => <MutedCell>{formatRelative(p.createdAt)}</MutedCell> },
  ];

  const actions = (p: AdminPost): RowAction[] => {
    const a: RowAction[] = [{ label: 'Xem trước', onClick: () => slot.show((close) => <PostPreview kind="posts" id={p.id} onClose={close} />) }];
    if (p.status === 'published') a.push({ label: 'Ẩn', icon: 'visibility_off', onClick: () => hide(p.id, p.code) });
    if (p.status !== 'removed') a.push({ label: 'Gỡ', icon: 'delete', danger: true, onClick: () => remove(p.id, p.code) });
    if (p.status !== 'published') a.push({ label: 'Khôi phục', icon: 'restore', onClick: () => restore(p.id, p.code) });
    a.push({ label: 'Xem tác giả', icon: 'person', onClick: () => navigate(`/admin/users/${p.author.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title="Bài viết" subtitle="Quản lý nội dung trên toàn bộ cộng đồng." />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'article', label: 'Tổng', value: fmtNum(s.total) },
            { icon: 'today', label: 'Hôm nay', value: fmtNum(s.today) },
            { icon: 'flag', label: 'Bị báo cáo', value: fmtNum(s.reported), bad: true, onClick: () => navigate('/admin/moderation') },
            { icon: 'delete', label: 'Đã gỡ', value: fmtNum(s.removed) },
          ]}
        />
      )}
      <DataTable<AdminPost>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(p) => p.id}
        tabs={[
          { key: '', label: 'Tất cả', count: s?.total },
          { key: 'published', label: 'Đã xuất bản', count: s ? s.total - s.hidden - s.removed : undefined },
          { key: 'under_review', label: 'Đang xem xét', count: s?.reported },
          { key: 'hidden', label: 'Đã ẩn', count: s?.hidden },
          { key: 'removed', label: 'Đã gỡ', count: s?.removed },
        ]}
        tab={t.tab}
        onTab={(k) => {
          t.onTab(k);
          setSelected([]);
        }}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm bài viết, tác giả, mã bài viết...' }}
        filters={[{ key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: SORT_CONTENT, onChange: t.setFilter('sort') }]}
        onClearFilters={t.clear}
        select={{ selected, onChange: setSelected }}
        bulkBar={
          <>
            <b className="text-[13px]">Đã chọn {selected.length}</b>
            <AdminButton className="!h-8" icon="visibility_off" onClick={() => bulkRun('hide')}>
              Ẩn
            </AdminButton>
            <AdminButton kind="danger" className="!h-8" icon="delete" onClick={() => bulkRun('remove')}>
              Gỡ
            </AdminButton>
            <AdminButton className="!h-8" icon="restore" onClick={() => bulkRun('restore')}>
              Khôi phục
            </AdminButton>
            <button type="button" className="border-0 bg-transparent text-[12.5px] font-semibold text-brand" onClick={() => setSelected([])}>
              Bỏ chọn
            </button>
          </>
        }
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(p) => slot.show((close) => <PostPreview kind="posts" id={p.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================ Bình luận ================================ */

export function CommentsView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const t = useTableState({ sort: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/comments/summary');
  const list = useAdminList<AdminComment>('content-comments', '/content/comments', { q: t.q || undefined, status: t.tab || undefined, sort: t.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: t.page, limit: LIMIT });
  const { slot, hide, remove, restore } = useModerateActions('comments');
  const s = summary.data;

  const columns: Column<AdminComment>[] = [
    { key: 'cmt', label: 'Bình luận', w: 2.4, render: (c) => <MainCell name={c.title || '(Không có nội dung)'} sub={c.code} icon="chat" /> },
    { key: 'author', label: 'Tác giả', render: (c) => personName(c.author) },
    { key: 'post', label: 'Bài viết gốc', w: 1.6, render: (c) => <TextCell>{c.post.title}</TextCell> },
    { key: 'community', label: 'Cộng đồng', w: 1.2, render: (c) => <TextCell>{c.community.name}</TextCell> },
    { key: 'reports', label: 'Báo cáo', w: 0.6, render: (c) => reportsCell(c.reports) },
    { key: 'status', label: 'Trạng thái', render: (c) => statusBadge(c.status) },
    { key: 'created', label: 'Tạo lúc', render: (c) => <MutedCell>{formatRelative(c.createdAt)}</MutedCell> },
  ];
  const actions = (c: AdminComment): RowAction[] => {
    const a: RowAction[] = [{ label: 'Xem trước', onClick: () => slot.show((close) => <PostPreview kind="comments" id={c.id} onClose={close} />) }];
    if (c.status === 'published') a.push({ label: 'Ẩn', icon: 'visibility_off', onClick: () => hide(c.id, c.code) });
    if (c.status !== 'removed') a.push({ label: 'Gỡ', icon: 'delete', danger: true, onClick: () => remove(c.id, c.code) });
    if (c.status !== 'published') a.push({ label: 'Khôi phục', icon: 'restore', onClick: () => restore(c.id, c.code) });
    a.push({ label: 'Xem tác giả', icon: 'person', onClick: () => navigate(`/admin/users/${c.author.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title="Bình luận" subtitle="Mọi bình luận trên toàn bộ cộng đồng." />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'chat', label: 'Tổng', value: fmtNum(s.total) },
            { icon: 'today', label: 'Hôm nay', value: fmtNum(s.today) },
            { icon: 'flag', label: 'Bị báo cáo', value: fmtNum(s.reported), bad: true, onClick: () => navigate('/admin/moderation') },
            { icon: 'delete', label: 'Đã gỡ', value: fmtNum(s.removed) },
          ]}
        />
      )}
      <DataTable<AdminComment>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: 'Tất cả', count: s?.total },
          { key: 'published', label: 'Đã xuất bản' },
          { key: 'hidden', label: 'Đã ẩn', count: s?.hidden },
          { key: 'removed', label: 'Đã gỡ', count: s?.removed },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm bình luận, tác giả, mã...' }}
        filters={[{ key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: SORT_CONTENT, onChange: t.setFilter('sort') }]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => slot.show((close) => <PostPreview kind="comments" id={c.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================= Khóa học ================================= */

function CoursePreview({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAdminData<AdminCourseDetail>('content', `/content/courses/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d?.title ?? 'Khóa học'} sub={d?.community.name} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                ['Giảng viên', d.creator?.name],
                ['Học viên', fmtNum(d.students)],
                ['Số module', fmtNum(d.modules ?? d.moduleList?.length ?? 0)],
                ['Số bài học', fmtNum(d.lessons)],
                ['Tỷ lệ hoàn thành', `${d.completionPct}%`],
                ['Trạng thái', statusBadge(d.status)],
                ['Báo cáo', String(d.reports)],
                ...(d.moderationReason ? ([['Lý do kiểm duyệt', d.moderationReason]] as [string, ReactNode][]) : []),
              ]}
            />
            {d.description && (
              <PreviewSection title="Mô tả">
                <TextBlock>{d.description}</TextBlock>
              </PreviewSection>
            )}
            {d.moduleList && d.moduleList.length > 0 && (
              <PreviewSection title={`Module (${d.moduleList.length})`}>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {d.moduleList.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                      <MaterialIcon name="folder" size={17} color="#a8a29e" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{m.title}</span>
                      <span className="text-stone-500">{m.lessons} bài</span>
                    </li>
                  ))}
                </ul>
              </PreviewSection>
            )}
            <PreviewSection title={`Bài học (${d.lessonList.length})`}>
              {d.lessonList.length === 0 ? (
                <div className="text-[13px] text-stone-400">Chưa có bài học.</div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {d.lessonList.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                      <MaterialIcon name={LESSON_ICON[l.type] ?? 'description'} size={17} color="#a8a29e" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.title}</span>
                      <span className="text-stone-500">{l.durationMin ? `${l.durationMin} phút` : (LESSON_TYPE[l.type] ?? l.type)}</span>
                      {statusBadge(l.status)}
                    </li>
                  ))}
                </ul>
              )}
            </PreviewSection>
            <PreviewSection title="Lịch sử quản trị">
              <HistoryList items={d.history} />
            </PreviewSection>
          </>
        )}
      </PreviewBody>
    </PreviewDialog>
  );
}

export function CoursesView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const t = useTableState({ sort: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/courses/summary');
  const list = useAdminList<AdminCourse>('content-courses', '/content/courses', { q: t.q || undefined, status: t.tab || undefined, sort: t.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/content/courses/${id}/${action}`, body });

  const publish = (c: AdminCourse) =>
    slot.show((close) => <ActionDialog icon="publish" title="Xuất bản khóa học?" body={c.title} cta="Xuất bản" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã xuất bản khóa học" run={(v) => post(c.id, 'publish', { note: v.note || undefined })} onClose={close} />);
  const unpublish = (c: AdminCourse) =>
    slot.show((close) => (
      <ActionDialog
        icon="unpublished"
        title="Hủy xuất bản khóa học?"
        body={`${c.title}. Thành viên thường sẽ không còn thấy khóa học này.`}
        cta="Hủy xuất bản"
        reasons={USER_REASONS}
        requireReason
        noteLabel="Ghi chú nội bộ"
        flagLabel="Thông báo cho giảng viên"
        successMessage="Đã hủy xuất bản khóa học"
        run={(v) => post(c.id, 'unpublish', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const archive = (c: AdminCourse) =>
    slot.show((close) => <ActionDialog icon="inventory_2" title="Lưu trữ khóa học?" body={c.title} cta="Lưu trữ" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã lưu trữ khóa học" run={(v) => post(c.id, 'archive', { note: v.note || undefined })} onClose={close} />);
  const remove = (c: AdminCourse) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title="Gỡ khóa học"
        body={c.title}
        cta="Gỡ khóa học"
        reasons={USER_REASONS}
        requireReason
        noteLabel="Lý do nội bộ"
        flagLabel="Thông báo cho giảng viên"
        successMessage="Đã gỡ khóa học"
        run={(v) => post(c.id, 'remove', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const restore = (c: AdminCourse) =>
    slot.show((close) => <ActionDialog icon="restore" title="Khôi phục khóa học?" body={c.title} cta="Khôi phục" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã khôi phục khóa học" run={(v) => post(c.id, 'restore', { note: v.note || undefined })} onClose={close} />);

  const columns: Column<AdminCourse>[] = [
    { key: 'course', label: 'Khóa học', w: 2.2, render: (c) => <MainCell name={c.title} sub={c.id.slice(0, 8)} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'creator', label: 'Giảng viên', render: (c) => personName(c.creator) },
    { key: 'community', label: 'Cộng đồng', w: 1.4, render: (c) => <TextCell>{c.community.name}</TextCell> },
    { key: 'students', label: 'Học viên', render: (c) => <NumCell>{fmtNum(c.students)}</NumCell> },
    { key: 'modules', label: 'Module', w: 0.7, render: (c) => <NumCell>{fmtNum(c.modules ?? 0)}</NumCell> },
    { key: 'lessons', label: 'Bài học', w: 0.7, render: (c) => <NumCell>{fmtNum(c.lessons)}</NumCell> },
    { key: 'completion', label: 'Hoàn thành', w: 1.2, render: (c) => <BarCell pct={c.completionPct} /> },
    { key: 'reports', label: 'Báo cáo', w: 0.6, render: (c) => reportsCell(c.reports) },
    { key: 'status', label: 'Trạng thái', render: (c) => statusBadge(c.status) },
  ];
  const actions = (c: AdminCourse): RowAction[] => {
    const a: RowAction[] = [{ label: 'Xem trước', onClick: () => slot.show((close) => <CoursePreview id={c.id} onClose={close} />) }];
    if (c.status === 'published') a.push({ label: 'Hủy xuất bản', icon: 'unpublished', onClick: () => unpublish(c) });
    if (c.status === 'draft' || c.status === 'archived') a.push({ label: 'Xuất bản', icon: 'publish', onClick: () => publish(c) });
    if (c.status === 'published' || c.status === 'draft') a.push({ label: 'Lưu trữ', icon: 'inventory_2', onClick: () => archive(c) });
    if (c.status !== 'removed') a.push({ label: 'Gỡ', icon: 'delete', danger: true, onClick: () => remove(c) });
    else a.push({ label: 'Khôi phục', icon: 'restore', onClick: () => restore(c) });
    a.push({ label: 'Mở cộng đồng', icon: 'open_in_new', onClick: () => navigate(`/admin/communities/${c.community.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title="Khóa học" subtitle="Khóa học nằm trong các cộng đồng (một cộng đồng có thể có nhiều khóa học)." />
      <DataTable<AdminCourse>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: 'Tất cả', count: s?.total },
          { key: 'published', label: 'Đã xuất bản', count: s?.published },
          { key: 'draft', label: 'Nháp', count: s?.draft },
          { key: 'archived', label: 'Đã lưu trữ', count: s?.archived },
          { key: 'removed', label: 'Đã gỡ', count: s?.removed },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm khóa học...' }}
        filters={[
          {
            key: 'sort',
            label: 'Sắp xếp',
            value: t.f.sort,
            options: [
              { value: 'oldest', label: 'Cũ nhất' },
              { value: 'students', label: 'Nhiều học viên' },
              { value: 'lessons', label: 'Nhiều bài học' },
              { value: 'newest', label: 'Mới nhất' },
              { value: 'title', label: 'Tên A–Z' },
            ],
            onChange: t.setFilter('sort'),
          },
        ]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => slot.show((close) => <CoursePreview id={c.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Bài học ================================== */

function LessonPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAdminData<AdminLessonDetail>('content', `/content/lessons/${id}`);
  const d = q.data;
  const video = d?.videoUrl ? resolveApiPath(d.videoUrl) : d?.embedUrl;
  return (
    <PreviewDialog title={d?.title ?? 'Bài học'} sub={d?.code} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                ['Mô-đun', d.module.title ?? d.module.name],
                ['Cộng đồng', d.community.name],
                ['Loại', LESSON_TYPE[d.type] ?? d.type],
                ['Thời lượng', d.durationMin ? `${d.durationMin} phút` : '—'],
                ['Hoàn thành', fmtNum(d.views)],
                ['Trạng thái', statusBadge(d.status)],
                ['Báo cáo', String(d.reports)],
                ...(d.moderationReason ? ([['Lý do kiểm duyệt', d.moderationReason]] as [string, ReactNode][]) : []),
              ]}
            />
            {d.body && (
              <PreviewSection title="Nội dung">
                <TextBlock>{d.body}</TextBlock>
              </PreviewSection>
            )}
            {video && (
              <PreviewSection title="Video">
                <a className="text-[13px] font-semibold break-all text-brand" href={video} target="_blank" rel="noopener noreferrer">
                  {video}
                </a>
              </PreviewSection>
            )}
            <PreviewSection title="Lịch sử quản trị">
              <HistoryList items={d.history} />
            </PreviewSection>
          </>
        )}
      </PreviewBody>
    </PreviewDialog>
  );
}

export function LessonsView() {
  const [params] = useSearchParams();
  const t = useTableState({ sort: '', status: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/lessons/summary');
  const list = useAdminList<AdminLesson>('content-lessons', '/content/lessons', { q: t.q || undefined, type: t.tab || undefined, status: t.f.status || undefined, sort: t.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: t.page, limit: LIMIT });
  const { slot, hide, remove, restore } = useModerateActions('lessons');
  const s = summary.data;

  const columns: Column<AdminLesson>[] = [
    { key: 'lesson', label: 'Bài học', w: 2.2, render: (l) => <MainCell name={l.title} sub={l.code} icon={LESSON_ICON[l.type] ?? 'description'} /> },
    { key: 'module', label: 'Mô-đun', w: 1.5, render: (l) => <TextCell>{l.module.title ?? l.module.name}</TextCell> },
    { key: 'community', label: 'Cộng đồng', w: 1.3, render: (l) => <TextCell>{l.community.name}</TextCell> },
    { key: 'type', label: 'Loại', render: (l) => <TextCell>{LESSON_TYPE[l.type] ?? l.type}</TextCell> },
    { key: 'views', label: 'Lượt hoàn thành', render: (l) => <NumCell>{fmtNum(l.views)}</NumCell> },
    { key: 'reports', label: 'Báo cáo', w: 0.6, render: (l) => reportsCell(l.reports) },
    { key: 'status', label: 'Trạng thái', render: (l) => statusBadge(l.status) },
  ];
  const actions = (l: AdminLesson): RowAction[] => {
    const a: RowAction[] = [{ label: 'Xem trước', onClick: () => slot.show((close) => <LessonPreview id={l.id} onClose={close} />) }];
    if (l.status === 'published') a.push({ label: 'Ẩn', icon: 'visibility_off', onClick: () => hide(l.id, l.title) });
    if (l.status !== 'removed') a.push({ label: 'Gỡ', icon: 'delete', danger: true, onClick: () => remove(l.id, l.title) });
    if (l.status !== 'published') a.push({ label: 'Khôi phục', icon: 'restore', onClick: () => restore(l.id, l.title) });
    return a;
  };

  return (
    <>
      <PageHeader title="Bài học" subtitle="Từng bài học trong các khóa học." />
      <DataTable<AdminLesson>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(l) => l.id}
        tabs={[
          { key: '', label: 'Tất cả', count: s?.total },
          { key: 'video', label: 'Video' },
          { key: 'text', label: 'Văn bản' },
          { key: 'file', label: 'Tệp' },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm bài học...' }}
        filters={[
          { key: 'status', label: 'Trạng thái', value: t.f.status, options: [{ value: 'published', label: 'Đã xuất bản' }, { value: 'hidden', label: 'Đã ẩn' }, { value: 'removed', label: 'Đã gỡ' }], onChange: t.setFilter('status') },
          { key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'views', label: 'Nhiều lượt hoàn thành' }, { value: 'title', label: 'Tên A–Z' }], onChange: t.setFilter('sort') },
        ]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(l) => slot.show((close) => <LessonPreview id={l.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Sự kiện ================================== */

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO -> giá trị cho <input type="datetime-local"> theo giờ máy. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function EventPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAdminData<AdminEventDetail>('content', `/content/events/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d?.title ?? 'Sự kiện'} sub={d?.community.name} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                ['Người tổ chức', d.host.name],
                ['Thời gian', `${formatDateTime(d.startAt)} (${d.timezone})`],
                ['Địa điểm / Link họp', d.meetingLink ?? d.location],
                ['Người tham dự', d.capacity ? `${d.attendees} / ${d.capacity}` : String(d.attendees)],
                ['Trạng thái', statusBadge(d.status)],
                ...(d.cancelReason ? ([['Lý do hủy', d.cancelReason]] as [string, ReactNode][]) : []),
              ]}
            />
            {d.description && (
              <PreviewSection title="Mô tả">
                <TextBlock>{d.description}</TextBlock>
              </PreviewSection>
            )}
            <PreviewSection title={`Người đã đăng ký (${d.attendees})`}>
              {d.rsvps.length === 0 ? (
                <div className="text-[13px] text-stone-400">Chưa có ai đăng ký.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {d.rsvps.map((p) => (
                    <span key={p.id} className="rounded-full bg-[#f5f1ed] px-2.5 py-1 text-xs font-semibold">
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
            </PreviewSection>
            <PreviewSection title="Lịch sử quản trị">
              <HistoryList items={d.history} />
            </PreviewSection>
          </>
        )}
      </PreviewBody>
    </PreviewDialog>
  );
}

function EditEventDialog({ event, onClose }: { event: AdminEvent; onClose: () => void }) {
  const act = useAdminAction();
  const detail = useAdminData<AdminEventDetail>('content', `/content/events/${event.id}`);
  const [title, setTitle] = useState(event.title);
  const [desc, setDesc] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(toLocalInput(event.startAt));
  const [link, setLink] = useState(event.meetingLink ?? '');
  const [cap, setCap] = useState(event.capacity ? String(event.capacity) : '');
  const descVal = desc ?? detail.data?.description ?? '';
  const capNum = cap.trim() === '' ? null : Number(cap);
  const invalid = !title.trim() || !startAt || (capNum !== null && (!Number.isInteger(capNum) || capNum < 1));

  return (
    <ActionDialog
      icon="edit"
      title="Sửa sự kiện"
      body={event.community.name}
      cta="Lưu thay đổi"
      disabledExtra={invalid || detail.isPending}
      successMessage="Đã cập nhật sự kiện"
      run={() =>
        act.mutateAsync({
          method: 'PATCH',
          path: `/content/events/${event.id}`,
          body: { title: title.trim(), description: descVal, startAt: new Date(startAt).toISOString(), meetingLink: link.trim() || null, capacity: capNum },
        })
      }
      onClose={onClose}
    >
      <InputField label="Tên sự kiện" value={title} onChange={setTitle} maxLength={200} />
      <TextAreaField label="Mô tả" value={descVal} onChange={setDesc} maxLength={2000} />
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-bold">Thời gian bắt đầu</div>
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} aria-label="Thời gian bắt đầu" className="h-11 rounded-xl border-[1.5px] border-[#e7e0da] px-[13px] text-sm font-medium outline-0 focus:border-brand" />
      </div>
      <InputField label="Link họp (tùy chọn)" value={link} onChange={setLink} placeholder="https://..." />
      <InputField label="Sức chứa (để trống = không giới hạn)" value={cap} onChange={setCap} placeholder="VD: 100" />
    </ActionDialog>
  );
}

export function EventsView() {
  const t = useTableState({ sort: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/events/summary');
  const [params] = useSearchParams();
  const list = useAdminList<AdminEvent>('content-events', '/content/events', { q: t.q || undefined, status: t.tab || undefined, sort: t.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/content/events/${id}/${action}`, body });

  const cancel = (e: AdminEvent) =>
    slot.show((close) => (
      <ActionDialog
        icon="event_busy"
        danger
        title="Hủy sự kiện?"
        body={`${e.title}. ${e.attendees} người đã đăng ký sẽ được thông báo.`}
        cta="Hủy sự kiện"
        reasons={opts(['Vi phạm chính sách', 'Chủ sở hữu yêu cầu', 'Trùng lịch', 'Khác'])}
        requireReason
        flagLabel="Thông báo cho người đã đăng ký"
        successMessage="Đã hủy sự kiện"
        run={(v) => post(e.id, 'cancel', { reason: v.reason, notifyAttendees: v.flag })}
        onClose={close}
      />
    ));
  const remove = (e: AdminEvent) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title="Gỡ sự kiện"
        body={e.title}
        cta="Gỡ sự kiện"
        reasons={USER_REASONS}
        requireReason
        flagLabel="Thông báo cho người đã đăng ký"
        successMessage="Đã gỡ sự kiện"
        run={(v) => post(e.id, 'remove', { reason: v.reason, notifyAttendees: v.flag })}
        onClose={close}
      />
    ));
  const restore = (e: AdminEvent) =>
    slot.show((close) => <ActionDialog icon="restore" title="Khôi phục sự kiện?" body={e.title} cta="Khôi phục" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã khôi phục sự kiện" run={(v) => post(e.id, 'restore', { note: v.note || undefined })} onClose={close} />);

  const columns: Column<AdminEvent>[] = [
    { key: 'event', label: 'Sự kiện', w: 2, render: (e) => <MainCell name={e.title} sub={e.location ?? undefined} icon="event" /> },
    { key: 'community', label: 'Cộng đồng', w: 1.4, render: (e) => <TextCell>{e.community.name}</TextCell> },
    { key: 'host', label: 'Người tổ chức', render: (e) => personName(e.host) },
    { key: 'att', label: 'Tham dự', render: (e) => <NumCell>{e.capacity ? `${e.attendees}/${e.capacity}` : e.attendees}</NumCell> },
    { key: 'date', label: 'Ngày', render: (e) => <MutedCell>{formatDateTime(e.startAt)}</MutedCell> },
    { key: 'status', label: 'Trạng thái', render: (e) => statusBadge(e.status) },
    { key: 'reports', label: 'Báo cáo', w: 0.6, render: (e) => reportsCell(e.reports) },
  ];
  const actions = (e: AdminEvent): RowAction[] => {
    const a: RowAction[] = [{ label: 'Xem', onClick: () => slot.show((close) => <EventPreview id={e.id} onClose={close} />) }];
    if (e.status === 'upcoming' || e.status === 'live') {
      a.push({ label: 'Sửa', icon: 'edit', onClick: () => slot.show((close) => <EditEventDialog event={e} onClose={close} />) });
      a.push({ label: 'Hủy', icon: 'event_busy', danger: true, onClick: () => cancel(e) });
    }
    if (e.status !== 'removed') a.push({ label: 'Gỡ', icon: 'delete', danger: true, onClick: () => remove(e) });
    if (e.status === 'cancelled' || e.status === 'removed') a.push({ label: 'Khôi phục', icon: 'restore', onClick: () => restore(e) });
    return a;
  };

  return (
    <>
      <PageHeader title="Sự kiện" subtitle="Sự kiện được lên lịch ở mọi cộng đồng." />
      <DataTable<AdminEvent>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(e) => e.id}
        tabs={[
          { key: '', label: 'Tất cả', count: s?.total },
          { key: 'upcoming', label: 'Sắp diễn ra', count: s?.upcoming },
          { key: 'live', label: 'Đang diễn ra', count: s?.live },
          { key: 'completed', label: 'Hoàn tất', count: s?.completed },
          { key: 'cancelled', label: 'Đã hủy', count: s?.cancelled },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm sự kiện...' }}
        filters={[{ key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'newest', label: 'Mới tạo nhất' }, { value: 'startAt', label: 'Theo ngày diễn ra' }], onChange: t.setFilter('sort') }]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(e) => slot.show((close) => <EventPreview id={e.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Media ================================== */

const KIND_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'image', label: 'Hình ảnh' },
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Tài liệu' },
  { value: 'audio', label: 'Âm thanh' },
] as const;
const MEDIA_STATUS_OPTIONS = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'flagged', label: 'Bị gắn cờ' },
  { value: 'removed', label: 'Đã gỡ' },
] as const;
const VIEW_OPTIONS = [
  { value: 'grid', label: 'Lưới' },
  { value: 'table', label: 'Bảng' },
] as const;
const MEDIA_LIMIT = 24;
const KIND_ICON: Record<string, string> = { image: 'image', video: 'movie', document: 'description', audio: 'graphic_eq' };

export function MediaView() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]['value']>('');
  const [status, setStatus] = useState<(typeof MEDIA_STATUS_OPTIONS)[number]['value']>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const summary = useAdminData<MediaSummary>('content', '/content/media/summary');
  const list = useAdminList<AdminMedia>('content-media', '/content/media', { q: q || undefined, kind: kind || undefined, status: status || undefined, courseId: params.get('courseId') ?? undefined, page, limit: MEDIA_LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const s = summary.data;

  const post = (key: string, action: string, body: object) => act.mutateAsync({ path: `/content/media/${encodeURIComponent(key)}/${action}`, body });
  const preview = (m: AdminMedia) => {
    if (m.url) openFile(m.url).catch((e) => toast.error(errMessage(e, 'Không mở được tệp')));
  };
  const download = async (m: AdminMedia) => {
    try {
      await apiDownload(`/admin/content/media/${encodeURIComponent(m.key)}/download`, m.filename);
    } catch (e) {
      toast.error(errMessage(e, 'Không tải được tệp'));
    }
  };
  const flag = (m: AdminMedia) => slot.show((close) => <ActionDialog icon="flag" title="Gắn cờ tệp?" body={m.filename} cta="Gắn cờ" reasons={USER_REASONS} requireReason successMessage="Đã gắn cờ tệp" run={(v) => post(m.key, 'flag', { reason: v.reason })} onClose={close} />);
  const unflag = (m: AdminMedia) =>
    slot.show((close) => <ActionDialog icon="outlined_flag" title="Bỏ gắn cờ?" body={m.filename} cta="Bỏ gắn cờ" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã bỏ gắn cờ" run={(v) => post(m.key, 'unflag', { note: v.note || undefined })} onClose={close} />);
  const remove = (m: AdminMedia) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title="Gỡ tệp"
        body={`${m.filename}. Tệp sẽ không còn truy cập được công khai.`}
        cta="Gỡ tệp"
        reasons={USER_REASONS}
        requireReason
        flagLabel="Thông báo cho chủ tệp"
        successMessage="Đã gỡ tệp"
        run={(v) => post(m.key, 'remove', { reason: v.reason, notifyOwner: v.flag })}
        onClose={close}
      />
    ));
  const restore = (m: AdminMedia) =>
    slot.show((close) => <ActionDialog icon="restore" title="Khôi phục tệp?" body={m.filename} cta="Khôi phục" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã khôi phục tệp" run={(v) => post(m.key, 'restore', { note: v.note || undefined })} onClose={close} />);

  const cards: MediaCardItem[] = items.map((m) => ({
    id: m.key,
    kind: m.kind,
    name: m.filename,
    meta: `${fmtBytes(m.size)} · ${m.owner.name} · ${formatRelative(m.uploadedAt)}`,
    // Chỉ ảnh công khai có thumbnail trực tiếp; file riêng tư cần URL ký nên xem qua nút Xem trước.
    thumbUrl: m.url && ['avatar', 'cover', 'post_image'].includes(m.purpose) ? resolveApiPath(m.url) : null,
    reports: m.reports,
    buttons: [
      ...(m.status !== 'removed' ? [{ icon: 'visibility', label: 'Xem trước', onClick: () => preview(m) }] : []),
      { icon: 'download', label: 'Tải xuống', onClick: () => void download(m) },
      m.status === 'removed' ? { icon: 'restore', label: 'Khôi phục', onClick: () => restore(m) } : { icon: 'delete', label: 'Gỡ', danger: true, onClick: () => remove(m) },
    ],
  }));

  const columns: Column<AdminMedia>[] = [
    { key: 'name', label: 'Tên tệp', w: 2, render: (m) => <MainCell name={m.filename} sub={MEDIA_KIND_LABEL[m.kind] ?? m.kind} icon={KIND_ICON[m.kind] ?? 'draft'} /> },
    { key: 'owner', label: 'Chủ tệp', render: (m) => personName(m.owner) },
    { key: 'community', label: 'Cộng đồng', w: 1.4, render: (m) => <TextCell>{m.community?.name ?? '—'}</TextCell> },
    { key: 'size', label: 'Dung lượng', render: (m) => <MutedCell>{fmtBytes(m.size)}</MutedCell> },
    { key: 'reports', label: 'Báo cáo', w: 0.6, render: (m) => reportsCell(m.reports) },
    { key: 'status', label: 'Trạng thái', render: (m) => statusBadge(m.status) },
    { key: 'up', label: 'Tải lên', render: (m) => <MutedCell>{formatRelative(m.uploadedAt)}</MutedCell> },
  ];
  const actions = (m: AdminMedia): RowAction[] => {
    const a: RowAction[] = [];
    if (m.status !== 'removed') a.push({ label: 'Xem trước', onClick: () => preview(m) });
    a.push({ label: 'Tải xuống', icon: 'download', onClick: () => void download(m) });
    if (m.status === 'active') a.push({ label: 'Gắn cờ', icon: 'flag', onClick: () => flag(m) });
    if (m.status === 'flagged') a.push({ label: 'Bỏ gắn cờ', icon: 'outlined_flag', onClick: () => unflag(m) });
    if (m.status !== 'removed') a.push({ label: 'Gỡ', icon: 'delete', danger: true, onClick: () => remove(m) });
    else a.push({ label: 'Khôi phục', icon: 'restore', onClick: () => restore(m) });
    return a;
  };

  const viewTools = <Segment options={VIEW_OPTIONS} value={view} onChange={setView} small label="Chế độ xem" />;
  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <Segment
        options={KIND_OPTIONS}
        value={kind}
        onChange={(v) => {
          setKind(v);
          setPage(1);
        }}
        label="Loại tệp"
      />
      <Segment
        options={MEDIA_STATUS_OPTIONS}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        label="Trạng thái"
      />
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        placeholder="Tìm tệp, chủ tệp..."
        className="max-w-[320px]"
      />
    </div>
  );

  return (
    <>
      <PageHeader title="Media" subtitle="Thư viện media của toàn nền tảng." />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'perm_media', label: 'Tổng tệp', value: fmtNum(s.total) },
            { icon: 'hard_drive', label: 'Dung lượng', value: fmtBytes(s.totalSizeBytes) },
            { icon: 'flag', label: 'Bị gắn cờ', value: fmtNum(s.flagged), bad: true },
            { icon: 'delete', label: 'Đã gỡ', value: fmtNum(s.removed) },
          ]}
        />
      )}
      {toolbar}
      {list.isPending ? (
        <Card title="Thư viện media">
          <LoadingBlock />
        </Card>
      ) : list.isError ? (
        <Card title="Thư viện media">
          <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : view === 'grid' ? (
        <>
          <MediaGrid title="Thư viện media" sub={`${fmtNum(meta?.total ?? items.length)} tệp`} tools={viewTools} items={cards} />
          {meta && meta.totalPages > 1 && (
            <div className="flex justify-end">
              <TablePager info={{ page: meta.page, totalPages: meta.totalPages, total: meta.total, limit: MEDIA_LIMIT, onPage: setPage }} />
            </div>
          )}
        </>
      ) : (
        <DataTable<AdminMedia>
          title="Thư viện media"
          sub={`${fmtNum(meta?.total ?? items.length)} tệp`}
          headTools={viewTools}
          columns={columns}
          rows={items}
          rowKey={(m) => m.key}
          actions={actions}
          emptyText="Không có tệp nào."
          page={pageOf(meta, setPage, MEDIA_LIMIT)}
        />
      )}
      {slot.el}
    </>
  );
}
