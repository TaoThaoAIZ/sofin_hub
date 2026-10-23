import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { QuizLoadingScreen } from '../features/community/components/QuizLoadingScreen';
import { QuizPanel } from '../features/community/components/QuizPanel';
import { errText, ghostBtn, primaryBtn } from '../features/community/components/contentUi';
import { useLesson } from '../features/community/queries';
import { lessonPath } from '../lib/paths';

/**
 * Trang riêng cho trắc nghiệm của một bài (khảo sát có trang riêng LessonSurveyPage): học xong (xem hết video nếu có) mới bấm sang đây từ trang bài học,
 * thay vì nằm dồn dưới nội dung bài. Làm xong quay về bài học để bấm "Hoàn thành".
 */
export function LessonQuizPage() {
  const { t } = useTranslation('course');
  const { id: communityId = '', lessonId = '' } = useParams();
  const lesson = useLesson(communityId, lessonId);
  const backToLesson = lessonPath(communityId, lessonId);
  // Video linh vật chạy hết mới vào làm trắc nghiệm (kể cả khi dữ liệu bài đã có sẵn trong cache).
  const [introDone, setIntroDone] = useState(false);
  // Chỉ chào bằng video khi thật sự sắp làm trắc nghiệm (bài có trắc nghiệm và đã mở khóa); lỗi/khóa/không có trắc nghiệm thì báo ngay.
  // Một chỗ render duy nhất cho cả lúc đang tải lẫn lúc đã có dữ liệu để video không bị dựng lại và phát lại từ đầu.
  const d = lesson.data;
  const intro = !introDone && (lesson.isPending || (!!d && !!d.quiz && !(d.video?.required && !d.video.watched)));
  if (intro) return <QuizLoadingScreen onEnded={() => setIntroDone(true)} />;
  // Video đã chạy hết mà dữ liệu bài vẫn chưa về (mạng chậm).
  if (lesson.isPending) return <p className="py-10 text-center text-stone-400">{t('lesson.loading')}</p>;
  if (lesson.isError) {
    return (
      <div className="glass mx-auto flex max-w-xl flex-col items-center gap-3 rounded-3xl p-8 text-center">
        <MaterialIcon name="error" size={30} filled color="#ff570a" />
        <p className="m-0 text-sm text-stone-600">{errText(lesson.error, t('lesson.notFound'))}</p>
        <Link to={backToLesson} className={primaryBtn}>
          {t('lesson.test.backToLesson')}
        </Link>
      </div>
    );
  }

  const l = lesson.data;
  const locked = !!l.video?.required && !l.video.watched;

  return (
    <main className="mx-auto flex w-full max-w-[820px] min-w-0 flex-col gap-4">
      <nav aria-label={t('lesson.breadcrumb')} className="flex flex-wrap items-center gap-1.5 text-[13px] text-stone-500">
        <Link to={backToLesson} className="inline-flex items-center gap-1 hover:text-brand">
          <MaterialIcon name="arrow_back" size={16} /> {t('lesson.test.backToLesson')}
        </Link>
        <MaterialIcon name="chevron_right" size={16} />
        <span className="truncate">{l.title}</span>
      </nav>

      <article className="glass rounded-3xl p-5">
        <h1 className="m-0 text-[22px] leading-tight font-extrabold tracking-tight">{t('lesson.test.pageTitle', { title: l.title })}</h1>

        {locked ? (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
            <span className="flex items-center gap-2 text-[14px] font-bold">
              <MaterialIcon name="lock" size={20} filled color="currentColor" /> {t('lesson.test.lockedTitle')}
            </span>
            <p className="m-0 text-[13.5px]">{t('lesson.videoMustWatch')}</p>
            <Link to={backToLesson} className={primaryBtn}>
              {t('lesson.test.watchVideo')}
            </Link>
          </div>
        ) : (
          <>
            {l.quiz && <QuizPanel communityId={communityId} lessonId={l.id} />}
            {!l.quiz && <p className="mt-4 mb-0 text-sm text-stone-500">{t('lesson.test.none')}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[rgba(120,60,20,.1)] pt-4">
              <Link to={backToLesson} className={l.quiz?.passed || !l.quiz ? primaryBtn : ghostBtn}>
                <MaterialIcon name="arrow_back" size={18} color={l.quiz?.passed || !l.quiz ? '#fff' : undefined} /> {t('lesson.test.backToComplete')}
              </Link>
            </div>
          </>
        )}
      </article>
    </main>
  );
}
