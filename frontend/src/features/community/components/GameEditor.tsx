import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useGame, usePutGame } from '../queries';
import { errText, inputCls } from './contentUi';
import type { DraftEditorHandle } from './QuizEditor';

interface DraftPair {
  id?: string;
  term: string;
  definition: string;
}

const MIN_PAIRS = 2;
const MAX_PAIRS = 8;
const blank = (): DraftPair => ({ term: '', definition: '' });
const norm = (s: string) => s.trim().toLowerCase();

/**
 * Soạn trò chơi lật thẻ cuối MỘT bài đã lưu (mod+). Không bắt buộc và KHÔNG chặn hoàn thành bài; để trống = bài không có trò chơi.
 * Chỉ lưu khi bấm "Lưu bài học" (LessonEditor gọi `save()` qua ref); bấm X là bỏ thay đổi.
 */
export const GameEditor = forwardRef<DraftEditorHandle, { communityId: string; lessonId: string }>(function GameEditor({ communityId, lessonId }, ref) {
  const { t } = useTranslation('course');
  const gameQ = useGame(communityId, lessonId);
  // Nạp bản nháp đúng MỘT lần, khi dữ liệu mới nhất đã về (mở lại hộp thoại sau khi lưu có thể còn bản cache cũ). Sau đó refetch nền không được ghi đè phần đang gõ.
  const [initial, setInitial] = useState<DraftPair[] | null>(null);
  if (initial === null && gameQ.isSuccess && !gameQ.isFetching) {
    setInitial((gameQ.data.game?.pairs ?? []).map((p) => ({ id: p.id, term: p.term, definition: p.definition })));
  }
  if (gameQ.isError && initial === null) return <p role="alert" className="text-sm text-red-600">{errText(gameQ.error)}</p>;
  if (initial === null) return <p className="text-sm text-stone-400">{t('game.loading')}</p>;
  return <GameEditorForm ref={ref} communityId={communityId} lessonId={lessonId} initial={initial} />;
});

const GameEditorForm = forwardRef<DraftEditorHandle, { communityId: string; lessonId: string; initial: DraftPair[] }>(function GameEditorForm({ communityId, lessonId, initial }, ref) {
  const { t } = useTranslation('course');
  const put = usePutGame(communityId, lessonId);
  const [pairs, setPairs] = useState<DraftPair[]>(initial);
  const dirty = useRef(false);

  const touch = () => {
    dirty.current = true;
  };
  /** Dòng trống hoàn toàn bị bỏ qua khi lưu (để người dùng thêm dòng rồi không bắt buộc điền). */
  const filled = () => pairs.filter((p) => p.term.trim() || p.definition.trim());
  const validate = (): string | null => {
    const list = filled();
    if (list.length === 0) return null;
    if (list.some((p) => !p.term.trim() || !p.definition.trim())) return t('gameEditor.errBlank');
    if (list.length < MIN_PAIRS) return t('gameEditor.errMin', { min: MIN_PAIRS });
    if (new Set(list.map((p) => norm(p.term))).size !== list.length) return t('gameEditor.errDupTerm');
    if (new Set(list.map((p) => norm(p.definition))).size !== list.length) return t('gameEditor.errDupDef');
    return null;
  };
  useImperativeHandle(ref, () => ({
    validate: () => (dirty.current ? validate() : null),
    save: async () => {
      if (!dirty.current) return;
      await put.mutateAsync({ pairs: filled().map((p) => ({ ...(p.id ? { id: p.id } : {}), term: p.term.trim(), definition: p.definition.trim() })) });
      dirty.current = false;
    },
  }));

  const edit = (i: number, patch: Partial<DraftPair>) => {
    touch();
    setPairs((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  };

  return (
    <section className="rounded-xl border border-[#ece5df] bg-[#faf7f4] p-3.5" aria-label={t('gameEditor.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <MaterialIcon name="style" size={20} color="#ff570a" />
        <span className="text-[14px] font-bold">{t('gameEditor.title')}</span>
        <span className="text-[12px] text-stone-500">{t('gameEditor.optional')}</span>
      </div>
      <p className="mt-1 mb-3 text-[12px] text-stone-500">{t('gameEditor.rule', { min: MIN_PAIRS, max: MAX_PAIRS })}</p>

      <div className="flex flex-col gap-2.5">
        {pairs.map((p, i) => (
          <div key={p.id ?? `new-${i}`} className="flex items-start gap-2 rounded-xl border border-[#e7e0da] bg-white p-2.5">
            <span className="mt-2 grid size-6 flex-none place-items-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">{i + 1}</span>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 max-sm:grid-cols-1">
              <input value={p.term} maxLength={80} onChange={(e) => edit(i, { term: e.target.value })} placeholder={t('gameEditor.termPh')} aria-label={t('gameEditor.term', { n: i + 1 })} className={`${inputCls} h-10`} />
              <input value={p.definition} maxLength={160} onChange={(e) => edit(i, { definition: e.target.value })} placeholder={t('gameEditor.defPh')} aria-label={t('gameEditor.def', { n: i + 1 })} className={`${inputCls} h-10`} />
            </div>
            <button
              type="button"
              aria-label={t('gameEditor.remove', { n: i + 1 })}
              onClick={() => {
                touch();
                setPairs((ps) => ps.filter((_, j) => j !== i));
              }}
              className="mt-2 text-stone-400 hover:text-red-600"
            >
              <MaterialIcon name="delete" size={20} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          touch();
          setPairs((ps) => [...ps, blank()]);
        }}
        disabled={pairs.length >= MAX_PAIRS}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#fdba74] bg-white px-4 text-[13px] font-bold text-[#e8590c] disabled:opacity-60"
      >
        <MaterialIcon name="add" size={18} color="#e8590c" /> {t('gameEditor.add', { n: pairs.length, max: MAX_PAIRS })}
      </button>
    </section>
  );
});
