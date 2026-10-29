import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useSubmitSurvey, useSurvey } from '../queries';
import type { SurveyAnswer } from '../types';
import { errText, ErrorNote, ghostBtn, primaryBtn } from './contentUi';

/** Khảo sát của bài (học viên): chọn bất kỳ đáp án nào hoặc tự nhập, lưu lại để chủ cộng đồng biết mong muốn của mình. Nộp lại được (ghi đè). */
export function SurveyPanel({ communityId, lessonId }: { communityId: string; lessonId: string }) {
  const { t } = useTranslation('course');
  const surveyQ = useSurvey(communityId, lessonId);
  const submit = useSubmitSurvey(communityId, lessonId);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);

  const survey = surveyQ.data?.survey;
  useEffect(() => {
    if (survey && !loaded) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setAnswers(Object.fromEntries((survey.myAnswers ?? []).map((a) => [a.questionId, a])));
      setLoaded(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [survey, loaded]);

  if (surveyQ.isPending || !survey) return null;

  const get = (id: string): SurveyAnswer => answers[id] ?? { questionId: id, choices: [] };
  const set = (id: string, patch: Partial<SurveyAnswer>) => {
    setDone(false);
    setAnswers((a) => ({ ...a, [id]: { ...get(id), ...patch } }));
  };
  const toggle = (id: string, type: 'single' | 'multiple', option: string) => {
    const cur = get(id).choices;
    const next = type === 'single' ? (cur.includes(option) ? [] : [option]) : cur.includes(option) ? cur.filter((c) => c !== option) : [...cur, option];
    set(id, { choices: next });
  };

  const has = (a: SurveyAnswer) => a.choices.length > 0 || !!a.text?.trim();
  const missing = survey.questions.some((q) => q.required && !has(get(q.id)));
  const any = survey.questions.some((q) => has(get(q.id)));
  const answeredBefore = !!survey.answeredAt;

  const send = () => {
    submit.mutate(
      survey.questions.map((q) => get(q.id)).filter(has).map((a) => ({ questionId: a.questionId, choices: a.choices, ...(a.text?.trim() ? { text: a.text.trim() } : {}) })),
      { onSuccess: () => setDone(true) },
    );
  };

  return (
    <section className="mt-6 rounded-2xl border border-[rgba(120,60,20,.12)] bg-[#fffaf5] p-4 dark:border-white/10 dark:bg-white/[.05]" aria-label={t('survey.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <MaterialIcon name="poll" size={22} filled color="#ff570a" />
        <h2 className="m-0 text-[17px] font-extrabold">{t('survey.title')}</h2>
      </div>
      <p className="mt-1 mb-0 text-[12.5px] text-stone-500">{t('survey.intro')}</p>
      {answeredBefore && !done && <p className="mt-2 mb-0 text-[13px] font-semibold text-emerald-600">{t('survey.alreadyAnswered')}</p>}

      {(() => {
        const total = survey.questions.length;
        const i = Math.min(step, total - 1);
        const q = survey.questions[i]!;
        const a = get(q.id);
        const isLast = i === total - 1;
        const canNext = !q.required || has(a);
        const pct = Math.round(((i + 1) / total) * 100);
        return (
          <>
            <div className="mt-4 flex items-center gap-3 text-[12.5px] text-stone-500">
              <span className="font-semibold whitespace-nowrap">{t('quiz.stepOf', { n: i + 1, total })}</span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f6e3d8] dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div key={q.id} className="mt-4 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white p-5 dark:border-white/10 dark:bg-white/[.04]">
              <div className="text-[14.5px] font-bold">
                {q.text}
                {q.required && <span className="ml-1 text-red-600" aria-label={t('survey.required')}>*</span>}
                {q.type === 'multiple' && <span className="ml-2 text-[12px] font-medium text-stone-500">{t('survey.multipleHint')}</span>}
              </div>
              {q.type === 'text' ? (
                <textarea
                  value={a.text ?? ''}
                  onChange={(e) => set(q.id, { text: e.target.value })}
                  maxLength={1000}
                  rows={3}
                  placeholder={t('survey.textPh')}
                  aria-label={q.text}
                  className="mt-2 w-full resize-y rounded-xl border-[1.5px] border-[#e7e0da] bg-white p-3 text-[13.5px] outline-0 focus:border-brand"
                />
              ) : (
                <div role={q.type === 'single' ? 'radiogroup' : 'group'} aria-label={q.text} className="mt-2 flex flex-col gap-1.5">
                  {q.options.map((o) => {
                    const picked = a.choices.includes(o);
                    return (
                      <label key={o} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13.5px] ${picked ? 'border-brand bg-brand-soft' : 'border-[#ece5df] bg-white hover:border-[#fdba74]'}`}>
                        <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={`s-${q.id}`} checked={picked} onChange={() => toggle(q.id, q.type as 'single' | 'multiple', o)} className="size-4 accent-brand" />
                        <span className="min-w-0 break-words">{o}</span>
                      </label>
                    );
                  })}
                  {q.allowText && (
                    <textarea
                      value={a.text ?? ''}
                      onChange={(e) => set(q.id, { text: e.target.value })}
                      maxLength={1000}
                      rows={2}
                      placeholder={t('survey.otherPh')}
                      aria-label={t('survey.otherPh')}
                      className="mt-1 w-full resize-y rounded-xl border-[1.5px] border-[#e7e0da] bg-white p-3 text-[13.5px] outline-0 focus:border-brand"
                    />
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(i - 1)} disabled={i === 0} className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
                <MaterialIcon name="arrow_back" size={18} /> {t('quiz.back')}
              </button>
              {isLast ? (
                <button type="button" onClick={send} disabled={!any || missing || submit.isPending} className={primaryBtn}>
                  {submit.isPending ? t('survey.sending') : answeredBefore ? t('survey.update') : t('survey.send')}
                </button>
              ) : (
                <button type="button" onClick={() => setStep(i + 1)} disabled={!canNext} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                  {t('quiz.next')} <MaterialIcon name="arrow_forward" size={18} color="#fff" />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {isLast && missing && <span className="text-[12.5px] text-stone-500">{t('survey.fillRequired')}</span>}
              {done && <span role="status" className="text-[13px] font-semibold text-emerald-600">{t('survey.thanks')}</span>}
            </div>
          </>
        );
      })()}
      <ErrorNote message={submit.isError ? errText(submit.error) : null} />
    </section>
  );
}
