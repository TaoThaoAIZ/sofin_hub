import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useDeleteLesson, useCreateModule, useLessons, useMembers, useModuleAccess, useModules, useSetModuleAccess, useUpdateModule } from '../queries';
import type { ClassroomLesson, ClassroomModule, ModuleAccessMode } from '../types';
import { areaCls, ConfirmDialog, errText, ErrorNote, FieldLabel, inputCls, toast } from './contentUi';
import { CoverField } from './CoverField';
import { LessonEditor, lessonHasContent } from './LessonEditor';
import { ModalShell, shellGhostBtn, shellPrimaryBtn, ShellBody, ShellFooter, Toggle, type ShellStep } from './ModalShell';

type Step = 'info' | 'outline' | 'lesson' | 'publish' | 'done';
const LEVELS = [2, 3, 4, 5, 6, 7, 8, 9];
const TYPE_ICON = { video: 'smart_display', text: 'article', file: 'attach_file' } as const;
const MODES: ModuleAccessMode[] = ['all', 'level', 'paid', 'selected'];

/** Ô chọn thành viên được mở khóa (chế độ "Chỉ người được chọn"). */
function MemberPicker({ communityId, value, onChange }: { communityId: string; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useTranslation('community');
  const [q, setQ] = useState('');
  const members = useMembers(communityId, { q: q.trim() || undefined, page: 1, sort: 'active' });
  const rows = members.data?.data ?? [];
  return (
    <div className="mt-2.5 rounded-xl border-[1.5px] border-[#e7e0da] bg-white p-2" onClick={(e) => e.stopPropagation()}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('modWizard.info.selected.search')} aria-label={t('modWizard.info.selected.search')} className="mb-1.5 h-8 w-full rounded-lg border border-[#e7e0da] px-2.5 text-[12.5px] outline-0 focus:border-brand" />
      <div className="max-h-40 overflow-y-auto">
        {rows.length === 0 && <p className="m-0 px-2 py-3 text-center text-xs text-stone-400">{t('modWizard.info.selected.none')}</p>}
        {rows.map((m) => {
          const on = m.id in value;
          return (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[#fff6f0]">
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  const next = { ...value };
                  if (on) delete next[m.id];
                  else next[m.id] = m.name;
                  onChange(next);
                }}
                className="accent-[#f26a1b]"
              />
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ModuleWizard({ communityId, courseId, module: initial, onClose }: { communityId: string; courseId: string; module?: ClassroomModule | null; onClose: () => void }) {
  const { t } = useTranslation('community');
  const isEdit = !!initial;
  const [moduleId, setModuleId] = useState<string | null>(initial?.id ?? null);
  const modules = useModules(communityId, courseId);
  const mod = modules.data?.find((m) => m.id === moduleId) ?? initial ?? null;
  const create = useCreateModule(communityId, courseId);
  const update = useUpdateModule(communityId, courseId);
  const setAccess = useSetModuleAccess(communityId, courseId);
  const del = useDeleteLesson(communityId);
  const lessonsQ = useLessons(communityId, courseId, moduleId);
  const lessons = lessonsQ.data ?? [];
  const access = useModuleAccess(communityId, courseId, isEdit && initial?.accessMode === 'selected' ? moduleId : null);

  const [step, setStep] = useState<Step>('info');
  const [editing, setEditing] = useState<ClassroomLesson | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<ClassroomLesson | null>(null);

  // ---- Bước 1: thông tin
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [thumb, setThumb] = useState(initial?.thumbnail ?? '');
  const [mode, setMode] = useState<ModuleAccessMode>(initial?.accessMode ?? 'all');
  const [level, setLevel] = useState(String(initial?.requiredLevel ?? 3));
  const [price, setPrice] = useState(initial?.priceCents ? String(Math.round(initial.priceCents)) : '');
  const [sequential, setSequential] = useState(initial?.sequential ?? !isEdit);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  useEffect(() => {
    if (access.data) setPicked(Object.fromEntries(access.data.map((m) => [m.id, m.name])));
  }, [access.data]);
  const savingInfo = create.isPending || update.isPending || setAccess.isPending;
  // Trường bắt buộc: tên + mô tả; chế độ trả phí cần giá > 0. Chưa đủ thì khóa nút "Tiếp tục".
  const infoValid = !!title.trim() && !!description.trim() && (mode !== 'paid' || Number(price) > 0);
  const hasModule = isEdit || !!moduleId; // đã có module (đang sửa, hoặc quay lại bước 1 sau khi tạo)

  // ---- Bước 3: xuất bản
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [announce, setAnnounce] = useState(true);
  const [published, setPublished] = useState<{ notified: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pubErr, setPubErr] = useState<string | null>(null);

  const alreadyPublished = mod?.publishStatus === 'published';
  const done = lessons.filter(lessonHasContent).length;
  const checks = useMemo(
    () => [
      { key: 'nameDesc', ok: !!(title.trim() && description.trim()), required: true },
      { key: 'hasLesson', ok: lessons.length > 0, required: true },
      { key: 'allContent', ok: lessons.length > 0 && done === lessons.length, required: true },
      { key: 'three', ok: lessons.length >= 3, required: false },
      { key: 'hasPreview', ok: lessons.some((l) => l.isPreview), required: false },
    ],
    [title, description, lessons, done],
  );
  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  const submitInfo = async () => {
    setInfoErr(null);
    const name = title.trim();
    if (!name) return setInfoErr(t('modWizard.info.errName'));
    if (!description.trim()) return setInfoErr(t('modWizard.info.errDesc'));
    const priceNum = Number(price);
    if (mode === 'paid' && !(priceNum > 0)) return setInfoErr(t('modWizard.info.errPrice'));
    const common = {
      title: name,
      description: description.trim(),
      accessMode: mode,
      sequential,
      ...(mode === 'level' ? { requiredLevel: Number(level) } : {}),
      ...(mode === 'paid' ? { priceCents: Math.round(priceNum) } : {}),
    };
    try {
      let id = moduleId;
      if (!id) {
        const created = await create.mutateAsync({ ...common, ...(thumb.trim() ? { thumbnail: thumb.trim() } : {}), publishStatus: 'draft' });
        id = created.id;
        setModuleId(id);
      } else {
        await update.mutateAsync({
          moduleId: id,
          body: { ...common, thumbnail: thumb.trim() || null, requiredLevel: mode === 'level' ? Number(level) : null, priceCents: mode === 'paid' ? Math.round(priceNum) : null },
        });
      }
      if (mode === 'selected') await setAccess.mutateAsync({ moduleId: id, userIds: Object.keys(picked) });
      const hasLessons = isEdit ? (mod?.lessonsCount ?? 0) > 0 : false;
      if (hasLessons) setStep('outline');
      else {
        setEditing('new');
        setStep('lesson');
      }
    } catch (e) {
      setInfoErr(errText(e));
    }
  };

  const publish = async () => {
    if (!moduleId || !requiredOk) return;
    setPubErr(null);
    try {
      await update.mutateAsync({
        moduleId,
        body: alreadyPublished ? {} : { publishStatus: 'published', notifyMembers, announce },
      });
      setPublished({ notified: !alreadyPublished && notifyMembers });
      setStep('done');
    } catch (e) {
      setPubErr(errText(e));
    }
  };

  const link = `${window.location.origin}/communities/${communityId}/community/lop-hoc`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* không có quyền clipboard */
    }
    setCopied(true);
  };

  const stepIndex = step === 'info' ? 0 : step === 'publish' ? 2 : 1;
  const steps: ShellStep[] | undefined =
    step === 'done'
      ? undefined
      : (['info', 'content', 'publish'] as const).map((k, i) => ({
          label: t(`modWizard.steps.${k}`),
          state: i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo',
          // Quay lại bước đã qua bằng cách bấm vào thanh bước.
          ...(i < stepIndex && moduleId ? { onSelect: () => { setEditing(null); setStep(i === 0 ? 'info' : 'outline'); } } : {}),
        }));

  const heading: [string, string | undefined] =
    step === 'info'
      ? [isEdit ? t('modWizard.title.edit') : t('modWizard.title.create'), t('modWizard.sub.info')]
      : step === 'outline'
        ? [mod?.title ?? '', t('modWizard.sub.outline')]
        : step === 'lesson'
          ? [editing && editing !== 'new' ? t('modWizard.title.lessonEdit') : t('modWizard.title.lessonAdd'), mod?.title]
          : step === 'publish'
            ? [t('modWizard.title.publish'), t('modWizard.sub.publish')]
            : [t('modWizard.title.done'), mod?.title];

  const optionCard = (k: ModuleAccessMode) => {
    const on = mode === k;
    return (
      <div
        key={k}
        role="radio"
        aria-checked={on}
        tabIndex={0}
        onClick={() => setMode(k)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setMode(k))}
        className={`flex min-h-[84px] cursor-pointer gap-2.5 rounded-xl border-[1.5px] p-3 ${on ? 'border-brand bg-[#fff6f0]' : 'border-[#ece5df] bg-white'}`}
      >
        <span className={`mt-px grid size-[18px] flex-none place-items-center rounded-full ${on ? 'border-2 border-brand' : 'border-[1.5px] border-stone-400'}`}>
          <span className={`size-2 rounded-full ${on ? 'bg-brand' : 'bg-transparent'}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{t(`modWizard.info.${k}.t`)}</div>
          <div className="mt-[3px] text-[12.5px] leading-normal text-stone-600">{t(`modWizard.info.${k}.s`)}</div>
          {k === 'level' && (
            <div onClick={(e) => e.stopPropagation()} className="mt-2">
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  setMode('level');
                }}
                aria-label={t('editor.module.levelAria')}
                className="h-8 rounded-lg border-[1.5px] border-[#e7e0da] bg-white px-2 text-[12.5px] font-semibold"
              >
                {LEVELS.map((n) => (
                  <option key={n} value={n}>
                    {t('modWizard.info.level.opt', { n })}
                  </option>
                ))}
              </select>
            </div>
          )}
          {k === 'paid' && (
            <div onClick={(e) => e.stopPropagation()} className="mt-2 flex h-[34px] w-[150px] items-center gap-1.5 rounded-lg border-[1.5px] border-[#e7e0da] bg-white px-2.5">
              <input
                value={price}
                inputMode="numeric"
                onChange={(e) => {
                  setPrice(e.target.value.replace(/\D/g, '').slice(0, 8));
                  setMode('paid');
                }}
                aria-label={t('modWizard.info.paid.t')}
                placeholder="199000"
                className="min-w-0 flex-1 border-0 text-[13px] font-semibold outline-0"
              />
              <span className="text-[13px] text-stone-500">₫</span>
            </div>
          )}
          {k === 'selected' && on && (
            <div onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setPickerOpen((v) => !v)} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border-[1.5px] border-[#e7e0da] bg-white px-2.5 text-[12.5px] font-semibold hover:border-brand">
                <MaterialIcon name="group_add" size={16} color="currentColor" />
                {t('modWizard.info.selected.pick', { n: Object.keys(picked).length })}
              </button>
              {pickerOpen && <MemberPicker communityId={communityId} value={picked} onChange={setPicked} />}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <ModalShell title={heading[0]} {...(heading[1] ? { subtitle: heading[1] } : {})} {...(steps ? { steps } : {})} onClose={onClose}>
        {step === 'info' && (
          <>
            <ShellBody>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.5fr)]">
                <CoverField value={thumb} onChange={setThumb} onError={setUploadError} height={118} label={t('modWizard.info.cover')} ariaLabel={t('editor.module.thumbAria')} />
                <div className="flex flex-col gap-2.5">
                  <div>
                    <FieldLabel required>{t('modWizard.info.name')}</FieldLabel>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('modWizard.info.namePh')} aria-label={t('modWizard.info.name')} aria-required="true" className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel required>{t('modWizard.info.desc')}</FieldLabel>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder={t('modWizard.info.descPh')} aria-label={t('modWizard.info.desc')} aria-required="true" className={`${areaCls} resize-none`} />
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2.5 text-[13.5px] font-bold">{t('modWizard.info.who')}</div>
                <div role="radiogroup" aria-label={t('modWizard.info.who')} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {MODES.map(optionCard)}
                </div>
              </div>
              <button type="button" onClick={() => setSequential((v) => !v)} aria-pressed={sequential} className="flex items-center gap-3.5 rounded-xl bg-[#faf7f4] px-3.5 py-3 text-left">
                <span className="flex-1">
                  <span className="block text-[13.5px] font-bold">{t('modWizard.info.seq.t')}</span>
                  <span className="mt-0.5 block text-xs text-stone-600">{t('modWizard.info.seq.s')}</span>
                </span>
                <Toggle on={sequential} />
              </button>
              <p className="m-0 text-[12px] text-stone-500"><span className="text-red-600">*</span> {t('modWizard.requiredHint')}</p>
              <ErrorNote message={infoErr ?? uploadError} />
            </ShellBody>
            <ShellFooter>
              <div className="min-w-[160px] flex-1 text-[12.5px] text-stone-600">
                {isEdit ? (
                  alreadyPublished ? t('modWizard.info.statePublished') : t('modWizard.info.stateDraft')
                ) : (
                  <>
                    {t('modWizard.info.createdAs')} <b className="text-stone-900">{t('modWizard.info.draft')}</b>
                  </>
                )}
              </div>
              <button type="button" onClick={onClose} className={shellGhostBtn}>
                {t('modWizard.info.cancel')}
              </button>
              <button type="button" onClick={submitInfo} disabled={savingInfo || !infoValid} className={shellPrimaryBtn}>
                {savingInfo ? t('modWizard.info.saving') : hasModule ? t('modWizard.info.submitEdit') : t('modWizard.info.submitCreate')}
              </button>
            </ShellFooter>
          </>
        )}

        {step === 'outline' && (
          <>
            <ShellBody className="!max-h-[58vh]">
              <div className="rounded-[14px] border border-[#f0ebe6] px-3 py-2.5">
                {lessons.length === 0 && <p className="m-0 px-2 py-3 text-center text-[13px] text-stone-400">{t('modWizard.outline.empty')}</p>}
                {lessons.map((l, i) => {
                  const ok = lessonHasContent(l);
                  return (
                    <div key={l.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-[9px] hover:bg-[#fff6f0]">
                      <button type="button" onClick={() => { setEditing(l); setStep('lesson'); }} aria-label={t('modWizard.outline.edit', { title: l.title })} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <MaterialIcon name={TYPE_ICON[l.type]} size={19} color="#78716c" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">
                            {i + 1}. {l.title}
                          </span>
                          <span className={`mt-px block text-[11.5px] ${ok ? 'text-green-700' : 'text-amber-700'}`}>
                            {ok ? `${t(`modWizard.outline.type.${l.type}`)} · ${t('modWizard.outline.hasContent')}` : t('modWizard.outline.noContent')}
                          </span>
                        </span>
                        {l.isPreview && <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-[10.5px] font-bold text-green-700">{t('modWizard.outline.preview')}</span>}
                        <MaterialIcon name="edit" size={18} color="#a8a29e" />
                      </button>
                      <button type="button" onClick={() => setToDelete(l)} aria-label={t('modWizard.outline.delete', { title: l.title })} className="text-stone-400 hover:text-red-600">
                        <MaterialIcon name="close" size={18} color="currentColor" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { setEditing('new'); setStep('lesson'); }}
                  className="mt-1 flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#fdba74] text-[13.5px] font-bold text-[#e8590c] hover:bg-[#fff9f4]"
                >
                  <MaterialIcon name="add" size={18} color="currentColor" />
                  {t('modWizard.outline.add')}
                </button>
              </div>
            </ShellBody>
            <ShellFooter>
              <div className="min-w-[160px] flex-1 text-[12.5px] text-stone-600">{t('modWizard.outline.summary', { n: lessons.length, done })}</div>
              <button type="button" onClick={onClose} className={shellGhostBtn}>
                {t('modWizard.outline.saveDraft')}
              </button>
              <button type="button" onClick={() => setStep('publish')} className={shellPrimaryBtn}>
                {t('modWizard.outline.next')}
              </button>
            </ShellFooter>
          </>
        )}

        {step === 'lesson' && moduleId && (
          <LessonEditor
            key={editing && editing !== 'new' ? editing.id : 'new'}
            communityId={communityId}
            courseId={courseId}
            moduleId={moduleId}
            {...(editing && editing !== 'new' ? { lesson: editing } : {})}
            defaultPreview={lessons.length === 0}
            onSaved={() => {
              toast(editing && editing !== 'new' ? t('editor.lesson.toastUpdated') : t('editor.lesson.toastCreated'));
              setEditing(null);
              setStep('outline');
            }}
            onBack={() => {
              setEditing(null);
              setStep(lessons.length === 0 ? 'info' : 'outline');
            }}
          />
        )}

        {step === 'publish' && (
          <>
            <ShellBody>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: lessons.length, l: t('modWizard.publish.stat.lessons') },
                  { v: lessons.filter((l) => l.type === 'video').length, l: t('modWizard.publish.stat.videos') },
                  { v: lessons.filter((l) => l.isPreview).length, l: t('modWizard.publish.stat.previews') },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl bg-[#faf7f4] px-3 py-2.5">
                    <div className="text-lg font-extrabold">{s.v}</div>
                    <div className="text-xs text-stone-500">{s.l}</div>
                  </div>
                ))}
              </div>
              <div>
                {checks.map((c) => (
                  <div key={c.key} className="flex gap-2.5 border-t border-[#f3eee9] py-2 text-[13.5px] first:border-t-0">
                    <MaterialIcon name={c.ok ? 'check_circle' : c.required ? 'error' : 'radio_button_unchecked'} size={19} filled={c.ok} color={c.ok ? '#16a34a' : c.required ? '#dc2626' : '#a8a29e'} />
                    <span className="flex-1">{t(`modWizard.publish.check.${c.key}`)}</span>
                    <span className="text-[11.5px] text-stone-400">{c.required ? t('modWizard.publish.required') : t('modWizard.publish.recommended')}</span>
                  </div>
                ))}
              </div>
              {alreadyPublished ? (
                <p className="m-0 rounded-xl bg-green-50 px-3 py-2.5 text-[13px] font-medium text-green-700">{t('modWizard.publish.already')}</p>
              ) : (
                <>
                  {[
                    { k: 'notify', on: notifyMembers, set: () => setNotifyMembers((v) => !v) },
                    { k: 'announce', on: announce, set: () => setAnnounce((v) => !v) },
                  ].map((o) => (
                    <button key={o.k} type="button" onClick={o.set} aria-pressed={o.on} className="flex items-center gap-3 text-left">
                      <span className="flex-1">
                        <span className="block text-[13.5px] font-bold">{t(`modWizard.publish.${o.k}.t`)}</span>
                        <span className="mt-px block text-xs text-stone-600">{t(`modWizard.publish.${o.k}.s`)}</span>
                      </span>
                      <Toggle on={o.on} />
                    </button>
                  ))}
                </>
              )}
              {!requiredOk && (
                <div className="flex gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700">
                  <MaterialIcon name="error" size={18} color="currentColor" />
                  {t('modWizard.publish.block')}
                </div>
              )}
              <ErrorNote message={pubErr} />
            </ShellBody>
            <ShellFooter>
              <button type="button" onClick={() => setStep('outline')} className={shellGhostBtn}>
                {t('modWizard.lesson.back')}
              </button>
              <div className="flex-1" />
              <button type="button" onClick={alreadyPublished ? onClose : publish} disabled={!requiredOk || update.isPending} className={shellPrimaryBtn}>
                {update.isPending ? t('modWizard.publish.publishing') : alreadyPublished ? t('modWizard.publish.finish') : t('modWizard.publish.now')}
              </button>
            </ShellFooter>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="px-[22px] pt-2 pb-1.5 text-center">
              <span className="mx-auto mt-1.5 grid size-[62px] place-items-center rounded-full bg-green-600 shadow-[0_10px_24px_rgba(22,163,74,.3)]">
                <MaterialIcon name="check" size={34} color="#fff" />
              </span>
              <div className="mt-3 text-[13.5px] leading-relaxed text-stone-600">
                {t('modWizard.done.text', { name: mod?.title ?? title, n: lessons.length })}
                {published?.notified ? t('modWizard.done.notified') : ''}
              </div>
              <div className="mt-3.5 flex h-11 items-center gap-2.5 rounded-xl border-[1.5px] border-[#ece5df] px-3 text-left">
                <MaterialIcon name="link" size={19} color="#78716c" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{link}</span>
                <button type="button" onClick={copy} className="text-[13px] font-bold text-[#e8590c]">
                  {copied ? t('modWizard.done.copied') : t('modWizard.done.copy')}
                </button>
              </div>
            </div>
            <div className="px-[22px] pt-3.5 pb-5">
              <button type="button" onClick={() => setStep('outline')} className={`${shellGhostBtn} mb-2.5 h-[46px] w-full`}>
                {t('modWizard.done.backToEdit')}
              </button>
              <button type="button" onClick={onClose} className={`${shellPrimaryBtn} h-[46px] w-full`}>
                {t('modWizard.done.finish')}
              </button>
            </div>
          </>
        )}
      </ModalShell>

      {toDelete && (
        <ConfirmDialog
          title={t('modWizard.outline.deleteTitle')}
          message={t('modWizard.outline.deleteMsg', { title: toDelete.title })}
          confirmLabel={t('modWizard.outline.deleteOk')}
          pending={del.isPending}
          onClose={() => setToDelete(null)}
          onConfirm={() =>
            del.mutate(toDelete.id, {
              onSuccess: () => {
                toast(t('modWizard.outline.deleted'));
                setToDelete(null);
              },
              onError: (e) => toast(errText(e), 'error'),
            })
          }
        />
      )}
    </>
  );
}
