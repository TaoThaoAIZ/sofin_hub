import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { classroomPath, lessonPath, lessonQuizPath, lessonSurveyPath } from '../lib/paths';
import { fileKeyOf, refreshFileUrl, useFileUrl } from '../lib/files';
import { ConfirmDialog, errText, ErrorNote, ghostBtn, isModPlus, primaryBtn, safeUrl, toast, ToastHost } from '../features/community/components/contentUi';
import { LessonFormDialog } from '../features/community/components/ClassroomEditor';
import { useCommunityDetail } from '../features/courses/queries';
import type { ClassroomLesson } from '../features/community/types';
import { useCourseList, useDeleteLesson, useLesson, useLessons, useMarkVideoWatched, useProgress, useReorderLessons, useToggleLessonComplete } from '../features/community/queries';
import { useDragReorder } from '../features/community/useDragReorder';

// Chỉ nhúng iframe từ các host video đã biết (BE đã dựng lại embedUrl từ ID hợp lệ; FE kiểm tra thêm lần nữa).
const EMBED_PREFIXES = ['https://www.youtube.com/embed/', 'https://www.youtube-nocookie.com/embed/', 'https://player.vimeo.com/video/'];
const isSafeEmbed = (u?: string) => !!u && EMBED_PREFIXES.some((p) => u.startsWith(p));

const fmtSize = (n?: number) => (n === undefined ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Thẻ "Làm trắc nghiệm" / "Làm khảo sát" của bài: xong rồi thì đổi thành nút "Đã ..." (vẫn bấm vào xem/làm lại được). */
function TestCard({ icon, title, sub, done, to, startLabel, doneLabel, locked }: { icon: string; title: string; sub: string; done: boolean; to: string; startLabel: string; doneLabel: string; locked: boolean }) {
  const { t } = useTranslation('course');
  const full = 'max-sm:w-full max-sm:justify-center';
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(120,60,20,.12)] bg-[#fffaf5] p-4 dark:border-white/10 dark:bg-white/[.05]" aria-label={title}>
      <MaterialIcon name={icon} size={26} filled color={done ? '#059669' : '#ff570a'} />
      <div className="min-w-[170px] flex-1">
        <div className="text-[15px] font-extrabold">{title}</div>
        <div className="text-[12.5px] text-stone-500">{sub}</div>
      </div>
      {locked ? (
        <button type="button" disabled className={`${primaryBtn} ${full} disabled:cursor-not-allowed disabled:opacity-60`} title={t('lesson.videoMustWatch')}>
          <MaterialIcon name="lock" size={18} color="#fff" /> {t('lesson.test.locked')}
        </button>
      ) : done ? (
        <Link to={to} className={`${full} inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-[13.5px] font-bold text-emerald-700 no-underline hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-400`}>
          <MaterialIcon name="check_circle" size={18} filled color="currentColor" /> {doneLabel}
        </Link>
      ) : (
        <Link to={to} className={`${primaryBtn} ${full}`}>
          {startLabel} <MaterialIcon name="arrow_forward" size={18} color="#fff" />
        </Link>
      )}
    </section>
  );
}

/** Nội dung bài: mặc định gọn 1 dòng, bấm "Xem thêm" để đọc đủ (nút chỉ hiện khi nội dung dài hơn 1 dòng). */
function LessonBody({ body }: { body: string }) {
  const { t } = useTranslation('course');
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!open) setClamped(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [body, open]);

  return (
    <div className="mt-4">
      <div ref={ref} className={`text-[14.5px] leading-[1.7] wrap-break-word whitespace-pre-wrap text-stone-800 ${open ? '' : 'line-clamp-1'}`}>
        {body}
      </div>
      {(clamped || open) && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-bold text-brand hover:underline">
          {open ? t('lesson.bodyLess') : t('lesson.bodyMore')}
        </button>
      )}
    </div>
  );
}

/**
 * Theo dõi mức xem THẬT của video: cộng dồn thời gian phát liên tục (bước nhảy do tua bị bỏ qua).
 * Chỉ coi là "xem hết" khi video kết thúc VÀ đã phát liên tục tối thiểu 85% thời lượng; tua thẳng tới cuối thì không tính.
 */
const WATCH_MIN_RATIO = 0.85;
function useWatchCoverage(onDone: () => void) {
  const last = useRef<number | null>(null);
  const played = useRef(0);
  const duration = useRef(0);
  const [skipped, setSkipped] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  return {
    skipped,
    tick: (t: number, d: number) => {
      if (d > 0) duration.current = d;
      if (last.current !== null) {
        const delta = t - last.current;
        if (delta > 0 && delta < 2.5) played.current += delta;
      }
      last.current = t;
    },
    ended: () => {
      if (duration.current > 0 && played.current >= duration.current * WATCH_MIN_RATIO) {
        setSkipped(false);
        doneRef.current();
      } else {
        // Tua qua video: bắt xem lại từ đầu.
        setSkipped(true);
        played.current = 0;
        last.current = null;
      }
    },
  };
}

/** Video do chủ cộng đồng tải lên (mp4): file riêng tư theo khóa học nên phát bằng URL ký hạn ngắn. */
type Watch = ReturnType<typeof useWatchCoverage>;

function UploadedVideo({ url, title, watch }: { url: string; title: string; watch?: Watch }) {
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
        onTimeUpdate={(e) => watch?.tick(e.currentTarget.currentTime, e.currentTarget.duration)}
        onEnded={() => watch?.ended()}
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

/**
 * Video YouTube/Vimeo nhúng: nghe thông điệp của trình phát (postMessage, không cần tải script ngoài) để biết khi nào video chạy hết.
 * YouTube: bật enablejsapi, gửi 'listening' rồi nhận onStateChange (info 0 = ended). Vimeo: addEventListener 'finish'.
 */
function EmbedPlayer({ src, title, watch }: { src: string; title: string; watch?: Watch }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const watchRef = useRef(watch);
  watchRef.current = watch;
  const isYoutube = src.includes('youtube');
  const url = (() => {
    if (!isYoutube) return src;
    const u = new URL(src);
    u.searchParams.set('enablejsapi', '1');
    u.searchParams.set('origin', window.location.origin);
    return u.toString();
  })();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      let d: { event?: string; info?: unknown } | null = null;
      try {
        d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!d) return;
      if (isYoutube) {
        const info = d.info as { playerState?: number; currentTime?: number; duration?: number } | number | undefined;
        if (typeof info === 'object' && info) {
          if (typeof info.currentTime === 'number') watchRef.current?.tick(info.currentTime, info.duration ?? 0);
          if (info.playerState === 0) watchRef.current?.ended();
        } else if (d.event === 'onStateChange' && info === 0) watchRef.current?.ended();
      } else if (d.event === 'playProgress') {
        const v = (d as { data?: { seconds?: number; duration?: number } }).data;
        if (v && typeof v.seconds === 'number') watchRef.current?.tick(v.seconds, v.duration ?? 0);
      } else if (d.event === 'finish') watchRef.current?.ended();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [isYoutube]);

  // Đăng ký nhận sự kiện sau khi trình phát tải xong (gửi lại sau 1,5s phòng trình phát khởi tạo chậm).
  const subscribe = () => {
    const w = ref.current?.contentWindow;
    if (!w) return;
    const send = () => {
      if (isYoutube) {
        w.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
        w.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 1, channel: 'widget' }), '*');
      } else {
        w.postMessage(JSON.stringify({ method: 'addEventListener', value: 'finish' }), '*');
        w.postMessage(JSON.stringify({ method: 'addEventListener', value: 'playProgress' }), '*');
      }
    };
    send();
    setTimeout(send, 1500);
  };

  return (
    <iframe
      ref={ref}
      src={url}
      title={title}
      onLoad={subscribe}
      className="size-full border-0"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
    />
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
  const markWatched = useMarkVideoWatched(communityId, lessonId);
  const watchedCb = useRef<() => void>(() => undefined);
  const watch = useWatchCoverage(() => watchedCb.current());
  const back = classroomPath(communityId, courseId);
  const { t: tc } = useTranslation('community');
  const navigate = useNavigate();
  const canManage = isModPlus(useCommunityDetail(communityId).data?.viewerRole);
  const removeLesson = useDeleteLesson(communityId);
  const reorderLessons = useReorderLessons(communityId, courseId ?? '');
  const dnd = useDragReorder(siblings.data, (ids, revert) => {
    if (data?.moduleId) reorderLessons.mutate({ moduleId: data.moduleId, ids }, { onError: (e) => { revert(); toast(errText(e), 'error'); } });
  });
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
  const quizBlocks = !!l.quiz && !l.quiz.passed && !l.completed;
  // Xem hết video (nếu có): chưa xem hết thì chưa được hoàn thành bài.
  const videoBlocks = !!l.video?.required && !l.video.watched && !l.completed;
  // Khảo sát có câu bắt buộc chưa trả lời: chưa được hoàn thành bài.
  const surveyBlocks = !!l.surveyBlocks && !l.completed;

  // Video chạy hết => báo server (chỉ khi bài bắt buộc xem hết video và chưa ghi nhận).
  const onVideoEnded = () => {
    if (l.video?.required && !l.video.watched && !markWatched.isPending) markWatched.mutate();
  };

  watchedCb.current = onVideoEnded;

  // Điều kiện để bấm "Hoàn thành": học hết bài theo thứ tự xem video -> đạt trắc nghiệm -> khảo sát bắt buộc.
  const requirements = [
    ...(l.video?.required ? [{ key: 'video', done: !!l.video.watched, label: t('lesson.req.video') }] : []),
    ...(l.quiz ? [{ key: 'quiz', done: l.quiz.passed, label: t('lesson.req.quiz', { pct: l.quiz.passPercent }) }] : []),
    ...(l.surveyRequired ? [{ key: 'survey', done: !l.surveyBlocks, label: t('lesson.req.survey') }] : []),
  ];
  const locked = videoBlocks || quizBlocks || surveyBlocks;

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
              <EmbedPlayer src={embed} title={l.title} watch={watch} />
            </div>
          )}
          {l.type === 'video' && !embed && fileKeyOf(l.videoUrl) && <UploadedVideo url={l.videoUrl!} title={l.title} watch={watch} />}
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
            </div>
            {slideFiles.length > 0 && (
              <div className="mt-4">
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
              <div className="mt-4">
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
            {l.body && <LessonBody key={l.id} body={l.body} />}

            {l.video?.required && (
              <p role="status" className={`mt-3 mb-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold ${l.video.watched ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                <MaterialIcon name={l.video.watched ? 'check_circle' : 'play_circle'} size={18} filled color="currentColor" />
                {l.video.watched ? t('lesson.videoWatched') : watch.skipped ? t('lesson.videoSkipped') : t('lesson.videoMustWatch')}
              </p>
            )}

            {(l.quiz || l.hasSurvey) && (
              <div className="mt-5 flex flex-col gap-3" aria-label={t('lesson.test.title')}>
                {l.quiz && (
                  <TestCard
                    icon="quiz"
                    title={t('lesson.test.quizTitle')}
                    sub={l.quiz.passed ? t('lesson.test.quizDoneSub') : t('lesson.test.quizSub', { n: l.quiz.questionCount, pct: l.quiz.passPercent })}
                    done={l.quiz.passed}
                    to={lessonQuizPath(communityId, l.id)}
                    startLabel={t('lesson.test.start')}
                    doneLabel={t('lesson.test.quizReview')}
                    locked={!!l.video?.required && !l.video.watched}
                  />
                )}
                {l.hasSurvey && (
                  <TestCard
                    icon="poll"
                    title={t('lesson.test.surveyTitle')}
                    sub={l.surveyAnswered ? t('lesson.test.surveyDoneSub') : t('lesson.test.surveySub')}
                    done={!!l.surveyAnswered}
                    to={lessonSurveyPath(communityId, l.id)}
                    startLabel={t('lesson.test.surveyStart')}
                    doneLabel={t('lesson.test.surveyAgain')}
                    locked={!!l.video?.required && !l.video.watched}
                  />
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col items-start gap-2 border-t border-[rgba(120,60,20,.1)] pt-4">
                <button
                  type="button"
                  onClick={onToggle}
                  disabled={toggle.isPending || locked}
                  title={locked ? t('lesson.reqTitle') : undefined}
                  className={`${l.completed ? ghostBtn : primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <MaterialIcon name={l.completed ? 'undo' : 'check_circle'} size={19} color={l.completed ? undefined : '#fff'} />
                  {toggle.isPending ? t('lesson.saving') : l.completed ? t('lesson.uncomplete') : t('lesson.complete')}
                </button>
              {l.completed && (
                <p className="mt-2 mb-0 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
                  <MaterialIcon name="check_circle" size={17} filled color="#059669" /> {t('lesson.youCompleted')}
                </p>
              )}
              {requirements.length > 0 && !l.completed && (
                <div className="mt-1 w-full rounded-xl bg-[rgba(120,60,20,.05)] px-3.5 py-3 dark:bg-white/[.05]">
                  <div className="mb-1.5 text-[12.5px] font-bold text-stone-600">{t('lesson.reqTitle')}</div>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {requirements.map((r) => (
                      <li key={r.key} className={`flex items-center gap-2 text-[13px] ${r.done ? 'text-emerald-600' : 'text-stone-600'}`}>
                        <MaterialIcon name={r.done ? 'check_circle' : 'radio_button_unchecked'} size={17} filled={r.done} color="currentColor" />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

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
          {dnd.items?.map((s) => (
            <div key={s.id} {...(canManage ? dnd.rowProps(s.id) : {})} className={`flex items-center gap-1 rounded-xl ${canManage ? dnd.rowClass(s.id) : ''}`}>
            {canManage && (
              <span {...dnd.handleProps(s.id)} role="img" aria-label={tc('editor.row.dragLesson')} title={tc('editor.row.dragLesson')} className="grid size-6 flex-none place-items-center text-stone-400 hover:text-stone-700">
                <MaterialIcon name="drag_indicator" size={18} />
              </span>
            )}
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
