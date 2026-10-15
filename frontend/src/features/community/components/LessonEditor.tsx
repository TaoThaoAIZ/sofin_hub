import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { acceptFor, useUpload } from '../../uploads/useUpload';
import { useCreateLesson, useUpdateLesson } from '../queries';
import type { ClassroomLesson, LessonAttachment } from '../types';
import { absoluteUrl, errText, ErrorNote, FieldLabel, inputCls } from './contentUi';
import { shellGhostBtn, shellPrimaryBtn, ShellBody, ShellFooter, Toggle } from './ModalShell';
import { QuizEditor } from './QuizEditor';

type LessonType = 'video' | 'text' | 'file';

/** Bài đã có nội dung? video: có link · tài liệu: có tệp · bài viết: ≥ 30 ký tự. */
export const lessonHasContent = (l: Pick<ClassroomLesson, 'type' | 'videoUrl' | 'attachments' | 'body'>) =>
  l.type === 'video' ? !!l.videoUrl : l.type === 'file' ? (l.attachments?.length ?? 0) > 0 : (l.body ?? '').trim().length >= TEXT_MIN;

/** Số ký tự tối thiểu của nội dung bài viết (khớp điều kiện xuất bản khóa học). */
export const TEXT_MIN = 30;

const isUploadedVideo = (u: string) => /\/api\/files\/[a-f0-9]{32}\.(?:mp4|webm|mov)$/i.test(u.trim());

/** Tối đa tệp (gồm cả slide) cho một bài — khớp BE. */
const MAX_FILES = 30;

const TYPE_ICON: Record<LessonType, string> = { video: 'smart_display', text: 'article', file: 'attach_file' };

/**
 * Form soạn một bài học (tên, loại, nội dung, xem thử miễn phí) + thân/chân của popup.
 * Dùng chung cho bước "Soạn bài" của trình tạo khóa học và popup Thêm/Sửa bài học độc lập.
 */
export function LessonEditor({
  communityId,
  courseId,
  moduleId,
  lesson,
  defaultPreview = false,
  onSaved,
  onBack,
  backLabel,
}: {
  communityId: string;
  courseId: string;
  moduleId: string;
  lesson?: ClassroomLesson;
  defaultPreview?: boolean;
  onSaved: () => void;
  onBack: () => void;
  backLabel?: string;
}) {
  const { t } = useTranslation('community');
  const create = useCreateLesson(communityId, courseId);
  const update = useUpdateLesson(communityId);
  const { upload, uploading, progress, error: uploadError } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const slideRef = useRef<HTMLInputElement>(null);
  // Đang tải loại nào (để hiện thanh tiến độ đúng khung) + nút hủy.
  const [busy, setBusy] = useState<'video' | 'slide' | 'file' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [type, setType] = useState<LessonType>(lesson?.type ?? 'video');
  const [duration, setDuration] = useState(String(lesson?.durationMin ?? 10));
  const [body, setBody] = useState(lesson?.body ?? '');
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? '');
  // Slide bài giảng và tệp đính kèm thường cùng nằm trong `attachments` ở BE (slide có kind = 'slide'); ở form tách thành hai danh sách.
  const [slides, setSlides] = useState<LessonAttachment[]>((lesson?.attachments ?? []).filter((a) => a.kind === 'slide'));
  const [attachments, setAttachments] = useState<LessonAttachment[]>((lesson?.attachments ?? []).filter((a) => a.kind !== 'slide'));
  const [isPreview, setIsPreview] = useState(lesson?.isPreview ?? defaultPreview);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [bodyErr, setBodyErr] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  // Trường bắt buộc: tên bài; thời lượng hợp lệ; bài viết cần đủ ký tự tối thiểu. Chưa đủ thì khóa nút lưu.
  const durNum = Number(duration);
  // Báo lỗi inline ngay khi đã gõ nhưng chưa đủ ký tự tối thiểu (bài viết).
  const shortErr = type === 'text' && body.trim().length > 0 && body.trim().length < TEXT_MIN ? t('editor.lesson.bodyMin', { min: TEXT_MIN, n: body.trim().length }) : null;
  const canSave = !!title.trim() && duration.trim() !== '' && Number.isInteger(durNum) && durNum >= 0 && durNum <= 1000 && (type !== 'text' || body.trim().length >= TEXT_MIN);
  const err = localErr ?? (create.isError ? errText(create.error) : update.isError ? errText(update.error) : null);

  const submit = () => {
    setLocalErr(null);
    if (!title.trim()) return setLocalErr(t('modWizard.lesson.errName'));
    const dur = Number(duration);
    if (!Number.isInteger(dur) || dur < 0 || dur > 1000) return setLocalErr(t('editor.lesson.durationErr'));
    if (type === 'text' && body.trim().length < TEXT_MIN) {
      setBodyErr(t('editor.lesson.bodyMin', { min: TEXT_MIN, n: body.trim().length }));
      return;
    }
    setBodyErr(null);
    const url = videoUrl.trim();
    const done = { onSuccess: () => onSaved() };
    const all: LessonAttachment[] = [...slides.map((s) => ({ ...s, kind: 'slide' as const })), ...attachments.map(({ kind: _k, ...a }) => a)];
    if (all.length > MAX_FILES) return setLocalErr(t('editor.lesson.tooManyFiles', { max: MAX_FILES }));
    if (lesson) {
      update.mutate({ lessonId: lesson.id, body: { title: title.trim(), type, durationMin: dur, body, videoUrl: type === 'video' && url ? url : null, attachments: all, isPreview } }, done);
    } else {
      create.mutate({ moduleId, body: { title: title.trim(), type, durationMin: dur, body, ...(type === 'video' && url ? { videoUrl: url } : {}), attachments: all, isPreview } }, done);
    }
  };

  return (
    <>
      <ShellBody>
        <div>
          <FieldLabel required>{t('modWizard.lesson.name')}</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('modWizard.lesson.namePh')} aria-label={t('modWizard.lesson.name')} aria-required="true" className={inputCls} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label={t('editor.lesson.typeAria')} className="inline-flex gap-1 rounded-xl border border-[#ece5df] bg-[#f5f2ef] p-1">
            {(['video', 'text', 'file'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={type === k}
                onClick={() => setType(k)}
                className={`flex h-[34px] items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold ${type === k ? 'bg-white text-stone-900 shadow-[0_1px_4px_rgba(0,0,0,.08)]' : 'text-stone-500 hover:text-stone-800'}`}
              >
                <MaterialIcon name={TYPE_ICON[k]} size={17} color="currentColor" />
                {t(`modWizard.outline.type.${k}`)}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-[12.5px] font-semibold">
            {t('editor.lesson.duration')}
            <input type="number" min={0} max={1000} value={duration} onChange={(e) => setDuration(e.target.value)} aria-label={t('editor.lesson.durationAria')} className="h-[34px] w-[68px] rounded-[9px] border-[1.5px] border-[#e7e0da] px-2 text-sm outline-0 focus:border-brand" />
            <span className="font-medium text-stone-500">{t('editor.lesson.minutes')}</span>
          </label>
        </div>

        {type === 'video' && (
          <div className="flex flex-col items-center gap-1 rounded-xl border-[1.5px] border-dashed border-[#fdba74] bg-[#fff9f4] px-4 py-5 text-center">
            <input
              ref={videoRef}
              type="file"
              accept={acceptFor('lesson_video')}
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const ac = new AbortController();
                abortRef.current = ac;
                setBusy('video');
                try {
                  const up = await upload(f, { purpose: 'lesson_video', courseId: communityId, signal: ac.signal });
                  setVideoUrl(absoluteUrl(up.url));
                } catch {
                  /* lỗi hiển thị qua uploadError */
                } finally {
                  setBusy(null);
                }
              }}
            />
            <MaterialIcon name="cloud_upload" size={30} color="#e8590c" />
            <div className="text-sm font-bold">{t('modWizard.lesson.videoDrop')}</div>
            <div className="text-xs text-stone-500">{t('modWizard.lesson.videoHint')}</div>
            <button type="button" onClick={() => videoRef.current?.click()} disabled={uploading} className="mt-2 h-9 rounded-xl border border-[#fdba74] bg-white px-4 text-[13px] font-bold text-[#e8590c] disabled:opacity-60">
              {uploading && busy === 'video' ? t('courseForm.uploading') : t('editor.lesson.uploadVideo')}
            </button>
            {busy === 'video' && <UploadProgress pct={progress} onCancel={() => abortRef.current?.abort()} />}
            {isUploadedVideo(videoUrl) && <div className="mt-1 text-xs font-semibold text-green-700">{t('editor.lesson.videoUploaded')}</div>}
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://" aria-label={t('editor.lesson.videoAria')} className={`${inputCls} mt-2 max-w-[420px] text-center`} />
          </div>
        )}

        {(
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={acceptFor('lesson_attachment').replace(/,\.(mp4|m4v|webm|mov)/g, '')}
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const ac = new AbortController();
                abortRef.current = ac;
                setBusy('file');
                try {
                  const up = await upload(f, { purpose: 'lesson_attachment', courseId: communityId, signal: ac.signal });
                  setAttachments((cur) => [...cur, { name: up.name, url: absoluteUrl(up.url), size: up.size }]);
                } catch {
                  /* lỗi hiển thị qua uploadError */
                } finally {
                  setBusy(null);
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || attachments.length + slides.length >= MAX_FILES}
              className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-[#fdba74] bg-[#fff9f4] px-4 py-3.5 text-left disabled:opacity-60"
            >
              <MaterialIcon name="attach_file" size={26} color="#e8590c" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{uploading && busy === 'file' ? t('courseForm.uploading') : t('modWizard.lesson.fileDrop')}</span>
                <span className="block text-xs text-stone-500">{t('modWizard.lesson.fileHint')}</span>
              </span>
              <span className="text-[13px] font-bold text-[#e8590c]">{t('modWizard.lesson.chooseFile')}</span>
            </button>
            {attachments.map((a, i) => (
              <div key={a.url + i} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-[13px]">
                <MaterialIcon name="attach_file" size={16} />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <button type="button" aria-label={t('modWizard.lesson.removeFile', { name: a.name })} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600">
                  <MaterialIcon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input
            ref={slideRef}
            type="file"
            accept={acceptFor('lesson_slide')}
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const ac = new AbortController();
              abortRef.current = ac;
              setBusy('slide');
              try {
                const up = await upload(f, { purpose: 'lesson_slide', courseId: communityId, signal: ac.signal });
                setSlides((cur) => [...cur, { name: up.name, url: absoluteUrl(up.url), size: up.size, kind: 'slide' }]);
              } catch {
                /* lỗi hiển thị qua uploadError */
              } finally {
                setBusy(null);
              }
            }}
          />
          <button
            type="button"
            onClick={() => slideRef.current?.click()}
            disabled={uploading || attachments.length + slides.length >= MAX_FILES}
            className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-[#fdba74] bg-[#fff9f4] px-4 py-3.5 text-left disabled:opacity-60"
          >
            <MaterialIcon name="slideshow" size={26} color="#e8590c" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{uploading && busy === 'slide' ? t('courseForm.uploading') : t('editor.lesson.slideDrop')}</span>
              <span className="block text-xs text-stone-500">{t('editor.lesson.slideHint')}</span>
            </span>
            <span className="text-[13px] font-bold text-[#e8590c]">{t('modWizard.lesson.chooseFile')}</span>
          </button>
          {busy === 'slide' && <UploadProgress pct={progress} onCancel={() => abortRef.current?.abort()} />}
          {slides.map((a, i) => (
            <div key={a.url + i} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-[13px]">
              <MaterialIcon name="slideshow" size={16} />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <button type="button" aria-label={t('modWizard.lesson.removeFile', { name: a.name })} onClick={() => setSlides(slides.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600">
                <MaterialIcon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>

        <div>
          <FieldLabel required={type === 'text'}>{type === 'text' ? t('modWizard.lesson.text') : t('modWizard.lesson.note')}</FieldLabel>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (bodyErr) setBodyErr(null);
            }}
            aria-invalid={!!(bodyErr ?? shortErr)}
            maxLength={50000}
            placeholder={type === 'text' ? t('modWizard.lesson.textPh') : t('modWizard.lesson.notePh')}
            aria-label={type === 'text' ? t('modWizard.lesson.text') : t('modWizard.lesson.note')}
            style={{ height: type === 'text' ? 170 : 80 }}
            className={`w-full resize-y rounded-[10px] border-[1.5px] px-3 py-2.5 text-[13.5px] leading-relaxed outline-0 focus:border-brand ${bodyErr ?? shortErr ? 'border-red-400' : 'border-[#e7e0da]'}`}
          />
          {(bodyErr ?? shortErr) && <p role="alert" className="m-0 mt-1.5 text-[12.5px] font-medium text-red-600">{bodyErr ?? shortErr}</p>}
          {type === 'text' && !bodyErr && !shortErr && <p className="m-0 mt-1 text-right text-[11.5px] text-stone-400">{body.trim().length}/{TEXT_MIN}+</p>}
        </div>

        <button type="button" onClick={() => setIsPreview((v) => !v)} aria-pressed={isPreview} className="flex items-center gap-3.5 rounded-xl bg-[#faf7f4] px-3.5 py-3 text-left">
          <span className="flex-1">
            <span className="block text-[13.5px] font-bold">{t('modWizard.lesson.free')}</span>
            <span className="mt-0.5 block text-xs text-stone-600">{t('modWizard.lesson.freeSub')}</span>
          </span>
          <Toggle on={isPreview} />
        </button>
        {lesson ? (
          <QuizEditor communityId={communityId} lessonId={lesson.id} />
        ) : (
          <p className="m-0 rounded-xl bg-[#faf7f4] px-3.5 py-2.5 text-[12.5px] text-stone-500">{t('editor.lesson.quizAfterSave')}</p>
        )}
        <p className="m-0 text-[12px] text-stone-500"><span className="text-red-600">*</span> {t('modWizard.requiredHint')}</p>
        <ErrorNote message={err ?? uploadError} />
      </ShellBody>
      <ShellFooter>
        <button type="button" onClick={onBack} className={shellGhostBtn}>
          {backLabel ?? t('modWizard.lesson.back')}
        </button>
        <div className="flex-1" />
        <button type="button" onClick={submit} disabled={pending || uploading || !canSave} className={shellPrimaryBtn}>
          {pending ? t('modWizard.info.saving') : lesson ? t('modWizard.lesson.save') : t('modWizard.lesson.add')}
        </button>
      </ShellFooter>
    </>
  );
}

/** Thanh tiến độ tải lên + nút hủy (video dài có thể mất nhiều phút). */
function UploadProgress({ pct, onCancel }: { pct: number; onCancel: () => void }) {
  const { t } = useTranslation('community');
  return (
    <div className="flex w-full max-w-[420px] items-center gap-2.5" role="status" aria-live="polite">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(120,60,20,.12)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-[12px] font-semibold tabular-nums">{pct}%</span>
      <button type="button" onClick={onCancel} className="text-[12.5px] font-semibold text-stone-500 underline hover:text-red-600">
        {t('editor.lesson.cancelUpload')}
      </button>
    </div>
  );
}
