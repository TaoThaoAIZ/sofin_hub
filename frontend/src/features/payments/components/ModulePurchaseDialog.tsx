import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { CardFields } from '../../../components/ui/CardFields';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { formatMoney } from '../../../lib/format';
import { communityDetail } from '../../../lib/paths';
import { useModuleQuote, usePurchaseModule } from '../queries';
import { useCardInput } from '../useCardInput';

export interface PurchasableModule {
  id: string;
  title: string;
  priceCents?: number;
}

/**
 * Hộp thoại mua lẻ MỘT module trả phí (thanh toán một lần, không phải gói thành viên) — mở ngay trên trang đang xem, không điều hướng.
 * Giá lấy từ GET /communities/:id/modules/:moduleId/purchase-quote; thẻ tokenise mock ở client (cùng CardFields/useCardInput với JoinCheckout).
 */
export function ModulePurchaseDialog({ communityId, module: mod, onClose }: { communityId: string; module: PurchasableModule; onClose: () => void }) {
  const { t } = useTranslation('payments');
  const quoteQuery = useModuleQuote(communityId, mod.id);
  const quote = quoteQuery.data;
  const purchase = usePurchaseModule(communityId, mod.id);
  const cardInput = useCardInput();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Một Idempotency-Key cho mỗi lần mở hộp thoại: bấm đúp không trừ tiền hai lần. Lỗi thanh toán → xin khóa mới cho lần thử lại.
  const key = useRef(crypto.randomUUID());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !purchase.isPending && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, purchase.isPending]);

  const priceCents = quote?.priceCents ?? mod.priceCents ?? 0;
  const price = formatMoney(priceCents / 100, quote?.currency ?? 'USD');
  const blocked = quote?.blocked ?? null;

  const submit = async () => {
    if (!quote?.canPurchase || purchase.isPending) return;
    setError(null);
    const paymentMethod = cardInput.collect();
    if (!paymentMethod) return;
    try {
      await purchase.mutateAsync({ paymentMethod, idempotencyKey: key.current });
      setDone(true);
    } catch (err) {
      key.current = crypto.randomUUID();
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'ALREADY_OWNED') {
        setDone(true);
        void quoteQuery.refetch();
      } else if (code === 'PAYMENT_FAILED') setError(t('modulePurchase.declined'));
      else if (code === 'COMMUNITY_LOCKED') setError(t('join.locked'));
      else if (code === 'JOIN_REQUIRED') void quoteQuery.refetch();
      else setError(err instanceof Error && err.message ? err.message : t('modulePurchase.failed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-stone-900/45 p-3 backdrop-blur-[2px] sm:p-4" onClick={() => !purchase.isPending && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t('modulePurchase.title')} className="m-auto w-full max-w-[460px]" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden rounded-[28px] bg-white shadow-2xl">
          <button type="button" aria-label={t('join.close')} onClick={onClose} disabled={purchase.isPending} className="absolute top-4 right-4 grid size-9 place-items-center rounded-full border border-[rgba(120,60,20,.1)] bg-white shadow-sm">
            <MaterialIcon name="close" size={20} />
          </button>
          <div className="bg-[linear-gradient(180deg,#fff1e6,#fff)] px-6 pt-8 pb-5 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/10">
              <MaterialIcon name={done ? 'lock_open' : 'lock'} size={30} filled color="#f26a1b" />
            </span>
            <h2 className="mt-3 mb-0 text-xl font-extrabold tracking-[-0.3px]">{done ? t('modulePurchase.unlocked') : t('modulePurchase.title')}</h2>
            <p className="mt-1 mb-0 text-sm font-semibold text-stone-800">{quote?.title ?? mod.title}</p>
            {!done && <p className="mt-1 mb-0 text-2xl font-extrabold text-brand">{price}</p>}
            {!done && <p className="mt-0.5 mb-0 text-xs text-stone-500">{t('modulePurchase.oneTime')}</p>}
          </div>

          <div className="border-t border-[rgba(120,60,20,.08)] px-6 pt-5 pb-6">
            {done ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <p role="status" className="m-0 text-sm text-stone-600">{t('modulePurchase.unlockedBody', { title: quote?.title ?? mod.title })}</p>
                <Button onClick={onClose} className="h-[48px] w-full rounded-2xl text-base font-bold">{t('modulePurchase.startLearning')}</Button>
              </div>
            ) : quoteQuery.isPending ? (
              <p className="py-8 text-center text-stone-500">{t('join.quoteLoading')}</p>
            ) : quoteQuery.isError ? (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {quoteQuery.error instanceof Error ? quoteQuery.error.message : t('join.quoteError')}
              </p>
            ) : blocked === 'JOIN_REQUIRED' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p role="alert" className="m-0 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{t('modulePurchase.joinFirst')}</p>
                <Link to={communityDetail(communityId)} className="inline-flex h-[48px] w-full items-center justify-center rounded-2xl bg-brand text-base font-bold text-white hover:opacity-90">
                  {t('modulePurchase.joinCta')}
                </Link>
              </div>
            ) : blocked === 'ALREADY_OWNED' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p role="status" className="m-0 text-sm text-stone-600">{t('modulePurchase.alreadyOwned')}</p>
                <Button onClick={onClose} className="h-[48px] w-full rounded-2xl text-base font-bold">{t('modulePurchase.startLearning')}</Button>
              </div>
            ) : blocked ? (
              <p role="alert" className="m-0 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {blocked === 'STAFF_EXEMPT' ? t('modulePurchase.staffExempt') : t('modulePurchase.cannotBuy')}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 text-[17px] font-extrabold">{t('join.paymentMethod')}</h3>
                  <span className="flex items-center gap-1.5 text-xs text-stone-500">
                    <MaterialIcon name="lock" size={15} filled color="#78716c" />
                    {t('join.securePayment', { provider: quote?.provider === 'stripe' ? 'Stripe' : quote?.provider })}
                  </span>
                </div>
                <div className="mt-3">
                  <CardFields value={cardInput.card} onChange={(v) => { cardInput.setCard(v); setError(null); }} errors={cardInput.errors} disabled={purchase.isPending} />
                </div>
                {error && (
                  <p role="alert" className="mt-3 mb-0 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">{error}</p>
                )}
                <Button onClick={() => void submit()} disabled={purchase.isPending || !quote?.canPurchase} className="mt-4 h-[52px] w-full gap-2.5 rounded-2xl text-base font-bold">
                  {purchase.isPending ? t('join.processing') : (
                    <>
                      <MaterialIcon name="lock_open" size={20} filled color="#fff" />
                      {t('modulePurchase.pay', { amount: price })}
                    </>
                  )}
                </Button>
                <p className="mt-3 mb-0 text-center text-xs text-stone-500">{t('modulePurchase.note')}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
