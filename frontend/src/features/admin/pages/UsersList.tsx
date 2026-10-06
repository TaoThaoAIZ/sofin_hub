import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
const statusOptions = () => (Object.keys(USER_STATUS) as UserStatus[]).map((k) => ({ value: k, label: USER_STATUS[k].label }));
const sortOptions = (t: TFunction) => [
  { value: 'oldest', label: t('users.sort.oldest') },
  { value: 'name', label: t('users.sort.name') },
  { value: 'revenue', label: t('users.sort.revenue') },
  { value: 'reports', label: t('users.sort.reports') },
];

const userCell = (u: AdminUser) => <MainCell name={u.name} sub={`${ROLE_LABEL[u.role]} · ${u.id.slice(0, 8)}`} avatarSrc={u.avatarUrl} seed={u.id} />;
const statusCell = (u: AdminUser) => <StatusBadge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</StatusBadge>;

export function UsersList() {
  const { t } = useTranslation('admin-pages2');
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
    { key: 'status', label: t('users.col.status'), value: f.status, options: statusOptions(), onChange: set('status') },
    { key: 'role', label: t('users.filter.role'), value: f.role, options: [{ value: 'member', label: t('users.role.member') }, { value: 'creator', label: 'Creator' }], onChange: set('role') },
    { key: 'plan', label: t('users.col.plan'), value: f.plan, options: [{ value: 'free', label: t('users.plan.free') }, { value: 'paid', label: t('users.plan.paid') }], onChange: set('plan') },
    { key: 'sort', label: t('users.filter.sort'), value: f.sort, options: sortOptions(t), onChange: set('sort') },
  ];

  const columns: Column<AdminUser>[] = [
    { key: 'user', label: t('users.col.user'), w: 1.8, render: userCell },
    { key: 'email', label: 'Email', w: 1.6, render: (u) => <TextCell>{u.email}</TextCell> },
    { key: 'comms', label: t('users.col.communities'), w: 0.8, render: (u) => <NumCell>{u.communities}</NumCell> },
    { key: 'plan', label: t('users.col.plan'), render: (u) => <TextCell>{u.plan === 'paid' ? t('users.plan.paid') : t('users.plan.free')}</TextCell> },
    { key: 'revenue', label: t('users.col.revenue'), w: 0.8, render: (u) => <NumCell>{formatCents(u.revenueCents)}</NumCell> },
    { key: 'reports', label: t('users.col.reports'), w: 0.7, render: (u) => <NumCell>{u.reports}</NumCell> },
    { key: 'status', label: t('users.col.status'), render: statusCell },
    { key: 'joined', label: t('users.col.joined'), render: (u) => <MutedCell>{formatDate(u.joinedAt)}</MutedCell> },
  ];

  return (
    <>
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
      {s && (
        <KpiGrid
          min={140}
          items={[
            { icon: 'person', label: t('users.kpi.total'), value: fmtNum(s.total) },
            { icon: 'bolt', label: t('users.kpi.active'), value: fmtNum(s.active) },
            { icon: 'person_add', label: t('users.kpi.new'), value: fmtNum(s.new30d), note: t('users.kpi.last30d') },
            { icon: 'paid', label: t('users.kpi.paid'), value: fmtNum(s.paid) },
            { icon: 'block', label: t('users.kpi.restricted'), value: fmtNum(s.restricted), onClick: () => navigate('/admin/users/restricted'), bad: true },
            { icon: 'pause_circle', label: t('users.kpi.suspended'), value: fmtNum(s.suspended), onClick: () => navigate('/admin/users/restricted'), bad: true },
            { icon: 'gavel', label: t('users.kpi.banned'), value: fmtNum(s.banned), onClick: () => navigate('/admin/users/banned'), bad: true },
          ]}
        />
      )}
      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(u) => u.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('users.searchPlaceholder') }}
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

const restrictionText = (t: TFunction, u: AdminUser) =>
  u.status === 'suspended' ? t('users.restricted.cannotLogin') : u.restrictions.length ? u.restrictions.map((r) => RESTRICTION_LABEL[r] ?? r).join(', ') : '—';

const durationText = (t: TFunction, u: AdminUser) => (u.statusUntil ? t('users.restricted.until', { date: formatDate(u.statusUntil) }) : t('users.restricted.indefinite'));

export function UsersRestricted() {
  const { t } = useTranslation('admin-pages2');
  const navigate = useNavigate();
  const { actionsFor, modalEl } = useUserActions();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useAdminUsers({ q: q || undefined, status: status || 'restricted,suspended', page, limit: LIMIT });
  return (
    <>
      <PageHeader title={t('users.restricted.title')} subtitle={t('users.restricted.subtitle')} />
      <DataTable<AdminUser>
        columns={[
          { key: 'user', label: t('users.col.user'), w: 1.8, render: userCell },
          { key: 'restr', label: t('users.restricted.col.restriction'), w: 1.6, render: (u) => <TextCell>{restrictionText(t, u)}</TextCell> },
          { key: 'dur', label: t('users.restricted.col.duration'), render: (u) => <TextCell>{durationText(t, u)}</TextCell> },
          { key: 'reason', label: t('users.col.reason'), render: (u) => <TextCell>{u.statusReason ?? '—'}</TextCell> },
          { key: 'by', label: t('users.restricted.col.by'), render: (u) => <TextCell>{u.statusChangedBy?.name ?? '—'}</TextCell> },
          { key: 'at', label: t('users.restricted.col.since'), render: (u) => <MutedCell>{u.statusChangedAt ? formatDate(u.statusChangedAt) : '—'}</MutedCell> },
          { key: 'status', label: t('users.col.status'), render: statusCell },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(u) => u.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('users.restricted.searchPlaceholder') }}
        filters={[{ key: 'status', label: t('users.col.status'), value: status, options: [{ value: 'restricted', label: t('users.kpi.restricted') }, { value: 'suspended', label: t('users.kpi.suspended') }], onChange: (v) => { setStatus(v); setPage(1); } }]}
        onClearFilters={() => setStatus('')}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('users.restricted.empty')}
        onRow={(u) => navigate(`/admin/users/${u.id}`)}
        actions={(u) => actionsFor(u, { reinstateFirst: true })}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {modalEl}
    </>
  );
}

export function UsersBanned() {
  const { t } = useTranslation('admin-pages2');
  const navigate = useNavigate();
  const { actionsFor, modalEl } = useUserActions();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useAdminUsers({ q: q || undefined, status: 'banned', page, limit: LIMIT });
  return (
    <>
      <PageHeader title={t('users.banned.title')} subtitle={t('users.banned.subtitle')} />
      <DataTable<AdminUser>
        columns={[
          { key: 'user', label: t('users.col.user'), w: 1.8, render: userCell },
          { key: 'email', label: 'Email', w: 1.6, render: (u) => <TextCell>{u.email}</TextCell> },
          { key: 'id', label: t('users.banned.col.id'), render: (u) => <MonoCell>{u.id.slice(0, 8)}</MonoCell> },
          { key: 'reason', label: t('users.col.reason'), render: (u) => <TextCell>{u.statusReason ?? '—'}</TextCell> },
          { key: 'by', label: t('users.banned.col.by'), render: (u) => <TextCell>{u.statusChangedBy?.name ?? '—'}</TextCell> },
          { key: 'at', label: t('users.banned.col.date'), render: (u) => <MutedCell>{u.statusChangedAt ? formatDate(u.statusChangedAt) : '—'}</MutedCell> },
          { key: 'status', label: t('users.col.status'), render: statusCell },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(u) => u.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('users.banned.searchPlaceholder') }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('users.banned.empty')}
        onRow={(u) => navigate(`/admin/users/${u.id}`)}
        actions={(u) => actionsFor(u, { reinstateFirst: true }).slice(0, 2)}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {modalEl}
    </>
  );
}

