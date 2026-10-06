import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatCents, formatDate, formatDateTime, formatRelative } from '../../../lib/datetime';
import { useStartConversation } from '../../messages/useStartConversation';
import { BanUserModal, ReinstateUserModal, RestrictUserModal, SuspendUserModal, WarnModal, banSummary } from '../components/ActionModals';
import { EntityHeader, KpiGrid, KvCard, Row, TimelineCard } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, NumCell, TablePager, TextCell } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { caseColumns } from '../components/caseColumns';
import { useToast } from '../components/overlay';
import { AdminAvatar, AdminButton, Card, EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge, errMessage, fmtNum, type Tone } from '../components/ui';
import { useRevokeSession, useUserActivity, useUserCommunities, useUserDetail, useUserPurchases, useUserReports } from '../queries';
import { COMMUNITY_STATUS, PURCHASE_STATUS, RESTRICTION_LABEL, USER_STATUS, type CommunityStatus, type UserDetail } from '../types';

const TABS = [{ key: 'overview' }, { key: 'communities' }, { key: 'activity' }, { key: 'purchases' }, { key: 'reports' }, { key: 'security' }] as const;
type TabKey = (typeof TABS)[number]['key'];
const tabLabel = (t: TFunction, k: TabKey) => t(`userDetail.tab.${k}`);

const LIMIT = 20;
const activityFilters = (t: TFunction) => [
  { value: '', label: t('userDetail.activity.all') },
  { value: 'login', label: t('userDetail.activity.login') },
  { value: 'community', label: t('userDetail.activity.community') },
  { value: 'content', label: t('userDetail.activity.content') },
  { value: 'payment', label: t('userDetail.activity.payment') },
  { value: 'moderation', label: t('userDetail.activity.moderation') },
];
const ACTIVITY_TONE: Record<string, Tone> = { login: 'x', community: 'g', content: 'b', payment: 'g', moderation: 'o' };

function Overview({ u, goTab }: { u: UserDetail; goTab: (k: TabKey) => void }) {
  const { t } = useTranslation('admin-pages2');
  const s = u.stats;
  return (
    <>
      <KpiGrid
        min={150}
        items={[
          { icon: 'groups', label: t('userDetail.kpi.communities'), value: fmtNum(s.communities) },
          { icon: 'article', label: t('userDetail.kpi.posts'), value: fmtNum(s.posts) },
          { icon: 'chat', label: t('userDetail.kpi.comments'), value: fmtNum(s.comments) },
          { icon: 'shopping_bag', label: t('userDetail.kpi.purchases'), value: fmtNum(s.purchases) },
          { icon: 'flag', label: t('userDetail.kpi.reports'), value: fmtNum(s.reportsReceived), note: s.reportsReceived ? t('userDetail.kpi.received') : t('userDetail.kpi.clean'), bad: true },
        ]}
      />
      <Row cols="1fr 1.2fr">
        <KvCard
          title={t('userDetail.profile.title')}
          items={[
            { k: 'Email', v: u.email },
            { k: t('userDetail.profile.location'), v: u.location || '—' },
            { k: 'Website', v: u.website || '—' },
            { k: t('userDetail.profile.joined'), v: formatDate(u.joinedAt) },
            { k: t('userDetail.lastLogin'), v: u.lastLoginAt ? formatRelative(u.lastLoginAt) : '—' },
            { k: t('userDetail.profile.verification'), v: u.emailVerified ? t('userDetail.verified') : t('userDetail.unverified'), badge: u.emailVerified ? 'g' : 'o' },
            { k: t('userDetail.profile.role'), v: u.role === 'creator' ? 'Creator' : t('userDetail.profile.member') },
            { k: t('userDetail.profile.plan'), v: u.plan === 'paid' ? t('userDetail.paid') : t('userDetail.free') },
          ]}
        />
        <TimelineCard
          title={t('userDetail.recent.title')}
          link={t('userDetail.recent.viewAll')}
          onLink={() => goTab('activity')}
          items={u.recentActivity.map((a) => ({ icon: a.icon, who: a.title, text: a.detail ?? '', time: formatRelative(a.createdAt), tone: ACTIVITY_TONE[a.type] ?? 'o' }))}
        />
      </Row>
      {u.status !== 'active' && (
        <KvCard
          title={t('userDetail.account.title')}
          items={[
            { k: t('userDetail.account.status'), v: USER_STATUS[u.status].label, badge: USER_STATUS[u.status].tone },
            ...(u.restrictions.length ? [{ k: t('userDetail.account.restrictions'), v: u.restrictions.map((r) => RESTRICTION_LABEL[r] ?? r).join(', ') }] : []),
            { k: t('userDetail.account.reason'), v: u.statusReason ?? '—' },
            { k: t('userDetail.account.until'), v: u.statusUntil ? formatDateTime(u.statusUntil) : t('userDetail.account.indefinite') },
            { k: t('userDetail.account.by'), v: u.statusChangedBy?.name ?? '—' },
            { k: t('userDetail.account.at'), v: u.statusChangedAt ? formatDateTime(u.statusChangedAt) : '—' },
          ]}
        />
      )}
    </>
  );
}

function CommunitiesTab({ id }: { id: string }) {
  const { t } = useTranslation('admin-pages2');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useUserCommunities(id, { page, limit: LIMIT }, true);
  return (
    <DataTable
      columns={[
        { key: 'name', label: t('userDetail.communities.col.community'), w: 2, render: (c) => <MainCell name={c.name} sub={c.id} shape="square" seed={c.id} /> },
        { key: 'role', label: t('userDetail.profile.role'), render: (c) => <TextCell>{({ owner: t('userDetail.communities.role.owner'), admin: t('userDetail.communities.role.admin'), mod: t('userDetail.communities.role.mod'), member: t('userDetail.profile.member') } as Record<string, string>)[c.role] ?? c.role}</TextCell> },
        { key: 'mem', label: t('userDetail.communities.col.membership'), render: (c) => <TextCell>{c.membership === 'paid' ? t('userDetail.communities.paidPrice', { price: c.priceUsd }) : t('userDetail.free')}</TextCell> },
        { key: 'joined', label: t('userDetail.profile.joined'), render: (c) => <MutedCell>{formatDate(c.joinedAt)}</MutedCell> },
        { key: 'last', label: t('userDetail.lastActive'), render: (c) => <MutedCell>{c.lastActiveAt ? formatRelative(c.lastActiveAt) : '—'}</MutedCell> },
        {
          key: 'status',
          label: t('userDetail.status'),
          render: (c) => {
            const st = COMMUNITY_STATUS[c.status as CommunityStatus];
            return st ? <StatusBadge tone={st.tone}>{st.label}</StatusBadge> : <MutedCell>{c.status}</MutedCell>;
          },
        },
      ]}
      rows={list.data?.data ?? []}
      rowKey={(c) => c.id}
      loading={list.isPending}
      error={list.isError ? list.error : null}
      onRetry={() => void list.refetch()}
      emptyText={t('userDetail.communities.empty')}
      onRow={(c) => navigate(`/admin/communities/${c.id}`)}
      actions={(c) => [{ label: t('userDetail.communities.open'), onClick: () => navigate(`/admin/communities/${c.id}`) }]}
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
    />
  );
}

function ActivityTab({ id }: { id: string }) {
  const { t } = useTranslation('admin-pages2');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const list = useUserActivity(id, { type: type || undefined, page, limit: LIMIT }, true);
  const chips = (
    <div className="flex flex-wrap gap-1.5">
      {activityFilters(t).map((f) => (
        <button
          key={f.value}
          type="button"
          aria-pressed={type === f.value}
          onClick={() => {
            setType(f.value);
            setPage(1);
          }}
          className={`flex h-[30px] items-center rounded-[9px] border-0 px-[11px] text-[12.5px] font-semibold ${type === f.value ? 'bg-[#1c1917] text-white' : 'bg-[#f5f1ed] text-stone-700'}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
  return (
    <>
      {list.isPending ? (
        <Card title={t('userDetail.activity.timeline')}>
          {chips}
          <LoadingBlock />
        </Card>
      ) : list.isError ? (
        <Card title={t('userDetail.activity.timeline')}>
          {chips}
          <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : (
        <TimelineCard
          title={t('userDetail.activity.timeline')}
          chips={chips}
          empty={t('userDetail.activity.empty')}
          items={list.data.data.map((a) => ({ icon: a.icon, who: a.title, text: a.detail ?? '', time: formatRelative(a.createdAt), tone: ACTIVITY_TONE[a.type] ?? 'o' }))}
        />
      )}
      {list.data && list.data.meta.totalPages > 1 && (
        <div className="flex justify-end">
          <TablePager info={{ page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage }} />
        </div>
      )}
    </>
  );
}

function PurchasesTab({ id }: { id: string }) {
  const { t } = useTranslation('admin-pages2');
  const [page, setPage] = useState(1);
  const list = useUserPurchases(id, { page, limit: LIMIT }, true);
  const sm = list.data?.summary;
  return (
    <>
      {sm && (
        <KpiGrid
          min={200}
          items={[
            { icon: 'payments', label: t('userDetail.purchases.totalSpend'), value: formatCents(sm.lifetimeSpendCents) },
            { icon: 'autorenew', label: t('userDetail.purchases.activeSubs'), value: fmtNum(sm.activeSubscriptions) },
            { icon: 'undo', label: t('userDetail.purchases.refunds'), value: formatCents(sm.refundsCents) },
          ]}
        />
      )}
      <DataTable
        columns={[
          { key: 'id', label: t('userDetail.purchases.col.transaction'), w: 1.2, render: (p) => <MonoCell>{p.invoiceNumber ?? p.id.slice(0, 8)}</MonoCell> },
          { key: 'course', label: t('userDetail.communities.col.community'), w: 1.6, render: (p) => <TextCell>{p.courseName}</TextCell> },
          { key: 'amount', label: t('userDetail.purchases.col.amount'), render: (p) => <NumCell>{formatCents(p.amountCents)}</NumCell> },
          { key: 'refunded', label: t('userDetail.purchases.col.refunded'), render: (p) => <NumCell>{p.refundedCents ? formatCents(p.refundedCents) : '—'}</NumCell> },
          { key: 'method', label: t('userDetail.purchases.col.method'), render: (p) => <TextCell>{p.method}</TextCell> },
          {
            key: 'status',
            label: t('userDetail.status'),
            render: (p) => {
              const st = PURCHASE_STATUS[p.status];
              return <StatusBadge tone={st?.tone ?? 'b'}>{st?.label ?? p.status}</StatusBadge>;
            },
          },
          { key: 'date', label: t('userDetail.purchases.col.date'), render: (p) => <MutedCell>{formatDate(p.createdAt)}</MutedCell> },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(p) => p.id}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('userDetail.purchases.empty')}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
    </>
  );
}

function ReportsTab({ id }: { id: string }) {
  const { t } = useTranslation('admin-pages2');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useUserReports(id, { page, limit: LIMIT }, true);
  const sm = list.data?.meta.summary;
  return (
    <>
      {sm && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'flag', label: t('userDetail.reports.received'), value: fmtNum(sm.received), bad: true },
            { icon: 'gavel', label: t('userDetail.reports.confirmed'), value: fmtNum(sm.confirmed), bad: true },
            { icon: 'warning', label: t('userDetail.reports.warnings'), value: fmtNum(sm.warnings), bad: true },
            { icon: 'pause_circle', label: t('userDetail.reports.suspensions'), value: fmtNum(sm.suspensions), bad: true },
          ]}
        />
      )}
      <DataTable
        columns={caseColumns()}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('userDetail.reports.empty')}
        onRow={(c) => navigate(`/admin/moderation/cases/${c.id}`)}
        actions={(c) => [{ label: t('userDetail.reports.review'), onClick: () => navigate(`/admin/moderation/cases/${c.id}`) }]}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
    </>
  );
}

function SecurityTab({ u }: { u: UserDetail }) {
  const { t } = useTranslation('admin-pages2');
  const toast = useToast();
  const revoke = useRevokeSession();
  const sessions = u.security.activeSessions;
  return (
    <Row cols="1fr 1.4fr">
      <KvCard
        title={t('userDetail.tab.security')}
        items={[
          { k: t('userDetail.security.emailVerification'), v: u.security.emailVerified ? t('userDetail.verified') : t('userDetail.unverified'), badge: u.security.emailVerified ? 'g' : 'o' },
          { k: t('userDetail.security.activeSessions'), v: String(sessions.length) },
          { k: t('userDetail.lastLogin'), v: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—' },
        ]}
      />
      <DataTable
        title={t('userDetail.security.activeSessions')}
        columns={[
          { key: 'device', label: t('userDetail.security.device'), w: 1.6, render: (s) => <MainCell name={s.device || t('userDetail.security.unknown')} icon="devices" /> },
          { key: 'ip', label: 'IP', render: (s) => <MonoCell>{s.ip ?? t('userDetail.security.unknown')}</MonoCell> },
          { key: 'created', label: t('userDetail.security.createdAt'), render: (s) => <MutedCell>{formatRelative(s.createdAt)}</MutedCell> },
          { key: 'last', label: t('userDetail.lastActive'), render: (s) => <MutedCell>{s.lastUsedAt ? formatRelative(s.lastUsedAt) : '—'}</MutedCell> },
          { key: 'status', label: t('userDetail.status'), render: () => <StatusBadge tone="g">{t('userDetail.security.active')}</StatusBadge> },
        ]}
        rows={sessions}
        rowKey={(s) => s.id}
        emptyText={t('userDetail.security.noSessions')}
        actions={(s) => [
          {
            label: t('userDetail.security.revoke'),
            disabled: revoke.isPending,
            onClick: () => revoke.mutate({ id: u.id, sid: s.id }, { onSuccess: () => toast.success(t('userDetail.security.revoked')), onError: (e) => toast.error(errMessage(e)) }),
          },
        ]}
      />
    </Row>
  );
}

/** Chi tiết người dùng: header + hành động theo trạng thái + 6 tab. */
export function UserDetailView() {
  const { t } = useTranslation('admin-pages2');
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((x) => x.key === params.get('tab'))?.key ?? 'overview') as TabKey;
  const q = useUserDetail(id);
  const { startConversation, error: dmError, clearError } = useStartConversation();
  const [modal, setModal] = useState<'restrict' | 'suspend' | 'ban' | 'reinstate' | 'warn' | null>(null);

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) {
    return (
      <>
        <PageHeader title={t('userDetail.title')} />
        <Card>
          <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        </Card>
      </>
    );
  }
  const u = q.data;
  const st = USER_STATUS[u.status];
  const target = { kind: 'user' as const, userId: u.id, name: u.name };
  const close = () => setModal(null);
  const setTab = (k: string) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true });
  const protectedAcct = u.isPlatformAdmin;

  return (
    <>
      <PageHeader title={u.name} trail={tab === 'overview' ? [{ label: u.name }] : [{ label: u.name, to: `/admin/users/${u.id}` }, { label: tabLabel(t, tab) }]} />
      <EntityHeader
        avatar={<AdminAvatar name={u.name} src={u.avatarUrl} size={62} seed={u.id} />}
        name={u.name}
        status={st}
        meta={[
          { icon: 'tag', text: u.id },
          { icon: 'mail', text: u.email },
          ...(u.location ? [{ icon: 'location_on', text: u.location }] : []),
          { icon: 'schedule', text: u.lastLoginAt ? t('userDetail.lastLoginAgo', { time: formatRelative(u.lastLoginAt) }) : t('userDetail.neverLoggedIn') },
        ]}
        actions={
          <>
            <AdminButton icon="mail" onClick={() => { clearError(); void startConversation(u.id); }}>
              {t('userDetail.action.message')}
            </AdminButton>
            {!protectedAcct && (
              <>
                <AdminButton icon="warning" onClick={() => setModal('warn')}>
                  {t('userDetail.action.warn')}
                </AdminButton>
                {u.status === 'active' ? (
                  <>
                    <AdminButton icon="block" onClick={() => setModal('restrict')}>
                      {t('userDetail.action.restrict')}
                    </AdminButton>
                    <AdminButton kind="danger" icon="pause_circle" onClick={() => setModal('suspend')}>
                      {t('userDetail.action.suspend')}
                    </AdminButton>
                    <AdminButton kind="danger" icon="gavel" onClick={() => setModal('ban')}>
                      {t('userDetail.action.ban')}
                    </AdminButton>
                  </>
                ) : (
                  <>
                    <AdminButton kind="primary" icon="restart_alt" onClick={() => setModal('reinstate')}>
                      {t('userDetail.action.reinstate')}
                    </AdminButton>
                    {u.status !== 'banned' && (
                      <AdminButton kind="danger" icon="gavel" onClick={() => setModal('ban')}>
                        {t('userDetail.action.ban')}
                      </AdminButton>
                    )}
                  </>
                )}
              </>
            )}
          </>
        }
        tabs={TABS.map((x) => ({ key: x.key, label: tabLabel(t, x.key) }))}
        tab={tab}
        onTab={setTab}
      />
      {dmError && (
        <div role="alert" className="rounded-xl bg-[#fef2f2] px-4 py-2.5 text-[13px] font-medium text-[#b91c1c]">
          {dmError}
        </div>
      )}
      {protectedAcct && <EmptyBlock icon="shield">{t('userDetail.protected')}</EmptyBlock>}

      {tab === 'overview' && <Overview u={u} goTab={setTab} />}
      {tab === 'communities' && <CommunitiesTab id={u.id} />}
      {tab === 'activity' && <ActivityTab id={u.id} />}
      {tab === 'purchases' && <PurchasesTab id={u.id} />}
      {tab === 'reports' && <ReportsTab id={u.id} />}
      {tab === 'security' && <SecurityTab u={u} />}

      {modal === 'restrict' && <RestrictUserModal target={target} onClose={close} />}
      {modal === 'suspend' && <SuspendUserModal target={target} onClose={close} />}
      {modal === 'ban' && <BanUserModal target={target} summary={banSummary(u)} onClose={close} />}
      {modal === 'warn' && <WarnModal target={target} onClose={close} />}
      {modal === 'reinstate' && <ReinstateUserModal user={{ id: u.id, name: u.name }} onClose={close} />}
    </>
  );
}
