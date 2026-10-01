import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCents, formatDate, formatDateTime } from '../../../lib/datetime';
import { ActionDialog, HistoryList, PreviewDialog, PreviewKv, PreviewSection, opts, useDialogSlot, useTableState } from '../components/Batch2Parts';
import { ChartCard, DecisionPanel, KpiGrid, KvCard, Row, TimelineCard, type KvItem, type TimelineItem } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, NumCell, TextCell, type Column, type RowAction } from '../components/DataTable';
import { InputField, TextAreaField } from '../components/overlay';
import { DateRangeChips, PageHeader, type RangeDays } from '../components/PageHeader';
import { AdminButton, Card, ErrorBlock, LoadingBlock, StatusBadge, fmtNum, type Tone } from '../components/ui';
import { useAdminAction, useAdminData, useAdminList } from '../queries.batch2';
import {
  CHARGEBACK_REASON,
  CHARGEBACK_STATUS,
  PAYOUT_STATUS,
  REFUND_REASONS,
  REFUND_STATUS,
  SUB_STATUS,
  TX_STATUS,
  methodLabel,
  type AdminChargeback,
  type AdminChargebackDetail,
  type AdminCreatorRevenue,
  type AdminPayout,
  type AdminPayoutDetail,
  type AdminRefund,
  type AdminRefundDetail,
  type AdminSubscription,
  type AdminTransaction,
  type AdminTransactionDetail,
  type ChargebackSummary,
  type CreatorDetail,
  type CreatorSummary,
  type PayoutSummary,
  type RefundSummary,
  type SubSummary,
  type TxSummary,
} from '../types.batch2';

const LIMIT = 20;
const meta2 = (m: { page: number; totalPages: number; total: number } | undefined, onPage: (p: number) => void) => (m ? { page: m.page, totalPages: m.totalPages, total: m.total, limit: LIMIT, onPage } : undefined);
/** Ngày bắt đầu (yyyy-mm-dd) — chỉ đổi theo ngày nên khóa query ổn định giữa các lần render. */
const rangeFrom = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const badge = (map: Record<string, { label: string; tone: Tone }>, k: string) => {
  const m = map[k] ?? { label: k, tone: 'x' as const };
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
};
const personCell = (p: { name: string; email: string; avatarUrl: string | null; id: string }) => <MainCell name={p.name} sub={p.email} avatarSrc={p.avatarUrl} seed={p.id} />;
const money = (c: number) => <NumCell>{formatCents(c)}</NumCell>;

/** "12.50" -> 1250 cent; sai định dạng -> null. */
const parseUsd = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
};
const toUsdInput = (cents: number) => (cents / 100).toFixed(2);

/* ================================ Hoàn tiền từ giao dịch ================================ */

function RefundTxDialog({ tx, onClose }: { tx: Pick<AdminTransaction, 'id' | 'code' | 'amountCents' | 'refundedCents'>; onClose: () => void }) {
  const act = useAdminAction();
  const remaining = tx.amountCents - tx.refundedCents;
  const [amount, setAmount] = useState(toUsdInput(remaining));
  const cents = parseUsd(amount);
  const bad = cents === null || cents < 1 || cents > remaining;
  return (
    <ActionDialog
      icon="undo"
      danger
      title={`Hoàn tiền ${tx.code}?`}
      body={`Còn có thể hoàn tối đa ${formatCents(remaining)}. Thao tác được ghi vào nhật ký.`}
      cta="Hoàn tiền"
      reasons={opts([...REFUND_REASONS])}
      requireReason
      noteLabel="Ghi chú nội bộ"
      disabledExtra={bad}
      successMessage="Đã hoàn tiền giao dịch"
      run={(v) => act.mutateAsync({ path: `/payments/transactions/${tx.id}/refund`, body: { reason: v.reason, note: v.note || undefined, amountCents: cents === remaining ? undefined : (cents ?? undefined) } })}
      onClose={onClose}
    >
      <InputField label="Số tiền hoàn (USD)" value={amount} onChange={setAmount} placeholder="0.00" />
      {bad && amount !== '' && <div className="-mt-2 text-xs text-[#b91c1c]">Nhập số tiền từ $0.01 đến {formatCents(remaining)}.</div>}
    </ActionDialog>
  );
}

/* ================================== Giao dịch ================================== */

export function TransactionsView() {
  const navigate = useNavigate();
  const [days, setDays] = useState<RangeDays>(30);
  const fromIso = rangeFrom(days);
  const t = useTableState({ status: '', method: '', kind: '', sort: '' }, '');
  const slot = useDialogSlot();
  const summary = useAdminData<TxSummary>('payments', '/payments/transactions/summary', { from: fromIso });
  const list = useAdminList<AdminTransaction>('payments-tx', '/payments/transactions', { q: t.q || undefined, status: t.f.status || undefined, method: t.f.method || undefined, kind: t.f.kind || undefined, sort: t.f.sort || undefined, from: fromIso, page: t.page, limit: LIMIT });
  const s = summary.data;

  const columns: Column<AdminTransaction>[] = [
    { key: 'code', label: 'Mã giao dịch', w: 1.1, render: (x) => <MonoCell>{x.code}</MonoCell> },
    { key: 'cust', label: 'Khách hàng', w: 1.6, render: (x) => personCell(x.customer) },
    { key: 'comm', label: 'Cộng đồng', w: 1.3, render: (x) => <TextCell>{x.community.name}</TextCell> },
    { key: 'prod', label: 'Sản phẩm', w: 1.3, render: (x) => <TextCell>{x.product.label}</TextCell> },
    { key: 'amt', label: 'Số tiền', w: 0.8, render: (x) => money(x.amountCents) },
    { key: 'fee', label: 'Phí nền tảng', w: 0.8, render: (x) => money(x.platformFeeCents) },
    { key: 'earn', label: 'Creator nhận', w: 0.9, render: (x) => money(x.creatorEarningsCents) },
    { key: 'method', label: 'Phương thức', w: 1.1, render: (x) => <TextCell>{x.paymentMethodLabel}</TextCell> },
    { key: 'status', label: 'Trạng thái', w: 1.25, render: (x) => badge(TX_STATUS, x.status) },
    { key: 'date', label: 'Ngày', w: 1.1, render: (x) => <MutedCell>{formatDateTime(x.createdAt)}</MutedCell> },
  ];
  const actions = (x: AdminTransaction): RowAction[] => {
    const a: RowAction[] = [{ label: 'Xem', onClick: () => navigate(`/admin/payments/tx/${x.id}`) }];
    if (x.status === 'succeeded') a.push({ label: 'Hoàn tiền', icon: 'undo', danger: true, onClick: () => slot.show((close) => <RefundTxDialog tx={x} onClose={close} />) });
    return a;
  };

  return (
    <>
      <PageHeader title="Giao dịch" subtitle="Mọi giao dịch được xử lý trên nền tảng." actions={<DateRangeChips value={days} onChange={setDays} />} />
      <KpiGrid
        min={160}
        items={[
          { icon: 'payments', label: 'Tổng giá trị giao dịch', value: s ? formatCents(s.grossVolumeCents) : '—' },
          { icon: 'account_balance_wallet', label: 'Doanh thu thuần', value: s ? formatCents(s.netRevenueCents) : '—' },
          { icon: 'receipt_long', label: 'Giao dịch', value: s ? fmtNum(s.transactions) : '—' },
          { icon: 'error', label: 'Thất bại', value: s ? `${s.failedRatePct}%` : '—', note: s ? `${fmtNum(s.failed)} giao dịch` : undefined, bad: true },
          { icon: 'undo', label: 'Hoàn tiền', value: s ? formatCents(s.refundsCents) : '—', bad: true },
        ]}
      />
      <DataTable<AdminTransaction>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(x) => x.id}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm mã giao dịch, khách hàng, cộng đồng...' }}
        filters={[
          { key: 'status', label: 'Trạng thái', value: t.f.status, options: Object.entries(TX_STATUS).map(([value, m]) => ({ value, label: m.label })), onChange: t.setFilter('status') },
          { key: 'method', label: 'Phương thức thanh toán', value: t.f.method, options: ['stripe', 'vnpay', 'momo'].map((value) => ({ value, label: methodLabel(value) })), onChange: t.setFilter('method') },
          { key: 'kind', label: 'Loại', value: t.f.kind, options: [{ value: 'initial', label: 'Lần đầu' }, { value: 'renewal', label: 'Gia hạn' }], onChange: t.setFilter('kind') },
          { key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'oldest', label: 'Cũ nhất' }, { value: 'amount', label: 'Số tiền cao nhất' }], onChange: t.setFilter('sort') },
        ]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(x) => navigate(`/admin/payments/tx/${x.id}`)}
        actions={actions}
        page={meta2(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

const TL_TITLE: Record<string, string> = { payment_captured: 'Đã thu tiền', payment_failed: 'Thanh toán thất bại', refunded: 'Đã hoàn tiền', chargeback: 'Tranh chấp thanh toán', checkout: 'Bắt đầu thanh toán' };

const TL_ICON: Record<string, { icon: string; tone: Tone }> = {
  payment_captured: { icon: 'check_circle', tone: 'g' },
  payment_failed: { icon: 'error', tone: 'r' },
  refunded: { icon: 'undo', tone: 'x' },
  chargeback: { icon: 'gavel', tone: 'r' },
  checkout: { icon: 'shopping_cart', tone: 'x' },
};

export function TransactionDetailView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const q = useAdminData<AdminTransactionDetail>('payments', `/payments/transactions/${id}`, undefined, !!id);
  const act = useAdminAction();
  const slot = useDialogSlot();
  const d = q.data;

  if (q.isPending) return <LoadingBlock />;
  if (q.isError || !d) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const retry = () =>
    slot.show((close) => <ActionDialog icon="refresh" title="Thử lại thanh toán?" body={`${d.code}. Cổng thanh toán sẽ được gọi lại.`} cta="Thử lại" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã gửi yêu cầu thử lại" run={(v) => act.mutateAsync({ path: `/payments/transactions/${d.id}/retry`, body: { note: v.note || undefined } })} onClose={close} />);

  const timeline: TimelineItem[] = d.timeline.map((x) => ({ icon: TL_ICON[x.type]?.icon ?? 'history', tone: TL_ICON[x.type]?.tone ?? 'x', who: TL_TITLE[x.type] ?? x.title, text: x.detail ?? '', time: formatDateTime(x.at) }));
  const info: KvItem[] = [
    { k: 'Mã giao dịch', v: d.code },
    { k: 'Trạng thái', v: TX_STATUS[d.status]?.label ?? d.status, badge: TX_STATUS[d.status]?.tone ?? 'x' },
    { k: 'Ngày', v: formatDateTime(d.createdAt) },
    { k: 'Sản phẩm', v: d.product.label },
    { k: 'Cộng đồng', v: d.community.name },
    { k: 'Tiền tệ', v: d.currency.toUpperCase() },
  ];
  const customer: KvItem[] = [
    { k: 'Tên', v: d.customerInfo.name },
    { k: 'Email', v: d.customerInfo.email },
    { k: 'Mã người dùng', v: d.customerInfo.id.slice(0, 8) },
    { k: 'Tham gia', v: formatDate(d.customerInfo.joinedAt) },
    { k: 'Trạng thái tài khoản', v: d.customerInfo.status },
  ];
  const creator: KvItem[] = [
    { k: 'Chủ sở hữu', v: d.creator?.name ?? d.community.ownerName },
    { k: 'Cộng đồng', v: d.community.name },
    { k: 'Creator nhận', v: formatCents(d.creatorEarningsCents) },
    ...(d.subscription ? [{ k: 'Gói đăng ký', v: SUB_STATUS[d.subscription.status]?.label ?? d.subscription.status, badge: SUB_STATUS[d.subscription.status]?.tone ?? ('x' as Tone) }] : []),
  ];
  const gateway: KvItem[] = [
    { k: 'Cổng thanh toán', v: d.gateway },
    { k: 'Mã tham chiếu', v: d.gatewayChargeId ?? '—' },
    { k: 'Phương thức', v: d.paymentMethodLabel },
    { k: 'Hóa đơn', v: d.invoiceNumber ?? '—' },
    { k: 'Phí cổng', v: formatCents(d.gatewayFeeCents) },
    { k: 'Đã hoàn', v: formatCents(d.refundedCents) },
    ...(d.failureReason ? [{ k: 'Lý do thất bại', v: d.failureReason }] : []),
  ];

  return (
    <>
      <PageHeader
        title={d.code}
        subtitle={`${d.product.label} · ${d.community.name}`}
        trail={[{ label: 'Giao dịch', to: '/admin/payments/tx' }, { label: d.code }]}
        actions={
          <>
            {d.status === 'succeeded' && (
              <AdminButton kind="danger" icon="undo" onClick={() => slot.show((close) => <RefundTxDialog tx={d} onClose={close} />)}>
                Hoàn tiền
              </AdminButton>
            )}
            {d.status === 'failed' && d.kind === 'initial' && (
              <AdminButton kind="primary" icon="refresh" onClick={retry}>
                Thử lại
              </AdminButton>
            )}
          </>
        }
      />
      <KpiGrid
        min={180}
        items={[
          { icon: 'payments', label: 'Số tiền', value: formatCents(d.amountCents) },
          { icon: 'percent', label: 'Phí nền tảng', value: formatCents(d.platformFeeCents) },
          { icon: 'account_balance_wallet', label: 'Creator nhận', value: formatCents(d.creatorEarningsCents) },
          { icon: 'credit_card', label: 'Phương thức thanh toán', value: d.paymentMethodLabel },
        ]}
      />
      <Row cols="1fr 1fr 1fr">
        <KvCard title="Thông tin giao dịch" items={info} />
        <KvCard title="Khách hàng" items={customer} link="Mở hồ sơ" onLink={() => navigate(`/admin/users/${d.customer.id}?tab=purchases`)} />
        <KvCard title="Creator" items={creator} link="Mở cộng đồng" onLink={() => navigate(`/admin/communities/${d.community.id}`)} />
      </Row>
      <Row cols="1.3fr 1fr">
        <TimelineCard title="Dòng thời gian thanh toán" items={timeline} empty="Chưa có sự kiện nào." />
        <KvCard title="Chi tiết thanh toán" items={gateway} />
      </Row>
      {(d.refunds.length > 0 || d.chargebacks.length > 0) && (
        <Card title="Hoàn tiền & tranh chấp">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {d.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                <b>{r.code}</b> · {formatCents(r.amountCents)} · {r.reason} {badge(REFUND_STATUS, r.status)}
                <button type="button" className="ml-auto border-0 bg-transparent text-[12.5px] font-semibold text-brand" onClick={() => navigate(`/admin/payments/refunds/${r.id}`)}>
                  Xem
                </button>
              </li>
            ))}
            {d.chargebacks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                <b>{c.code}</b> · {formatCents(c.amountCents)} · {CHARGEBACK_REASON[c.reason] ?? c.reason} {badge(CHARGEBACK_STATUS, c.status)}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Lịch sử quản trị">
        <HistoryList items={d.history} />
      </Card>
      {slot.el}
    </>
  );
}

/* ================================= Gói đăng ký ================================= */

export function SubscriptionsView() {
  const navigate = useNavigate();
  const t = useTableState({ sort: '' }, '');
  const summary = useAdminData<SubSummary>('payments', '/payments/subscriptions/summary');
  const list = useAdminList<AdminSubscription>('payments-subs', '/payments/subscriptions', { q: t.q || undefined, status: t.tab || undefined, sort: t.f.sort || undefined, page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/payments/subscriptions/${id}/${action}`, body });

  const pause = (x: AdminSubscription) =>
    slot.show((close) => <ActionDialog icon="pause_circle" title="Tạm dừng gói đăng ký?" body={`${x.code}. Thành viên mất quyền truy cập và gói không gia hạn cho đến khi tiếp tục.`} cta="Tạm dừng" reasons={opts(['Rủi ro thanh toán', 'Vi phạm chính sách', 'Theo yêu cầu', 'Khác'])} requireReason noteLabel="Ghi chú nội bộ" successMessage="Đã tạm dừng gói đăng ký" run={(v) => post(x.id, 'pause', { reason: v.reason, note: v.note || undefined })} onClose={close} />);
  const resume = (x: AdminSubscription) =>
    slot.show((close) => <ActionDialog icon="play_circle" title="Tiếp tục gói đăng ký?" body={`${x.code}. Thành viên được cấp lại quyền truy cập.`} cta="Tiếp tục" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã tiếp tục gói đăng ký" run={(v) => post(x.id, 'resume', { note: v.note || undefined })} onClose={close} />);
  const cancel = (x: AdminSubscription) =>
    slot.show((close) => (
      <ActionDialog
        icon="cancel"
        danger
        title="Hủy gói đăng ký?"
        body={`${x.code}. Người dùng sẽ được thông báo.`}
        cta="Hủy gói"
        reasons={opts(['Theo yêu cầu thành viên', 'Gian lận', 'Vi phạm chính sách', 'Khác'])}
        requireReason
        noteLabel="Ghi chú nội bộ"
        flagLabel="Chỉ hủy vào cuối kỳ hiện tại (giữ quyền truy cập đến hết kỳ)"
        flagDefault={false}
        successMessage="Đã hủy gói đăng ký"
        run={(v) => post(x.id, 'cancel', { reason: v.reason, note: v.note || undefined, atPeriodEnd: v.flag })}
        onClose={close}
      />
    ));

  const columns: Column<AdminSubscription>[] = [
    { key: 'code', label: 'Gói đăng ký', render: (x) => <MonoCell>{x.code}</MonoCell> },
    { key: 'user', label: 'Người dùng', w: 1.6, render: (x) => personCell(x.user) },
    { key: 'comm', label: 'Cộng đồng', w: 1.4, render: (x) => <TextCell>{x.community.name}</TextCell> },
    { key: 'plan', label: 'Gói', w: 0.8, render: (x) => <TextCell>{x.plan === 'trial' ? 'Dùng thử' : 'Trả phí'}</TextCell> },
    { key: 'amt', label: 'Số tiền', w: 0.8, render: (x) => money(x.amountCents) },
    { key: 'cycle', label: 'Chu kỳ', render: (x) => <TextCell>{x.billingCycle === 'annual' || x.billingCycle === 'yearly' ? 'Hàng năm' : x.billingCycle === 'monthly' ? 'Hàng tháng' : x.billingCycle}</TextCell> },
    { key: 'next', label: 'Kỳ thanh toán tới', render: (x) => <MutedCell>{x.nextBillingAt ? formatDate(x.nextBillingAt) : '—'}</MutedCell> },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (x) => (
        <div className="flex flex-col items-start gap-1">
          {badge(SUB_STATUS, x.status)}
          {x.cancelAtPeriodEnd && x.status === 'active' && <span className="text-[11px] text-stone-400">Hủy cuối kỳ</span>}
        </div>
      ),
    },
  ];
  const actions = (x: AdminSubscription): RowAction[] => {
    const a: RowAction[] = [{ label: 'Xem', onClick: () => navigate(`/admin/users/${x.user.id}?tab=purchases`) }];
    if (['trialing', 'active', 'past_due'].includes(x.status)) a.push({ label: 'Tạm dừng', icon: 'pause_circle', onClick: () => pause(x) });
    if (['paused', 'past_due'].includes(x.status)) a.push({ label: 'Tiếp tục', icon: 'play_circle', onClick: () => resume(x) });
    if (!['canceled', 'expired'].includes(x.status)) a.push({ label: 'Hủy', icon: 'cancel', danger: true, onClick: () => cancel(x) });
    return a;
  };

  return (
    <>
      <PageHeader title="Gói đăng ký" subtitle="Gói thành viên định kỳ trên mọi cộng đồng." />
      <KpiGrid
        min={160}
        items={[
          { icon: 'autorenew', label: 'Hoạt động', value: s ? fmtNum(s.active) : '—' },
          { icon: 'person_add', label: 'Mới', value: s ? fmtNum(s.new30d) : '—', note: '30 ngày qua' },
          { icon: 'payments', label: 'MRR', value: s ? formatCents(s.mrrCents) : '—' },
          { icon: 'trending_down', label: 'Tỷ lệ rời bỏ', value: s ? `${s.churnPct}%` : '—', bad: true },
          { icon: 'schedule', label: 'Quá hạn', value: s ? fmtNum(s.pastDue) : '—', bad: true },
        ]}
      />
      <DataTable<AdminSubscription>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(x) => x.id}
        tabs={[
          { key: '', label: 'Tất cả' },
          { key: 'active,trialing', label: 'Hoạt động', count: s?.active },
          { key: 'past_due', label: 'Quá hạn', count: s?.pastDue },
          { key: 'paused', label: 'Tạm dừng', count: s?.paused },
          { key: 'canceled,expired', label: 'Đã hủy' },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm gói đăng ký...' }}
        filters={[{ key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'amount', label: 'Số tiền cao nhất' }, { value: 'nextBilling', label: 'Kỳ thanh toán gần nhất' }], onChange: t.setFilter('sort') }]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        actions={actions}
        page={meta2(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Hoàn tiền ================================== */

const REJECT_REASONS = opts(['Ngoài thời hạn hoàn tiền', 'Đã sử dụng sản phẩm', 'Không đủ điều kiện', 'Yêu cầu trùng lặp', 'Khác']);

/** Modal duyệt hoàn tiền (có thể hoàn một phần). */
function ApproveRefundDialog({ refund, partial, defaultNote, onClose }: { refund: Pick<AdminRefund, 'id' | 'code' | 'amountCents'>; partial?: boolean; defaultNote?: string; onClose: () => void }) {
  const act = useAdminAction();
  const [amount, setAmount] = useState(toUsdInput(partial ? Math.round(refund.amountCents / 2) : refund.amountCents));
  const cents = parseUsd(amount);
  const bad = cents === null || cents < 1 || cents > refund.amountCents;
  return (
    <ActionDialog
      icon="check_circle"
      title={partial ? `Hoàn tiền một phần ${refund.code}` : `Duyệt hoàn tiền ${refund.code}?`}
      body={`Yêu cầu ${formatCents(refund.amountCents)}. Tiền được hoàn qua cổng thanh toán và khách hàng được thông báo.`}
      cta={partial ? 'Hoàn một phần' : 'Duyệt hoàn tiền'}
      noteLabel="Ghi chú quyết định"
      defaultNote={defaultNote}
      disabledExtra={bad}
      successMessage="Đã duyệt hoàn tiền"
      run={(v) => act.mutateAsync({ path: `/payments/refunds/${refund.id}/approve`, body: { note: v.note || undefined, amountCents: cents === refund.amountCents ? undefined : (cents ?? undefined) } })}
      onClose={onClose}
    >
      <InputField label="Số tiền hoàn (USD)" value={amount} onChange={setAmount} placeholder="0.00" />
      {bad && <div className="-mt-2 text-xs text-[#b91c1c]">Nhập số tiền từ $0.01 đến {formatCents(refund.amountCents)}.</div>}
    </ActionDialog>
  );
}

function RejectRefundDialog({ refund, defaultNote, onClose }: { refund: Pick<AdminRefund, 'id' | 'code'>; defaultNote?: string; onClose: () => void }) {
  const act = useAdminAction();
  return (
    <ActionDialog
      icon="block"
      danger
      title={`Từ chối ${refund.code}?`}
      body="Khách hàng sẽ được thông báo. Thao tác được ghi vào nhật ký."
      cta="Từ chối"
      reasons={REJECT_REASONS}
      requireReason
      noteLabel="Ghi chú quyết định"
      defaultNote={defaultNote}
      successMessage="Đã từ chối yêu cầu hoàn tiền"
      run={(v) => act.mutateAsync({ path: `/payments/refunds/${refund.id}/reject`, body: { reason: v.reason, note: v.note || undefined } })}
      onClose={onClose}
    />
  );
}

export function RefundsView() {
  const navigate = useNavigate();
  const t = useTableState({}, 'pending');
  const summary = useAdminData<RefundSummary>('payments', '/payments/refunds/summary');
  const list = useAdminList<AdminRefund>('payments-refunds', '/payments/refunds', { q: t.q || undefined, status: t.tab || undefined, page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const s = summary.data;

  const columns: Column<AdminRefund>[] = [
    { key: 'code', label: 'Mã hoàn tiền', render: (r) => <MonoCell>{r.code}</MonoCell> },
    { key: 'tx', label: 'Giao dịch', render: (r) => <MonoCell>{r.transactionCode}</MonoCell> },
    { key: 'cust', label: 'Khách hàng', w: 1.6, render: (r) => personCell(r.customer) },
    { key: 'creator', label: 'Creator', render: (r) => <TextCell>{r.creator?.name ?? '—'}</TextCell> },
    { key: 'amt', label: 'Số tiền', w: 0.8, render: (r) => money(r.amountCents) },
    { key: 'reason', label: 'Lý do', w: 1.5, render: (r) => <TextCell>{r.reason}</TextCell> },
    { key: 'status', label: 'Trạng thái', render: (r) => badge(REFUND_STATUS, r.status) },
    { key: 'at', label: 'Ngày yêu cầu', render: (r) => <MutedCell>{formatDate(r.requestedAt)}</MutedCell> },
  ];
  const actions = (r: AdminRefund): RowAction[] =>
    r.status === 'pending'
      ? [
          { label: 'Xem xét', onClick: () => navigate(`/admin/payments/refunds/${r.id}`) },
          { label: 'Duyệt hoàn tiền', icon: 'check_circle', onClick: () => slot.show((close) => <ApproveRefundDialog refund={r} onClose={close} />) },
          { label: 'Từ chối', icon: 'block', danger: true, onClick: () => slot.show((close) => <RejectRefundDialog refund={r} onClose={close} />) },
        ]
      : [{ label: 'Xem xét', onClick: () => navigate(`/admin/payments/refunds/${r.id}`) }];

  return (
    <>
      <PageHeader title="Hoàn tiền" subtitle="Yêu cầu hoàn tiền từ thành viên." />
      <DataTable<AdminRefund>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(r) => r.id}
        tabs={[
          { key: 'pending', label: 'Yêu cầu mới', count: s?.pending },
          { key: 'refunding', label: 'Đang hoàn tiền', count: s?.refunding },
          { key: 'approved', label: 'Hoàn tất', count: s?.approved },
          { key: 'rejected', label: 'Đã từ chối', count: s?.rejected },
          { key: '', label: 'Tất cả' },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm yêu cầu hoàn tiền...' }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Không có yêu cầu hoàn tiền nào."
        onRow={(r) => navigate(`/admin/payments/refunds/${r.id}`)}
        actions={actions}
        page={meta2(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

export function RefundDetailView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const q = useAdminData<AdminRefundDetail>('payments', `/payments/refunds/${id}`, undefined, !!id);
  const slot = useDialogSlot();
  const [note, setNote] = useState('');
  const d = q.data;

  if (q.isPending) return <LoadingBlock />;
  if (q.isError || !d) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const pending = d.status === 'pending';
  const hist = d.customerHistory;
  const custTimeline: TimelineItem[] = [
    { icon: 'person', who: d.customer.name, text: hist.memberSince ? `thành viên từ ${formatDate(hist.memberSince)}` : '', time: '', tone: 'b' },
    ...hist.previousRefunds.map((p) => ({ icon: 'undo', who: `${formatCents(p.amountCents)}`, text: REFUND_STATUS[p.status as keyof typeof REFUND_STATUS]?.label ?? p.status, time: formatDate(p.requestedAt), tone: 'x' as Tone })),
    { icon: 'flag', who: `${hist.reportsReceived} báo cáo`, text: 'trên tài khoản này', time: '', tone: hist.reportsReceived ? ('r' as Tone) : ('g' as Tone) },
  ];

  const paymentHistory: Column<AdminRefundDetail['paymentHistory'][number]>[] = [
    { key: 'code', label: 'Giao dịch', render: (p) => <MonoCell>{p.code}</MonoCell> },
    { key: 'amt', label: 'Số tiền', render: (p) => money(p.amountCents) },
    { key: 'st', label: 'Trạng thái', render: (p) => badge(TX_STATUS, p.status) },
  ];

  return (
    <>
      <PageHeader
        title={`Hoàn tiền ${d.code}`}
        subtitle={`${d.customer.name} · ${d.community.name}`}
        trail={[{ label: 'Hoàn tiền', to: '/admin/payments/refunds' }, { label: d.code }]}
        actions={
          <AdminButton icon="receipt_long" onClick={() => navigate(`/admin/payments/tx/${d.paymentId}`)}>
            Mở giao dịch
          </AdminButton>
        }
      />
      <Row cols="1fr 1fr 1fr">
        <KvCard
          title="Yêu cầu hoàn tiền"
          items={[
            { k: 'Mã hoàn tiền', v: d.code },
            { k: 'Giao dịch', v: d.transactionCode },
            { k: 'Số tiền', v: formatCents(d.amountCents) },
            { k: 'Lý do', v: d.reason },
            { k: 'Ngày yêu cầu', v: formatDateTime(d.requestedAt) },
            { k: 'Trạng thái', v: REFUND_STATUS[d.status].label, badge: REFUND_STATUS[d.status].tone },
            ...(d.resolvedBy ? [{ k: 'Xử lý bởi', v: d.resolvedBy.name }] : []),
            ...(d.note ? [{ k: 'Ghi chú', v: d.note }] : []),
          ]}
        />
        <DataTable<AdminRefundDetail['paymentHistory'][number]> title="Lịch sử thanh toán" columns={paymentHistory} rows={d.paymentHistory} rowKey={(p) => p.id} />
        <TimelineCard title="Lịch sử khách hàng" items={custTimeline} />
      </Row>
      <Row cols={d.creatorResponse ? '1fr 1fr' : '1fr'}>
        {d.creatorResponse && (
          <Card title="Phản hồi của creator" sub={formatDateTime(d.creatorResponse.at)}>
            <div className="rounded-xl bg-[#faf7f4] p-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">{d.creatorResponse.text}</div>
          </Card>
        )}
        <DecisionPanel
          title="Quyết định của quản trị"
          note={note}
          onNote={setNote}
          placeholder="Ghi chú quyết định gửi bộ phận tài chính..."
          buttons={[
            { label: 'Duyệt hoàn tiền', icon: 'check_circle', kind: 'primary', disabled: !pending, onClick: () => slot.show((close) => <ApproveRefundDialog refund={d} defaultNote={note} onClose={close} />) },
            { label: 'Hoàn một phần', icon: 'percent', disabled: !pending, onClick: () => slot.show((close) => <ApproveRefundDialog refund={d} partial defaultNote={note} onClose={close} />) },
            { label: 'Từ chối', icon: 'block', kind: 'danger', disabled: !pending, onClick: () => slot.show((close) => <RejectRefundDialog refund={d} defaultNote={note} onClose={close} />) },
          ]}
          done={!pending ? `Trạng thái cuối cùng: ${REFUND_STATUS[d.status].label}` : undefined}
          showNote={pending}
        />
      </Row>
      <Card title="Lịch sử quản trị">
        <HistoryList items={d.history} />
      </Card>
      {slot.el}
    </>
  );
}

/* ================================ Tranh chấp ================================ */

function EvidenceDialog({ cb, onClose }: { cb: AdminChargeback; onClose: () => void }) {
  const act = useAdminAction();
  const [urls, setUrls] = useState('');
  const list = urls.split('\n').map((x) => x.trim()).filter(Boolean);
  const badUrl = list.some((u) => !/^https?:\/\//i.test(u));
  return (
    <ActionDialog
      icon="upload_file"
      title={`Nộp bằng chứng ${cb.code}`}
      body={`Hạn chót ${formatDate(cb.deadlineAt)}${cb.daysLeft != null ? ` (còn ${cb.daysLeft} ngày)` : ''}.`}
      cta="Nộp bằng chứng"
      noteLabel="Nội dung bằng chứng"
      notePlaceholder="Mô tả bằng chứng: lịch sử truy cập, nhật ký sử dụng, trao đổi với khách..."
      requireNote
      disabledExtra={badUrl}
      successMessage="Đã nộp bằng chứng"
      run={(v) => act.mutateAsync({ path: `/payments/chargebacks/${cb.id}/submit-evidence`, body: { note: v.note, evidenceUrls: list.length ? list : undefined } })}
      onClose={onClose}
    >
      <TextAreaField label="Liên kết bằng chứng (mỗi dòng một URL, tùy chọn)" value={urls} onChange={setUrls} placeholder="https://..." />
      {badUrl && <div className="-mt-2 text-xs text-[#b91c1c]">Mỗi liên kết phải bắt đầu bằng http:// hoặc https://</div>}
    </ActionDialog>
  );
}

function ChargebackDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAdminData<AdminChargebackDetail>('payments', `/payments/chargebacks/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d ? `Tranh chấp ${d.code}` : 'Tranh chấp'} sub={d?.transactionCode} onClose={onClose}>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError || !d ? (
        <ErrorBlock error={q.error} />
      ) : (
        <>
          <PreviewKv
            items={[
              ['Khách hàng', d.customer.name],
              ['Creator', d.creator?.name],
              ['Cộng đồng', d.community.name],
              ['Số tiền', formatCents(d.amountCents)],
              ['Lý do', CHARGEBACK_REASON[d.reason] ?? d.reason],
              ['Trạng thái', badge(CHARGEBACK_STATUS, d.status)],
              ['Hạn chót', formatDate(d.deadlineAt)],
              ['Bằng chứng', d.evidence === 'submitted' ? 'Đã nộp' : 'Còn thiếu'],
              ['Mã tranh chấp cổng', d.gatewayDisputeId],
            ]}
          />
          {d.evidenceNote && (
            <PreviewSection title="Nội dung bằng chứng">
              <div className="rounded-xl bg-[#faf7f4] p-3.5 text-[13.5px] whitespace-pre-wrap">{d.evidenceNote}</div>
              {d.evidenceUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold break-all text-brand">
                  {u}
                </a>
              ))}
            </PreviewSection>
          )}
          <PreviewSection title="Lịch sử quản trị">
            <HistoryList items={d.history} />
          </PreviewSection>
        </>
      )}
    </PreviewDialog>
  );
}

export function ChargebacksView() {
  const t = useTableState({}, '');
  const summary = useAdminData<ChargebackSummary>('payments', '/payments/chargebacks/summary');
  const list = useAdminList<AdminChargeback>('payments-cb', '/payments/chargebacks', { q: t.q || undefined, status: t.tab || undefined, sort: 'deadline', page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/payments/chargebacks/${id}/${action}`, body });

  const accept = (c: AdminChargeback) =>
    slot.show((close) => <ActionDialog icon="handshake" danger title="Chấp nhận tranh chấp?" body={`${c.code}. Giao dịch được hoàn tiền ${formatCents(c.amountCents)} và thu hồi quyền truy cập. Tranh chấp tính là THUA.`} cta="Chấp nhận" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã chấp nhận tranh chấp" run={(v) => post(c.id, 'accept', { note: v.note || undefined })} onClose={close} />);
  const markWon = (c: AdminChargeback) =>
    slot.show((close) => <ActionDialog icon="emoji_events" title="Đánh dấu THẮNG?" body={c.code} cta="Đánh dấu thắng" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã đánh dấu thắng" run={(v) => post(c.id, 'mark-won', { note: v.note || undefined })} onClose={close} />);
  const markLost = (c: AdminChargeback) =>
    slot.show((close) => <ActionDialog icon="sentiment_dissatisfied" danger title="Đánh dấu THUA?" body={`${c.code}. Giao dịch sẽ được hoàn tiền và thu hồi quyền truy cập.`} cta="Đánh dấu thua" noteLabel="Ghi chú (tùy chọn)" successMessage="Đã đánh dấu thua" run={(v) => post(c.id, 'mark-lost', { note: v.note || undefined })} onClose={close} />);

  const columns: Column<AdminChargeback>[] = [
    { key: 'code', label: 'Vụ việc', render: (c) => <MonoCell>{c.code}</MonoCell> },
    { key: 'user', label: 'Người dùng', w: 1.6, render: (c) => personCell(c.customer) },
    { key: 'creator', label: 'Creator', render: (c) => <TextCell>{c.creator?.name ?? '—'}</TextCell> },
    { key: 'amt', label: 'Số tiền', render: (c) => money(c.amountCents) },
    { key: 'reason', label: 'Lý do', w: 1.4, render: (c) => <TextCell>{CHARGEBACK_REASON[c.reason] ?? c.reason}</TextCell> },
    { key: 'deadline', label: 'Hạn chót', render: (c) => <MutedCell>{c.daysLeft != null ? `Còn ${c.daysLeft} ngày` : '—'}</MutedCell> },
    { key: 'evidence', label: 'Bằng chứng', render: (c) => <TextCell>{c.evidence === 'submitted' ? 'Đã nộp' : 'Còn thiếu'}</TextCell> },
    { key: 'status', label: 'Trạng thái', render: (c) => badge(CHARGEBACK_STATUS, c.status) },
  ];
  const view = (c: AdminChargeback): RowAction => ({ label: 'Xem', onClick: () => slot.show((close) => <ChargebackDetailDialog id={c.id} onClose={close} />) });
  const actions = (c: AdminChargeback): RowAction[] => {
    if (c.status === 'open')
      return [
        { label: 'Nộp bằng chứng', icon: 'upload_file', onClick: () => slot.show((close) => <EvidenceDialog cb={c} onClose={close} />) },
        { label: 'Chấp nhận', icon: 'handshake', danger: true, onClick: () => accept(c) },
        view(c),
      ];
    if (c.status === 'under_review')
      return [
        { label: 'Đánh dấu thắng', icon: 'emoji_events', onClick: () => markWon(c) },
        { label: 'Đánh dấu thua', icon: 'sentiment_dissatisfied', danger: true, onClick: () => markLost(c) },
        { label: 'Chấp nhận', icon: 'handshake', danger: true, onClick: () => accept(c) },
        view(c),
      ];
    return [view(c)];
  };

  return (
    <>
      <PageHeader title="Tranh chấp thanh toán" subtitle="Tranh chấp do ngân hàng phát hành thẻ mở." />
      <KpiGrid
        min={170}
        items={[
          { icon: 'gavel', label: 'Đang mở', value: s ? fmtNum(s.open) : '—', bad: true },
          { icon: 'emoji_events', label: 'Thắng', value: s ? fmtNum(s.won) : '—' },
          { icon: 'sentiment_dissatisfied', label: 'Thua', value: s ? fmtNum(s.lost) : '—', bad: true },
          { icon: 'payments', label: 'Số tiền tranh chấp', value: s ? formatCents(s.disputedAmountCents) : '—', bad: true },
        ]}
      />
      <DataTable<AdminChargeback>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: 'Tất cả' },
          { key: 'open', label: 'Mở', count: s?.open },
          { key: 'under_review', label: 'Đang xem xét', count: s?.underReview },
          { key: 'won', label: 'Thắng', count: s?.won },
          { key: 'lost', label: 'Thua', count: s?.lost },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm tranh chấp...' }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Chưa có tranh chấp nào."
        onRow={(c) => slot.show((close) => <ChargebackDetailDialog id={c.id} onClose={close} />)}
        actions={actions}
        page={meta2(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ============================== Doanh thu creator ============================== */

export function CreatorsView() {
  const navigate = useNavigate();
  const [days, setDays] = useState<RangeDays>(30);
  const fromIso = rangeFrom(days);
  const t = useTableState({ sort: '' }, '');
  const summary = useAdminData<CreatorSummary>('payments', '/payments/creators/summary', { from: fromIso });
  const list = useAdminList<AdminCreatorRevenue>('payments-creators', '/payments/creators', { q: t.q || undefined, sort: t.f.sort || undefined, from: fromIso, page: t.page, limit: LIMIT });
  const s = summary.data;

  const columns: Column<AdminCreatorRevenue>[] = [
    { key: 'creator', label: 'Creator', w: 1.6, render: (c) => personCell(c.creator) },
    { key: 'comms', label: 'Cộng đồng', w: 0.7, render: (c) => <NumCell>{c.communities}</NumCell> },
    { key: 'gross', label: 'Doanh thu gộp', render: (c) => money(c.grossCents) },
    { key: 'ref', label: 'Hoàn tiền', render: (c) => money(c.refundsCents) },
    { key: 'fee', label: 'Phí nền tảng', render: (c) => money(c.platformFeeCents) },
    { key: 'net', label: 'Thu nhập thuần', render: (c) => money(c.netCents) },
    { key: 'pend', label: 'Số dư chờ', render: (c) => money(c.pendingBalanceCents) },
    { key: 'wd', label: 'Có thể rút', render: (c) => money(c.withdrawableCents ?? 0) },
    { key: 'held', label: 'Đang giữ', render: (c) => money(c.heldCents ?? 0) },
    { key: 'rsv', label: 'Dự phòng', render: (c) => money(c.reserveCents ?? 0) },
    { key: 'debt', label: 'Nợ', render: (c) => ((c.debtCents ?? 0) > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCents(c.debtCents ?? 0)}</span> : money(0)) },
  ];

  return (
    <>
      <PageHeader title="Doanh thu creator" subtitle="Thu nhập của chủ cộng đồng sau phí và hoàn tiền." actions={<DateRangeChips value={days} onChange={setDays} />} />
      {s && (
        <KpiGrid
          min={160}
          items={[
            { icon: 'storefront', label: 'Creator', value: fmtNum(s.creators) },
            { icon: 'payments', label: 'Doanh thu gộp', value: formatCents(s.grossCents) },
            { icon: 'percent', label: 'Phí nền tảng', value: formatCents(s.platformFeeCents) },
            { icon: 'account_balance_wallet', label: 'Thu nhập thuần', value: formatCents(s.netCents) },
            { icon: 'hourglass_top', label: 'Số dư chờ', value: formatCents(s.pendingBalanceCents) },
            ...(s.withdrawableCents !== undefined ? [{ icon: 'savings', label: 'Có thể rút', value: formatCents(s.withdrawableCents) }] : []),
            ...(s.heldCents !== undefined ? [{ icon: 'lock_clock', label: 'Đang giữ (holding)', value: formatCents(s.heldCents) }] : []),
            ...(s.reserveCents !== undefined ? [{ icon: 'shield', label: 'Quỹ dự phòng', value: formatCents(s.reserveCents) }] : []),
            ...(s.debtCents !== undefined ? [{ icon: 'warning', label: 'Nợ creator', value: formatCents(s.debtCents), bad: s.debtCents > 0 }] : []),
          ]}
        />
      )}
      <DataTable<AdminCreatorRevenue>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.creator.id}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm creator...' }}
        filters={[{ key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'gross', label: 'Doanh thu gộp' }, { value: 'pending', label: 'Số dư chờ' }, { value: 'name', label: 'Tên A–Z' }], onChange: t.setFilter('sort') }]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => navigate(`/admin/payments/creator/${c.creator.id}`)}
        page={meta2(list.data?.meta, t.setPage)}
      />
    </>
  );
}

const payoutMethod = (p: AdminPayout) => <TextCell>{p.method.label}</TextCell>;

export function CreatorDetailView() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState<RangeDays>(30);
  const fromIso = rangeFrom(days);
  const q = useAdminData<CreatorDetail>('payments', `/payments/creators/${userId}`, { from: fromIso }, !!userId);
  const d = q.data;

  const txCols: Column<AdminTransaction>[] = [
    { key: 'code', label: 'Mã giao dịch', render: (x) => <MonoCell>{x.code}</MonoCell> },
    { key: 'cust', label: 'Khách hàng', w: 1.6, render: (x) => personCell(x.customer) },
    { key: 'prod', label: 'Sản phẩm', render: (x) => <TextCell>{x.product.label}</TextCell> },
    { key: 'amt', label: 'Số tiền', render: (x) => money(x.amountCents) },
    { key: 'earn', label: 'Creator nhận', render: (x) => money(x.creatorEarningsCents) },
    { key: 'st', label: 'Trạng thái', render: (x) => badge(TX_STATUS, x.status) },
    { key: 'date', label: 'Ngày', render: (x) => <MutedCell>{formatDate(x.createdAt)}</MutedCell> },
  ];
  const poCols: Column<AdminPayout>[] = [
    { key: 'code', label: 'Mã chi trả', render: (p) => <MonoCell>{p.code}</MonoCell> },
    { key: 'comm', label: 'Cộng đồng', render: (p) => <TextCell>{p.community.name}</TextCell> },
    { key: 'amt', label: 'Số tiền', render: (p) => money(p.amountCents) },
    { key: 'method', label: 'Phương thức', render: payoutMethod },
    { key: 'st', label: 'Trạng thái', render: (p) => badge(PAYOUT_STATUS, p.status) },
  ];
  const commCols: Column<CreatorDetail['communities'][number]>[] = [
    { key: 'name', label: 'Cộng đồng', w: 1.6, render: (c) => <MainCell name={c.name} shape="square" seed={c.id} /> },
    { key: 'gross', label: 'Doanh thu gộp', render: (c) => money(c.grossCents) },
    { key: 'net', label: 'Thu nhập thuần', render: (c) => money(c.netCents) },
    { key: 'pend', label: 'Số dư chờ', render: (c) => money(c.pendingBalanceCents) },
    { key: 'wd', label: 'Có thể rút', render: (c) => money(c.withdrawableCents ?? 0) },
    { key: 'held', label: 'Đang giữ', render: (c) => money(c.heldCents ?? 0) },
    { key: 'rsv', label: 'Dự phòng', render: (c) => money(c.reserveCents ?? 0) },
    { key: 'debt', label: 'Nợ', render: (c) => money(c.debtCents ?? 0) },
  ];

  return (
    <>
      <PageHeader
        title={d?.creator.name ?? 'Creator'}
        subtitle={d ? `Doanh thu creator · ${d.creator.email}` : undefined}
        trail={[{ label: 'Doanh thu creator', to: '/admin/payments/creator' }, { label: d?.creator.name ?? '…' }]}
        actions={<DateRangeChips value={days} onChange={setDays} />}
      />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {d && (
        <>
          <KpiGrid
            min={160}
            items={[
              { icon: 'payments', label: 'Doanh thu gộp', value: formatCents(d.kpis.grossCents) },
              { icon: 'undo', label: 'Hoàn tiền', value: formatCents(d.kpis.refundsCents), bad: true },
              { icon: 'percent', label: 'Phí nền tảng', value: formatCents(d.kpis.platformFeeCents) },
              { icon: 'account_balance_wallet', label: 'Thu nhập thuần', value: formatCents(d.kpis.netCents) },
              { icon: 'hourglass_top', label: 'Số dư chờ', value: formatCents(d.kpis.pendingBalanceCents) },
              ...(d.kpis.withdrawableCents !== undefined ? [{ icon: 'savings', label: 'Có thể rút', value: formatCents(d.kpis.withdrawableCents) }] : []),
              ...(d.kpis.heldCents !== undefined ? [{ icon: 'lock_clock', label: 'Đang giữ (holding)', value: formatCents(d.kpis.heldCents) }] : []),
              ...(d.kpis.reserveCents !== undefined ? [{ icon: 'shield', label: 'Quỹ dự phòng', value: formatCents(d.kpis.reserveCents) }] : []),
              ...(d.kpis.debtCents !== undefined ? [{ icon: 'warning', label: 'Nợ creator', value: formatCents(d.kpis.debtCents), bad: d.kpis.debtCents > 0 }] : []),
            ]}
          />
          <ChartCard
            title={`Doanh thu · ${d.creator.name}`}
            labels={d.series.map((x) => formatDate(x.date).slice(0, 5))}
            fmt={(v) => `$${Math.round(v / 100).toLocaleString('en-US')}`}
            series={[
              { name: 'Gộp', values: d.series.map((x) => x.grossCents) },
              { name: 'Thuần', values: d.series.map((x) => x.netCents) },
              { name: 'Hoàn tiền', values: d.series.map((x) => x.refundsCents), color: '#dc2626' },
            ]}
          />
          <DataTable<CreatorDetail['communities'][number]> title="Cộng đồng" columns={commCols} rows={d.communities} rowKey={(c) => c.id} onRow={(c) => navigate(`/admin/communities/${c.id}`)} emptyText="Creator chưa có cộng đồng nào." />
          <DataTable<AdminTransaction> title="Lịch sử giao dịch" sub="20 giao dịch gần nhất" columns={txCols} rows={d.transactions} rowKey={(x) => x.id} onRow={(x) => navigate(`/admin/payments/tx/${x.id}`)} emptyText="Chưa có giao dịch nào." />
          <DataTable<AdminPayout> title="Chi trả" sub="10 khoản gần nhất" columns={poCols} rows={d.payouts} rowKey={(p) => p.id} emptyText="Chưa có khoản chi trả nào." />
        </>
      )}
    </>
  );
}

/* ================================== Chi trả ================================== */

function PayoutDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAdminData<AdminPayoutDetail>('payments', `/payments/payouts/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d ? `Chi trả ${d.code}` : 'Chi trả'} sub={d?.creator.name} onClose={onClose}>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError || !d ? (
        <ErrorBlock error={q.error} />
      ) : (
        <>
          <PreviewKv
            items={[
              ['Creator', `${d.creator.name} (${d.creator.email})`],
              ['Cộng đồng', d.community.name],
              ['Số tiền', formatCents(d.amountCents)],
              ['Phương thức', d.method.label],
              ['Trạng thái', badge(PAYOUT_STATUS, d.status)],
              ['Lịch chi trả', formatDate(d.scheduledFor)],
              ['Đã chi trả', d.paidAt ? formatDateTime(d.paidAt) : '—'],
              ...(d.failureReason ? ([['Lý do thất bại', d.failureReason]] as [string, ReactNode][]) : []),
              ...(d.note ? ([['Ghi chú', d.note]] as [string, ReactNode][]) : []),
            ]}
          />
          <PreviewSection title="Số dư creator">
            <PreviewKv
              items={[
                ['Thu nhập thuần', formatCents(d.creatorBalance.netCents)],
                ['Đã yêu cầu rút', formatCents(d.creatorBalance.requestedCents)],
                ['Net − đã yêu cầu', formatCents(d.creatorBalance.availableCents)],
                ...(d.creatorBalance.withdrawableCents !== undefined
                  ? ([
                      ['Có thể rút ngay', formatCents(d.creatorBalance.withdrawableCents)],
                      ['Đang giữ' + (d.creatorBalance.holdDays ? ` (${d.creatorBalance.holdDays} ngày)` : ''), formatCents(d.creatorBalance.heldCents ?? 0)],
                      ['Quỹ dự phòng', formatCents(d.creatorBalance.reserveCents ?? 0)],
                      ['Nợ (hoàn tiền sau khi rút)', formatCents(d.creatorBalance.debtCents ?? 0)],
                    ] as [string, ReactNode][])
                  : []),
              ]}
            />
          </PreviewSection>
          <PreviewSection title="Lịch sử quản trị">
            <HistoryList items={d.history} />
          </PreviewSection>
        </>
      )}
    </PreviewDialog>
  );
}

export function PayoutsView() {
  const t = useTableState({ sort: '' }, '');
  const summary = useAdminData<PayoutSummary>('payments', '/payments/payouts/summary');
  const list = useAdminList<AdminPayout>('payments-payouts', '/payments/payouts', { q: t.q || undefined, status: t.tab || undefined, sort: t.f.sort || undefined, page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/payments/payouts/${id}/${action}`, body });

  const simple = (p: AdminPayout, action: string, icon: string, title: string, cta: string, ok: string, body?: string) =>
    slot.show((close) => <ActionDialog icon={icon} title={title} body={body ?? `${p.code} · ${formatCents(p.amountCents)} · ${p.creator.name}`} cta={cta} noteLabel="Ghi chú (tùy chọn)" successMessage={ok} run={(v) => post(p.id, action, { note: v.note || undefined })} onClose={close} />);
  const withReason = (p: AdminPayout, action: string, icon: string, title: string, cta: string, ok: string, reasons: string[], danger = true) =>
    slot.show((close) => <ActionDialog icon={icon} danger={danger} title={title} body={`${p.code} · ${formatCents(p.amountCents)} · ${p.creator.name}`} cta={cta} reasons={opts(reasons)} requireReason noteLabel="Ghi chú nội bộ" successMessage={ok} run={(v) => post(p.id, action, { reason: v.reason, note: v.note || undefined })} onClose={close} />);

  const approve = (p: AdminPayout) => simple(p, 'approve', 'check_circle', 'Duyệt chi trả?', 'Duyệt', 'Đã duyệt chi trả (đang xử lý)');
  const markPaid = (p: AdminPayout) => simple(p, 'mark-paid', 'paid', 'Đánh dấu đã chi trả?', 'Đã chi trả', 'Đã đánh dấu đã chi trả');
  const release = (p: AdminPayout) => simple(p, 'release', 'lock_open', 'Giải ngân khoản đang giữ?', 'Giải ngân', 'Đã giải ngân');
  const retry = (p: AdminPayout) => simple(p, 'retry', 'refresh', 'Thử lại chi trả?', 'Thử lại', 'Đã đưa chi trả về hàng xử lý');
  const hold = (p: AdminPayout) => withReason(p, 'hold', 'pause_circle', 'Tạm giữ chi trả?', 'Tạm giữ', 'Đã tạm giữ chi trả', ['Nghi ngờ gian lận', 'Đang có tranh chấp', 'Cần xác minh tài khoản', 'Khác'], false);
  const reject = (p: AdminPayout) => withReason(p, 'reject', 'block', 'Từ chối chi trả?', 'Từ chối', 'Đã từ chối chi trả (hoàn số dư)', ['Thông tin tài khoản không hợp lệ', 'Gian lận', 'Vi phạm chính sách', 'Khác']);
  const markFailed = (p: AdminPayout) => withReason(p, 'mark-failed', 'error', 'Đánh dấu thất bại?', 'Đánh dấu thất bại', 'Đã đánh dấu thất bại', ['Tài khoản ngân hàng bị từ chối', 'Lỗi cổng thanh toán', 'Khác']);

  const columns: Column<AdminPayout>[] = [
    { key: 'code', label: 'Mã chi trả', render: (p) => <MonoCell>{p.code}</MonoCell> },
    { key: 'creator', label: 'Creator', w: 1.6, render: (p) => personCell(p.creator) },
    { key: 'amt', label: 'Số tiền', render: (p) => money(p.amountCents) },
    { key: 'method', label: 'Phương thức', w: 1.2, render: payoutMethod },
    { key: 'sched', label: 'Lịch chi trả', render: (p) => <MutedCell>{formatDate(p.scheduledFor)}</MutedCell> },
    { key: 'paid', label: 'Đã chi', render: (p) => <MutedCell>{p.paidAt ? formatDate(p.paidAt) : '—'}</MutedCell> },
    { key: 'status', label: 'Trạng thái', render: (p) => badge(PAYOUT_STATUS, p.status) },
  ];
  const review = (p: AdminPayout): RowAction => ({ label: 'Xem xét', onClick: () => slot.show((close) => <PayoutDetailDialog id={p.id} onClose={close} />) });
  const actions = (p: AdminPayout): RowAction[] => {
    switch (p.status) {
      case 'requested':
        return [review(p), { label: 'Duyệt', icon: 'check_circle', onClick: () => approve(p) }, { label: 'Đã chi trả', icon: 'paid', onClick: () => markPaid(p) }, { label: 'Tạm giữ', icon: 'pause_circle', onClick: () => hold(p) }, { label: 'Từ chối', icon: 'block', danger: true, onClick: () => reject(p) }];
      case 'approved':
        return [review(p), { label: 'Đã chi trả', icon: 'paid', onClick: () => markPaid(p) }, { label: 'Đánh dấu thất bại', icon: 'error', onClick: () => markFailed(p) }, { label: 'Tạm giữ', icon: 'pause_circle', onClick: () => hold(p) }, { label: 'Từ chối', icon: 'block', danger: true, onClick: () => reject(p) }];
      case 'failed':
        return [{ label: 'Thử lại', icon: 'refresh', onClick: () => retry(p) }, review(p), { label: 'Tạm giữ', icon: 'pause_circle', onClick: () => hold(p) }, { label: 'Từ chối', icon: 'block', danger: true, onClick: () => reject(p) }];
      case 'on_hold':
        return [{ label: 'Giải ngân', icon: 'lock_open', onClick: () => release(p) }, review(p), { label: 'Từ chối', icon: 'block', danger: true, onClick: () => reject(p) }];
      default:
        return [review(p)];
    }
  };

  return (
    <>
      <PageHeader title="Chi trả" subtitle="Chuyển tiền cho creator vào ngày 1 và 16 hàng tháng." />
      <KpiGrid
        min={170}
        items={[
          { icon: 'hourglass_top', label: 'Đang chờ', value: s ? formatCents(s.pendingCents) : '—' },
          { icon: 'sync', label: 'Đang xử lý', value: s ? formatCents(s.processingCents) : '—' },
          { icon: 'check_circle', label: 'Đã chi trả', value: s ? formatCents(s.paidCents) : '—' },
          { icon: 'pause_circle', label: 'Tạm giữ', value: s ? formatCents(s.onHoldCents) : '—' },
          { icon: 'error', label: 'Thất bại', value: s ? formatCents(s.failedCents) : '—', bad: true },
        ]}
      />
      <DataTable<AdminPayout>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(p) => p.id}
        tabs={[
          { key: '', label: 'Tất cả' },
          { key: 'requested', label: 'Đang chờ', count: s?.counts.requested },
          { key: 'approved', label: 'Đang xử lý', count: s?.counts.approved },
          { key: 'paid', label: 'Đã chi trả', count: s?.counts.paid },
          { key: 'failed', label: 'Thất bại', count: s?.counts.failed },
          { key: 'on_hold', label: 'Tạm giữ', count: s?.counts.on_hold },
          { key: 'rejected', label: 'Đã từ chối', count: s?.counts.rejected },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm khoản chi trả...' }}
        filters={[{ key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'amount', label: 'Số tiền cao nhất' }, { value: 'scheduled', label: 'Theo lịch chi trả' }], onChange: t.setFilter('sort') }]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Không có khoản chi trả nào."
        actions={actions}
        page={meta2(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

