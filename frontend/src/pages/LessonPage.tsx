import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { classroomPath, lessonPath } from '../lib/paths';
import { fileKeyOf, useFileUrl } from '../lib/files';
import { errText, ErrorNote, ghostBtn, primaryBtn, safeUrl, toast, ToastHost } from '../features/community/components/contentUi';
import { useCourseList, useLesson, useLessons, useProgress, useToggleLessonComplete } from '../features/community/queries';

// Chỉ nhúng iframe từ các host video đã biết (BE đã dựng lại embedUrl từ ID hợp lệ; FE kiểm tra thêm lần nữa).
const EMBED_PREFIXES = ['https://www.youtube.com/embed/', 'https://www.youtube-nocookie.com/embed/', 'https://player.vimeo.com/video/'];
const isSafeEmbed = (u?: string) => !!u && EMBED_PREFIXES.some((p) => u.startsWith(p));

const fmtSize = (n?: number) => (n === undefined ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

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
      <MaterialIcon name="download" size={20} color="#f26a1b" />
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

  if (lesson.isPending) return <p className="py-10 text-center text-stone-400">{t('lesson.loading')}</p>;

  if (lesson.isError) {
    const err = lesson.error;
    const locked = err instanceof ApiError && err.code === 'MODULE_LOCKED';
    return (
      <div className="glass mx-auto flex max-w-xl flex-col items-center gap-3 rounded-3xl p-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand/10">
          <MaterialIcon name={locked ? 'lock' : 'error'} size={30} filled color="#f26a1b" />
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
  const pct = progress.data?.percent ?? 0;

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
          {l.type === 'video' && !embed && (
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
                disabled={toggle.isPending}
                className={l.completed ? ghostBtn : primaryBtn}
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

            {l.attachments && l.attachments.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[13.5px] font-bold">{t('lesson.attachments')}</div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {l.attachments.map((a) => (
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
          {l.prevLessonId ? (
            <Link to={lessonPath(communityId, l.prevLessonId)} className={ghostBtn}>
              <MaterialIcon name="arrow_back" size={19} /> {t('lesson.prev')}
            </Link>
          ) : (
            <span />
          )}
          {l.nextLessonId ? (
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
        <div className="px-2 pb-2 text-[14px] font-bold">
          #{l.moduleIndex - 1}: {l.moduleTitle}
        </div>
        {siblings.isPending && <p className="px-2 text-sm text-stone-400">{t('lesson.loadingShort')}</p>}
        <div className="flex flex-col gap-1">
          {siblings.data?.map((s) => (
            <Link
              key={s.id}
              to={lessonPath(communityId, s.id)}
              aria-current={s.id === l.id ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] ${s.id === l.id ? 'bg-brand-soft font-semibold text-brand' : 'hover:bg-white'}`}
            >
              <MaterialIcon name={s.completed ? 'check_circle' : 'radio_button_unchecked'} size={18} filled={s.completed} color={s.completed ? '#f26a1b' : '#a8a29e'} />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className="text-[11px] text-stone-400">{s.durationMin}'</span>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
