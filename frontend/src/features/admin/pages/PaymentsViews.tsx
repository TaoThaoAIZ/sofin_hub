import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('admin-payments');
  const act = useAdminAction();
  const remaining = tx.amountCents - tx.refundedCents;
  const [amount, setAmount] = useState(toUsdInput(remaining));
  const cents = parseUsd(amount);
  const bad = cents === null || cents < 1 || cents > remaining;
  return (
    <ActionDialog
      icon="undo"
      danger
      title={t('refundTx.title', { code: tx.code })}
      body={t('refundTx.body', { amount: formatCents(remaining) })}
      cta={t('common.refund')}
      reasons={opts([...REFUND_REASONS])}
      requireReason
      noteLabel={t('common.internalNote')}
      disabledExtra={bad}
      successMessage={t('refundTx.done')}
      run={(v) => act.mutateAsync({ path: `/payments/transactions/${tx.id}/refund`, body: { reason: v.reason, note: v.note || undefined, amountCents: cents === remaining ? undefined : (cents ?? undefined) } })}
      onClose={onClose}
    >
      <InputField label={t('common.refundAmountUsd')} value={amount} onChange={setAmount} placeholder="0.00" />
      {bad && amount !== '' && <div className="-mt-2 text-xs text-[#b91c1c]">{t('common.amountRange', { max: formatCents(remaining) })}</div>}
    </ActionDialog>
  );
}

/* ================================== Giao dịch ================================== */

export function TransactionsView() {
  const { t } = useTranslation('admin-payments');
  const navigate = useNavigate();
  const [days, setDays] = useState<RangeDays>(30);
  const fromIso = rangeFrom(days);
  const ts = useTableState({ status: '', method: '', kind: '', sort: '' }, '');
  const slot = useDialogSlot();
  const summary = useAdminData<TxSummary>('payments', '/payments/transactions/summary', { from: fromIso });
  const list = useAdminList<AdminTransaction>('payments-tx', '/payments/transactions', { q: ts.q || undefined, status: ts.f.status || undefined, method: ts.f.method || undefined, kind: ts.f.kind || undefined, sort: ts.f.sort || undefined, from: fromIso, page: ts.page, limit: LIMIT });
  const s = summary.data;

  const columns: Column<AdminTransaction>[] = [
    { key: 'code', label: t('common.txId'), w: 1.1, render: (x) => <MonoCell>{x.code}</MonoCell> },
    { key: 'cust', label: t('common.customer'), w: 1.6, render: (x) => personCell(x.customer) },
    { key: 'comm', label: t('common.community'), w: 1.3, render: (x) => <TextCell>{x.community.name}</TextCell> },
    { key: 'prod', label: t('common.product'), w: 1.3, render: (x) => <TextCell>{x.product.label}</TextCell> },
    { key: 'amt', label: t('common.amount'), w: 0.8, render: (x) => money(x.amountCents) },
    { key: 'fee', label: t('common.platformFee'), w: 0.8, render: (x) => money(x.platformFeeCents) },
    { key: 'earn', label: t('common.creatorEarnings'), w: 0.9, render: (x) => money(x.creatorEarningsCents) },
    { key: 'method', label: t('common.method'), w: 1.1, render: (x) => <TextCell>{x.paymentMethodLabel}</TextCell> },
    { key: 'status', label: t('common.status'), w: 1.25, render: (x) => badge(TX_STATUS, x.status) },
    { key: 'date', label: t('common.date'), w: 1.1, render: (x) => <MutedCell>{formatDateTime(x.createdAt)}</MutedCell> },
  ];
  const actions = (x: AdminTransaction): RowAction[] => {
    const a: RowAction[] = [{ label: t('common.view'), onClick: () => navigate(`/admin/payments/tx/${x.id}`) }];
    if (x.status === 'succeeded') a.push({ label: t('common.refund'), icon: 'undo', danger: true, onClick: () => slot.show((close) => <RefundTxDialog tx={x} onClose={close} />) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('common.transactionsTitle')} subtitle={t('tx.pageSubtitle')} actions={<DateRangeChips value={days} onChange={setDays} />} />
      <KpiGrid
        min={160}
        items={[
          { icon: 'payments', label: t('tx.grossVolume'), value: s ? formatCents(s.grossVolumeCents) : '—' },
          { icon: 'account_balance_wallet', label: t('tx.netRevenue'), value: s ? formatCents(s.netRevenueCents) : '—' },
          { icon: 'receipt_long', label: t('common.transactionsTitle'), value: s ? fmtNum(s.transactions) : '—' },
          { icon: 'error', label: t('common.failed'), value: s ? `${s.failedRatePct}%` : '—', note: s ? t('transactions.failedNote', { n: fmtNum(s.failed) }) : undefined, bad: true },
          { icon: 'undo', label: t('common.refundsTitle'), value: s ? formatCents(s.refundsCents) : '—', bad: true },
        ]}
      />
      <DataTable<AdminTransaction>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(x) => x.id}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('tx.searchPlaceholder') }}
        filters={[
          { key: 'status', label: t('common.status'), value: ts.f.status, options: Object.entries(TX_STATUS).map(([value, m]) => ({ value, label: m.label })), onChange: ts.setFilter('status') },
          { key: 'method', label: t('tx.paymentMethod'), value: ts.f.method, options: ['stripe', 'vnpay', 'momo'].map((value) => ({ value, label: methodLabel(value) })), onChange: ts.setFilter('method') },
          { key: 'kind', label: t('tx.type'), value: ts.f.kind, options: [{ value: 'initial', label: t('tx.initial') }, { value: 'renewal', label: t('tx.renewal') }], onChange: ts.setFilter('kind') },
          { key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'oldest', label: t('tx.oldest') }, { value: 'amount', label: t('tx.highestAmount') }], onChange: ts.setFilter('sort') },
        ]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(x) => navigate(`/admin/payments/tx/${x.id}`)}
        actions={actions}
        page={meta2(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

const TL_TITLE: Record<string, string> = { payment_captured: 'timeline.paymentCaptured', payment_failed: 'timeline.paymentFailed', refunded: 'timeline.refunded', chargeback: 'timeline.chargeback', checkout: 'timeline.checkout' };

const TL_ICON: Record<string, { icon: string; tone: Tone }> = {
  payment_captured: { icon: 'check_circle', tone: 'g' },
  payment_failed: { icon: 'error', tone: 'r' },
  refunded: { icon: 'undo', tone: 'x' },
  chargeback: { icon: 'gavel', tone: 'r' },
  checkout: { icon: 'shopping_cart', tone: 'x' },
};

export function TransactionDetailView() {
  const { t } = useTranslation('admin-payments');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const q = useAdminData<AdminTransactionDetail>('payments', `/payments/transactions/${id}`, undefined, !!id);
  const act = useAdminAction();
  const slot = useDialogSlot();
  const d = q.data;

  if (q.isPending) return <LoadingBlock />;
  if (q.isError || !d) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const retry = () =>
    slot.show((close) => <ActionDialog icon="refresh" title={t('detail.retryTitle')} body={t('detail.retryBody', { code: d.code })} cta={t('common.retry')} noteLabel={t('common.noteOptional')} successMessage={t('detail.retrySent')} run={(v) => act.mutateAsync({ path: `/payments/transactions/${d.id}/retry`, body: { note: v.note || undefined } })} onClose={close} />);

  const timeline: TimelineItem[] = d.timeline.map((x) => ({ icon: TL_ICON[x.type]?.icon ?? 'history', tone: TL_ICON[x.type]?.tone ?? 'x', who: TL_TITLE[x.type] ? t(TL_TITLE[x.type]!) : x.title, text: x.detail ?? '', time: formatDateTime(x.at) }));
  const info: KvItem[] = [
    { k: t('common.txId'), v: d.code },
    { k: t('common.status'), v: TX_STATUS[d.status]?.label ?? d.status, badge: TX_STATUS[d.status]?.tone ?? 'x' },
    { k: t('common.date'), v: formatDateTime(d.createdAt) },
    { k: t('common.product'), v: d.product.label },
    { k: t('common.community'), v: d.community.name },
    { k: t('detail.currency'), v: d.currency.toUpperCase() },
  ];
  const customer: KvItem[] = [
    { k: t('detail.name'), v: d.customerInfo.name },
    { k: 'Email', v: d.customerInfo.email },
    { k: t('detail.userId'), v: d.customerInfo.id.slice(0, 8) },
    { k: t('detail.joined'), v: formatDate(d.customerInfo.joinedAt) },
    { k: t('detail.accountStatus'), v: d.customerInfo.status },
  ];
  const creator: KvItem[] = [
    { k: t('detail.owner'), v: d.creator?.name ?? d.community.ownerName },
    { k: t('common.community'), v: d.community.name },
    { k: t('common.creatorEarnings'), v: formatCents(d.creatorEarningsCents) },
    ...(d.subscription ? [{ k: t('detail.subscription'), v: SUB_STATUS[d.subscription.status]?.label ?? d.subscription.status, badge: SUB_STATUS[d.subscription.status]?.tone ?? ('x' as Tone) }] : []),
  ];
  const gateway: KvItem[] = [
    { k: t('detail.gateway'), v: d.gateway },
    { k: t('detail.referenceId'), v: d.gatewayChargeId ?? '—' },
    { k: t('common.method'), v: d.paymentMethodLabel },
    { k: t('detail.invoice'), v: d.invoiceNumber ?? '—' },
    { k: t('detail.gatewayFee'), v: formatCents(d.gatewayFeeCents) },
    { k: t('common.refundedAmount'), v: formatCents(d.refundedCents) },
    ...(d.failureReason ? [{ k: t('detail.failureReason'), v: d.failureReason }] : []),
  ];

  return (
    <>
      <PageHeader
        title={d.code}
        subtitle={`${d.product.label} · ${d.community.name}`}
        trail={[{ label: t('common.transactionsTitle'), to: '/admin/payments/tx' }, { label: d.code }]}
        actions={
          <>
            {d.status === 'succeeded' && (
              <AdminButton kind="danger" icon="undo" onClick={() => slot.show((close) => <RefundTxDialog tx={d} onClose={close} />)}>
                {t('common.refund')}
              </AdminButton>
            )}
            {d.status === 'failed' && d.kind === 'initial' && (
              <AdminButton kind="primary" icon="refresh" onClick={retry}>
                {t('common.retry')}
              </AdminButton>
            )}
          </>
        }
      />
      <KpiGrid
        min={180}
        items={[
          { icon: 'payments', label: t('common.amount'), value: formatCents(d.amountCents) },
          { icon: 'percent', label: t('common.platformFee'), value: formatCents(d.platformFeeCents) },
          { icon: 'account_balance_wallet', label: t('common.creatorEarnings'), value: formatCents(d.creatorEarningsCents) },
          { icon: 'credit_card', label: t('tx.paymentMethod'), value: d.paymentMethodLabel },
        ]}
      />
      <Row cols="1fr 1fr 1fr">
        <KvCard title={t('detail.txInfo')} items={info} />
        <KvCard title={t('common.customer')} items={customer} link={t('detail.openProfile')} onLink={() => navigate(`/admin/users/${d.customer.id}?tab=purchases`)} />
        <KvCard title={t('common.creator')} items={creator} link={t('detail.openCommunity')} onLink={() => navigate(`/admin/communities/${d.community.id}`)} />
      </Row>
      <Row cols="1.3fr 1fr">
        <TimelineCard title={t('detail.timeline')} items={timeline} empty={t('detail.noEvents')} />
        <KvCard title={t('detail.paymentDetails')} items={gateway} />
      </Row>
      {(d.refunds.length > 0 || d.chargebacks.length > 0) && (
        <Card title={t('detail.refundsAndDisputes')}>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {d.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                <b>{r.code}</b> · {formatCents(r.amountCents)} · {r.reason} {badge(REFUND_STATUS, r.status)}
                <button type="button" className="ml-auto border-0 bg-transparent text-[12.5px] font-semibold text-brand" onClick={() => navigate(`/admin/payments/refunds/${r.id}`)}>
                  {t('common.view')}
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
      <Card title={t('common.history')}>
        <HistoryList items={d.history} />
      </Card>
      {slot.el}
    </>
  );
}

/* ================================= Gói đăng ký ================================= */

export function SubscriptionsView() {
  const { t } = useTranslation('admin-payments');
  const navigate = useNavigate();
  const ts = useTableState({ sort: '' }, '');
  const summary = useAdminData<SubSummary>('payments', '/payments/subscriptions/summary');
  const list = useAdminList<AdminSubscription>('payments-subs', '/payments/subscriptions', { q: ts.q || undefined, status: ts.tab || undefined, sort: ts.f.sort || undefined, page: ts.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/payments/subscriptions/${id}/${action}`, body });

  const pause = (x: AdminSubscription) =>
    slot.show((close) => <ActionDialog icon="pause_circle" title={t('subs.pauseTitle')} body={t('subs.pauseBody', { code: x.code })} cta={t('common.pause')} reasons={opts([t('subs.reasonPaymentRisk'), t('subs.reasonPolicy'), t('subs.reasonOnRequest'), t('common.other')])} requireReason noteLabel={t('common.internalNote')} successMessage={t('subs.paused')} run={(v) => post(x.id, 'pause', { reason: v.reason, note: v.note || undefined })} onClose={close} />);
  const resume = (x: AdminSubscription) =>
    slot.show((close) => <ActionDialog icon="play_circle" title={t('subs.resumeTitle')} body={t('subs.resumeBody', { code: x.code })} cta={t('common.resume')} noteLabel={t('common.noteOptional')} successMessage={t('subs.resumed')} run={(v) => post(x.id, 'resume', { note: v.note || undefined })} onClose={close} />);
  const cancel = (x: AdminSubscription) =>
    slot.show((close) => (
      <ActionDialog
        icon="cancel"
        danger
        title={t('subs.cancelTitle')}
        body={t('subs.cancelBody', { code: x.code })}
        cta={t('subs.cancelCta')}
        reasons={opts([t('subs.reasonMemberRequest'), t('subs.reasonFraud'), t('subs.reasonPolicy'), t('common.other')])}
        requireReason
        noteLabel={t('common.internalNote')}
        flagLabel={t('subs.atPeriodEnd')}
        flagDefault={false}
        successMessage={t('subs.canceled')}
        run={(v) => post(x.id, 'cancel', { reason: v.reason, note: v.note || undefined, atPeriodEnd: v.flag })}
        onClose={close}
      />
    ));

  const columns: Column<AdminSubscription>[] = [
    { key: 'code', label: t('detail.subscription'), render: (x) => <MonoCell>{x.code}</MonoCell> },
    { key: 'user', label: t('common.user'), w: 1.6, render: (x) => personCell(x.user) },
    { key: 'comm', label: t('common.community'), w: 1.4, render: (x) => <TextCell>{x.community.name}</TextCell> },
    { key: 'plan', label: t('subs.plan'), w: 0.8, render: (x) => <TextCell>{x.plan === 'trial' ? t('subs.trial') : t('subs.paid')}</TextCell> },
    { key: 'amt', label: t('common.amount'), w: 0.8, render: (x) => money(x.amountCents) },
    { key: 'cycle', label: t('subs.cycle'), render: (x) => <TextCell>{x.billingCycle === 'annual' || x.billingCycle === 'yearly' ? t('subs.yearly') : x.billingCycle === 'monthly' ? t('subs.monthly') : x.billingCycle}</TextCell> },
    { key: 'next', label: t('subs.nextBilling'), render: (x) => <MutedCell>{x.nextBillingAt ? formatDate(x.nextBillingAt) : '—'}</MutedCell> },
    {
      key: 'status',
      label: t('common.status'),
      render: (x) => (
        <div className="flex flex-col items-start gap-1">
          {badge(SUB_STATUS, x.status)}
          {x.cancelAtPeriodEnd && x.status === 'active' && <span className="text-[11px] text-stone-400">{t('subs.cancelsAtEnd')}</span>}
        </div>
      ),
    },
  ];
  const actions = (x: AdminSubscription): RowAction[] => {
    const a: RowAction[] = [{ label: t('common.view'), onClick: () => navigate(`/admin/users/${x.user.id}?tab=purchases`) }];
    if (['trialing', 'active', 'past_due'].includes(x.status)) a.push({ label: t('common.pause'), icon: 'pause_circle', onClick: () => pause(x) });
    if (['paused', 'past_due'].includes(x.status)) a.push({ label: t('common.resume'), icon: 'play_circle', onClick: () => resume(x) });
    if (!['canceled', 'expired'].includes(x.status)) a.push({ label: t('common.cancel'), icon: 'cancel', danger: true, onClick: () => cancel(x) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('detail.subscription')} subtitle={t('subs.pageSubtitle')} />
      <KpiGrid
        min={160}
        items={[
          { icon: 'autorenew', label: t('common.active'), value: s ? fmtNum(s.active) : '—' },
          { icon: 'person_add', label: t('subs.new'), value: s ? fmtNum(s.new30d) : '—', note: t('subs.last30d') },
          { icon: 'payments', label: 'MRR', value: s ? formatCents(s.mrrCents) : '—' },
          { icon: 'trending_down', label: t('subs.churn'), value: s ? `${s.churnPct}%` : '—', bad: true },
          { icon: 'schedule', label: t('common.pastDue'), value: s ? fmtNum(s.pastDue) : '—', bad: true },
        ]}
      />
      <DataTable<AdminSubscription>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(x) => x.id}
        tabs={[
          { key: '', label: t('common.all') },
          { key: 'active,trialing', label: t('common.active'), count: s?.active },
          { key: 'past_due', label: t('common.pastDue'), count: s?.pastDue },
          { key: 'paused', label: t('common.pauseTab'), count: s?.paused },
          { key: 'canceled,expired', label: t('common.canceled') },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('subs.searchPlaceholder') }}
        filters={[{ key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'amount', label: t('tx.highestAmount') }, { value: 'nextBilling', label: t('subs.nearestBilling') }], onChange: ts.setFilter('sort') }]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        actions={actions}
        page={meta2(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Hoàn tiền ================================== */

/** Modal duyệt hoàn tiền (có thể hoàn một phần). */
function ApproveRefundDialog({ refund, partial, defaultNote, onClose }: { refund: Pick<AdminRefund, 'id' | 'code' | 'amountCents'>; partial?: boolean; defaultNote?: string; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const act = useAdminAction();
  const [amount, setAmount] = useState(toUsdInput(partial ? Math.round(refund.amountCents / 2) : refund.amountCents));
  const cents = parseUsd(amount);
  const bad = cents === null || cents < 1 || cents > refund.amountCents;
  return (
    <ActionDialog
      icon="check_circle"
      title={partial ? t('refunds.partialTitle', { code: refund.code }) : t('refunds.approveTitle', { code: refund.code })}
      body={t('refunds.approveBody', { amount: formatCents(refund.amountCents) })}
      cta={partial ? t('refunds.partialCta') : t('refunds.approveCta')}
      noteLabel={t('common.decisionNote')}
      defaultNote={defaultNote}
      disabledExtra={bad}
      successMessage={t('refunds.approved')}
      run={(v) => act.mutateAsync({ path: `/payments/refunds/${refund.id}/approve`, body: { note: v.note || undefined, amountCents: cents === refund.amountCents ? undefined : (cents ?? undefined) } })}
      onClose={onClose}
    >
      <InputField label={t('common.refundAmountUsd')} value={amount} onChange={setAmount} placeholder="0.00" />
      {bad && <div className="-mt-2 text-xs text-[#b91c1c]">{t('common.amountRange', { max: formatCents(refund.amountCents) })}</div>}
    </ActionDialog>
  );
}

function RejectRefundDialog({ refund, defaultNote, onClose }: { refund: Pick<AdminRefund, 'id' | 'code'>; defaultNote?: string; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const act = useAdminAction();
  return (
    <ActionDialog
      icon="block"
      danger
      title={t('refunds.rejectTitle', { code: refund.code })}
      body={t('refunds.rejectBody')}
      cta={t('common.reject')}
      reasons={opts([t('refunds.reasonOutsideWindow'), t('refunds.reasonUsed'), t('refunds.reasonNotEligible'), t('refunds.reasonDuplicate'), t('common.other')])}
      requireReason
      noteLabel={t('common.decisionNote')}
      defaultNote={defaultNote}
      successMessage={t('refunds.rejected')}
      run={(v) => act.mutateAsync({ path: `/payments/refunds/${refund.id}/reject`, body: { reason: v.reason, note: v.note || undefined } })}
      onClose={onClose}
    />
  );
}

export function RefundsView() {
  const { t } = useTranslation('admin-payments');
  const navigate = useNavigate();
  const ts = useTableState({}, 'pending');
  const summary = useAdminData<RefundSummary>('payments', '/payments/refunds/summary');
  const list = useAdminList<AdminRefund>('payments-refunds', '/payments/refunds', { q: ts.q || undefined, status: ts.tab || undefined, page: ts.page, limit: LIMIT });
  const slot = useDialogSlot();
  const s = summary.data;

  const columns: Column<AdminRefund>[] = [
    { key: 'code', label: t('refunds.refundId'), render: (r) => <MonoCell>{r.code}</MonoCell> },
    { key: 'tx', label: t('refunds.transactionCol'), render: (r) => <MonoCell>{r.transactionCode}</MonoCell> },
    { key: 'cust', label: t('common.customer'), w: 1.6, render: (r) => personCell(r.customer) },
    { key: 'creator', label: t('common.creator'), render: (r) => <TextCell>{r.creator?.name ?? '—'}</TextCell> },
    { key: 'amt', label: t('common.amount'), w: 0.8, render: (r) => money(r.amountCents) },
    { key: 'reason', label: t('common.reason'), w: 1.5, render: (r) => <TextCell>{r.reason}</TextCell> },
    { key: 'status', label: t('common.status'), render: (r) => badge(REFUND_STATUS, r.status) },
    { key: 'at', label: t('refunds.requestDate'), render: (r) => <MutedCell>{formatDate(r.requestedAt)}</MutedCell> },
  ];
  const actions = (r: AdminRefund): RowAction[] =>
    r.status === 'pending'
      ? [
          { label: t('common.review'), onClick: () => navigate(`/admin/payments/refunds/${r.id}`) },
          { label: t('refunds.approveCta'), icon: 'check_circle', onClick: () => slot.show((close) => <ApproveRefundDialog refund={r} onClose={close} />) },
          { label: t('common.reject'), icon: 'block', danger: true, onClick: () => slot.show((close) => <RejectRefundDialog refund={r} onClose={close} />) },
        ]
      : [{ label: t('common.review'), onClick: () => navigate(`/admin/payments/refunds/${r.id}`) }];

  return (
    <>
      <PageHeader title={t('common.refundsTitle')} subtitle={t('refunds.pageSubtitle')} />
      <DataTable<AdminRefund>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(r) => r.id}
        tabs={[
          { key: 'pending', label: t('refunds.tabNew'), count: s?.pending },
          { key: 'refunding', label: t('refunds.tabRefunding'), count: s?.refunding },
          { key: 'approved', label: t('refunds.tabCompleted'), count: s?.approved },
          { key: 'rejected', label: t('common.rejected'), count: s?.rejected },
          { key: '', label: t('common.all') },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('refunds.searchPlaceholder') }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('refunds.empty')}
        onRow={(r) => navigate(`/admin/payments/refunds/${r.id}`)}
        actions={actions}
        page={meta2(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

export function RefundDetailView() {
  const { t } = useTranslation('admin-payments');
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
    { icon: 'person', who: d.customer.name, text: hist.memberSince ? t('refunds.memberSince', { date: formatDate(hist.memberSince) }) : '', time: '', tone: 'b' },
    ...hist.previousRefunds.map((p) => ({ icon: 'undo', who: `${formatCents(p.amountCents)}`, text: REFUND_STATUS[p.status as keyof typeof REFUND_STATUS]?.label ?? p.status, time: formatDate(p.requestedAt), tone: 'x' as Tone })),
    { icon: 'flag', who: t('refunds.reports', { count: hist.reportsReceived }), text: t('refunds.onThisAccount'), time: '', tone: hist.reportsReceived ? ('r' as Tone) : ('g' as Tone) },
  ];

  const paymentHistory: Column<AdminRefundDetail['paymentHistory'][number]>[] = [
    { key: 'code', label: t('refunds.transactionCol'), render: (p) => <MonoCell>{p.code}</MonoCell> },
    { key: 'amt', label: t('common.amount'), render: (p) => money(p.amountCents) },
    { key: 'st', label: t('common.status'), render: (p) => badge(TX_STATUS, p.status) },
  ];

  return (
    <>
      <PageHeader
        title={t('refunds.detailTitle', { code: d.code })}
        subtitle={`${d.customer.name} · ${d.community.name}`}
        trail={[{ label: t('common.refundsTitle'), to: '/admin/payments/refunds' }, { label: d.code }]}
        actions={
          <AdminButton icon="receipt_long" onClick={() => navigate(`/admin/payments/tx/${d.paymentId}`)}>
            {t('refunds.openTransaction')}
          </AdminButton>
        }
      />
      <Row cols="1fr 1fr 1fr">
        <KvCard
          title={t('refunds.requestCard')}
          items={[
            { k: t('refunds.refundId'), v: d.code },
            { k: t('refunds.transactionCol'), v: d.transactionCode },
            { k: t('common.amount'), v: formatCents(d.amountCents) },
            { k: t('common.reason'), v: d.reason },
            { k: t('refunds.requestDate'), v: formatDateTime(d.requestedAt) },
            { k: t('common.status'), v: REFUND_STATUS[d.status].label, badge: REFUND_STATUS[d.status].tone },
            ...(d.resolvedBy ? [{ k: t('refunds.handledBy'), v: d.resolvedBy.name }] : []),
            ...(d.note ? [{ k: t('common.note'), v: d.note }] : []),
          ]}
        />
        <DataTable<AdminRefundDetail['paymentHistory'][number]> title={t('refunds.paymentHistory')} columns={paymentHistory} rows={d.paymentHistory} rowKey={(p) => p.id} />
        <TimelineCard title={t('refunds.customerHistory')} items={custTimeline} />
      </Row>
      <Row cols={d.creatorResponse ? '1fr 1fr' : '1fr'}>
        {d.creatorResponse && (
          <Card title={t('refunds.creatorResponse')} sub={formatDateTime(d.creatorResponse.at)}>
            <div className="rounded-xl bg-[#faf7f4] p-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">{d.creatorResponse.text}</div>
          </Card>
        )}
        <DecisionPanel
          title={t('refunds.adminDecision')}
          note={note}
          onNote={setNote}
          placeholder={t('refunds.decisionPlaceholder')}
          buttons={[
            { label: t('refunds.approveCta'), icon: 'check_circle', kind: 'primary', disabled: !pending, onClick: () => slot.show((close) => <ApproveRefundDialog refund={d} defaultNote={note} onClose={close} />) },
            { label: t('refunds.partialCta'), icon: 'percent', disabled: !pending, onClick: () => slot.show((close) => <ApproveRefundDialog refund={d} partial defaultNote={note} onClose={close} />) },
            { label: t('common.reject'), icon: 'block', kind: 'danger', disabled: !pending, onClick: () => slot.show((close) => <RejectRefundDialog refund={d} defaultNote={note} onClose={close} />) },
          ]}
          done={!pending ? t('refunds.finalStatus', { status: REFUND_STATUS[d.status].label }) : undefined}
          showNote={pending}
        />
      </Row>
      <Card title={t('common.history')}>
        <HistoryList items={d.history} />
      </Card>
      {slot.el}
    </>
  );
}

/* ================================ Tranh chấp ================================ */

function EvidenceDialog({ cb, onClose }: { cb: AdminChargeback; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const act = useAdminAction();
  const [urls, setUrls] = useState('');
  const list = urls.split('\n').map((x) => x.trim()).filter(Boolean);
  const badUrl = list.some((u) => !/^https?:\/\//i.test(u));
  return (
    <ActionDialog
      icon="upload_file"
      title={t('chargebacks.evidenceTitle', { code: cb.code })}
      body={cb.daysLeft != null ? t('chargebacks.deadlineWithDays', { date: formatDate(cb.deadlineAt), days: cb.daysLeft }) : t('chargebacks.deadline', { date: formatDate(cb.deadlineAt) })}
      cta={t('chargebacks.submitCta')}
      noteLabel={t('chargebacks.evidenceDetails')}
      notePlaceholder={t('chargebacks.evidencePlaceholder')}
      requireNote
      disabledExtra={badUrl}
      successMessage={t('chargebacks.evidenceSubmitted')}
      run={(v) => act.mutateAsync({ path: `/payments/chargebacks/${cb.id}/submit-evidence`, body: { note: v.note, evidenceUrls: list.length ? list : undefined } })}
      onClose={onClose}
    >
      <TextAreaField label={t('chargebacks.evidenceLinks')} value={urls} onChange={setUrls} placeholder="https://..." />
      {badUrl && <div className="-mt-2 text-xs text-[#b91c1c]">{t('chargebacks.badUrl')}</div>}
    </ActionDialog>
  );
}

function ChargebackDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const q = useAdminData<AdminChargebackDetail>('payments', `/payments/chargebacks/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d ? t('chargebacks.detailTitle', { code: d.code }) : t('chargebacks.dispute')} sub={d?.transactionCode} onClose={onClose}>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError || !d ? (
        <ErrorBlock error={q.error} />
      ) : (
        <>
          <PreviewKv
            items={[
              [t('common.customer'), d.customer.name],
              [t('common.creator'), d.creator?.name],
              [t('common.community'), d.community.name],
              [t('common.amount'), formatCents(d.amountCents)],
              [t('common.reason'), CHARGEBACK_REASON[d.reason] ?? d.reason],
              [t('common.status'), badge(CHARGEBACK_STATUS, d.status)],
              [t('common.deadline'), formatDate(d.deadlineAt)],
              [t('common.evidence'), d.evidence === 'submitted' ? t('common.submitted') : t('common.missing')],
              [t('chargebacks.gatewayDisputeId'), d.gatewayDisputeId],
            ]}
          />
          {d.evidenceNote && (
            <PreviewSection title={t('chargebacks.evidenceDetails')}>
              <div className="rounded-xl bg-[#faf7f4] p-3.5 text-[13.5px] whitespace-pre-wrap">{d.evidenceNote}</div>
              {d.evidenceUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold break-all text-brand">
                  {u}
                </a>
              ))}
            </PreviewSection>
          )}
          <PreviewSection title={t('common.history')}>
            <HistoryList items={d.history} />
          </PreviewSection>
        </>
      )}
    </PreviewDialog>
  );
}

export function ChargebacksView() {
  const { t } = useTranslation('admin-payments');
  const ts = useTableState({}, '');
  const summary = useAdminData<ChargebackSummary>('payments', '/payments/chargebacks/summary');
  const list = useAdminList<AdminChargeback>('payments-cb', '/payments/chargebacks', { q: ts.q || undefined, status: ts.tab || undefined, sort: 'deadline', page: ts.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/payments/chargebacks/${id}/${action}`, body });

  const accept = (c: AdminChargeback) =>
    slot.show((close) => <ActionDialog icon="handshake" danger title={t('chargebacks.acceptTitle')} body={t('chargebacks.acceptBody', { code: c.code, amount: formatCents(c.amountCents) })} cta={t('common.accept')} noteLabel={t('common.noteOptional')} successMessage={t('chargebacks.accepted')} run={(v) => post(c.id, 'accept', { note: v.note || undefined })} onClose={close} />);
  const markWon = (c: AdminChargeback) =>
    slot.show((close) => <ActionDialog icon="emoji_events" title={t('chargebacks.markWonTitle')} body={c.code} cta={t('chargebacks.markWonCta')} noteLabel={t('common.noteOptional')} successMessage={t('chargebacks.markedWon')} run={(v) => post(c.id, 'mark-won', { note: v.note || undefined })} onClose={close} />);
  const markLost = (c: AdminChargeback) =>
    slot.show((close) => <ActionDialog icon="sentiment_dissatisfied" danger title={t('chargebacks.markLostTitle')} body={t('chargebacks.markLostBody', { code: c.code })} cta={t('chargebacks.markLostCta')} noteLabel={t('common.noteOptional')} successMessage={t('chargebacks.markedLost')} run={(v) => post(c.id, 'mark-lost', { note: v.note || undefined })} onClose={close} />);

  const columns: Column<AdminChargeback>[] = [
    { key: 'code', label: t('chargebacks.caseCol'), render: (c) => <MonoCell>{c.code}</MonoCell> },
    { key: 'user', label: t('common.user'), w: 1.6, render: (c) => personCell(c.customer) },
    { key: 'creator', label: t('common.creator'), render: (c) => <TextCell>{c.creator?.name ?? '—'}</TextCell> },
    { key: 'amt', label: t('common.amount'), render: (c) => money(c.amountCents) },
    { key: 'reason', label: t('common.reason'), w: 1.4, render: (c) => <TextCell>{CHARGEBACK_REASON[c.reason] ?? c.reason}</TextCell> },
    { key: 'deadline', label: t('common.deadline'), render: (c) => <MutedCell>{c.daysLeft != null ? t('chargebacks.daysLeft', { n: c.daysLeft }) : '—'}</MutedCell> },
    { key: 'evidence', label: t('common.evidence'), render: (c) => <TextCell>{c.evidence === 'submitted' ? t('common.submitted') : t('common.missing')}</TextCell> },
    { key: 'status', label: t('common.status'), render: (c) => badge(CHARGEBACK_STATUS, c.status) },
  ];
  const view = (c: AdminChargeback): RowAction => ({ label: t('common.view'), onClick: () => slot.show((close) => <ChargebackDetailDialog id={c.id} onClose={close} />) });
  const actions = (c: AdminChargeback): RowAction[] => {
    if (c.status === 'open')
      return [
        { label: t('chargebacks.submitCta'), icon: 'upload_file', onClick: () => slot.show((close) => <EvidenceDialog cb={c} onClose={close} />) },
        { label: t('common.accept'), icon: 'handshake', danger: true, onClick: () => accept(c) },
        view(c),
      ];
    if (c.status === 'under_review')
      return [
        { label: t('chargebacks.markWonCta'), icon: 'emoji_events', onClick: () => markWon(c) },
        { label: t('chargebacks.markLostCta'), icon: 'sentiment_dissatisfied', danger: true, onClick: () => markLost(c) },
        { label: t('common.accept'), icon: 'handshake', danger: true, onClick: () => accept(c) },
        view(c),
      ];
    return [view(c)];
  };

  return (
    <>
      <PageHeader title={t('chargebacks.pageTitle')} subtitle={t('chargebacks.pageSubtitle')} />
      <KpiGrid
        min={170}
        items={[
          { icon: 'gavel', label: t('chargebacks.kpiOpen'), value: s ? fmtNum(s.open) : '—', bad: true },
          { icon: 'emoji_events', label: t('common.won'), value: s ? fmtNum(s.won) : '—' },
          { icon: 'sentiment_dissatisfied', label: t('common.lost'), value: s ? fmtNum(s.lost) : '—', bad: true },
          { icon: 'payments', label: t('chargebacks.disputedAmount'), value: s ? formatCents(s.disputedAmountCents) : '—', bad: true },
        ]}
      />
      <DataTable<AdminChargeback>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: t('common.all') },
          { key: 'open', label: t('common.open'), count: s?.open },
          { key: 'under_review', label: t('chargebacks.tabUnderReview'), count: s?.underReview },
          { key: 'won', label: t('common.won'), count: s?.won },
          { key: 'lost', label: t('common.lost'), count: s?.lost },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('chargebacks.searchPlaceholder') }}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('chargebacks.empty')}
        onRow={(c) => slot.show((close) => <ChargebackDetailDialog id={c.id} onClose={close} />)}
        actions={actions}
        page={meta2(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ============================== Doanh thu creator ============================== */

export function CreatorsView() {
  const { t } = useTranslation('admin-payments');
  const navigate = useNavigate();
  const [days, setDays] = useState<RangeDays>(30);
  const fromIso = rangeFrom(days);
  const ts = useTableState({ sort: '' }, '');
  const summary = useAdminData<CreatorSummary>('payments', '/payments/creators/summary', { from: fromIso });
  const list = useAdminList<AdminCreatorRevenue>('payments-creators', '/payments/creators', { q: ts.q || undefined, sort: ts.f.sort || undefined, from: fromIso, page: ts.page, limit: LIMIT });
  const s = summary.data;

  const columns: Column<AdminCreatorRevenue>[] = [
    { key: 'creator', label: t('common.creator'), w: 1.6, render: (c) => personCell(c.creator) },
    { key: 'comms', label: t('common.community'), w: 0.7, render: (c) => <NumCell>{c.communities}</NumCell> },
    { key: 'gross', label: t('common.grossRevenue'), render: (c) => money(c.grossCents) },
    { key: 'ref', label: t('common.refundsTitle'), render: (c) => money(c.refundsCents) },
    { key: 'fee', label: t('common.platformFee'), render: (c) => money(c.platformFeeCents) },
    { key: 'net', label: t('common.netEarnings'), render: (c) => money(c.netCents) },
    { key: 'pend', label: t('common.pendingBalance'), render: (c) => money(c.pendingBalanceCents) },
    { key: 'wd', label: t('common.withdrawable'), render: (c) => money(c.withdrawableCents ?? 0) },
    { key: 'held', label: t('common.held'), render: (c) => money(c.heldCents ?? 0) },
    { key: 'rsv', label: t('common.reserve'), render: (c) => money(c.reserveCents ?? 0) },
    { key: 'debt', label: t('common.debt'), render: (c) => ((c.debtCents ?? 0) > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCents(c.debtCents ?? 0)}</span> : money(0)) },
  ];

  return (
    <>
      <PageHeader title={t('creators.pageTitle')} subtitle={t('creators.pageSubtitle')} actions={<DateRangeChips value={days} onChange={setDays} />} />
      {s && (
        <KpiGrid
          min={160}
          items={[
            { icon: 'storefront', label: t('common.creator'), value: fmtNum(s.creators) },
            { icon: 'payments', label: t('common.grossRevenue'), value: formatCents(s.grossCents) },
            { icon: 'percent', label: t('common.platformFee'), value: formatCents(s.platformFeeCents) },
            { icon: 'account_balance_wallet', label: t('common.netEarnings'), value: formatCents(s.netCents) },
            { icon: 'hourglass_top', label: t('common.pendingBalance'), value: formatCents(s.pendingBalanceCents) },
            ...(s.withdrawableCents !== undefined ? [{ icon: 'savings', label: t('common.withdrawable'), value: formatCents(s.withdrawableCents) }] : []),
            ...(s.heldCents !== undefined ? [{ icon: 'lock_clock', label: t('creators.heldHolding'), value: formatCents(s.heldCents) }] : []),
            ...(typeof s.reserveCents === 'number' ? [{ icon: 'shield', label: t('creators.reserveFund'), value: formatCents(s.reserveCents) }] : []),
            ...(s.debtCents !== undefined ? [{ icon: 'warning', label: t('creators.creatorDebt'), value: formatCents(s.debtCents), bad: s.debtCents > 0 }] : []),
          ]}
        />
      )}
      <DataTable<AdminCreatorRevenue>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.creator.id}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('creators.searchPlaceholder') }}
        filters={[{ key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'gross', label: t('common.grossRevenue') }, { value: 'pending', label: t('common.pendingBalance') }, { value: 'name', label: t('common.nameAZ') }], onChange: ts.setFilter('sort') }]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => navigate(`/admin/payments/creator/${c.creator.id}`)}
        page={meta2(list.data?.meta, ts.setPage)}
      />
    </>
  );
}

const payoutMethod = (p: AdminPayout) => <TextCell>{p.method.label}</TextCell>;

export function CreatorDetailView() {
  const { t } = useTranslation('admin-payments');
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState<RangeDays>(30);
  const fromIso = rangeFrom(days);
  const q = useAdminData<CreatorDetail>('payments', `/payments/creators/${userId}`, { from: fromIso }, !!userId);
  const d = q.data;

  const txCols: Column<AdminTransaction>[] = [
    { key: 'code', label: t('common.txId'), render: (x) => <MonoCell>{x.code}</MonoCell> },
    { key: 'cust', label: t('common.customer'), w: 1.6, render: (x) => personCell(x.customer) },
    { key: 'prod', label: t('common.product'), render: (x) => <TextCell>{x.product.label}</TextCell> },
    { key: 'amt', label: t('common.amount'), render: (x) => money(x.amountCents) },
    { key: 'earn', label: t('common.creatorEarnings'), render: (x) => money(x.creatorEarningsCents) },
    { key: 'st', label: t('common.status'), render: (x) => badge(TX_STATUS, x.status) },
    { key: 'date', label: t('common.date'), render: (x) => <MutedCell>{formatDate(x.createdAt)}</MutedCell> },
  ];
  const poCols: Column<AdminPayout>[] = [
    { key: 'code', label: t('common.payoutId'), render: (p) => <MonoCell>{p.code}</MonoCell> },
    { key: 'comm', label: t('common.community'), render: (p) => <TextCell>{p.community.name}</TextCell> },
    { key: 'amt', label: t('common.amount'), render: (p) => money(p.amountCents) },
    { key: 'method', label: t('common.method'), render: payoutMethod },
    { key: 'st', label: t('common.status'), render: (p) => badge(PAYOUT_STATUS, p.status) },
  ];
  const commCols: Column<CreatorDetail['communities'][number]>[] = [
    { key: 'name', label: t('common.community'), w: 1.6, render: (c) => <MainCell name={c.name} shape="square" seed={c.id} /> },
    { key: 'gross', label: t('common.grossRevenue'), render: (c) => money(c.grossCents) },
    { key: 'net', label: t('common.netEarnings'), render: (c) => money(c.netCents) },
    { key: 'pend', label: t('common.pendingBalance'), render: (c) => money(c.pendingBalanceCents) },
    { key: 'wd', label: t('common.withdrawable'), render: (c) => money(c.withdrawableCents ?? 0) },
    { key: 'held', label: t('common.held'), render: (c) => money(c.heldCents ?? 0) },
    { key: 'rsv', label: t('common.reserve'), render: (c) => money(c.reserveCents ?? 0) },
    { key: 'debt', label: t('common.debt'), render: (c) => money(c.debtCents ?? 0) },
  ];

  return (
    <>
      <PageHeader
        title={d?.creator.name ?? t('common.creator')}
        subtitle={d ? t('creators.detailSubtitle', { email: d.creator.email }) : undefined}
        trail={[{ label: t('creators.pageTitle'), to: '/admin/payments/creator' }, { label: d?.creator.name ?? '…' }]}
        actions={<DateRangeChips value={days} onChange={setDays} />}
      />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {d && (
        <>
          <KpiGrid
            min={160}
            items={[
              { icon: 'payments', label: t('common.grossRevenue'), value: formatCents(d.kpis.grossCents) },
              { icon: 'undo', label: t('common.refundsTitle'), value: formatCents(d.kpis.refundsCents), bad: true },
              { icon: 'percent', label: t('common.platformFee'), value: formatCents(d.kpis.platformFeeCents) },
              { icon: 'account_balance_wallet', label: t('common.netEarnings'), value: formatCents(d.kpis.netCents) },
              { icon: 'hourglass_top', label: t('common.pendingBalance'), value: formatCents(d.kpis.pendingBalanceCents) },
              ...(d.kpis.withdrawableCents !== undefined ? [{ icon: 'savings', label: t('common.withdrawable'), value: formatCents(d.kpis.withdrawableCents) }] : []),
              ...(d.kpis.heldCents !== undefined ? [{ icon: 'lock_clock', label: t('creators.heldHolding'), value: formatCents(d.kpis.heldCents) }] : []),
              ...(typeof d.kpis.reserveCents === 'number' ? [{ icon: 'shield', label: t('creators.reserveFund'), value: formatCents(d.kpis.reserveCents) }] : []),
              ...(d.kpis.debtCents !== undefined ? [{ icon: 'warning', label: t('creators.creatorDebt'), value: formatCents(d.kpis.debtCents), bad: d.kpis.debtCents > 0 }] : []),
            ]}
          />
          <ChartCard
            title={t('creators.chartTitle', { name: d.creator.name })}
            labels={d.series.map((x) => formatDate(x.date).slice(0, 5))}
            fmt={(v) => `$${Math.round(v / 100).toLocaleString('en-US')}`}
            series={[
              { name: t('creators.seriesGross'), values: d.series.map((x) => x.grossCents) },
              { name: t('creators.seriesNet'), values: d.series.map((x) => x.netCents) },
              { name: t('common.refundsTitle'), values: d.series.map((x) => x.refundsCents), color: '#dc2626' },
            ]}
          />
          <DataTable<CreatorDetail['communities'][number]> title={t('common.communities')} columns={commCols} rows={d.communities} rowKey={(c) => c.id} onRow={(c) => navigate(`/admin/communities/${c.id}`)} emptyText={t('creators.noCommunities')} />
          <DataTable<AdminTransaction> title={t('creators.txHistory')} sub={t('creators.last20')} columns={txCols} rows={d.transactions} rowKey={(x) => x.id} onRow={(x) => navigate(`/admin/payments/tx/${x.id}`)} emptyText={t('creators.noTx')} />
          <DataTable<AdminPayout> title={t('payouts.pageTitle')} sub={t('creators.last10Payouts')} columns={poCols} rows={d.payouts} rowKey={(p) => p.id} emptyText={t('creators.noPayouts')} />
        </>
      )}
    </>
  );
}

/* ================================== Chi trả ================================== */

function PayoutDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const q = useAdminData<AdminPayoutDetail>('payments', `/payments/payouts/${id}`);
  const d = q.data;
  return (
    <PreviewDialog title={d ? t('payouts.detailTitle', { code: d.code }) : t('payouts.payoutSingular')} sub={d?.creator.name} onClose={onClose}>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError || !d ? (
        <ErrorBlock error={q.error} />
      ) : (
        <>
          <PreviewKv
            items={[
              [t('common.creator'), `${d.creator.name} (${d.creator.email})`],
              [t('common.community'), d.community.name],
              [t('common.amount'), formatCents(d.amountCents)],
              [t('common.method'), d.method.label],
              [t('common.status'), badge(PAYOUT_STATUS, d.status)],
              [t('payouts.schedule'), formatDate(d.scheduledFor)],
              [t('payouts.paidOn'), d.paidAt ? formatDateTime(d.paidAt) : '—'],
              ...(d.failureReason ? ([[t('detail.failureReason'), d.failureReason]] as [string, ReactNode][]) : []),
              ...(d.note ? ([[t('common.note'), d.note]] as [string, ReactNode][]) : []),
            ]}
          />
          <PreviewSection title={t('payouts.creatorBalance')}>
            <PreviewKv
              items={[
                [t('common.netEarnings'), formatCents(d.creatorBalance.netCents)],
                [t('payouts.requestedWithdrawal'), formatCents(d.creatorBalance.requestedCents)],
                [t('payouts.netMinusRequested'), formatCents(d.creatorBalance.availableCents)],
                ...(d.creatorBalance.withdrawableCents !== undefined
                  ? ([
                      [t('payouts.withdrawableNow'), formatCents(d.creatorBalance.withdrawableCents)],
                      [d.creatorBalance.holdDays ? t('payouts.heldWithDays', { days: d.creatorBalance.holdDays }) : t('common.held'), formatCents(d.creatorBalance.heldCents ?? 0)],
                      [t('creators.reserveFund'), formatCents(d.creatorBalance.reserveCents ?? 0)],
                      [t('payouts.debtAfterWithdrawal'), formatCents(d.creatorBalance.debtCents ?? 0)],
                    ] as [string, ReactNode][])
                  : []),
              ]}
            />
          </PreviewSection>
          <PreviewSection title={t('common.history')}>
            <HistoryList items={d.history} />
          </PreviewSection>
        </>
      )}
    </PreviewDialog>
  );
}

export function PayoutsView() {
  const { t } = useTranslation('admin-payments');
  const ts = useTableState({ sort: '' }, '');
  const summary = useAdminData<PayoutSummary>('payments', '/payments/payouts/summary');
  const list = useAdminList<AdminPayout>('payments-payouts', '/payments/payouts', { q: ts.q || undefined, status: ts.tab || undefined, sort: ts.f.sort || undefined, page: ts.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;
  const post = (id: string, action: string, body: object) => act.mutateAsync({ path: `/payments/payouts/${id}/${action}`, body });

  const simple = (p: AdminPayout, action: string, icon: string, title: string, cta: string, ok: string, body?: string) =>
    slot.show((close) => <ActionDialog icon={icon} title={title} body={body ?? `${p.code} · ${formatCents(p.amountCents)} · ${p.creator.name}`} cta={cta} noteLabel={t('common.noteOptional')} successMessage={ok} run={(v) => post(p.id, action, { note: v.note || undefined })} onClose={close} />);
  const withReason = (p: AdminPayout, action: string, icon: string, title: string, cta: string, ok: string, reasons: string[], danger = true) =>
    slot.show((close) => <ActionDialog icon={icon} danger={danger} title={title} body={`${p.code} · ${formatCents(p.amountCents)} · ${p.creator.name}`} cta={cta} reasons={opts(reasons)} requireReason noteLabel={t('common.internalNote')} successMessage={ok} run={(v) => post(p.id, action, { reason: v.reason, note: v.note || undefined })} onClose={close} />);

  const approve = (p: AdminPayout) => simple(p, 'approve', 'check_circle', t('payouts.approveTitle'), t('common.approve'), t('payouts.approved'));
  const markPaid = (p: AdminPayout) => simple(p, 'mark-paid', 'paid', t('payouts.markPaidTitle'), t('payouts.markPaid'), t('payouts.markedPaid'));
  const release = (p: AdminPayout) => simple(p, 'release', 'lock_open', t('payouts.releaseTitle'), t('payouts.release'), t('payouts.released'));
  const retry = (p: AdminPayout) => simple(p, 'retry', 'refresh', t('payouts.retryTitle'), t('common.retry'), t('payouts.retried'));
  const hold = (p: AdminPayout) => withReason(p, 'hold', 'pause_circle', t('payouts.holdTitle'), t('common.hold'), t('payouts.held'), [t('payouts.reasonSuspectedFraud'), t('payouts.reasonDispute'), t('payouts.reasonVerify'), t('common.other')], false);
  const reject = (p: AdminPayout) => withReason(p, 'reject', 'block', t('payouts.rejectTitle'), t('common.reject'), t('payouts.rejected'), [t('payouts.reasonInvalidAccount'), t('subs.reasonFraud'), t('subs.reasonPolicy'), t('common.other')]);
  const markFailed = (p: AdminPayout) => withReason(p, 'mark-failed', 'error', t('payouts.markFailedTitle'), t('payouts.markFailedCta'), t('payouts.markedFailed'), [t('payouts.reasonBankRejected'), t('payouts.reasonGatewayError'), t('common.other')]);

  const columns: Column<AdminPayout>[] = [
    { key: 'code', label: t('common.payoutId'), render: (p) => <MonoCell>{p.code}</MonoCell> },
    { key: 'creator', label: t('common.creator'), w: 1.6, render: (p) => personCell(p.creator) },
    { key: 'amt', label: t('common.amount'), render: (p) => money(p.amountCents) },
    { key: 'method', label: t('common.method'), w: 1.2, render: payoutMethod },
    { key: 'sched', label: t('payouts.schedule'), render: (p) => <MutedCell>{formatDate(p.scheduledFor)}</MutedCell> },
    { key: 'paid', label: t('payouts.paidCol'), render: (p) => <MutedCell>{p.paidAt ? formatDate(p.paidAt) : '—'}</MutedCell> },
    { key: 'status', label: t('common.status'), render: (p) => badge(PAYOUT_STATUS, p.status) },
  ];
  const review = (p: AdminPayout): RowAction => ({ label: t('common.review'), onClick: () => slot.show((close) => <PayoutDetailDialog id={p.id} onClose={close} />) });
  const actions = (p: AdminPayout): RowAction[] => {
    switch (p.status) {
      case 'requested':
        return [review(p), { label: t('common.approve'), icon: 'check_circle', onClick: () => approve(p) }, { label: t('payouts.markPaid'), icon: 'paid', onClick: () => markPaid(p) }, { label: t('common.hold'), icon: 'pause_circle', onClick: () => hold(p) }, { label: t('common.reject'), icon: 'block', danger: true, onClick: () => reject(p) }];
      case 'approved':
        return [review(p), { label: t('payouts.markPaid'), icon: 'paid', onClick: () => markPaid(p) }, { label: t('payouts.markFailedCta'), icon: 'error', onClick: () => markFailed(p) }, { label: t('common.hold'), icon: 'pause_circle', onClick: () => hold(p) }, { label: t('common.reject'), icon: 'block', danger: true, onClick: () => reject(p) }];
      case 'failed':
        return [{ label: t('common.retry'), icon: 'refresh', onClick: () => retry(p) }, review(p), { label: t('common.hold'), icon: 'pause_circle', onClick: () => hold(p) }, { label: t('common.reject'), icon: 'block', danger: true, onClick: () => reject(p) }];
      case 'on_hold':
        return [{ label: t('payouts.release'), icon: 'lock_open', onClick: () => release(p) }, review(p), { label: t('common.reject'), icon: 'block', danger: true, onClick: () => reject(p) }];
      default:
        return [review(p)];
    }
  };

  return (
    <>
      <PageHeader title={t('payouts.pageTitle')} subtitle={t('payouts.pageSubtitle')} />
      <KpiGrid
        min={170}
        items={[
          { icon: 'hourglass_top', label: t('common.pending'), value: s ? formatCents(s.pendingCents) : '—' },
          { icon: 'sync', label: t('common.processing'), value: s ? formatCents(s.processingCents) : '—' },
          { icon: 'check_circle', label: t('payouts.paidOut'), value: s ? formatCents(s.paidCents) : '—' },
          { icon: 'pause_circle', label: t('payouts.onHold'), value: s ? formatCents(s.onHoldCents) : '—' },
          { icon: 'error', label: t('common.failed'), value: s ? formatCents(s.failedCents) : '—', bad: true },
        ]}
      />
      <DataTable<AdminPayout>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(p) => p.id}
        tabs={[
          { key: '', label: t('common.all') },
          { key: 'requested', label: t('common.pending'), count: s?.counts.requested },
          { key: 'approved', label: t('common.processing'), count: s?.counts.approved },
          { key: 'paid', label: t('payouts.paidOut'), count: s?.counts.paid },
          { key: 'failed', label: t('common.failed'), count: s?.counts.failed },
          { key: 'on_hold', label: t('payouts.onHold'), count: s?.counts.on_hold },
          { key: 'rejected', label: t('common.rejected'), count: s?.counts.rejected },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('payouts.searchPlaceholder') }}
        filters={[{ key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'amount', label: t('tx.highestAmount') }, { value: 'scheduled', label: t('payouts.bySchedule') }], onChange: ts.setFilter('sort') }]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('payouts.empty')}
        actions={actions}
        page={meta2(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

