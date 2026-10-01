import { useRef, useState } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useUpload } from '../../uploads/useUpload';
import { useArchiveCourse, useClassroomSettings, useCourseList, useCreateCourse, useDeleteCourse, useReorderCourses, useUpdateCourse } from '../queries';
import type { LearningCourse } from '../types';
import { absoluteUrl, areaCls, ConfirmDialog, Dialog, errText, ErrorNote, ghostBtn, inputCls, primaryBtn, safeUrl, toast } from './contentUi';

const iconBtn = 'grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30';
const su = (u: string | null | undefined) => safeUrl(u ?? undefined);

export const PUBLISH_LABEL: Record<LearningCourse['publishStatus'], string> = { published: 'Đã xuất bản', draft: 'Nháp', archived: 'Đã lưu trữ' };
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
  return (
    <label className="flex items-center gap-2 text-[13px] font-medium">
      Chứng nhận hoàn thành
      <select
        value={value === null ? 'inherit' : value ? 'on' : 'off'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'inherit' ? null : e.target.value === 'on')}
        aria-label="Chứng nhận hoàn thành của khóa học"
        className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2 text-[13px]"
      >
        <option value="inherit">Theo cộng đồng{communityDefault === undefined ? '' : communityDefault ? ' (đang bật)' : ' (đang tắt)'}</option>
        <option value="on">Luôn bật</option>
        <option value="off">Luôn tắt</option>
      </select>
    </label>
  );
}

function CourseFormDialog({ communityId, course, isAdmin, onClose }: { communityId: string; course?: LearningCourse; isAdmin: boolean; onClose: () => void }) {
  const create = useCreateCourse(communityId);
  const update = useUpdateCourse(communityId);
  const settings = useClassroomSettings(communityId);
  const { upload, uploading, error: uploadError } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
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
        toast(course ? 'Đã cập nhật khóa học' : 'Đã tạo khóa học');
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
      title={course ? 'Sửa khóa học' : 'Thêm khóa học'}
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Tên khóa học" aria-label="Tên khóa học" className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Mô tả khóa học" aria-label="Mô tả khóa học" className={areaCls} />
        <div className="flex gap-2">
          <input value={thumb} onChange={(e) => setThumb(e.target.value)} placeholder="Ảnh bìa (URL http/https) — hoặc tải ảnh lên" aria-label="Ảnh bìa khóa học" className={inputCls} />
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
                setThumb(absoluteUrl(up.url));
              } catch {
                /* lỗi hiển thị qua uploadError */
              }
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={`${ghostBtn} flex-none`}>
            {uploading ? 'Đang tải…' : 'Tải ảnh'}
          </button>
        </div>
        {su(thumb) && <img src={su(thumb)!} alt="Xem trước ảnh bìa" className="h-28 w-full rounded-xl object-cover" />}
        <label className="flex items-center gap-2 text-[13px]">
          Trạng thái
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Trạng thái xuất bản" className="h-9 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2">
            <option value="published">Xuất bản (thành viên thấy)</option>
            <option value="draft">Nháp (chỉ quản trị thấy)</option>
            {course?.publishStatus === 'archived' && (
              <option value="archived" disabled>
                Đã lưu trữ
              </option>
            )}
          </select>
        </label>
        {isAdmin && course && <CertModeSelect value={cert} communityDefault={settings.data?.certificatesEnabled} onChange={setCert} />}
        <ErrorNote message={err ?? uploadError} />
      </div>
    </Dialog>
  );
}

/** Quản lý các khóa học của cộng đồng (mod+ tạo/sửa/sắp xếp/lưu trữ; admin+ xóa & chứng nhận). Dùng ở tab Lớp học và trang cài đặt. */
export function CourseManager({ communityId, isAdmin }: { communityId: string; isAdmin: boolean }) {
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
    <section className="flex flex-col gap-3" aria-label="Quản lý khóa học">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[17px] font-extrabold">Khóa học trong cộng đồng</h2>
          <p className="m-0 mt-0.5 text-[12.5px] text-stone-500">
            Mỗi khóa học có module, bài học, tiến độ và chứng nhận riêng. Khóa học đầu tiên ("Khóa học chính") được tạo tự động khi tạo cộng đồng.
          </p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
          <MaterialIcon name="add" size={19} color="#fff" /> Thêm khóa học
        </button>
      </div>
      {list.isPending && <p className="m-0 text-sm text-stone-400">Đang tải khóa học…</p>}
      {list.isError && <ErrorNote message={errText(list.error, 'Không tải được danh sách khóa học')} />}
      {list.isSuccess && courses.length === 0 && <p className="m-0 py-4 text-center text-sm text-stone-500">Cộng đồng chưa có khóa học nào.</p>}
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
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${publishBadgeCls(c.publishStatus)}`}>{PUBLISH_LABEL[c.publishStatus]}</span>
              {c.isDefault && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Mặc định</span>}
            </div>
            <div className="truncate text-[12px] text-stone-500">
              {c.modulesCount} module · {c.lessonsCount} bài học · Chứng nhận: {c.certificatesEffective ? 'bật' : 'tắt'}
              {c.certificatesEnabled === null ? ' (theo cộng đồng)' : ''}
            </div>
          </div>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} aria-label="Đưa khóa học lên" className={iconBtn}>
            <MaterialIcon name="arrow_upward" size={19} />
          </button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === courses.length - 1 || reorder.isPending} aria-label="Đưa khóa học xuống" className={iconBtn}>
            <MaterialIcon name="arrow_downward" size={19} />
          </button>
          <button type="button" onClick={() => setEditing(c)} aria-label="Sửa khóa học" className={iconBtn}>
            <MaterialIcon name="edit" size={19} />
          </button>
          {c.publishStatus !== 'archived' && (
            <button
              type="button"
              disabled={archive.isPending}
              onClick={() => archive.mutate(c.id, { onSuccess: () => toast('Đã lưu trữ khóa học'), onError: (e) => toast(errText(e), 'error') })}
              aria-label="Lưu trữ khóa học"
              title="Lưu trữ (ẩn với thành viên, giữ dữ liệu)"
              className={iconBtn}
            >
              <MaterialIcon name="inventory_2" size={19} />
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={() => setDeleting(c)} aria-label="Xóa khóa học" className={`${iconBtn} hover:!text-red-600`}>
              <MaterialIcon name="delete" size={19} />
            </button>
          )}
        </div>
      ))}
      {editing && <CourseFormDialog communityId={communityId} course={editing === 'new' ? undefined : editing} isAdmin={isAdmin} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Xóa khóa học?"
          message={`Khóa học "${deleting.title}" cùng ${deleting.modulesCount} module, ${deleting.lessonsCount} bài học, tiến độ và chứng nhận liên quan sẽ bị xóa vĩnh viễn. Không thể xóa khóa học cuối cùng của cộng đồng.`}
          confirmLabel="Xóa khóa học"
          pending={remove.isPending}
          error={remove.isError ? errText(remove.error) : null}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
                toast('Đã xóa khóa học');
              },
            })
          }
        />
      )}
    </section>
  );
}
