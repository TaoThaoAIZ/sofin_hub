import i18n from '../../../i18n';
import { formatRelative } from '../../../lib/datetime';
import { CASE_RISK, CASE_STATUS, REASON_LABEL, TARGET_LABEL, type AdminCase } from '../types';
import { MainCell, MonoCell, MutedCell, NumCell, TextCell, type Column } from './DataTable';
import { StatusBadge } from './ui';

/** Cột bảng vụ việc kiểm duyệt (dùng ở Hàng đợi báo cáo, tab Kiểm duyệt của cộng đồng, tab Báo cáo của người dùng). */
export function caseColumns(opts: { community?: boolean } = {}): Column<AdminCase>[] {
  const t = (k: string) => i18n.t(k, { ns: 'admin-components' });
  return [
    { key: 'code', label: t('cc.code'), render: (c) => <MonoCell>{c.caseCode}</MonoCell> },
    {
      key: 'content',
      label: t('cc.content'),
      w: 2.2,
      render: (c) => <MainCell name={c.content.title || t('cc.noContent')} sub={[TARGET_LABEL[c.targetType], opts.community === false ? '' : c.content.community?.name].filter(Boolean).join(' · ')} icon={c.targetType === 'post' ? 'article' : c.targetType === 'comment' ? 'chat' : 'person'} />,
    },
    { key: 'user', label: t('cc.reportedUser'), render: (c) => <TextCell>{c.reportedUser?.name ?? '—'}</TextCell> },
    { key: 'reason', label: t('cc.reason'), render: (c) => <TextCell>{REASON_LABEL[c.reason] ?? c.reason}</TextCell> },
    { key: 'n', label: t('cc.reports'), w: 0.7, render: (c) => <NumCell>{c.reportCount}</NumCell> },
    { key: 'risk', label: t('cc.risk'), w: 1.25, render: (c) => <StatusBadge tone={CASE_RISK[c.risk].tone}>{CASE_RISK[c.risk].label}</StatusBadge> },
    { key: 'assignee', label: t('cc.assignee'), render: (c) => (c.assignee ? <TextCell>{c.assignee.name}</TextCell> : <MutedCell>{t('cc.unassigned')}</MutedCell>) },
    { key: 'status', label: t('cc.status'), w: 1.2, render: (c) => <StatusBadge tone={CASE_STATUS[c.status].tone}>{CASE_STATUS[c.status].label}</StatusBadge> },
    { key: 'created', label: t('cc.created'), render: (c) => <MutedCell>{formatRelative(c.createdAt)}</MutedCell> },
  ];
}
