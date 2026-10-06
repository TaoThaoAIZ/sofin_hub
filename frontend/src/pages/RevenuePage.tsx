import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import i18n from '../i18n';
import { Pager } from '../components/ui/Pager';
import { ApiError } from '../lib/api';
import { formatCents, formatDate, formatDateTime } from '../lib/datetime';
import { useCommunityDetail } from '../features/courses/queries';
import { usePayouts, useRequestPayout, useRevenue } from '../features/payments/queries';
import type { PayoutStatus } from '../features/payments/types';

const ERR_CODES = ['PAYOUT_BLOCKED', 'COMMUNITY_LOCKED'];
const errText = (e: unknown) =>
  e instanceof ApiError
    ? (e.code && ERR_CODES.includes(e.code) && i18n.t(`err.${e.code}`, { ns: 'revenue' })) || e.message
    : i18n.t('err.generic', { ns: 'revenue' });

const PAYOUT_CLS: Record<PayoutStatus, string> = {
  requested: 'bg-amber-500/10 text-amber-700',
  approved: 'bg-blue-500/10 text-blue-700',
  paid: 'bg-green-500/10 text-green-700',
  rejected: 'bg-red-500/10 text-red-600',
  failed: 'bg-red-500/10 text-red-600',
  on_hold: 'bg-stone-500/10 text-stone-700',
};

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[12px] font-semibold text-stone-500">{label}</div>
      <div className={`mt-1 text-[22px] font-extrabold ${accent ? 'text-brand' : ''}`}>{value}</div>
      {hint && <div className="text-[11.5px] text-stone-400">{hint}</div>}
    </div>
  );
}

function PayoutForm({ courseId, available, blocked }: { courseId: string; available: number; blocked: boolean }) {
  const { t } = useTranslation('revenue');
  const request = useRequestPayout(courseId);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cents = Math.round(Number(amount) * 100);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (blocked) return setError(t('err.PAYOUT_BLOCKED'));
    if (!Number.isFinite(cents) || cents <= 0) return setError(t('err.invalidAmount'));
    if (cents > available) return setError(t('err.overBalance', { amount: formatCents(available) }));
    if (!/^\d{6,20}$/.test(accountNumber.trim())) return setError(t('err.invalidAccount'));
    request.mutate(
      { amountCents: cents, method: { type: 'bank', bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountHolder: accountHolder.trim() } },
      {
        onSuccess: () => {
          setOk(true);
          setAmount('');
          setAccountNumber('');
        },
        onError: (err) => setError(errText(err)),
      },
    );
  };

  const input = 'h-11 w-full rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[14px] outline-0 focus:border-brand';
  return (
    <form onSubmit={submit} className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
      <h2 className="text-lg font-extrabold sm:col-span-2">{t('form.title')}</h2>
      <label className="text-[12.5px] font-semibold sm:col-span-2">
        {t('form.amount', { amount: formatCents(available) })}
        <input type="number" min="0" step="0.01" max={available / 100} disabled={blocked} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${input} mt-1`} required />
      </label>
      <label className="text-[12.5px] font-semibold">
        {t('form.bank')}
        <input value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={100} className={`${input} mt-1`} required />
      </label>
      <label className="text-[12.5px] font-semibold">
        {t('form.account')}
        <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" autoComplete="off" className={`${input} mt-1`} required />
      </label>
      <label className="text-[12.5px] font-semibold sm:col-span-2">
        {t('form.holder')}
        <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} maxLength={100} className={`${input} mt-1`} required />
      </label>
      {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600 sm:col-span-2">{error}</div>}
      {ok && <div className="rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700 sm:col-span-2">{t('form.sent')}</div>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={request.isPending || blocked || available <= 0} className="h-11 rounded-xl bg-brand px-6 text-[14px] font-bold text-white disabled:opacity-60">
          {request.isPending ? t('form.sending') : t('form.submit')}
        </button>
      </div>
    </form>
  );
}

function RevenueInner() {
  const { t } = useTranslation('revenue');
  const { id = '' } = useParams();
  const { data: course } = useCommunityDetail(id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = { from: from || undefined, to: to || undefined };
  const revenue = useRevenue(id, range);
  const [page, setPage] = useState(1);
  const payouts = usePayouts(id, page);
  const d = revenue.data;
  const pol = d?.payoutPolicy;
  const debt = d?.debtCents ?? 0;
  const forbidden = revenue.error instanceof ApiError && revenue.error.status === 403;

  return (
    <div className="min-w-0">
      <div className="py-2">
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        {course && <p className="text-sm text-stone-500">{course.title}</p>}

        {revenue.isPending && <p className="py-16 text-center text-stone-400">{t('loading')}</p>}
        {forbidden && <p className="glass mt-6 rounded-2xl py-12 text-center text-stone-600">{t('forbidden')}</p>}
        {revenue.isError && !forbidden && <p className="py-12 text-center text-red-600">{errText(revenue.error)}</p>}

        {d && (
          <>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="text-[12.5px] font-semibold">
                {t('from')}
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[14px]" />
              </label>
              <label className="text-[12.5px] font-semibold">
                {t('to')}
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[14px]" />
              </label>
              {(from || to) && (
                <button type="button" onClick={() => { setFrom(''); setTo(''); }} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3.5 text-[13px] font-medium">
                  {t('clearFilter')}
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={t('stats.gross')} value={formatCents(d.grossCents)} />
              <Stat label={t('stats.refunds')} value={formatCents(d.refundsCents)} />
              <Stat label={t('stats.commission')} value={formatCents(d.platformCommissionCents)} hint={t('stats.commissionHint', { pct: d.assumptions.platformCommissionPct })} />
              <Stat label={t('stats.gatewayFee')} value={formatCents(d.gatewayFeeCents)} hint={`${d.assumptions.gatewayFeePct}% + ${formatCents(d.assumptions.gatewayFeeFixedCents)}`} />
              <Stat label={t('stats.net')} value={formatCents(d.netCents)} accent />
              <Stat label={t('stats.available')} value={formatCents(d.availableBalanceCents)} hint={t('stats.allTime')} accent />
              {d.heldCents !== undefined && <Stat label={t('stats.held')} value={formatCents(d.heldCents)} hint={pol ? t('stats.heldHint', { days: pol.holdDays }) : undefined} />}
              {d.reserveCents !== undefined && <Stat label={t('stats.reserve')} value={formatCents(d.reserveCents)} hint={pol ? t('stats.reserveHint', { pct: pol.reservePct }) : undefined} />}
              <Stat label="MRR" value={formatCents(d.mrrCents)} hint={t('stats.mrrHint', { paid: d.activePaidMembers, trial: d.trialingMembers })} />
              <Stat label={t('stats.pending')} value={formatCents(d.payoutRequestedCents)} />
            </div>
            {debt > 0 && (
              <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
                {t('debt', { amount: formatCents(debt) })}
              </div>
            )}
            {pol && (
              <p className="mt-3 rounded-xl bg-stone-50 px-4 py-2.5 text-[12.5px] text-stone-600">
                {t('policy', { hold: pol.holdDays, refund: pol.refundWindowDays, dispute: pol.disputeWindowDays, reserve: pol.reservePct })}
                {pol.note ? ` ${pol.note}.` : ''}
              </p>
            )}
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-800">
              * {d.assumptions.note}. {t('estimateNote')}
            </p>

            <h2 className="mt-8 mb-3 text-lg font-extrabold">{t('recent.title')}</h2>
            <div className="glass overflow-x-auto rounded-3xl">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[rgba(120,60,20,.08)] text-[11.5px] tracking-wide text-stone-500">
                    <th className="px-4 py-3 font-semibold">{t('recent.time')}</th>
                    <th className="px-2 py-3 font-semibold">{t('recent.type')}</th>
                    <th className="px-2 py-3 font-semibold">{t('recent.invoice')}</th>
                    <th className="px-2 py-3 font-semibold">{t('recent.status')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('recent.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-500">{t('recent.empty')}</td>
                    </tr>
                  )}
                  {d.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-[rgba(120,60,20,.06)]">
                      <td className="px-4 py-2.5">{tx.confirmedAt ? formatDateTime(tx.confirmedAt) : '—'}</td>
                      <td className="px-2 py-2.5">{tx.kind === 'renewal' ? t('recent.renewal') : t('recent.initial')}</td>
                      <td className="px-2 py-2.5">{tx.invoiceNumber ?? '—'}</td>
                      <td className="px-2 py-2.5">{tx.status === 'refunded' ? t('recent.refunded') : t('recent.success')}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatCents(tx.amountCents)}
                        {tx.refundedCents > 0 && <div className="text-[11.5px] font-normal text-red-600">{t('recent.refund', { amount: formatCents(tx.refundedCents) })}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8">
              <PayoutForm courseId={id} available={d.availableBalanceCents} blocked={debt > 0} />
            </div>

            <h2 className="mt-8 mb-3 text-lg font-extrabold">{t('payouts.title')}</h2>
            <div className="glass overflow-x-auto rounded-3xl">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[rgba(120,60,20,.08)] text-[11.5px] tracking-wide text-stone-500">
                    <th className="px-4 py-3 font-semibold">{t('payouts.date')}</th>
                    <th className="px-2 py-3 font-semibold">{t('payouts.amount')}</th>
                    <th className="px-2 py-3 font-semibold">{t('payouts.account')}</th>
                    <th className="px-2 py-3 font-semibold">{t('payouts.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.isPending && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-400">{t('loading')}</td>
                    </tr>
                  )}
                  {payouts.data?.data.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-500">{t('payouts.empty')}</td>
                    </tr>
                  )}
                  {payouts.data?.data.map((p) => {
                    const stCls = PAYOUT_CLS[p.status];
                    return (
                      <tr key={p.id} className="border-b border-[rgba(120,60,20,.06)]">
                        <td className="px-4 py-2.5">{formatDate(p.createdAt)}</td>
                        <td className="px-2 py-2.5 font-semibold">{formatCents(p.amountCents)}</td>
                        <td className="px-2 py-2.5">
                          {p.method.bankName} · {p.method.accountMasked ?? `****${p.method.accountLast4 ?? ''}`}
                          <div className="text-[11.5px] text-stone-500">{p.method.accountHolder}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-flex h-[24px] items-center rounded-lg px-2 text-xs font-medium ${stCls}`}>{t(`payoutStatus.${p.status}`)}</span>
                          {p.note && <div className="mt-1 text-[11.5px] text-stone-500">{t('payouts.note', { note: p.note })}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={payouts.data?.meta.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export function RevenuePage() {
  return <RevenueInner />;
}
