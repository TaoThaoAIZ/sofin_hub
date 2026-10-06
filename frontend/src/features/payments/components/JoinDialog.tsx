import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { CardFields } from '../../../components/ui/CardFields';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { toPaymentMethodInput, tokenizeCard, validateCard, type CardErrors, type CardForm } from '../../../lib/card';
import { formatCompact, formatMoney } from '../../../lib/format';
import type { CommunityDetail } from '../../courses/types';
import type { BillingInterval } from '../api';
import { useCategories } from '../../courses/queries';
import { useCheckout, useCheckoutQuote, useConfirmPayment, useStartTrial } from '../queries';
import type { QuotePlan } from '../types';

const emptyCard = (): CardForm => ({ number: '', expiry: '', cvc: '' });

const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/**
 * Nội dung hộp thoại "Chọn gói thành viên": gói/giá/%tiết kiệm/ngày dùng thử/ngày trừ tiền đầu/số tiền đều lấy từ
 * GET /communities/:id/checkout-quote. Thẻ được tokenise mock ở client — chỉ token + brand/last4/hạn được gửi đi.
 */
export function JoinCheckout({
  course,
  onClose,
  onDone,
  onNeedRequest,
}: {
  course: CommunityDetail;
  onClose?: () => void;
  onDone: () => void;
  /** BE trả JOIN_REQUEST_REQUIRED (cộng đồng riêng tư chưa được duyệt) → chuyển sang hộp thoại gửi yêu cầu. */
  onNeedRequest?: () => void;
}) {
  const { t } = useTranslation('payments');
  const courseId = course.id;
  const [interval, setIntervalState] = useState<BillingInterval | null>(null);
  // Mặc định chọn gói năm nếu cộng đồng có bán (như thiết kế), ngược lại gói tháng; người dùng bấm thì theo lựa chọn.
  const [hasAnnual, setHasAnnual] = useState(false);
  const selected: BillingInterval = interval ?? (hasAnnual ? 'annual' : 'monthly');
  const quoteQuery = useCheckoutQuote(courseId, selected);
  const quote = quoteQuery.data;
  if (quote && !hasAnnual && quote.plans.some((p) => p.interval === 'annual')) setHasAnnual(true);
  const [card, setCard] = useState<CardForm>(emptyCard);
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [error, setError] = useState<string | null>(null);

  const checkout = useCheckout(courseId);
  const confirm = useConfirmPayment();
  const trial = useStartTrial(courseId);
  const busy = checkout.isPending || confirm.isPending || trial.isPending;

  const plans = quote?.plans ?? [];
  const maxSavings = plans.reduce((m, p) => Math.max(m, p.savingsPct), 0);
  const current = plans.find((p) => p.interval === selected);
  const trialMode = !!quote && quote.trialEligible && quote.trialDays > 0;
  const stale = quoteQuery.isFetching || (!!quote && quote.selected !== selected);

  const submit = async () => {
    if (!quote || !current || stale) return;
    setError(null);
    const ce = validateCard(card);
    setCardErrors(ce);
    if (Object.keys(ce).length) return;
    // Tokenise phía client; số thẻ/CVC thô bị bỏ khỏi state ngay sau đây.
    const paymentMethod = toPaymentMethodInput(tokenizeCard(card));
    setCard(emptyCard());
    try {
      if (trialMode) {
        await trial.mutateAsync({ interval: selected, paymentMethod });
      } else {
        const intent = await checkout.mutateAsync({ method: 'stripe', interval: selected, paymentMethod });
        await new Promise((r) => setTimeout(r, 600)); // mô phỏng thời gian xử lý ở cổng thanh toán
        await confirm.mutateAsync(intent.id);
      }
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'JOIN_REQUEST_REQUIRED' && onNeedRequest) {
        onNeedRequest();
        return;
      }
      if (code === 'COMMUNITY_LOCKED') setError(t('join.locked'));
      else setError(err instanceof Error && err.message ? err.message : t('join.failed'));
    }
  };

  const { data: categories = [] } = useCategories();
  const categoryName = (categories.find((c) => c.id === course.category)?.name ?? course.category).toLowerCase();
  const ownerName = course.instructor.name;
  const lessons = Number(course.facts.find((f) => f.label === 'Bài học')?.value ?? 0);
  const chips = [
    { icon: 'group', v: `${formatCompact(course.stats.members)}${course.stats.members >= 10 ? '+' : ''}`, l: t('join.chipMembers') },
    ...(lessons > 0 ? [{ icon: 'menu_book', v: String(lessons), l: t('join.chipLessons') }] : []),
    ...(course.ratingCount > 0 ? [{ icon: 'star', v: String(course.rating), l: t('join.chipReviews', { count: course.ratingCount }) }] : [{ icon: 'wifi_tethering', v: String(course.stats.online), l: t('join.chipOnline') }]),
  ];

  const cta = trialMode ? t('join.ctaTrial') : quote?.paid === false ? t('join.ctaJoin') : t('join.ctaPay');

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-white shadow-2xl">
      <div className="bg-[linear-gradient(180deg,#fff1e6,#fff)] px-6 pt-8 pb-5 text-center">
        {onClose && (
          <button type="button" aria-label={t('join.close')} onClick={onClose} className="absolute top-4 right-4 grid size-9 place-items-center rounded-full border border-[rgba(120,60,20,.1)] bg-white shadow-sm">
            <MaterialIcon name="close" size={20} />
          </button>
        )}
        <div className="mx-auto grid size-[76px] place-items-center overflow-hidden rounded-[20px] bg-[#1e2a8a] text-lg font-extrabold text-white shadow-[0_12px_24px_rgba(30,42,138,.3)]">
          {course.logoUrl ? <img src={course.logoUrl} alt="" className="size-full object-cover" /> : (
            <span className="flex flex-col items-center gap-0.5 text-[11px]">
              <MaterialIcon name="image" size={26} color="#fff" />
              {course.title.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <h2 className="mt-4 mb-0 text-2xl font-extrabold tracking-[-0.3px]">{course.title}</h2>
        <p className="mt-1 mb-0 text-sm text-stone-600">
          {t('join.subtitle', { category: categoryName, owner: ownerName })}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2.5">
          {chips.map((c) => (
            <div key={c.l} className="flex items-center gap-2 text-left">
              <span className="grid size-9 place-items-center rounded-full bg-[#fff1e6]">
                <MaterialIcon name={c.icon} size={19} filled color="#f26a1b" />
              </span>
              <span className="text-xs leading-tight text-stone-600">
                <b className="block text-[13.5px] text-stone-900">{c.v}</b>
                {c.l}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[rgba(120,60,20,.08)] px-6 pt-5 pb-6">
        {quoteQuery.isPending && <p className="py-10 text-center text-stone-500">{t('join.quoteLoading')}</p>}
        {quoteQuery.isError && !quote && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {quoteQuery.error instanceof Error ? quoteQuery.error.message : t('join.quoteError')}
          </p>
        )}
        {quote && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-[17px] font-extrabold">{t('join.choosePlan')}</h3>
              {maxSavings > 0 && (
                <span className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-[13px] font-bold text-green-700">
                  <MaterialIcon name="sell" size={16} filled color="#16a34a" />
                  {t('join.saveUpTo', { pct: maxSavings })}
                </span>
              )}
            </div>

            <div role="radiogroup" aria-label={t('join.plansAria')} className={`mt-4 grid gap-3.5 ${plans.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {plans.map((p) => (
                <PlanCard key={p.interval} plan={p} on={selected === p.interval} onSelect={() => setIntervalState(p.interval)} currency={quote.currency} />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <h3 className="m-0 text-[17px] font-extrabold">{t('join.paymentMethod')}</h3>
              <span className="flex items-center gap-1.5 text-xs text-stone-500">
                <MaterialIcon name="lock" size={15} filled color="#78716c" />
                {t('join.securePayment', { provider: quote.provider === 'stripe' ? 'Stripe' : quote.provider })}
              </span>
            </div>
            <div className="mt-3">
              <CardFields value={card} onChange={(v) => { setCard(v); setCardErrors({}); setError(null); }} errors={cardErrors} disabled={busy} />
            </div>

            {current && (
              <div className="mt-3.5 flex items-center justify-between gap-3 text-[13px] text-stone-600">
                <span>
                  {t('join.perMonthLine', {
                    perMonth: formatMoney(current.perMonthUsd, quote.currency),
                    billing: current.interval === 'annual' ? t('join.billedAnnually', { amount: formatMoney(current.billedUsd, quote.currency) }) : t('join.billedMonthly'),
                  })}
                </span>
                <b className="text-sm text-stone-900">{formatMoney(current.billedUsd, quote.currency)}</b>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 mb-0 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <Button onClick={() => void submit()} disabled={busy || stale || !current} className="mt-4 h-[52px] w-full gap-2.5 rounded-2xl text-base font-bold">
              {busy ? t('join.processing') : (
                <>
                  <MaterialIcon name={trialMode ? 'workspace_premium' : 'lock'} size={20} filled color="#fff" />
                  {cta}
                  <MaterialIcon name="arrow_forward" size={20} color="#fff" />
                </>
              )}
            </Button>

            <div className="mt-4 flex gap-3 rounded-2xl bg-[linear-gradient(135deg,#fff4ea,#fff9f4)] p-4">
              <span className="grid size-10 flex-none place-items-center rounded-full bg-[#ffe7d4]">
                <MaterialIcon name="redeem" size={20} filled color="#f26a1b" />
              </span>
              <div className="text-[13px] leading-relaxed text-stone-600">
                {trialMode ? (
                  <>
                    <div className="text-sm font-bold text-stone-900">{t('join.trialTitle', { days: quote.trialDays })}</div>
                    {t('join.trialBody', { date: dayMonth(quote.firstChargeDate), amount: formatMoney(quote.firstChargeAmountUsd, quote.currency) })}{' '}
                    {quote.remindDaysBefore > 0 && t('join.remind', { days: quote.remindDaysBefore })}
                    {quote.cancelAnytime && t('join.cancelAnytime')}
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-stone-900">{t('join.dueToday', { amount: formatMoney(quote.dueTodayUsd, quote.currency) })}</div>
                    {quote.cancelAnytime && t('join.cancelAnytime')}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, on, onSelect, currency }: { plan: QuotePlan; on: boolean; onSelect: () => void; currency: string }) {
  const { t } = useTranslation('payments');
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={`relative rounded-[18px] p-4 pt-5 text-left ${on ? 'border-2 border-brand bg-[linear-gradient(180deg,#fff,#fff6ee)]' : 'border-[1.5px] border-[#ece5df] bg-[#fdfbf9]'}`}
    >
      {plan.popular && (
        <span className="absolute -top-px left-3.5 rounded-b-lg bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white">{t('join.popular')}</span>
      )}
      {plan.savingsPct > 0 && (
        <span className="absolute top-2.5 right-2.5 rounded-lg bg-green-100 px-2 py-0.5 text-[11.5px] font-bold text-green-700">{t('join.savePct', { pct: plan.savingsPct })}</span>
      )}
      <div className="mt-2 flex items-center gap-2.5">
        <MaterialIcon name={on ? 'radio_button_checked' : 'radio_button_unchecked'} size={24} color={on ? '#f26a1b' : '#a8a29e'} />
        <span className="text-[16px] font-extrabold">{plan.label}</span>
      </div>
      <div className={`mt-3 text-[34px] leading-none font-extrabold tracking-[-1px] ${on ? 'text-brand' : 'text-stone-900'}`}>
        {formatMoney(plan.perMonthUsd, currency)}
        <span className="text-base font-medium tracking-normal text-stone-500">{t('join.perMonth')}</span>
      </div>
      <div className="mt-2 text-[12.5px] text-stone-500">
        {t(plan.interval === 'annual' ? 'join.billedPlanAnnual' : 'join.billedPlanMonthly', { amount: formatMoney(plan.billedUsd, currency) })}
      </div>
    </button>
  );
}

/** Hộp thoại (modal) bao quanh JoinCheckout, dùng ở trang chi tiết cộng đồng. */
export function JoinDialog({
  course,
  onClose,
  onDone,
  onNeedRequest,
}: {
  course: CommunityDetail;
  onClose: () => void;
  onDone: () => void;
  onNeedRequest?: () => void;
}) {
  const { t } = useTranslation('payments');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-stone-900/45 p-3 backdrop-blur-[2px] sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('join.choosePlan')} className="m-auto w-full max-w-[560px]" onClick={(e) => e.stopPropagation()}>
        <JoinCheckout course={course} onClose={onClose} onDone={onDone} onNeedRequest={onNeedRequest} />
      </div>
    </div>
  );
}
