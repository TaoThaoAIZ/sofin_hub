import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { requestHandoff, sendChatMessage, sendFeedback, startConversation } from './api';
import { useMessageQueue } from './useMessageQueue';
import { useCommunityBotStatus } from '../community-bot/queries';
import { chatbotKeys, useChatbotStatus, useCurrentConversation } from './queries';
import type { ChatConversation, ChatMessage, Handoff, ToolCard } from './types';

/**
 * Trợ lý hỗ trợ nổi góc phải (chatbot.md mục 4). Chỉ hiện khi đã đăng nhập, chatbot đang bật, và không ở khu vực /admin.
 * Trả lời được stream từng mẩu chữ; tin của bot có 👍/👎; nút "Nhắn Zalo hỗ trợ" mở link Zalo kèm mã hỗ trợ.
 */
export function ChatWidget() {
  const { status: authStatus } = useAuth();
  const { pathname } = useLocation();
  const status = useChatbotStatus();
  const [open, setOpen] = useState(false);
  // Trang cộng đồng có trợ lý AI riêng đang dùng được (CommunityBotWidget, cùng góc màn hình) => ẩn Tào để không chồng nhau.
  const communityId = /^\/communities\/([^/]+)\/community(\/|$)/.exec(pathname)?.[1];
  const communityBot = useCommunityBotStatus(communityId);
  if (authStatus !== 'authenticated' || pathname.startsWith('/admin') || communityBot.data?.available || !status.data?.available) return null;
  return open ? <ChatPanel onClose={() => setOpen(false)} zaloUrl={status.data.zaloSupportUrl} maxChars={status.data.maxInputChars} /> : <Launcher onOpen={() => setOpen(true)} />;
}

function Launcher({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation('chatbot');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('open')}
      className="bg-brand-gradient shadow-brand fixed right-4 bottom-[100px] z-[60] md:bottom-6 grid size-14 place-items-center rounded-full text-white hover:brightness-[1.06] md:right-6 md:bottom-6"
    >
      <ChatIcon />
    </button>
  );
}

export interface Bubble extends ChatMessage {
  tools?: ToolCard[];
  /** Lựa chọn trả lời nhanh khi bot hỏi lại (chỉ hiện dưới tin mới nhất). */
  suggestions?: string[];
}

function ChatPanel(props: { onClose: () => void; zaloUrl: string | null; maxChars: number }) {
  const { t } = useTranslation('chatbot');
  const current = useCurrentConversation(true);
  if (current.isPending) {
    return (
      <section role="dialog" aria-label={t('title')} className={PANEL_CLASS}>
        <p className="m-auto text-sm text-stone-400">{t('loading')}</p>
      </section>
    );
  }
  return <ChatSession {...props} initial={current.data ?? null} />;
}

export const PANEL_CLASS =
  'glass fixed inset-0 z-[60] flex flex-col overflow-hidden [--glass-bg:rgba(255,255,255,.92)] sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(620px,calc(100vh-48px))] sm:w-[400px] sm:rounded-3xl';

function ChatSession({
  onClose,
  zaloUrl,
  maxChars,
  initial,
}: {
  onClose: () => void;
  zaloUrl: string | null;
  maxChars: number;
  initial: { conversation: ChatConversation; messages: ChatMessage[] } | null;
}) {
  const { t } = useTranslation('chatbot');
  const qc = useQueryClient();
  // Cộng đồng khách đang xem (/communities/:id/...) — gửi kèm để Tào hiểu "cộng đồng này", "người hướng dẫn này".
  const { pathname } = useLocation();
  const pageCommunityId = /^\/communities\/([^/]+)/.exec(pathname)?.[1];
  const pageRef = useRef(pageCommunityId);
  useEffect(() => {
    pageRef.current = pageCommunityId && pageCommunityId !== 'new' ? pageCommunityId : undefined;
  }, [pageCommunityId]);
  const [conversation, setConversation] = useState<ChatConversation | null>(initial?.conversation ?? null);
  const [messages, setMessages] = useState<Bubble[]>(initial?.messages ?? []);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const errText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : t('error'));

  // Ref: vòng gửi hàng chờ (drain) chạy qua nhiều lần render — đọc state trực tiếp sẽ thấy giá trị cũ và tạo nhầm hội thoại mới.
  const convRef = useRef(conversation);
  useEffect(() => {
    convRef.current = conversation;
  }, [conversation]);

  async function ensureConversation(): Promise<ChatConversation> {
    const cur = convRef.current;
    if (cur && cur.status !== 'closed') return cur;
    const r = await startConversation();
    convRef.current = r.conversation;
    setConversation(r.conversation);
    setMessages([]);
    return r.conversation;
  }

  /** Hàng chờ gộp tin nhắn liên tiếp (useMessageQueue): mỗi lượt gửi các tin gộp, xong thì thêm tin khách + tin bot vào danh sách. */
  const queue = useMessageQueue(
    maxChars,
    async (text, parts, h) => {
      const conv = await ensureConversation();
      const done = await sendChatMessage(conv.id, text, h, pageRef.current);
      const userMsgs: Bubble[] = parts.map((content, i) => ({ id: `local-${done.message.id}-${i}`, role: 'user', content, answerSource: null, feedback: 0, createdAt: done.message.createdAt }));
      setMessages((m) => [...m, ...userMsgs, { ...done.message, tools: done.tools, suggestions: done.suggestions }]);
      convRef.current = done.conversation;
      setConversation(done.conversation);
      if (done.handoff) setHandoff(done.handoff);
      void qc.invalidateQueries({ queryKey: chatbotKeys.current });
    },
    // Lỗi: trả các tin chưa gửi về ô nhập để khách gửi lại, không mất chữ.
    (err, unsent) => {
      setError(errText(err));
      setDraft((d) => [...unsent, d].filter(Boolean).join('\n').slice(0, maxChars));
    },
  );
  const { pending, queued } = queue;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending, queued]);

  /** Gửi ô nhập, hoặc `preset` khi bấm một gợi ý trả lời nhanh (ô nhập giữ nguyên). */
  function send(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    const text = (preset ?? draft).trim();
    if (!text) return;
    setError(null);
    if (preset === undefined) setDraft('');
    queue.enqueue(text);
  }

  async function onHandoff() {
    setError(null);
    try {
      const conv = await ensureConversation();
      const r = await requestHandoff(conv.id);
      setHandoff(r.handoff);
      setConversation(r.conversation);
      if (r.message) setMessages((m) => [...m, r.message!]);
    } catch (err) {
      setError(errText(err));
    }
  }

  async function rate(m: Bubble, value: -1 | 1) {
    const next = m.feedback === value ? 0 : value;
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)));
    try {
      await sendFeedback(m.id, next);
    } catch {
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, feedback: m.feedback } : x)));
    }
  }

  function newChat() {
    queue.clear();
    setConversation(null);
    setMessages([]);
    setHandoff(null);
    setError(null);
    void startConversation()
      .then((r) => setConversation(r.conversation))
      .catch((err) => setError(errText(err)));
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const zaloHref = handoff?.zaloUrl ?? zaloUrl;
  const ticketCode = handoff?.ticketCode ?? conversation?.ticketCode ?? null;

  return (
    <section role="dialog" aria-label={t('title')} className={PANEL_CLASS}>
      <header className="bg-brand-gradient flex items-center gap-3 px-4 py-3 text-white">
        <div className="grid size-9 flex-none place-items-center rounded-full bg-white/20">
          <ChatIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[15px] leading-tight font-bold">{t('title')}</h2>
          <p className="m-0 truncate text-[12px] opacity-90">{t('subtitle')}</p>
        </div>
        <button type="button" onClick={newChat} className="rounded-lg px-2 py-1 text-[12px] font-semibold hover:bg-white/15" title={t('newChat')}>
          {t('newChat')}
        </button>
        <button type="button" onClick={onClose} aria-label={t('close')} className="grid size-8 place-items-center rounded-lg hover:bg-white/15">
          <CloseIcon />
        </button>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && !pending && (
          <div className="m-auto flex max-w-[300px] flex-col gap-3 text-center">
            <p className="m-0 text-sm text-stone-600">{t('greeting')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {(t('suggestions', { returnObjects: true }) as string[]).map((s) => (
                <button key={s} type="button" onClick={() => setDraft(s)} className="glass-chip rounded-xl px-3 py-1.5 text-[13px] text-stone-700 hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            <MessageBubble m={m} onRate={(v) => void rate(m, v)} />
            {m.tools && m.tools.length > 0 && <ToolCards tools={m.tools} />}
            {!pending && i === messages.length - 1 && m.suggestions && m.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-1" role="group" aria-label={t('quickReplies')}>
                {m.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(undefined, s)}
                    className="rounded-xl border border-brand/40 bg-white px-3 py-1.5 text-[13px] font-medium text-brand hover:bg-brand/10"
                  >
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
      </div>

      {ticketCode && (
        <div className="mx-4 mb-2 rounded-2xl bg-brand/10 px-3 py-2 text-[13px] text-stone-700">
          {t('handoffBanner', { code: ticketCode })}
        </div>
      )}
      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2 px-4 pb-2">
        {zaloHref ? (
          <a
            href={zaloHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (!ticketCode) void onHandoff();
            }}
            className="glass-chip flex-1 rounded-xl px-3 py-2 text-center text-[13px] font-semibold text-brand"
          >
            {t('zalo')}
          </a>
        ) : (
          <button type="button" onClick={() => void onHandoff()} disabled={Boolean(ticketCode)} className="glass-chip flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold text-brand disabled:opacity-60">
            {t('human')}
          </button>
        )}
      </div>

      <form onSubmit={(e) => void send(e)} className="flex items-end gap-2 border-t border-[rgba(120,60,20,.1)] px-4 py-3">
        <label className="sr-only" htmlFor="chatbot-input">
          {t('placeholder')}
        </label>
        <textarea
          id="chatbot-input"
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={maxChars}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('placeholder')}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label={t('send')}
          className="bg-brand-gradient shadow-brand-chip grid size-10 flex-none place-items-center rounded-2xl text-white disabled:opacity-50"
        >
          <SendIcon />
        </button>
      </form>
    </section>
  );
}

export function MessageBubble({ m, onRate, streaming }: { m: Bubble; onRate?: (v: -1 | 1) => void; streaming?: boolean }) {
  const { t } = useTranslation('chatbot');
  const mine = m.role === 'user';
  return (
    <div className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed break-words ${mine ? 'whitespace-pre-wrap' : ''} ${
          mine ? 'bg-brand-gradient rounded-br-md text-white' : 'rounded-bl-md bg-white text-stone-800 shadow-[0_1px_4px_rgba(120,60,20,.08)]'
        } ${streaming ? 'opacity-90' : ''}`}
      >
        {mine ? m.content : <RichText text={m.content} />}
      </div>
      {!mine && onRate && !streaming && (
        <div className="flex gap-1 pl-1">
          <RateButton active={m.feedback === 1} label={t('like')} onClick={() => onRate(1)}>
            👍
          </RateButton>
          <RateButton active={m.feedback === -1} label={t('dislike')} onClick={() => onRate(-1)}>
            👎
          </RateButton>
        </div>
      )}
    </div>
  );
}

function RateButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md px-1.5 py-0.5 text-[12px] ${active ? 'bg-brand/15' : 'opacity-50 hover:opacity-100'}`}
    >
      {children}
    </button>
  );
}

function ToolCards({ tools }: { tools: ToolCard[] }) {
  const { t } = useTranslation('chatbot');
  return (
    <div className="flex flex-col gap-2 pl-1">
      {tools.map((tool) => (
        <div key={tool.id} className="flex items-center justify-between gap-2 rounded-2xl border border-brand/15 bg-white/70 px-3 py-2">
          <span className="min-w-0 truncate text-[13px] font-semibold text-stone-800">{tool.name}</span>
          {tool.free && tool.downloadUrl ? (
            <a href={tool.downloadUrl} target="_blank" rel="noopener noreferrer" className="flex-none text-[12px] font-semibold text-green-700 underline">
              {t('download')}
            </a>
          ) : (
            <Link to="/tools" className="flex-none text-[12px] font-semibold text-brand underline">
              {t('buy')}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/** Tên trang hiển thị thay cho đường dẫn (khớp tiền tố dài nhất trước). Khóa i18n: chatbot.pages.<key>. */
const PAGE_LABELS: [prefix: string, key: string][] = [
  ['/settings/thanh-toan', 'billing'],
  ['/settings/bao-mat', 'security'],
  ['/settings/thong-bao', 'notifySettings'],
  ['/settings/gioi-thieu', 'referral'],
  ['/settings', 'settings'],
  ['/communities/new', 'createCommunity'],
  ['/me/communities', 'myCommunities'],
  ['/communities/', 'community'],
  ['/courses/', 'community'],
  ['/forgot-password', 'forgotPassword'],
  ['/tools', 'tools'],
  ['/explore', 'explore'],
  ['/contact', 'contact'],
  ['/faq', 'faq'],
  ['/messages', 'messages'],
  ['/notifications', 'notifications'],
  ['/search', 'search'],
  ['/register', 'register'],
  ['/login', 'login'],
];

type TextLine = { text: string; depth: number };
type TextBlock = { kind: 'p' | 'ul' | 'ol'; lines: TextLine[] };

/** Ô của 1 hàng bảng markdown ("| a | b |" => ["a", "b"]). */
const tableCells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/**
 * Tách câu trả lời thành khối: đoạn (dòng trống ngăn cách), gạch đầu dòng ("- ", "• ", "* "; thụt lề = mục con), bước ("1. ", "1) ").
 * Định dạng ngoài FORMAT_RULE mà model lỡ dùng vẫn hiển thị gọn thay vì lộ ký tự: "# Tiêu đề" => dòng in đậm; bảng "| a | b |" => mỗi
 * hàng 1 gạch đầu dòng "a — b" (bỏ dòng kẻ |---|).
 */
function toBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let cur: TextBlock | null = null;
  const push = (kind: TextBlock['kind'], line: TextLine) => {
    if (!cur || cur.kind !== kind) {
      cur = { kind, lines: [] };
      blocks.push(cur);
    }
    cur.lines.push(line);
  };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      cur = null;
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      push('p', { text: `**${heading[1]!.replace(/\*\*/g, '')}**`, depth: 0 });
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // dòng kẻ |---|---|
      push('ul', { text: tableCells(line).filter(Boolean).join(' — '), depth: 0 });
      continue;
    }
    const item = /^(?:([-•*])|(\d{1,2})[.)])\s+(.+)$/.exec(line);
    const depth = item ? Math.min(2, Math.floor((raw.length - raw.trimStart().length) / 2)) : 0;
    push(item ? (item[1] ? 'ul' : 'ol') : 'p', { text: item ? item[3]! : line, depth });
  }
  return blocks;
}

/**
 * Câu trả lời của bot, trình bày theo đúng tập định dạng prompt cho phép (FORMAT_RULE ở backend): đoạn văn, danh sách
 * gạch đầu dòng / đánh số, **in đậm**, link (Linkified). Đang stream mà "**" chưa đóng thì ẩn dấu đó cho đỡ nhấp nháy.
 */
export function RichText({ text }: { text: string }) {
  const blocks = toBlocks(text);
  const indent = (d: number) => (d ? { marginLeft: d * 14 } : undefined);
  return (
    <div className="flex flex-col gap-1.5">
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline text={l.text} />
              </Fragment>
            ))}
          </p>
        ) : b.kind === 'ul' ? (
          <ul key={i} className="flex flex-col gap-1">
            {b.lines.map((l, j) => (
              <li key={j} style={indent(l.depth)} className="relative pl-3.5 before:absolute before:top-[0.62em] before:left-0.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand/70">
                <Inline text={l.text} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="flex list-decimal flex-col gap-1 pl-5 marker:font-semibold marker:text-brand">
            {b.lines.map((l, j) => (
              <li key={j} style={indent(l.depth)} className="pl-0.5">
                <Inline text={l.text} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

/**
 * Trong 1 dòng: **in đậm**, *nghiêng* / _nghiêng_, `code`, ~~gạch~~ (bỏ dấu) + link. "**" chưa đóng (đang stream) thì ẩn dấu đó.
 */
function Inline({ text }: { text: string }) {
  const marks = text.split('**').length - 1;
  const safe = (marks % 2 ? text.slice(0, text.lastIndexOf('**')) + text.slice(text.lastIndexOf('**') + 2) : text).replace(/~~([^~\n]+)~~/g, '$1');
  return (
    <>
      {safe.split(/\*\*([^*\n]+?)\*\*/g).map((seg, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-stone-900">
            <Linkified text={seg} />
          </strong>
        ) : (
          <Minor key={i} text={seg} />
        ),
      )}
    </>
  );
}

/** *nghiêng* / _nghiêng_ (không dính chữ hai bên — "a*b*c", tên_biến giữ nguyên) và `code`. */
function Minor({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`|(?<![\p{L}\p{N}*_])[*_][^\s*_][^*_\n]*?[*_](?![\p{L}\p{N}*_]))/gu);
  return (
    <>
      {parts.map((p, i) =>
        /^`[^`]+`$/.test(p) ? (
          <code key={i} className="rounded bg-stone-100 px-1 py-px font-mono text-[12.5px]">
            {p.slice(1, -1)}
          </code>
        ) : /^[*_].+[*_]$/.test(p) && p.length > 2 ? (
          <em key={i}>
            <Linkified text={p.slice(1, -1)} />
          </em>
        ) : (
          <Linkified key={i} text={p} />
        ),
      )}
    </>
  );
}

const LINK_CLS = 'rounded-md bg-brand/10 px-1 font-semibold text-brand hover:bg-brand/20';

/**
 * Đường dẫn nội bộ (/tools, /settings/...) hiện thành TÊN TRANG tô màu, bấm được (không hiện dấu "/");
 * URL https hiện tên miền (zalo.me => "Zalo"). Link markdown `[Tên khóa học](/communities/abc)` hiện đúng tên đó.
 */
function Linkified({ text }: { text: string }) {
  const { t } = useTranslation('chatbot');
  const segments = text.split(/(\[[^\]\n]{1,120}\]\((?:\/[a-z0-9][a-z0-9\-/]*(?:\?[\w\-=&%.]+)?|https:\/\/[^\s)]+)\))/gi);
  return (
    <>
      {segments.map((seg, i) => {
        const md = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(seg);
        if (!md) return <PlainLinks key={i} text={seg} t={t} />;
        return <PlainLinks key={i} text={md[2]!} label={md[1]!} t={t} />;
      })}
    </>
  );
}

/** `label` (từ link markdown) thay cho tên trang / tên miền; đường dẫn không hợp lệ thì chỉ hiện `label` dạng chữ. */
function PlainLinks({ text, label, t }: { text: string; label?: string; t: (k: string) => string }) {
  // Đường dẫn phải đứng riêng: trước không phải chữ/số/"/"/"." và sau không phải chữ (kể cả chữ có dấu) — "200.000đ/tháng" không phải link.
  const parts = text.split(/(https:\/\/[^\s)]+|(?<![\p{L}\p{N}/.])\/[a-z0-9][a-z0-9\-/]*(?:\?[\w\-=&%.]+)?(?![\p{L}\p{N}]))/giu);
  if (label !== undefined && parts.length !== 3) return <>{label}</>;
  const pageOf = (full: string): [string, string] | undefined => {
    const [path = '', query = ''] = full.split('?');
    // Bài đăng trên bảng tin (/communities/:id/community?post=…) => "bài đăng".
    if (/^\/communities\/[^/]+\/community$/.test(path) && /(^|&)post=/.test(query)) return [full, 'post'];
    // Bài học trong lớp học (/communities/:id/community/lop-hoc/:lessonId) => "bài học" (bot cộng đồng hay đưa link bài).
    return /^\/communities\/[^/]+\/community\/lop-hoc\/[^/]+$/.test(path)
      ? [path, 'lesson']
      : // Tiền tố kết thúc bằng "/" khớp mọi trang con (/communities/abc); còn lại khớp đúng trang hoặc trang con của nó.
        PAGE_LABELS.find(([prefix]) => (prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`)));
  };
  const hostLabel = (url: string) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return /(^|\.)zalo\.me$/.test(host) ? 'Zalo' : host;
    } catch {
      return url;
    }
  };
  return (
    <>
      {parts.map((p, i) => {
        if (/^https:\/\//i.test(p))
          return (
            <a key={i} href={p} target="_blank" rel="noopener noreferrer" title={p} className={LINK_CLS}>
              {label ?? hostLabel(p)}
            </a>
          );
        const page = /^\/[a-z0-9]/i.test(p) ? pageOf(p.replace(/\/+$/, '')) : undefined;
        if (page) {
          // Chỉ trang có thật trên web mới thành link; đường dẫn lạ giữ nguyên chữ.
          const path = p.replace(/\/+$/, '');
          return (
            <Link key={i} to={path} title={path} className={LINK_CLS}>
              {label ?? t(`pages.${page[1]}`)}
            </Link>
          );
        }
        if (label !== undefined) return p ? <Fragment key={i}>{label}</Fragment> : null;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export const ChatIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />
    <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
  </svg>
);
export const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </svg>
);
