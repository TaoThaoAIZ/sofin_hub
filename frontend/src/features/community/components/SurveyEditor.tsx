import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Link } from 'react-router-dom';
import { communityHome } from '../../../lib/paths';
import { usePutSurvey, useSurvey } from '../queries';
import type { SurveyQuestionType } from '../types';
import { errText, ErrorNote, FieldLabel, inputCls } from './contentUi';

interface DraftQuestion {
  id?: string;
  text: string;
  type: SurveyQuestionType;
  options: string[];
  required: boolean;
}

const blank = (): DraftQuestion => ({ text: '', type: 'single', options: ['', ''], required: false });
const MAX_Q = 30;
const MAX_OPT = 10;
const TYPES: SurveyQuestionType[] = ['single', 'multiple', 'text'];

/**
 * Soạn khảo sát cho MỘT bài đã lưu (mod+). Không bắt buộc và KHÔNG chặn hoàn thành bài.
 * Học viên chọn bất kỳ đáp án nào (một/nhiều lựa chọn) hoặc tự nhập; chủ cộng đồng xem kết quả ngay bên dưới.
 */
export function SurveyEditor({ communityId, lessonId }: { communityId: string; lessonId: string }) {
  const { t } = useTranslation('course');
  const surveyQ = useSurvey(communityId, lessonId);
  const put = usePutSurvey(communityId, lessonId);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const survey = surveyQ.data?.survey;
  useEffect(() => {
    if (surveyQ.isSuccess && !loaded) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuestions((survey?.questions ?? []).map((q) => ({ id: q.id, text: q.text, type: q.type, options: [...q.options], required: q.required })));
      setLoaded(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [surveyQ.isSuccess, survey, loaded]);

  const edit = (i: number, patch: Partial<DraftQuestion>) => {
    setSaved(false);
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  };
  const changeType = (i: number, type: SurveyQuestionType) => {
    const q = questions[i]!;
    edit(i, { type, options: type === 'text' ? [] : q.options.length >= 2 ? q.options : ['', ''] });
  };

  const save = () => {
    setLocalErr(null);
    setSaved(false);
    for (const [i, q] of questions.entries()) {
      if (!q.text.trim()) return setLocalErr(t('surveyEditor.errText', { n: i + 1 }));
      if (q.type === 'text') continue;
      if (q.options.some((o) => !o.trim())) return setLocalErr(t('surveyEditor.errOption', { n: i + 1 }));
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) return setLocalErr(t('surveyEditor.errDup', { n: i + 1 }));
    }
    put.mutate(
      { questions: questions.map((q) => ({ ...(q.id ? { id: q.id } : {}), text: q.text.trim(), type: q.type, options: q.type === 'text' ? [] : q.options.map((o) => o.trim()), required: q.required })) },
      { onSuccess: () => setSaved(true) },
    );
  };

  if (surveyQ.isPending) return <p className="text-sm text-stone-400">{t('survey.loading')}</p>;
  if (surveyQ.isError) return <p role="alert" className="text-sm text-red-600">{errText(surveyQ.error)}</p>;

  return (
    <section className="rounded-xl border border-[#ece5df] bg-[#faf7f4] p-3.5" aria-label={t('surveyEditor.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <MaterialIcon name="poll" size={20} color="#ff570a" />
        <span className="text-[14px] font-bold">{t('surveyEditor.title')}</span>
        <span className="text-[12px] text-stone-500">{t('surveyEditor.optional')}</span>
      </div>
      <p className="mt-1 mb-3 text-[12px] text-stone-500">{t('surveyEditor.rule')}</p>

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.id ?? `new-${i}`} className="rounded-xl border border-[#e7e0da] bg-white p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <FieldLabel required>{t('surveyEditor.question', { n: i + 1 })}</FieldLabel>
                <input value={q.text} maxLength={500} onChange={(e) => edit(i, { text: e.target.value })} aria-label={t('surveyEditor.question', { n: i + 1 })} className={inputCls} />
              </div>
              <button type="button" aria-label={t('surveyEditor.removeQuestion', { n: i + 1 })} onClick={() => { setSaved(false); setQuestions((qs) => qs.filter((_, j) => j !== i)); }} className="mt-6 text-stone-400 hover:text-red-600">
                <MaterialIcon name="delete" size={20} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <select value={q.type} onChange={(e) => changeType(i, e.target.value as SurveyQuestionType)} aria-label={t('surveyEditor.typeLabel')} className="h-9 rounded-[9px] border-[1.5px] border-[#e7e0da] bg-white px-2 text-[13px] outline-0 focus:border-brand">
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>{t(`surveyEditor.types.${ty}`)}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input type="checkbox" checked={q.required} onChange={(e) => edit(i, { required: e.target.checked })} className="size-4 accent-brand" /> {t('surveyEditor.required')}
              </label>
            </div>
            {q.type !== 'text' && (
              <div className="mt-2 flex flex-col gap-1.5">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span aria-hidden className={`size-4 flex-none border-[1.5px] border-stone-300 ${q.type === 'single' ? 'rounded-full' : 'rounded'}`} />
                    <input value={o} maxLength={200} onChange={(e) => edit(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={t('surveyEditor.optionPh', { n: oi + 1 })} aria-label={t('surveyEditor.optionPh', { n: oi + 1 })} className={`${inputCls} h-9`} />
                    {q.options.length > 2 && (
                      <button type="button" aria-label={t('surveyEditor.removeOption', { n: oi + 1 })} onClick={() => edit(i, { options: q.options.filter((_, k) => k !== oi) })} className="text-stone-400 hover:text-red-600">
                        <MaterialIcon name="close" size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < MAX_OPT && (
                  <button type="button" onClick={() => edit(i, { options: [...q.options, ''] })} className="self-start text-[12.5px] font-semibold text-brand">
                    + {t('surveyEditor.addOption')}
                  </button>
                )}
              </div>
            )}
            {q.type === 'text' && <p className="m-0 mt-2 text-[11.5px] text-stone-400">{t('surveyEditor.textHint')}</p>}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={questions.length >= MAX_Q} onClick={() => { setSaved(false); setQuestions((qs) => [...qs, blank()]); }} className="h-9 rounded-xl border border-[#fdba74] bg-white px-4 text-[13px] font-bold text-[#e8590c] disabled:opacity-60">
          + {t('surveyEditor.addQuestion')}
        </button>
        <button type="button" onClick={save} disabled={put.isPending} className="h-9 rounded-xl bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-60">
          {put.isPending ? t('surveyEditor.saving') : t('surveyEditor.save')}
        </button>
        {saved && <span role="status" className="text-[12.5px] font-semibold text-emerald-600">{questions.length ? t('surveyEditor.saved') : t('surveyEditor.removed')}</span>}
      </div>
      <ErrorNote message={localErr ?? (put.isError ? errText(put.error) : null)} />
      {survey && (
        <Link to={communityHome(communityId, `khao-sat/${lessonId}`)} className="mt-3 inline-flex items-center gap-1.5 border-t border-[#e7e0da] pt-3 text-[13px] font-bold text-brand">
          <MaterialIcon name="bar_chart" size={18} color="#ff570a" /> {t('surveyEditor.viewResults')}
        </Link>
      )}
    </section>
  );
}
