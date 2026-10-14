import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../../../../lib/api';
import { formatDate } from '../../../../lib/datetime';
import { formatMoney } from '../../../../lib/format';
import { BankTransferPanel } from '../../../payments/components/BankTransferPanel';
import type { PaymentIntent, PaymentTransfer } from '../../../payments/types';

interface HostingInvoice {
  id: string;
  amountCents: number;
  refCode: string | null;
  expiresAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transfer: PaymentTransfer | null;
}

interface HostingPlan {
  planKey: 'start' | 'pro';
  cycle: 'monthly' | 'annual';
  priceAmount: number;
  currency: string;
  status: 'trialing' | 'active' | 'canceled';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  invoice: HostingInvoice | null;
}

const planKey = (communityId: string) => ['communities', communityId, 'hosting-plan'] as const;

/** Chủ cộng đồng: xem gói hosting hiện tại và trả hóa đơn phí gói Chuyên nghiệp bằng chuyển khoản QR khi tới hạn. */
export function HostingPlanTab({ communityId }: { communityId: string }) {
  const { t } = useTranslation('communities');
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: planKey(communityId),
    queryFn: ({ signal }) => apiGet<{ data: HostingPlan | null }>(`/communities/${communityId}/hosting-plan`, undefined, signal).then((r) => r.data),
    // Còn hóa đơn đang chờ thì làm mới định kỳ để thấy gói được gia hạn ngay khi tiền về.
    refetchInterval: (query) => (query.state.data?.invoice ? 15_000 : false),
  });
  const plan = q.data;
  const money = (n: number, currency: string) => formatMoney(n, currency);

  const invoice = plan?.invoice ?? null;
  // BankTransferPanel nhận một PaymentIntent: dựng từ hóa đơn (poll GET /payments/:id do chính panel làm).
  const asIntent = (inv: HostingInvoice): PaymentIntent => ({
    id: inv.id,
    courseId: communityId,
    userId: '',
    method: 'bank_transfer',
    amountUsd: inv.amountCents,
    amountCents: inv.amountCents,
    trialDays: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: inv.expiresAt ?? undefined,
    refCode: inv.refCode ?? undefined,
    transfer: inv.transfer,
  });

  return (
    <section className="glass flex flex-col gap-4 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold">{t('hostingPlan.title')}</h2>
      {q.isPending && <p className="text-sm text-stone-500">{t('hostingPlan.loading')}</p>}
      {q.isError && <p role="alert" className="text-sm text-red-600">{t('hostingPlan.loadFail')}</p>}
      {q.isSuccess && !plan && <p className="text-sm text-stone-600">{t('hostingPlan.none')}</p>}
      {plan && (
        <div className="rounded-2xl border border-[#f0ebe6] bg-white p-4 text-sm">
          <div className="text-[15px] font-bold">{plan.planKey === 'pro' ? t('hostingPlan.pro') : t('hostingPlan.start')}</div>
          {plan.planKey === 'pro' && (
            <ul className="mt-2 mb-0 list-none space-y-1 p-0 text-stone-600">
              <li>
                {t('hostingPlan.price', { price: money(plan.priceAmount, plan.currency), cycle: plan.cycle === 'annual' ? t('hostingPlan.annual') : t('hostingPlan.monthly') })}
              </li>
              {plan.status === 'trialing' && plan.trialEndsAt && <li>{t('hostingPlan.trialUntil', { date: formatDate(plan.trialEndsAt) })}</li>}
              {plan.status === 'active' && plan.currentPeriodEnd && <li>{t('hostingPlan.paidUntil', { date: formatDate(plan.currentPeriodEnd) })}</li>}
            </ul>
          )}
        </div>
      )}
      {invoice && (
        <div className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-4">
          <div className="text-[15px] font-bold">{t('hostingPlan.invoiceTitle', { amount: money(invoice.amountCents, 'VND') })}</div>
          <p className="mt-1 mb-3 text-sm text-stone-600">{t('hostingPlan.invoiceBody')}</p>
          <BankTransferPanel payment={asIntent(invoice)} onDone={() => void qc.invalidateQueries({ queryKey: planKey(communityId) })} />
        </div>
      )}
    </section>
  );
}
