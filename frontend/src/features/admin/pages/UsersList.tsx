import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCents, formatDate } from '../../../lib/datetime';
import { KpiGrid } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, NumCell, TextCell, type Column, type TableFilter } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge, fmtNum } from '../components/ui';
import { useUserActions } from '../components/userActions';
import { useAdminUsers, useUserSummary } from '../queries';
import { RESTRICTION_LABEL, ROLE_LABEL, USER_STATUS, type AdminUser, type UserStatus } from '../types';

const LIMIT = 20;
const STATUS_OPTIONS = (Object.keys(USER_STATUS) as UserStatus[]).map((k) => ({ value: k, label: USER_STATUS[k].label }));
const SORT_OPTIONS = [
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'name', label: 'Tên A–Z' },
  { value: 'revenue', label: 'Doanh thu cao nhất' },
  { value: 'reports', label: 'Nhiều báo cáo nhất' },
];

const userCell = (u: AdminUser) => <MainCell name={u.name} sub={`${ROLE_LABEL[u.role]} · ${u.id.slice(0, 8)}`} avatarSrc={u.avatarUrl} seed={u.id} />;
const statusCell = (u: AdminUser) => <StatusBadge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</StatusBadge>;

export function UsersList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const summary = useUserSummary();
  const { actionsFor, modalEl } = useUserActions();
  const [q, setQ] = useState('');
  const [f, setF] = useState({ status: '', role: '', plan: '', sort: params.get('sort') ?? '' });
  const [page, setPage] = useState(1);
  const list = useAdminUsers({ q: q || undefined, status: f.status || undefined, role: f.role || undefined, plan: f.plan || undefined, sort: f.sort || undefined, page, limit: LIMIT });
  const s = summary.data;

  const set = (key: keyof typeof f) => (v: string) => {
    setF((o) => ({ ...o, [key]: v }));
    setPage(1);
  };
  const filters: TableFilter[] = [
    { key: 'status', label: 'Trạng thái', value: f.status, options: STATUS_OPTIONS, onChange: set('status') },
    { key: 'role', label: 'Vai trò', value: f.role, options: [{ value: 'member', label: 'Thành viên' }, { value: 'creator', label: 'Creator' }], onChange: set('role') },
    { key: 'plan', label: 'Gói đăng ký', value: f.plan, options: [{ value: 'free', label: 'Miễn phí' }, { value: 'paid', label: 'Trả phí' }], onChange: set('plan') },
    { key: 'sort', label: 'Sắp xếp', value: f.sort, options: SORT_OPTIONS, onChange: set('sort') },
  ];

  const columns: Column<AdminUser>[] = [
    { key: 'user', label: 'Người dùng', w: 1.8, render: userCell },
    { key: 'email', label: 'Email', w: 1.6, render: (u) => <TextCell>{u.email}</TextCell> },
    { key: 'comms', label: 'Cộng đồng', w: 0.8, render: (u) => <NumCell>{u.communities}</NumCell> },
    { key: 'plan', label: 'Gói đăng ký', render: (u) => <TextCell>{u.plan === 'paid' ? 'Trả phí' : 'Miễn phí'}</TextCell> },
    { key: 'revenue', label: 'Doanh thu', w: 0.8, render: (u) => <NumCell>{formatCents(u.revenueCents)}</NumCell> },
    { key: 'reports', label: 'Báo cáo', w: 0.7, render: (u) => <NumCell>{u.reports}</NumCell> },
    { key: 'status', label: 'Trạng thái', render: statusCell },
    { key: 'joined', label: 'Tham gia', render: (u) => <MutedCell>{formatDate(u.joinedAt)}</MutedCell> },
  ];

  return (
    <>
      <PageHeader title="Người dùng" subtitle="Tìm kiếm, xem xét và quản lý mọi tài khoản trên nền tảng." />
      {s && (
        <KpiGrid
          min={140}
          items={[
            { icon: 'person', label: 'Tổng người dùng', value: fmtNum(s.total) },
            { icon: 'bolt', label: 'Hoạt động', value: fmtNum(s.active) },
            { icon: 'person_add', label: 'Mới', value: fmtNum(s.new30d), note: '30 ngày qua' },
            { icon: 'paid', label: 'Trả phí', value: fmtNum(s.paid) },
            { icon: 'block', label: 'Bị hạn chế', value: fmtNum(s.restricted), onClick: () => navigate('/admin/users/restricted'), bad: true },
            { icon: 'pause_circle', label: 'Tạm ngưng', value: fmtNum(s.suspended), onClick: () => navigate('/admin/users/restricted'), bad: true },
            { icon: 'gavel', label: 'Bị cấm', value: fmtNum(s.banned), onClick: () => navigate('/admin/users/banned'), bad: true },
          ]}
        />
      )}
      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(u) => u.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm tên, email, mã người dùng...' }}
        filters={filters}
        onClearFilters={() => { setF({ status: '', role: '', plan: '', sort: '' }); setPage(1); }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(u) => navigate(`/admin/users/${u.id}`)}
        actions={(u) => actionsFor(u)}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {modalEl}
    </>
  );
}

const restrictionText = (u: AdminUser) =>
  u.status === 'suspended' ? 'Không thể đăng nhập' : u.restrictions.length ? u.restrictions.map((r) => RESTRICTION_LABEL[r] ?? r).join(', ') : '—';

const durationText = (u: AdminUser) => (u.statusUntil ? `Đến ${formatDate(u.statusUntil)}` : 'Vô thời hạn');

export function UsersRestricted() {
  const navigate = useNavigate();
  const { actionsFor, modalEl } = useUserActions();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useAdminUsers({ q: q || undefined, status: status || 'restricted,suspended', page, limit: LIMIT });
  return (
    <>
      <PageHeader title="Hạn chế / Tạm ngưng" subtitle="Người dùng bị giới hạn quyền trên nền tảng." />
      <DataTable<AdminUser>
        columns={[
          { key: 'user', label: 'Người dùng', w: 1.8, render: userCell },
          { key: 'restr', label: 'Hạn chế', w: 1.6, render: (u) => <TextCell>{restrictionText(u)}</TextCell> },
          { key: 'dur', label: 'Thời hạn', render: (u) => <TextCell>{durationText(u)}</TextCell> },
          { key: 'reason', label: 'Lý do', render: (u) => <TextCell>{u.statusReason ?? '—'}</TextCell> },
          { key: 'by', label: 'Thực hiện bởi', render: (u) => <TextCell>{u.statusChangedBy?.name ?? '—'}</TextCell> },
          { key: 'at', label: 'Từ ngày', render: (u) => <MutedCell>{u.statusChangedAt ? formatDate(u.statusChangedAt) : '—'}</MutedCell> },
          { key: 'status', label: 'Trạng thái', render: statusCell },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(u) => u.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm người dùng...' }}
        filters={[{ key: 'status', label: 'Trạng thái', value: status, options: [{ value: 'restricted', label: 'Bị hạn chế' }, { value: 'suspended', label: 'Tạm ngưng' }], onChange: (v) => { setStatus(v); setPage(1); } }]}
        onClearFilters={() => setStatus('')}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Không có người dùng nào đang bị hạn chế hoặc tạm ngưng."
        onRow={(u) => navigate(`/admin/users/${u.id}`)}
        actions={(u) => actionsFor(u, { reinstateFirst: true })}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {modalEl}
    </>
  );
}

export function UsersBanned() {
  const navigate = useNavigate();
  const { actionsFor, modalEl } = useUserActions();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useAdminUsers({ q: q || undefined, status: 'banned', page, limit: LIMIT });
  return (
    <>
      <PageHeader title="Người dùng bị cấm" subtitle="Tài khoản bị cấm vĩnh viễn. Mọi lệnh cấm đều được ghi vào nhật ký." />
      <DataTable<AdminUser>
        columns={[
          { key: 'user', label: 'Người dùng', w: 1.8, render: userCell },
          { key: 'email', label: 'Email', w: 1.6, render: (u) => <TextCell>{u.email}</TextCell> },
          { key: 'id', label: 'Mã', render: (u) => <MonoCell>{u.id.slice(0, 8)}</MonoCell> },
          { key: 'reason', label: 'Lý do', render: (u) => <TextCell>{u.statusReason ?? '—'}</TextCell> },
          { key: 'by', label: 'Cấm bởi', render: (u) => <TextCell>{u.statusChangedBy?.name ?? '—'}</TextCell> },
          { key: 'at', label: 'Ngày', render: (u) => <MutedCell>{u.statusChangedAt ? formatDate(u.statusChangedAt) : '—'}</MutedCell> },
          { key: 'status', label: 'Trạng thái', render: statusCell },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(u) => u.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm người dùng bị cấm...' }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Chưa có người dùng nào bị cấm."
        onRow={(u) => navigate(`/admin/users/${u.id}`)}
        actions={(u) => actionsFor(u, { reinstateFirst: true }).filter((a) => ['Khôi phục', 'Xem'].includes(a.label))}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {modalEl}
    </>
  );
}

