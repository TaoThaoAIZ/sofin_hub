import { useRef, useState } from 'react';
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
  useUpdateClassroomSettings,
  useUpdateLesson,
  useUpdateModule,
} from '../queries';
import type { ClassroomLesson, ClassroomModule, LessonAttachment } from '../types';
import { absoluteUrl, areaCls, ConfirmDialog, Dialog, errText, ErrorNote, ghostBtn, inputCls, primaryBtn, toast } from './contentUi';

const iconBtn = 'grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30';

// ---------------------------------------------------------------- Form module
function ModuleFormDialog({ courseId, module, onClose }: { courseId: string; module?: ClassroomModule; onClose: () => void }) {
  const create = useCreateModule(courseId);
  const update = useUpdateModule(courseId);
  const { upload, uploading, error: uploadError } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(module?.title ?? '');
  const [description, setDescription] = useState(module?.description ?? '');
  const [thumbnail, setThumbnail] = useState(module?.thumbnail ?? '');
  const [level, setLevel] = useState(module?.requiredLevel ? String(module.requiredLevel) : '');
  const pending = create.isPending || update.isPending;
  const err = create.isError ? errText(create.error) : update.isError ? errText(update.error) : null;

  const submit = () => {
    const done = { onSuccess: () => { toast(module ? 'Đã cập nhật module' : 'Đã tạo module'); onClose(); } };
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
      title={module ? 'Sửa module' : 'Thêm module'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Hủy
          </button>
          <button type="button" onClick={submit} disabled={pending || uploading || !title.trim()} className={primaryBtn}>
            {pending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Tên module" aria-label="Tên module" className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Mô tả" aria-label="Mô tả module" className={areaCls} />
        <div className="flex gap-2">
          <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="Ảnh bìa (URL http/https) — hoặc tải ảnh lên" aria-label="Ảnh bìa module" className={inputCls} />
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
            {uploading ? 'Đang tải…' : 'Tải ảnh'}
          </button>
        </div>
        {thumbnail && <img src={thumbnail} alt="Xem trước ảnh bìa" className="h-28 w-full rounded-xl object-cover" />}
        <label className="flex items-center gap-2 text-[13px]">
          Cấp độ tối thiểu để mở khóa
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Cấp độ yêu cầu" className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2">
            <option value="">Không yêu cầu</option>
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Cấp độ {i + 1}
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
function LessonFormDialog({ courseId, moduleId, lesson, onClose }: { courseId: string; moduleId: string; lesson?: ClassroomLesson; onClose: () => void }) {
  const create = useCreateLesson(courseId);
  const update = useUpdateLesson(courseId);
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
      setLocalErr('Thời lượng phải là số nguyên từ 0 đến 1000 phút');
      return;
    }
    const done = { onSuccess: () => { toast(lesson ? 'Đã cập nhật bài học' : 'Đã tạo bài học'); onClose(); } };
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
      title={lesson ? 'Sửa bài học' : 'Thêm bài học'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Hủy
          </button>
          <button type="button" onClick={submit} disabled={pending || uploading || !title.trim()} className={primaryBtn}>
            {pending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Tiêu đề bài học" aria-label="Tiêu đề bài học" className={inputCls} />
        <div className="flex flex-wrap gap-2.5">
          <select value={type} onChange={(e) => setType(e.target.value as 'video' | 'text' | 'file')} aria-label="Loại bài học" className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-sm">
            <option value="video">Video</option>
            <option value="text">Bài đọc</option>
            <option value="file">Tệp</option>
          </select>
          <label className="flex items-center gap-2 text-[13px]">
            Thời lượng
            <input type="number" min={0} max={1000} value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Thời lượng (phút)" className="h-10 w-20 rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-sm" />
            phút
          </label>
        </div>
        {type === 'video' && (
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Link YouTube hoặc Vimeo (https://…)" aria-label="Link video" className={inputCls} />
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={50000} placeholder="Nội dung / ghi chú bài học (văn bản thuần)" aria-label="Nội dung bài học" className={areaCls} />

        <div className="rounded-xl border border-[rgba(120,60,20,.1)] p-3">
          <div className="mb-2 text-[13px] font-semibold">Tệp đính kèm ({attachments.length}/20)</div>
          {attachments.map((a, i) => (
            <div key={a.url + i} className="mb-1.5 flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-[13px]">
              <MaterialIcon name="attach_file" size={16} />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <button type="button" aria-label={`Bỏ tệp ${a.name}`} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600">
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
                  const up = await upload(f, { purpose: 'lesson_attachment', courseId });
                  setAttachments((cur) => [...cur, { name: up.name, url: absoluteUrl(up.url), size: up.size }]);
                } catch {
                  /* lỗi hiển thị qua uploadError */
                }
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= 20} className={ghostBtn}>
              {uploading ? 'Đang tải…' : 'Tải tệp lên'}
            </button>
            <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Tên hiển thị" aria-label="Tên liên kết" className={`${inputCls} !w-36`} />
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="hoặc dán URL https://…" aria-label="URL tệp" className={`${inputCls} !w-52 flex-1`} />
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
              Thêm
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
  courseId,
  module,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
}: {
  courseId: string;
  module: ClassroomModule;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const lessons = useLessons(courseId, open ? module.id : null);
  const reorder = useReorderLessons(courseId);
  const removeLesson = useDeleteLesson(courseId);
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
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Thu gọn' : 'Mở danh sách bài học'} className={iconBtn}>
          <MaterialIcon name={open ? 'expand_less' : 'expand_more'} size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold">
            #{module.index}: {module.title}
          </div>
          <div className="truncate text-[12px] text-stone-500">
            {module.lessonsCount} bài học{module.requiredLevel ? ` · Yêu cầu Cấp độ ${module.requiredLevel}` : ''}
          </div>
        </div>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Đưa module lên" className={iconBtn}>
          <MaterialIcon name="arrow_upward" size={19} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Đưa module xuống" className={iconBtn}>
          <MaterialIcon name="arrow_downward" size={19} />
        </button>
        <button type="button" onClick={onEdit} aria-label="Sửa module" className={iconBtn}>
          <MaterialIcon name="edit" size={19} />
        </button>
        <button type="button" onClick={onDelete} aria-label="Xóa module" className={`${iconBtn} hover:!text-red-600`}>
          <MaterialIcon name="delete" size={19} />
        </button>
      </div>
      {open && (
        <div className="border-t border-[rgba(120,60,20,.08)] bg-[#fdfbfa] p-3">
          {lessons.isPending && <p className="m-0 text-sm text-stone-400">Đang tải bài học…</p>}
          {lessons.isError && <ErrorNote message={errText(lessons.error)} />}
          {lessons.data?.length === 0 && <p className="m-0 mb-2 text-sm text-stone-400">Module chưa có bài học.</p>}
          {lessons.data?.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white">
              <MaterialIcon name={l.type === 'video' ? 'play_circle' : l.type === 'file' ? 'attach_file' : 'article'} size={19} color="#78716c" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{l.title}</div>
                <div className="text-[11.5px] text-stone-400">{l.durationMin} phút</div>
              </div>
              <button type="button" onClick={() => moveLesson(i, -1)} disabled={i === 0 || reorder.isPending} aria-label="Đưa bài học lên" className={iconBtn}>
                <MaterialIcon name="arrow_upward" size={18} />
              </button>
              <button type="button" onClick={() => moveLesson(i, 1)} disabled={i === (lessons.data?.length ?? 0) - 1 || reorder.isPending} aria-label="Đưa bài học xuống" className={iconBtn}>
                <MaterialIcon name="arrow_downward" size={18} />
              </button>
              <button type="button" onClick={() => setEditingLesson(l)} aria-label="Sửa bài học" className={iconBtn}>
                <MaterialIcon name="edit" size={18} />
              </button>
              <button type="button" onClick={() => setDeleting(l)} aria-label="Xóa bài học" className={`${iconBtn} hover:!text-red-600`}>
                <MaterialIcon name="delete" size={18} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setEditingLesson('new')} className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-brand">
            <MaterialIcon name="add" size={18} color="#f26a1b" /> Thêm bài học
          </button>
        </div>
      )}
      {editingLesson && (
        <LessonFormDialog courseId={courseId} moduleId={module.id} lesson={editingLesson === 'new' ? undefined : editingLesson} onClose={() => setEditingLesson(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Xóa bài học?"
          message={`Bài học "${deleting.title}" và tiến độ liên quan của học viên sẽ bị xóa.`}
          confirmLabel="Xóa bài học"
          pending={removeLesson.isPending}
          error={removeLesson.isError ? errText(removeLesson.error) : null}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeLesson.mutate(deleting.id, { onSuccess: () => { setDeleting(null); toast('Đã xóa bài học'); } })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Trình soạn
export function ClassroomEditor({ courseId, modules, isAdmin }: { courseId: string; modules: ClassroomModule[]; isAdmin: boolean }) {
  const reorder = useReorderModules(courseId);
  const removeModule = useDeleteModule(courseId);
  const settings = useClassroomSettings(courseId);
  const updateSettings = useUpdateClassroomSettings(courseId);
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
    <section className="glass flex flex-col gap-3 rounded-3xl p-4" aria-label="Chỉnh sửa lớp học">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex-1 text-[17px] font-extrabold">Chỉnh sửa lớp học</h2>
        {isAdmin && (
          <label className="flex items-center gap-2 text-[13.5px] font-medium">
            <input
              type="checkbox"
              checked={!!settings.data?.certificatesEnabled}
              disabled={settings.isPending || updateSettings.isPending}
              onChange={(e) =>
                updateSettings.mutate(e.target.checked, {
                  onSuccess: () => toast(e.target.checked ? 'Đã bật chứng nhận hoàn thành' : 'Đã tắt chứng nhận hoàn thành'),
                  onError: (er) => toast(errText(er), 'error'),
                })
              }
            />
            Cấp chứng nhận khi hoàn thành 100%
          </label>
        )}
        <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
          <MaterialIcon name="add" size={19} color="#fff" /> Thêm module
        </button>
      </div>
      {modules.length === 0 && <p className="m-0 py-4 text-center text-sm text-stone-500">Lớp học chưa có module nào. Hãy thêm module đầu tiên.</p>}
      {modules.map((m, i) => (
        <ModuleRow key={m.id} courseId={courseId} module={m} index={i} total={modules.length} onMove={(d) => move(i, d)} onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} />
      ))}
      <p className="m-0 text-[12px] text-stone-400">Mod trở lên không bị khóa module khi xem để duyệt nội dung. Học viên vẫn bị khóa theo thứ tự module và cấp độ.</p>
      {editing && <ModuleFormDialog courseId={courseId} module={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Xóa module?"
          message={`Module "${deleting.title}" cùng ${deleting.lessonsCount} bài học và tiến độ liên quan sẽ bị xóa vĩnh viễn.`}
          confirmLabel="Xóa module"
          pending={removeModule.isPending}
          error={removeModule.isError ? errText(removeModule.error) : null}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeModule.mutate(deleting.id, { onSuccess: () => { setDeleting(null); toast('Đã xóa module'); } })}
        />
      )}
    </section>
  );
}
