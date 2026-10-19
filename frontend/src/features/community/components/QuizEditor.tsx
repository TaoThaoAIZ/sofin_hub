import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { usePutQuiz, useQuiz } from '../queries';
import { errText, ErrorNote, FieldLabel, inputCls } from './contentUi';

interface DraftQuestion {
  text: string;
  options: string[];
  correctIndex: number;
}

const blank = (): DraftQuestion => ({ text: '', options: ['', ''], correctIndex: 0 });
const MAX_Q = 50;

/**
 * Soạn trắc nghiệm cho MỘT bài đã lưu (mod+). Không bắt buộc: để trống = bài không có trắc nghiệm.
 * Có câu hỏi thì học viên phải đạt `passPercent` mới hoàn thành bài; lưu lại sẽ xóa lượt làm cũ.
 */
export interface DraftEditorHandle {
  /** Thông báo lỗi nếu bản nháp chưa hợp lệ (chỉ khi có thay đổi), null nếu ổn. */
  validate: () => string | null;
  /** Lưu bản nháp lên server nếu có thay đổi (ném lỗi nếu thất bại). */
  save: () => Promise<void>;
}

export const QuizEditor = forwardRef<DraftEditorHandle, { communityId: string; lessonId: string }>(function QuizEditor({ communityId, lessonId }, ref) {
  const { t } = useTranslation('course');
  const quizQ = useQuiz(communityId, lessonId);
  const put = usePutQuiz(communityId, lessonId);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [pass, setPass] = useState('70');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  const quiz = quizQ.data?.quiz;
  useEffect(() => {
    if (quizQ.isSuccess && !loaded) {
      // Nạp một lần từ server (mod+ nhận kèm correctIndex).
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuestions((quiz?.questions ?? []).map((q) => ({ text: q.text, options: [...q.options], correctIndex: q.correctIndex ?? 0 })));
      setPass(String(quiz?.passPercent ?? 70));
      setLoaded(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [quizQ.isSuccess, quiz, loaded]);

  // KHÔNG tự lưu: thay đổi chỉ được lưu khi người dùng bấm "Lưu bài học" (LessonEditor gọi `save()` qua ref); bấm X là bỏ.
  const dirty = useRef(false);
  const touch = () => {
    dirty.current = true;
    setSaved(false);
  };
  const validate = (): string | null => {
    const pct = Number(pass);
    if (questions.length > 0 && (!Number.isInteger(pct) || pct < 1 || pct > 100)) return t('quizEditor.passErr');
    for (const [i, q] of questions.entries()) {
      if (!q.text.trim()) return t('quizEditor.errText', { n: i + 1 });
      if (q.options.some((o) => !o.trim())) return t('quizEditor.errOption', { n: i + 1 });
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) return t('quizEditor.errDup', { n: i + 1 });
    }
    return null;
  };
  useImperativeHandle(ref, () => ({
    validate: () => (dirty.current ? validate() : null),
    save: async () => {
      if (!dirty.current) return;
      const pct = Number(pass);
      await put.mutateAsync({ passPercent: questions.length ? pct : 70, questions: questions.map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()), correctIndex: q.correctIndex })) });
      dirty.current = false;
      setSaved(true);
    },
  }));

  const edit = (i: number, patch: Partial<DraftQuestion>) => {
    touch();
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  };

  if (quizQ.isPending) return <p className="text-sm text-stone-400">{t('quiz.loading')}</p>;
  if (quizQ.isError) return <p role="alert" className="text-sm text-red-600">{errText(quizQ.error)}</p>;

  return (
    <section className="rounded-xl border border-[#ece5df] bg-[#faf7f4] p-3.5" aria-label={t('quizEditor.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <MaterialIcon name="quiz" size={20} color="#ff570a" />
        <span className="text-[14px] font-bold">{t('quizEditor.title')}</span>
        <span className="text-[12px] text-stone-500">{t('quizEditor.optional')}</span>
      </div>
      <p className="mt-1 mb-3 text-[12px] text-stone-500">{t('quizEditor.rule')}</p>

      {questions.length > 0 && (
        <label className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold">
          {t('quizEditor.passLabel')}
          <input type="number" min={1} max={100} value={pass} onChange={(e) => { setPass(e.target.value); touch(); }} aria-label={t('quizEditor.passLabel')} className="h-[34px] w-[72px] rounded-[9px] border-[1.5px] border-[#e7e0da] px-2 text-sm outline-0 focus:border-brand" />
          <span className="font-medium text-stone-500">%</span>
        </label>
      )}

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={i} className="rounded-xl border border-[#e7e0da] bg-white p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <FieldLabel required>{t('quizEditor.question', { n: i + 1 })}</FieldLabel>
                <input value={q.text} maxLength={500} onChange={(e) => edit(i, { text: e.target.value })} aria-label={t('quizEditor.question', { n: i + 1 })} className={inputCls} />
              </div>
              <button type="button" aria-label={t('quizEditor.removeQuestion', { n: i + 1 })} onClick={() => { touch(); setQuestions((qs) => qs.filter((_, j) => j !== i)); }} className="mt-6 text-stone-400 hover:text-red-600">
                <MaterialIcon name="delete" size={20} />
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${i}`} checked={q.correctIndex === oi} onChange={() => edit(i, { correctIndex: oi })} aria-label={t('quizEditor.markCorrect', { n: oi + 1 })} className="size-4 flex-none accent-brand" />
                  <input value={o} maxLength={200} onChange={(e) => edit(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={t('quizEditor.optionPh', { n: oi + 1 })} aria-label={t('quizEditor.optionPh', { n: oi + 1 })} className={`${inputCls} h-9`} />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      aria-label={t('quizEditor.removeOption', { n: oi + 1 })}
                      onClick={() => edit(i, { options: q.options.filter((_, k) => k !== oi), correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <MaterialIcon name="close" size={16} />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 6 && (
                <button type="button" onClick={() => edit(i, { options: [...q.options, ''] })} className="self-start text-[12.5px] font-semibold text-brand">
                  + {t('quizEditor.addOption')}
                </button>
              )}
            </div>
            <p className="m-0 mt-1.5 text-[11.5px] text-stone-400">{t('quizEditor.correctHint')}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={questions.length >= MAX_Q} onClick={() => { touch(); setQuestions((qs) => [...qs, blank()]); }} className="h-9 rounded-xl border border-[#fdba74] bg-white px-4 text-[13px] font-bold text-[#e8590c] disabled:opacity-60">
          + {t('quizEditor.addQuestion')}
        </button>
        <span role="status" className="text-[12.5px] text-stone-500">{saved ? t('quizEditor.saved') : t('quizEditor.saveWithLesson')}</span>
      </div>
      <ErrorNote message={put.isError ? errText(put.error) : null} />
    </section>
  );
});
