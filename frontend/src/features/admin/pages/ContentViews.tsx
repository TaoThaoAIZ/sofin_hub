import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
const sortContent = (t: TFunction) => [
  { value: 'oldest', label: t('common.oldest') },
  { value: 'engagement', label: t('common.highestEngagement') },
  { value: 'reports', label: t('common.mostReports') },
];
const pageOf = (m: { page: number; totalPages: number; total: number } | undefined, onPage: (p: number) => void, limit = LIMIT) => (m ? { page: m.page, totalPages: m.totalPages, total: m.total, limit, onPage } : undefined);

/* ============================ Hành động chung ============================ */

type Res = 'posts' | 'comments' | 'lessons';

/** Ẩn / Gỡ / Khôi phục cho bài viết, bình luận, bài học (cùng một hợp đồng). */
function useModerateActions(res: Res) {
  const { t } = useTranslation('admin-content');
  const slot = useDialogSlot();
  const act = useAdminAction();
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/content/${res}/${id}/${action}`, body });

  const hide = (id: string, name: string) =>
    slot.show((close) => (
      <ActionDialog
        icon="visibility_off"
        title={t(`moderate.${res}.hideTitle`)}
        body={t('moderate.hideBody', { name })}
        cta={t('common.hide')}
        reasons={USER_REASONS}
        requireReason
        noteLabel={t('common.internalNote')}
        notePlaceholder={t('common.adminOnlyPlaceholder')}
        flagLabel={t('common.notifyAuthor')}
        successMessage={t(`moderate.${res}.hideDone`)}
        run={(v) => post(id, 'hide', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const remove = (id: string, name: string) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title={t(`moderate.${res}.removeTitle`)}
        body={t('moderate.removeBody', { name })}
        cta={t('common.removeContent')}
        reasons={USER_REASONS}
        requireReason
        noteLabel={t('common.internalReason')}
        notePlaceholder={t('common.removeReasonPlaceholder')}
        flagLabel={t('common.notifyAuthor')}
        successMessage={t(`moderate.${res}.removeDone`)}
        run={(v) => post(id, 'remove', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const restore = (id: string, name: string) =>
    slot.show((close) => (
      <ActionDialog
        icon="restore"
        title={t(`moderate.${res}.restoreTitle`)}
        body={t('moderate.restoreBody', { name })}
        cta={t('common.restore')}
        noteLabel={t('common.noteOptional')}
        successMessage={t(`moderate.${res}.restoreDone`)}
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
  const { t } = useTranslation('admin-content');
  if (!list?.length) return <div className="text-[13px] text-stone-400">{t('common.noReports')}</div>;
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
  const { t } = useTranslation('admin-content');
  const navigate = useNavigate();
  const q = useAdminData<AdminPostDetail | AdminCommentDetail>('content', `/content/${kind}/${id}`);
  const d = q.data;
  const thread = d && 'thread' in d ? d.thread : [];
  return (
    <PreviewDialog title={kind === 'posts' ? t('posts.previewTitle') : t('posts.previewComment')} sub={d?.code} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                [t('common.author'), d.author.name],
                [t('common.community'), d.community.name],
                [t('common.status'), statusBadge(d.status)],
                [t('common.reports'), String(d.reports)],
                [t('common.postedAt'), formatDateTime(d.createdAt)],
                ...(d.moderationReason ? ([[t('common.moderationReason'), d.moderationReason]] as [string, ReactNode][]) : []),
              ]}
            />
            <PreviewSection title={t('common.content')}>
              <TextBlock>{d.content}</TextBlock>
            </PreviewSection>
            {thread.length > 0 && (
              <PreviewSection title={t('common.recentComments')}>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {thread.map((th) => (
                    <li key={th.id} className="rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                      <b>{th.author.name}</b> {th.status !== 'published' && <span className="text-[#b91c1c]">({CONTENT_STATUS[th.status]?.label ?? th.status})</span>}
                      <div className="text-stone-700">{th.text}</div>
                    </li>
                  ))}
                </ul>
              </PreviewSection>
            )}
            <PreviewSection title={t('common.reports')}>
              <ReportList list={d.reportList} />
            </PreviewSection>
            <PreviewSection title={t('common.history')}>
              <HistoryList items={d.history} />
            </PreviewSection>
            <div>
              <AdminButton icon="person" onClick={() => navigate(`/admin/users/${d.author.id}`)}>
                {t('common.viewAuthor')}
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
  const { t } = useTranslation('admin-content');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ts = useTableState({ sort: '' }, '');
  const [selected, setSelected] = useState<string[]>([]);
  const summary = useAdminData<PostSummary>('content', '/content/posts/summary');
  const list = useAdminList<AdminPost>('content-posts', '/content/posts', { q: ts.q || undefined, status: ts.tab || undefined, sort: ts.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: ts.page, limit: LIMIT });
  const { slot, hide, remove, restore } = useModerateActions('posts');
  const bulk = useAdminAction();
  const s = summary.data;

  const bulkRun = (action: 'hide' | 'remove' | 'restore') => {
    const label = action === 'hide' ? t('common.hide') : action === 'remove' ? t('common.remove') : t('common.restore');
    const n = selected.length;
    slot.show((close) => (
      <ActionDialog
        icon={action === 'restore' ? 'restore' : action === 'hide' ? 'visibility_off' : 'delete'}
        danger={action === 'remove'}
        title={t(`bulk.${action}Title`, { n })}
        cta={label}
        reasons={action === 'restore' ? undefined : USER_REASONS}
        requireReason={action !== 'restore'}
        successMessage={t('bulk.done', { n })}
        run={async (v) => {
          const r = (await bulk.mutateAsync({ path: '/content/posts/bulk', body: { action, ids: selected, reason: v.reason || undefined } })) as { updated: number; skipped: { id: string; reason: string }[] } | undefined;
          setSelected([]);
          if (r?.skipped?.length) return { message: t('bulk.doneSkipped', { n: r.updated ?? n - r.skipped.length, skipped: r.skipped.length, reason: r.skipped[0]!.reason }) };
        }}
        onClose={close}
      />
    ));
  };

  const columns: Column<AdminPost>[] = [
    { key: 'post', label: t('common.post'), w: 2.4, render: (p) => <MainCell name={p.title || t('common.noContent')} sub={p.code} icon="article" /> },
    { key: 'author', label: t('common.author'), render: (p) => personName(p.author) },
    { key: 'community', label: t('common.community'), w: 1.4, render: (p) => <TextCell>{p.community.name}</TextCell> },
    { key: 'eng', label: t('common.engagement'), w: 0.8, render: (p) => <NumCell>{fmtNum(p.engagement)}</NumCell> },
    { key: 'reports', label: t('common.reports'), w: 0.6, render: (p) => reportsCell(p.reports) },
    { key: 'status', label: t('common.status'), render: (p) => statusBadge(p.underReview && p.status === 'published' ? 'under_review' : p.status) },
    { key: 'created', label: t('common.createdAt'), render: (p) => <MutedCell>{formatRelative(p.createdAt)}</MutedCell> },
  ];

  const actions = (p: AdminPost): RowAction[] => {
    const a: RowAction[] = [{ label: t('common.preview'), onClick: () => slot.show((close) => <PostPreview kind="posts" id={p.id} onClose={close} />) }];
    if (p.status === 'published') a.push({ label: t('common.hide'), icon: 'visibility_off', onClick: () => hide(p.id, p.code) });
    if (p.status !== 'removed') a.push({ label: t('common.remove'), icon: 'delete', danger: true, onClick: () => remove(p.id, p.code) });
    if (p.status !== 'published') a.push({ label: t('common.restore'), icon: 'restore', onClick: () => restore(p.id, p.code) });
    a.push({ label: t('common.viewAuthor'), icon: 'person', onClick: () => navigate(`/admin/users/${p.author.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('common.postsTitle')} subtitle={t('posts.pageSubtitle')} />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'article', label: t('common.total'), value: fmtNum(s.total) },
            { icon: 'today', label: t('common.today'), value: fmtNum(s.today) },
            { icon: 'flag', label: t('common.reported'), value: fmtNum(s.reported), bad: true, onClick: () => navigate('/admin/moderation') },
            { icon: 'delete', label: t('common.removed'), value: fmtNum(s.removed) },
          ]}
        />
      )}
      <DataTable<AdminPost>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(p) => p.id}
        tabs={[
          { key: '', label: t('common.all'), count: s?.total },
          { key: 'published', label: t('common.published'), count: s ? s.total - s.hidden - s.removed : undefined },
          { key: 'under_review', label: t('common.underReview'), count: s?.reported },
          { key: 'hidden', label: t('common.hidden'), count: s?.hidden },
          { key: 'removed', label: t('common.removed'), count: s?.removed },
        ]}
        tab={ts.tab}
        onTab={(k) => {
          ts.onTab(k);
          setSelected([]);
        }}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('posts.searchPlaceholder') }}
        filters={[{ key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: sortContent(t), onChange: ts.setFilter('sort') }]}
        onClearFilters={ts.clear}
        select={{ selected, onChange: setSelected }}
        bulkBar={
          <>
            <b className="text-[13px]">{t('common.selected', { n: selected.length })}</b>
            <AdminButton className="!h-8" icon="visibility_off" onClick={() => bulkRun('hide')}>
              {t('common.hide')}
            </AdminButton>
            <AdminButton kind="danger" className="!h-8" icon="delete" onClick={() => bulkRun('remove')}>
              {t('common.remove')}
            </AdminButton>
            <AdminButton className="!h-8" icon="restore" onClick={() => bulkRun('restore')}>
              {t('common.restore')}
            </AdminButton>
            <button type="button" className="border-0 bg-transparent text-[12.5px] font-semibold text-brand" onClick={() => setSelected([])}>
              {t('common.deselect')}
            </button>
          </>
        }
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(p) => slot.show((close) => <PostPreview kind="posts" id={p.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================ Bình luận ================================ */

export function CommentsView() {
  const { t } = useTranslation('admin-content');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ts = useTableState({ sort: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/comments/summary');
  const list = useAdminList<AdminComment>('content-comments', '/content/comments', { q: ts.q || undefined, status: ts.tab || undefined, sort: ts.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: ts.page, limit: LIMIT });
  const { slot, hide, remove, restore } = useModerateActions('comments');
  const s = summary.data;

  const columns: Column<AdminComment>[] = [
    { key: 'cmt', label: t('common.comment'), w: 2.4, render: (c) => <MainCell name={c.title || t('common.noContent')} sub={c.code} icon="chat" /> },
    { key: 'author', label: t('common.author'), render: (c) => personName(c.author) },
    { key: 'post', label: t('comments.originalPost'), w: 1.6, render: (c) => <TextCell>{c.post.title}</TextCell> },
    { key: 'community', label: t('common.community'), w: 1.2, render: (c) => <TextCell>{c.community.name}</TextCell> },
    { key: 'reports', label: t('common.reports'), w: 0.6, render: (c) => reportsCell(c.reports) },
    { key: 'status', label: t('common.status'), render: (c) => statusBadge(c.status) },
    { key: 'created', label: t('common.createdAt'), render: (c) => <MutedCell>{formatRelative(c.createdAt)}</MutedCell> },
  ];
  const actions = (c: AdminComment): RowAction[] => {
    const a: RowAction[] = [{ label: t('common.preview'), onClick: () => slot.show((close) => <PostPreview kind="comments" id={c.id} onClose={close} />) }];
    if (c.status === 'published') a.push({ label: t('common.hide'), icon: 'visibility_off', onClick: () => hide(c.id, c.code) });
    if (c.status !== 'removed') a.push({ label: t('common.remove'), icon: 'delete', danger: true, onClick: () => remove(c.id, c.code) });
    if (c.status !== 'published') a.push({ label: t('common.restore'), icon: 'restore', onClick: () => restore(c.id, c.code) });
    a.push({ label: t('common.viewAuthor'), icon: 'person', onClick: () => navigate(`/admin/users/${c.author.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('common.commentsTitle')} subtitle={t('comments.pageSubtitle')} />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'chat', label: t('common.total'), value: fmtNum(s.total) },
            { icon: 'today', label: t('common.today'), value: fmtNum(s.today) },
            { icon: 'flag', label: t('common.reported'), value: fmtNum(s.reported), bad: true, onClick: () => navigate('/admin/moderation') },
            { icon: 'delete', label: t('common.removed'), value: fmtNum(s.removed) },
          ]}
        />
      )}
      <DataTable<AdminComment>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: t('common.all'), count: s?.total },
          { key: 'published', label: t('common.published') },
          { key: 'hidden', label: t('common.hidden'), count: s?.hidden },
          { key: 'removed', label: t('common.removed'), count: s?.removed },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('comments.searchPlaceholder') }}
        filters={[{ key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: sortContent(t), onChange: ts.setFilter('sort') }]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => slot.show((close) => <PostPreview kind="comments" id={c.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================= Khóa học ================================= */

function CoursePreview({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('admin-content');
  const q = useAdminData<AdminCourseDetail>('content', `/content/courses/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d?.title ?? t('common.course')} sub={d?.community.name} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                [t('courses.instructor'), d.creator?.name],
                [t('courses.students'), fmtNum(d.students)],
                [t('courses.moduleCount'), fmtNum(d.modules ?? d.moduleList?.length ?? 0)],
                [t('courses.lessonCount'), fmtNum(d.lessons)],
                [t('courses.completionRate'), `${d.completionPct}%`],
                [t('common.status'), statusBadge(d.status)],
                [t('common.reports'), String(d.reports)],
                ...(d.moderationReason ? ([[t('common.moderationReason'), d.moderationReason]] as [string, ReactNode][]) : []),
              ]}
            />
            {d.description && (
              <PreviewSection title={t('common.description')}>
                <TextBlock>{d.description}</TextBlock>
              </PreviewSection>
            )}
            {d.moduleList && d.moduleList.length > 0 && (
              <PreviewSection title={t('courses.modulesTitle', { n: d.moduleList.length })}>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {d.moduleList.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                      <MaterialIcon name="folder" size={17} color="#a8a29e" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{m.title}</span>
                      <span className="text-stone-500">{t('courses.lessonsShort', { n: m.lessons })}</span>
                    </li>
                  ))}
                </ul>
              </PreviewSection>
            )}
            <PreviewSection title={t('courses.lessonsTitle', { n: d.lessonList.length })}>
              {d.lessonList.length === 0 ? (
                <div className="text-[13px] text-stone-400">{t('courses.noLessons')}</div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {d.lessonList.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                      <MaterialIcon name={LESSON_ICON[l.type] ?? 'description'} size={17} color="#a8a29e" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.title}</span>
                      <span className="text-stone-500">{l.durationMin ? t('common.minutes', { n: l.durationMin }) : (LESSON_TYPE[l.type] ?? l.type)}</span>
                      {statusBadge(l.status)}
                    </li>
                  ))}
                </ul>
              )}
            </PreviewSection>
            <PreviewSection title={t('common.history')}>
              <HistoryList items={d.history} />
            </PreviewSection>
          </>
        )}
      </PreviewBody>
    </PreviewDialog>
  );
}

export function CoursesView() {
  const { t } = useTranslation('admin-content');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ts = useTableState({ sort: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/courses/summary');
  const list = useAdminList<AdminCourse>('content-courses', '/content/courses', { q: ts.q || undefined, status: ts.tab || undefined, sort: ts.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: ts.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/content/courses/${id}/${action}`, body });

  const publish = (c: AdminCourse) =>
    slot.show((close) => <ActionDialog icon="publish" title={t('courses.publishTitle')} body={c.title} cta={t('courses.publish')} noteLabel={t('common.noteOptional')} successMessage={t('courses.published')} run={(v) => post(c.id, 'publish', { note: v.note || undefined })} onClose={close} />);
  const unpublish = (c: AdminCourse) =>
    slot.show((close) => (
      <ActionDialog
        icon="unpublished"
        title={t('courses.unpublishTitle')}
        body={t('courses.unpublishBody', { title: c.title })}
        cta={t('courses.unpublish')}
        reasons={USER_REASONS}
        requireReason
        noteLabel={t('common.internalNote')}
        flagLabel={t('courses.notifyInstructor')}
        successMessage={t('courses.unpublished')}
        run={(v) => post(c.id, 'unpublish', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const archive = (c: AdminCourse) =>
    slot.show((close) => <ActionDialog icon="inventory_2" title={t('courses.archiveTitle')} body={c.title} cta={t('courses.archive')} noteLabel={t('common.noteOptional')} successMessage={t('courses.archived')} run={(v) => post(c.id, 'archive', { note: v.note || undefined })} onClose={close} />);
  const remove = (c: AdminCourse) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title={t('courses.removeTitle')}
        body={c.title}
        cta={t('courses.removeTitle')}
        reasons={USER_REASONS}
        requireReason
        noteLabel={t('common.internalReason')}
        flagLabel={t('courses.notifyInstructor')}
        successMessage={t('courses.removed')}
        run={(v) => post(c.id, 'remove', { reason: v.reason, note: v.note || undefined, notifyAuthor: v.flag })}
        onClose={close}
      />
    ));
  const restore = (c: AdminCourse) =>
    slot.show((close) => <ActionDialog icon="restore" title={t('courses.restoreTitle')} body={c.title} cta={t('common.restore')} noteLabel={t('common.noteOptional')} successMessage={t('courses.restored')} run={(v) => post(c.id, 'restore', { note: v.note || undefined })} onClose={close} />);

  const columns: Column<AdminCourse>[] = [
    { key: 'course', label: t('common.course'), w: 2.2, render: (c) => <MainCell name={c.title} sub={c.id.slice(0, 8)} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'creator', label: t('courses.instructor'), render: (c) => personName(c.creator) },
    { key: 'community', label: t('common.community'), w: 1.4, render: (c) => <TextCell>{c.community.name}</TextCell> },
    { key: 'students', label: t('courses.students'), render: (c) => <NumCell>{fmtNum(c.students)}</NumCell> },
    { key: 'modules', label: t('courses.moduleCol'), w: 0.7, render: (c) => <NumCell>{fmtNum(c.modules ?? 0)}</NumCell> },
    { key: 'lessons', label: t('common.lessonsTitle'), w: 0.7, render: (c) => <NumCell>{fmtNum(c.lessons)}</NumCell> },
    { key: 'completion', label: t('courses.completion'), w: 1.2, render: (c) => <BarCell pct={c.completionPct} /> },
    { key: 'reports', label: t('common.reports'), w: 0.6, render: (c) => reportsCell(c.reports) },
    { key: 'status', label: t('common.status'), render: (c) => statusBadge(c.status) },
  ];
  const actions = (c: AdminCourse): RowAction[] => {
    const a: RowAction[] = [{ label: t('common.preview'), onClick: () => slot.show((close) => <CoursePreview id={c.id} onClose={close} />) }];
    if (c.status === 'published') a.push({ label: t('courses.unpublish'), icon: 'unpublished', onClick: () => unpublish(c) });
    if (c.status === 'draft' || c.status === 'archived') a.push({ label: t('courses.publish'), icon: 'publish', onClick: () => publish(c) });
    if (c.status === 'published' || c.status === 'draft') a.push({ label: t('courses.archive'), icon: 'inventory_2', onClick: () => archive(c) });
    if (c.status !== 'removed') a.push({ label: t('common.remove'), icon: 'delete', danger: true, onClick: () => remove(c) });
    else a.push({ label: t('common.restore'), icon: 'restore', onClick: () => restore(c) });
    a.push({ label: t('common.openCommunity'), icon: 'open_in_new', onClick: () => navigate(`/admin/communities/${c.community.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('common.coursesTitle')} subtitle={t('courses.pageSubtitle')} />
      <DataTable<AdminCourse>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: t('common.all'), count: s?.total },
          { key: 'published', label: t('common.published'), count: s?.published },
          { key: 'draft', label: t('courses.tabDraft'), count: s?.draft },
          { key: 'archived', label: t('courses.tabArchived'), count: s?.archived },
          { key: 'removed', label: t('common.removed'), count: s?.removed },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('courses.searchPlaceholder') }}
        filters={[
          {
            key: 'sort',
            label: t('common.sortBy'),
            value: ts.f.sort,
            options: [
              { value: 'oldest', label: t('common.oldest') },
              { value: 'students', label: t('courses.mostStudents') },
              { value: 'lessons', label: t('courses.mostLessons') },
              { value: 'newest', label: t('common.newest') },
              { value: 'title', label: t('common.nameAZ') },
            ],
            onChange: ts.setFilter('sort'),
          },
        ]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => slot.show((close) => <CoursePreview id={c.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Bài học ================================== */

function LessonPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('admin-content');
  const q = useAdminData<AdminLessonDetail>('content', `/content/lessons/${id}`);
  const d = q.data;
  const video = d?.videoUrl ? resolveApiPath(d.videoUrl) : d?.embedUrl;
  return (
    <PreviewDialog title={d?.title ?? t('common.lesson')} sub={d?.code} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                [t('common.module'), d.module.title ?? d.module.name],
                [t('common.community'), d.community.name],
                [t('common.type'), LESSON_TYPE[d.type] ?? d.type],
                [t('common.duration'), d.durationMin ? t('common.minutes', { n: d.durationMin }) : '—'],
                [t('common.completions'), fmtNum(d.views)],
                [t('common.status'), statusBadge(d.status)],
                [t('common.reports'), String(d.reports)],
                ...(d.moderationReason ? ([[t('common.moderationReason'), d.moderationReason]] as [string, ReactNode][]) : []),
              ]}
            />
            {d.body && (
              <PreviewSection title={t('common.content')}>
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
            <PreviewSection title={t('common.history')}>
              <HistoryList items={d.history} />
            </PreviewSection>
          </>
        )}
      </PreviewBody>
    </PreviewDialog>
  );
}

export function LessonsView() {
  const { t } = useTranslation('admin-content');
  const [params] = useSearchParams();
  const ts = useTableState({ sort: '', status: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/lessons/summary');
  const list = useAdminList<AdminLesson>('content-lessons', '/content/lessons', { q: ts.q || undefined, type: ts.tab || undefined, status: ts.f.status || undefined, sort: ts.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: ts.page, limit: LIMIT });
  const { slot, hide, remove, restore } = useModerateActions('lessons');
  const s = summary.data;

  const columns: Column<AdminLesson>[] = [
    { key: 'lesson', label: t('common.lesson'), w: 2.2, render: (l) => <MainCell name={l.title} sub={l.code} icon={LESSON_ICON[l.type] ?? 'description'} /> },
    { key: 'module', label: t('common.module'), w: 1.5, render: (l) => <TextCell>{l.module.title ?? l.module.name}</TextCell> },
    { key: 'community', label: t('common.community'), w: 1.3, render: (l) => <TextCell>{l.community.name}</TextCell> },
    { key: 'type', label: t('common.type'), render: (l) => <TextCell>{LESSON_TYPE[l.type] ?? l.type}</TextCell> },
    { key: 'views', label: t('lessons.completionsCol'), render: (l) => <NumCell>{fmtNum(l.views)}</NumCell> },
    { key: 'reports', label: t('common.reports'), w: 0.6, render: (l) => reportsCell(l.reports) },
    { key: 'status', label: t('common.status'), render: (l) => statusBadge(l.status) },
  ];
  const actions = (l: AdminLesson): RowAction[] => {
    const a: RowAction[] = [{ label: t('common.preview'), onClick: () => slot.show((close) => <LessonPreview id={l.id} onClose={close} />) }];
    if (l.status === 'published') a.push({ label: t('common.hide'), icon: 'visibility_off', onClick: () => hide(l.id, l.title) });
    if (l.status !== 'removed') a.push({ label: t('common.remove'), icon: 'delete', danger: true, onClick: () => remove(l.id, l.title) });
    if (l.status !== 'published') a.push({ label: t('common.restore'), icon: 'restore', onClick: () => restore(l.id, l.title) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('common.lessonsTitle')} subtitle={t('lessons.pageSubtitle')} />
      <DataTable<AdminLesson>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(l) => l.id}
        tabs={[
          { key: '', label: t('common.all'), count: s?.total },
          { key: 'video', label: 'Video' },
          { key: 'text', label: t('lessons.tabText') },
          { key: 'file', label: t('lessons.tabFile') },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('lessons.searchPlaceholder') }}
        filters={[
          { key: 'status', label: t('common.status'), value: ts.f.status, options: [{ value: 'published', label: t('common.published') }, { value: 'hidden', label: t('common.hidden') }, { value: 'removed', label: t('common.removed') }], onChange: ts.setFilter('status') },
          { key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'views', label: t('lessons.mostCompletions') }, { value: 'title', label: t('common.nameAZ') }], onChange: ts.setFilter('sort') },
        ]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(l) => slot.show((close) => <LessonPreview id={l.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, ts.setPage)}
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
  const { t } = useTranslation('admin-content');
  const q = useAdminData<AdminEventDetail>('content', `/content/events/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d?.title ?? t('common.event')} sub={d?.community.name} onClose={onClose} wide>
      <PreviewBody loading={q.isPending} error={q.error}>
        {d && (
          <>
            <PreviewKv
              items={[
                [t('events.host'), d.host.name],
                [t('events.time'), `${formatDateTime(d.startAt)} (${d.timezone})`],
                [t('events.locationOrLink'), d.meetingLink ?? d.location],
                [t('events.attendees'), d.capacity ? `${d.attendees} / ${d.capacity}` : String(d.attendees)],
                [t('common.status'), statusBadge(d.status)],
                ...(d.cancelReason ? ([[t('events.cancelReason'), d.cancelReason]] as [string, ReactNode][]) : []),
              ]}
            />
            {d.description && (
              <PreviewSection title={t('common.description')}>
                <TextBlock>{d.description}</TextBlock>
              </PreviewSection>
            )}
            <PreviewSection title={t('events.registeredTitle', { n: d.attendees })}>
              {d.rsvps.length === 0 ? (
                <div className="text-[13px] text-stone-400">{t('events.noRegistrations')}</div>
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
            <PreviewSection title={t('common.history')}>
              <HistoryList items={d.history} />
            </PreviewSection>
          </>
        )}
      </PreviewBody>
    </PreviewDialog>
  );
}

function EditEventDialog({ event, onClose }: { event: AdminEvent; onClose: () => void }) {
  const { t } = useTranslation('admin-content');
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
      title={t('events.editTitle')}
      body={event.community.name}
      cta={t('events.saveChanges')}
      disabledExtra={invalid || detail.isPending}
      successMessage={t('events.updated')}
      run={() =>
        act.mutateAsync({
          method: 'PATCH',
          path: `/content/events/${event.id}`,
          body: { title: title.trim(), description: descVal, startAt: new Date(startAt).toISOString(), meetingLink: link.trim() || null, capacity: capNum },
        })
      }
      onClose={onClose}
    >
      <InputField label={t('events.name')} value={title} onChange={setTitle} maxLength={200} />
      <TextAreaField label={t('common.description')} value={descVal} onChange={setDesc} maxLength={2000} />
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-bold">{t('events.startTime')}</div>
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} aria-label={t('events.startTime')} className="h-11 rounded-xl border-[1.5px] border-[#e7e0da] px-[13px] text-sm font-medium outline-0 focus:border-brand" />
      </div>
      <InputField label={t('events.meetingLinkOptional')} value={link} onChange={setLink} placeholder="https://..." />
      <InputField label={t('events.capacity')} value={cap} onChange={setCap} placeholder={t('events.capacityPlaceholder')} />
    </ActionDialog>
  );
}

export function EventsView() {
  const { t } = useTranslation('admin-content');
  const ts = useTableState({ sort: '' }, '');
  const summary = useAdminData<ContentSummary>('content', '/content/events/summary');
  const [params] = useSearchParams();
  const list = useAdminList<AdminEvent>('content-events', '/content/events', { q: ts.q || undefined, status: ts.tab || undefined, sort: ts.f.sort || undefined, communityId: params.get('communityId') ?? params.get('courseId') ?? undefined, page: ts.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/content/events/${id}/${action}`, body });

  const cancel = (e: AdminEvent) =>
    slot.show((close) => (
      <ActionDialog
        icon="event_busy"
        danger
        title={t('events.cancelTitle')}
        body={t('events.cancelBody', { title: e.title, n: e.attendees })}
        cta={t('events.cancelCta')}
        reasons={opts([t('events.reasonPolicy'), t('events.reasonOwnerRequest'), t('events.reasonScheduleConflict'), t('common.other')])}
        requireReason
        flagLabel={t('events.notifyAttendees')}
        successMessage={t('events.canceled')}
        run={(v) => post(e.id, 'cancel', { reason: v.reason, notifyAttendees: v.flag })}
        onClose={close}
      />
    ));
  const remove = (e: AdminEvent) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title={t('events.removeTitle')}
        body={e.title}
        cta={t('events.removeTitle')}
        reasons={USER_REASONS}
        requireReason
        flagLabel={t('events.notifyAttendees')}
        successMessage={t('events.removed')}
        run={(v) => post(e.id, 'remove', { reason: v.reason, notifyAttendees: v.flag })}
        onClose={close}
      />
    ));
  const restore = (e: AdminEvent) =>
    slot.show((close) => <ActionDialog icon="restore" title={t('events.restoreTitle')} body={e.title} cta={t('common.restore')} noteLabel={t('common.noteOptional')} successMessage={t('events.restored')} run={(v) => post(e.id, 'restore', { note: v.note || undefined })} onClose={close} />);

  const columns: Column<AdminEvent>[] = [
    { key: 'event', label: t('common.event'), w: 2, render: (e) => <MainCell name={e.title} sub={e.location ?? undefined} icon="event" /> },
    { key: 'community', label: t('common.community'), w: 1.4, render: (e) => <TextCell>{e.community.name}</TextCell> },
    { key: 'host', label: t('events.host'), render: (e) => personName(e.host) },
    { key: 'att', label: t('events.attending'), render: (e) => <NumCell>{e.capacity ? `${e.attendees}/${e.capacity}` : e.attendees}</NumCell> },
    { key: 'date', label: t('common.date'), render: (e) => <MutedCell>{formatDateTime(e.startAt)}</MutedCell> },
    { key: 'status', label: t('common.status'), render: (e) => statusBadge(e.status) },
    { key: 'reports', label: t('common.reports'), w: 0.6, render: (e) => reportsCell(e.reports) },
  ];
  const actions = (e: AdminEvent): RowAction[] => {
    const a: RowAction[] = [{ label: t('common.view'), onClick: () => slot.show((close) => <EventPreview id={e.id} onClose={close} />) }];
    if (e.status === 'upcoming' || e.status === 'live') {
      a.push({ label: t('common.edit'), icon: 'edit', onClick: () => slot.show((close) => <EditEventDialog event={e} onClose={close} />) });
      a.push({ label: t('common.cancel'), icon: 'event_busy', danger: true, onClick: () => cancel(e) });
    }
    if (e.status !== 'removed') a.push({ label: t('common.remove'), icon: 'delete', danger: true, onClick: () => remove(e) });
    if (e.status === 'cancelled' || e.status === 'removed') a.push({ label: t('common.restore'), icon: 'restore', onClick: () => restore(e) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('common.eventsTitle')} subtitle={t('events.pageSubtitle')} />
      <DataTable<AdminEvent>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(e) => e.id}
        tabs={[
          { key: '', label: t('common.all'), count: s?.total },
          { key: 'upcoming', label: t('events.tabUpcoming'), count: s?.upcoming },
          { key: 'live', label: t('events.tabLive'), count: s?.live },
          { key: 'completed', label: t('common.completed'), count: s?.completed },
          { key: 'cancelled', label: t('events.tabCanceled'), count: s?.cancelled },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('events.searchPlaceholder') }}
        filters={[{ key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'newest', label: t('events.recentlyCreated') }, { value: 'startAt', label: t('events.byEventDate') }], onChange: ts.setFilter('sort') }]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(e) => slot.show((close) => <EventPreview id={e.id} onClose={close} />)}
        actions={actions}
        page={pageOf(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Media ================================== */

const kindOptions = (t: TFunction) => [
  { value: '', label: t('common.all') },
  { value: 'image', label: t('media.kindImage') },
  { value: 'video', label: 'Video' },
  { value: 'document', label: t('media.kindDocument') },
  { value: 'audio', label: t('media.kindAudio') },
] as const;
const mediaStatusOptions = (t: TFunction) => [
  { value: '', label: t('media.anyStatus') },
  { value: 'active', label: t('common.active') },
  { value: 'flagged', label: t('media.flaggedStatus') },
  { value: 'removed', label: t('common.removed') },
] as const;
const viewOptions = (t: TFunction) => [
  { value: 'grid', label: t('media.viewGrid') },
  { value: 'table', label: t('media.viewTable') },
] as const;
const MEDIA_LIMIT = 24;
const KIND_ICON: Record<string, string> = { image: 'image', video: 'movie', document: 'description', audio: 'graphic_eq' };

export function MediaView() {
  const { t } = useTranslation('admin-content');
  const toast = useToast();
  const [params] = useSearchParams();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [kind, setKind] = useState<ReturnType<typeof kindOptions>[number]['value']>('');
  const [status, setStatus] = useState<ReturnType<typeof mediaStatusOptions>[number]['value']>('');
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
    if (m.url) openFile(m.url).catch((e) => toast.error(errMessage(e, t('media.openFailed'))));
  };
  const download = async (m: AdminMedia) => {
    try {
      await apiDownload(`/admin/content/media/${encodeURIComponent(m.key)}/download`, m.filename);
    } catch (e) {
      toast.error(errMessage(e, t('media.downloadFailed')));
    }
  };
  const flag = (m: AdminMedia) => slot.show((close) => <ActionDialog icon="flag" title={t('media.flagTitle')} body={m.filename} cta={t('media.flag')} reasons={USER_REASONS} requireReason successMessage={t('media.flagged')} run={(v) => post(m.key, 'flag', { reason: v.reason })} onClose={close} />);
  const unflag = (m: AdminMedia) =>
    slot.show((close) => <ActionDialog icon="outlined_flag" title={t('media.unflagTitle')} body={m.filename} cta={t('media.unflag')} noteLabel={t('common.noteOptional')} successMessage={t('media.unflagged')} run={(v) => post(m.key, 'unflag', { note: v.note || undefined })} onClose={close} />);
  const remove = (m: AdminMedia) =>
    slot.show((close) => (
      <ActionDialog
        icon="delete"
        danger
        title={t('media.removeTitle')}
        body={t('media.removeBody', { name: m.filename })}
        cta={t('media.removeTitle')}
        reasons={USER_REASONS}
        requireReason
        flagLabel={t('media.notifyOwner')}
        successMessage={t('media.removed')}
        run={(v) => post(m.key, 'remove', { reason: v.reason, notifyOwner: v.flag })}
        onClose={close}
      />
    ));
  const restore = (m: AdminMedia) =>
    slot.show((close) => <ActionDialog icon="restore" title={t('media.restoreTitle')} body={m.filename} cta={t('common.restore')} noteLabel={t('common.noteOptional')} successMessage={t('media.restored')} run={(v) => post(m.key, 'restore', { note: v.note || undefined })} onClose={close} />);

  const cards: MediaCardItem[] = items.map((m) => ({
    id: m.key,
    kind: m.kind,
    name: m.filename,
    meta: `${fmtBytes(m.size)} · ${(m.owner?.name ?? '—')} · ${formatRelative(m.uploadedAt)}`,
    // Chỉ ảnh công khai có thumbnail trực tiếp; file riêng tư cần URL ký nên xem qua nút Xem trước.
    thumbUrl: m.url && ['avatar', 'cover', 'post_image'].includes(m.purpose) ? resolveApiPath(m.url) : null,
    reports: m.reports,
    buttons: [
      ...(m.status !== 'removed' ? [{ icon: 'visibility', label: t('common.preview'), onClick: () => preview(m) }] : []),
      { icon: 'download', label: t('media.download'), onClick: () => void download(m) },
      m.status === 'removed' ? { icon: 'restore', label: t('common.restore'), onClick: () => restore(m) } : { icon: 'delete', label: t('common.remove'), danger: true, onClick: () => remove(m) },
    ],
  }));

  const columns: Column<AdminMedia>[] = [
    { key: 'name', label: t('media.fileName'), w: 2, render: (m) => <MainCell name={m.filename} sub={MEDIA_KIND_LABEL[m.kind] ?? m.kind} icon={KIND_ICON[m.kind] ?? 'draft'} /> },
    { key: 'owner', label: t('media.owner'), render: (m) => personName(m.owner) },
    { key: 'community', label: t('common.community'), w: 1.4, render: (m) => <TextCell>{m.community?.name ?? '—'}</TextCell> },
    { key: 'size', label: t('media.size'), render: (m) => <MutedCell>{fmtBytes(m.size)}</MutedCell> },
    { key: 'reports', label: t('common.reports'), w: 0.6, render: (m) => reportsCell(m.reports) },
    { key: 'status', label: t('common.status'), render: (m) => statusBadge(m.status) },
    { key: 'up', label: t('media.uploaded'), render: (m) => <MutedCell>{formatRelative(m.uploadedAt)}</MutedCell> },
  ];
  const actions = (m: AdminMedia): RowAction[] => {
    const a: RowAction[] = [];
    if (m.status !== 'removed') a.push({ label: t('common.preview'), onClick: () => preview(m) });
    a.push({ label: t('media.download'), icon: 'download', onClick: () => void download(m) });
    if (m.status === 'active') a.push({ label: t('media.flag'), icon: 'flag', onClick: () => flag(m) });
    if (m.status === 'flagged') a.push({ label: t('media.unflag'), icon: 'outlined_flag', onClick: () => unflag(m) });
    if (m.status !== 'removed') a.push({ label: t('common.remove'), icon: 'delete', danger: true, onClick: () => remove(m) });
    else a.push({ label: t('common.restore'), icon: 'restore', onClick: () => restore(m) });
    return a;
  };

  const viewTools = <Segment options={viewOptions(t)} value={view} onChange={setView} small label={t('media.viewMode')} />;
  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <Segment
        options={kindOptions(t)}
        value={kind}
        onChange={(v) => {
          setKind(v);
          setPage(1);
        }}
        label={t('media.fileType')}
      />
      <Segment
        options={mediaStatusOptions(t)}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        label={t('common.status')}
      />
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        placeholder={t('media.searchPlaceholder')}
        className="max-w-[320px]"
      />
    </div>
  );

  return (
    <>
      <PageHeader title="Media" subtitle={t('media.pageSubtitle')} />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'perm_media', label: t('media.totalFiles'), value: fmtNum(s.total) },
            { icon: 'hard_drive', label: t('common.storage'), value: fmtBytes(s.totalSizeBytes) },
            { icon: 'flag', label: t('media.flaggedStatus'), value: fmtNum(s.flagged), bad: true },
            { icon: 'delete', label: t('common.removed'), value: fmtNum(s.removed) },
          ]}
        />
      )}
      {toolbar}
      {list.isPending ? (
        <Card title={t('media.library')}>
          <LoadingBlock />
        </Card>
      ) : list.isError ? (
        <Card title={t('media.library')}>
          <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : view === 'grid' ? (
        <>
          <MediaGrid title={t('media.library')} sub={t('media.count', { n: fmtNum(meta?.total ?? items.length) })} tools={viewTools} items={cards} />
          {meta && meta.totalPages > 1 && (
            <div className="flex justify-end">
              <TablePager info={{ page: meta.page, totalPages: meta.totalPages, total: meta.total, limit: MEDIA_LIMIT, onPage: setPage }} />
            </div>
          )}
        </>
      ) : (
        <DataTable<AdminMedia>
          title={t('media.library')}
          sub={t('media.count', { n: fmtNum(meta?.total ?? items.length) })}
          headTools={viewTools}
          columns={columns}
          rows={items}
          rowKey={(m) => m.key}
          actions={actions}
          emptyText={t('media.empty')}
          page={pageOf(meta, setPage, MEDIA_LIMIT)}
        />
      )}
      {slot.el}
    </>
  );
}
