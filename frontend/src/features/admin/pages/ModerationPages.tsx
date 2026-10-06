import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

const riskOptions = () => (Object.keys(CASE_RISK) as CaseRisk[]).map((k) => ({ value: k, label: CASE_RISK[k].label }));
const reasonOptions = () => Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }));

/** Hàng đợi báo cáo: KPI + bảng vụ việc (tab trạng thái, lọc rủi ro/lý do/người phụ trách, tìm kiếm). */
export function ModerationQueue() {
  const { t } = useTranslation('admin-pages2');
  const RISK_OPTIONS = riskOptions();
  const REASON_OPTIONS = reasonOptions();
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
      <PageHeader title={t('moderation.queue.title')} subtitle={t('moderation.queue.subtitle')} />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'flag', label: t('moderation.queue.kpi.open'), value: fmtNum(s.open), bad: true },
            { icon: 'priority_high', label: t('moderation.queue.kpi.critical'), value: fmtNum(s.critical), bad: true },
            { icon: 'manage_search', label: t('moderation.queue.kpi.underReview'), value: fmtNum(s.underReview) },
            { icon: 'task_alt', label: t('moderation.queue.kpi.resolvedToday'), value: fmtNum(s.resolvedToday) },
          ]}
        />
      )}
      <DataTable
        columns={caseColumns()}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: 'all', label: t('moderation.queue.tab.all') },
          { key: 'open', label: t('moderation.queue.tab.open'), count: s?.open },
          { key: 'under_review', label: t('moderation.queue.tab.underReview'), count: s?.underReview },
          { key: 'closed', label: t('moderation.queue.tab.closed') },
        ]}
        tab={tab}
        onTab={(k) => { setTab(k as QueueTab); setPage(1); }}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('moderation.queue.searchPlaceholder') }}
        filters={[
          { key: 'risk', label: t('moderation.queue.filter.risk'), value: f.risk, options: RISK_OPTIONS, onChange: set('risk') },
          { key: 'reason', label: t('moderation.queue.filter.reason'), value: f.reason, options: REASON_OPTIONS, onChange: set('reason') },
          { key: 'assignee', label: t('moderation.queue.filter.assignee'), value: f.assignee, options: [{ value: 'me', label: t('moderation.queue.filter.me') }, { value: 'unassigned', label: t('moderation.queue.filter.unassigned') }, ...(assignees.data ?? []).map((a) => ({ value: a.id, label: a.name }))], onChange: set('assignee') },
          { key: 'sort', label: t('moderation.queue.filter.sort'), value: f.sort, options: [{ value: 'risk', label: t('moderation.queue.filter.byRisk') }], onChange: set('sort') },
        ]}
        onClearFilters={() => { setF({ risk: '', reason: '', assignee: '', sort: '' }); setPage(1); }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={tab === 'open' ? t('moderation.queue.emptyOpen') : undefined}
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

const logs = (t: TFunction): Record<'warnings' | 'removals' | 'suspensions' | 'bans', LogCfg> => {
  const subtitle = t('moderation.log.subtitle');
  return {
    warnings: { title: t('moderation.log.warnings.title'), subtitle, types: [{ key: 'warning', label: t('moderation.log.warnings.title') }], targetLabel: t('moderation.log.user'), empty: t('moderation.log.warnings.empty') },
    removals: { title: t('moderation.log.removals.title'), subtitle, types: [{ key: 'removal', label: t('moderation.log.removals.type') }], targetLabel: t('moderation.log.content'), empty: t('moderation.log.removals.empty') },
    suspensions: {
      title: t('moderation.log.suspensions.title'),
      subtitle,
      types: [
        { key: 'suspension', label: t('moderation.log.suspensions.title') },
        { key: 'restriction', label: t('moderation.log.suspensions.restriction') },
      ],
      targetLabel: t('moderation.log.user'),
      empty: t('moderation.log.suspensions.empty'),
    },
    bans: { title: t('moderation.log.bans.title'), subtitle, types: [{ key: 'ban', label: t('moderation.log.bans.type') }], targetLabel: t('moderation.log.user'), empty: t('moderation.log.bans.empty') },
  };
};

export function ModerationLog({ kind }: { kind: 'warnings' | 'removals' | 'suspensions' | 'bans' }) {
  const { t } = useTranslation('admin-pages2');
  const cfg = logs(t)[kind];
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
          { key: 'case', label: t('moderation.log.col.caseCode'), render: (d) => <MonoCell>{d.case?.caseCode ?? '—'}</MonoCell> },
          { key: 'target', label: cfg.targetLabel, w: 2, render: (d) => <MainCell name={d.target.name} sub={d.target.type === 'user' ? t('moderation.log.user') : d.target.type === 'content' ? t('moderation.log.content') : d.target.type} icon={kind === 'removals' ? 'article' : undefined} avatar={kind !== 'removals'} /> },
          { key: 'decision', label: t('moderation.log.col.decision'), render: (d) => <TextCell>{DECISION_LABEL[d.decision] ?? d.decision}</TextCell> },
          { key: 'admin', label: t('moderation.log.col.admin'), render: (d) => <TextCell>{d.admin.name}</TextCell> },
          { key: 'reason', label: t('moderation.log.col.reason'), render: (d) => <TextCell>{d.reason ?? '—'}</TextCell> },
          { key: 'evidence', label: t('moderation.log.col.evidence'), w: 1.5, render: (d) => <TextCell>{d.evidence ?? '—'}</TextCell> },
          { key: 'date', label: t('moderation.log.col.date'), render: (d) => <MutedCell>{formatRelative(d.createdAt)}</MutedCell> },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(d) => d.id}
        tabs={cfg.types.length > 1 ? cfg.types.map((ty) => ({ key: ty.key, label: ty.label })) : undefined}
        tab={type}
        onTab={(k) => { setType(k as DecisionType); setPage(1); }}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('moderation.log.searchPlaceholder') }}
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
