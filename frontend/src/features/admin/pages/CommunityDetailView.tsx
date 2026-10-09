import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatCents, formatDate, formatRelative } from '../../../lib/datetime';
import { useStartConversation } from '../../messages/useStartConversation';
import { ApproveCommunityModal, RejectCommunityModal, RequestChangesModal } from '../components/ActionModals';
import { AdminButton, AdminAvatar, Card, ErrorBlock, LoadingBlock, StatusBadge, fmtNum } from '../components/ui';
import { DangerCard, EntityHeader, KpiGrid, KvCard, RiskCard, Row, TimelineCard } from '../components/Cards';
import { DataTable, MainCell, MutedCell, NumCell, TextCell, type RowAction } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { caseColumns } from '../components/caseColumns';
import { useCategoryLabel, useCommunityActions } from '../components/communityActions';
import { useMenu } from '../components/overlay';
import { useCommunityDetail, useCommunityMembers, useCommunityReports } from '../queries';
import { AUDIT_ACTION, COMMUNITY_STATUS, DISCOVERY, PRICING_LABEL, ROLE_LABEL, USER_STATUS, type CommunityDetail } from '../types';

const TABS = [{ key: 'overview' }, { key: 'members' }, { key: 'content' }, { key: 'revenue' }, { key: 'moderation' }, { key: 'settings' }] as const;
type TabKey = (typeof TABS)[number]['key'];

const LIMIT = 20;

function Overview({ c, categoryLabel }: { c: CommunityDetail; categoryLabel: (id: string) => string }) {
  const { t } = useTranslation('admin-pages1');
  const s = c.stats;
  const rep = s.reports30d;
  const verdict = rep >= 10 ? { text: t('communityDetail.verdictHigh'), tone: 'r' as const } : rep >= 3 ? { text: t('communityDetail.verdictWatch'), tone: 'o' as const } : { text: t('communityDetail.verdictOk'), tone: 'g' as const };
  return (
    <>
      <KpiGrid
        min={150}
        items={[
          { icon: 'group', label: t('communityDetail.kpiMembers'), value: fmtNum(s.members) },
          { icon: 'bolt', label: t('communityDetail.kpiActiveMembers'), value: fmtNum(s.activeMembers30d), note: t('communityDetail.last30') },
          { icon: 'person_add', label: t('communityDetail.kpiNewMembers'), value: fmtNum(s.newMembers30d), note: t('communityDetail.last30') },
          { icon: 'edit_note', label: t('communityDetail.kpiPosts'), value: fmtNum(s.posts) },
          { icon: 'chat', label: t('communityDetail.kpiComments'), value: fmtNum(s.comments) },
          { icon: 'payments', label: t('communityDetail.kpiMonthRevenue'), value: formatCents(s.mrrCents) },
        ]}
      />
      <Row cols="1fr 1.1fr 1fr">
        <KvCard
          title={t('communityDetail.info')}
          items={[
            { k: t('communityDetail.owner'), v: (c.owner?.name ?? '—') },
            { k: t('communityDetail.createdOn'), v: formatDate(c.createdAt) },
            { k: t('communityDetail.category'), v: categoryLabel(c.category) },
            { k: t('communityDetail.visibility'), v: c.visibility === 'public' ? t('communityDetail.public') : t('communityDetail.private') },
            { k: t('communityDetail.memberType'), v: c.pricing === 'free' ? t('communityDetail.free') : PRICING_LABEL[c.pricing] },
            { k: t('communityDetail.planPrice'), v: c.pricing === 'free' ? '—' : t('communityDetail.perMonth', { price: formatCents(c.priceUsd) }) },
            { k: t('communityDetail.discovery'), v: DISCOVERY[c.discovery].label, badge: DISCOVERY[c.discovery].tone },
            ...(c.statusReason ? [{ k: t('communityDetail.statusReason'), v: c.statusReason }] : []),
            ...(c.statusUntil ? [{ k: t('communityDetail.statusUntil'), v: formatDate(c.statusUntil) }] : []),
          ]}
        />
        <TimelineCard
          title={t('communityDetail.recent')}
          sub={t('communityDetail.recentSub')}
          empty={t('communityDetail.recentEmpty')}
          items={c.history.map((h) => ({ icon: 'history', who: h.actor?.name ?? t('communityDetail.system'), text: `${AUDIT_ACTION[h.action] ?? h.action}${h.reason ? ` · ${h.reason}` : ''}`, time: formatRelative(h.createdAt), tone: 'o' }))}
        />
        <RiskCard
          title={t('communityDetail.health')}
          items={[
            { label: t('communityDetail.reports30'), value: String(rep), pct: Math.min(100, rep * 10), tone: rep >= 10 ? 'r' : rep >= 3 ? 'o' : 'g' },
            { label: t('communityDetail.openReports'), value: String(s.openReports), pct: Math.min(100, s.openReports * 15), tone: s.openReports >= 5 ? 'r' : s.openReports > 0 ? 'o' : 'g' },
            { label: t('communityDetail.hiddenPosts'), value: String(s.hiddenPosts), pct: s.posts ? Math.min(100, (s.hiddenPosts / s.posts) * 100 * 5) : 0, tone: 'o' },
            { label: t('communityDetail.bannedMembers'), value: String(s.bannedMembers), pct: s.members ? Math.min(100, (s.bannedMembers / s.members) * 100 * 5) : 0, tone: 'g' },
          ]}
          verdict={verdict}
        />
      </Row>
    </>
  );
}

function Members({ id }: { id: string }) {
  const { t } = useTranslation('admin-pages1');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const list = useCommunityMembers(id, { q: q || undefined, role: role || undefined, page, limit: LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'name', label: t('communityDetail.colMember'), w: 1.8, render: (m) => <MainCell name={m.name} sub={m.email} /> },
        { key: 'role', label: t('communityDetail.colRole'), render: (m) => <TextCell>{ROLE_LABEL[m.role] ?? m.role}</TextCell> },
        { key: 'joined', label: t('communityDetail.colJoined'), render: (m) => <MutedCell>{formatDate(m.joinedAt)}</MutedCell> },
        { key: 'last', label: t('communityDetail.colLastActive'), render: (m) => <MutedCell>{m.lastActiveAt ? formatRelative(m.lastActiveAt) : '—'}</MutedCell> },
        { key: 'posts', label: t('communityDetail.colPosts'), w: 0.7, render: (m) => <NumCell>{m.posts}</NumCell> },
        {
          key: 'status',
          label: t('communityDetail.colStatus'),
          render: (m) => (m.banned ? <StatusBadge tone="r">{t('communityDetail.bannedFromCommunity')}</StatusBadge> : <StatusBadge tone={USER_STATUS[m.userStatus].tone}>{USER_STATUS[m.userStatus].label}</StatusBadge>),
        },
      ]}
      rows={list.data?.data ?? []}
      rowKey={(m) => m.userId}
      search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('communityDetail.searchMembers') }}
      filters={[{ key: 'role', label: t('communityDetail.colRole'), value: role, options: Object.entries(ROLE_LABEL).filter(([k]) => k !== 'creator').map(([value, label]) => ({ value, label })), onChange: (v) => { setRole(v); setPage(1); } }]}
      onClearFilters={() => setRole('')}
      loading={list.isPending}
      error={list.isError ? list.error : null}
      onRetry={() => void list.refetch()}
      onRow={(m) => navigate(`/admin/users/${m.userId}`)}
      actions={(m) => [{ label: t('communityDetail.viewUser'), onClick: () => navigate(`/admin/users/${m.userId}`) }]}
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
    />
  );
}

function Moderation({ id }: { id: string }) {
  const { t } = useTranslation('admin-pages1');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useCommunityReports(id, { page, limit: LIMIT });
  return (
    <DataTable
      title={t('communityDetail.communityReports')}
      columns={caseColumns({ community: false })}
      rows={list.data?.data ?? []}
      rowKey={(c) => c.id}
      loading={list.isPending}
      error={list.isError ? list.error : null}
      onRetry={() => void list.refetch()}
      emptyText={t('communityDetail.noReports')}
      onRow={(c) => navigate(`/admin/moderation/cases/${c.id}`)}
      actions={(c) => [{ label: t('communityDetail.review'), onClick: () => navigate(`/admin/moderation/cases/${c.id}`) }]}
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
    />
  );
}

/** Chi tiết cộng đồng: header thực thể + tab (Tổng quan / Thành viên / Nội dung / Doanh thu / Kiểm duyệt / Cài đặt). */
export function CommunityDetailView() {
  const { t } = useTranslation('admin-pages1');
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((tb) => tb.key === params.get('tab'))?.key ?? 'overview') as TabKey;
  const q = useCommunityDetail(id);
  const { label: categoryLabel } = useCategoryLabel();
  const { actionsFor, modalEl } = useCommunityActions();
  const { openMenu, menuEl } = useMenu();
  const { startConversation, error: dmError, clearError } = useStartConversation();
  const [review, setReview] = useState<'approve' | 'changes' | 'reject' | null>(null);

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) {
    return (
      <>
        <PageHeader title={t('communityDetail.title')} />
        <Card>
          <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        </Card>
      </>
    );
  }
  const c = q.data;
  const st = COMMUNITY_STATUS[c.status];
  const ref = { id: c.id, name: c.name };
  const s = c.stats;

  const menuActions: RowAction[] = [
    ...(c.status === 'pending_review' || c.status === 'changes_requested'
      ? ([
          { label: t('communityDetail.approve'), icon: 'check_circle', onClick: () => setReview('approve') },
          { label: t('communityDetail.requestChanges'), icon: 'edit_note', disabled: c.status !== 'pending_review', onClick: () => setReview('changes') },
          { label: t('communityDetail.reject'), icon: 'block', danger: true, onClick: () => setReview('reject') },
        ] satisfies RowAction[])
      : []),
    ...actionsFor(c, { includeView: false }).filter((a) => a.icon !== 'open_in_new' && a.icon !== 'how_to_reg'),
  ];

  const setTab = (k: string) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true });

  return (
    <>
      <PageHeader title={c.name} trail={tab === 'overview' ? [{ label: c.name }] : [{ label: c.name, to: `/admin/communities/${c.id}` }, { label: t(`communityDetail.tab.${tab}`) }]} />
      <EntityHeader
        avatar={c.thumbnail ? <img src={c.thumbnail} alt="" className="size-[62px] flex-none rounded-2xl object-cover" /> : <AdminAvatar name={c.name} shape="square" size={62} seed={c.id} />}
        name={c.name}
        status={st}
        meta={[
          { icon: 'tag', text: t('communityDetail.communityId', { id: c.id }) },
          { icon: 'person', text: t('communityDetail.ownerLine', { name: (c.owner?.name ?? '—') }) },
          { icon: 'category', text: categoryLabel(c.category) },
          { icon: 'calendar_today', text: t('communityDetail.createdLine', { date: formatDate(c.createdAt) }) },
        ]}
        actions={
          <>
            {c.status !== 'deleted' && (
              <AdminButton icon="open_in_new" onClick={() => window.open(`/communities/${c.id}/community`, '_blank', 'noopener')}>
                {t('communityDetail.viewCommunity')}
              </AdminButton>
            )}
            <AdminButton
              icon="mail"
              onClick={() => {
                clearError();
                if (c.owner) void startConversation(c.owner.id);
              }}
            >
              {t('communityDetail.messageOwner')}
            </AdminButton>
            <AdminButton icon="more_horiz" aria-haspopup="menu" onClick={(e) => openMenu(e, menuActions.map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, disabled: a.disabled, onClick: a.onClick })), t('communityDetail.menuHeader'), 220)}>
              {t('communityDetail.actions')}
            </AdminButton>
          </>
        }
        tabs={TABS.map((tb) => ({ key: tb.key, label: t(`communityDetail.tab.${tb.key}`) }))}
        tab={tab}
        onTab={setTab}
      />
      {dmError && (
        <div role="alert" className="rounded-xl bg-[#fef2f2] px-4 py-2.5 text-[13px] font-medium text-[#b91c1c]">
          {dmError}
        </div>
      )}

      {tab === 'overview' && <Overview c={c} categoryLabel={categoryLabel} />}
      {tab === 'members' && (
        <>
          <KpiGrid
            min={150}
            items={[
              { icon: 'group', label: t('communityDetail.allMembers'), value: fmtNum(s.members) },
              { icon: 'bolt', label: t('communityDetail.active30'), value: fmtNum(s.activeMembers30d) },
              { icon: 'person_add', label: t('communityDetail.new30'), value: fmtNum(s.newMembers30d) },
              { icon: 'block', label: t('communityDetail.banned'), value: fmtNum(s.bannedMembers), bad: true },
            ]}
          />
          <Members id={c.id} />
        </>
      )}
      {tab === 'content' && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'article', label: t('communityDetail.totalPosts'), value: fmtNum(s.posts) },
            { icon: 'chat', label: t('communityDetail.kpiComments'), value: fmtNum(s.comments) },
            { icon: 'visibility_off', label: t('communityDetail.hiddenPosts'), value: fmtNum(s.hiddenPosts), bad: true },
            { icon: 'flag', label: t('communityDetail.reports30'), value: fmtNum(s.reports30d), onClick: () => setTab('moderation'), bad: true },
            { icon: 'school', label: t('communityDetail.lessons'), value: fmtNum(c.lessons) },
            { icon: 'event', label: t('communityDetail.events'), value: fmtNum(s.events) },
          ]}
        />
      )}
      {tab === 'revenue' && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'payments', label: t('communityDetail.totalRevenue'), value: formatCents(s.totalRevenueCents) },
            { icon: 'autorenew', label: t('communityDetail.mrr'), value: formatCents(s.mrrCents) },
            { icon: 'card_membership', label: t('communityDetail.activeSubs'), value: fmtNum(s.activeSubscriptions) },
            ...(s.activeSubscriptions > 0 ? [{ icon: 'person', label: t('communityDetail.arpu'), value: formatCents(Math.round(s.mrrCents / s.activeSubscriptions)) }] : []),
            { icon: 'undo', label: t('communityDetail.refunds'), value: formatCents(s.refundsCents) },
          ]}
        />
      )}
      {tab === 'moderation' && <Moderation id={c.id} />}
      {tab === 'settings' && (
        <>
          <KvCard
            title={t('communityDetail.info')}
            sub={t('communityDetail.settingsSub')}
            items={[
              { k: t('communityDetail.name'), v: c.name },
              { k: t('communityDetail.path'), v: `/${c.slug}` },
              { k: t('communityDetail.description'), v: c.description || '—' },
              { k: t('communityDetail.language'), v: c.language === 'vi' ? t('communityDetail.langVi') : c.language === 'en' ? t('communityDetail.langEn') : c.language },
              { k: t('communityDetail.access'), v: c.visibility === 'public' ? t('communityDetail.public') : t('communityDetail.private') },
              { k: t('communityDetail.memberPrice'), v: c.pricing === 'free' ? PRICING_LABEL.free : t('communityDetail.perMonth', { price: formatCents(c.priceUsd) }) },
              { k: t('communityDetail.owner'), v: `${(c.owner?.name ?? '—')} · ${c.owner.email}` },
            ]}
            link={t('communityDetail.openSettings')}
            onLink={() => window.open(`/communities/${c.id}/community/cai-dat`, '_blank', 'noopener')}
          />
          <DangerCard
            title={t('communityDetail.danger')}
            items={[
              c.status === 'suspended'
                ? { title: t('communityDetail.restoreTitle'), desc: t('communityDetail.restoreDesc'), btn: t('communityDetail.restoreBtn'), onClick: () => menuActions.find((a) => a.icon === 'restore')?.onClick() }
                : { title: t('communityDetail.suspendTitle'), desc: t('communityDetail.suspendDesc'), btn: t('communityDetail.suspendBtn'), disabled: c.status !== 'active', onClick: () => menuActions.find((a) => a.icon === 'pause_circle')?.onClick() },
              c.status === 'deleted'
                ? { title: t('communityDetail.undeleteTitle'), desc: c.purgeAt ? t('communityDetail.purgeAt', { date: formatDate(c.purgeAt) }) : t('communityDetail.undeleteDesc'), btn: t('communityDetail.restoreBtn'), onClick: () => menuActions.find((a) => a.icon === 'restore')?.onClick() }
                : { title: t('communityDetail.deleteTitle'), desc: t('communityDetail.deleteDesc'), btn: t('communityDetail.deleteTitle'), onClick: () => menuActions.find((a) => a.icon === 'delete')?.onClick() },
            ]}
          />
        </>
      )}

      {review === 'approve' && <ApproveCommunityModal community={ref} onClose={() => setReview(null)} />}
      {review === 'changes' && <RequestChangesModal community={ref} onClose={() => setReview(null)} />}
      {review === 'reject' && <RejectCommunityModal community={ref} onClose={() => setReview(null)} />}
      {modalEl}
      {menuEl}
    </>
  );
}
