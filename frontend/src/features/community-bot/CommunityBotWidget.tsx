import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { ChatIcon, CloseIcon, MessageBubble, PANEL_CLASS, SendIcon, type Bubble } from '../chatbot/ChatWidget';
import { useMessageQueue } from '../chatbot/useMessageQueue';
import { handoffToOwner, sendBotFeedback, sendBotMessage, setMyPersona, startBotConversation } from './api';
import { botKeys, useBotCurrent, useCommunityBotStatus } from './queries';
import type { BotConversation, BotConversationState, CommunityBotStatus, QuotaView } from './types';

type Available = Extract<CommunityBotStatus, { available: true }>;

/**
 * Trợ lý AI riêng của cộng đồng (chatbot.md mục 4.8) — gắn trong trang cộng đồng (chỉ thành viên vào được). Chỉ hiện khi bot dùng được.
 * Mọi thành viên chat được; VIP (thành viên trả phí) mở khóa chọn nhân cách + nhiều lượt hơn. Thành viên thường thấy nhân cách khóa 🔒
 * và dải nâng cấp (cộng đồng có phí). Bot đề nghị => nút "Gửi câu hỏi cho chủ cộng đồng" (Tin nhắn riêng, chỉ gửi khi bấm).
 */
export function CommunityBotWidget({ communityId }: { communityId: string }) {
  const status = useCommunityBotStatus(communityId);
  const [open, setOpen] = useState(false);
  const { t } = useTranslation('community-bot');
  if (!status.data?.available) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open', { name: status.data.botName })}
        className="bg-brand-gradient shadow-brand fixed right-4 bottom-[100px] z-[60] md:bottom-6 grid size-14 place-items-center rounded-full text-white hover:brightness-[1.06] md:right-6 md:bottom-6"
      >
        <ChatIcon />
      </button>
    );
  }
  return <BotPanel communityId={communityId} status={status.data} onClose={() => setOpen(false)} />;
}

function BotPanel({ communityId, status, onClose }: { communityId: string; status: Available; onClose: () => void }) {
  const { t } = useTranslation('community-bot');
  const current = useBotCurrent(communityId, true);
  if (current.isPending) {
    return (
      <section role="dialog" aria-label={status.botName} className={PANEL_CLASS}>
        <p className="m-auto text-sm text-stone-400">{t('loading')}</p>
      </section>
    );
  }
  return <BotSession communityId={communityId} status={status} onClose={onClose} initial={current.data ?? null} />;
}

function BotSession({ communityId, status, onClose, initial }: { communityId: string; status: Available; onClose: () => void; initial: BotConversationState | null }) {
  const { t } = useTranslation('community-bot');
  const qc = useQueryClient();
  const [conversation, setConversation] = useState<BotConversation | null>(initial?.conversation ?? null);
  const [messages, setMessages] = useState<Bubble[]>(initial?.messages ?? []);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaView>(status.quota);
  const [offer, setOffer] = useState<{ reason: string } | null>(null);
  const [handedOff, setHandedOff] = useState<'message' | 'notification' | null>(null);
  const [personaOpen, setPersonaOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const convRef = useRef(conversation);
  useEffect(() => {
    convRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const errText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : t('error'));

  async function ensureConversation(): Promise<BotConversation> {
    const cur = convRef.current;
    if (cur && cur.status !== 'closed') return cur;
    const r = await startBotConversation(communityId);
    convRef.current = r.conversation;
    setConversation(r.conversation);
    setMessages([]);
    return r.conversation;
  }

  const queue = useMessageQueue(
    status.maxInputChars,
    async (text, parts, h) => {
      const conv = await ensureConversation();
      const done = await sendBotMessage(communityId, conv.id, text, h);
      const userMsgs: Bubble[] = parts.map((content, i) => ({ id: `local-${done.message.id}-${i}`, role: 'user', content, answerSource: null, feedback: 0, createdAt: done.message.createdAt }));
      setMessages((m) => [...m, ...userMsgs, { ...done.message, suggestions: done.suggestions }]);
      convRef.current = done.conversation;
      setConversation(done.conversation);
      setQuota(done.quota);
      setOffer(done.handoffOffer);
      void qc.invalidateQueries({ queryKey: botKeys.current(communityId) });
    },
    (err, unsent) => {
      setError(errText(err));
      setDraft((d) => [...unsent, d].filter(Boolean).join('\n').slice(0, status.maxInputChars));
    },
  );
  const { pending, queued } = queue;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending, queued, offer, handedOff]);

  function send(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    const text = (preset ?? draft).trim();
    if (!text) return;
    setError(null);
    setOffer(null);
    if (preset === undefined) setDraft('');
    queue.enqueue(text);
  }

  async function rate(m: Bubble, value: -1 | 1) {
    const next = m.feedback === value ? 0 : value;
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)));
    try {
      await sendBotFeedback(communityId, m.id, next);
    } catch {
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, feedback: m.feedback } : x)));
    }
  }

  async function sendToOwner() {
    setError(null);
    try {
      const conv = await ensureConversation();
      const r = await handoffToOwner(communityId, conv.id);
      setHandedOff(r.via);
      setOffer(null);
    } catch (err) {
      setError(errText(err));
    }
  }

  async function choosePersona(key: string) {
    setPersonaOpen(false);
    try {
      const next = await setMyPersona(communityId, key);
      qc.setQueryData(botKeys.status(communityId), next);
    } catch (err) {
      setError(errText(err));
    }
  }

  function newChat() {
    queue.clear();
    setConversation(null);
    setMessages([]);
    setOffer(null);
    setHandedOff(null);
    setError(null);
    void startBotConversation(communityId)
      .then((r) => setConversation(r.conversation))
      .catch((err) => setError(errText(err)));
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <section role="dialog" aria-label={status.botName} className={PANEL_CLASS}>
      <header className="bg-brand-gradient flex items-center gap-3 px-4 py-3 text-white">
        <div className="grid size-9 flex-none place-items-center rounded-full bg-white/20">
          <ChatIcon size={18} />
        </div>
        <div className="relative min-w-0 flex-1">
          <h2 className="m-0 truncate text-[15px] leading-tight font-bold">{status.botName}</h2>
          <button
            type="button"
            onClick={() => setPersonaOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={personaOpen}
            aria-label={t('persona', { name: status.persona.label })}
            title={t('persona', { name: status.persona.label })}
            className="flex max-w-full items-center gap-1 rounded px-0 text-left text-[12px] opacity-90 hover:opacity-100"
          >
            <span aria-hidden="true">{status.canChoosePersona ? '🎭' : '🔒'}</span>
            <span className="truncate">{status.persona.label}</span>
            <span aria-hidden="true">▾</span>
          </button>
          {personaOpen && (
            <div role="menu" className="absolute top-full left-0 z-10 mt-1 w-64 rounded-2xl bg-white p-2 text-stone-800 shadow-lg">
              {status.personas.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={p.key === status.persona.key}
                  disabled={!status.canChoosePersona}
                  onClick={() => void choosePersona(p.key)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{p.label}</span>
                  {p.key === status.persona.key ? <span aria-hidden="true">✓</span> : !status.canChoosePersona ? <span aria-hidden="true">🔒</span> : null}
                </button>
              ))}
              {!status.canChoosePersona && <p className="m-0 px-3 pt-1 pb-1 text-[12px] text-stone-500">{t('personaLocked')}</p>}
            </div>
          )}
        </div>
        <span className="flex-none rounded-lg bg-white/15 px-2 py-0.5 text-[11px] font-semibold" title={t('quotaTitle')}>
          {t('quota', { remaining: quota.remaining, limit: quota.limit })}
        </span>
        <button type="button" onClick={newChat} className="rounded-lg px-2 py-1 text-[12px] font-semibold hover:bg-white/15">
          {t('newChat')}
        </button>
        <button type="button" onClick={onClose} aria-label={t('close')} className="grid size-8 place-items-center rounded-lg hover:bg-white/15">
          <CloseIcon />
        </button>
      </header>

      {status.tier === 'free' && status.upgradeAvailable && (
        <Link to={`/communities/${communityId}/checkout`} className="mx-4 mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800 hover:bg-amber-100">
          ✨ {t('upgrade')}
        </Link>
      )}

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && !pending && (
          <div className="m-auto flex max-w-[300px] flex-col gap-2 text-center">
            <p className="m-0 text-sm text-stone-600">{status.welcomeText || t('greeting', { name: status.botName })}</p>
            <p className="m-0 text-[11px] text-stone-400">{t('privacy')}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            <MessageBubble m={m} onRate={(v) => void rate(m, v)} />
            {!pending && i === messages.length - 1 && m.suggestions && m.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-1" role="group" aria-label={t('quickReplies')}>
                {m.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(undefined, s)} className="rounded-xl border border-brand/40 bg-white px-3 py-1.5 text-[13px] font-medium text-brand hover:bg-brand/10">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </Fragment>
        ))}
        {pending && (
          <>
            {pending.user.split('\n').map((line, i) => (
              <MessageBubble key={`p-user-${i}`} m={{ id: `p-user-${i}`, role: 'user', content: line, answerSource: null, feedback: 0, createdAt: '' }} />
            ))}
            <MessageBubble m={{ id: 'p-bot', role: 'assistant', content: pending.reply || (pending.ahead !== undefined ? t('queuePosition', { count: pending.ahead }) : t('typing')), answerSource: null, feedback: 0, createdAt: '' }} streaming />
          </>
        )}
        {queued.map((q, i) => (
          <div key={`q-${i}`} className="flex flex-col items-end gap-0.5 opacity-70">
            <MessageBubble m={{ id: `q-${i}`, role: 'user', content: q, answerSource: null, feedback: 0, createdAt: '' }} />
            <span className="pr-1 text-[11px] text-stone-500">{t('queued')}</span>
          </div>
        ))}
        {offer && !pending && (
          <button type="button" onClick={() => void sendToOwner()} className="self-start rounded-xl border border-brand/40 bg-white px-3 py-2 text-[13px] font-semibold text-brand hover:bg-brand/10">
            ✉️ {t('sendToOwner')}
          </button>
        )}
        {handedOff && (
          <p className="m-0 self-start rounded-2xl bg-brand/10 px-3 py-2 text-[13px] text-stone-700">
            {handedOff === 'message' ? (
              <>
                {t('sentToOwner')}{' '}
                <Link to="/messages" className="font-semibold text-brand underline">
                  {t('openMessages')}
                </Link>
              </>
            ) : (
              t('notifiedOwner')
            )}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={(e) => send(e)} className="flex items-end gap-2 border-t border-[rgba(120,60,20,.1)] px-4 py-3">
        <label className="sr-only" htmlFor="community-bot-input">
          {t('placeholder')}
        </label>
        <textarea
          id="community-bot-input"
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={status.maxInputChars}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('placeholder')}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button type="submit" disabled={!draft.trim()} aria-label={t('send')} className="bg-brand-gradient shadow-brand-chip grid size-10 flex-none place-items-center rounded-2xl text-white disabled:opacity-50">
          <SendIcon />
        </button>
      </form>
    </section>
  );
}
