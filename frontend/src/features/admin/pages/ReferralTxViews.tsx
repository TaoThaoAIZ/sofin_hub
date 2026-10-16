import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCents, formatDate, formatDateTime } from '../../../lib/datetime';
import { useTableState } from '../components/Batch2Parts';
import { KpiGrid } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, NumCell, TextCell, type Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge, fmtNum, type Tone } from '../components/ui';
import { useAdminData, useAdminList } from '../queries.batch2';

const LIMIT = 20;

interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}
interface CommissionRow {
  id: string;
  createdAt: string;
  referrer: Person | null;
  referred: Person | null;
  kind: 'member' | 'creator' | 'community';
  community: { id: string; name: string | null } | null;
  sourceRef: string;
  baseCents: number;
  rateBps: number;
  amountCents: number;
  status: 'pending' | 'paid' | 'void';
  payoutOn: string | null;
}
interface ReferralRow {
  id: string;
  referrer: Person | null;
  referred: Person | null;
  code: string;
  signedUpAt: string;
  expiresAt: string;
  windowActive: boolean;
  commissionCount: number;
  commissionCents: number;
}
interface Summary {
  referrals: number;
  commissions: number;
  pendingCents: number;
  paidCents: number;
  voidCents: number;
}

const personCell = (p: Person | null) => (p ? <MainCell name={p.name} sub={p.email} avatarSrc={p.avatarUrl} seed={p.id} /> : <MutedCell>—</MutedCell>);
const STATUS_TONE: Record<CommissionRow['status'], Tone> = { pending: 'o', paid: 'g', void: 'x' };
const pct = (bps: number) => `${(bps / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;

type View = 'commissions' | 'referrals';

/** Admin > Thanh toán > Giao dịch giới thiệu: hoa hồng phát sinh + danh sách ai giới thiệu ai. */
export function ReferralTxView() {
  const { t } = useTranslation('admin-payments');
  const [view, setView] = useState<View>('commissions');
  const ts = useTableState({ kind: '', status: '' }, '');
  const summary = useAdminData<Summary>('payments', '/payments/referrals/summary');
  const list = useAdminList<CommissionRow | ReferralRow>('payments-referrals', '/payments/referrals', {
    view,
    q: ts.q || undefined,
    kind: view === 'commissions' ? ts.f.kind || undefined : undefined,
    status: view === 'commissions' ? ts.f.status || undefined : undefined,
    page: ts.page,
    limit: LIMIT,
  });
  const s = summary.data;
  const m = list.data?.meta;
  const page = m ? { page: m.page, totalPages: m.totalPages, total: m.total, limit: LIMIT, onPage: ts.setPage } : undefined;

  const commissionCols: Column<CommissionRow>[] = [
    { key: 'date', label: t('referrals.colDate'), w: 1.1, render: (x) => <MutedCell>{formatDateTime(x.createdAt)}</MutedCell> },
    { key: 'referrer', label: t('referrals.colReferrer'), w: 1.6, render: (x) => personCell(x.referrer) },
    { key: 'referred', label: t('referrals.colReferred'), w: 1.6, render: (x) => personCell(x.referred) },
    { key: 'kind', label: t('referrals.colKind'), w: 1, render: (x) => <TextCell>{x.kind === 'creator' ? t('referrals.kindCreator') : x.kind === 'community' ? t('referrals.kindCommunity') : t('referrals.kindMember')}</TextCell> },
    { key: 'comm', label: t('common.community'), w: 1.2, render: (x) => <TextCell>{x.community?.name ?? '—'}</TextCell> },
    { key: 'base', label: t('referrals.colBase'), w: 0.9, render: (x) => <NumCell>{formatCents(x.baseCents)}</NumCell> },
    { key: 'rate', label: t('referrals.colRate'), w: 0.6, render: (x) => <MutedCell>{pct(x.rateBps)}</MutedCell> },
    { key: 'amt', label: t('referrals.colCommission'), w: 0.9, render: (x) => <NumCell>{formatCents(x.amountCents)}</NumCell> },
    { key: 'st', label: t('common.status'), w: 0.9, render: (x) => <StatusBadge tone={STATUS_TONE[x.status]}>{t(`referrals.status.${x.status}`)}</StatusBadge> },
    { key: 'payout', label: t('referrals.colPayoutOn'), w: 1, render: (x) => <MutedCell>{x.payoutOn ? formatDate(x.payoutOn) : '—'}</MutedCell> },
    { key: 'ref', label: t('referrals.colSource'), w: 1.2, render: (x) => <MonoCell>{x.sourceRef.replace(/^(payment|hosting):/, '$1:').slice(0, 20)}</MonoCell> },
  ];
  const referralCols: Column<ReferralRow>[] = [
    { key: 'referrer', label: t('referrals.colReferrer'), w: 1.6, render: (x) => personCell(x.referrer) },
    { key: 'referred', label: t('referrals.colReferred'), w: 1.6, render: (x) => personCell(x.referred) },
    { key: 'code', label: t('referrals.colCode'), w: 0.9, render: (x) => <MonoCell>{x.code}</MonoCell> },
    { key: 'at', label: t('referrals.colSignup'), w: 1, render: (x) => <MutedCell>{formatDateTime(x.signedUpAt)}</MutedCell> },
    {
      key: 'win',
      label: t('referrals.colWindow'),
      w: 1.1,
      render: (x) => <StatusBadge tone={x.windowActive ? 'g' : 'x'}>{x.windowActive ? t('referrals.windowActive', { date: formatDate(x.expiresAt) }) : t('referrals.windowExpired')}</StatusBadge>,
    },
    { key: 'cnt', label: t('referrals.colCount'), w: 0.6, render: (x) => <NumCell>{fmtNum(x.commissionCount)}</NumCell> },
    { key: 'sum', label: t('referrals.colTotal'), w: 0.9, render: (x) => <NumCell>{formatCents(x.commissionCents)}</NumCell> },
  ];

  const common = {
    search: { value: ts.q, onChange: ts.onQ, placeholder: t('referrals.searchPlaceholder') },
    tabs: [
      { key: 'commissions', label: t('referrals.tabCommissions') },
      { key: 'referrals', label: t('referrals.tabReferrals') },
    ],
    tab: view,
    onTab: (k: string) => {
      setView(k as View);
      ts.clear();
    },
    loading: list.isPending,
    error: list.isError ? list.error : null,
    onRetry: () => void list.refetch(),
    emptyText: t('referrals.empty'),
    page,
  };

  return (
    <>
      <PageHeader title={t('referrals.pageTitle')} subtitle={t('referrals.pageSubtitle')} />
      <KpiGrid
        min={160}
        items={[
          { icon: 'group_add', label: t('referrals.kpiReferrals'), value: s ? fmtNum(s.referrals) : '—' },
          { icon: 'receipt_long', label: t('referrals.kpiCommissions'), value: s ? fmtNum(s.commissions) : '—' },
          { icon: 'hourglass_top', label: t('referrals.kpiPending'), value: s ? formatCents(s.pendingCents) : '—' },
          { icon: 'paid', label: t('referrals.kpiPaid'), value: s ? formatCents(s.paidCents) : '—' },
        ]}
      />
      {view === 'commissions' ? (
        <DataTable<CommissionRow>
          {...common}
          rows={(list.data?.data ?? []) as CommissionRow[]}
          rowKey={(x) => x.id}
          title={t('referrals.tableCommissions')}
          columns={commissionCols}
          filters={[
            { key: 'kind', label: t('referrals.colKind'), value: ts.f.kind, options: [{ value: 'member', label: t('referrals.kindMember') }, { value: 'creator', label: t('referrals.kindCreator') }, { value: 'community', label: t('referrals.kindCommunity') }], onChange: ts.setFilter('kind') },
            { key: 'status', label: t('common.status'), value: ts.f.status, options: (['pending', 'paid', 'void'] as const).map((value) => ({ value, label: t(`referrals.status.${value}`) })), onChange: ts.setFilter('status') },
          ]}
          onClearFilters={ts.clear}
        />
      ) : (
        <DataTable<ReferralRow> {...common} rows={(list.data?.data ?? []) as ReferralRow[]} rowKey={(x) => x.id} title={t('referrals.tableReferrals')} columns={referralCols} />
      )}
    </>
  );
}
