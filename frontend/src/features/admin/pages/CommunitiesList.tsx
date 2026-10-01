import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../../lib/datetime';
import { KpiGrid } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, NumCell, TextCell, type Column, type TableFilter } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge, fmtNum } from '../components/ui';
import { useCategoryLabel, useCommunityActions } from '../components/communityActions';
import { useAdminCommunities, useCommunitySummary } from '../queries';
import { COMMUNITY_STATUS, PRICING_LABEL, type AdminCommunity, type CommunityStatus } from '../types';

const LIMIT = 20;
const STATUS_OPTIONS = (Object.keys(COMMUNITY_STATUS) as CommunityStatus[]).map((k) => ({ value: k, label: COMMUNITY_STATUS[k].label }));
const SORT_OPTIONS = [
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'members', label: 'Nhiều thành viên' },
  { value: 'mrr', label: 'MRR cao nhất' },
  { value: 'name', label: 'Tên A–Z' },
];

export function communityColumns(categoryLabel: (id: string) => string): Column<AdminCommunity>[] {
  return [
    { key: 'name', label: 'Cộng đồng', w: 2.2, render: (c) => <MainCell name={c.name} sub={`/${c.slug}`} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'id', label: 'Mã', render: (c) => <MonoCell>{c.id}</MonoCell> },
    { key: 'owner', label: 'Chủ sở hữu', render: (c) => <TextCell>{c.owner.name}</TextCell> },
    { key: 'cat', label: 'Danh mục', render: (c) => <TextCell>{categoryLabel(c.category)}</TextCell> },
    { key: 'members', label: 'Thành viên', w: 0.8, render: (c) => <NumCell>{fmtNum(c.members)}</NumCell> },
    { key: 'price', label: 'Giá', render: (c) => <NumCell>{c.pricing === 'free' ? PRICING_LABEL.free : `$${c.priceUsd}`}</NumCell> },
    { key: 'mrr', label: 'MRR', render: (c) => <NumCell>${(c.mrrCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}</NumCell> },
    { key: 'status', label: 'Trạng thái', render: (c) => <StatusBadge tone={COMMUNITY_STATUS[c.status].tone}>{COMMUNITY_STATUS[c.status].label}</StatusBadge> },
    { key: 'created', label: 'Tạo lúc', render: (c) => <MutedCell>{formatDate(c.createdAt)}</MutedCell> },
  ];
}

export function CommunitiesList() {
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
    { key: 'status', label: 'Trạng thái', value: f.status, options: STATUS_OPTIONS, onChange: set('status') },
    { key: 'pricing', label: 'Miễn phí / Trả phí', value: f.pricing, options: [{ value: 'free', label: 'Miễn phí' }, { value: 'paid', label: 'Trả phí' }, { value: 'trial', label: 'Dùng thử' }], onChange: set('pricing') },
    { key: 'category', label: 'Danh mục', value: f.category, options: categoryOptions, onChange: set('category') },
    { key: 'visibility', label: 'Hiển thị', value: f.visibility, options: [{ value: 'public', label: 'Công khai' }, { value: 'private', label: 'Riêng tư' }], onChange: set('visibility') },
    { key: 'sort', label: 'Sắp xếp', value: f.sort, options: SORT_OPTIONS, onChange: set('sort') },
  ];

  return (
    <>
      <PageHeader title="Cộng đồng" subtitle="Quản lý toàn bộ cộng đồng trên nền tảng." />
      {s && (
        <KpiGrid
          min={150}
          items={[
            { icon: 'groups', label: 'Tổng cộng đồng', value: fmtNum(s.total) },
            { icon: 'check_circle', label: 'Hoạt động', value: fmtNum(s.active) },
            { icon: 'how_to_reg', label: 'Chờ duyệt', value: fmtNum(s.pendingReview + s.changesRequested), onClick: () => navigate('/admin/communities/review'), bad: true },
            { icon: 'paid', label: 'Trả phí', value: fmtNum(s.paid) },
            { icon: 'pause_circle', label: 'Tạm ngưng', value: fmtNum(s.suspended), onClick: () => navigate('/admin/communities/suspended'), bad: true },
            { icon: 'delete', label: 'Đã xóa', value: fmtNum(s.deleted), onClick: () => navigate('/admin/communities/trash'), bad: true },
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
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm theo tên cộng đồng, chủ sở hữu, mã...' }}
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
