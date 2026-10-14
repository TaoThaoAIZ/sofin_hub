import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSearchParams } from 'react-router-dom';
import { formatDateTime, formatRelative } from '../../../lib/datetime';
import { useDialogSlot, useTableState } from '../components/Batch2Parts';
import { KpiGrid, type Kpi } from '../components/Cards';
import { DataTable, MainCell, MutedCell, TextCell, type Column, type RowAction } from '../components/DataTable';
import { CheckField, FieldLabel, InputField, ModalShell, useToast } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, CARD_CLS, ErrorBlock, LoadingBlock, StatusBadge, errMessage, fmtNum, type Tone } from '../components/ui';
import { useAdminAction, useAdminData, useAdminList } from '../queries.batch2';
import { ChatbotAccountCard } from './ChatbotAccountCard';

/**
 * Admin > Hỗ trợ > Chatbot (chatbot.md mục 4): kho câu hỏi mẫu, hàng chờ duyệt (học từ chat / nhập từ Zalo), tài liệu tri thức,
 * hội thoại, cài đặt. API: /admin/support/chatbot/* (backend/docs/api/chatbot.md).
 */

type QaStatus = 'active' | 'candidate' | 'rejected' | 'archived' | 'stale';
interface Qa {
  id: string;
  question: string;
  variants: string[];
  answer: string;
  tags: string[];
  status: QaStatus;
  source: 'admin' | 'learned' | 'import';
  confidence: number | null;
  hitCount: number;
  lastHitAt: string | null;
  sourceConversationId: string | null;
  updatedAt: string;
}
interface Summary {
  available: boolean;
  enabled: boolean;
  codexLoggedIn: boolean;
  fakeModel: boolean;
  llm?: { lastSuccessAt: string | null; lastIssue: { kind: 'quota' | 'error'; message: string; at: string } | null; pausedUntil: string | null };
  qa: Record<QaStatus, number>;
  documents: number;
  last7Days: { conversations: number; handedOff: number; negativeFeedback: number };
}
interface DocRow {
  id: string;
  slug: string;
  title: string;
  status: 'active' | 'archived';
  chunks: number;
  updatedAt: string;
}
interface DocDetail extends Omit<DocRow, 'chunks'> {
  contentMd: string;
  chunks: { id: string; position: number; heading: string; content: string }[];
}
interface ConvRow {
  id: string;
  user: { id: string; name: string; email: string };
  status: 'open' | 'handed_off' | 'closed';
  ticketCode: string | null;
  firstMessage: string | null;
  messageCount: number;
  negativeCount: number;
  lastMessageAt: string;
}
interface ConvDetail {
  id: string;
  user: { name: string; email: string };
  status: ConvRow['status'];
  ticketCode: string | null;
  tokensIn: number;
  tokensOut: number;
  messages: { id: string; role: 'user' | 'assistant'; content: string; answerSource: string | null; feedback: number; redacted: boolean; toolCalls: { name: string }[] | null; createdAt: string }[];
}
interface Settings {
  enabled: boolean;
  model: string;
  directThreshold: number;
  maxHistory: number;
  maxInputChars: number;
  dailyMessagesPerUser: number;
  refusalText: string;
  persona: string;
  extraInstructions: string;
  zaloSupportUrl: string;
  zaloHandoffText: string;
}

const B = '/support/chatbot';
const LIMIT = 15;
const TABS = ['qa', 'review', 'docs', 'conversations', 'settings'] as const;
type Tab = (typeof TABS)[number];

const QA_TONE: Record<QaStatus, Tone> = { active: 'g', candidate: 'o', rejected: 'r', archived: 'x', stale: 'o' };
const CONV_TONE: Record<ConvRow['status'], Tone> = { open: 'b', handed_off: 'o', closed: 'x' };

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function ChatbotView() {
  const { t } = useTranslation('admin-chatbot');
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'qa';
  const summary = useAdminData<Summary>('chatbot', `${B}/summary`);
  const s = summary.data;

  const kpis: Kpi[] = s
    ? [
        { icon: 'smart_toy', label: t('kpi.status'), value: s.available ? t('kpi.on') : t('kpi.off') },
        { icon: 'quiz', label: t('kpi.active'), value: fmtNum(s.qa.active) },
        { icon: 'pending_actions', label: t('kpi.candidates'), value: fmtNum(s.qa.candidate + s.qa.stale) },
        { icon: 'forum', label: t('kpi.conversations7d'), value: fmtNum(s.last7Days.conversations) },
        { icon: 'support_agent', label: t('kpi.handedOff7d'), value: fmtNum(s.last7Days.handedOff) },
        { icon: 'thumb_down', label: t('kpi.negative7d'), value: fmtNum(s.last7Days.negativeFeedback), bad: true },
      ]
    : [];

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {s && !s.codexLoggedIn && !s.fakeModel && <Notice tone="r">{t('noKey')}</Notice>}
      {s?.llm?.lastIssue?.kind === 'quota' && (!s.llm.lastSuccessAt || s.llm.lastSuccessAt < s.llm.lastIssue.at) && (
        <Notice tone="r">{t('quota', { time: formatDateTime(s.llm.lastIssue.at), message: s.llm.lastIssue.message })}</Notice>
      )}
      {summary.isError ? <ErrorBlock error={summary.error} onRetry={() => void summary.refetch()} /> : s && <KpiGrid items={kpis} min={150} />}
      <nav className="flex flex-wrap gap-1.5" aria-label={t('title')}>
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            aria-current={tab === k ? 'page' : undefined}
            onClick={() => setParams(k === 'qa' ? {} : { tab: k })}
            className={`h-9 rounded-[10px] px-3.5 text-[13.5px] font-semibold ${tab === k ? 'border-[1.5px] border-brand bg-[#fff4ec] text-[#c2410c]' : 'border-[1.5px] border-[#e7e0da] bg-white text-stone-700'}`}
          >
            {t(`tab.${k}`)}
            {k === 'review' && s ? ` (${fmtNum(s.qa.candidate + s.qa.stale)})` : ''}
          </button>
        ))}
      </nav>
      {tab === 'qa' && <QaTab mode="kb" />}
      {tab === 'review' && <QaTab mode="review" />}
      {tab === 'docs' && <DocsTab />}
      {tab === 'conversations' && <ConversationsTab />}
      {tab === 'settings' && <SettingsTab />}
    </>
  );
}

function Notice({ tone, children }: { tone: 'r' | 'o'; children: ReactNode }) {
  return <div className={`rounded-2xl px-4 py-3 text-[13.5px] font-medium ${tone === 'r' ? 'bg-[#fef2f2] text-[#b91c1c]' : 'bg-[#fff7ed] text-[#9a3412]'}`}>{children}</div>;
}

function TextArea({ label, value, onChange, rows = 4, maxLength, mono }: { label: string; value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        aria-label={label}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full resize-y rounded-xl border-[1.5px] border-[#e7e0da] px-[13px] py-2.5 text-[13.5px] outline-0 focus:border-brand ${mono ? 'font-mono text-[12.5px]' : 'font-medium'}`}
      />
    </div>
  );
}

const sourceLabel = (t: TFunction, q: Qa) => t(`source.${q.source}`) + (q.confidence != null ? ` · ${Math.round(q.confidence * 100)}%` : '');

/* ================================================================ Q&A */

function QaTab({ mode }: { mode: 'kb' | 'review' }) {
  const { t } = useTranslation('admin-chatbot');
  const toast = useToast();
  const act = useAdminAction();
  const slot = useDialogSlot();
  const ts = useTableState({ source: '' }, mode === 'kb' ? 'active' : 'candidate');
  const list = useAdminList<Qa>('chatbot', `${B}/qa`, { status: ts.tab || undefined, source: ts.f.source || undefined, q: ts.q || undefined, page: ts.page, limit: LIMIT });

  const tabs =
    mode === 'kb'
      ? [
          { key: 'active', label: t('qaStatus.active') },
          { key: 'archived', label: t('qaStatus.archived') },
          { key: 'rejected', label: t('qaStatus.rejected') },
        ]
      : [
          { key: 'candidate', label: t('qaStatus.candidate') },
          { key: 'stale', label: t('qaStatus.stale') },
        ];

  const run = (path: string, method: 'POST' | 'PATCH', body: unknown, ok: string) =>
    act.mutateAsync({ path, method, body }).then(
      () => toast.success(ok),
      (e) => toast.error(errMessage(e)),
    );

  const edit = (q: Qa | null, approve = false) => slot.show((close) => <QaDialog qa={q} approve={approve} onClose={close} />);

  const columns: Column<Qa>[] = [
    { key: 'q', label: t('col.question'), w: 2.4, render: (q) => <MainCell name={q.question} sub={q.answer} icon={q.source === 'admin' ? 'quiz' : q.source === 'learned' ? 'psychology' : 'download'} /> },
    { key: 'src', label: t('col.source'), w: 1, render: (q) => <MutedCell>{sourceLabel(t, q)}</MutedCell> },
    { key: 'hits', label: t('col.hits'), w: 0.6, render: (q) => <TextCell>{fmtNum(q.hitCount)}</TextCell> },
    { key: 'upd', label: t('col.updated'), w: 0.9, render: (q) => <MutedCell>{formatRelative(q.updatedAt)}</MutedCell> },
    { key: 'st', label: t('col.status'), w: 0.8, render: (q) => <StatusBadge tone={QA_TONE[q.status]}>{t(`qaStatus.${q.status}`)}</StatusBadge> },
  ];

  const actions = (q: Qa): RowAction[] => {
    if (q.status === 'candidate' || q.status === 'stale' || q.status === 'rejected') {
      return [
        { label: t('action.review'), onClick: () => edit(q, true) },
        ...(q.status !== 'rejected' ? [{ label: t('action.reject'), icon: 'block', danger: true, onClick: () => void run(`${B}/qa/${q.id}/reject`, 'POST', {}, t('toast.rejected')) }] : []),
      ];
    }
    return [
      { label: t('action.edit'), onClick: () => edit(q) },
      q.status === 'active'
        ? { label: t('action.archive'), icon: 'archive', onClick: () => void run(`${B}/qa/${q.id}`, 'PATCH', { status: 'archived' }, t('toast.archived')) }
        : { label: t('action.activate'), icon: 'unarchive', onClick: () => void run(`${B}/qa/${q.id}`, 'PATCH', { status: 'active' }, t('toast.activated')) },
    ];
  };

  return (
    <>
      {mode === 'review' && <Notice tone="o">{t('reviewHint')}</Notice>}
      <DataTable<Qa>
        title={mode === 'kb' ? t('tab.qa') : t('tab.review')}
        headAction={
          mode === 'kb' ? (
            <AdminButton kind="primary" icon="add" onClick={() => edit(null)}>
              {t('action.create')}
            </AdminButton>
          ) : undefined
        }
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(q) => q.id}
        onRow={(q) => edit(q, mode === 'review')}
        actions={actions}
        tabs={tabs}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('searchQa') }}
        filters={[
          {
            key: 'source',
            label: t('col.source'),
            value: ts.f.source,
            options: (['admin', 'learned', 'import'] as const).map((v) => ({ value: v, label: t(`source.${v}`) })),
            onChange: ts.setFilter('source'),
          },
        ]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('empty')}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: ts.setPage } : undefined}
      />
      {slot.el}
    </>
  );
}

function QaDialog({ qa, approve, onClose }: { qa: Qa | null; approve: boolean; onClose: () => void }) {
  const { t } = useTranslation('admin-chatbot');
  const toast = useToast();
  const act = useAdminAction();
  const [question, setQuestion] = useState(qa?.question ?? '');
  const [answer, setAnswer] = useState(qa?.answer ?? '');
  const [variants, setVariants] = useState((qa?.variants ?? []).join('\n'));
  const [tags, setTags] = useState((qa?.tags ?? []).join(', '));
  const [err, setErr] = useState<string | null>(null);

  const body = { question: question.trim(), answer: answer.trim(), variants: lines(variants) };
  const save = () => {
    setErr(null);
    const req = approve && qa
      ? act.mutateAsync({ path: `${B}/qa/${qa.id}/approve`, body })
      : qa
        ? act.mutateAsync({ path: `${B}/qa/${qa.id}`, method: 'PATCH', body: { ...body, tags: tags.split(',').map((x) => x.trim()).filter(Boolean) } })
        : act.mutateAsync({ path: `${B}/qa`, body: { ...body, tags: tags.split(',').map((x) => x.trim()).filter(Boolean) } });
    req.then(
      () => {
        toast.success(approve ? t('toast.approved') : t('toast.saved'));
        onClose();
      },
      (e) => setErr(errMessage(e)),
    );
  };

  return (
    <ModalShell
      icon={approve ? 'fact_check' : 'quiz'}
      title={approve ? t('dialog.reviewTitle') : qa ? t('dialog.editTitle') : t('dialog.createTitle')}
      body={qa ? sourceLabel(t, qa) : t('dialog.createBody')}
      cta={approve ? t('action.approve') : t('action.save')}
      pending={act.isPending}
      disabled={!question.trim() || !answer.trim()}
      error={err}
      onConfirm={save}
      onClose={onClose}
    >
      <TextArea label={t('field.question')} value={question} onChange={setQuestion} rows={approve ? 4 : 2} maxLength={1000} />
      <TextArea label={t('field.variants')} value={variants} onChange={setVariants} rows={3} />
      <TextArea label={t('field.answer')} value={answer} onChange={setAnswer} rows={5} maxLength={4000} />
      {!approve && <InputField label={t('field.tags')} value={tags} onChange={setTags} placeholder={t('field.tagsPlaceholder')} />}
    </ModalShell>
  );
}

/* ================================================================ tài liệu */

function DocsTab() {
  const { t } = useTranslation('admin-chatbot');
  const docs = useAdminData<DocRow[]>('chatbot', `${B}/documents`);
  const slot = useDialogSlot();
  const columns: Column<DocRow>[] = [
    { key: 'title', label: t('col.document'), w: 2.2, render: (d) => <MainCell name={d.title} sub={d.slug} icon="description" /> },
    { key: 'chunks', label: t('col.chunks'), w: 0.7, render: (d) => <TextCell>{fmtNum(d.chunks)}</TextCell> },
    { key: 'upd', label: t('col.updated'), w: 0.9, render: (d) => <MutedCell>{formatRelative(d.updatedAt)}</MutedCell> },
    { key: 'st', label: t('col.status'), w: 0.8, render: (d) => <StatusBadge tone={d.status === 'active' ? 'g' : 'x'}>{t(`docStatus.${d.status}`)}</StatusBadge> },
  ];
  const open = (id: string | null) => slot.show((close) => <DocDialog id={id} onClose={close} />);
  return (
    <>
      <Notice tone="o">{t('docsHint')}</Notice>
      <DataTable<DocRow>
        title={t('tab.docs')}
        headAction={
          <AdminButton kind="primary" icon="add" onClick={() => open(null)}>
            {t('action.createDoc')}
          </AdminButton>
        }
        columns={columns}
        rows={docs.data ?? []}
        rowKey={(d) => d.id}
        onRow={(d) => open(d.id)}
        actions={(d) => [{ label: t('action.edit'), onClick: () => open(d.id) }]}
        loading={docs.isPending}
        error={docs.isError ? docs.error : null}
        onRetry={() => void docs.refetch()}
        emptyText={t('empty')}
      />
      {slot.el}
    </>
  );
}

function DocDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation('admin-chatbot');
  const doc = useAdminData<DocDetail>('chatbot', `${B}/documents/${id}`, undefined, Boolean(id));
  if (id && doc.isPending) return <ModalShell icon="description" title={t('tab.docs')} cta={t('action.save')} disabled onConfirm={() => undefined} onClose={onClose}><LoadingBlock /></ModalShell>;
  return <DocForm doc={doc.data ?? null} onClose={onClose} />;
}

function DocForm({ doc, onClose }: { doc: DocDetail | null; onClose: () => void }) {
  const { t } = useTranslation('admin-chatbot');
  const toast = useToast();
  const act = useAdminAction();
  const [slug, setSlug] = useState(doc?.slug ?? '');
  const [title, setTitle] = useState(doc?.title ?? '');
  const [content, setContent] = useState(doc?.contentMd ?? '# \n\n## \n');
  const [active, setActive] = useState((doc?.status ?? 'active') === 'active');
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    setErr(null);
    const req = doc
      ? act.mutateAsync({ path: `${B}/documents/${doc.id}`, method: 'PATCH', body: { title: title.trim() || doc.title, contentMd: content, status: active ? 'active' : 'archived' } })
      : act.mutateAsync({ path: `${B}/documents`, body: { slug: slug.trim(), contentMd: content, ...(title.trim() ? { title: title.trim() } : {}) } });
    req.then(
      (r) => {
        const stale = (r as { staleQa?: number } | undefined)?.staleQa ?? 0;
        toast.success(stale ? t('toast.docSavedStale', { n: stale }) : t('toast.saved'));
        onClose();
      },
      (e) => setErr(errMessage(e)),
    );
  };
  return (
    <ModalShell icon="description" title={doc ? doc.title : t('action.createDoc')} body={t('docBody')} cta={t('action.save')} pending={act.isPending} disabled={!content.trim() || (!doc && !slug.trim())} error={err} onConfirm={save} onClose={onClose}>
      {!doc && <InputField label={t('field.slug')} value={slug} onChange={setSlug} placeholder="xu-ly-loi-tool" maxLength={80} />}
      <InputField label={t('field.title')} value={title} onChange={setTitle} maxLength={200} />
      <TextArea label={t('field.content')} value={content} onChange={setContent} rows={12} mono />
      {doc && <CheckField text={t('field.docActive')} checked={active} onChange={setActive} />}
      {doc && doc.chunks.length > 0 && (
        <details className="text-[13px] text-stone-600">
          <summary className="cursor-pointer font-semibold">{t('chunksPreview', { n: doc.chunks.length })}</summary>
          <ol className="mt-2 flex max-h-48 flex-col gap-1.5 overflow-y-auto pl-5">
            {doc.chunks.map((c) => (
              <li key={c.id}>
                <b>{c.heading}</b> — {c.content.slice(0, 120)}
                {c.content.length > 120 ? '…' : ''}
              </li>
            ))}
          </ol>
        </details>
      )}
    </ModalShell>
  );
}

/* ================================================================ hội thoại */

function ConversationsTab() {
  const { t } = useTranslation('admin-chatbot');
  const slot = useDialogSlot();
  const ts = useTableState({ feedback: '' }, '');
  const list = useAdminList<ConvRow>('chatbot', `${B}/conversations`, { status: ts.tab || undefined, feedback: ts.f.feedback || undefined, q: ts.q || undefined, page: ts.page, limit: LIMIT });
  const columns: Column<ConvRow>[] = [
    { key: 'user', label: t('col.user'), w: 1.3, render: (c) => <MainCell name={c.user.name || c.user.email} sub={c.user.email} avatar seed={c.user.id} /> },
    { key: 'first', label: t('col.firstMessage'), w: 2, render: (c) => <TextCell>{c.firstMessage ?? '—'}</TextCell> },
    { key: 'n', label: t('col.messages'), w: 0.6, render: (c) => <TextCell>{fmtNum(c.messageCount)}{c.negativeCount ? ` · 👎${c.negativeCount}` : ''}</TextCell> },
    { key: 'last', label: t('col.updated'), w: 0.9, render: (c) => <MutedCell>{formatRelative(c.lastMessageAt)}</MutedCell> },
    { key: 'st', label: t('col.status'), w: 0.9, render: (c) => <StatusBadge tone={CONV_TONE[c.status]}>{c.ticketCode ? `${t(`convStatus.${c.status}`)} · ${c.ticketCode}` : t(`convStatus.${c.status}`)}</StatusBadge> },
  ];
  const open = (c: ConvRow) => slot.show((close) => <ConversationDialog id={c.id} onClose={close} />);
  return (
    <>
      <DataTable<ConvRow>
        title={t('tab.conversations')}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        onRow={open}
        actions={(c) => [{ label: t('action.view'), onClick: () => open(c) }]}
        tabs={[
          { key: '', label: t('convStatus.all') },
          { key: 'handed_off', label: t('convStatus.handed_off') },
          { key: 'open', label: t('convStatus.open') },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('searchConv') }}
        filters={[{ key: 'feedback', label: t('col.feedback'), value: ts.f.feedback, options: [{ value: 'negative', label: t('negativeOnly') }], onChange: ts.setFilter('feedback') }]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('empty')}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: ts.setPage } : undefined}
      />
      {slot.el}
    </>
  );
}

function ConversationDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('admin-chatbot');
  const d = useAdminData<ConvDetail>('chatbot', `${B}/conversations/${id}`);
  const c = d.data;
  return (
    <ModalShell icon="forum" title={c ? `${c.user.name || c.user.email}` : t('tab.conversations')} body={c ? `${c.user.email} · ${t(`convStatus.${c.status}`)}${c.ticketCode ? ` · ${c.ticketCode}` : ''} · ${fmtNum(c.tokensIn + c.tokensOut)} tokens` : undefined} cta={t('action.close')} onConfirm={onClose} onClose={onClose}>
      {d.isPending ? (
        <LoadingBlock />
      ) : d.isError ? (
        <ErrorBlock error={d.error} onRetry={() => void d.refetch()} />
      ) : (
        <div className="flex max-h-[55vh] flex-col gap-2.5 overflow-y-auto rounded-2xl bg-stone-50 p-3">
          {c?.messages.map((m) => (
            <div key={m.id} className={`flex flex-col gap-0.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13.5px] whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#fff1e6] text-stone-800' : 'bg-white text-stone-800 shadow-sm'}`}>{m.content}</div>
              <span className="px-1 text-[11.5px] text-stone-400">
                {formatDateTime(m.createdAt)}
                {m.answerSource ? ` · ${t(`answerSource.${m.answerSource}`)}` : ''}
                {m.toolCalls?.length ? ` · ${m.toolCalls.filter((x) => !x.name.startsWith('_')).map((x) => x.name).join(', ')}` : ''}
                {m.feedback === 1 ? ' · 👍' : m.feedback === -1 ? ' · 👎' : ''}
                {m.redacted ? ` · ${t('redacted')}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

/* ================================================================ cài đặt */

function SettingsTab() {
  const d = useAdminData<{ settings: Settings; codexLoggedIn: boolean; fakeModel: boolean }>('chatbot', `${B}/settings`);
  if (d.isPending) return <LoadingBlock />;
  if (d.isError) return <ErrorBlock error={d.error} onRetry={() => void d.refetch()} />;
  return (
    <>
      <ChatbotAccountCard />
      <SettingsForm initial={d.data.settings} />
    </>
  );
}

function SettingsForm({ initial }: { initial: Settings }) {
  const { t } = useTranslation('admin-chatbot');
  const toast = useToast();
  const act = useAdminAction();
  const [s, setS] = useState<Settings>(initial);
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => setS((o) => ({ ...o, [k]: v }));
  const num = (k: 'directThreshold' | 'maxHistory' | 'maxInputChars' | 'dailyMessagesPerUser') => (v: string) => set(k)(Number(v.replace(',', '.')) || 0);

  const save = () => {
    const changed = Object.fromEntries(Object.entries(s).filter(([k, v]) => initial[k as keyof Settings] !== v));
    if (!Object.keys(changed).length) return toast.success(t('toast.noChange'));
    act.mutateAsync({ path: `${B}/settings`, method: 'PATCH', body: changed }).then(
      () => toast.success(t('toast.saved')),
      (e) => toast.error(errMessage(e)),
    );
  };
  const learn = () =>
    act.mutateAsync({ path: `${B}/learn`, body: {} }).then(
      (r) => {
        const x = r as { skipped?: string; conversations: number; candidates: number; variants: number };
        toast.success(x.skipped ? t('toast.learnSkipped') : t('toast.learned', x));
      },
      (e) => toast.error(errMessage(e)),
    );

  return (
    <div className={`${CARD_CLS} flex flex-col gap-4 p-5`}>
      <CheckField text={t('settings.enabled')} checked={s.enabled} onChange={set('enabled')} />
      <div className="grid gap-4 md:grid-cols-2">
        <InputField label={t('settings.zaloSupportUrl')} value={s.zaloSupportUrl} onChange={set('zaloSupportUrl')} placeholder="https://zalo.me/..." maxLength={300} />
        <InputField label={t('settings.model')} value={s.model} onChange={set('model')} placeholder={t('settings.modelDefault')} maxLength={80} />
        <InputField label={t('settings.directThreshold')} value={String(s.directThreshold)} onChange={num('directThreshold')} />
        <InputField label={t('settings.maxHistory')} value={String(s.maxHistory)} onChange={num('maxHistory')} />
        <InputField label={t('settings.maxInputChars')} value={String(s.maxInputChars)} onChange={num('maxInputChars')} />
        <InputField label={t('settings.dailyMessagesPerUser')} value={String(s.dailyMessagesPerUser)} onChange={num('dailyMessagesPerUser')} />
      </div>
      <TextArea label={t('settings.zaloHandoffText')} value={s.zaloHandoffText} onChange={set('zaloHandoffText')} rows={2} maxLength={500} />
      <TextArea label={t('settings.refusalText')} value={s.refusalText} onChange={set('refusalText')} rows={2} maxLength={500} />
      <TextArea label={t('settings.persona')} value={s.persona} onChange={set('persona')} rows={5} maxLength={4000} />
      <TextArea label={t('settings.extraInstructions')} value={s.extraInstructions} onChange={set('extraInstructions')} rows={4} maxLength={4000} />
      <p className="m-0 text-[12.5px] text-stone-500">{t('settings.rulesNote')}</p>
      <div className="flex flex-wrap gap-2.5">
        <AdminButton kind="primary" icon="save" onClick={save} disabled={act.isPending}>
          {t('action.save')}
        </AdminButton>
        <AdminButton icon="psychology" onClick={learn} disabled={act.isPending}>
          {t('action.learnNow')}
        </AdminButton>
      </div>
    </div>
  );
}
