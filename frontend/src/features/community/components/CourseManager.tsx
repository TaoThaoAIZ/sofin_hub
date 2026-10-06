import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useArchiveCourse, useClassroomSettings, useCourseList, useCreateCourse, useDeleteCourse, useReorderCourses, useUpdateCourse } from '../queries';
import type { LearningCourse } from '../types';
import { areaCls, ConfirmDialog, Dialog, errText, ErrorNote, FieldLabel, ghostBtn, inputCls, primaryBtn, safeUrl, toast } from './contentUi';
import { CoverField } from './CoverField';

const iconBtn = 'grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30';
const su = (u: string | null | undefined) => safeUrl(u ?? undefined);

export const publishLabel = (s: LearningCourse['publishStatus']) => i18n.t(`publish.${s}`, { ns: 'community' });
export const publishBadgeCls = (s: LearningCourse['publishStatus']) =>
  s === 'published' ? 'bg-emerald-50 text-emerald-700' : s === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-500';

/** Chứng nhận theo khóa: kế thừa cài đặt cộng đồng (null) hoặc ghi đè bật/tắt. Chỉ admin trở lên sửa được. */
export function CertModeSelect({
  value,
  communityDefault,
  onChange,
  disabled,
}: {
  value: boolean | null;
  communityDefault?: boolean;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('community');
  return (
    <label className="flex items-center gap-2 text-[13px] font-medium">
      {t('certMode.label')}
      <select
        value={value === null ? 'inherit' : value ? 'on' : 'off'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'inherit' ? null : e.target.value === 'on')}
        aria-label={t('certMode.aria')}
        className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2 text-[13px]"
      >
        <option value="inherit">{communityDefault === undefined ? t('certMode.inherit') : communityDefault ? t('certMode.inheritOn') : t('certMode.inheritOff')}</option>
        <option value="on">{t('certMode.on')}</option>
        <option value="off">{t('certMode.off')}</option>
      </select>
    </label>
  );
}

function CourseFormDialog({ communityId, course, isAdmin, onClose }: { communityId: string; course?: LearningCourse; isAdmin: boolean; onClose: () => void }) {
  const { t } = useTranslation('community');
  const create = useCreateCourse(communityId);
  const update = useUpdateCourse(communityId);
  const settings = useClassroomSettings(communityId);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [thumb, setThumb] = useState(course?.thumbnailUrl ?? '');
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>(course?.publishStatus ?? 'published');
  const [cert, setCert] = useState<boolean | null>(course?.certificatesEnabled ?? null);
  const pending = create.isPending || update.isPending;
  const err = create.isError ? errText(create.error) : update.isError ? errText(update.error) : null;

  const submit = () => {
    const done = {
      onSuccess: () => {
        toast(course ? t('courseForm.toastUpdated') : t('courseForm.toastCreated'));
        onClose();
      },
    };
    if (course) {
      update.mutate(
        {
          courseId: course.id,
          body: {
            title: title.trim(),
            description: description.trim(),
            thumbnailUrl: thumb.trim() || null,
            ...(status !== 'archived' ? { publishStatus: status } : {}),
            ...(isAdmin && cert !== course.certificatesEnabled ? { certificatesEnabled: cert } : {}),
          },
        },
        done,
      );
    } else {
      create.mutate(
        { title: title.trim(), description: description.trim(), thumbnailUrl: thumb.trim() || undefined, publishStatus: status === 'draft' ? 'draft' : 'published' },
        done,
      );
    }
  };

  return (
    <Dialog
      title={course ? t('courseForm.titleEdit') : t('courseForm.titleAdd')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            {t('ui.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={pending || !title.trim()} className={primaryBtn}>
            {pending ? t('courseForm.saving') : t('courseForm.save')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <CoverField value={thumb} onChange={setThumb} onError={setUploadError} ariaLabel={t('courseForm.thumbAria')} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div>
              <FieldLabel>{t('dialogForm.courseName')}</FieldLabel>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('courseForm.name')} aria-label={t('courseForm.name')} className={inputCls} />
            </div>
            <div>
              <FieldLabel>{t('dialogForm.shortDesc')}</FieldLabel>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={4} placeholder={t('courseForm.descPh')} aria-label={t('courseForm.descPh')} className={areaCls} />
            </div>
          </div>
        </div>
        <div>
          <FieldLabel>{t('dialogForm.status')}</FieldLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['published', t('courseForm.optPublished')], ['draft', t('courseForm.optDraft')]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatus(v)}
                aria-pressed={status === v}
                className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left text-[13.5px] font-semibold ${status === v ? 'border-brand bg-brand-soft text-stone-900' : 'border-[rgba(120,60,20,.12)] bg-white text-stone-700 hover:border-brand/50'}`}
              >
                <span className={`grid size-5 flex-none place-items-center rounded-full border-2 ${status === v ? 'border-brand' : 'border-stone-300'}`}>
                  {status === v && <span className="size-2.5 rounded-full bg-brand" />}
                </span>
                {label}
              </button>
            ))}
          </div>
          {course?.publishStatus === 'archived' && <p className="mt-2 mb-0 text-xs text-stone-500">{t('publish.archived')}</p>}
        </div>
        {isAdmin && course && <CertModeSelect value={cert} communityDefault={settings.data?.certificatesEnabled} onChange={setCert} />}
        <ErrorNote message={err ?? uploadError} />
      </div>
    </Dialog>
  );
}

/** Quản lý các khóa học của cộng đồng (mod+ tạo/sửa/sắp xếp/lưu trữ; admin+ xóa & chứng nhận). Dùng ở tab Lớp học và trang cài đặt. */
export function CourseManager({ communityId, isAdmin }: { communityId: string; isAdmin: boolean }) {
  const { t } = useTranslation('community');
  const list = useCourseList(communityId);
  const reorder = useReorderCourses(communityId);
  const archive = useArchiveCourse(communityId);
  const remove = useDeleteCourse(communityId);
  const [editing, setEditing] = useState<LearningCourse | 'new' | null>(null);
  const [deleting, setDeleting] = useState<LearningCourse | null>(null);
  const courses = list.data ?? [];

  const move = (i: number, dir: -1 | 1) => {
    const ids = courses.map((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids, { onError: (e) => toast(errText(e), 'error') });
  };

  return (
    <section className="flex flex-col gap-3" aria-label={t('courseManager.aria')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[17px] font-extrabold">{t('courseManager.heading')}</h2>
          <p className="m-0 mt-0.5 text-[12.5px] text-stone-500">
            {t('courseManager.desc')}
          </p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
          <MaterialIcon name="add" size={19} color="#fff" /> {t('courseManager.add')}
        </button>
      </div>
      {list.isPending && <p className="m-0 text-sm text-stone-400">{t('courseManager.loading')}</p>}
      {list.isError && <ErrorNote message={errText(list.error, t('courseManager.loadFailed'))} />}
      {list.isSuccess && courses.length === 0 && <p className="m-0 py-4 text-center text-sm text-stone-500">{t('courseManager.empty')}</p>}
      {courses.map((c, i) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(120,60,20,.1)] bg-white px-3 py-2.5">
          <div className="size-12 flex-none overflow-hidden rounded-xl bg-brand/10">
            {su(c.thumbnailUrl) ? (
              <img src={su(c.thumbnailUrl)!} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center">
                <MaterialIcon name="school" size={22} color="#f26a1b" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[14.5px] font-bold">{c.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${publishBadgeCls(c.publishStatus)}`}>{publishLabel(c.publishStatus)}</span>
              {c.isDefault && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{t('courseManager.default')}</span>}
            </div>
            <div className="truncate text-[12px] text-stone-500">
              {t('courseManager.summary', {
                modules: c.modulesCount,
                lessons: c.lessonsCount,
                state: c.certificatesEffective ? t('courseManager.certOn') : t('courseManager.certOff'),
                inherit: c.certificatesEnabled === null ? t('courseManager.byCommunity') : '',
              })}
            </div>
          </div>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} aria-label={t('courseManager.moveUp')} className={iconBtn}>
            <MaterialIcon name="arrow_upward" size={19} />
          </button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === courses.length - 1 || reorder.isPending} aria-label={t('courseManager.moveDown')} className={iconBtn}>
            <MaterialIcon name="arrow_downward" size={19} />
          </button>
          <button type="button" onClick={() => setEditing(c)} aria-label={t('courseManager.edit')} className={iconBtn}>
            <MaterialIcon name="edit" size={19} />
          </button>
          {c.publishStatus !== 'archived' && (
            <button
              type="button"
              disabled={archive.isPending}
              onClick={() => archive.mutate(c.id, { onSuccess: () => toast(t('courseManager.archived')), onError: (e) => toast(errText(e), 'error') })}
              aria-label={t('courseManager.archive')}
              title={t('courseManager.archiveTitle')}
              className={iconBtn}
            >
              <MaterialIcon name="inventory_2" size={19} />
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={() => setDeleting(c)} aria-label={t('courseManager.delete')} className={`${iconBtn} hover:!text-red-600`}>
              <MaterialIcon name="delete" size={19} />
            </button>
          )}
        </div>
      ))}
      {editing && <CourseFormDialog communityId={communityId} course={editing === 'new' ? undefined : editing} isAdmin={isAdmin} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('courseManager.deleteTitle')}
          message={t('courseManager.deleteMsg', { title: deleting.title, modules: deleting.modulesCount, lessons: deleting.lessonsCount })}
          confirmLabel={t('courseManager.deleteConfirm')}
          pending={remove.isPending}
          error={remove.isError ? errText(remove.error) : null}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
                toast(t('courseManager.deleted'));
              },
            })
          }
        />
      )}
    </section>
  );
}
