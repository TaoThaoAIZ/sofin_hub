import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import {
  useClassroomSettings,
  useDeleteLesson,
  useDeleteModule,
  useLessons,
  useReorderLessons,
  useReorderModules,
  useUpdateCourse,
} from '../queries';
import type { ClassroomLesson, ClassroomModule, LearningCourse } from '../types';
import { CertModeSelect } from './CourseManager';
import { ConfirmDialog, errText, ErrorNote, primaryBtn, toast } from './contentUi';
import { LessonEditor } from './LessonEditor';
import { ModalShell } from './ModalShell';
import { ModuleWizard } from './ModuleWizard';

const iconBtn = 'grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30';

// ---------------------------------------------------------------- Form bài học
/** Popup thêm/sửa một bài học (khi đã biết module); trong trình tạo khóa học dùng thẳng LessonEditor. */
export function LessonFormDialog({
  communityId,
  courseId,
  moduleId: initialModuleId,
  lesson,
  onClose,
}: {
  communityId: string;
  courseId: string;
  moduleId: string;
  lesson?: ClassroomLesson;
  onClose: () => void;
}) {
  const { t } = useTranslation('community');
  return (
    <ModalShell title={lesson ? t('modWizard.title.lessonEdit') : t('modWizard.title.lessonAdd')} onClose={onClose}>
      <LessonEditor
        communityId={communityId}
        courseId={courseId}
        moduleId={initialModuleId}
        {...(lesson ? { lesson } : {})}
        onSaved={() => {
          toast(lesson ? t('editor.lesson.toastUpdated') : t('editor.lesson.toastCreated'));
          onClose();
        }}
        onBack={onClose}
        backLabel={t('ui.cancel')}
      />
    </ModalShell>
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
      {editing && <ModuleWizard communityId={communityId} courseId={course.id} module={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
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
