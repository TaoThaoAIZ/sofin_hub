import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { formatDateTime, formatRelative } from '../../../lib/datetime';
import { ActionDialog, HistoryList, PreviewDialog, PreviewSection, useDialogSlot, useTableState } from '../components/Batch2Parts';
import { KpiGrid, type Kpi } from '../components/Cards';
import { DataTable, MainCell, MutedCell, TextCell, type Column, type RowAction } from '../components/DataTable';
import { OptionChips, InputField, TextAreaField, useToast } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminAvatar, AdminButton, ErrorBlock, LoadingBlock, StatusBadge, errMessage, fmtNum } from '../components/ui';
import { useAdminAction, useAdminData, useAdminList } from '../queries.batch2';
import {
  TICKET_CATEGORY,
  TICKET_PRIORITY,
  TICKET_STATUS,
  type SupportAssignee,
  type SupportSummary,
  type Ticket,
  type TicketCategory,
  type TicketDetail,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from '../types.batch3';

const LIMIT = 15;

const tabs = (t: TFunction) => [
  { key: '', label: t('support.tab.all') },
  { key: 'new', label: t('support.tab.new') },
  { key: 'open', label: t('support.tab.open') },
  { key: 'awaiting_reply', label: t('support.tab.awaitingReply') },
  { key: 'resolved', label: t('support.tab.resolved') },
];
const priorityOpts = () => (Object.keys(TICKET_PRIORITY) as TicketPriority[]).map((k) => ({ value: k, label: TICKET_PRIORITY[k].label }));
const categoryOpts = () => (Object.keys(TICKET_CATEGORY) as TicketCategory[]).map((k) => ({ value: k, label: TICKET_CATEGORY[k].label }));

const titles = (t: TFunction): Record<string, string> => ({ '': t('support.title.all'), user: t('support.title.user'), creator: t('support.title.creator'), payment: t('support.title.payment') });

const statusBadge = (s: TicketStatus) => <StatusBadge tone={TICKET_STATUS[s]?.tone ?? 'x'}>{TICKET_STATUS[s]?.label ?? s}</StatusBadge>;
const priorityBadge = (p: TicketPriority) => <StatusBadge tone={TICKET_PRIORITY[p]?.tone ?? 'x'}>{TICKET_PRIORITY[p]?.label ?? p}</StatusBadge>;

/** Hộp thoại thao tác lên ticket: gọi POST /admin/support/tickets/:id/<action>. */
function useTicketActions() {
  const { t } = useTranslation('admin-pages2');
  const act = useAdminAction();
  const toast = useToast();
  const slot = useDialogSlot();
  const base = (tk: Ticket) => `/support/tickets/${tk.id}`;

  const assignMe = (tk: Ticket) =>
    act.mutateAsync({ path: `${base(tk)}/assign`, body: { assigneeId: 'me' } }).then(
      () => toast.success(t('support.toast.assignedMe', { code: tk.code })),
      (e) => toast.error(errMessage(e)),
    );

  const reopen = (tk: Ticket) =>
    act.mutateAsync({ path: `${base(tk)}/reopen`, body: {} }).then(
      () => toast.success(t('support.toast.reopened', { code: tk.code })),
      (e) => toast.error(errMessage(e)),
    );

  const assign = (tk: Ticket) => slot.show((close) => <AssignDialog ticket={tk} onClose={close} />);
  const resolve = (tk: Ticket) =>
    slot.show((close) => (
      <ActionDialog icon="task_alt" title={t('support.resolve.title', { code: tk.code })} body={t('support.resolve.body')} cta={t('support.resolve.cta')} noteLabel={t('support.noteOptional')} successMessage={t('support.resolve.success', { code: tk.code })} run={(v) => act.mutateAsync({ path: `${base(tk)}/resolve`, body: { note: v.note || undefined } })} onClose={close} />
    ));
  const closeTicket = (tk: Ticket) =>
    slot.show((close) => (
      <ActionDialog icon="inbox" danger title={t('support.close.title', { code: tk.code })} body={t('support.close.body')} cta={t('support.close.cta')} noteLabel={t('support.noteOptional')} successMessage={t('support.close.success', { code: tk.code })} run={(v) => act.mutateAsync({ path: `${base(tk)}/close`, body: { note: v.note || undefined } })} onClose={close} />
    ));
  const escalate = (tk: Ticket) =>
    slot.show((close) => (
      <ActionDialog
        icon="priority_high"
        danger
        title={t('support.escalate.title', { code: tk.code })}
        body={t('support.escalate.body')}
        cta={t('support.escalate.cta')}
        noteLabel={t('support.escalate.reason')}
        requireNote
        successMessage={t('support.escalate.success', { code: tk.code })}
        run={(v) => act.mutateAsync({ path: `${base(tk)}/escalate`, body: { reason: v.note } })}
        onClose={close}
      />
    ));
  const edit = (tk: Ticket) => slot.show((close) => <EditTicketDialog ticket={tk} onClose={close} />);
  return { slot, assignMe, assign, resolve, closeTicket, escalate, reopen, edit };
}

function AssignDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const act = useAdminAction();
  const people = useAdminData<SupportAssignee[]>('support', '/support/assignees');
  const [who, setWho] = useState(ticket.assignee?.id ?? '');
  const opts = [{ value: '__none', label: t('support.assign.none') }, ...(people.data ?? []).map((p) => ({ value: p.id, label: p.name }))];
  return (
    <ActionDialog
      icon="assignment_ind"
      title={t('support.assign.title', { code: ticket.code })}
      cta={t('support.save')}
      disabledExtra={!who || people.isPending}
      successMessage={t('support.assign.success')}
      run={() => act.mutateAsync({ path: `/support/tickets/${ticket.id}/assign`, body: { assigneeId: who === '__none' ? null : who } })}
      onClose={onClose}
    >
      {people.isError ? <div className="text-[13px] text-[#b91c1c]">{errMessage(people.error)}</div> : <OptionChips label={t('support.assign.label')} options={opts} value={who} onChange={(v) => setWho(v as string)} />}
    </ActionDialog>
  );
}

function EditTicketDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const PRIORITY_OPTS = priorityOpts();
  const CATEGORY_OPTS = categoryOpts();
  const act = useAdminAction();
  const [subject, setSubject] = useState(ticket.subject);
  const [priority, setPriority] = useState<string>(ticket.priority);
  const [category, setCategory] = useState<string>(ticket.category);
  return (
    <ActionDialog
      icon="edit"
      title={t('support.edit.title', { code: ticket.code })}
      cta={t('support.save')}
      disabledExtra={!subject.trim()}
      successMessage={t('support.edit.success')}
      run={() => act.mutateAsync({ method: 'PATCH', path: `/support/tickets/${ticket.id}`, body: { subject: subject.trim(), priority, category } })}
      onClose={onClose}
    >
      <InputField label={t('support.field.subject')} value={subject} onChange={setSubject} maxLength={200} />
      <OptionChips label={t('support.field.priority')} options={PRIORITY_OPTS} value={priority} onChange={(v) => setPriority(v as string)} />
      <OptionChips label={t('support.field.category')} options={CATEGORY_OPTS} value={category} onChange={(v) => setCategory(v as string)} />
    </ActionDialog>
  );
}

function CreateTicketDialog({ defaultCategory, onClose }: { defaultCategory: TicketCategory | ''; onClose: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const PRIORITY_OPTS = priorityOpts();
  const CATEGORY_OPTS = categoryOpts();
  const act = useAdminAction();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<string>(defaultCategory || 'user');
  const [priority, setPriority] = useState<string>('medium');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  return (
    <ActionDialog
      icon="add_comment"
      title={t('support.create.title')}
      body={t('support.create.body')}
      cta={t('support.create.cta')}
      disabledExtra={!subject.trim() || !message.trim()}
      successMessage={t('support.create.success')}
      run={() =>
        act.mutateAsync({
          path: '/support/tickets',
          body: { subject: subject.trim(), message: message.trim(), category, priority, requesterEmail: email.trim() || undefined, requesterName: name.trim() || undefined },
        })
      }
      onClose={onClose}
    >
      <InputField label={t('support.field.subject')} value={subject} onChange={setSubject} maxLength={200} />
      <TextAreaField label={t('support.field.message')} value={message} onChange={setMessage} maxLength={5000} />
      <OptionChips label={t('support.field.category')} options={CATEGORY_OPTS} value={category} onChange={(v) => setCategory(v as string)} />
      <OptionChips label={t('support.field.priority')} options={PRIORITY_OPTS} value={priority} onChange={(v) => setPriority(v as string)} />
      <InputField label={t('support.create.emailLabel')} value={email} onChange={setEmail} placeholder={t('support.create.emailPlaceholder')} />
      <InputField label={t('support.create.nameLabel')} value={name} onChange={setName} />
    </ActionDialog>
  );
}

/* ------------------------------ Chi tiết ticket ------------------------------ */

const kindMap = (t: TFunction): Record<TicketMessage['kind'], { label: string; cls: string }> => ({
  customer: { label: t('support.kind.customer'), cls: 'bg-[#f5f1ed]' },
  staff: { label: t('support.kind.staff'), cls: 'bg-[#fff1e6]' },
  internal_note: { label: t('support.kind.internalNote'), cls: 'bg-[#fef9c3]' },
  system: { label: t('support.kind.system'), cls: 'bg-[#eff6ff]' },
});

function ReplyBox({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation('admin-pages2');
  const act = useAdminAction();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [note, setNote] = useState(false);
  const [status, setStatus] = useState<string>('awaiting_reply');
  const [pending, setPending] = useState(false);
  const closed = ticket.status === 'closed';

  const send = async () => {
    setPending(true);
    try {
      await act.mutateAsync({ path: `/support/tickets/${ticket.id}/${note ? 'note' : 'reply'}`, body: note ? { body: body.trim() } : { body: body.trim(), status } });
      toast.success(note ? t('support.reply.noteAdded') : t('support.reply.sent'));
      setBody('');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setPending(false);
    }
  };

  if (closed) return <div className="rounded-xl bg-[#faf7f4] px-3.5 py-3 text-[13px] text-stone-500">{t('support.reply.closed')}</div>;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <OptionChips
          options={[
            { value: 'reply', label: t('support.reply.replyCustomer') },
            { value: 'note', label: t('support.kind.internalNote') },
          ]}
          value={note ? 'note' : 'reply'}
          onChange={(v) => setNote(v === 'note')}
        />
      </div>
      <TextAreaField value={body} onChange={setBody} maxLength={5000} placeholder={note ? t('support.reply.notePlaceholder') : t('support.reply.replyPlaceholder')} />
      <div className="flex flex-wrap items-center gap-2.5">
        {!note && (
          <OptionChips
            options={[
              { value: 'awaiting_reply', label: t('support.tab.awaitingReply') },
              { value: 'open', label: t('support.reply.keepOpen') },
              { value: 'resolved', label: t('support.tab.resolved') },
            ]}
            value={status}
            onChange={(v) => setStatus(v as string)}
          />
        )}
        <div className="flex-1" />
        <AdminButton kind="primary" icon={note ? 'sticky_note_2' : 'send'} disabled={!body.trim() || pending} onClick={() => void send()}>
          {pending ? t('support.reply.sending') : note ? t('support.reply.saveNote') : t('support.reply.send')}
        </AdminButton>
      </div>
    </div>
  );
}

function TicketDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t: tr } = useTranslation('admin-pages2');
  const KIND = kindMap(tr);
  const navigate = useNavigate();
  const q = useAdminData<TicketDetail>('support', `/support/tickets/${id}`);
  const ta = useTicketActions();
  const t = q.data;
  const locked = t?.status === 'resolved' || t?.status === 'closed';

  return (
    <>
      <PreviewDialog
        wide
        title={t ? `${t.code} · ${t.subject}` : tr('support.title.all')}
        sub={t ? (
          <span className="flex flex-wrap items-center gap-2">
            {statusBadge(t.status)}
            {priorityBadge(t.priority)}
            {t.escalated && <StatusBadge tone="r">{tr('support.escalated')}</StatusBadge>}
            <span>
              {TICKET_CATEGORY[t.category]?.label ?? t.category} · {t.requester.name} ({t.requester.email}) · {tr('support.createdAgo', { time: formatRelative(t.createdAt) })}
            </span>
          </span>
        ) : undefined}
        onClose={onClose}
      >
        {q.isPending && <LoadingBlock />}
        {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
        {t && (
          <>
            <div className="flex flex-wrap gap-2">
              <AdminButton icon="assignment_ind" onClick={() => ta.assign(t)}>
                {t.assignee ? tr('support.detail.assignee', { name: t.assignee.name }) : tr('support.detail.assign')}
              </AdminButton>
              {!locked && (
                <AdminButton icon="task_alt" onClick={() => ta.resolve(t)}>
                  {tr('support.resolve.cta')}
                </AdminButton>
              )}
              {!locked && !t.escalated && (
                <AdminButton kind="danger" icon="priority_high" onClick={() => ta.escalate(t)}>
                  {tr('support.escalate.cta')}
                </AdminButton>
              )}
              {t.status !== 'closed' && (
                <AdminButton icon="inbox" onClick={() => ta.closeTicket(t)}>
                  {tr('support.detail.close')}
                </AdminButton>
              )}
              {locked && (
                <AdminButton icon="restart_alt" onClick={() => void ta.reopen(t)}>
                  {tr('support.action.reopen')}
                </AdminButton>
              )}
              <AdminButton icon="edit" onClick={() => ta.edit(t)}>
                {tr('support.action.edit')}
              </AdminButton>
              {t.related.userId && (
                <AdminButton icon="person" onClick={() => navigate(`/admin/users/${t.related.userId}`)}>
                  {tr('support.action.viewUser')}
                </AdminButton>
              )}
            </div>
            <PreviewSection title={tr('support.detail.conversation', { count: t.messages.length })}>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {t.messages.map((m) => (
                  <li key={m.id} className={`rounded-xl px-3.5 py-2.5 ${KIND[m.kind]?.cls ?? 'bg-[#f5f1ed]'}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <AdminAvatar name={m.author.name} size={22} />
                      <b className="text-stone-800">{m.author.name}</b>
                      <span>· {KIND[m.kind]?.label ?? m.kind}</span>
                      <span>· {formatDateTime(m.createdAt)}</span>
                    </div>
                    <div className="text-[13.5px] leading-relaxed break-words whitespace-pre-wrap">{m.body}</div>
                  </li>
                ))}
              </ul>
            </PreviewSection>
            <PreviewSection title={tr('support.detail.reply')}>
              <ReplyBox ticket={t} />
            </PreviewSection>
            <PreviewSection title={tr('support.detail.history')}>
              <HistoryList items={t.history} />
            </PreviewSection>
          </>
        )}
      </PreviewDialog>
      {ta.slot.el}
    </>
  );
}

/* ------------------------------ Danh sách ------------------------------ */

/** Hỗ trợ: Ticket / Vấn đề người dùng / creator / thanh toán — cùng GET /admin/support/tickets, khác `category`. */
export function SupportView({ category = '' }: { category?: TicketCategory | '' }) {
  const navigate = useNavigate();
  const { t } = useTranslation('admin-pages2');
  const ts = useTableState({ priority: '', assignee: '' }, '');
  const PRIORITY_OPTS = priorityOpts();
  const ta = useTicketActions();
  const slot = useDialogSlot();
  const summary = useAdminData<SupportSummary>('support', '/support/summary');
  const assignees = useAdminData<SupportAssignee[]>('support', '/support/assignees');
  const list = useAdminList<Ticket>('support', '/support/tickets', {
    q: ts.q || undefined,
    category: category || undefined,
    status: ts.tab || undefined,
    priority: ts.f.priority || undefined,
    assignee: ts.f.assignee || undefined,
    page: ts.page,
    limit: LIMIT,
  });
  const s = summary.data;
  const cat = category ? summary.data?.byCategory[category] : undefined;

  const kpis: Kpi[] = s
    ? [
        { icon: 'inbox', label: category ? t('support.kpi.openCat', { cat: TICKET_CATEGORY[category].label }) : t('support.kpi.open'), value: fmtNum(cat ?? s.open) },
        { icon: 'mark_email_unread', label: t('support.kpi.newToday'), value: fmtNum(s.newToday) },
        { icon: 'timer', label: t('support.kpi.firstResponse'), value: s.avgFirstResponseMin == null ? '—' : t('support.kpi.minutes', { n: fmtNum(Math.round(s.avgFirstResponseMin)) }), delta: s.avgFirstResponseMinChangePct != null ? `${s.avgFirstResponseMinChangePct >= 0 ? '+' : ''}${s.avgFirstResponseMinChangePct.toFixed(0)}%` : null, bad: true },
        { icon: 'task_alt', label: t('support.kpi.resolved7d'), value: fmtNum(s.resolved7d), delta: s.resolved7dChangePct != null ? `${s.resolved7dChangePct >= 0 ? '+' : ''}${s.resolved7dChangePct.toFixed(0)}%` : null },
      ]
    : [];

  const openDetail = (r: Ticket) => slot.show((close) => <TicketDetailDialog id={r.id} onClose={close} />);

  const columns: Column<Ticket>[] = [
    {
      key: 'ticket',
      label: t('support.col.ticket'),
      w: 2.2,
      render: (r) => <MainCell name={r.subject} sub={`#${r.code}${r.escalated ? t('support.escalatedSuffix') : ''}`} icon={TICKET_CATEGORY[r.category]?.icon ?? 'support_agent'} />,
    },
    { key: 'req', label: t('support.col.requester'), render: (r) => <TextCell>{r.requester.name}</TextCell> },
    ...(category ? [] : [{ key: 'cat', label: t('support.field.category'), w: 0.8, render: (r: Ticket) => <TextCell>{TICKET_CATEGORY[r.category]?.label ?? r.category}</TextCell> }]),
    { key: 'pri', label: t('support.field.priority'), w: 0.9, render: (r) => priorityBadge(r.priority) },
    { key: 'asg', label: t('support.col.assignee'), render: (r) => (r.assignee ? <TextCell>{r.assignee.name}</TextCell> : <MutedCell>{t('support.unassigned')}</MutedCell>) },
    { key: 'upd', label: t('support.col.updated'), render: (r) => <MutedCell>{formatRelative(r.updatedAt)}</MutedCell> },
    { key: 'st', label: t('support.col.status'), render: (r) => statusBadge(r.status) },
  ];

  const actions = (r: Ticket): RowAction[] => {
    const locked = r.status === 'resolved' || r.status === 'closed';
    const list: RowAction[] = [{ label: locked ? t('support.action.view') : t('support.action.reply'), onClick: () => openDetail(r) }];
    if (!locked && r.assignee == null) list.push({ label: t('support.action.takeOver'), icon: 'assignment_ind', onClick: () => void ta.assignMe(r) });
    if (!locked) list.push({ label: t('support.action.assignTo'), icon: 'group', onClick: () => ta.assign(r) });
    if (!locked) list.push({ label: t('support.resolve.cta'), icon: 'task_alt', onClick: () => ta.resolve(r) });
    if (!locked && !r.escalated) list.push({ label: t('support.escalate.cta'), icon: 'priority_high', danger: true, onClick: () => ta.escalate(r) });
    if (locked) list.push({ label: t('support.action.reopen'), icon: 'restart_alt', onClick: () => void ta.reopen(r) });
    if (r.requester.id) list.push({ label: t('support.action.viewUser'), icon: 'person', onClick: () => navigate(`/admin/users/${r.requester.id}`) });
    return list;
  };

  const assigneeOpts = [{ value: 'me', label: t('support.filter.mine') }, { value: 'unassigned', label: t('support.unassigned') }, ...(assignees.data ?? []).map((p) => ({ value: p.id, label: p.name }))];

  return (
    <>
      <PageHeader
        title={titles(t)[category] ?? t('support.title.all')}
        subtitle={t('support.subtitle')}
        actions={
          <AdminButton kind="primary" icon="add" onClick={() => slot.show((close) => <CreateTicketDialog defaultCategory={category} onClose={close} />)}>
            {t('support.create.cta')}
          </AdminButton>
        }
      />
      {summary.isError ? <ErrorBlock error={summary.error} onRetry={() => void summary.refetch()} /> : s && <KpiGrid items={kpis} min={170} />}
      <DataTable<Ticket>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(r) => r.id}
        onRow={openDetail}
        actions={actions}
        tabs={tabs(t)}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('support.searchPlaceholder') }}
        filters={[
          { key: 'priority', label: t('support.field.priority'), value: ts.f.priority, options: PRIORITY_OPTS, onChange: ts.setFilter('priority') },
          { key: 'assignee', label: t('support.col.assignee'), value: ts.f.assignee, options: assigneeOpts, onChange: ts.setFilter('assignee') },
        ]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('support.empty')}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: ts.setPage } : undefined}
      />
      {slot.el}
      {ta.slot.el}
    </>
  );
}
