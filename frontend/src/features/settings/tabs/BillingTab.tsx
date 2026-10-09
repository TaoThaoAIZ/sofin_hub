import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Pager } from '../../../components/ui/Pager';
import { ApiError } from '../../../lib/api';
import i18n from '../../../i18n';
import { formatCents, formatDate, formatDateTime } from '../../../lib/datetime';
import { useToast } from '../../admin/components/overlay';
import { InvoiceDialog } from '../../payments/components/InvoiceDialog';
import { PayNowDialog } from '../../payments/components/PayNowDialog';
import { useMyPayments, useMySubscriptions } from '../../payments/queries';
import type { PaymentRecord, Subscription } from '../../payments/types';
import { fetchAllPayments } from '../billing/api';
import { buildPaymentsCsv, downloadTextFile, PAY_STATUS, paymentDescription } from '../billing/csv';
import { useBillingSummary } from '../billing/queries';
import { RefundModal } from '../billing/RefundModal';
import { SubscriptionModal } from '../billing/SubscriptionModal';
import { CommunityLogo, OUTLINE_BTN, SCard, SHead } from '../ui';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : i18n.t('common.genericError', { ns: 'settings' }));

type Modal =
  | { kind: 'sub'; sub: Subscription }
  | { kind: 'refund'; payment: PaymentRecord }
  | null;

/* ------------------------------------------------------------------ khoản chờ thanh toán */
function PendingPaymentsCard({ onPay }: { onPay: (id: string) => void }) {
  const { t } = useTranslation('settings');
  const payments = useMyPayments(1);
  const pending = (payments.data?.data ?? []).filter((p) => p.status === 'pending');
  return (
    <SCard>
      <SHead icon="qr_code_2" size="lg" title={t('billing.pending.title')} sub={t('billing.pending.sub')} className="mb-[18px]" />
      <div className="flex flex-col gap-2.5">
        {payments.isPending && <p className="py-4 text-center text-stone-400">{t('billing.loading')}</p>}
        {payments.isError && <p role="alert" className="py-4 text-center text-[#dc2626]">{errText(payments.error)}</p>}
        {payments.data && pending.length === 0 && <p className="rounded-2xl border border-dashed border-[#e7e0da] px-4 py-6 text-center text-sm text-stone-500">{t('billing.pending.empty')}</p>}
        {pending.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f0ebe6] px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold" title={paymentDescription(p)}>{paymentDescription(p)}</div>
              <div className="mt-0.5 text-sm text-stone-600">
                {formatCents(p.amountCents ?? p.amountUsd)}
                {p.expiresAt ? ` · ${t('billing.pending.until', { date: formatDateTime(p.expiresAt) })}` : ''}
              </div>
            </div>
            <button type="button" onClick={() => onPay(p.id)} className="inline-flex h-[42px] items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white hover:opacity-90">
              <MaterialIcon name="qr_code_2" size={18} color="#fff" />
              {t('billing.pending.payNow')}
            </button>
          </div>
        ))}
      </div>
    </SCard>
  );
}

/* ------------------------------------------------------------------ hóa đơn tiếp theo */
function NextInvoiceCard() {
  const { t } = useTranslation('settings');
  const summary = useBillingSummary();
  const s = summary.data;
  return (
    <section
      className="relative min-w-0 overflow-hidden rounded-[20px] px-7 py-[26px] text-white"
      style={{ background: 'radial-gradient(120% 140% at 100% 0%,#3a4a3a 0%,#1f2a22 45%,#141a16 100%)' }}
    >
      <span className="absolute top-[26px] right-7">
        <MaterialIcon name="account_balance_wallet" size={36} filled color="#fdba74" />
      </span>
      <div className="text-[15px] text-[#e7e5e4]">{t('billing.next.title')}</div>
      <div className="mt-1.5 text-[38px] font-extrabold tracking-[-.02em]">{summary.isPending ? '…' : formatCents(s?.next?.amountCents ?? 0)}</div>
      <div className="mt-1.5 text-[14.5px] text-[#d6d3d1]">
        {summary.isError ? errText(summary.error) : s?.next ? t('billing.next.line', { date: formatDate(s.next.date), community: s.next.communityTitle, trial: s.next.trialing ? t('billing.next.trialEnds') : '' }) : t('billing.next.none')}
      </div>
      <div className="mt-[22px] flex items-center justify-between border-t border-white/[.18] pt-[18px] text-[15px]">
        <span className="text-[#e7e5e4]">{t('billing.next.monthly')}</span>
        <b className="text-xl">{formatCents(s?.monthlyTotalCents ?? 0)}</b>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ gói thành viên */
const tr = (key: string, opts: Record<string, unknown> = {}) => i18n.t(key, { ns: 'settings', ...opts });

function subStatus(s: Subscription): { text: string; tone: 'green' | 'amber' | 'gray' } {
  if (s.status === 'active' || s.status === 'trialing') {
    if (s.cancelAtPeriodEnd) return { text: tr('billing.sub.canceled'), tone: 'gray' };
    return s.status === 'trialing' ? { text: tr('billing.sub.trialing'), tone: 'amber' } : { text: tr('billing.sub.active'), tone: 'green' };
  }
  if (s.status === 'canceled') return { text: tr('billing.sub.canceled'), tone: 'gray' };
  if (s.status === 'expired') return { text: tr('billing.sub.expired'), tone: 'gray' };
  return { text: s.status === 'paused' ? tr('billing.sub.paused') : tr('billing.sub.pastDue'), tone: 'amber' };
}

function subLine(s: Subscription): string {
  const price = formatCents(s.priceCents);
  const per = s.interval === 'annual' ? tr('billing.sub.perYear') : tr('billing.sub.perMonth');
  const live = s.status === 'active' || s.status === 'trialing';
  if (live && s.cancelAtPeriodEnd) return tr('billing.sub.lineCanceling', { price, per, date: formatDate(s.accessUntil ?? s.currentPeriodEnd) });
  if (s.status === 'trialing') return tr('billing.sub.lineTrial', { price, date: formatDate(s.currentPeriodEnd) });
  if (s.status === 'active') return tr('billing.sub.lineActive', { price, per, date: formatDate(s.currentPeriodEnd) });
  return tr('billing.sub.lineEnded', { price, per, date: formatDate(s.canceledAt ?? s.currentPeriodEnd) });
}

const isLive = (s: Subscription) => s.status === 'active' || s.status === 'trialing';

function SubscriptionsCard({ onModal }: { onModal: (m: Modal) => void }) {
  const { t } = useTranslation('settings');
  const subs = useMySubscriptions();
  const sorted = [...(subs.data ?? [])].sort((a, b) => Number(isLive(b)) - Number(isLive(a)));
  return (
    <SCard>
      <SHead icon="workspace_premium" size="lg" title={t('billing.sub.title')} sub={t('billing.sub.sub')} className="mb-[18px]" />
      {subs.isPending && <p className="py-4 text-center text-stone-400">{t('billing.loading')}</p>}
      {subs.isError && <p role="alert" className="py-4 text-center text-[#dc2626]">{errText(subs.error)}</p>}
      {subs.data?.length === 0 && <p className="rounded-2xl border border-dashed border-[#e7e0da] px-4 py-6 text-center text-sm text-stone-500">{t('billing.sub.empty')}</p>}
      {sorted.length > 0 && (
        <div className="rounded-2xl border border-[#f0ebe6] px-4">
          {sorted.map((s) => {
            const st = subStatus(s);
            const title = s.courseTitle ?? t('billing.sub.community');
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-4 border-b border-[#f3eee9] py-4 last:border-b-0">
                <CommunityLogo name={title} seed={s.courseId} />
                <div className="min-w-[200px] flex-1">
                  <div className="text-base font-bold">{title}</div>
                  <div className="mt-[3px] text-sm text-stone-500">{subLine(s)}</div>
                </div>
                <span
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${st.tone === 'green' ? 'bg-[#dcfce7] text-[#15803d]' : st.tone === 'amber' ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#f1efed] text-stone-600'}`}
                >
                  <span className={`size-[9px] rounded-full ${st.tone === 'green' ? 'bg-[#16a34a]' : st.tone === 'amber' ? 'bg-[#f59e0b]' : 'bg-[#a8a29e]'}`} />
                  {st.text}
                </span>
                <button type="button" onClick={() => onModal({ kind: 'sub', sub: s })} className={`${OUTLINE_BTN} px-6`}>
                  {t('billing.sub.manage')}
                </button>
                <Link to={isLive(s) ? `/communities/${s.courseId}/community` : `/communities/${s.courseId}`} aria-label={t('billing.sub.open', { title })} className="grid place-items-center text-stone-600">
                  <MaterialIcon name="chevron_right" size={22} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </SCard>
  );
}

/* ------------------------------------------------------------------ lịch sử */
const COLS = 'grid-cols-[120px_minmax(240px,2fr)_130px_150px_120px]';

function HistoryCard({ onInvoice, onPay }: { onInvoice: (id: string) => void; onPay: (id: string) => void }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const payments = useMyPayments(page);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllPayments();
      if (rows.length === 0) return toast.error(t('billing.history.noRows'));
      downloadTextFile('lich-su-thanh-toan.csv', buildPaymentsCsv(rows));
      toast.success(t('billing.history.downloaded'));
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SCard>
      <SHead
        icon="history"
        size="lg"
        title={t('billing.history.title')}
        sub={t('billing.history.sub')}
        className="mb-[18px]"
        action={
          <button type="button" onClick={exportCsv} disabled={exporting} className={`${OUTLINE_BTN} px-[18px]`}>
            <MaterialIcon name="download" size={20} />
            {exporting ? t('billing.history.generating') : t('billing.history.downloadAll')}
          </button>
        }
      />
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className={`grid ${COLS} gap-3 rounded-xl bg-[#f7f4f1] px-[18px] py-3.5 text-sm text-stone-600`}>
            <span>{t('billing.history.colDate')}</span>
            <span>{t('billing.history.colDesc')}</span>
            <span>{t('billing.history.colAmount')}</span>
            <span>{t('billing.history.colStatus')}</span>
            <span>{t('billing.history.colInvoice')}</span>
          </div>
          {payments.isPending && <p className="py-8 text-center text-stone-400">{t('billing.loading')}</p>}
          {payments.isError && <p role="alert" className="py-8 text-center text-[#dc2626]">{errText(payments.error)}</p>}
          {payments.data?.data.length === 0 && <p className="py-8 text-center text-stone-500">{t('billing.history.empty')}</p>}
          {payments.data?.data.map((p) => {
            const st = PAY_STATUS[p.status] ?? { text: p.status, color: '#57534e', dot: '#a8a29e' };
            const cents = p.amountCents ?? p.amountUsd;
            return (
              <div key={p.id} className={`grid ${COLS} items-center gap-3 border-b border-[#f3eee9] px-[18px] py-4 text-[15px]`}>
                <span>{formatDate(p.confirmedAt ?? p.createdAt)}</span>
                <span className="truncate" title={paymentDescription(p)}>
                  {paymentDescription(p)}
                </span>
                <span className="font-semibold">
                  {formatCents(cents)}
                  {p.refundedCents ? <span className="block text-xs font-medium text-[#dc2626]">{t('billing.history.refunded', { amount: formatCents(p.refundedCents) })}</span> : null}
                </span>
                <span style={{ color: st.color }} className="flex items-center gap-2">
                  <span style={{ background: st.dot }} className="size-2 rounded-full" />
                  <span>
                    {st.text}
                    {p.refundStatus && p.status !== 'refunded' && <span className="block text-xs text-stone-500">{p.refundStatus === 'rejected' ? t('billing.history.refundRejected') : t('billing.history.refundPending')}</span>}
                  </span>
                </span>
                {p.status === 'pending' ? (
                  <button type="button" onClick={() => onPay(p.id)} className="flex items-center gap-1.5 border-0 bg-transparent p-0 font-semibold text-brand underline">
                    {t('billing.pending.payNow')}
                  </button>
                ) : p.invoiceNumber ? (
                  <button type="button" onClick={() => onInvoice(p.id)} className="flex items-center gap-1.5 border-0 bg-transparent p-0 font-semibold text-[#15803d] underline">
                    {t('billing.history.invoice')}
                    <MaterialIcon name="open_in_new" size={18} />
                  </button>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Pager page={page} totalPages={payments.data?.meta.totalPages ?? 1} onChange={setPage} />
    </SCard>
  );
}

export function BillingTab() {
  const [modal, setModal] = useState<Modal>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const close = () => setModal(null);

  return (
    <main className="flex min-w-0 flex-col gap-[18px]">
      <div className="grid items-stretch gap-[18px] min-[1180px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <PendingPaymentsCard onPay={setPayId} />
        <NextInvoiceCard />
      </div>
      <SubscriptionsCard onModal={setModal} />
      <HistoryCard onInvoice={setInvoiceId} onPay={setPayId} />

      {modal?.kind === 'sub' && <SubscriptionModal sub={modal.sub} onClose={close} onRefund={(payment) => setModal({ kind: 'refund', payment })} />}
      {modal?.kind === 'refund' && <RefundModal payment={modal.payment} onClose={close} />}
      {invoiceId && <InvoiceDialog paymentId={invoiceId} onClose={() => setInvoiceId(null)} />}
      {payId && <PayNowDialog paymentId={payId} onClose={() => setPayId(null)} />}
    </main>
  );
}
