import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAttemptQuiz, useQuiz } from '../queries';
import type { QuizAttemptResult } from '../types';
import { errText, ErrorNote, ghostBtn, primaryBtn } from './contentUi';

/** Trắc nghiệm của bài (học viên): chọn đáp án, nộp, xem điểm. Đạt điểm mới hoàn thành được bài; đáp án đúng chỉ hiện sau khi đạt. */
export function QuizPanel({ communityId, lessonId }: { communityId: string; lessonId: string }) {
  const { t } = useTranslation('course');
  const quizQ = useQuiz(communityId, lessonId);
  const attempt = useAttemptQuiz(communityId, lessonId);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const quiz = quizQ.data?.quiz;
  if (quizQ.isPending) return <p className="mt-6 text-sm text-stone-400">{t('quiz.loading')}</p>;
  if (!quiz) return null;

  const all = quiz.questions.every((q) => answers[q.id] !== undefined);
  const resultOf = (qid: string) => result?.results.find((r) => r.questionId === qid);

  const submit = () => {
    attempt.mutate(
      { answers: quiz.questions.map((q) => answers[q.id] ?? null) },
      { onSuccess: (r) => setResult(r) },
    );
  };
  const retry = () => {
    setAnswers({});
    setResult(null);
    attempt.reset();
  };

  return (
    <section className="mt-6 rounded-2xl border border-[rgba(120,60,20,.12)] bg-[#fffaf5] p-4" aria-label={t('quiz.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <MaterialIcon name="quiz" size={22} filled color="#ff570a" />
        <h2 className="m-0 text-[17px] font-extrabold">{t('quiz.title')}</h2>
        <span className="ml-auto text-[12.5px] text-stone-500">{t('quiz.passRule', { n: quiz.questionCount, pct: quiz.passPercent })}</span>
      </div>
      {quiz.passed && !result && <p className="mt-2 mb-0 text-[13px] font-semibold text-emerald-600">{t('quiz.alreadyPassed', { best: quiz.bestPercent ?? 100 })}</p>}

      <ol className="mt-4 mb-0 flex list-none flex-col gap-5 p-0">
        {quiz.questions.map((q, i) => {
          const r = resultOf(q.id);
          return (
            <li key={q.id}>
              <div className="text-[14.5px] font-bold">
                {i + 1}. {q.text}
                {r && <span className={`ml-2 text-[12.5px] font-semibold ${r.correct ? 'text-emerald-600' : 'text-red-600'}`}>{r.correct ? t('quiz.correct') : t('quiz.wrong')}</span>}
              </div>
              <div role="radiogroup" aria-label={q.text} className="mt-2 flex flex-col gap-1.5">
                {q.options.map((o, oi) => {
                  const picked = answers[q.id] === oi;
                  const isRight = r?.correctIndex === oi;
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13.5px] ${
                        isRight ? 'border-emerald-400 bg-emerald-50' : picked ? 'border-brand bg-brand-soft' : 'border-[#ece5df] bg-white hover:border-[#fdba74]'
                      } ${result ? 'cursor-default' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={picked}
                        disabled={!!result}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        className="size-4 accent-brand"
                      />
                      <span className="min-w-0 break-words">{o}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!result ? (
          <button type="button" onClick={submit} disabled={!all || attempt.isPending} className={primaryBtn}>
            {attempt.isPending ? t('quiz.submitting') : t('quiz.submit')}
          </button>
        ) : (
          <>
            <p role="status" className={`m-0 text-[14px] font-bold ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>
              {t('quiz.score', { pct: result.scorePercent, ok: result.correctCount, total: result.total })} · {result.passed ? t('quiz.passed') : t('quiz.failed', { need: result.passPercent })}
            </p>
            <button type="button" onClick={retry} className={ghostBtn}>
              {t('quiz.retry')}
            </button>
          </>
        )}
        {!all && !result && <span className="text-[12.5px] text-stone-500">{t('quiz.answerAll')}</span>}
      </div>
      {result?.passed && <p className="mt-2 mb-0 text-[13px] text-stone-600">{t('quiz.passedHint')}</p>}
      <ErrorNote message={attempt.isError ? errText(attempt.error) : null} />
    </section>
  );
}
