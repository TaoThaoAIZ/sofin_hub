import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../../lib/datetime';
import { PreviewDialog, PreviewKv, PreviewSection, DateInput, useDialogSlot, useTableState } from '../components/Batch2Parts';
import { DataTable, MainCell, MonoCell, MutedCell, TextCell } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, MONO_FONT, errMessage } from '../components/ui';
import { useToast } from '../components/overlay';
import { apiDownload } from '../../../lib/api';
import { useAdminData } from '../queries.batch2';
import { ROLE_LABEL, auditLabel, type AuditFilters } from '../types.batch3';
import { useAuditLogs } from '../queries';
import { AUDIT_ACTION, type AuditItem } from '../types';

const LIMIT = 30;
export const AUDIT_GROUPS = [
  { value: 'community.', label: 'Cộng đồng' },
  { value: 'user.', label: 'Người dùng' },
  { value: 'case.', label: 'Vụ việc kiểm duyệt' },
  { value: 'content.', label: 'Nội dung' },
  { value: 'payment.', label: 'Thanh toán' },
  { value: 'discovery.', label: 'Khám phá' },
  { value: 'support.', label: 'Hỗ trợ' },
  { value: 'system.', label: 'Hệ thống' },
  { value: 'report.', label: 'Báo cáo' },
];
const TARGET: Record<string, string> = {
  community: 'Cộng đồng',
  user: 'Người dùng',
  case: 'Vụ việc',
  content: 'Nội dung',
  post: 'Bài viết',
  comment: 'Bình luận',
  payment: 'Thanh toán',
  refund: 'Hoàn tiền',
  payout: 'Chi trả',
  report: 'Báo cáo',
  ticket: 'Ticket',
  admin: 'Quản trị viên',
  role: 'Vai trò',
  flag: 'Tính năng thử nghiệm',
  setting: 'Cài đặt',
  integration: 'Tích hợp',
  template: 'Mẫu email',
  category: 'Danh mục',
};
const actionLabel = (a: string) => auditLabel(a, AUDIT_ACTION);

/** Ngày yyyy-mm-dd -> đầu / cuối ngày (ISO) để lọc theo khoảng. */
const dayStart = (d: string) => (d ? `${d}T00:00:00.000Z` : undefined);
const dayEnd = (d: string) => (d ? `${d}T23:59:59.999Z` : undefined);

function AuditDetail({ a, onClose }: { a: AuditItem; onClose: () => void }) {
  const navigate = useNavigate();
  const meta = a.metadata && Object.keys(a.metadata).length > 0 ? a.metadata : null;
  return (
    <PreviewDialog title={actionLabel(a.action)} sub={`${a.actor?.name ?? 'Hệ thống'} · ${formatDateTime(a.createdAt)}`} onClose={onClose}>
      <PreviewKv
        items={[
          ['Quản trị viên', a.actor ? `${a.actor.name}${a.actor.email ? ` (${a.actor.email})` : ''}${a.actor.role ? ` · ${ROLE_LABEL[a.actor.role.key] ?? a.actor.role.name}` : ''}` : 'Hệ thống'],
          ['Hành động', <span key="a" style={{ fontFamily: MONO_FONT }}>{a.action}</span>],
          ['Đối tượng', `${a.targetLabel || a.targetId} (${TARGET[a.targetType] ?? a.targetType})`],
          ['Địa chỉ IP', a.ip ? <span key="ip" style={{ fontFamily: MONO_FONT }}>{a.ip}</span> : null],
          ['Mã đối tượng', <span key="t" style={{ fontFamily: MONO_FONT }}>{a.targetId}</span>],
          ['Lý do', a.reason],
          ['Ghi chú', a.note],
          ['Bằng chứng', a.evidence],
          ['Vụ việc', a.caseId ? (
            <button key="c" type="button" className="border-0 bg-transparent p-0 font-semibold text-brand hover:underline" onClick={() => navigate(`/admin/moderation/cases/${a.caseId}`)}>
              Mở vụ việc
            </button>
          ) : null],
        ]}
      />
      {meta && (
        <PreviewSection title="Dữ liệu kèm theo">
          <pre className="m-0 max-h-60 overflow-auto rounded-xl bg-[#faf7f4] p-3 text-xs break-words whitespace-pre-wrap" style={{ fontFamily: MONO_FONT }}>
            {JSON.stringify(meta, null, 2)}
          </pre>
        </PreviewSection>
      )}
    </PreviewDialog>
  );
}

/** Nhật ký hoạt động của quản trị viên (GET /admin/audit-logs): tìm kiếm, lọc theo nhóm hành động + khoảng ngày, xem chi tiết. */
export function AuditView() {
  const t = useTableState({ action: '', actor: '', group: '' });
  const toast = useToast();
  const filters = useAdminData<AuditFilters>('audit', '/audit-logs/filters');
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const slot = useDialogSlot();
  const params = { q: t.q || undefined, actor: t.f.actor || undefined, action: t.f.action || t.f.group || undefined, from: dayStart(from), to: dayEnd(to) };
  const list = useAuditLogs({ ...params, page: t.page, limit: LIMIT });
  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
      await apiDownload(`/admin/audit-logs/export${qs ? `?${qs}` : ''}`, `nhat-ky-hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Đã xuất nhật ký (tối đa 5.000 dòng)');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setExporting(false);
    }
  };
  const clear = () => {
    t.clear();
    setFrom('');
    setTo('');
  };
  return (
    <>
      <PageHeader
        title="Nhật ký hoạt động"
        subtitle="Mọi thao tác quản trị đều được ghi lại: ai làm, làm gì, trên đối tượng nào và vì sao."
        actions={
          <AdminButton icon="download" disabled={exporting} onClick={() => void exportCsv()}>
            {exporting ? 'Đang xuất…' : 'Xuất CSV'}
          </AdminButton>
        }
      />
      <DataTable<AuditItem>
        headTools={
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            Từ
            <DateInput label="Từ ngày" value={from} onChange={(v) => { setFrom(v); t.setPage(1); }} />
            đến
            <DateInput label="Đến ngày" value={to} min={from} onChange={(v) => { setTo(v); t.setPage(1); }} />
          </div>
        }
        columns={[
          { key: 'time', label: 'Thời gian', w: 1.2, render: (a) => <MutedCell>{formatDateTime(a.createdAt)}</MutedCell> },
          { key: 'actor', label: 'Quản trị viên', w: 1.5, render: (a) => <MainCell name={a.actor?.name ?? 'Hệ thống'} sub={a.actor?.role ? (ROLE_LABEL[a.actor.role.key] ?? a.actor.role.name) : a.actor?.email} avatar seed={a.actor?.id} /> },
          { key: 'action', label: 'Hành động', w: 1.6, render: (a) => <TextCell>{actionLabel(a.action)}</TextCell> },
          { key: 'target', label: 'Đối tượng', w: 1.5, render: (a) => <TextCell>{`${a.targetLabel || a.targetId} (${TARGET[a.targetType] ?? a.targetType})`}</TextCell> },
          { key: 'case', label: 'Vụ việc', w: 0.9, render: (a) => (a.caseId ? <MonoCell>{a.caseId.slice(0, 8)}</MonoCell> : <MutedCell>—</MutedCell>) },
          { key: 'ip', label: 'IP', w: 1, render: (a) => (a.ip ? <MonoCell>{a.ip}</MonoCell> : <MutedCell>—</MutedCell>) },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(a) => a.id}
        onRow={(a) => slot.show((close) => <AuditDetail a={a} onClose={close} />)}
        actions={(a) => [{ label: 'Chi tiết', onClick: () => slot.show((close) => <AuditDetail a={a} onClose={close} />) }]}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm quản trị viên, hành động, đối tượng...' }}
        filters={[
          { key: 'actor', label: 'Quản trị viên', value: t.f.actor, options: (filters.data?.actors ?? []).map((x) => ({ value: x.id, label: x.name })), onChange: t.setFilter('actor') },
          { key: 'group', label: 'Nhóm hành động', value: t.f.group, options: AUDIT_GROUPS, onChange: t.setFilter('group') },
          { key: 'action', label: 'Hành động', value: t.f.action, options: (filters.data?.actions ?? []).map((x) => ({ value: x, label: actionLabel(x) })), onChange: t.setFilter('action') },
        ]}
        onClearFilters={clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Chưa có thao tác nào được ghi lại."
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: t.setPage } : undefined}
      />
      {slot.el}
    </>
  );
}
