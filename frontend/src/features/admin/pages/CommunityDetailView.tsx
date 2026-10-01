import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'members', label: 'Thành viên' },
  { key: 'content', label: 'Bài viết & Bình luận' },
  { key: 'revenue', label: 'Doanh thu' },
  { key: 'moderation', label: 'Kiểm duyệt' },
  { key: 'settings', label: 'Cài đặt' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const LIMIT = 20;

function Overview({ c, categoryLabel }: { c: CommunityDetail; categoryLabel: (id: string) => string }) {
  const s = c.stats;
  const rep = s.reports30d;
  const verdict = rep >= 10 ? { text: 'Rủi ro cao · cần xem xét', tone: 'r' as const } : rep >= 3 ? { text: 'Cần theo dõi', tone: 'o' as const } : { text: 'Ổn định · rủi ro thấp', tone: 'g' as const };
  return (
    <>
      <KpiGrid
        min={150}
        items={[
          { icon: 'group', label: 'Tổng thành viên', value: fmtNum(s.members) },
          { icon: 'bolt', label: 'Thành viên hoạt động', value: fmtNum(s.activeMembers30d), note: '30 ngày qua' },
          { icon: 'person_add', label: 'Thành viên mới', value: fmtNum(s.newMembers30d), note: '30 ngày qua' },
          { icon: 'edit_note', label: 'Bài viết', value: fmtNum(s.posts) },
          { icon: 'chat', label: 'Bình luận', value: fmtNum(s.comments) },
          { icon: 'payments', label: 'Doanh thu tháng', value: formatCents(s.mrrCents) },
        ]}
      />
      <Row cols="1fr 1.1fr 1fr">
        <KvCard
          title="Thông tin cộng đồng"
          items={[
            { k: 'Chủ sở hữu', v: c.owner.name },
            { k: 'Ngày tạo', v: formatDate(c.createdAt) },
            { k: 'Danh mục', v: categoryLabel(c.category) },
            { k: 'Hiển thị', v: c.visibility === 'public' ? 'Công khai' : 'Riêng tư' },
            { k: 'Loại thành viên', v: c.pricing === 'free' ? 'Miễn phí' : PRICING_LABEL[c.pricing] },
            { k: 'Giá gói', v: c.pricing === 'free' ? '—' : `$${c.priceUsd} / tháng` },
            { k: 'Trạng thái khám phá', v: DISCOVERY[c.discovery].label, badge: DISCOVERY[c.discovery].tone },
            ...(c.statusReason ? [{ k: 'Lý do trạng thái', v: c.statusReason }] : []),
            ...(c.statusUntil ? [{ k: 'Hiệu lực đến', v: formatDate(c.statusUntil) }] : []),
          ]}
        />
        <TimelineCard
          title="Hoạt động gần đây"
          sub="Thao tác của quản trị viên trên cộng đồng này"
          empty="Chưa có thao tác quản trị nào."
          items={c.history.map((h) => ({ icon: 'history', who: h.actor?.name ?? 'Hệ thống', text: `${AUDIT_ACTION[h.action] ?? h.action}${h.reason ? ` · ${h.reason}` : ''}`, time: formatRelative(h.createdAt), tone: 'o' }))}
        />
        <RiskCard
          title="Sức khỏe / Rủi ro"
          items={[
            { label: 'Báo cáo (30 ngày)', value: String(rep), pct: Math.min(100, rep * 10), tone: rep >= 10 ? 'r' : rep >= 3 ? 'o' : 'g' },
            { label: 'Báo cáo đang mở', value: String(s.openReports), pct: Math.min(100, s.openReports * 15), tone: s.openReports >= 5 ? 'r' : s.openReports > 0 ? 'o' : 'g' },
            { label: 'Bài viết bị ẩn', value: String(s.hiddenPosts), pct: s.posts ? Math.min(100, (s.hiddenPosts / s.posts) * 100 * 5) : 0, tone: 'o' },
            { label: 'Thành viên bị cấm', value: String(s.bannedMembers), pct: s.members ? Math.min(100, (s.bannedMembers / s.members) * 100 * 5) : 0, tone: 'g' },
          ]}
          verdict={verdict}
        />
      </Row>
    </>
  );
}

function Members({ id }: { id: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const list = useCommunityMembers(id, { q: q || undefined, role: role || undefined, page, limit: LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'name', label: 'Thành viên', w: 1.8, render: (m) => <MainCell name={m.name} sub={m.email} /> },
        { key: 'role', label: 'Vai trò', render: (m) => <TextCell>{ROLE_LABEL[m.role] ?? m.role}</TextCell> },
        { key: 'joined', label: 'Tham gia', render: (m) => <MutedCell>{formatDate(m.joinedAt)}</MutedCell> },
        { key: 'last', label: 'Hoạt động gần nhất', render: (m) => <MutedCell>{m.lastActiveAt ? formatRelative(m.lastActiveAt) : '—'}</MutedCell> },
        { key: 'posts', label: 'Bài viết', w: 0.7, render: (m) => <NumCell>{m.posts}</NumCell> },
        {
          key: 'status',
          label: 'Trạng thái',
          render: (m) => (m.banned ? <StatusBadge tone="r">Bị cấm khỏi cộng đồng</StatusBadge> : <StatusBadge tone={USER_STATUS[m.userStatus].tone}>{USER_STATUS[m.userStatus].label}</StatusBadge>),
        },
      ]}
      rows={list.data?.data ?? []}
      rowKey={(m) => m.userId}
      search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm thành viên...' }}
      filters={[{ key: 'role', label: 'Vai trò', value: role, options: Object.entries(ROLE_LABEL).filter(([k]) => k !== 'creator').map(([value, label]) => ({ value, label })), onChange: (v) => { setRole(v); setPage(1); } }]}
      onClearFilters={() => setRole('')}
      loading={list.isPending}
      error={list.isError ? list.error : null}
      onRetry={() => void list.refetch()}
      onRow={(m) => navigate(`/admin/users/${m.userId}`)}
      actions={(m) => [{ label: 'Xem người dùng', onClick: () => navigate(`/admin/users/${m.userId}`) }]}
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
    />
  );
}

function Moderation({ id }: { id: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useCommunityReports(id, { page, limit: LIMIT });
  return (
    <DataTable
      title="Báo cáo của cộng đồng"
      columns={caseColumns({ community: false })}
      rows={list.data?.data ?? []}
      rowKey={(c) => c.id}
      loading={list.isPending}
      error={list.isError ? list.error : null}
      onRetry={() => void list.refetch()}
      emptyText="Cộng đồng này chưa có báo cáo nào."
      onRow={(c) => navigate(`/admin/moderation/cases/${c.id}`)}
      actions={(c) => [{ label: 'Duyệt', onClick: () => navigate(`/admin/moderation/cases/${c.id}`) }]}
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
    />
  );
}

/** Chi tiết cộng đồng: header thực thể + tab (Tổng quan / Thành viên / Nội dung / Doanh thu / Kiểm duyệt / Cài đặt). */
export function CommunityDetailView() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'overview') as TabKey;
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
        <PageHeader title="Chi tiết cộng đồng" />
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
          { label: 'Duyệt', icon: 'check_circle', onClick: () => setReview('approve') },
          { label: 'Yêu cầu chỉnh sửa', icon: 'edit_note', disabled: c.status !== 'pending_review', onClick: () => setReview('changes') },
          { label: 'Từ chối', icon: 'block', danger: true, onClick: () => setReview('reject') },
        ] satisfies RowAction[])
      : []),
    ...actionsFor(c, { includeView: false }).filter((a) => a.label !== 'Mở cộng đồng' && a.label !== 'Xét duyệt'),
  ];

  const setTab = (k: string) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true });

  return (
    <>
      <PageHeader title={c.name} trail={tab === 'overview' ? [{ label: c.name }] : [{ label: c.name, to: `/admin/communities/${c.id}` }, { label: TABS.find((t) => t.key === tab)!.label }]} />
      <EntityHeader
        avatar={c.thumbnail ? <img src={c.thumbnail} alt="" className="size-[62px] flex-none rounded-2xl object-cover" /> : <AdminAvatar name={c.name} shape="square" size={62} seed={c.id} />}
        name={c.name}
        status={st}
        meta={[
          { icon: 'tag', text: `Mã cộng đồng: ${c.id}` },
          { icon: 'person', text: `Chủ sở hữu: ${c.owner.name}` },
          { icon: 'category', text: categoryLabel(c.category) },
          { icon: 'calendar_today', text: `Tạo ${formatDate(c.createdAt)}` },
        ]}
        actions={
          <>
            {c.status !== 'deleted' && (
              <AdminButton icon="open_in_new" onClick={() => window.open(`/courses/${c.id}/community`, '_blank', 'noopener')}>
                Xem cộng đồng
              </AdminButton>
            )}
            <AdminButton
              icon="mail"
              onClick={() => {
                clearError();
                void startConversation(c.owner.id);
              }}
            >
              Nhắn chủ sở hữu
            </AdminButton>
            <AdminButton icon="more_horiz" aria-haspopup="menu" onClick={(e) => openMenu(e, menuActions.map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, disabled: a.disabled, onClick: a.onClick })), 'THAO TÁC', 220)}>
              Thao tác
            </AdminButton>
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

      {tab === 'overview' && <Overview c={c} categoryLabel={categoryLabel} />}
      {tab === 'members' && (
        <>
          <KpiGrid
            min={150}
            items={[
              { icon: 'group', label: 'Tất cả thành viên', value: fmtNum(s.members) },
              { icon: 'bolt', label: 'Hoạt động (30 ngày)', value: fmtNum(s.activeMembers30d) },
              { icon: 'person_add', label: 'Mới (30 ngày)', value: fmtNum(s.newMembers30d) },
              { icon: 'block', label: 'Bị cấm', value: fmtNum(s.bannedMembers), bad: true },
            ]}
          />
          <Members id={c.id} />
        </>
      )}
      {tab === 'content' && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'article', label: 'Tổng bài viết', value: fmtNum(s.posts) },
            { icon: 'chat', label: 'Bình luận', value: fmtNum(s.comments) },
            { icon: 'visibility_off', label: 'Bài viết bị ẩn', value: fmtNum(s.hiddenPosts), bad: true },
            { icon: 'flag', label: 'Báo cáo (30 ngày)', value: fmtNum(s.reports30d), onClick: () => setTab('moderation'), bad: true },
            { icon: 'school', label: 'Bài học', value: fmtNum(c.lessons) },
            { icon: 'event', label: 'Sự kiện', value: fmtNum(s.events) },
          ]}
        />
      )}
      {tab === 'revenue' && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'payments', label: 'Tổng doanh thu', value: formatCents(s.totalRevenueCents) },
            { icon: 'autorenew', label: 'MRR', value: formatCents(s.mrrCents) },
            { icon: 'card_membership', label: 'Gói đang hoạt động', value: fmtNum(s.activeSubscriptions) },
            ...(s.activeSubscriptions > 0 ? [{ icon: 'person', label: 'ARPU', value: formatCents(Math.round(s.mrrCents / s.activeSubscriptions)) }] : []),
            { icon: 'undo', label: 'Hoàn tiền', value: formatCents(s.refundsCents) },
          ]}
        />
      )}
      {tab === 'moderation' && <Moderation id={c.id} />}
      {tab === 'settings' && (
        <>
          <KvCard
            title="Thông tin cộng đồng"
            sub="Chỉ đọc — chủ sở hữu quản lý nội dung này trong trang cài đặt cộng đồng."
            items={[
              { k: 'Tên', v: c.name },
              { k: 'Đường dẫn', v: `/${c.slug}` },
              { k: 'Mô tả', v: c.description || '—' },
              { k: 'Ngôn ngữ', v: c.language === 'vi' ? 'Tiếng Việt' : c.language === 'en' ? 'Tiếng Anh' : c.language },
              { k: 'Quyền truy cập', v: c.visibility === 'public' ? 'Công khai' : 'Riêng tư' },
              { k: 'Giá thành viên', v: c.pricing === 'free' ? PRICING_LABEL.free : `$${c.priceUsd} / tháng` },
              { k: 'Chủ sở hữu', v: `${c.owner.name} · ${c.owner.email}` },
            ]}
            link="Mở trang cài đặt của cộng đồng"
            onLink={() => window.open(`/courses/${c.id}/community/cai-dat`, '_blank', 'noopener')}
          />
          <DangerCard
            title="Vùng nguy hiểm"
            items={[
              c.status === 'suspended'
                ? { title: 'Khôi phục cộng đồng', desc: 'Gỡ tạm ngưng, cộng đồng hoạt động trở lại.', btn: 'Khôi phục', onClick: () => menuActions.find((a) => a.label === 'Khôi phục')?.onClick() }
                : { title: 'Tạm ngưng cộng đồng', desc: 'Ẩn cộng đồng và tạm dừng mọi thanh toán cho đến khi khôi phục.', btn: 'Tạm ngưng cộng đồng', disabled: c.status !== 'active', onClick: () => menuActions.find((a) => a.label === 'Tạm ngưng')?.onClick() },
              c.status === 'deleted'
                ? { title: 'Khôi phục cộng đồng đã xóa', desc: c.purgeAt ? `Dữ liệu bị xóa vĩnh viễn vào ${formatDate(c.purgeAt)}.` : 'Khôi phục về trạng thái trước khi xóa.', btn: 'Khôi phục', onClick: () => menuActions.find((a) => a.label === 'Khôi phục')?.onClick() }
                : { title: 'Xóa cộng đồng', desc: 'Xóa cộng đồng. Dữ liệu được giữ 30 ngày trước khi xóa vĩnh viễn.', btn: 'Xóa cộng đồng', onClick: () => menuActions.find((a) => a.label === 'Xóa')?.onClick() },
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
