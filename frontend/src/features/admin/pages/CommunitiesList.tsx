import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { formatDate } from '../../../lib/datetime';
import { KpiGrid } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, NumCell, TextCell, type Column, type TableFilter } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge, fmtNum } from '../components/ui';
import { useCategoryLabel, useCommunityActions } from '../components/communityActions';
import { useAdminCommunities, useCommunitySummary } from '../queries';
import { COMMUNITY_STATUS, PRICING_LABEL, type AdminCommunity, type CommunityStatus } from '../types';

const LIMIT = 20;
const NS = 'admin-pages1';
const statusOptions = () => (Object.keys(COMMUNITY_STATUS) as CommunityStatus[]).map((k) => ({ value: k, label: COMMUNITY_STATUS[k].label }));
const sortOptions = () => [
  { value: 'oldest', label: i18n.t('communities.sortOldest', { ns: NS }) },
  { value: 'members', label: i18n.t('communities.sortMembers', { ns: NS }) },
  { value: 'mrr', label: i18n.t('communities.sortMrr', { ns: NS }) },
  { value: 'name', label: i18n.t('communities.sortName', { ns: NS }) },
];

export function communityColumns(categoryLabel: (id: string) => string): Column<AdminCommunity>[] {
  const t = (key: string) => i18n.t(key, { ns: NS });
  return [
    { key: 'name', label: t('communities.colCommunity'), w: 2.2, render: (c) => <MainCell name={c.name} sub={`/${c.slug}`} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'id', label: t('communities.colId'), render: (c) => <MonoCell>{c.id}</MonoCell> },
    { key: 'owner', label: t('communities.colOwner'), render: (c) => <TextCell>{(c.owner?.name ?? '—')}</TextCell> },
    { key: 'cat', label: t('communities.colCategory'), render: (c) => <TextCell>{categoryLabel(c.category)}</TextCell> },
    { key: 'members', label: t('communities.colMembers'), w: 0.8, render: (c) => <NumCell>{fmtNum(c.members)}</NumCell> },
    { key: 'price', label: t('communities.colPrice'), render: (c) => <NumCell>{c.pricing === 'free' ? PRICING_LABEL.free : `$${c.priceUsd}`}</NumCell> },
    { key: 'mrr', label: t('communities.colMrr'), render: (c) => <NumCell>${(c.mrrCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}</NumCell> },
    { key: 'status', label: t('communities.colStatus'), render: (c) => <StatusBadge tone={COMMUNITY_STATUS[c.status].tone}>{COMMUNITY_STATUS[c.status].label}</StatusBadge> },
    { key: 'created', label: t('communities.colCreated'), render: (c) => <MutedCell>{formatDate(c.createdAt)}</MutedCell> },
  ];
}

export function CommunitiesList() {
  const { t } = useTranslation(NS);
  const navigate = useNavigate();
  const summary = useCommunitySummary();
  const { label: categoryLabel, options: categoryOptions } = useCategoryLabel();
  const { actionsFor, modalEl } = useCommunityActions();
  const [q, setQ] = useState('');
  const [f, setF] = useState({ status: '', pricing: '', category: '', visibility: '', sort: '' });
  const [page, setPage] = useState(1);
  const list = useAdminCommunities({ q: q || undefined, status: f.status || undefined, pricing: f.pricing || undefined, category: f.category || undefined, visibility: f.visibility || undefined, sort: f.sort || undefined, page, limit: LIMIT });
  const s = summary.data;

  const set = (key: keyof typeof f) => (v: string) => {
    setF((o) => ({ ...o, [key]: v }));
    setPage(1);
  };
  const filters: TableFilter[] = [
    { key: 'status', label: t('communities.filterStatus'), value: f.status, options: statusOptions(), onChange: set('status') },
    { key: 'pricing', label: t('communities.filterPricing'), value: f.pricing, options: [{ value: 'free', label: t('communities.pricingFree') }, { value: 'paid', label: t('communities.pricingPaid') }, { value: 'trial', label: t('communities.pricingTrial') }], onChange: set('pricing') },
    { key: 'category', label: t('communities.filterCategory'), value: f.category, options: categoryOptions, onChange: set('category') },
    { key: 'visibility', label: t('communities.filterVisibility'), value: f.visibility, options: [{ value: 'public', label: t('communities.visPublic') }, { value: 'private', label: t('communities.visPrivate') }], onChange: set('visibility') },
    { key: 'sort', label: t('communities.filterSort'), value: f.sort, options: sortOptions(), onChange: set('sort') },
  ];

  return (
    <>
      <PageHeader title={t('communities.title')} subtitle={t('communities.subtitle')} />
      {s && (
        <KpiGrid
          min={150}
          items={[
            { icon: 'groups', label: t('communities.kpiTotal'), value: fmtNum(s.total) },
            { icon: 'check_circle', label: t('communities.kpiActive'), value: fmtNum(s.active) },
            { icon: 'how_to_reg', label: t('communities.kpiPending'), value: fmtNum(s.pendingReview + s.changesRequested), onClick: () => navigate('/admin/communities/review'), bad: true },
            { icon: 'paid', label: t('communities.kpiPaid'), value: fmtNum(s.paid) },
            { icon: 'pause_circle', label: t('communities.kpiSuspended'), value: fmtNum(s.suspended), onClick: () => navigate('/admin/communities/suspended'), bad: true },
            { icon: 'delete', label: t('communities.kpiDeleted'), value: fmtNum(s.deleted), onClick: () => navigate('/admin/communities/trash'), bad: true },
          ]}
        />
      )}
      <DataTable
        columns={communityColumns(categoryLabel)}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('communities.searchPlaceholder') }}
        filters={filters}
        onClearFilters={() => { setF({ status: '', pricing: '', category: '', visibility: '', sort: '' }); setPage(1); }}
        onRow={(c) => navigate(`/admin/communities/${c.id}`)}
        actions={(c) => actionsFor(c)}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {modalEl}
    </>
  );
}
