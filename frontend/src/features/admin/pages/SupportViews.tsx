import { useState } from 'react';
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

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'new', label: 'Mới' },
  { key: 'open', label: 'Đang mở' },
  { key: 'awaiting_reply', label: 'Chờ phản hồi' },
  { key: 'resolved', label: 'Đã xử lý' },
];
const PRIORITY_OPTS = (Object.keys(TICKET_PRIORITY) as TicketPriority[]).map((k) => ({ value: k, label: TICKET_PRIORITY[k].label }));
const CATEGORY_OPTS = (Object.keys(TICKET_CATEGORY) as TicketCategory[]).map((k) => ({ value: k, label: TICKET_CATEGORY[k].label }));

const TITLES: Record<string, string> = { '': 'Ticket hỗ trợ', user: 'Vấn đề người dùng', creator: 'Vấn đề creator', payment: 'Vấn đề thanh toán' };

const statusBadge = (s: TicketStatus) => <StatusBadge tone={TICKET_STATUS[s]?.tone ?? 'x'}>{TICKET_STATUS[s]?.label ?? s}</StatusBadge>;
const priorityBadge = (p: TicketPriority) => <StatusBadge tone={TICKET_PRIORITY[p]?.tone ?? 'x'}>{TICKET_PRIORITY[p]?.label ?? p}</StatusBadge>;

/** Hộp thoại thao tác lên ticket: gọi POST /admin/support/tickets/:id/<action>. */
function useTicketActions() {
  const act = useAdminAction();
  const toast = useToast();
  const slot = useDialogSlot();
  const base = (t: Ticket) => `/support/tickets/${t.id}`;

  const assignMe = (t: Ticket) =>
    act.mutateAsync({ path: `${base(t)}/assign`, body: { assigneeId: 'me' } }).then(
      () => toast.success(`Bạn đã nhận xử lý ${t.code}`),
      (e) => toast.error(errMessage(e)),
    );

  const reopen = (t: Ticket) =>
    act.mutateAsync({ path: `${base(t)}/reopen`, body: {} }).then(
      () => toast.success(`Đã mở lại ${t.code}`),
      (e) => toast.error(errMessage(e)),
    );

  const assign = (t: Ticket) => slot.show((close) => <AssignDialog ticket={t} onClose={close} />);
  const resolve = (t: Ticket) =>
    slot.show((close) => (
      <ActionDialog icon="task_alt" title={`Đánh dấu đã xử lý · ${t.code}`} body="Ticket chuyển sang Đã xử lý. Người gửi vẫn có thể trả lời để mở lại." cta="Đã xử lý" noteLabel="Ghi chú (tùy chọn)" successMessage={`Đã xử lý ${t.code}`} run={(v) => act.mutateAsync({ path: `${base(t)}/resolve`, body: { note: v.note || undefined } })} onClose={close} />
    ));
  const closeTicket = (t: Ticket) =>
    slot.show((close) => (
      <ActionDialog icon="inbox" danger title={`Đóng ticket · ${t.code}`} body="Ticket đóng sẽ không nhận thêm phản hồi (có thể mở lại)." cta="Đóng ticket" noteLabel="Ghi chú (tùy chọn)" successMessage={`Đã đóng ${t.code}`} run={(v) => act.mutateAsync({ path: `${base(t)}/close`, body: { note: v.note || undefined } })} onClose={close} />
    ));
  const escalate = (t: Ticket) =>
    slot.show((close) => (
      <ActionDialog
        icon="priority_high"
        danger
        title={`Chuyển cấp trên · ${t.code}`}
        body="Ticket được đánh dấu chuyển cấp và nâng mức ưu tiên."
        cta="Chuyển cấp trên"
        noteLabel="Lý do chuyển cấp"
        requireNote
        successMessage={`Đã chuyển cấp ${t.code}`}
        run={(v) => act.mutateAsync({ path: `${base(t)}/escalate`, body: { reason: v.note } })}
        onClose={close}
      />
    ));
  const edit = (t: Ticket) => slot.show((close) => <EditTicketDialog ticket={t} onClose={close} />);
  return { slot, assignMe, assign, resolve, closeTicket, escalate, reopen, edit };
}

function AssignDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const act = useAdminAction();
  const people = useAdminData<SupportAssignee[]>('support', '/support/assignees');
  const [who, setWho] = useState(ticket.assignee?.id ?? '');
  const opts = [{ value: '__none', label: 'Bỏ gán' }, ...(people.data ?? []).map((p) => ({ value: p.id, label: p.name }))];
  return (
    <ActionDialog
      icon="assignment_ind"
      title={`Giao ticket · ${ticket.code}`}
      cta="Lưu"
      disabledExtra={!who || people.isPending}
      successMessage="Đã cập nhật người phụ trách"
      run={() => act.mutateAsync({ path: `/support/tickets/${ticket.id}/assign`, body: { assigneeId: who === '__none' ? null : who } })}
      onClose={onClose}
    >
      {people.isError ? <div className="text-[13px] text-[#b91c1c]">{errMessage(people.error)}</div> : <OptionChips label="Người phụ trách" options={opts} value={who} onChange={(v) => setWho(v as string)} />}
    </ActionDialog>
  );
}

function EditTicketDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const act = useAdminAction();
  const [subject, setSubject] = useState(ticket.subject);
  const [priority, setPriority] = useState<string>(ticket.priority);
  const [category, setCategory] = useState<string>(ticket.category);
  return (
    <ActionDialog
      icon="edit"
      title={`Sửa ticket · ${ticket.code}`}
      cta="Lưu"
      disabledExtra={!subject.trim()}
      successMessage="Đã cập nhật ticket"
      run={() => act.mutateAsync({ method: 'PATCH', path: `/support/tickets/${ticket.id}`, body: { subject: subject.trim(), priority, category } })}
      onClose={onClose}
    >
      <InputField label="Chủ đề" value={subject} onChange={setSubject} maxLength={200} />
      <OptionChips label="Ưu tiên" options={PRIORITY_OPTS} value={priority} onChange={(v) => setPriority(v as string)} />
      <OptionChips label="Nhóm" options={CATEGORY_OPTS} value={category} onChange={(v) => setCategory(v as string)} />
    </ActionDialog>
  );
}

function CreateTicketDialog({ defaultCategory, onClose }: { defaultCategory: TicketCategory | ''; onClose: () => void }) {
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
      title="Tạo ticket hộ khách"
      body="Dùng khi khách liên hệ qua kênh khác. Nếu email trùng với tài khoản, ticket được liên kết với tài khoản đó."
      cta="Tạo ticket"
      disabledExtra={!subject.trim() || !message.trim()}
      successMessage="Đã tạo ticket"
      run={() =>
        act.mutateAsync({
          path: '/support/tickets',
          body: { subject: subject.trim(), message: message.trim(), category, priority, requesterEmail: email.trim() || undefined, requesterName: name.trim() || undefined },
        })
      }
      onClose={onClose}
    >
      <InputField label="Chủ đề" value={subject} onChange={setSubject} maxLength={200} />
      <TextAreaField label="Nội dung" value={message} onChange={setMessage} maxLength={5000} />
      <OptionChips label="Nhóm" options={CATEGORY_OPTS} value={category} onChange={(v) => setCategory(v as string)} />
      <OptionChips label="Ưu tiên" options={PRIORITY_OPTS} value={priority} onChange={(v) => setPriority(v as string)} />
      <InputField label="Email khách (tùy chọn)" value={email} onChange={setEmail} placeholder="khach@email.com" />
      <InputField label="Tên khách (tùy chọn)" value={name} onChange={setName} />
    </ActionDialog>
  );
}

/* ------------------------------ Chi tiết ticket ------------------------------ */

const KIND: Record<TicketMessage['kind'], { label: string; cls: string }> = {
  customer: { label: 'Khách', cls: 'bg-[#f5f1ed]' },
  staff: { label: 'Nhân viên', cls: 'bg-[#fff1e6]' },
  internal_note: { label: 'Ghi chú nội bộ', cls: 'bg-[#fef9c3]' },
  system: { label: 'Hệ thống', cls: 'bg-[#eff6ff]' },
};

function ReplyBox({ ticket }: { ticket: Ticket }) {
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
      toast.success(note ? 'Đã thêm ghi chú nội bộ' : 'Đã gửi phản hồi tới người gửi');
      setBody('');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setPending(false);
    }
  };

  if (closed) return <div className="rounded-xl bg-[#faf7f4] px-3.5 py-3 text-[13px] text-stone-500">Ticket đã đóng. Mở lại để tiếp tục phản hồi.</div>;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <OptionChips
          options={[
            { value: 'reply', label: 'Trả lời khách' },
            { value: 'note', label: 'Ghi chú nội bộ' },
          ]}
          value={note ? 'note' : 'reply'}
          onChange={(v) => setNote(v === 'note')}
        />
      </div>
      <TextAreaField value={body} onChange={setBody} maxLength={5000} placeholder={note ? 'Chỉ nhân viên xem được...' : 'Nội dung gửi tới người gửi (qua email và thông báo trong app)...'} />
      <div className="flex flex-wrap items-center gap-2.5">
        {!note && (
          <OptionChips
            options={[
              { value: 'awaiting_reply', label: 'Chờ phản hồi' },
              { value: 'open', label: 'Giữ đang mở' },
              { value: 'resolved', label: 'Đã xử lý' },
            ]}
            value={status}
            onChange={(v) => setStatus(v as string)}
          />
        )}
        <div className="flex-1" />
        <AdminButton kind="primary" icon={note ? 'sticky_note_2' : 'send'} disabled={!body.trim() || pending} onClick={() => void send()}>
          {pending ? 'Đang gửi…' : note ? 'Lưu ghi chú' : 'Gửi phản hồi'}
        </AdminButton>
      </div>
    </div>
  );
}

function TicketDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const q = useAdminData<TicketDetail>('support', `/support/tickets/${id}`);
  const ta = useTicketActions();
  const t = q.data;
  const locked = t?.status === 'resolved' || t?.status === 'closed';

  return (
    <>
      <PreviewDialog
        wide
        title={t ? `${t.code} · ${t.subject}` : 'Ticket hỗ trợ'}
        sub={t ? (
          <span className="flex flex-wrap items-center gap-2">
            {statusBadge(t.status)}
            {priorityBadge(t.priority)}
            {t.escalated && <StatusBadge tone="r">Đã chuyển cấp</StatusBadge>}
            <span>
              {TICKET_CATEGORY[t.category]?.label ?? t.category} · {t.requester.name} ({t.requester.email}) · tạo {formatRelative(t.createdAt)}
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
                {t.assignee ? `Phụ trách: ${t.assignee.name}` : 'Giao người phụ trách'}
              </AdminButton>
              {!locked && (
                <AdminButton icon="task_alt" onClick={() => ta.resolve(t)}>
                  Đã xử lý
                </AdminButton>
              )}
              {!locked && !t.escalated && (
                <AdminButton kind="danger" icon="priority_high" onClick={() => ta.escalate(t)}>
                  Chuyển cấp trên
                </AdminButton>
              )}
              {t.status !== 'closed' && (
                <AdminButton icon="inbox" onClick={() => ta.closeTicket(t)}>
                  Đóng
                </AdminButton>
              )}
              {locked && (
                <AdminButton icon="restart_alt" onClick={() => void ta.reopen(t)}>
                  Mở lại
                </AdminButton>
              )}
              <AdminButton icon="edit" onClick={() => ta.edit(t)}>
                Sửa
              </AdminButton>
              {t.related.userId && (
                <AdminButton icon="person" onClick={() => navigate(`/admin/users/${t.related.userId}`)}>
                  Xem người dùng
                </AdminButton>
              )}
            </div>
            <PreviewSection title={`Hội thoại (${t.messages.length})`}>
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
            <PreviewSection title="Trả lời">
              <ReplyBox ticket={t} />
            </PreviewSection>
            <PreviewSection title="Lịch sử thao tác">
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
  const t = useTableState({ priority: '', assignee: '' }, '');
  const ta = useTicketActions();
  const slot = useDialogSlot();
  const summary = useAdminData<SupportSummary>('support', '/support/summary');
  const assignees = useAdminData<SupportAssignee[]>('support', '/support/assignees');
  const list = useAdminList<Ticket>('support', '/support/tickets', {
    q: t.q || undefined,
    category: category || undefined,
    status: t.tab || undefined,
    priority: t.f.priority || undefined,
    assignee: t.f.assignee || undefined,
    page: t.page,
    limit: LIMIT,
  });
  const s = summary.data;
  const cat = category ? summary.data?.byCategory[category] : undefined;

  const kpis: Kpi[] = s
    ? [
        { icon: 'inbox', label: category ? `Đang mở (${TICKET_CATEGORY[category].label})` : 'Đang mở', value: fmtNum(cat ?? s.open) },
        { icon: 'mark_email_unread', label: 'Mới hôm nay', value: fmtNum(s.newToday) },
        { icon: 'timer', label: 'Phản hồi đầu TB', value: s.avgFirstResponseMin == null ? '—' : `${fmtNum(Math.round(s.avgFirstResponseMin))} phút`, delta: s.avgFirstResponseMinChangePct != null ? `${s.avgFirstResponseMinChangePct >= 0 ? '+' : ''}${s.avgFirstResponseMinChangePct.toFixed(0)}%` : null, bad: true },
        { icon: 'task_alt', label: 'Đã xử lý (7 ngày)', value: fmtNum(s.resolved7d), delta: s.resolved7dChangePct != null ? `${s.resolved7dChangePct >= 0 ? '+' : ''}${s.resolved7dChangePct.toFixed(0)}%` : null },
      ]
    : [];

  const openDetail = (r: Ticket) => slot.show((close) => <TicketDetailDialog id={r.id} onClose={close} />);

  const columns: Column<Ticket>[] = [
    {
      key: 'ticket',
      label: 'Ticket',
      w: 2.2,
      render: (r) => <MainCell name={r.subject} sub={`#${r.code}${r.escalated ? ' · đã chuyển cấp' : ''}`} icon={TICKET_CATEGORY[r.category]?.icon ?? 'support_agent'} />,
    },
    { key: 'req', label: 'Người gửi', render: (r) => <TextCell>{r.requester.name}</TextCell> },
    ...(category ? [] : [{ key: 'cat', label: 'Nhóm', w: 0.8, render: (r: Ticket) => <TextCell>{TICKET_CATEGORY[r.category]?.label ?? r.category}</TextCell> }]),
    { key: 'pri', label: 'Ưu tiên', w: 0.9, render: (r) => priorityBadge(r.priority) },
    { key: 'asg', label: 'Phụ trách', render: (r) => (r.assignee ? <TextCell>{r.assignee.name}</TextCell> : <MutedCell>Chưa giao</MutedCell>) },
    { key: 'upd', label: 'Cập nhật', render: (r) => <MutedCell>{formatRelative(r.updatedAt)}</MutedCell> },
    { key: 'st', label: 'Trạng thái', render: (r) => statusBadge(r.status) },
  ];

  const actions = (r: Ticket): RowAction[] => {
    const locked = r.status === 'resolved' || r.status === 'closed';
    const list: RowAction[] = [{ label: locked ? 'Xem' : 'Trả lời', onClick: () => openDetail(r) }];
    if (!locked && r.assignee == null) list.push({ label: 'Nhận xử lý', icon: 'assignment_ind', onClick: () => void ta.assignMe(r) });
    if (!locked) list.push({ label: 'Giao cho…', icon: 'group', onClick: () => ta.assign(r) });
    if (!locked) list.push({ label: 'Đã xử lý', icon: 'task_alt', onClick: () => ta.resolve(r) });
    if (!locked && !r.escalated) list.push({ label: 'Chuyển cấp trên', icon: 'priority_high', danger: true, onClick: () => ta.escalate(r) });
    if (locked) list.push({ label: 'Mở lại', icon: 'restart_alt', onClick: () => void ta.reopen(r) });
    if (r.requester.id) list.push({ label: 'Xem người dùng', icon: 'person', onClick: () => navigate(`/admin/users/${r.requester.id}`) });
    return list;
  };

  const assigneeOpts = [{ value: 'me', label: 'Của tôi' }, { value: 'unassigned', label: 'Chưa giao' }, ...(assignees.data ?? []).map((p) => ({ value: p.id, label: p.name }))];

  return (
    <>
      <PageHeader
        title={TITLES[category] ?? 'Ticket hỗ trợ'}
        subtitle="Yêu cầu hỗ trợ từ thành viên và creator."
        actions={
          <AdminButton kind="primary" icon="add" onClick={() => slot.show((close) => <CreateTicketDialog defaultCategory={category} onClose={close} />)}>
            Tạo ticket
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
        tabs={TABS}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm ticket...' }}
        filters={[
          { key: 'priority', label: 'Ưu tiên', value: t.f.priority, options: PRIORITY_OPTS, onChange: t.setFilter('priority') },
          { key: 'assignee', label: 'Phụ trách', value: t.f.assignee, options: assigneeOpts, onChange: t.setFilter('assignee') },
        ]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Không có ticket nào."
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: t.setPage } : undefined}
      />
      {slot.el}
      {ta.slot.el}
    </>
  );
}
