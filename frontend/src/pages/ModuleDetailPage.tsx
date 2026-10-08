import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { classroomPath, communityCheckout } from '../lib/paths';
import { useCommunityDetail } from '../features/courses/queries';
import { ConfirmDialog, errText, ErrorNote, ghostBtn, isModPlus, primaryBtn, safeUrl, toast, ToastHost } from '../features/community/components/contentUi';
import { LessonList, lockText } from '../features/community/components/ClassroomTab';
import { useCourseList, useDeleteModule, useModules } from '../features/community/queries';

/** Trang chi tiết một module: thông tin + danh sách bài học; bấm từng bài mới sang trang học. */
export function ModuleDetailPage() {
  const { t } = useTranslation('community');
  const { id: communityId = '', moduleId = '' } = useParams();
  const [sp] = useSearchParams();
  const { data: community } = useCommunityDetail(communityId);
  const courseList = useCourseList(communityId);
  const courseId = sp.get('khoa') ?? courseList.data?.[0]?.id ?? null;
  const modules = useModules(communityId, courseId);
  const back = classroomPath(communityId, courseId);
  const navigate = useNavigate();
  const removeModule = useDeleteModule(communityId, courseId ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (courseList.isPending || (courseId && modules.isPending)) return <p className="py-10 text-center text-stone-400">{t('classroom.loading')}</p>;
  if (modules.isError) return <ErrorNote message={errText(modules.error, t('classroom.loadFailed'))} />;

  const m = modules.data?.find((x) => x.id === moduleId);
  if (!m || !courseId) {
    return (
      <div className="glass mx-auto flex max-w-xl flex-col items-center gap-3 rounded-3xl p-8 text-center">
        <h1 className="m-0 text-xl font-extrabold">{t('classroom.moduleNotFound')}</h1>
        <Link to={back} className={primaryBtn}>{t('classroom.backToClassroom')}</Link>
      </div>
    );
  }

  const staff = isModPlus(community?.viewerRole);
  const payUrl = m.locked && !staff && (m.lockReason === 'paid' || (community?.priceUsd ?? 0) > 0) ? communityCheckout(communityId) : undefined;
  const thumb = safeUrl(m.thumbnail);

  return (
    <div className="flex flex-col gap-4">
      <ToastHost />
      <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-stone-500">
        <Link to={back} className="hover:text-brand">{t('classroom.backToClassroom')}</Link>
        <MaterialIcon name="chevron_right" size={16} />
        <span className="truncate">#{m.index - 1}: {m.title}</span>
      </nav>

      <section className="glass overflow-hidden rounded-3xl">
        {thumb && <img src={thumb} alt={m.title} className="h-[200px] w-full object-cover" />}
        <div className="flex flex-col gap-2 p-5">
          <h1 className="m-0 text-[24px] leading-tight font-extrabold tracking-tight">#{m.index - 1}: {m.title}</h1>
          {m.description && <p className="m-0 text-sm text-stone-600">{m.description}</p>}
          <div className="mt-1 flex items-center gap-2.5">
            <span className="rounded-lg bg-brand/10 px-2 py-1 text-[11.5px] font-bold">{m.pct}%</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(120,60,20,.08)]">
              <div className="h-full rounded-full bg-brand" style={{ width: `${m.pct}%` }} />
            </div>
            <span className="text-xs text-stone-500">{m.completedCount}/{m.lessonsCount}</span>
          </div>
          {staff && (
            <div className="mt-2">
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${ghostBtn} !border-red-200 !text-red-600`}>
                {t('editor.row.deleteModule')}
              </button>
            </div>
          )}
          {m.locked && (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">
              <MaterialIcon name="lock" size={18} filled color="#b45309" />
              <span className="flex-1">{lockText(m)}</span>
              {payUrl && <Link to={payUrl} className="rounded-xl bg-brand px-4 py-1.5 text-[13px] font-bold text-white">{t('classroom.unlockBuy')}</Link>}
            </div>
          )}
        </div>
      </section>

      <section className="glass overflow-hidden rounded-2xl">
        <div className="px-4 py-3 text-[15px] font-bold">{t('classroom.lessonsOfModule')}</div>
        <LessonList communityId={communityId} courseId={courseId} moduleId={m.id} payUrl={payUrl} canManage={staff} />
      </section>
      {confirmDelete && (
        <ConfirmDialog
          title={t('editor.deleteModuleTitle')}
          message={t('editor.deleteModuleMsg', { title: m.title, lessons: m.lessonsCount })}
          confirmLabel={t('editor.deleteModuleConfirm')}
          pending={removeModule.isPending}
          error={removeModule.isError ? errText(removeModule.error) : null}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => removeModule.mutate(m.id, { onSuccess: () => { toast(t('editor.moduleDeleted')); navigate(back); } })}
        />
      )}
    </div>
  );
}
