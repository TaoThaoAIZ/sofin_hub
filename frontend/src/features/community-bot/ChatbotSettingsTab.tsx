import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { ErrorLine, errorText, INPUT_CLASS } from '../communities/components/Modal';
import { createBotDoc, createBotQa, deleteBotQa, fetchBotConversationDetail, patchBotDoc, patchBotQa, patchBotSettings } from './api';
import { botKeys, useBotConversations, useBotDocs, useBotQa, useBotSettings } from './queries';
import type { BotSettings, Persona, StyleExample } from './types';

/**
 * Tab "Trợ lý AI" trong Cài đặt cộng đồng (chatbot.md mục 4.8): bật bot (chủ + gói Pro), tên, lời chào, nhân cách mặc định (mẫu /
 * tự tạo theo khuôn taothaoclaw: xưng hô, giọng, emoji, bảng ví dụ Tốt / Lê thê / Cộc), nhân cách VIP được đổi, giới hạn tin/ngày,
 * kho Q&A + tài liệu riêng, câu bot học được chờ duyệt, xem hội thoại.
 */
export function ChatbotSettingsTab({ communityId }: { communityId: string }) {
  const { t } = useTranslation('community-bot-admin');
  const q = useBotSettings(communityId);
  if (q.isPending) return <p className="py-10 text-center text-stone-500">{t('loading')}</p>;
  if (q.error || !q.data) return <ErrorLine>{errorText(q.error)}</ErrorLine>;
  return (
    <div className="flex flex-col gap-5">
      {/* key: dữ liệu server đổi (lưu xong / bật tắt) => form nạp lại từ bản mới. */}
      <SettingsForm key={JSON.stringify(q.data.settings)} communityId={communityId} view={q.data} />
      <QaSection communityId={communityId} />
      <DocsSection communityId={communityId} />
      <ConversationsSection communityId={communityId} />
    </div>
  );
}

const SECTION = 'glass flex flex-col gap-4 rounded-[26px] p-6';
const BLANK_PERSONA: Persona = { label: '', selfPronoun: 'mình', userPronoun: 'bạn', tone: '', emoji: 'none', clarify: '', smallTalk: '', styleExamples: [] };

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-semibold text-stone-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

function SettingsForm({ communityId, view }: { communityId: string; view: NonNullable<ReturnType<typeof useBotSettings>['data']> }) {
  const { t } = useTranslation('community-bot-admin');
  const qc = useQueryClient();
  const [s, setS] = useState<BotSettings>(view.settings);
  const [custom, setCustom] = useState<Persona>(view.settings.customPersona ?? BLANK_PERSONA);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof BotSettings>(k: K, v: BotSettings[K]) => {
    setSaved(false);
    setS((o) => ({ ...o, [k]: v }));
  };
  const usesCustom = s.personaKey === 'custom' || s.memberPersonaKeys.includes('custom');
  const options = [...view.presets.map((p) => ({ key: p.key, label: p.label, sample: p.styleExamples[0]?.good ?? p.tone })), { key: 'custom', label: t('custom'), sample: custom.label || t('customHint') }];

  async function save(patch: Partial<BotSettings>) {
    setBusy(true);
    setErr(null);
    try {
      const next = await patchBotSettings(communityId, patch);
      qc.setQueryData(botKeys.settings(communityId), next);
      void qc.invalidateQueries({ queryKey: botKeys.status(communityId) });
      setSaved(true);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const { enabled: _enabled, customPersona: _cp, ...rest } = s;
  const saveAll = () => void save({ ...rest, ...(usesCustom || view.settings.customPersona ? { customPersona: custom } : {}) });

  return (
    <section className={SECTION}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-extrabold">{t('title')}</h2>
        <label className={`flex items-center gap-2 text-sm font-semibold ${view.canToggle && view.isPro ? '' : 'opacity-60'}`} title={!view.canToggle ? t('onlyOwner') : undefined}>
          <input
            type="checkbox"
            checked={view.settings.enabled}
            disabled={busy || !view.canToggle || (!view.isPro && !view.settings.enabled)}
            onChange={(e) => void save({ enabled: e.target.checked })}
            className="size-4 accent-brand"
          />
          {view.settings.enabled ? t('enabled') : t('disabled')}
        </label>
      </div>
      {!view.isPro && <p className="m-0 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('needPro')}</p>}
      <p className="m-0 text-sm text-stone-600">{t('intro')}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('botName')}>
          <input className={INPUT_CLASS} value={s.botName} maxLength={40} onChange={(e) => set('botName', e.target.value)} />
        </Field>
        <Field label={t('welcome')}>
          <input className={INPUT_CLASS} value={s.welcomeText} maxLength={300} onChange={(e) => set('welcomeText', e.target.value)} placeholder={t('welcomePlaceholder')} />
        </Field>
        <Field label={t('freeDaily')} hint={t('freeDailyHint')}>
          <input className={INPUT_CLASS} type="number" min={0} max={1000} value={s.freeDailyMessages} onChange={(e) => set('freeDailyMessages', Number(e.target.value) || 0)} />
        </Field>
        <Field label={t('vipDaily')} hint={t('vipDailyHint')}>
          <input className={INPUT_CLASS} type="number" min={1} max={5000} value={s.vipDailyMessages} onChange={(e) => set('vipDailyMessages', Number(e.target.value) || 1)} />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-[15px] font-bold">{t('defaultPersona')}</div>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('defaultPersona')}>
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={s.personaKey === o.key}
              onClick={() => set('personaKey', o.key)}
              className={`rounded-2xl border p-3 text-left ${s.personaKey === o.key ? 'border-brand bg-brand/5' : 'border-stone-200 bg-white/60 hover:border-brand/40'}`}
            >
              <div className="text-sm font-bold">{o.label}</div>
              <div className="mt-1 line-clamp-2 text-xs text-stone-500">“{o.sample}”</div>
            </button>
          ))}
        </div>
      </div>

      {usesCustom && <CustomPersonaForm value={custom} onChange={(p) => (setSaved(false), setCustom(p))} />}

      <div>
        <div className="mb-1 text-[15px] font-bold">{t('vipPersonas')}</div>
        <p className="m-0 mb-2 text-xs text-stone-500">{t('vipPersonasHint')}</p>
        <div className="flex flex-wrap gap-3">
          {options.map((o) => (
            <label key={o.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.memberPersonaKeys.includes(o.key)}
                onChange={(e) => set('memberPersonaKeys', e.target.checked ? [...s.memberPersonaKeys, o.key] : s.memberPersonaKeys.filter((k) => k !== o.key))}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      <Field label={t('extra')} hint={t('extraHint')}>
        <textarea className={`${INPUT_CLASS} min-h-24 py-2`} value={s.extraInstructions} maxLength={2000} onChange={(e) => set('extraInstructions', e.target.value)} />
      </Field>

      {err && <ErrorLine>{err}</ErrorLine>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={saveAll} disabled={busy} className="h-11 rounded-xl px-6 text-sm font-bold">
          {t('save')}
        </Button>
        {saved && !busy && <span className="text-sm text-green-700">{t('saved')}</span>}
        {view.settings.enabled && <span className="text-xs text-stone-500">{t('tryHint')}</span>}
      </div>
      <p className="m-0 text-xs text-stone-500">
        {t('stats', { qa: view.stats.qa.active ?? 0, pending: view.stats.qa.candidate ?? 0, docs: view.stats.documents, convs: view.stats.conversations7d, handoffs: view.stats.handoffs7d })}
      </p>
    </section>
  );
}

function CustomPersonaForm({ value, onChange }: { value: Persona; onChange: (p: Persona) => void }) {
  const { t } = useTranslation('community-bot-admin');
  const set = <K extends keyof Persona>(k: K, v: Persona[K]) => onChange({ ...value, [k]: v });
  const setEx = (i: number, patch: Partial<StyleExample>) => set('styleExamples', value.styleExamples.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(120,60,20,.1)] bg-white/60 p-4">
      <div className="text-[15px] font-bold">{t('customTitle')}</div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('pLabel')}>
          <input className={INPUT_CLASS} value={value.label} maxLength={60} onChange={(e) => set('label', e.target.value)} placeholder={t('pLabelPlaceholder')} />
        </Field>
        <Field label={t('pSelf')}>
          <input className={INPUT_CLASS} value={value.selfPronoun} maxLength={20} onChange={(e) => set('selfPronoun', e.target.value)} />
        </Field>
        <Field label={t('pUser')}>
          <input className={INPUT_CLASS} value={value.userPronoun} maxLength={20} onChange={(e) => set('userPronoun', e.target.value)} />
        </Field>
      </div>
      <Field label={t('pTone')} hint={t('pToneHint')}>
        <textarea className={`${INPUT_CLASS} min-h-20 py-2`} value={value.tone} maxLength={1200} onChange={(e) => set('tone', e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('pEmoji')}>
          <select className={INPUT_CLASS} value={value.emoji} onChange={(e) => set('emoji', e.target.value as Persona['emoji'])}>
            <option value="none">{t('emojiNone')}</option>
            <option value="light">{t('emojiLight')}</option>
          </select>
        </Field>
        <Field label={t('pSmallTalk')}>
          <input className={INPUT_CLASS} value={value.smallTalk} maxLength={400} onChange={(e) => set('smallTalk', e.target.value)} />
        </Field>
      </div>
      <div>
        <div className="mb-1 text-sm font-bold">{t('examples')}</div>
        <p className="m-0 mb-2 text-xs text-stone-500">{t('examplesHint')}</p>
        <div className="flex flex-col gap-3">
          {value.styleExamples.map((ex, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3 sm:grid-cols-2">
              <input className={INPUT_CLASS} placeholder={t('exSituation')} value={ex.situation} maxLength={120} onChange={(e) => setEx(i, { situation: e.target.value })} />
              <input className={INPUT_CLASS} placeholder={t('exGood')} value={ex.good} maxLength={400} onChange={(e) => setEx(i, { good: e.target.value })} />
              <input className={INPUT_CLASS} placeholder={t('exVerbose')} value={ex.tooVerbose} maxLength={400} onChange={(e) => setEx(i, { tooVerbose: e.target.value })} />
              <div className="flex gap-2">
                <input className={INPUT_CLASS} placeholder={t('exCurt')} value={ex.tooCurt} maxLength={200} onChange={(e) => setEx(i, { tooCurt: e.target.value })} />
                <button type="button" aria-label={t('remove')} onClick={() => set('styleExamples', value.styleExamples.filter((_, j) => j !== i))} className="flex-none rounded-lg px-2 text-red-600 hover:bg-red-50">
                  ✕
                </button>
              </div>
            </div>
          ))}
          {value.styleExamples.length < 8 && (
            <button
              type="button"
              onClick={() => set('styleExamples', [...value.styleExamples, { situation: '', good: '', tooVerbose: '', tooCurt: '' }])}
              className="self-start rounded-xl border border-dashed border-brand/50 px-3 py-1.5 text-sm font-semibold text-brand"
            >
              + {t('addExample')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QaSection({ communityId }: { communityId: string }) {
  const { t } = useTranslation('community-bot-admin');
  const qc = useQueryClient();
  const [status, setStatus] = useState<'active' | 'candidate'>('active');
  const list = useBotQa(communityId, status);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: botKeys.all(communityId) });
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <section className={SECTION}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-extrabold">{t('qaTitle')}</h2>
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm">
          {(['active', 'candidate'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setStatus(k)} className={`rounded-lg px-3 py-1 ${status === k ? 'bg-white font-semibold shadow' : ''}`}>
              {t(`qa.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="m-0 text-xs text-stone-500">{status === 'active' ? t('qaHint') : t('candidateHint')}</p>
      {status === 'active' && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className={INPUT_CLASS} placeholder={t('question')} value={question} maxLength={1000} onChange={(e) => setQuestion(e.target.value)} />
          <input className={INPUT_CLASS} placeholder={t('answer')} value={answer} maxLength={4000} onChange={(e) => setAnswer(e.target.value)} />
          <Button
            disabled={!question.trim() || !answer.trim()}
            onClick={() => void run(async () => (await createBotQa(communityId, { question, answer }), setQuestion(''), setAnswer('')))}
            className="h-11 rounded-xl px-4 text-sm font-bold"
          >
            {t('add')}
          </Button>
        </div>
      )}
      {err && <ErrorLine>{err}</ErrorLine>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(list.data ?? []).map((qa) => (
          <li key={qa.id} className="rounded-xl border border-stone-200 bg-white/70 p-3 text-sm">
            <div className="font-semibold">{qa.question}</div>
            <div className="mt-1 whitespace-pre-wrap text-stone-600">{qa.answer}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {status === 'candidate' && (
                <button type="button" className="font-semibold text-green-700" onClick={() => void run(() => patchBotQa(communityId, qa.id, { status: 'active' }))}>
                  {t('approve')}
                </button>
              )}
              {status === 'candidate' && (
                <button type="button" className="font-semibold text-stone-500" onClick={() => void run(() => patchBotQa(communityId, qa.id, { status: 'rejected' }))}>
                  {t('reject')}
                </button>
              )}
              <button type="button" className="font-semibold text-red-600" onClick={() => void run(() => deleteBotQa(communityId, qa.id))}>
                {t('delete')}
              </button>
              {qa.hitCount > 0 && <span className="text-stone-400">{t('hits', { count: qa.hitCount })}</span>}
            </div>
          </li>
        ))}
        {list.data?.length === 0 && <li className="text-sm text-stone-400">{t('empty')}</li>}
      </ul>
    </section>
  );
}

function DocsSection({ communityId }: { communityId: string }) {
  const { t } = useTranslation('community-bot-admin');
  const qc = useQueryClient();
  const docs = useBotDocs(communityId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: botKeys.all(communityId) });
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <section className={SECTION}>
      <h2 className="m-0 text-lg font-extrabold">{t('docsTitle')}</h2>
      <p className="m-0 text-xs text-stone-500">{t('docsHint')}</p>
      <input className={INPUT_CLASS} placeholder={t('docTitle')} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={`${INPUT_CLASS} min-h-32 py-2 font-mono text-[13px]`} placeholder={t('docContent')} value={content} maxLength={50_000} onChange={(e) => setContent(e.target.value)} />
      <Button
        disabled={!title.trim() || !content.trim()}
        onClick={() => void run(async () => (await createBotDoc(communityId, { title, contentMd: content }), setTitle(''), setContent('')))}
        className="h-11 self-start rounded-xl px-5 text-sm font-bold"
      >
        {t('addDoc')}
      </Button>
      {err && <ErrorLine>{err}</ErrorLine>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(docs.data ?? []).map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white/70 px-3 py-2 text-sm">
            <span className={d.status === 'archived' ? 'text-stone-400 line-through' : 'font-semibold'}>
              {d.title} <span className="font-normal text-stone-400">· {t('chunks', { count: d.chunks })}</span>
            </span>
            <button type="button" className="text-xs font-semibold text-brand" onClick={() => void run(() => patchBotDoc(communityId, d.id, { status: d.status === 'active' ? 'archived' : 'active' }))}>
              {d.status === 'active' ? t('archive') : t('restore')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConversationsSection({ communityId }: { communityId: string }) {
  const { t } = useTranslation('community-bot-admin');
  const list = useBotConversations(communityId);
  const [open, setOpen] = useState<{ id: string; lines: { role: string; content: string }[] } | null>(null);
  return (
    <section className={SECTION}>
      <h2 className="m-0 text-lg font-extrabold">{t('convsTitle')}</h2>
      <p className="m-0 text-xs text-stone-500">{t('convsHint')}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(list.data ?? []).map((c) => (
          <li key={c.id} className="rounded-xl border border-stone-200 bg-white/70 p-3 text-sm">
            <button
              type="button"
              className="w-full text-left"
              onClick={() =>
                void (open?.id === c.id
                  ? setOpen(null)
                  : fetchBotConversationDetail(communityId, c.id).then((d) => setOpen({ id: c.id, lines: d.messages.map((m) => ({ role: m.role, content: m.redacted ? t('redacted') : m.content })) })))
              }
            >
              <span className="font-semibold">{c.user.name}</span> · {c.firstQuestion || '—'}{' '}
              <span className="text-xs text-stone-400">
                ({t('msgCount', { count: c.messages })}
                {c.status === 'handed_off' ? ` · ${t('handedOff')}` : ''}
                {c.negative ? ` · 👎 ${c.negative}` : ''})
              </span>
            </button>
            {open?.id === c.id && (
              <div className="mt-2 flex flex-col gap-1 border-t border-stone-100 pt-2">
                {open.lines.map((m, i) => (
                  <p key={i} className={`m-0 whitespace-pre-wrap ${m.role === 'user' ? 'text-stone-800' : 'text-brand'}`}>
                    <b>{m.role === 'user' ? t('member') : t('bot')}:</b> {m.content}
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
        {list.data?.length === 0 && <li className="text-sm text-stone-400">{t('emptyConvs')}</li>}
      </ul>
    </section>
  );
}
