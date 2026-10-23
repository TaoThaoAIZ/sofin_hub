import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { playCorrect, playPassed, playWrong } from '../../../lib/sfx';
import { useAttemptQuiz, useCheckQuizQuestion, useQuiz } from '../queries';
import type { QuizAttemptResult } from '../types';
import { errText, ErrorNote, ghostBtn, primaryBtn } from './contentUi';
import { QuizMascot } from './QuizMascot';

/**
 * Trắc nghiệm của bài (học viên), làm từng câu một: chọn đáp án là được chấm ngay (kèm âm báo đúng/sai) và chọn lại được ngay.
 * Bài đòi đạt 100% thì phải đúng mới sang câu tiếp; ngưỡng thấp hơn thì sai vẫn đi tiếp được. Cuối bài nộp để server ghi điểm.
 */
export function QuizPanel({ communityId, lessonId }: { communityId: string; lessonId: string }) {
  const { t } = useTranslation('course');
  const quizQ = useQuiz(communityId, lessonId);
  const attempt = useAttemptQuiz(communityId, lessonId);
  const check = useCheckQuizQuestion(communityId, lessonId);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  /** Kết quả chấm ngay của đáp án ĐANG chọn cho từng câu (qid -> đúng/sai). */
  const [graded, setGraded] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  /** Tâm trạng linh vật đang hiển thị (đổi theo đáp án/câu, xem `settledMood` bên dưới). */
  const [mood, setMood] = useState('intro');

  const quiz = quizQ.data?.quiz;
  if (quizQ.isPending) return <p className="mt-6 text-sm text-stone-400">{t('quiz.loading')}</p>;
  if (!quiz) return null;

  const total = quiz.questions.length;
  const q = quiz.questions[Math.min(step, total - 1)]!;
  const picked = answers[q.id];
  const ok = graded[q.id];
  const needAllRight = quiz.passPercent >= 100;
  const canNext = picked !== undefined && !check.isPending && (!needAllRight || ok === true);
  const isLast = step === total - 1;
  const pct = Math.round(((step + 1) / total) * 100);
  // Tâm trạng linh vật: đúng/sai theo đáp án đang chọn, chưa chọn gì thì là lời chào (câu đầu) hoặc lời cổ vũ (các câu sau).
  // Đã chọn nhưng server chưa chấm xong (`picked` có, `ok` chưa có) thì GIỮ nguyên lời thoại hiện tại, không nháy sang lời chào/cổ vũ rồi mới ra đúng/sai.
  const settledMood = ok === true ? 'right' : ok === false ? 'wrong' : picked !== undefined ? null : step === 0 ? 'intro' : 'next';
  if (settledMood && settledMood !== mood) setMood(settledMood);

  const choose = (oi: number) => {
    if (ok === true || check.isPending) return; // câu đã đúng thì khóa; đang chấm thì chờ
    setAnswers((a) => ({ ...a, [q.id]: oi }));
    setGraded((g) => Object.fromEntries(Object.entries(g).filter(([id]) => id !== q.id)));
    check.mutate(
      { questionId: q.id, answer: oi },
      {
        onSuccess: (r) => {
          setGraded((g) => ({ ...g, [q.id]: r.correct }));
          (r.correct ? playCorrect : playWrong)();
        },
      },
    );
  };

  const submit = () => {
    attempt.mutate(
      { answers: quiz.questions.map((x) => answers[x.id] ?? null) },
      {
        onSuccess: (r) => {
          setResult(r);
          (r.passed ? playPassed : playWrong)();
        },
      },
    );
  };

  const restart = () => {
    setAnswers({});
    setGraded({});
    setResult(null);
    setStep(0);
    attempt.reset();
    check.reset();
  };

  if (result) {
    return (
      <section className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-[rgba(120,60,20,.12)] bg-[#fffaf5] p-6 text-center dark:border-white/10 dark:bg-white/5" aria-label={t('quiz.title')}>
        <MaterialIcon name={result.passed ? 'emoji_events' : 'replay'} size={44} filled color={result.passed ? '#059669' : '#ff570a'} />
        <p role="status" className={`m-0 text-[18px] font-extrabold ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>
          {result.passed ? t('quiz.passed') : t('quiz.failed', { need: result.passPercent })}
        </p>
        <p className="m-0 text-[14px] font-semibold text-stone-600">{t('quiz.score', { pct: result.scorePercent, ok: result.correctCount, total: result.total })}</p>
        {result.passed && <p className="m-0 text-[13px] text-stone-600">{t('quiz.passedHint')}</p>}
        {!result.passed && (
          <button type="button" onClick={restart} className={ghostBtn}>
            {t('quiz.retry')}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="mt-5" aria-label={t('quiz.title')}>
      <QuizMascot mood={mood} message={t(`quiz.mascot.${mood}`)} />
      <div className="mt-3 flex items-center gap-3 text-[12.5px] text-stone-500">
        <span className="font-semibold whitespace-nowrap">{t('quiz.stepOf', { n: step + 1, total })}</span>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f6e3d8] dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap">{t('quiz.progress', { pct })}</span>
      </div>
      {quiz.passed && <p className="mt-2 mb-0 text-[13px] font-semibold text-emerald-600">{t('quiz.alreadyPassed', { best: quiz.bestPercent ?? 100 })}</p>}

      <div key={q.id} className="relative mt-4 overflow-hidden rounded-2xl border border-[rgba(120,60,20,.12)] bg-gradient-to-br from-[#fffaf5] to-white p-5 dark:border-white/10 dark:from-white/[.05] dark:to-white/[.02]">
        <div aria-hidden="true" className="pointer-events-none absolute top-3 right-4 grid size-16 rotate-12 place-items-center rounded-2xl bg-gradient-to-br from-[#ffb27a] to-[#ff7a2f] opacity-90 shadow-lg max-sm:hidden">
          <MaterialIcon name="help" size={38} filled color="#fff" />
        </div>
        <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-bold text-brand">{t('quiz.questionN', { n: step + 1 })}</span>
        <h2 className="mt-3 mb-0 pr-0 text-[20px] leading-snug font-extrabold tracking-tight sm:pr-20">{q.text}</h2>

        <div role="radiogroup" aria-label={q.text} className="mt-4 flex flex-col gap-2.5">
          {q.options.map((o, oi) => {
            const sel = picked === oi;
            const right = sel && ok === true;
            const wrong = sel && ok === false;
            return (
              <label
                key={oi}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[14.5px] transition-colors ${
                  right
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/20'
                    : wrong
                      ? 'border-red-400 bg-red-50 dark:bg-red-500/15'
                      : sel
                        ? 'border-brand bg-brand-soft'
                        : 'border-[#ece5df] bg-white hover:border-[#fdba74]'
                } ${ok === true ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <input type="radio" name={`q-${q.id}`} checked={sel} disabled={ok === true} onChange={() => choose(oi)} className="size-4 accent-brand" />
                <span className="min-w-0 flex-1 wrap-break-word">{o}</span>
                {right && <MaterialIcon name="check_circle" size={20} filled color="#059669" />}
                {wrong && <MaterialIcon name="cancel" size={20} filled color="#dc2626" />}
              </label>
            );
          })}
        </div>

        <p role="status" className={`mt-3 mb-0 min-h-5 text-[13.5px] font-semibold ${ok === true ? 'text-emerald-600' : 'text-red-600'}`}>
          {check.isPending ? '' : ok === true ? t('quiz.rightNow') : ok === false ? t('quiz.wrongNow') : ''}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
          <MaterialIcon name="arrow_back" size={18} /> {t('quiz.back')}
        </button>
        {isLast ? (
          <button type="button" onClick={submit} disabled={!canNext || attempt.isPending} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
            {attempt.isPending ? t('quiz.submitting') : t('quiz.submit')}
          </button>
        ) : (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
            {t('quiz.next')} <MaterialIcon name="arrow_forward" size={18} color="#fff" />
          </button>
        )}
      </div>
      <ErrorNote message={check.isError ? errText(check.error) : attempt.isError ? errText(attempt.error) : null} />
    </section>
  );
}
