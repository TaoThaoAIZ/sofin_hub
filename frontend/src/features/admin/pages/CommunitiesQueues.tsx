import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate, formatRelative } from '../../../lib/datetime';
import { RejectCommunityModal, RequestChangesModal, UndeleteCommunityModal, trashInfo } from '../components/ActionModals';
import { ChecklistCard, DecisionPanel, KvCard, Row, type ChecklistItem } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, TextCell } from '../components/DataTable';
import { useCategoryLabel, useCommunityActions } from '../components/communityActions';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge, errMessage, fmtNum } from '../components/ui';
import { useToast } from '../components/overlay';
import { LockTab } from '../components/AdminTabs';
import { Card } from '../components/ui';
import { useAdminCommunities, useApproveCommunity, useCommunitySummary, useReviewQueue, useTrash } from '../queries';
import { COMMUNITY_STATUS, PRICING_LABEL, type ReviewQueueItem, type TrashItem } from '../types';
import { communityColumns } from './CommunitiesList';

const LIMIT = 20;

/* ============================== Xét duyệt ============================== */

export function CommunityReview() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const queue = useReviewQueue({ page, limit: LIMIT });
  const approve = useApproveCommunity();
  const { label: categoryLabel } = useCategoryLabel();
  const [note, setNote] = useState('');
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<'changes' | 'reject' | null>(null);

  const items = queue.data?.data ?? [];
  const selId = params.get('id');
  const sel: ReviewQueueItem | undefined = items.find((i) => i.id === selId) ?? items[0];

  const select = (id: string) => {
    setParams({ id }, { replace: true });
    setNote('');
  };

  const checklist = (m: ReviewQueueItem): ChecklistItem[] => {
    const s = m.signals;
    return [
      { key: 'profile', label: 'Hồ sơ cộng đồng', sub: s.hasThumbnail ? 'Đã có ảnh bìa / biểu tượng' : 'Chưa có ảnh bìa / biểu tượng', checked: s.hasThumbnail, auto: true },
      { key: 'desc', label: 'Mô tả', sub: `${fmtNum(s.descriptionLength)} ký tự — ${s.descriptionLength >= 50 ? 'đủ rõ mục đích' : 'quá ngắn, cần mô tả rõ mục đích'}`, checked: s.descriptionLength >= 50, auto: true },
      { key: 'quality', label: 'Chất lượng nội dung', sub: 'Đã xem bài viết đầu và bản xem trước khóa học', checked: !!manual[`${m.id}:quality`] },
      { key: 'policy', label: 'Tuân thủ chính sách', sub: 'Không có chủ đề hay ưu đãi bị cấm', checked: !!manual[`${m.id}:policy`] },
      {
        key: 'owner',
        label: 'Lịch sử chủ sở hữu',
        sub: `Tài khoản ${fmtNum(s.ownerAccountAgeDays)} ngày · ${s.ownerCommunities} cộng đồng`,
        checked: s.ownerAccountAgeDays >= 30,
        auto: true,
        flag: s.ownerAccountAgeDays >= 365 ? { text: 'Đáng tin cậy', tone: 'g' } : undefined,
      },
      {
        key: 'violations',
        label: 'Vi phạm trước đây',
        sub: s.ownerViolations90d > 0 ? `${s.ownerViolations90d} vi phạm trong 90 ngày qua` : 'Chưa có',
        checked: s.ownerViolations90d === 0,
        auto: true,
        flag: s.ownerViolations90d > 0 ? { text: 'Trung bình', tone: 'o' } : undefined,
      },
    ];
  };

  const decided = sel && sel.status === 'changes_requested' ? 'Đã yêu cầu chỉnh sửa — đang chờ chủ sở hữu cập nhật' : '';
  const ref = sel ? { id: sel.id, name: sel.name } : null;

  return (
    <>
      <PageHeader title="Xét duyệt cộng đồng" subtitle="Duyệt cộng đồng mới trước khi xuất hiện trên nền tảng." />
      <Row cols="1fr 1.2fr">
        <DataTable<ReviewQueueItem>
          title="Hàng đợi xét duyệt"
          sub={queue.data ? `${fmtNum(queue.data.meta.total)} đang chờ` : undefined}
          columns={[
            { key: 'name', label: 'Cộng đồng', w: 2, render: (c) => <MainCell name={c.name} sub={c.owner.name} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
            { key: 'submitted', label: 'Gửi lúc', render: (c) => <MutedCell>{formatRelative(c.submittedAt)}</MutedCell> },
            { key: 'status', label: 'Trạng thái', render: (c) => <StatusBadge tone={COMMUNITY_STATUS[c.status].tone}>{COMMUNITY_STATUS[c.status].label}</StatusBadge> },
          ]}
          rows={items}
          rowKey={(c) => c.id}
          loading={queue.isPending}
          error={queue.isError ? queue.error : null}
          onRetry={() => void queue.refetch()}
          emptyText="Không có cộng đồng nào đang chờ xét duyệt."
          onRow={(c) => select(c.id)}
          isActive={(c) => c.id === sel?.id}
          page={queue.data ? { page: queue.data.meta.page, totalPages: queue.data.meta.totalPages, total: queue.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
        />
        {sel && (
          <KvCard
            title="Xem trước cộng đồng"
            link="Mở cộng đồng"
            onLink={() => navigate(`/admin/communities/${sel.id}`)}
            items={[
              { k: 'Tên', v: sel.name },
              { k: 'Chủ sở hữu', v: sel.owner.name },
              { k: 'Mô tả', v: sel.description || '—' },
              { k: 'Danh mục', v: categoryLabel(sel.category) },
              { k: 'Giá', v: sel.pricing === 'free' ? PRICING_LABEL.free : `$${sel.priceUsd} / tháng` },
              { k: 'Thành viên', v: fmtNum(sel.members) },
              { k: 'Tạo lúc', v: formatDate(sel.createdAt) },
              { k: 'Trạng thái', v: COMMUNITY_STATUS[sel.status].label, badge: COMMUNITY_STATUS[sel.status].tone },
            ]}
          />
        )}
      </Row>
      {sel && ref && (
        <Row cols="1fr 1fr">
          <ChecklistCard title="Danh sách kiểm tra" items={checklist(sel)} onToggle={(k) => setManual((m) => ({ ...m, [`${sel.id}:${k}`]: !m[`${sel.id}:${k}`] }))} />
          <DecisionPanel
            title="Quyết định"
            note={note}
            onNote={setNote}
            placeholder="Thêm ghi chú xét duyệt nội bộ..."
            done={decided}
            buttons={[
              {
                label: 'Duyệt',
                icon: 'check_circle',
                kind: 'primary',
                disabled: approve.isPending,
                onClick: () =>
                  approve.mutate(
                    { id: sel.id, note: note.trim() || undefined },
                    { onSuccess: () => { toast.success(`Đã duyệt · ${sel.name}`); setNote(''); }, onError: (e) => toast.error(errMessage(e)) },
                  ),
              },
              { label: 'Yêu cầu chỉnh sửa', icon: 'edit_note', disabled: sel.status !== 'pending_review', onClick: () => setModal('changes') },
              { label: 'Từ chối', icon: 'block', kind: 'danger', onClick: () => setModal('reject') },
            ]}
          />
        </Row>
      )}
      {modal === 'changes' && ref && <RequestChangesModal community={ref} onClose={() => setModal(null)} />}
      {modal === 'reject' && ref && <RejectCommunityModal community={ref} onClose={() => setModal(null)} />}
    </>
  );
}

/* ============================== Tạm ngưng ============================== */

export function CommunitySuspended() {
  const navigate = useNavigate();
  const summary = useCommunitySummary();
  const { label: categoryLabel } = useCategoryLabel();
  const { actionsFor, modalEl } = useCommunityActions();
  const [tab, setTab] = useState<'suspended' | 'active'>('suspended');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useAdminCommunities({ q: q || undefined, status: tab, page, limit: LIMIT });
  const [showLock, setShowLock] = useState(false);
  const cols = communityColumns(categoryLabel);

  return (
    <>
      <PageHeader title="Tạm ngưng cộng đồng" subtitle="Cộng đồng bị tạm ngưng sẽ bị ẩn và tạm dừng thanh toán." />
      <DataTable
        columns={[
          cols[0]!,
          cols[1]!,
          cols[2]!,
          cols[4]!,
          { key: 'reason', label: 'Lý do', render: (c) => <TextCell>{c.statusReason ?? '—'}</TextCell> },
          { key: 'until', label: 'Đến khi', render: (c) => <MutedCell>{c.statusUntil ? formatDate(c.statusUntil) : c.status === 'suspended' ? 'Vô thời hạn' : '—'}</MutedCell> },
          cols[7]!,
        ]}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: 'suspended', label: 'Tạm ngưng', count: summary.data?.suspended },
          { key: 'active', label: 'Hoạt động', count: summary.data?.active },
        ]}
        tab={tab}
        onTab={(k) => { setTab(k as 'suspended' | 'active'); setPage(1); }}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm cộng đồng...' }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={tab === 'suspended' ? 'Không có cộng đồng nào đang bị tạm ngưng.' : undefined}
        onRow={(c) => navigate(`/admin/communities/${c.id}`)}
        actions={(c) => actionsFor(c).filter((a) => ['Khôi phục', 'Tạm ngưng'].includes(a.label)).concat(actionsFor(c).filter((a) => a.label === 'Xem'))}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      <Card title="Khóa nhanh theo mã / slug" sub="Công cụ khóa/mở khóa cộng đồng có sẵn — dùng khi cần thao tác trực tiếp theo id hoặc slug." action={<button type="button" onClick={() => setShowLock((v) => !v)} className="h-9 rounded-[10px] border-[1.5px] border-[#e7e0da] bg-white px-3 text-[13px] font-semibold">{showLock ? 'Ẩn' : 'Mở công cụ'}</button>}>
        {showLock && <LockTab />}
      </Card>
      {modalEl}
    </>
  );
}

/* ============================== Xóa / Khôi phục ============================== */

export function CommunityTrash() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useTrash({ q: q || undefined, page, limit: LIMIT });
  const { label: categoryLabel } = useCategoryLabel();
  const [target, setTarget] = useState<TrashItem | null>(null);

  return (
    <>
      <PageHeader title="Xóa / Khôi phục" subtitle="Cộng đồng đã xóa được giữ 30 ngày trước khi xóa vĩnh viễn." />
      <DataTable<TrashItem>
        columns={[
          { key: 'name', label: 'Cộng đồng', w: 2, render: (c) => <MainCell name={c.name} sub={c.owner.name} shape="square" seed={c.id} /> },
          { key: 'id', label: 'Mã', render: (c) => <MonoCell>{c.id}</MonoCell> },
          { key: 'cat', label: 'Danh mục', render: (c) => <TextCell>{categoryLabel(c.category)}</TextCell> },
          { key: 'by', label: 'Xóa bởi', render: (c) => <TextCell>{c.deletedByOwner ? 'Chủ sở hữu' : (c.deletedBy?.name ?? '—')}</TextCell> },
          { key: 'date', label: 'Ngày xóa', render: (c) => <MutedCell>{formatDate(c.deletedAt)}</MutedCell> },
          { key: 'reason', label: 'Lý do', render: (c) => <TextCell>{c.reason ?? '—'}</TextCell> },
          { key: 'retention', label: 'Thời hạn lưu dữ liệu', render: (c) => <MutedCell>{c.daysLeft > 0 ? `Còn ${c.daysLeft} ngày` : 'Sắp xóa vĩnh viễn'}</MutedCell> },
          { key: 'status', label: 'Trạng thái', render: () => <StatusBadge tone="x">{COMMUNITY_STATUS.deleted.label}</StatusBadge> },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: 'Tìm cộng đồng đã xóa...' }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Chưa có cộng đồng nào bị xóa."
        actions={(c) => [{ label: 'Khôi phục cộng đồng', icon: 'restore', onClick: () => setTarget(c) }]}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {target && <UndeleteCommunityModal community={{ id: target.id, name: target.name }} info={trashInfo(target)} onClose={() => setTarget(null)} />}
    </>
  );
}

