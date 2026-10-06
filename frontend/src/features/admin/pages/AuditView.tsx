import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
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
const NS = 'admin-pages1';
export const auditGroups = () => [
  { value: 'community.', label: i18n.t('audit.group.community', { ns: NS }) },
  { value: 'user.', label: i18n.t('audit.group.user', { ns: NS }) },
  { value: 'case.', label: i18n.t('audit.group.case', { ns: NS }) },
  { value: 'content.', label: i18n.t('audit.group.content', { ns: NS }) },
  { value: 'payment.', label: i18n.t('audit.group.payment', { ns: NS }) },
  { value: 'discovery.', label: i18n.t('audit.group.discovery', { ns: NS }) },
  { value: 'support.', label: i18n.t('audit.group.support', { ns: NS }) },
  { value: 'system.', label: i18n.t('audit.group.system', { ns: NS }) },
  { value: 'report.', label: i18n.t('audit.group.report', { ns: NS }) },
];
const targetLabel = (type: string) => i18n.t(`audit.target.${type}`, { ns: NS, defaultValue: type });
const actionLabel = (a: string) => auditLabel(a, AUDIT_ACTION);

/** Ngày yyyy-mm-dd -> đầu / cuối ngày (ISO) để lọc theo khoảng. */
const dayStart = (d: string) => (d ? `${d}T00:00:00.000Z` : undefined);
const dayEnd = (d: string) => (d ? `${d}T23:59:59.999Z` : undefined);

function AuditDetail({ a, onClose }: { a: AuditItem; onClose: () => void }) {
  const { t } = useTranslation(NS);
  const navigate = useNavigate();
  const meta = a.metadata && Object.keys(a.metadata).length > 0 ? a.metadata : null;
  return (
    <PreviewDialog title={actionLabel(a.action)} sub={`${a.actor?.name ?? t('audit.system')} · ${formatDateTime(a.createdAt)}`} onClose={onClose}>
      <PreviewKv
        items={[
          [t('audit.admin'), a.actor ? `${a.actor.name}${a.actor.email ? ` (${a.actor.email})` : ''}${a.actor.role ? ` · ${ROLE_LABEL[a.actor.role.key] ?? a.actor.role.name}` : ''}` : t('audit.system')],
          [t('audit.action'), <span key="a" style={{ fontFamily: MONO_FONT }}>{a.action}</span>],
          [t('audit.targetCol'), `${a.targetLabel || a.targetId} (${targetLabel(a.targetType)})`],
          [t('audit.ip'), a.ip ? <span key="ip" style={{ fontFamily: MONO_FONT }}>{a.ip}</span> : null],
          [t('audit.targetId'), <span key="t" style={{ fontFamily: MONO_FONT }}>{a.targetId}</span>],
          [t('audit.reason'), a.reason],
          [t('audit.note'), a.note],
          [t('audit.evidence'), a.evidence],
          [t('audit.case'), a.caseId ? (
            <button key="c" type="button" className="border-0 bg-transparent p-0 font-semibold text-brand hover:underline" onClick={() => navigate(`/admin/moderation/cases/${a.caseId}`)}>
              {t('audit.openCase')}
            </button>
          ) : null],
        ]}
      />
      {meta && (
        <PreviewSection title={t('audit.metadata')}>
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
  const { t: tr } = useTranslation(NS);
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
      toast.success(tr('audit.exported'));
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
        title={tr('audit.title')}
        subtitle={tr('audit.subtitle')}
        actions={
          <AdminButton icon="download" disabled={exporting} onClick={() => void exportCsv()}>
            {exporting ? tr('audit.exporting') : tr('audit.exportCsv')}
          </AdminButton>
        }
      />
      <DataTable<AuditItem>
        headTools={
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            {tr('audit.from')}
            <DateInput label={tr('audit.fromDate')} value={from} onChange={(v) => { setFrom(v); t.setPage(1); }} />
            {tr('audit.to')}
            <DateInput label={tr('audit.toDate')} value={to} min={from} onChange={(v) => { setTo(v); t.setPage(1); }} />
          </div>
        }
        columns={[
          { key: 'time', label: tr('audit.colTime'), w: 1.2, render: (a) => <MutedCell>{formatDateTime(a.createdAt)}</MutedCell> },
          { key: 'actor', label: tr('audit.admin'), w: 1.5, render: (a) => <MainCell name={a.actor?.name ?? tr('audit.system')} sub={a.actor?.role ? (ROLE_LABEL[a.actor.role.key] ?? a.actor.role.name) : a.actor?.email} avatar seed={a.actor?.id} /> },
          { key: 'action', label: tr('audit.action'), w: 1.6, render: (a) => <TextCell>{actionLabel(a.action)}</TextCell> },
          { key: 'target', label: tr('audit.targetCol'), w: 1.5, render: (a) => <TextCell>{`${a.targetLabel || a.targetId} (${targetLabel(a.targetType)})`}</TextCell> },
          { key: 'case', label: tr('audit.case'), w: 0.9, render: (a) => (a.caseId ? <MonoCell>{a.caseId.slice(0, 8)}</MonoCell> : <MutedCell>—</MutedCell>) },
          { key: 'ip', label: tr('audit.colIp'), w: 1, render: (a) => (a.ip ? <MonoCell>{a.ip}</MonoCell> : <MutedCell>—</MutedCell>) },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(a) => a.id}
        onRow={(a) => slot.show((close) => <AuditDetail a={a} onClose={close} />)}
        actions={(a) => [{ label: tr('audit.details'), onClick: () => slot.show((close) => <AuditDetail a={a} onClose={close} />) }]}
        search={{ value: t.q, onChange: t.onQ, placeholder: tr('audit.searchPlaceholder') }}
        filters={[
          { key: 'actor', label: tr('audit.admin'), value: t.f.actor, options: (filters.data?.actors ?? []).map((x) => ({ value: x.id, label: x.name })), onChange: t.setFilter('actor') },
          { key: 'group', label: tr('audit.actionGroup'), value: t.f.group, options: auditGroups(), onChange: t.setFilter('group') },
          { key: 'action', label: tr('audit.action'), value: t.f.action, options: (filters.data?.actions ?? []).map((x) => ({ value: x, label: actionLabel(x) })), onChange: t.setFilter('action') },
        ]}
        onClearFilters={clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={tr('audit.empty')}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: t.setPage } : undefined}
      />
      {slot.el}
    </>
  );
}
