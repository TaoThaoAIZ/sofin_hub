import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatCents, formatDate, formatRelative } from '../../../lib/datetime';
import { RejectCommunityModal, RequestChangesModal, UndeleteCommunityModal, trashInfo } from '../components/ActionModals';
import { ChecklistCard, DecisionPanel, KvCard, Row, type ChecklistItem } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, TextCell } from '../components/DataTable';
import { useCategoryLabel, useCommunityActions } from '../components/communityActions';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge, errMessage, fmtNum } from '../components/ui';
import { ModalShell, useToast } from '../components/overlay';
import { LockTab } from '../components/AdminTabs';
import { Card } from '../components/ui';
import { useAdminCommunities, useApproveCommunity, useCommunitySummary, useReviewQueue, useTrash } from '../queries';
import { COMMUNITY_STATUS, PRICING_LABEL, type ReviewQueueItem, type TrashItem } from '../types';
import { communityColumns } from './CommunitiesList';

const LIMIT = 20;

/* ============================== Xét duyệt ============================== */

export function CommunityReview() {
  const { t } = useTranslation('admin-pages1');
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const queue = useReviewQueue({ page, limit: LIMIT });
  const approve = useApproveCommunity();
  const { label: categoryLabel } = useCategoryLabel();
  const [note, setNote] = useState('');
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<'approve' | 'changes' | 'reject' | null>(null);

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
      { key: 'profile', label: t('queues.review.cl.profile'), sub: s.hasThumbnail ? t('queues.review.cl.profileOk') : t('queues.review.cl.profileMissing'), checked: s.hasThumbnail, auto: true },
      { key: 'desc', label: t('queues.review.cl.desc'), sub: t(s.descriptionLength >= 50 ? 'queues.review.cl.descOk' : 'queues.review.cl.descShort', { n: fmtNum(s.descriptionLength) }), checked: s.descriptionLength >= 50, auto: true },
      { key: 'quality', label: t('queues.review.cl.quality'), sub: t('queues.review.cl.qualitySub'), checked: !!manual[`${m.id}:quality`] },
      { key: 'policy', label: t('queues.review.cl.policy'), sub: t('queues.review.cl.policySub'), checked: !!manual[`${m.id}:policy`] },
      {
        key: 'owner',
        label: t('queues.review.cl.owner'),
        sub: t('queues.review.cl.ownerSub', { days: fmtNum(s.ownerAccountAgeDays), n: s.ownerCommunities }),
        checked: s.ownerAccountAgeDays >= 30,
        auto: true,
        flag: s.ownerAccountAgeDays >= 365 ? { text: t('queues.review.cl.trusted'), tone: 'g' } : undefined,
      },
      {
        key: 'violations',
        label: t('queues.review.cl.violations'),
        sub: s.ownerViolations90d > 0 ? t('queues.review.cl.violationsSub', { n: s.ownerViolations90d }) : t('queues.review.cl.none'),
        checked: s.ownerViolations90d === 0,
        auto: true,
        flag: s.ownerViolations90d > 0 ? { text: t('queues.review.cl.medium'), tone: 'o' } : undefined,
      },
    ];
  };

  const decided = sel && sel.status === 'changes_requested' ? t('queues.review.decided') : '';
  const ref = sel ? { id: sel.id, name: sel.name } : null;

  return (
    <>
      <PageHeader title={t('queues.review.title')} subtitle={t('queues.review.subtitle')} />
      <Row cols="1fr 1.2fr">
        <DataTable<ReviewQueueItem>
          title={t('queues.review.queue')}
          sub={queue.data ? t('queues.review.waiting', { n: fmtNum(queue.data.meta.total) }) : undefined}
          columns={[
            { key: 'name', label: t('queues.review.colCommunity'), w: 2, render: (c) => <MainCell name={c.name} sub={(c.owner?.name ?? '—')} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
            { key: 'submitted', label: t('queues.review.colSubmitted'), render: (c) => <MutedCell>{formatRelative(c.submittedAt)}</MutedCell> },
            { key: 'status', label: t('queues.review.colStatus'), render: (c) => <StatusBadge tone={COMMUNITY_STATUS[c.status].tone}>{COMMUNITY_STATUS[c.status].label}</StatusBadge> },
          ]}
          rows={items}
          rowKey={(c) => c.id}
          loading={queue.isPending}
          error={queue.isError ? queue.error : null}
          onRetry={() => void queue.refetch()}
          emptyText={t('queues.review.empty')}
          onRow={(c) => select(c.id)}
          isActive={(c) => c.id === sel?.id}
          page={queue.data ? { page: queue.data.meta.page, totalPages: queue.data.meta.totalPages, total: queue.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
        />
        {sel && (
          <KvCard
            title={t('queues.review.preview')}
            link={t('queues.review.openCommunity')}
            onLink={() => navigate(`/admin/communities/${sel.id}`)}
            items={[
              { k: t('queues.review.kvName'), v: sel.name },
              { k: t('queues.review.kvOwner'), v: (sel.owner?.name ?? '—') },
              { k: t('queues.review.kvDesc'), v: sel.description || '—' },
              { k: t('queues.review.kvCategory'), v: categoryLabel(sel.category) },
              { k: t('queues.review.kvPrice'), v: sel.pricing === 'free' ? PRICING_LABEL.free : t('queues.review.perMonth', { price: formatCents(sel.priceUsd) }) },
              { k: t('queues.review.kvMembers'), v: fmtNum(sel.members) },
              { k: t('queues.review.kvCreated'), v: formatDate(sel.createdAt) },
              { k: t('queues.review.kvStatus'), v: COMMUNITY_STATUS[sel.status].label, badge: COMMUNITY_STATUS[sel.status].tone },
            ]}
          />
        )}
      </Row>
      {sel && ref && (
        <Row cols="1fr 1fr">
          <ChecklistCard title={t('queues.review.checklist')} items={checklist(sel)} onToggle={(k) => setManual((m) => ({ ...m, [`${sel.id}:${k}`]: !m[`${sel.id}:${k}`] }))} />
          <DecisionPanel
            title={t('queues.review.decision')}
            note={note}
            onNote={setNote}
            placeholder={t('queues.review.notePlaceholder')}
            done={decided}
            buttons={[
              {
                label: t('queues.review.approve'),
                icon: 'check_circle',
                kind: 'primary',
                disabled: approve.isPending,
                onClick: () => setModal('approve'),
              },
              { label: t('queues.review.requestChanges'), icon: 'edit_note', disabled: sel.status !== 'pending_review', onClick: () => setModal('changes') },
              { label: t('queues.review.reject'), icon: 'block', kind: 'danger', onClick: () => setModal('reject') },
            ]}
          />
        </Row>
      )}
      {modal === 'approve' && sel && (
        <ModalShell
          icon="check_circle"
          title={t('queues.review.approveTitle')}
          body={t('queues.review.approveBody', { name: sel.name })}
          cta={t('queues.review.approve')}
          pending={approve.isPending}
          error={approve.isError ? errMessage(approve.error) : null}
          onClose={() => { approve.reset(); setModal(null); }}
          onConfirm={() =>
            approve.mutate(
              { id: sel.id, note: note.trim() || undefined },
              { onSuccess: () => { toast.success(t('queues.review.approved', { name: sel.name })); setNote(''); setModal(null); } },
            )
          }
        />
      )}
      {modal === 'changes' && ref && <RequestChangesModal community={ref} onClose={() => setModal(null)} />}
      {modal === 'reject' && ref && <RejectCommunityModal community={ref} onClose={() => setModal(null)} />}
    </>
  );
}

/* ============================== Tạm ngưng ============================== */

export function CommunitySuspended() {
  const { t } = useTranslation('admin-pages1');
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
      <PageHeader title={t('queues.suspended.title')} subtitle={t('queues.suspended.subtitle')} />
      <DataTable
        columns={[
          cols[0]!,
          cols[1]!,
          cols[2]!,
          cols[4]!,
          { key: 'reason', label: t('queues.suspended.colReason'), render: (c) => <TextCell>{c.statusReason ?? '—'}</TextCell> },
          { key: 'until', label: t('queues.suspended.colUntil'), render: (c) => <MutedCell>{c.statusUntil ? formatDate(c.statusUntil) : c.status === 'suspended' ? t('queues.suspended.indefinite') : '—'}</MutedCell> },
          cols[7]!,
        ]}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: 'suspended', label: t('queues.suspended.tabSuspended'), count: summary.data?.suspended },
          { key: 'active', label: t('queues.suspended.tabActive'), count: summary.data?.active },
        ]}
        tab={tab}
        onTab={(k) => { setTab(k as 'suspended' | 'active'); setPage(1); }}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('queues.suspended.search') }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={tab === 'suspended' ? t('queues.suspended.empty') : undefined}
        onRow={(c) => navigate(`/admin/communities/${c.id}`)}
        actions={(c) => actionsFor(c).filter((a) => a.icon === 'restore' || a.icon === 'pause_circle').concat(actionsFor(c).filter((a) => !a.icon))}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      <Card title={t('queues.suspended.quickLock')} sub={t('queues.suspended.quickLockSub')} action={<button type="button" onClick={() => setShowLock((v) => !v)} className="h-9 rounded-[10px] border-[1.5px] border-[#e7e0da] bg-white px-3 text-[13px] font-semibold">{showLock ? t('queues.suspended.hide') : t('queues.suspended.openTool')}</button>}>
        {showLock && <LockTab />}
      </Card>
      {modalEl}
    </>
  );
}

/* ============================== Xóa / Khôi phục ============================== */

export function CommunityTrash() {
  const { t } = useTranslation('admin-pages1');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useTrash({ q: q || undefined, page, limit: LIMIT });
  const { label: categoryLabel } = useCategoryLabel();
  const [target, setTarget] = useState<TrashItem | null>(null);

  return (
    <>
      <PageHeader title={t('queues.trash.title')} subtitle={t('queues.trash.subtitle')} />
      <DataTable<TrashItem>
        columns={[
          { key: 'name', label: t('queues.trash.colCommunity'), w: 2, render: (c) => <MainCell name={c.name} sub={(c.owner?.name ?? '—')} shape="square" seed={c.id} /> },
          { key: 'id', label: t('queues.trash.colId'), render: (c) => <MonoCell>{c.id}</MonoCell> },
          { key: 'cat', label: t('queues.trash.colCategory'), render: (c) => <TextCell>{categoryLabel(c.category)}</TextCell> },
          { key: 'by', label: t('queues.trash.colDeletedBy'), render: (c) => <TextCell>{c.deletedByOwner ? t('queues.trash.owner') : (c.deletedBy?.name ?? '—')}</TextCell> },
          { key: 'date', label: t('queues.trash.colDate'), render: (c) => <MutedCell>{formatDate(c.deletedAt)}</MutedCell> },
          { key: 'reason', label: t('queues.trash.colReason'), render: (c) => <TextCell>{c.reason ?? '—'}</TextCell> },
          { key: 'retention', label: t('queues.trash.colRetention'), render: (c) => <MutedCell>{c.daysLeft > 0 ? t('queues.trash.daysLeft', { count: c.daysLeft }) : t('queues.trash.soon')}</MutedCell> },
          { key: 'status', label: t('queues.trash.colStatus'), render: () => <StatusBadge tone="x">{COMMUNITY_STATUS.deleted.label}</StatusBadge> },
        ]}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t('queues.trash.search') }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('queues.trash.empty')}
        actions={(c) => [{ label: t('queues.trash.restore'), icon: 'restore', onClick: () => setTarget(c) }]}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: setPage } : undefined}
      />
      {target && <UndeleteCommunityModal community={{ id: target.id, name: target.name }} info={trashInfo(target)} onClose={() => setTarget(null)} />}
    </>
  );
}

