import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useGames, usePutGames } from '../queries';
import type { GameKind } from '../types';
import { errText, inputCls } from './contentUi';
import { GAME_ICON, scrambleable } from './games/shared';
import type { DraftEditorHandle } from './QuizEditor';

interface DraftPair {
  id?: string;
  term: string;
  definition: string;
}
interface DraftGame {
  /** Khóa cục bộ cho React (game mới chưa có id). */
  key: string;
  id?: string;
  kind: GameKind;
  pairs: DraftPair[];
}

const KINDS: GameKind[] = ['memory', 'match', 'swipe', 'scramble'];
const MIN_PAIRS = 2;
const MAX_PAIRS = 8;
const MAX_GAMES = 6;
const blank = (): DraftPair => ({ term: '', definition: '' });
const norm = (s: string) => s.trim().toLowerCase();
let seq = 0;
const newKey = () => `g${++seq}`;

/**
 * Soạn các trò chơi cuối MỘT bài đã lưu (mod+): một bài gắn được nhiều trò chơi (lật thẻ, nối cặp, đúng/sai, xếp từ).
 * Không bắt buộc và KHÔNG chặn hoàn thành bài; để trống = bài không có trò chơi.
 * Chỉ lưu khi bấm "Lưu bài học" (LessonEditor gọi `save()` qua ref); bấm X là bỏ thay đổi.
 */
export const GameEditor = forwardRef<DraftEditorHandle, { communityId: string; lessonId: string }>(function GameEditor({ communityId, lessonId }, ref) {
  const { t } = useTranslation('course');
  const gamesQ = useGames(communityId, lessonId);
  // Nạp bản nháp đúng MỘT lần, khi dữ liệu mới nhất đã về (mở lại hộp thoại sau khi lưu có thể còn bản cache cũ). Sau đó refetch nền không được ghi đè phần đang gõ.
  const [initial, setInitial] = useState<DraftGame[] | null>(null);
  if (initial === null && gamesQ.isSuccess && !gamesQ.isFetching) {
    setInitial(gamesQ.data.games.map((g) => ({ key: newKey(), id: g.id, kind: g.kind, pairs: g.pairs.map((p) => ({ id: p.id, term: p.term, definition: p.definition })) })));
  }
  if (gamesQ.isError && initial === null) return <p role="alert" className="text-sm text-red-600">{errText(gamesQ.error)}</p>;
  if (initial === null) return <p className="text-sm text-stone-400">{t('game.loading')}</p>;
  return <GameEditorForm ref={ref} communityId={communityId} lessonId={lessonId} initial={initial} />;
});

const GameEditorForm = forwardRef<DraftEditorHandle, { communityId: string; lessonId: string; initial: DraftGame[] }>(function GameEditorForm({ communityId, lessonId, initial }, ref) {
  const { t } = useTranslation('course');
  const put = usePutGames(communityId, lessonId);
  const [games, setGames] = useState<DraftGame[]>(initial);
  const dirty = useRef(false);

  const update = (next: (gs: DraftGame[]) => DraftGame[]) => {
    dirty.current = true;
    setGames(next);
  };
  const patch = (key: string, fn: (g: DraftGame) => DraftGame) => update((gs) => gs.map((g) => (g.key === key ? fn(g) : g)));

  /** Dòng trống hoàn toàn bị bỏ qua khi lưu; trò chơi không còn cặp nào coi như bỏ. */
  const filled = (g: DraftGame) => g.pairs.filter((p) => p.term.trim() || p.definition.trim());
  const kept = () => games.filter((g) => filled(g).length > 0);
  const validate = (): string | null => {
    for (const [i, g] of kept().entries()) {
      const list = filled(g);
      const fail = (msg: string) => t('gameEditor.errGame', { n: i + 1, kind: t(`game.kinds.${g.kind}.name`), msg });
      if (list.some((p) => !p.term.trim() || !p.definition.trim())) return fail(t('gameEditor.errBlank'));
      if (list.length < MIN_PAIRS) return fail(t('gameEditor.errMin', { min: MIN_PAIRS }));
      if (new Set(list.map((p) => norm(p.term))).size !== list.length) return fail(t('gameEditor.errDupTerm'));
      if ((g.kind === 'memory' || g.kind === 'match') && new Set(list.map((p) => norm(p.definition))).size !== list.length) return fail(t('gameEditor.errDupDef'));
      if (g.kind === 'scramble' && list.some((p) => !scrambleable(p.term))) return fail(t('gameEditor.errScramble'));
    }
    return null;
  };
  useImperativeHandle(ref, () => ({
    validate: () => (dirty.current ? validate() : null),
    save: async () => {
      if (!dirty.current) return;
      await put.mutateAsync({
        games: kept().map((g) => ({
          ...(g.id ? { id: g.id } : {}),
          kind: g.kind,
          pairs: filled(g).map((p) => ({ ...(p.id ? { id: p.id } : {}), term: p.term.trim(), definition: p.definition.trim() })),
        })),
      });
      dirty.current = false;
    },
  }));

  return (
    <section className="rounded-xl border border-[#ece5df] bg-[#faf7f4] p-3.5" aria-label={t('gameEditor.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <MaterialIcon name="sports_esports" size={20} color="#ff570a" />
        <span className="text-[14px] font-bold">{t('gameEditor.title')}</span>
        <span className="text-[12px] text-stone-500">{t('gameEditor.optional')}</span>
      </div>
      <p className="mt-1 mb-3 text-[12px] text-stone-500">{t('gameEditor.rule', { min: MIN_PAIRS, max: MAX_PAIRS, maxGames: MAX_GAMES })}</p>

      <div className="flex flex-col gap-3">
        {games.map((g, gi) => (
          <div key={g.key} className="rounded-xl border border-[#e7e0da] bg-white p-3">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <MaterialIcon name={GAME_ICON[g.kind]} size={20} filled color="#ff570a" />
              <span className="text-[13px] font-bold">{t('gameEditor.gameN', { n: gi + 1 })}</span>
              <select
                value={g.kind}
                aria-label={t('gameEditor.kindLabel', { n: gi + 1 })}
                onChange={(e) => patch(g.key, (x) => ({ ...x, kind: e.target.value as GameKind }))}
                className={`${inputCls} h-9 max-w-[220px] min-w-[150px] flex-1`}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>{t(`game.kinds.${k}.name`)}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label={t('gameEditor.removeGame', { n: gi + 1 })}
                onClick={() => update((gs) => gs.filter((x) => x.key !== g.key))}
                className="ml-auto text-stone-400 hover:text-red-600"
              >
                <MaterialIcon name="delete" size={20} />
              </button>
            </div>
            <p className="mt-0 mb-2.5 text-[12px] text-stone-500">{t(`game.kinds.${g.kind}.editorHint`)}</p>

            <div className="flex flex-col gap-2.5">
              {g.pairs.map((p, i) => (
                <div key={p.id ?? `new-${i}`} className="flex items-start gap-2 rounded-xl border border-[#e7e0da] bg-[#fdfbf9] p-2.5">
                  <span className="mt-2 grid size-6 flex-none place-items-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 max-sm:grid-cols-1">
                    <input
                      value={p.term}
                      maxLength={80}
                      onChange={(e) => patch(g.key, (x) => ({ ...x, pairs: x.pairs.map((q, j) => (j === i ? { ...q, term: e.target.value } : q)) }))}
                      placeholder={t(`game.kinds.${g.kind}.termPh`)}
                      aria-label={t('gameEditor.term', { n: i + 1 })}
                      className={`${inputCls} h-10`}
                    />
                    <input
                      value={p.definition}
                      maxLength={160}
                      onChange={(e) => patch(g.key, (x) => ({ ...x, pairs: x.pairs.map((q, j) => (j === i ? { ...q, definition: e.target.value } : q)) }))}
                      placeholder={t(`game.kinds.${g.kind}.defPh`)}
                      aria-label={t('gameEditor.def', { n: i + 1 })}
                      className={`${inputCls} h-10`}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={t('gameEditor.remove', { n: i + 1 })}
                    onClick={() => patch(g.key, (x) => ({ ...x, pairs: x.pairs.filter((_, j) => j !== i) }))}
                    className="mt-2 text-stone-400 hover:text-red-600"
                  >
                    <MaterialIcon name="delete" size={20} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => patch(g.key, (x) => ({ ...x, pairs: [...x.pairs, blank()] }))}
              disabled={g.pairs.length >= MAX_PAIRS}
              className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#fdba74] bg-white px-4 text-[13px] font-bold text-[#e8590c] disabled:opacity-60"
            >
              <MaterialIcon name="add" size={18} color="#e8590c" /> {t('gameEditor.add', { n: g.pairs.length, max: MAX_PAIRS })}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-semibold text-stone-600">{t('gameEditor.addGame', { n: games.length, max: MAX_GAMES })}</span>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={games.length >= MAX_GAMES}
            onClick={() => update((gs) => [...gs, { key: newKey(), kind: k, pairs: [blank(), blank()] }])}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#fdba74] bg-white px-3 text-[13px] font-bold text-[#e8590c] disabled:opacity-60"
          >
            <MaterialIcon name={GAME_ICON[k]} size={18} color="#e8590c" /> {t(`game.kinds.${k}.name`)}
          </button>
        ))}
      </div>
    </section>
  );
});
