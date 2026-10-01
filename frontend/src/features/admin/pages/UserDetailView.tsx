import { useState } from 'react';
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

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'communities', label: 'Cộng đồng đã tham gia' },
  { key: 'activity', label: 'Hoạt động' },
  { key: 'purchases', label: 'Lịch sử mua' },
  { key: 'reports', label: 'Báo cáo / Vi phạm' },
  { key: 'security', label: 'Bảo mật' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const LIMIT = 20;
const ACTIVITY_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'login', label: 'Đăng nhập' },
  { value: 'community', label: 'Cộng đồng' },
  { value: 'content', label: 'Nội dung' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'moderation', label: 'Kiểm duyệt' },
];
const ACTIVITY_TONE: Record<string, Tone> = { login: 'x', community: 'g', content: 'b', payment: 'g', moderation: 'o' };

function Overview({ u, goTab }: { u: UserDetail; goTab: (k: TabKey) => void }) {
  const s = u.stats;
  return (
    <>
      <KpiGrid
        min={150}
        items={[
          { icon: 'groups', label: 'Cộng đồng', value: fmtNum(s.communities) },
          { icon: 'article', label: 'Bài viết', value: fmtNum(s.posts) },
          { icon: 'chat', label: 'Bình luận', value: fmtNum(s.comments) },
          { icon: 'shopping_bag', label: 'Lượt mua', value: fmtNum(s.purchases) },
          { icon: 'flag', label: 'Báo cáo', value: fmtNum(s.reportsReceived), note: s.reportsReceived ? 'Đã nhận' : 'Hồ sơ sạch', bad: true },
        ]}
      />
      <Row cols="1fr 1.2fr">
        <KvCard
          title="Hồ sơ"
          items={[
            { k: 'Email', v: u.email },
            { k: 'Vị trí', v: u.location || '—' },
            { k: 'Website', v: u.website || '—' },
            { k: 'Tham gia', v: formatDate(u.joinedAt) },
            { k: 'Đăng nhập gần nhất', v: u.lastLoginAt ? formatRelative(u.lastLoginAt) : '—' },
            { k: 'Trạng thái xác minh', v: u.emailVerified ? 'Đã xác minh' : 'Chưa xác minh', badge: u.emailVerified ? 'g' : 'o' },
            { k: 'Vai trò', v: u.role === 'creator' ? 'Creator' : 'Thành viên' },
            { k: 'Gói đăng ký', v: u.plan === 'paid' ? 'Trả phí' : 'Miễn phí' },
          ]}
        />
        <TimelineCard
          title="Hoạt động gần đây"
          link="Xem tất cả"
          onLink={() => goTab('activity')}
          items={u.recentActivity.map((a) => ({ icon: a.icon, who: a.title, text: a.detail ?? '', time: formatRelative(a.createdAt), tone: ACTIVITY_TONE[a.type] ?? 'o' }))}
        />
      </Row>
      {u.status !== 'active' && (
        <KvCard
          title="Tình trạng tài khoản"
          items={[
            { k: 'Trạng thái', v: USER_STATUS[u.status].label, badge: USER_STATUS[u.status].tone },
            ...(u.restrictions.length ? [{ k: 'Hạn chế', v: u.restrictions.map((r) => RESTRICTION_LABEL[r] ?? r).join(', ') }] : []),
            { k: 'Lý do', v: u.statusReason ?? '—' },
            { k: 'Hiệu lực đến', v: u.statusUntil ? formatDateTime(u.statusUntil) : 'Vô thời hạn' },
            { k: 'Thực hiện bởi', v: u.statusChangedBy?.name ?? '—' },
            { k: 'Lúc', v: u.statusChangedAt ? formatDateTime(u.statusChangedAt) : '—' },
          ]}
        />
      )}
    </>
  );
}

function CommunitiesTab({ id }: { id: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useUserCommunities(id, { page, limit: LIMIT }, true);
  return (
    <DataTable
      columns={[
        { key: 'name', label: 'Cộng đồng', w: 2, render: (c) => <MainCell name={c.name} sub={c.id} shape="square" seed={c.id} /> },
        { key: 'role', label: 'Vai trò', render: (c) => <TextCell>{({ owner: 'Chủ sở hữu', admin: 'Quản trị viên', mod: 'Kiểm duyệt viên', member: 'Thành viên' } as Record<string, string>)[c.role] ?? c.role}</TextCell> },
        { key: 'mem', label: 'Gói thành viên', render: (c) => <TextCell>{c.membership === 'paid' ? `Trả phí · $${c.priceUsd}/tháng` : 'Miễn phí'}</TextCell> },
        { key: 'joined', label: 'Tham gia', render: (c) => <MutedCell>{formatDate(c.joinedAt)}</MutedCell> },
        { key: 'last', label: 'Hoạt động gần nhất', render: (c) => <MutedCell>{c.lastActiveAt ? formatRelative(c.lastActiveAt) : '—'}</MutedCell> },
        {
          key: 'status',
          label: 'Trạng thái',
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
      emptyText="Người dùng này chưa tham gia cộng đồng nào."
      onRow={(c) => navigate(`/admin/communities/${c.id}`)}
      actions={(c) => [{ label: 'Mở cộng đồng', onClick: () => navigate(`/admin/communities/${c.id}`) }]}
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
    />
  );
}

function ActivityTab({ id }: { id: string }) {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const list = useUserActivity(id, { type: type || undefined, page, limit: LIMIT }, true);
  const chips = (
    <div className="flex flex-wrap gap-1.5">
      {ACTIVITY_FILTERS.map((f) => (
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
        <Card title="Dòng thời gian hoạt động">
          {chips}
          <LoadingBlock />
        </Card>
      ) : list.isError ? (
        <Card title="Dòng thời gian hoạt động">
          {chips}
          <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : (
        <TimelineCard
          title="Dòng thời gian hoạt động"
          chips={chips}
          empty="Chưa có hoạt động nào."
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
  const [page, setPage] = useState(1);
  const list = useUserPurchases(id, { page, limit: LIMIT }, true);
  const sm = list.data?.summary;
  return (
    <>
      {sm && (
        <KpiGrid
          min={200}
          items={[
            { icon: 'payments', label: 'Tổng chi tiêu', value: formatCents(sm.lifetimeSpendCents) },
            { icon: 'autorenew', label: 'Gói đang hoạt động', value: fmtNum(sm.activeSubscriptions) },
            { icon: 'undo', label: 'Hoàn tiền', value: formatCents(sm.refundsCents) },
          ]}
        />
      )}
      <DataTable
        columns={[
          { key: 'id', label: 'Giao dịch', w: 1.2, render: (p) => <MonoCell>{p.invoiceNumber ?? p.id.slice(0, 8)}</MonoCell> },
          { key: 'course', label: 'Cộng đồng', w: 1.6, render: (p) => <TextCell>{p.courseName}</TextCell> },
          { key: 'amount', label: 'Số tiền', render: (p) => <NumCell>{formatCents(p.amountCents)}</NumCell> },
          { key: 'refunded', label: 'Đã hoàn', render: (p) => <NumCell>{p.refundedCents ? formatCents(p.refundedCents) : '—'}</NumCell> },
          { key: 'method', label: 'Phương thức', render: (p) => <TextCell>{p.method}</TextCell> },
          {
            key: 'status',
            label: 'Trạng thái',
            render: (p) => {
              const st = PURCHASE_STATUS[p.status];
              return <StatusBadge tone={st?.tone ?? 'b'}>{st?.label ?? p.status}</StatusBadge>;
            },
          },
          { key: 'date', label: 'Ngày', render: (p) => <MutedCell>{formatDate(p.createdAt)}</MutedCell> },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(p) => p.id}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Người dùng này chưa có giao dịch nào."
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
    </>
  );
}

function ReportsTab({ id }: { id: string }) {
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
            { icon: 'flag', label: 'Báo cáo nhận được', value: fmtNum(sm.received), bad: true },
            { icon: 'gavel', label: 'Vi phạm đã xác nhận', value: fmtNum(sm.confirmed), bad: true },
            { icon: 'warning', label: 'Cảnh cáo', value: fmtNum(sm.warnings), bad: true },
            { icon: 'pause_circle', label: 'Lần tạm ngưng', value: fmtNum(sm.suspensions), bad: true },
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
        emptyText="Người dùng này chưa bị báo cáo."
        onRow={(c) => navigate(`/admin/moderation/cases/${c.id}`)}
        actions={(c) => [{ label: 'Duyệt', onClick: () => navigate(`/admin/moderation/cases/${c.id}`) }]}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
    </>
  );
}

function SecurityTab({ u }: { u: UserDetail }) {
  const toast = useToast();
  const revoke = useRevokeSession();
  const sessions = u.security.activeSessions;
  return (
    <Row cols="1fr 1.4fr">
      <KvCard
        title="Bảo mật"
        items={[
          { k: 'Xác minh email', v: u.security.emailVerified ? 'Đã xác minh' : 'Chưa xác minh', badge: u.security.emailVerified ? 'g' : 'o' },
          { k: 'Phiên đang hoạt động', v: String(sessions.length) },
          { k: 'Đăng nhập gần nhất', v: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—' },
        ]}
      />
      <DataTable
        title="Phiên đang hoạt động"
        columns={[
          { key: 'device', label: 'Thiết bị', w: 1.6, render: (s) => <MainCell name={s.device || 'Không rõ'} icon="devices" /> },
          { key: 'ip', label: 'IP', render: (s) => <MonoCell>{s.ip ?? 'Không rõ'}</MonoCell> },
          { key: 'created', label: 'Tạo lúc', render: (s) => <MutedCell>{formatRelative(s.createdAt)}</MutedCell> },
          { key: 'last', label: 'Hoạt động gần nhất', render: (s) => <MutedCell>{s.lastUsedAt ? formatRelative(s.lastUsedAt) : '—'}</MutedCell> },
          { key: 'status', label: 'Trạng thái', render: () => <StatusBadge tone="g">Hoạt động</StatusBadge> },
        ]}
        rows={sessions}
        rowKey={(s) => s.id}
        emptyText="Không có phiên đang hoạt động."
        actions={(s) => [
          {
            label: 'Thu hồi',
            disabled: revoke.isPending,
            onClick: () => revoke.mutate({ id: u.id, sid: s.id }, { onSuccess: () => toast.success('Đã thu hồi phiên'), onError: (e) => toast.error(errMessage(e)) }),
          },
        ]}
      />
    </Row>
  );
}

/** Chi tiết người dùng: header + hành động theo trạng thái + 6 tab. */
export function UserDetailView() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'overview') as TabKey;
  const q = useUserDetail(id);
  const { startConversation, error: dmError, clearError } = useStartConversation();
  const [modal, setModal] = useState<'restrict' | 'suspend' | 'ban' | 'reinstate' | 'warn' | null>(null);

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) {
    return (
      <>
        <PageHeader title="Chi tiết người dùng" />
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
      <PageHeader title={u.name} trail={tab === 'overview' ? [{ label: u.name }] : [{ label: u.name, to: `/admin/users/${u.id}` }, { label: TABS.find((t) => t.key === tab)!.label }]} />
      <EntityHeader
        avatar={<AdminAvatar name={u.name} src={u.avatarUrl} size={62} seed={u.id} />}
        name={u.name}
        status={st}
        meta={[
          { icon: 'tag', text: u.id },
          { icon: 'mail', text: u.email },
          ...(u.location ? [{ icon: 'location_on', text: u.location }] : []),
          { icon: 'schedule', text: u.lastLoginAt ? `Đăng nhập gần nhất ${formatRelative(u.lastLoginAt)}` : 'Chưa đăng nhập' },
        ]}
        actions={
          <>
            <AdminButton icon="mail" onClick={() => { clearError(); void startConversation(u.id); }}>
              Nhắn tin
            </AdminButton>
            {!protectedAcct && (
              <>
                <AdminButton icon="warning" onClick={() => setModal('warn')}>
                  Cảnh cáo
                </AdminButton>
                {u.status === 'active' ? (
                  <>
                    <AdminButton icon="block" onClick={() => setModal('restrict')}>
                      Hạn chế
                    </AdminButton>
                    <AdminButton kind="danger" icon="pause_circle" onClick={() => setModal('suspend')}>
                      Tạm ngưng
                    </AdminButton>
                    <AdminButton kind="danger" icon="gavel" onClick={() => setModal('ban')}>
                      Cấm
                    </AdminButton>
                  </>
                ) : (
                  <>
                    <AdminButton kind="primary" icon="restart_alt" onClick={() => setModal('reinstate')}>
                      Khôi phục truy cập
                    </AdminButton>
                    {u.status !== 'banned' && (
                      <AdminButton kind="danger" icon="gavel" onClick={() => setModal('ban')}>
                        Cấm
                      </AdminButton>
                    )}
                  </>
                )}
              </>
            )}
          </>
        }
        tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
        tab={tab}
        onTab={setTab}
      />
      {dmError && (
        <div role="alert" className="rounded-xl bg-[#fef2f2] px-4 py-2.5 text-[13px] font-medium text-[#b91c1c]">
          {dmError}
        </div>
      )}
      {protectedAcct && <EmptyBlock icon="shield">Đây là tài khoản Platform Admin — không thể hạn chế, tạm ngưng hoặc cấm.</EmptyBlock>}

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
