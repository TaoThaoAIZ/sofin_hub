import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelative } from '../../../lib/datetime';
import { KpiGrid } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, TextCell } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { caseColumns } from '../components/caseColumns';
import { useCaseActions } from '../components/caseActions';
import { fmtNum } from '../components/ui';
import { useAssignees, useCases, useDecisions, useModerationSummary } from '../queries';
import { CASE_RISK, DECISION_LABEL, REASON_LABEL, type CaseReason, type CaseRisk, type DecisionType } from '../types';

const LIMIT = 20;

type QueueTab = 'all' | 'open' | 'under_review' | 'closed';
const TAB_STATUS: Record<QueueTab, string> = { all: 'all', open: 'open', under_review: 'under_review', closed: 'resolved,dismissed' };

const RISK_OPTIONS = (Object.keys(CASE_RISK) as CaseRisk[]).map((k) => ({ value: k, label: CASE_RISK[k].label }));
const REASON_OPTIONS = Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }));

/** Hàng đợi báo cáo: KPI + bảng vụ việc (tab trạng thái, lọc rủi ro/lý do/người phụ trách, tìm kiếm). */
export function ModerationQueue() {
  const navigate = useNavigate();
  const summary = useModerationSummary();
  const assignees = useAssignees();
  const { actionsFor, modalEl } = useCaseActions();
  const [tab, setTab] = useState<QueueTab>('open');
  const [q, setQ] = useState('');
  const [f, setF] = useState({ risk: '', reason: '', assignee: '', sort: '' });
  const [page, setPage] = useState(1);
  const list = useCases({ status: TAB_STATUS[tab], q: q || undefined, risk: (f.risk || undefined) as CaseRisk | undefined, reason: (f.reason || undefined) as CaseReason | undefined, assignee: f.assignee || undefined, sort: (f.sort || undefined) as 'risk' | undefined, page, limit: LIMIT });
  const s = summary.data;
  const set = (key: keyof typeof f) => (v: string) => {
    setF((o) => ({ ...o, [key]: v }));
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Hàng đợi báo cáo" subtitle="Phân loại nội dung và người dùng bị báo cáo theo mức rủi ro." />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'flag', label: 'Báo cáo mở', value: fmtNum(s.open), bad: true },
            { icon: 'priority_high', label: 'Nghiêm trọng', value: fmtNum(s.critical), bad: true },
            { icon: 'manage_search', label: 'Đang xem xét', value: fmtNum(s.underReview) },
            { icon: 'task_alt', label: 'Xử lý hôm nay', value: fmtNum(s.resolvedToday) },
          ]}
        />
      )}
      <DataTable
        columns={caseColumns()}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: 'all', label: 'Tất cả' },
          { key: 'open', label: 'Mở', count: s?.open },
          { key: 'under_review', label: 'Đang xem xét', count: s?.underReview },
          { key: 'closed', label: 'Đã xử lý' },
        ]}
        tab={tab}
        onTab={(k) => { setTab(k as QueueTab); setPage(1); }}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm mã vụ việc, nội dung, người dùng...' }}
        filters={[
          { key: 'risk', label: 'Rủi ro', value: f.risk, options: RISK_OPTIONS, onChange: set('risk') },
          { key: 'reason', label: 'Lý do', value: f.reason, options: REASON_OPTIONS, onChange: set('reason') },
          { key: 'assignee', label: 'Người phụ trách', value: f.assignee, options: [{ value: 'me', label: 'Tôi' }, { value: 'unassigned', label: 'Chưa phân công' }, ...(assignees.data ?? []).map((a) => ({ value: a.id, label: a.name }))], onChange: set('assignee') },
          { key: 'sort', label: 'Sắp xếp', value: f.sort, options: [{ value: 'risk', label: 'Theo rủi ro' }], onChange: set('sort') },
        ]}
        onClearFilters={() => { setF({ risk: '', reason: '', assignee: '', sort: '' }); setPage(1); }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={tab === 'open' ? 'Không có báo cáo nào đang chờ xử lý.' : undefined}
        onRow={(c) => navigate(`/admin/moderation/cases/${c.id}`)}
        actions={(c) => actionsFor(c)}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {modalEl}
    </>
  );
}

/* ----------------- Nhật ký quyết định: Cảnh cáo / Gỡ nội dung / Tạm ngưng / Cấm ----------------- */

interface LogCfg {
  title: string;
  subtitle: string;
  types: { key: DecisionType; label: string }[];
  targetLabel: string;
  empty: string;
}

const SUBTITLE = 'Mọi quyết định được lưu theo: Vụ việc → Quyết định → Quản trị viên → Lý do → Bằng chứng.';

const LOGS: Record<'warnings' | 'removals' | 'suspensions' | 'bans', LogCfg> = {
  warnings: { title: 'Cảnh cáo', subtitle: SUBTITLE, types: [{ key: 'warning', label: 'Cảnh cáo' }], targetLabel: 'Người dùng', empty: 'Chưa có cảnh cáo nào.' },
  removals: { title: 'Nội dung đã gỡ', subtitle: SUBTITLE, types: [{ key: 'removal', label: 'Đã gỡ nội dung' }], targetLabel: 'Nội dung', empty: 'Chưa có nội dung nào bị gỡ.' },
  suspensions: {
    title: 'Tạm ngưng',
    subtitle: SUBTITLE,
    types: [
      { key: 'suspension', label: 'Tạm ngưng' },
      { key: 'restriction', label: 'Hạn chế' },
    ],
    targetLabel: 'Người dùng',
    empty: 'Chưa có quyết định nào.',
  },
  bans: { title: 'Lệnh cấm', subtitle: SUBTITLE, types: [{ key: 'ban', label: 'Cấm' }], targetLabel: 'Người dùng', empty: 'Chưa có lệnh cấm nào.' },
};

export function ModerationLog({ kind }: { kind: keyof typeof LOGS }) {
  const cfg = LOGS[kind];
  const navigate = useNavigate();
  const [type, setType] = useState<DecisionType>(cfg.types[0]!.key);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useDecisions({ type, q: q || undefined, page, limit: LIMIT });
  return (
    <>
      <PageHeader title={cfg.title} subtitle={cfg.subtitle} />
      <DataTable
        columns={[
          { key: 'case', label: 'Mã vụ việc', render: (d) => <MonoCell>{d.case?.caseCode ?? '—'}</MonoCell> },
          { key: 'target', label: cfg.targetLabel, w: 2, render: (d) => <MainCell name={d.target.name} sub={d.target.type === 'user' ? 'Người dùng' : d.target.type === 'content' ? 'Nội dung' : d.target.type} icon={kind === 'removals' ? 'article' : undefined} avatar={kind !== 'removals'} /> },
          { key: 'decision', label: 'Quyết định', render: (d) => <TextCell>{DECISION_LABEL[d.decision] ?? d.decision}</TextCell> },
          { key: 'admin', label: 'Quản trị viên', render: (d) => <TextCell>{d.admin.name}</TextCell> },
          { key: 'reason', label: 'Lý do', render: (d) => <TextCell>{d.reason ?? '—'}</TextCell> },
          { key: 'evidence', label: 'Bằng chứng', w: 1.5, render: (d) => <TextCell>{d.evidence ?? '—'}</TextCell> },
          { key: 'date', label: 'Ngày', render: (d) => <MutedCell>{formatRelative(d.createdAt)}</MutedCell> },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(d) => d.id}
        tabs={cfg.types.length > 1 ? cfg.types.map((t) => ({ key: t.key, label: t.label })) : undefined}
        tab={type}
        onTab={(k) => { setType(k as DecisionType); setPage(1); }}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm vụ việc...' }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={cfg.empty}
        onRow={(d) => d.case && navigate(`/admin/moderation/cases/${d.case.id}`)}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
    </>
  );
}
