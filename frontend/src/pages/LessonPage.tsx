import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { classroomPath, lessonPath } from '../lib/paths';
import { fileKeyOf, refreshFileUrl, useFileUrl } from '../lib/files';
import { QuizPanel } from '../features/community/components/QuizPanel';
import { ConfirmDialog, errText, ErrorNote, ghostBtn, isModPlus, primaryBtn, safeUrl, toast, ToastHost } from '../features/community/components/contentUi';
import { LessonFormDialog } from '../features/community/components/ClassroomEditor';
import { useCommunityDetail } from '../features/courses/queries';
import type { ClassroomLesson } from '../features/community/types';
import { useCourseList, useDeleteLesson, useLesson, useLessons, useProgress, useToggleLessonComplete } from '../features/community/queries';

// Chỉ nhúng iframe từ các host video đã biết (BE đã dựng lại embedUrl từ ID hợp lệ; FE kiểm tra thêm lần nữa).
const EMBED_PREFIXES = ['https://www.youtube.com/embed/', 'https://www.youtube-nocookie.com/embed/', 'https://player.vimeo.com/video/'];
const isSafeEmbed = (u?: string) => !!u && EMBED_PREFIXES.some((p) => u.startsWith(p));

const fmtSize = (n?: number) => (n === undefined ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Video do chủ cộng đồng tải lên (mp4): file riêng tư theo khóa học nên phát bằng URL ký hạn ngắn. */
function UploadedVideo({ url, title }: { url: string; title: string }) {
  const { t } = useTranslation('course');
  const initial = useFileUrl(url);
  const [fresh, setFresh] = useState<{ for: string; src: string } | null>(null);
  const retried = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = fresh?.for === url ? fresh.src : initial;
  if (src === undefined) return <div className="grid aspect-video w-full place-items-center bg-stone-100 text-sm text-stone-500">{t('lesson.loadingAttachment', { name: title })}</div>;
  if (!src) return <div className="grid aspect-video w-full place-items-center bg-stone-100 text-sm text-stone-500">{t('lesson.noVideo')}</div>;
  return (
    <div className="aspect-video w-full bg-black">
      <video
        ref={videoRef}
        src={src}
        title={title}
        controls
        controlsList="nodownload"
        playsInline
        preload="metadata"
        className="size-full"
        onError={(e) => {
          // URL ký hết hạn (xem dở rồi để lâu): xin URL mới đúng 1 lần và phát lại từ vị trí cũ.
          if (retried.current) return;
          retried.current = true;
          const at = e.currentTarget.currentTime;
          void refreshFileUrl(url).then((s) => {
            setFresh({ for: url, src: s });
            requestAnimationFrame(() => {
              if (videoRef.current) videoRef.current.currentTime = at;
            });
          });
        }}
      />
    </div>
  );
}

function LessonAttachmentLink({ a }: { a: { name: string; url: string; size?: number } }) {
  const { t } = useTranslation('course');
  // Tệp do hệ thống lưu là riêng tư theo khóa học: dùng URL ký hạn ngắn; link ngoài giữ nguyên (đã lọc safeUrl).
  const signed = useFileUrl(a.url);
  const href = fileKeyOf(a.url) ? signed : safeUrl(a.url);
  if (href === undefined) return <span className="text-sm text-stone-400">{t('lesson.loadingAttachment', { name: a.name })}</span>;
  if (!href) return <span className="text-sm text-stone-400">{t('lesson.invalidLink', { name: a.name })}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      download
      className="flex items-center gap-3 rounded-xl border border-[rgba(120,60,20,.1)] bg-white px-3.5 py-2.5 text-[13.5px] hover:border-brand"
    >
      <MaterialIcon name="download" size={20} color="#ff570a" />
      <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
      <span className="text-xs text-stone-400">{fmtSize(a.size)}</span>
    </a>
  );
}

export function LessonPage() {
  const { t } = useTranslation('course');
  const { id: communityId = '', lessonId = '' } = useParams();
  const lesson = useLesson(communityId, lessonId);
  const courseId = lesson.data?.learningCourseId ?? null;
  const progress = useProgress(communityId, courseId);
  const courseTitle = useCourseList(communityId).data?.find((c) => c.id === courseId)?.title;
  const data = lesson.data;
  const siblings = useLessons(communityId, courseId, data?.moduleId ?? null);
  const toggle = useToggleLessonComplete(communityId);
  const back = classroomPath(communityId, courseId);
  const { t: tc } = useTranslation('community');
  const navigate = useNavigate();
  const canManage = isModPlus(useCommunityDetail(communityId).data?.viewerRole);
  const removeLesson = useDeleteLesson(communityId);
  const [editing, setEditing] = useState<ClassroomLesson | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ClassroomLesson | null>(null);

  if (lesson.isPending) return <p className="py-10 text-center text-stone-400">{t('lesson.loading')}</p>;

  if (lesson.isError) {
    const err = lesson.error;
    const locked = err instanceof ApiError && err.code === 'MODULE_LOCKED';
    return (
      <div className="glass mx-auto flex max-w-xl flex-col items-center gap-3 rounded-3xl p-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand/10">
          <MaterialIcon name={locked ? 'lock' : 'error'} size={30} filled color="#ff570a" />
        </span>
        <h1 className="m-0 text-xl font-extrabold">{locked ? t('lesson.lockedTitle') : t('lesson.openFailed')}</h1>
        <p className="m-0 text-sm text-stone-600">
          {locked
            ? t('lesson.lockedDesc')
            : errText(err, t('lesson.notFound'))}
        </p>
        <Link to={back} className={primaryBtn}>
          {t('lesson.backToList')}
        </Link>
      </div>
    );
  }

  const l = lesson.data;
  const embed = isSafeEmbed(l.embedUrl) ? l.embedUrl! : null;
  const slideFiles = (l.attachments ?? []).filter((a) => a.kind === 'slide');
  const docFiles = (l.attachments ?? []).filter((a) => a.kind !== 'slide');
  const pct = progress.data?.percent ?? 0;
  // Bài có trắc nghiệm bắt buộc: chưa đạt thì chưa được đánh dấu hoàn thành (bỏ đánh dấu thì vẫn được).
  const quizBlocks = !!l.quiz?.required && !l.quiz.passed && !l.completed;

  const onToggle = () =>
    toggle.mutate(l.id, {
      onSuccess: ({ completed }) => toast(completed ? t('lesson.completedToast') : t('lesson.uncompletedToast')),
      onError: (e) => toast(errText(e), 'error'),
    });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5 max-[1100px]:grid-cols-1">
      <ToastHost />
      <main className="flex min-w-0 flex-col gap-4">
        <nav aria-label={t('lesson.breadcrumb')} className="flex flex-wrap items-center gap-1.5 text-[13px] text-stone-500">
          <Link to={back} className="hover:text-brand">
            {t('lesson.classroom')}
          </Link>
          <MaterialIcon name="chevron_right" size={16} />
          {courseTitle && (
            <>
              <span className="max-w-[200px] truncate">{courseTitle}</span>
              <MaterialIcon name="chevron_right" size={16} />
            </>
          )}
          <span className="truncate">
            #{l.moduleIndex - 1}: {l.moduleTitle}
          </span>
        </nav>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold">{t('lesson.progress')}</span>
            <span className="text-stone-500">
              {progress.data ? t('lesson.lessonsCount', { done: progress.data.completedLessons, total: progress.data.totalLessons }) : ''} · {pct}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgba(120,60,20,.08)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <article className="glass overflow-hidden rounded-3xl">
          {l.type === 'video' && embed && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={embed}
                title={l.title}
                className="size-full border-0"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                loading="lazy"
              />
            </div>
          )}
          {l.type === 'video' && !embed && fileKeyOf(l.videoUrl) && <UploadedVideo url={l.videoUrl!} title={l.title} />}
          {l.type === 'video' && !embed && !fileKeyOf(l.videoUrl) && (
            <div className="grid aspect-video w-full place-items-center bg-stone-100 text-sm text-stone-500">{t('lesson.noVideo')}</div>
          )}
          <div className="p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="m-0 text-[24px] leading-tight font-extrabold tracking-tight">{l.title}</h1>
                <div className="mt-1 text-[13px] text-stone-500">
                  {t('lesson.meta', { n: l.durationMin, type: l.type === 'video' ? t('lesson.typeVideo') : l.type === 'file' ? t('lesson.typeFile') : t('lesson.typeText') })}
                </div>
              </div>
              <button
                type="button"
                onClick={onToggle}
                disabled={toggle.isPending || quizBlocks}
                title={quizBlocks ? t('quiz.needPass', { pct: l.quiz?.passPercent }) : undefined}
                className={`${l.completed ? ghostBtn : primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <MaterialIcon name={l.completed ? 'undo' : 'check_circle'} size={19} color={l.completed ? undefined : '#fff'} />
                {toggle.isPending ? t('lesson.saving') : l.completed ? t('lesson.uncomplete') : t('lesson.complete')}
              </button>
            </div>
            {l.completed && (
              <p className="mt-2 mb-0 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
                <MaterialIcon name="check_circle" size={17} filled color="#059669" /> {t('lesson.youCompleted')}
              </p>
            )}
            {l.body && <div className="mt-4 text-[14.5px] leading-[1.7] break-words whitespace-pre-wrap text-stone-800">{l.body}</div>}

            {l.quiz && <QuizPanel communityId={communityId} lessonId={l.id} />}
            {quizBlocks && <p className="mt-2 mb-0 text-[12.5px] text-stone-500">{t('quiz.needPass', { pct: l.quiz?.passPercent })}</p>}

            {slideFiles.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-1.5 text-[13.5px] font-bold">
                  <MaterialIcon name="slideshow" size={18} color="#ff570a" /> {t('lesson.slides')}
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {slideFiles.map((a) => (
                    <li key={a.url}>
                      <LessonAttachmentLink a={a} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {docFiles.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[13.5px] font-bold">{t('lesson.attachments')}</div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {docFiles.map((a) => (
                    <li key={a.url}>
                      <LessonAttachmentLink a={a} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-2">
              <ErrorNote message={toggle.isError ? errText(toggle.error) : null} />
            </div>
          </div>
        </article>

        <div className="flex items-center justify-between gap-3">
          {l.prevLessonId && !l.prevLessonLocked ? (
            <Link to={lessonPath(communityId, l.prevLessonId)} className={ghostBtn}>
              <MaterialIcon name="arrow_back" size={19} /> {t('lesson.prev')}
            </Link>
          ) : (
            <span />
          )}
          {l.nextLessonId && !l.nextLessonLocked ? (
            <Link to={lessonPath(communityId, l.nextLessonId)} className={primaryBtn}>
              {t('lesson.next')} <MaterialIcon name="arrow_forward" size={19} color="#fff" />
            </Link>
          ) : (
            <Link to={back} className={ghostBtn}>
              {t('lesson.toClassroom')}
            </Link>
          )}
        </div>
      </main>

      <aside className="glass sticky top-[76px] rounded-2xl p-3 max-[1100px]:static">
        <div className="flex items-center gap-2 px-2 pb-2">
          <div className="min-w-0 flex-1 text-[14px] font-bold">
            #{l.moduleIndex - 1}: {l.moduleTitle}
          </div>
          {canManage && courseId && (
            <button type="button" onClick={() => setEditing('new')} aria-label={tc('editor.row.addLesson')} title={tc('editor.row.addLesson')} className="grid size-8 flex-none place-items-center rounded-full bg-brand/10 hover:bg-brand/20">
              <MaterialIcon name="add" size={18} color="#ff570a" />
            </button>
          )}
        </div>
        {siblings.isPending && <p className="px-2 text-sm text-stone-400">{t('lesson.loadingShort')}</p>}
        <div className="flex flex-col gap-1">
          {siblings.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
            <Link
              to={lessonPath(communityId, s.id)}
              aria-current={s.id === l.id ? 'page' : undefined}
              aria-disabled={s.locked}
              tabIndex={s.locked ? -1 : undefined}
              onClick={(e) => s.locked && e.preventDefault()}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] ${s.id === l.id ? 'bg-brand-soft font-semibold text-brand' : 'hover:bg-white'} ${s.locked ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <MaterialIcon name={s.locked ? 'lock' : s.completed ? 'check_circle' : 'radio_button_unchecked'} size={18} filled={s.completed && !s.locked} color={s.completed && !s.locked ? '#ff570a' : '#a8a29e'} />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className="text-[11px] text-stone-400">{s.durationMin}'</span>
            </Link>
            {canManage && (
              <>
                <button type="button" onClick={() => setEditing(s)} aria-label={tc('editor.row.editLesson')} title={tc('editor.row.editLesson')} className="grid size-7 flex-none place-items-center rounded-lg text-stone-500 hover:bg-white hover:text-brand">
                  <MaterialIcon name="edit" size={16} />
                </button>
                <button type="button" onClick={() => setDeleting(s)} aria-label={tc('editor.row.deleteLesson')} title={tc('editor.row.deleteLesson')} className="grid size-7 flex-none place-items-center rounded-lg text-stone-500 hover:bg-white hover:text-red-600">
                  <MaterialIcon name="delete" size={16} />
                </button>
              </>
            )}
            </div>
          ))}
        </div>
      </aside>
      {editing && courseId && (
        <LessonFormDialog communityId={communityId} courseId={courseId} moduleId={l.moduleId} lesson={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title={tc('editor.row.deleteLessonTitle')}
          message={tc('editor.row.deleteLessonMsg', { title: deleting.title })}
          confirmLabel={tc('editor.row.deleteLessonConfirm')}
          pending={removeLesson.isPending}
          error={removeLesson.isError ? errText(removeLesson.error) : null}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            removeLesson.mutate(deleting.id, {
              onSuccess: () => {
                const wasCurrent = deleting.id === l.id;
                setDeleting(null);
                toast(tc('editor.row.lessonDeleted'));
                // Xóa đúng bài đang xem thì chuyển sang bài kế/bài trước, hết bài thì về Lớp học.
                if (wasCurrent) {
                  const next = l.nextLessonId ?? l.prevLessonId;
                  navigate(next ? lessonPath(communityId, next) : back, { replace: true });
                }
              },
            })
          }
        />
      )}
    </div>
  );
}
