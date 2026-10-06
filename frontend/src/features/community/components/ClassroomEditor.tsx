import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useUpload } from '../../uploads/useUpload';
import {
  useClassroomSettings,
  useCreateLesson,
  useCreateModule,
  useDeleteLesson,
  useDeleteModule,
  useLessons,
  useReorderLessons,
  useReorderModules,
  useUpdateCourse,
  useUpdateLesson,
  useUpdateModule,
} from '../queries';
import type { ClassroomLesson, ClassroomModule, LearningCourse, LessonAttachment } from '../types';
import { CertModeSelect } from './CourseManager';
import { absoluteUrl, areaCls, ConfirmDialog, Dialog, errText, ErrorNote, ghostBtn, inputCls, primaryBtn, toast } from './contentUi';

const iconBtn = 'grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30';

// ---------------------------------------------------------------- Form module
export function ModuleFormDialog({ communityId, courseId, module, onClose }: { communityId: string; courseId: string; module?: ClassroomModule; onClose: () => void }) {
  const { t } = useTranslation('community');
  const create = useCreateModule(communityId, courseId);
  const update = useUpdateModule(communityId, courseId);
  const { upload, uploading, error: uploadError } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(module?.title ?? '');
  const [description, setDescription] = useState(module?.description ?? '');
  const [thumbnail, setThumbnail] = useState(module?.thumbnail ?? '');
  const [level, setLevel] = useState(module?.requiredLevel ? String(module.requiredLevel) : '');
  const pending = create.isPending || update.isPending;
  const err = create.isError ? errText(create.error) : update.isError ? errText(update.error) : null;

  const submit = () => {
    const done = { onSuccess: () => { toast(module ? t('editor.module.toastUpdated') : t('editor.module.toastCreated')); onClose(); } };
    if (module) {
      update.mutate(
        { moduleId: module.id, body: { title: title.trim(), description: description.trim(), thumbnail: thumbnail.trim() || null, requiredLevel: level ? Number(level) : null } },
        done,
      );
    } else {
      create.mutate(
        { title: title.trim(), description: description.trim(), thumbnail: thumbnail.trim() || undefined, requiredLevel: level ? Number(level) : undefined },
        done,
      );
    }
  };

  return (
    <Dialog
      title={module ? t('editor.module.titleEdit') : t('editor.module.titleAdd')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            {t('ui.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={pending || uploading || !title.trim()} className={primaryBtn}>
            {pending ? t('courseForm.saving') : t('courseForm.save')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('editor.module.name')} aria-label={t('editor.module.name')} className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder={t('editor.module.descPh')} aria-label={t('editor.module.descAria')} className={areaCls} />
        <div className="flex gap-2">
          <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder={t('courseForm.thumbPh')} aria-label={t('editor.module.thumbAria')} className={inputCls} />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const up = await upload(f, { purpose: 'cover' });
                setThumbnail(absoluteUrl(up.url));
              } catch {
                /* lỗi hiển thị qua uploadError */
              }
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={`${ghostBtn} flex-none`}>
            {uploading ? t('courseForm.uploading') : t('courseForm.uploadBtn')}
          </button>
        </div>
        {thumbnail && <img src={thumbnail} alt={t('courseForm.previewAlt')} className="h-28 w-full rounded-xl object-cover" />}
        <label className="flex items-center gap-2 text-[13px]">
          {t('editor.module.minLevel')}
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t('editor.module.levelAria')} className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2">
            <option value="">{t('editor.module.noReq')}</option>
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {t('editor.module.levelN', { n: i + 1 })}
              </option>
            ))}
          </select>
        </label>
        <ErrorNote message={err ?? uploadError} />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Form bài học
export function LessonFormDialog({ communityId, courseId, moduleId: initialModuleId, modules, lesson, onClose }: { communityId: string; courseId: string; moduleId: string; /** Có danh sách thì cho chọn module khi tạo bài học mới. */ modules?: ClassroomModule[]; lesson?: ClassroomLesson; onClose: () => void }) {
  const { t } = useTranslation('community');
  const [moduleId, setModuleId] = useState(initialModuleId);
  const create = useCreateLesson(communityId, courseId);
  const update = useUpdateLesson(communityId);
  const { upload, uploading, error: uploadError } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [type, setType] = useState<'video' | 'text' | 'file'>(lesson?.type ?? 'video');
  const [duration, setDuration] = useState(String(lesson?.durationMin ?? 10));
  const [body, setBody] = useState(lesson?.body ?? '');
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? '');
  const [attachments, setAttachments] = useState<LessonAttachment[]>(lesson?.attachments ?? []);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const err = localErr ?? (create.isError ? errText(create.error) : update.isError ? errText(update.error) : null);

  const submit = () => {
    setLocalErr(null);
    const dur = Number(duration);
    if (!Number.isInteger(dur) || dur < 0 || dur > 1000) {
      setLocalErr(t('editor.lesson.durationErr'));
      return;
    }
    const done = { onSuccess: () => { toast(lesson ? t('editor.lesson.toastUpdated') : t('editor.lesson.toastCreated')); onClose(); } };
    const url = videoUrl.trim();
    if (lesson) {
      update.mutate({ lessonId: lesson.id, body: { title: title.trim(), type, durationMin: dur, body, videoUrl: url || null, attachments } }, done);
    } else {
      create.mutate({ moduleId, body: { title: title.trim(), type, durationMin: dur, body, videoUrl: url || undefined, attachments } }, done);
    }
  };

  return (
    <Dialog
      wide
      title={lesson ? t('editor.lesson.titleEdit') : t('editor.lesson.titleAdd')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            {t('ui.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={pending || uploading || !title.trim()} className={primaryBtn}>
            {pending ? t('courseForm.saving') : t('courseForm.save')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {!lesson && modules && modules.length > 0 && (
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} aria-label={t('editor.lesson.moduleAria')} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-sm">
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.index - 1}: {m.title}
              </option>
            ))}
          </select>
        )}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('editor.lesson.titlePh')} aria-label={t('editor.lesson.titlePh')} className={inputCls} />
        <div className="flex flex-wrap gap-2.5">
          <select value={type} onChange={(e) => setType(e.target.value as 'video' | 'text' | 'file')} aria-label={t('editor.lesson.typeAria')} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-sm">
            <option value="video">{t('editor.lesson.typeVideo')}</option>
            <option value="text">{t('editor.lesson.typeText')}</option>
            <option value="file">{t('editor.lesson.typeFile')}</option>
          </select>
          <label className="flex items-center gap-2 text-[13px]">
            {t('editor.lesson.duration')}
            <input type="number" min={0} max={1000} value={duration} onChange={(e) => setDuration(e.target.value)} aria-label={t('editor.lesson.durationAria')} className="h-10 w-20 rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-sm" />
            {t('editor.lesson.minutes')}
          </label>
        </div>
        {type === 'video' && (
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder={t('editor.lesson.videoPh')} aria-label={t('editor.lesson.videoAria')} className={inputCls} />
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={50000} placeholder={t('editor.lesson.bodyPh')} aria-label={t('editor.lesson.bodyAria')} className={areaCls} />

        <div className="rounded-xl border border-[rgba(120,60,20,.1)] p-3">
          <div className="mb-2 text-[13px] font-semibold">{t('editor.lesson.attachments', { n: attachments.length })}</div>
          {attachments.map((a, i) => (
            <div key={a.url + i} className="mb-1.5 flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-[13px]">
              <MaterialIcon name="attach_file" size={16} />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <button type="button" aria-label={t('editor.lesson.removeFile', { name: a.name })} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600">
                <MaterialIcon name="close" size={16} />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const up = await upload(f, { purpose: 'lesson_attachment', courseId: communityId });
                  setAttachments((cur) => [...cur, { name: up.name, url: absoluteUrl(up.url), size: up.size }]);
                } catch {
                  /* lỗi hiển thị qua uploadError */
                }
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= 20} className={ghostBtn}>
              {uploading ? t('courseForm.uploading') : t('editor.lesson.uploadFile')}
            </button>
            <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder={t('editor.lesson.displayName')} aria-label={t('editor.lesson.linkNameAria')} className={`${inputCls} !w-36`} />
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder={t('editor.lesson.urlPh')} aria-label={t('editor.lesson.urlAria')} className={`${inputCls} !w-52 flex-1`} />
            <button
              type="button"
              disabled={!linkUrl.trim() || attachments.length >= 20}
              onClick={() => {
                setAttachments([...attachments, { name: linkName.trim() || linkUrl.trim(), url: linkUrl.trim() }]);
                setLinkName('');
                setLinkUrl('');
              }}
              className={ghostBtn}
            >
              {t('editor.lesson.add')}
            </button>
          </div>
        </div>
        <ErrorNote message={err ?? uploadError} />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Một module trong trình soạn
function ModuleRow({
  communityId,
  courseId,
  module,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
}: {
  communityId: string;
  courseId: string;
  module: ClassroomModule;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('community');
  const [open, setOpen] = useState(false);
  const lessons = useLessons(communityId, courseId, open ? module.id : null);
  const reorder = useReorderLessons(communityId, courseId);
  const removeLesson = useDeleteLesson(communityId);
  const [editingLesson, setEditingLesson] = useState<ClassroomLesson | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ClassroomLesson | null>(null);

  const moveLesson = (i: number, dir: -1 | 1) => {
    const ids = (lessons.data ?? []).map((l) => l.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate({ moduleId: module.id, ids }, { onError: (e) => toast(errText(e), 'error') });
  };

  return (
    <div className="rounded-2xl border border-[rgba(120,60,20,.1)] bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? t('editor.row.collapse') : t('editor.row.expand')} className={iconBtn}>
          <MaterialIcon name={open ? 'expand_less' : 'expand_more'} size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold">
            #{module.index}: {module.title}
          </div>
          <div className="truncate text-[12px] text-stone-500">
            {t('editor.row.lessonsCount', { count: module.lessonsCount })}
            {module.requiredLevel ? t('editor.row.requires', { level: module.requiredLevel }) : ''}
          </div>
        </div>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={t('editor.row.moduleUp')} className={iconBtn}>
          <MaterialIcon name="arrow_upward" size={19} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={t('editor.row.moduleDown')} className={iconBtn}>
          <MaterialIcon name="arrow_downward" size={19} />
        </button>
        <button type="button" onClick={onEdit} aria-label={t('editor.row.editModule')} className={iconBtn}>
          <MaterialIcon name="edit" size={19} />
        </button>
        <button type="button" onClick={onDelete} aria-label={t('editor.row.deleteModule')} className={`${iconBtn} hover:!text-red-600`}>
          <MaterialIcon name="delete" size={19} />
        </button>
      </div>
      {open && (
        <div className="border-t border-[rgba(120,60,20,.08)] bg-[#fdfbfa] p-3">
          {lessons.isPending && <p className="m-0 text-sm text-stone-400">{t('editor.row.loadingLessons')}</p>}
          {lessons.isError && <ErrorNote message={errText(lessons.error)} />}
          {lessons.data?.length === 0 && <p className="m-0 mb-2 text-sm text-stone-400">{t('editor.row.noLessons')}</p>}
          {lessons.data?.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white">
              <MaterialIcon name={l.type === 'video' ? 'play_circle' : l.type === 'file' ? 'attach_file' : 'article'} size={19} color="#78716c" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{l.title}</div>
                <div className="text-[11.5px] text-stone-400">{t('editor.row.lessonMinutes', { n: l.durationMin })}</div>
              </div>
              <button type="button" onClick={() => moveLesson(i, -1)} disabled={i === 0 || reorder.isPending} aria-label={t('editor.row.lessonUp')} className={iconBtn}>
                <MaterialIcon name="arrow_upward" size={18} />
              </button>
              <button type="button" onClick={() => moveLesson(i, 1)} disabled={i === (lessons.data?.length ?? 0) - 1 || reorder.isPending} aria-label={t('editor.row.lessonDown')} className={iconBtn}>
                <MaterialIcon name="arrow_downward" size={18} />
              </button>
              <button type="button" onClick={() => setEditingLesson(l)} aria-label={t('editor.row.editLesson')} className={iconBtn}>
                <MaterialIcon name="edit" size={18} />
              </button>
              <button type="button" onClick={() => setDeleting(l)} aria-label={t('editor.row.deleteLesson')} className={`${iconBtn} hover:!text-red-600`}>
                <MaterialIcon name="delete" size={18} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setEditingLesson('new')} className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-brand">
            <MaterialIcon name="add" size={18} color="#f26a1b" /> {t('editor.row.addLesson')}
          </button>
        </div>
      )}
      {editingLesson && (
        <LessonFormDialog communityId={communityId} courseId={courseId} moduleId={module.id} lesson={editingLesson === 'new' ? undefined : editingLesson} onClose={() => setEditingLesson(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('editor.row.deleteLessonTitle')}
          message={t('editor.row.deleteLessonMsg', { title: deleting.title })}
          confirmLabel={t('editor.row.deleteLessonConfirm')}
          pending={removeLesson.isPending}
          error={removeLesson.isError ? errText(removeLesson.error) : null}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeLesson.mutate(deleting.id, { onSuccess: () => { setDeleting(null); toast(t('editor.row.lessonDeleted')); } })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Trình soạn
export function ClassroomEditor({ communityId, course, modules, isAdmin }: { communityId: string; course: LearningCourse; modules: ClassroomModule[]; isAdmin: boolean }) {
  const { t } = useTranslation('community');
  const reorder = useReorderModules(communityId, course.id);
  const removeModule = useDeleteModule(communityId, course.id);
  const settings = useClassroomSettings(communityId);
  const updateCourse = useUpdateCourse(communityId);
  const [editing, setEditing] = useState<ClassroomModule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ClassroomModule | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const ids = modules.map((m) => m.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids, { onError: (e) => toast(errText(e), 'error') });
  };

  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-4" aria-label={t('editor.aria')}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex-1 text-[17px] font-extrabold">{t('editor.heading', { title: course.title })}</h2>
        {isAdmin && (
          <CertModeSelect
            value={course.certificatesEnabled}
            communityDefault={settings.data?.certificatesEnabled}
            disabled={updateCourse.isPending}
            onChange={(v) =>
              updateCourse.mutate(
                { courseId: course.id, body: { certificatesEnabled: v } },
                { onSuccess: () => toast(t('editor.certUpdated')), onError: (er) => toast(errText(er), 'error') },
              )
            }
          />
        )}
        <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
          <MaterialIcon name="add" size={19} color="#fff" /> {t('editor.addModule')}
        </button>
      </div>
      {modules.length === 0 && <p className="m-0 py-4 text-center text-sm text-stone-500">{t('editor.noModules')}</p>}
      {modules.map((m, i) => (
        <ModuleRow key={m.id} communityId={communityId} courseId={course.id} module={m} index={i} total={modules.length} onMove={(d) => move(i, d)} onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} />
      ))}
      <p className="m-0 text-[12px] text-stone-400">{t('editor.hint')}</p>
      {editing && <ModuleFormDialog communityId={communityId} courseId={course.id} module={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('editor.deleteModuleTitle')}
          message={t('editor.deleteModuleMsg', { title: deleting.title, lessons: deleting.lessonsCount })}
          confirmLabel={t('editor.deleteModuleConfirm')}
          pending={removeModule.isPending}
          error={removeModule.isError ? errText(removeModule.error) : null}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeModule.mutate(deleting.id, { onSuccess: () => { setDeleting(null); toast(t('editor.moduleDeleted')); } })}
        />
      )}
    </section>
  );
}
